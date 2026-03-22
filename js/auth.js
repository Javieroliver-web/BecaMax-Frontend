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

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });

  btn.disabled = false;
  btn.textContent = 'Iniciar sesión';

  if (error) {
    errEl.textContent = tradError(error.message);
    errEl.classList.add('visible');
  } else {
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
  }
  return session;
}

// ---- Update header with user info --------------------------
async function updateHeaderAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const actionsEl = document.getElementById('headerActions');
  if (!actionsEl) return;

  if (session) {
    // Check if user is admin to show the button
    const { data: perfil } = await supabaseClient.from('perfiles').select('rol').eq('user_id', session.user.id).single();
    const adminLink = (perfil && perfil.rol === 'admin') 
      ? `<a href="admin-dashboard.html" class="btn btn-ghost btn-sm" title="Panel Administrador">🛡️ Admin</a>` 
      : ``;

    const nombre = session.user.user_metadata?.nombre || session.user.email.split('@')[0];
    actionsEl.innerHTML = `
      ${adminLink}
      <a href="dashboard.html" class="btn btn-secondary btn-sm">🔔 Mis alertas</a>
      <a href="perfil.html" class="btn btn-ghost btn-sm" title="Ajustes de Perfil">⚙️ Perfil</a>
      <span style="font-size:.82rem;color:var(--text-secondary)">${nombre}</span>
      <button class="btn btn-ghost btn-sm" onclick="handleSignOut()">Salir</button>
    `;
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
