// ============================================================
// CONFIG.JS - Configuración global de la aplicación
// ============================================================

const CONFIG = {
  // Determinar si estamos en desarrollo local o en producción
  IS_LOCAL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  
  // URL base del backend
  get API_URL() {
    return this.IS_LOCAL ? 'http://localhost:3000/api' : 'https://beca-max-backend.vercel.app/api';
  },

  get BASE_URL() {
    return this.IS_LOCAL ? 'http://localhost:3000' : 'https://beca-max-backend.vercel.app';
  },

  // Sitekey pública de hCaptcha (sustituye a Cloudflare Turnstile). No es
  // secreta -- se sirve tal cual en el HTML -- pero hay que registrar aquí
  // la real desde el dashboard de hCaptcha antes de desplegar.
  HCAPTCHA_SITEKEY: 'PENDIENTE-sustituir-por-la-sitekey-real-de-hcaptcha'
};

// Escapa texto antes de insertarlo via innerHTML (evita XSS almacenado
// desde campos rellenables por usuarios o terceros no autenticados).
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Valida que una URL use http(s) antes de usarla como href (evita
// esquemas como javascript:, que sobreviven al escapado de entidades HTML).
// Útil para becas de fuentes externas (BDNS) cuyo campo `url` no controlamos.
function safeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return escapeHtml(url);
  } catch (e) { /* URL inválida */ }
  return '#';
}

// Botón "mostrar/ocultar contraseña" (usado en login, registro y
// configuración). Antes dejaba el botón vacío (sin icono visible); ahora
// usa iconos SVG de ojo/ojo-tachado en vez del emoji que se purgó del proyecto.
const ICON_EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function togglePass(id, btn) {
  const inp = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show ? ICON_EYE_OFF : ICON_EYE;
  btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
}
