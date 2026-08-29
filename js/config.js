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
  }
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
