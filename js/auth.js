// ============================================================
//  AUTH.JS – Supabase Auth logic (shared across all pages)
// ============================================================

// --- Sincronización Inmediata de Tema (evita parpadeo FOUC) ---
// Clave unificada: siempre 'theme' (elimina la antigua 'becamax_lightMode')
(function() {
  const t = localStorage.getItem('theme') || 'dark';
  // Migrar clave legacy si existe
  if (localStorage.getItem('becamax_lightMode') !== null) {
    if (localStorage.getItem('becamax_lightMode') === 'true') localStorage.setItem('theme', 'light');
    localStorage.removeItem('becamax_lightMode');
  }
  if (t === 'light' && document.body) document.body.classList.add('light-mode');
  if (t === 'light') document.documentElement.classList.add('light-mode');
})();


// ---- Helpers ------------------------------------------------
function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

// ---- Auth UI: switch tabs (auth.html) ----------------------
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(el => el.classList.remove('active'));
  document.getElementById('tab' + capitalize(tab)).classList.add('active');
  document.getElementById('form' + capitalize(tab)).classList.add('active');
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---- Register -----------------------------------------------
let timerInterval = null;

function iniciarContadorRateLimit(seconds, errEl, btn) {
  errEl.classList.add('visible');
  btn.disabled = true;
  clearInterval(timerInterval);
  
  const tick = () => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const tiempoTxt = m > 0 ? `${m}m ${s}s` : `${s}s`;

    errEl.textContent = `Por seguridad antispam, debes esperar ${tiempoTxt} para enviar otro correo de registro.`;
    btn.textContent = `Bloqueado (${tiempoTxt})`;
    seconds--;
    
    if (seconds < 0) {
      clearInterval(timerInterval);
      errEl.classList.remove('visible');
      btn.disabled = false;
      btn.textContent = 'Crear cuenta gratuita';
      localStorage.removeItem('rateLimitUnlock');
    }
  };
  
  tick();
  timerInterval = setInterval(tick, 1000);
}

// ---- hCaptcha helpers -----------------------------------------
// Sustituye a Cloudflare Turnstile (ver tareas_pendientes_becamax.txt):
// una extensión del navegador del admin inyectaba una CSP trusted-types
// que rompía el widget de Turnstile en cualquier sitio, no solo BecaMax.
// hCaptcha se renderiza explícitamente (no por auto-render vía clase HTML)
// para poder guardar el widgetID que devuelve render() y usarlo luego en
// getResponse()/reset() -- a diferencia de Turnstile, hCaptcha exige ese
// ID exacto, no acepta el id del contenedor como sustituto.
const hcaptchaWidgets = {};

function onHcaptchaLoad() {
  // El tema del captcha antes estaba fijo en 'dark': en modo claro aparecía
  // como una caja negra que desentonaba con el resto de la página.
  const theme = (localStorage.getItem('theme') || 'dark') === 'light' ? 'light' : 'dark';
  ['turnstile-login', 'turnstile-register', 'turnstile-resend'].forEach(containerId => {
    const el = document.getElementById(containerId);
    if (!el) return; // la página puede no tener los dos formularios (no aplica aquí, pero por si acaso)
    hcaptchaWidgets[containerId] = hcaptcha.render(containerId, {
      sitekey: CONFIG.HCAPTCHA_SITEKEY,
      theme
    });
  });
}

function getCaptchaToken(widgetId) {
  if (typeof hcaptcha === 'undefined' || hcaptchaWidgets[widgetId] === undefined) return null;
  // Mismo blindaje que antes con Turnstile: si el widget aún no ha
  // terminado de renderizarse, getResponse() puede lanzar en vez de
  // devolver undefined.
  try { return hcaptcha.getResponse(hcaptchaWidgets[widgetId]) || null; }
  catch (e) { return null; }
}

function resetCaptcha(widgetId) {
  if (typeof hcaptcha === 'undefined' || hcaptchaWidgets[widgetId] === undefined) return;
  try { hcaptcha.reset(hcaptchaWidgets[widgetId]); } catch (e) { /* noop */ }
}

async function handleRegister(e) {
  e.preventDefault();
  const nombre = document.getElementById('regNombre').value.trim();
  const email  = document.getElementById('regEmail').value.trim();
  const pass   = document.getElementById('regPassword').value;
  const errEl  = document.getElementById('regError');
  const btn    = document.getElementById('btnRegister');

  // Comprobar si ya estamos bloqueados internamente ANTES de hacer la petición
  const unlockTime = localStorage.getItem('rateLimitUnlock');
  if (unlockTime && Date.now() < parseInt(unlockTime)) {
    const remaining = Math.ceil((parseInt(unlockTime) - Date.now()) / 1000);
    iniciarContadorRateLimit(remaining, errEl, btn);
    return;
  }

  errEl.classList.remove('visible');

  const captchaToken = getCaptchaToken('turnstile-register');
  if (!captchaToken) {
    errEl.textContent = 'Marca la casilla del captcha antes de crear la cuenta';
    errEl.classList.add('visible');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creando cuenta…';

  try {
    const { error } = await supabaseClient.auth.signUp({
      email,
      password: pass,
      options: { data: { nombre }, captchaToken }
    });

    resetCaptcha('turnstile-register');

    if (error) {
      if (error.message.toLowerCase().includes('rate limit')) {
        // Supabase indica el tiempo exacto de espera cuando lo conoce
        // ("...after N seconds", límite propio de /auth/v1/signup, 60s por
        // defecto). Si no lo indica, es probable que sea la cuota horaria
        // compartida del SMTP por defecto de Supabase (bajísima, pensada
        // solo para pruebas) -- ahí sí toca esperar hasta una hora, sin
        // forma de saber el resto exacto desde el cliente.
        const espera = error.message.match(/after (\d+) second/i);
        const segundos = espera ? parseInt(espera[1], 10) : 3600;
        const lockUntil = Date.now() + segundos * 1000;
        localStorage.setItem('rateLimitUnlock', lockUntil);
        iniciarContadorRateLimit(segundos, errEl, btn);
      } else {
        btn.disabled = false;
        btn.textContent = 'Crear cuenta gratuita';
        errEl.textContent = tradError(error.message);
        errEl.classList.add('visible');
      }
    } else {
      btn.disabled = false;
      btn.textContent = 'Crear cuenta gratuita';
      document.getElementById('formRegistro').style.display = 'none';
      document.querySelector('.auth-tabs').style.display = 'none';
      document.getElementById('authSuccess').classList.add('visible');
      resendEmail = email;
    }
  } catch (err) {
    // Nunca dejar el botón bloqueado en silencio ante un fallo inesperado.
    btn.disabled = false;
    btn.textContent = 'Crear cuenta gratuita';
    errEl.textContent = 'No se pudo procesar el registro, inténtalo de nuevo';
    errEl.classList.add('visible');
  }
}

// ---- Reenviar email de confirmación --------------------------
let resendEmail = '';
let resendTimer = null;

function iniciarCooldownReenvio(seconds) {
  const btn = document.getElementById('btnResendConfirm');
  clearInterval(resendTimer);
  const tick = () => {
    if (seconds > 0) {
      btn.disabled = true;
      btn.textContent = `Reenviar en ${seconds}s`;
      seconds--;
    } else {
      clearInterval(resendTimer);
      btn.disabled = false;
      btn.textContent = 'Reenviar email';
    }
  };
  tick();
  resendTimer = setInterval(tick, 1000);
}

async function handleResendConfirmation() {
  const btn = document.getElementById('btnResendConfirm');
  const errEl = document.getElementById('resendError');
  errEl.classList.remove('visible');

  // Supabase exige captcha tambien en resend() al tener la protección
  // activada a nivel de proyecto -- necesita su propio widget porque el de
  // registro queda oculto (y ya usado) dentro del formulario.
  const captchaToken = getCaptchaToken('turnstile-resend');
  if (!captchaToken) {
    errEl.textContent = 'Marca la casilla del captcha antes de reenviar';
    errEl.classList.add('visible');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    const { error } = await supabaseClient.auth.resend({ type: 'signup', email: resendEmail, options: { captchaToken } });
    resetCaptcha('turnstile-resend');
    if (error) {
      // Supabase ya aplica su propio límite de envíos y nos dice cuánto
      // falta exactamente ("...you can only request this after 58
      // seconds"). Usamos ese número real en vez de inventar un cooldown
      // nuestro que podría no coincidir con el límite configurado en el
      // proyecto (y confundir, como ya pasó con el bloqueo de 1h del
      // registro).
      const espera = error.message.match(/after (\d+) second/i);
      if (espera) {
        errEl.textContent = `Ya se envió un email hace poco. Podrás reenviar en ${espera[1]}s.`;
        errEl.classList.add('visible');
        iniciarCooldownReenvio(parseInt(espera[1], 10));
      } else {
        btn.disabled = false;
        btn.textContent = 'Reenviar email';
        errEl.textContent = tradError(error.message);
        errEl.classList.add('visible');
      }
    } else {
      showToast('Email reenviado, revisa tu bandeja de entrada', 'success');
      btn.disabled = false;
      btn.textContent = 'Reenviar email';
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Reenviar email';
    errEl.textContent = 'No se pudo reenviar el email, inténtalo de nuevo';
    errEl.classList.add('visible');
  }
}

// ---- Login --------------------------------------------------
async function handleLogin(e) {
  e.preventDefault();
  const email  = document.getElementById('loginEmail').value.trim();
  const pass   = document.getElementById('loginPassword').value;
  const errEl  = document.getElementById('loginError');
  const btn    = document.getElementById('btnLogin');

  errEl.classList.remove('visible');

  const captchaToken = getCaptchaToken('turnstile-login');
  if (!captchaToken) {
    errEl.textContent = 'Marca la casilla del captcha antes de iniciar sesión';
    errEl.classList.add('visible');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando…';

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: pass,
      options: { captchaToken }
    });

    resetCaptcha('turnstile-login');

    btn.disabled = false;
    btn.textContent = 'Iniciar sesión';

    if (error) {
      errEl.textContent = tradError(error.message);
      errEl.classList.add('visible');
    } else {
      // Verificación de Bloqueo
      const { data: perfil } = await supabaseClient
        .from('perfiles')
        .select('estado')
        .eq('user_id', data.session.user.id)
        .single();

      if (perfil && perfil.estado === 'bloqueado') {
        await supabaseClient.auth.signOut();
        errEl.textContent = 'Cuenta suspendida por la administración.';
        errEl.classList.add('visible');
        return;
      }

      // Redirigir al returnUrl validado o al dashboard
      const params = new URLSearchParams(window.location.search);
      const rawRet = params.get('returnUrl') || '';
      const ret    = sanitizeReturnUrl(rawRet) || 'dashboard.html';
      window.location.href = ret;
    }
  } catch (err) {
    // Nunca dejar el botón bloqueado en silencio ante un fallo inesperado.
    btn.disabled = false;
    btn.textContent = 'Iniciar sesión';
    errEl.textContent = 'No se pudo iniciar sesión, inténtalo de nuevo';
    errEl.classList.add('visible');
  }
}

// ---- Forgot password ----------------------------------------
async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showToast('Introduce tu email primero', 'info'); return; }
  const captchaToken = getCaptchaToken('turnstile-login');
  if (!captchaToken) {
    showToast('Marca la casilla del captcha antes de continuar', 'info');
    return;
  }
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { captchaToken });
    resetCaptcha('turnstile-login');
    if (error) showToast('Error: ' + tradError(error.message), 'error');
    else showToast('Email de recuperación enviado', 'success');
  } catch (err) {
    // Nunca fallar en silencio: si algo inesperado revienta aquí, el
    // usuario debe ver algo, no que el botón "no responda".
    showToast('No se pudo procesar la solicitud, inténtalo de nuevo', 'error');
  }
}

// ---- Validación de returnUrl (previene Open Redirect) -------
// Solo permite rutas relativas internas (sin protocolo externo)
function sanitizeReturnUrl(url) {
  if (!url) return null;
  try {
    // Rechazar URLs absolutas con protocolo (http://, https://, //)
    if (/^(https?:)?\/\//i.test(url)) return null;
    // Solo permitir rutas que empiecen por / o sean relativas simples
    if (!/^[\/a-zA-Z0-9_.\-?=#&%+,]+$/.test(url)) return null;
    return url;
  } catch { return null; }
}

// ---- Sign out -----------------------------------------------
async function handleSignOut() {
  sessionStorage.clear();
  await supabaseClient.auth.signOut();
  const isPagesDir = window.location.pathname.includes('/pages/');
  const toRoot = isPagesDir ? '../' : './';
  window.location.href = toRoot + 'index.html';
}

// ---- Session guard: redirige si no está logueado -----------
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    const isPagesDir = window.location.pathname.includes('/pages/');
    const toPages = isPagesDir ? './' : 'pages/';
    window.location.href = toPages + 'auth.html?returnUrl=' + encodeURIComponent(window.location.pathname);
    return null;
  }

  // Verificación de Bloqueo Global
  const { data: perfil } = await supabaseClient
    .from('perfiles')
    .select('estado')
    .eq('user_id', session.user.id)
    .single();

  if (perfil && perfil.estado === 'bloqueado') {
    await supabaseClient.auth.signOut();
    showToast('Acceso denegado: su cuenta ha sido suspendida.', 'error');
    const isPagesDir = window.location.pathname.includes('/pages/');
    const toRoot = isPagesDir ? '../' : './';
    setTimeout(() => { window.location.href = toRoot + 'index.html'; }, 2500);
    return null;
  }

  return session;
}

// ---- Update header with user info --------------------------
async function updateHeaderAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    // La sección "Potencia tu futuro" de la home es un argumento de venta
    // para quien todavía no tiene cuenta; quien ya inició sesión no la necesita.
    const featuresSection = document.getElementById('featuresSection');
    if (featuresSection) featuresSection.style.display = 'none';

    // initFavorites() antes solo se llamaba desde dashboard.js: en el resto
    // de páginas (buscador, ficha de beca...) el botón de estrella se
    // encontraba _userId sin asignar y redirigía al login aunque hubiera
    // sesión iniciada. Se centraliza aquí porque updateHeaderAuth() corre
    // en todas las páginas que cargan auth.js.
    // getSession() puede resolver via microtask (sesión ya en caché) antes
    // de que el <script> de favorites.js, que va después en el HTML, llegue
    // a ejecutarse -- de ahí el chequeo de document.readyState en vez de
    // llamar directo, para no depender del orden de los <script>.
    const tryInitFavorites = () => {
      if (typeof initFavorites === 'function') initFavorites(session.user.id);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryInitFavorites, { once: true });
    } else {
      tryInitFavorites();
    }

    const nombre = session.user.user_metadata?.full_name || session.user.user_metadata?.nombre || session.user.email.split('@')[0];

    let perfil = null;
    const cacheKey = `becamax_perfil_${session.user.id}`;
    const cachedPerfil = sessionStorage.getItem(cacheKey);
    
    if (cachedPerfil) {
      perfil = JSON.parse(cachedPerfil);
    } else {
      const { data } = await supabaseClient.from('perfiles').select('rol, avatar_url').eq('user_id', session.user.id).single();
      perfil = data;
      if (perfil) sessionStorage.setItem(cacheKey, JSON.stringify(perfil));
    }

    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      let dropdown = document.getElementById('userDropdownMenuDiv');
      if (!dropdown) {
        
        // Determinar base de ruta (si estamos en /pages/ o en /)
        const isPagesDir = window.location.pathname.includes('/pages/');
        const toRoot = isPagesDir ? '../' : './';
        const toPages = isPagesDir ? './' : 'pages/';

        const adminLinks = perfil?.rol === 'admin' ? `
          <a href="${toPages}admin-monitorizacion.html" class="dropdown-link">Panel de Control</a>
        ` : '';

        const misAlertasBtn = `
          <a href="${toPages}dashboard.html" class="btn btn-ghost btn-sm" style="margin-right:8px;">Mis alertas</a>
        `;

        const avatarFallback = escapeHtml(nombre.charAt(0).toUpperCase());
        const avatarImg = perfil?.avatar_url
          ? `<img src="${escapeHtml(perfil.avatar_url)}" class="dropdown-avatar-small">`
          : `<div class="dropdown-avatar-small-placeholder">${avatarFallback}</div>`;

        const avatarImgLarge = perfil?.avatar_url
          ? `<img src="${escapeHtml(perfil.avatar_url)}" class="dropdown-avatar-large">`
          : `<div class="dropdown-avatar-large-placeholder">${avatarFallback}</div>`;

        const html = `
          ${misAlertasBtn}
          <div class="user-dropdown-container">
            <button class="user-dropdown-btn" onclick="toggleUserDropdown(event)">
              <span class="user-name user-name-dropdown">${escapeHtml(nombre)}</span>
              ${avatarImg}
            </button>
            <div class="user-dropdown-menu" id="userDropdownContent">
              ${avatarImgLarge}
              <div class="dropdown-name">${escapeHtml(nombre)}</div>
              <div class="dropdown-role">${perfil?.rol === 'admin' ? 'Administrador' : 'Estudiante'}</div>
              <hr class="dropdown-divider">
              <div class="dropdown-links">
                <a href="${toPages}perfil.html" class="dropdown-link">Mi Perfil</a>
                <a href="${toPages}configuracion.html" class="dropdown-link">Configuración</a>
                ${adminLinks}
                <hr class="dropdown-divider">
                <button onclick="handleSignOut()" class="dropdown-link" style="color:var(--danger); background:none; border:none; width:100%; text-align:left; cursor:pointer;">Cerrar sesión</button>
              </div>
            </div>
          </div>
        `;
        
        // Limpiar botones estáticos legacy para evitar duplicados
        Array.from(headerActions.querySelectorAll('a, button, span, div')).forEach(el => {
          if (el.id === 'userDropdownMenuDiv') return;
          const t = el.textContent.trim().toLowerCase();
          if (
            t.includes('cerrar sesión') || t.includes('salir') || 
            t.includes('iniciar sesión') || t.includes('registrarse') || 
            t.includes('perfil') || t.includes('configuración') ||
            (t.includes('mis alertas') && el.tagName === 'A') || 
            (t.includes('monitorización') && el.tagName === 'A') ||
            el.id === 'headerUserName' || el.classList.contains('user-menu')
          ) {
            el.remove();
          }
        });

        const wrapper = document.createElement('div');
        wrapper.id = 'userDropdownMenuDiv';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.innerHTML = html;
        headerActions.appendChild(wrapper);
      }
    }

    // Menú Móvil Dinámico
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
      const isPagesDir = window.location.pathname.includes('/pages/');
      const toRoot = isPagesDir ? '../' : './';
      const toPages = isPagesDir ? './' : 'pages/';
      
      const avatarFallback = escapeHtml(nombre.charAt(0).toUpperCase());
      const avatarImgLarge = perfil?.avatar_url
        ? `<img src="${escapeHtml(perfil.avatar_url)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--primary);">`
        : `<div style="width:48px;height:48px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:bold;">${avatarFallback}</div>`;

      mobileMenu.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid var(--glass-border);">
           ${avatarImgLarge}
           <div style="text-align:left;">
             <div style="font-weight:bold; font-size:1.1rem; color:var(--text-primary);">${escapeHtml(nombre)}</div>
             <div style="font-size:0.8rem; text-transform:uppercase; color:var(--primary-light); font-weight:600;">${perfil?.rol === 'admin' ? 'Administrador' : 'Estudiante'}</div>
           </div>
        </div>
        <a href="${toRoot}index.html" class="btn btn-ghost btn-full" style="margin-bottom:10px; justify-content:center;">Buscar becas</a>
        <a href="${toPages}dashboard.html" class="btn btn-secondary btn-full" style="margin-bottom:10px; justify-content:center;">Mis alertas</a>
        <a href="${toPages}perfil.html" class="btn btn-ghost btn-full" style="margin-bottom:10px; justify-content:center;">Mi Perfil</a>
        <a href="${toPages}configuracion.html" class="btn btn-ghost btn-full" style="margin-bottom:10px; justify-content:center;">Configuración</a>
        ${perfil?.rol === 'admin' ? `<a href="${toPages}admin-monitorizacion.html" class="btn btn-warning btn-full" style="margin-bottom:10px; justify-content:center;">Monitorización</a>` : ''}
        <button onclick="handleSignOut()" class="btn btn-danger btn-full" style="margin-top:10px; width:100%;">Cerrar sesión</button>
      `;
    }
  }
}

// Eventos Globales de Dropdown
window.toggleUserDropdown = function(e) {
  e.stopPropagation();
  const menu = document.getElementById('userDropdownContent');
  if(menu) menu.classList.toggle('active');
}

window.addEventListener('click', function(e) {
  const menu = document.getElementById('userDropdownContent');
  if(menu && menu.classList.contains('active')) {
    menu.classList.remove('active');
  }
});


// ---- Error translation --------------------------------------
function tradError(msg) {
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (msg.includes('Email not confirmed'))       return 'Confirma tu email antes de entrar.';
  if (msg.includes('User already registered'))   return 'Este email ya tiene cuenta. Inicia sesión.';
  if (msg.includes('Password should'))            return 'La contraseña debe tener al menos 8 caracteres.';
  if (msg.includes('security purposes'))          return 'Por seguridad, espera unos segundos antes de volver a intentarlo.';
  if (msg.toLowerCase().includes('captcha'))      return 'Verificación de seguridad no válida, recarga la página e inténtalo de nuevo.';
  return msg;
}

// ---- Theme Logic & DB Sync -----------------------------------
const ICON_SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const ICON_MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

async function initTheme() {
  const localTheme = localStorage.getItem('theme') || 'dark';
  
  if (localTheme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
  
  // Inyectar botón en la cabecera si existe
  const headerInner = document.querySelector('.header-inner');
  if (headerInner && !document.getElementById('themeToggle')) {
    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.marginRight = 'auto'; 
    btn.style.marginLeft = '20px';
    btn.innerHTML = localTheme === 'light' ? ICON_MOON : ICON_SUN;
    btn.title = 'Cambiar tema';
    
    // Insertar antes de actions o al final
    const actions = document.querySelector('.header-actions');
    if (actions) {
      headerInner.insertBefore(btn, actions);
    } else {
      headerInner.appendChild(btn);
    }

    // Evento click
    btn.addEventListener('click', async () => {
      const isLight = document.body.classList.toggle('light-mode');
      const newTheme = isLight ? 'light' : 'dark';
      btn.innerHTML = isLight ? ICON_MOON : ICON_SUN;
      localStorage.setItem('theme', newTheme);
    });
  }
}

document.addEventListener('DOMContentLoaded', initTheme);

// ---- Init on every page ------------------------------------
updateHeaderAuth();
