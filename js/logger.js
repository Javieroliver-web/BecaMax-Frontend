/**
 * BecaMax — Logger de accesos · Sylphiette (Seguro)
 * Envía información del visitante a nuestro backend para que este lo mande a Discord,
 * manteniendo la URL del webhook de Discord oculta y segura.
 */
(function () {
  'use strict';

  // Determinar la URL del backend según el entorno
  var API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'https://beca-max-backend.vercel.app/api';

  // No enviar en localhost/desarrollo (opcional, en desarrollo podría ser útil comentar esto para probar)
  var host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '') return;

  var page     = window.location.pathname || '/';
  var lang     = navigator.language || 'N/A';
  var screen_  = window.screen.width + 'x' + window.screen.height;
  var ua       = navigator.userAgent;
  var referrer = document.referrer || '—';
  var ts       = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', hour12: false });

  // Detectar tipo de dispositivo
  var device = /Mobi|Android/i.test(ua) ? '📱 Móvil' : '🖥️ Escritorio';

  // Obtener IP y país (api gratuita, sin clave)
  fetch('https://ipapi.co/json/')
    .then(function (r) { return r.json(); })
    .then(function (geo) {
      sendLog(geo.ip || '—', geo.country_name || '—', geo.city || '—');
    })
    .catch(function () {
      sendLog('—', '—', '—');
    });

  function sendLog(ip, country, city) {
    var payload = {
      page: page,
      ts: ts,
      country: country,
      city: city,
      ip: ip,
      device: device,
      lang: lang,
      screen: screen_,
      referrer: referrer
    };

    fetch(API_URL + '/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(function () { /* silencioso */ });
  }
})();
