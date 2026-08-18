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
