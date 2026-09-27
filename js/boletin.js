// ============================================================
// BOLETIN.JS - Alta en el boletín semanal (portada)
//
// Doble confirmación: esto solo pide el correo de confirmación. El backend
// responde lo mismo exista o no la dirección, así que el mensaje es neutro.
// La versión del consentimiento tiene que coincidir con CONSENTIMIENTOS del
// backend (src/services/boletin/index.js) y con el texto de la casilla.
// ============================================================
(function () {
  var VERSION_CONSENTIMIENTO = '2026-10';
  var form = document.getElementById('boletinForm');
  if (!form) return;

  var email = document.getElementById('boletinEmail');
  var acepto = document.getElementById('boletinAcepto');
  var boton = document.getElementById('boletinEnviar');
  var mensaje = document.getElementById('boletinMensaje');
  var widgetId = null;

  function avisar(texto, esError) {
    mensaje.textContent = texto;
    mensaje.style.color = esError ? 'var(--danger, #ef4444)' : 'var(--primary)';
  }

  // hCaptcha se carga solo cuando alguien empieza a rellenar el formulario:
  // así la portada no descarga el captcha a quien no lo va a usar.
  window.onBoletinHcaptchaLoad = function () {
    if (window.hcaptcha && widgetId === null) {
      widgetId = window.hcaptcha.render('boletinCaptcha', { sitekey: CONFIG.HCAPTCHA_SITEKEY });
    }
  };
  var captchaPedido = false;
  function cargarCaptcha() {
    if (captchaPedido) return;
    captchaPedido = true;
    var s = document.createElement('script');
    s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&onload=onBoletinHcaptchaLoad&hl=es';
    s.async = true;
    document.head.appendChild(s);
  }
  email.addEventListener('focus', cargarCaptcha, { once: true });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!email.value.trim() || !email.checkValidity()) return avisar('Escribe un correo válido.', true);
    if (!acepto.checked) return avisar('Marca la casilla para aceptar recibir el boletín.', true);

    if (captchaPedido && widgetId === null) return avisar('Cargando la verificación… vuelve a pulsar en un segundo.', true);
    var captchaToken = widgetId !== null && window.hcaptcha ? window.hcaptcha.getResponse(widgetId) : '';
    if (widgetId !== null && !captchaToken) return avisar('Completa la verificación «No soy un robot».', true);

    boton.disabled = true;
    avisar('Enviando…', false);
    try {
      var res = await fetch(CONFIG.API_URL + '/boletin/alta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-BecaMax-Client': '1' },
        body: JSON.stringify({ email: email.value.trim(), version: VERSION_CONSENTIMIENTO, captchaToken: captchaToken })
      });
      var datos = await res.json().catch(function () { return {}; });
      if (res.ok) {
        form.reset();
        avisar(datos.message || 'Revisa tu correo para confirmar la suscripción.', false);
      } else if (res.status === 429) {
        avisar('Demasiados intentos. Espera unos minutos y vuelve a probar.', true);
      } else {
        avisar(datos.message || 'No se ha podido completar. Prueba otra vez más tarde.', true);
      }
    } catch (err) {
      avisar('No hay conexión con BecaMax. Prueba otra vez en un momento.', true);
    } finally {
      boton.disabled = false;
      if (widgetId !== null && window.hcaptcha) window.hcaptcha.reset(widgetId);
    }
  });
})();
