// ============================================================
//  SUPABASE CONFIG
//  El token de sesion ya NO vive en localStorage: el backend
//  (Backend-BecaMax) lo guarda en una cookie httpOnly tras el login y la
//  adjunta el solo en cada llamada. Este cliente sigue usando la misma
//  interfaz supabase-js de siempre (createClient, .from(), .storage) para
//  no tener que reescribir cada pantalla, pero con un fetch a medida que
//  redirige toda llamada a Supabase hacia nuestro propio backend, que es
//  quien de verdad conoce el token (via la cookie, invisible para este JS).
// ============================================================

const SUPABASE_URL = 'https://aklieayhnjnhikmggpiv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_09neP8LoEfPp96xCoxKEwA_X9gk5cxc';

function proxiedFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);

  let proxiedUrl = null;
  if (url.pathname.startsWith('/rest/v1/')) {
    proxiedUrl = new URL(CONFIG.BASE_URL + '/api/db' + url.pathname.slice('/rest/v1'.length), window.location.href);
  } else if (url.pathname.startsWith('/storage/v1/')) {
    proxiedUrl = new URL(CONFIG.BASE_URL + '/api/storage' + url.pathname.slice('/storage/v1'.length), window.location.href);
  }

  if (!proxiedUrl) return fetch(input, init); // no debería pasar con el uso actual del cliente

  proxiedUrl.search = url.search;
  // Cabecera custom: un <form> cross-site no puede fijarla, así que su
  // ausencia es la señal que el backend usa para bloquear escrituras CSRF
  // (ver requireFetchHeader.js). Un GET no la necesita pero no molesta.
  const headers = new Headers(init.headers || {});
  headers.set('x-becamax-client', '1');
  return fetch(proxiedUrl, { ...init, headers, credentials: 'include' });
}

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: proxiedFetch },
  // Sin sesion local que persistir/refrescar: el backend es quien la
  // guarda (cookie httpOnly) y la refresca (ver AuthAPI.getSession()).
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

// ============================================================
//  AUTH API – sustituye a supabaseClient.auth.* para las operaciones que
//  antes tocaban el token directamente (login, registro, sesion...). Habla
//  con los endpoints nuevos del backend en vez de con Supabase Auth
//  directamente, para que el token nunca pase por JS. Se ha mantenido la
//  misma forma de respuesta ({data, error}) que supabase-js para que el
//  código que la llama cambie lo mínimo posible.
// ============================================================
async function _authPost(path, body) {
  try {
    const res = await fetch(CONFIG.API_URL + path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-becamax-client': '1' },
      body: JSON.stringify(body || {})
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: { message: json.message || 'Error de red' } };
    return { data: json.data !== undefined ? json.data : json, error: null };
  } catch (e) {
    return { data: null, error: { message: 'Error de conexión' } };
  }
}

async function _authGet(path) {
  try {
    const res = await fetch(CONFIG.API_URL + path, { credentials: 'include' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: { message: json.message || 'Error de red' } };
    return { data: json.data !== undefined ? json.data : json, error: null };
  } catch (e) {
    return { data: null, error: { message: 'Error de conexión' } };
  }
}

// La sesion ya no vive cacheada en el propio cliente (antes supabase-js la
// tenia en memoria/localStorage y getSession() era practicamente gratis).
// Ahora cada llamada es un viaje de red real al backend, y varias funciones
// de cada pagina piden la sesion por separado (cabecera, guardias de acceso,
// carga de datos...) -- sin cachear, eso son 3+ peticiones encadenadas en
// serie en paginas como perfil.html, con la lentitud correspondiente.
// Se cachea la MISMA promesa (no solo el resultado) para que llamadas
// concurrentes esperen la unica peticion en curso en vez de disparar varias
// a la vez. Se invalida tras login/logout/updateUser para no servir datos
// obsoletos de sesion.
let _sessionPromise = null;
function _invalidateSession() { _sessionPromise = null; }

const AuthAPI = {
  signUp({ email, password, options }) {
    return _authPost('/auth/register', { email, password, nombre: options?.data?.nombre, captchaToken: options?.captchaToken });
  },
  resend({ email, options }) {
    return _authPost('/auth/resend', { email, captchaToken: options?.captchaToken });
  },
  async signInWithPassword({ email, password, options }) {
    const result = await _authPost('/auth/login', { email, password, captchaToken: options?.captchaToken });
    _invalidateSession();
    return result;
  },
  resetPasswordForEmail(email, options) {
    return _authPost('/auth/forgot-password', { email, captchaToken: options?.captchaToken });
  },
  async signOut() {
    const result = await _authPost('/auth/logout');
    _invalidateSession();
    _invalidatePerfil();
    return result;
  },
  getSession() {
    if (!_sessionPromise) {
      // Todo el sitio hace `const {data:{session}} = await AuthAPI.getSession()`
      // sin comprobar `error` antes -- confiando en que `data.session` SIEMPRE
      // existe (aunque sea null). _authGet devuelve `data:null` en cualquier
      // fallo HTTP (un 503 puntual del backend, un despliegue en curso...), lo
      // que rompía esa destructuración con un TypeError y tumbaba la pagina
      // entera. Se normaliza aqui, en el unico sitio que hace falta, para que
      // un fallo de red se trate simplemente como "sin sesion".
      _sessionPromise = _authGet('/auth/session').then(result => {
        if (!result.data || result.data.session === undefined) {
          return { data: { session: null }, error: result.error };
        }
        return result;
      });
    }
    return _sessionPromise;
  },
  async updateUser(attrs) {
    const result = await _authPost('/auth/update-user', attrs);
    _invalidateSession();
    return result;
  }
};

// ============================================================
//  PERFIL API – misma idea que la cache de sesion: la fila de `perfiles`
//  del usuario actual la piden por separado requireAuth() (comprobar
//  bloqueo), updateHeaderAuth() (rol/avatar de la cabecera), y cada
//  pagina para sus propios datos (perfil.html, dashboard.html llega a
//  pedirla 3 veces distintas). Antes del refactor a cookies cada
//  .from() era una unica peticion directa a Supabase; ahora cada una pasa
//  por el proxy (navegador -> backend -> Supabase), asi que repetirla
//  varias veces por pagina se nota de verdad en el tiempo de carga.
//  Se cachea la fila completa (select *) una vez por pagina y cada sitio
//  coge de ahi el campo que necesite.
let _perfilPromise = null;
function _invalidatePerfil() { _perfilPromise = null; }

const PerfilAPI = {
  async getMine() {
    const { data: { session } } = await AuthAPI.getSession();
    if (!session) return { data: null, error: { message: 'No autenticado' } };
    if (!_perfilPromise) {
      _perfilPromise = supabaseClient.from('perfiles').select('*').eq('user_id', session.user.id).single();
    }
    return _perfilPromise;
  },
  invalidate: _invalidatePerfil
};

// ============================================================
//  ANALYTICS API – embudo busqueda -> ver beca -> crear alerta -> registro.
//  Solo envia nada si hay consentimiento de la categoria "Analisis" (ver
//  js/cookies.js). Nunca debe poder romper la UI: cualquier fallo se traga
//  en silencio, es telemetria, no una funcion critica.
// ============================================================
function _getAnalyticsId() {
  let id = localStorage.getItem('becamax_analytics_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('becamax_analytics_id', id);
  }
  return id;
}

const AnalyticsAPI = {
  async track(evento, meta = {}) {
    if (!window.BecaMaxConsent || !window.BecaMaxConsent.hasAnalyticsConsent()) return;
    try {
      const { data: { session } } = await AuthAPI.getSession();
      await supabaseClient.from('eventos_embudo').insert({
        evento,
        meta,
        user_id: session ? session.user.id : null,
        analytics_id: _getAnalyticsId()
      });
    } catch (e) { /* telemetria: nunca debe romper la pagina */ }
  }
};
