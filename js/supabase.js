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
  return fetch(proxiedUrl, { ...init, credentials: 'include' });
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
      headers: { 'Content-Type': 'application/json' },
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
    return result;
  },
  getSession() {
    if (!_sessionPromise) _sessionPromise = _authGet('/auth/session');
    return _sessionPromise;
  },
  async updateUser(attrs) {
    const result = await _authPost('/auth/update-user', attrs);
    _invalidateSession();
    return result;
  }
};
