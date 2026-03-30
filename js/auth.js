// ============================================================
//  AUTH.JS – Supabase Auth logic (shared across all pages)
// ============================================================

// --- Sincronización Inmediata de Tema (evita parpadeo) ---
const localTheme = localStorage.getItem('theme') || 'dark';
if (localTheme === 'light' && document.body) {
  document.body.classList.add('light-mode');
}


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
async function handleRegister(e) {
  e.preventDefault();
  const nombre = document.getElementById('regNombre').value.trim();
  const email  = document.getElementById('regEmail').value.trim();
  const pass   = document.getElementById('regPassword').value;
  const errEl  = document.getElementById('regError');
  const btn    = document.getElementById('btnRegister');

  errEl.classList.remove('visible');
  btn.disabled = true;
  btn.textContent = 'Creando cuenta…';

  const { error } = await supabaseClient.auth.signUp({
    email,
    password: pass,
    options: { data: { nombre } }
  });

  btn.disabled = false;
  btn.textContent = 'Crear cuenta gratuita';

  if (error) {
    errEl.textContent = tradError(error.message);
    errEl.classList.add('visible');
  } else {
    document.getElementById('formRegistro').style.display = 'none';
    document.querySelector('.auth-tabs').style.display = 'none';
    document.getElementById('authSuccess').classList.add('visible');
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
  btn.disabled = true;
  btn.textContent = 'Entrando…';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });

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
      errEl.textContent = '⛔ Cuenta suspendida por la administración.';
      errEl.classList.add('visible');
      return;
    }

    // Redirigir al returnUrl o al dashboard
    const params = new URLSearchParams(window.location.search);
    const ret = params.get('returnUrl') || 'dashboard.html';
    window.location.href = ret;
  }
}

// ---- Forgot password ----------------------------------------
async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showToast('Introduce tu email primero', 'info'); return; }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
  if (error) showToast('Error: ' + tradError(error.message), 'error');
  else showToast('✉️ Email de recuperación enviado', 'success');
}

// ---- Sign out -----------------------------------------------
async function handleSignOut() {
  await supabaseClient.auth.signOut();
  window.location.href = '/index.html';
}

// ---- Session guard: redirige si no está logueado -----------
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/pages/auth.html?returnUrl=' + encodeURIComponent(window.location.pathname);
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
    alert('Acceso Denegado: Su cuenta ha sido bloqueada.');
    window.location.href = '/index.html';
    return null;
  }

  return session;
}

// ---- Update header with user info --------------------------
async function updateHeaderAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    const nombre = session.user.user_metadata?.full_name || session.user.user_metadata?.nombre || session.user.email.split('@')[0];
    
    // Fetch profile data for role and avatar
    const { data: perfil } = await supabaseClient.from('perfiles').select('rol, avatar_url').eq('user_id', session.user.id).single();

    // Rellenar nombre de usuario (en dashboard.html, perfil.html e index.html si está)
    const nameEls = document.querySelectorAll('#headerUserName');
    nameEls.forEach(el => {
      if (perfil && perfil.avatar_url) {
        el.innerHTML = `<img src="${perfil.avatar_url}" class="header-avatar-img" title="Tu perfil" style="margin-right:4px;"> ${nombre}`;
      } else {
        el.textContent = nombre;
      }
      el.style.display = '';
    });

    // En index.html (y otros sitos) habilitar botones y ocultar login
    const btnLogin = document.getElementById('btnLogin');
    const btnRegister = document.getElementById('btnRegister');
    const btnDashboard = document.getElementById('btnDashboard');
    const btnPerfil = document.getElementById('btnPerfil');
    const btnLogout = document.getElementById('btnLogout');
    
    const mobileLogin = document.getElementById('mobileLogin');
    const mobileRegister = document.getElementById('mobileRegister');
    const mobileDashboard = document.getElementById('mobileDashboard');

    if (btnLogin) btnLogin.style.display = 'none';
    if (btnRegister) btnRegister.style.display = 'none';
    if (btnDashboard) btnDashboard.style.display = 'inline-block';
    if (btnPerfil) btnPerfil.style.display = 'inline-block';
    if (btnLogout) btnLogout.style.display = 'inline-block';

    if (mobileLogin) mobileLogin.style.display = 'none';
    if (mobileRegister) mobileRegister.style.display = 'none';
    if (mobileDashboard) mobileDashboard.style.display = 'block';

    if (perfil && perfil.rol === 'admin') {
      const adminLink = document.getElementById('adminLink');
      const adminLinkMobile = document.getElementById('adminLinkMobile');
      if (adminLink) adminLink.style.display = 'inline-block';
      if (adminLinkMobile) adminLinkMobile.style.display = 'block';
    }
  }
}

// ---- Error translation --------------------------------------
function tradError(msg) {
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (msg.includes('Email not confirmed'))       return 'Confirma tu email antes de entrar.';
  if (msg.includes('User already registered'))   return 'Este email ya tiene cuenta. Inicia sesión.';
  if (msg.includes('Password should'))            return 'La contraseña debe tener al menos 6 caracteres.';
  return msg;
}

// ---- Theme Logic & DB Sync -----------------------------------
async function initTheme() {
  const localTheme = localStorage.getItem('theme') || 'dark';
  
  // Inyectar botón en la cabecera si existe
  const headerInner = document.querySelector('.header-inner');
  if (headerInner && !document.getElementById('themeToggle')) {
    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.marginRight = 'auto'; 
    btn.style.marginLeft = '20px';
    btn.innerHTML = localTheme === 'light' ? '🌙' : '🌞';
    btn.title = 'Cambiar tema';
    
    // Insertar antes de actions o al final
    const actions = document.getElementById('headerActions');
    if (actions) headerInner.insertBefore(btn, actions);
    else headerInner.appendChild(btn);

    // Evento click
    btn.addEventListener('click', async () => {
      const isLight = document.body.classList.toggle('light-mode');
      const newTheme = isLight ? 'light' : 'dark';
      btn.innerHTML = isLight ? '🌙' : '🌞';
      localStorage.setItem('theme', newTheme);

      // Sincronizar si está logueado
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        await supabaseClient.from('perfiles').update({ tema: newTheme }).eq('user_id', session.user.id);
      }
    });

    // Sincronizar carga inicial con BD
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      const { data: perfil } = await supabaseClient.from('perfiles').select('tema').eq('user_id', session.user.id).single();
      if (perfil && perfil.tema && perfil.tema !== localStorage.getItem('theme')) {
        localStorage.setItem('theme', perfil.tema);
        document.body.classList.toggle('light-mode', perfil.tema === 'light');
        btn.innerHTML = perfil.tema === 'light' ? '🌙' : '🌞';
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', initTheme);

// ---- Init on every page ------------------------------------
updateHeaderAuth();
