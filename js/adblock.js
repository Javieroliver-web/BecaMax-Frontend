/**
 * BecaMax — Detector de AdBlock
 * Técnica: elemento "cebo" con nombres de clase típicos de anuncios.
 * Los adblockers lo ocultan; si detectamos que tiene altura 0, mostramos el aviso.
 */
(function () {
  'use strict';

  // --- Crear elemento cebo ---
  var bait = document.createElement('div');
  bait.setAttribute('class', 'ad-banner ads advertisement pub_300x250 adsbox doubleclick ad-placeholder');
  bait.setAttribute('id', 'adblock-bait');
  bait.style.cssText = [
    'width:1px',
    'height:1px',
    'position:absolute',
    'top:-999px',
    'left:-999px',
    'opacity:0',
    'pointer-events:none',
  ].join(';');
  document.body ? document.body.appendChild(bait) : document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(bait); });

  // --- Comprobar tras un pequeño delay (los adblockers necesitan un tick) ---
  function checkAdBlock() {
    var detected = false;

    if (!bait || !document.body.contains(bait)) {
      detected = true; // el nodo fue eliminado por el bloqueador
    } else {
      var style = window.getComputedStyle(bait);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        bait.offsetHeight === 0 ||
        bait.offsetWidth === 0
      ) {
        detected = true;
      }
    }

    if (detected) {
      showAdBlockWarning();
    }

    // Limpiar el cebo
    if (bait && bait.parentNode) bait.parentNode.removeChild(bait);
  }

  // --- Mostrar overlay de aviso ---
  function showAdBlockWarning() {
    // Evitar duplicados
    if (document.getElementById('adblock-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'adblock-overlay';
    overlay.innerHTML = [
      '<div class="adblock-modal">',
      '  <div class="adblock-icon">🛡️</div>',
      '  <h2 class="adblock-title">Hemos detectado un bloqueador de anuncios</h2>',
      '  <p class="adblock-text">',
      '    BecaMax es un proyecto gratuito. Los anuncios son la única forma de mantener el servicio',
      '    activo. Por favor, desactiva tu adblocker para esta página y recarga.',
      '  </p>',
      '  <div class="adblock-steps">',
      '    <div class="adblock-step"><span class="adblock-step-num">1</span> Haz clic en el icono de tu adblocker (ej. uBlock, AdBlock Plus)</div>',
      '    <div class="adblock-step"><span class="adblock-step-num">2</span> Selecciona "Desactivar en este sitio" o "Pausar"</div>',
      '    <div class="adblock-step"><span class="adblock-step-num">3</span> Recarga la página</div>',
      '  </div>',
      '  <button class="adblock-btn" onclick="window.location.reload()">✅ Ya lo desactivé — Recargar</button>',
      '</div>',
    ].join('');

    document.body.appendChild(overlay);

    // Bloquear cierre con Escape y scroll del fondo
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') e.preventDefault();
    }, true);
  }

  // Esperar 300 ms para que los bloqueadores hayan actuado
  setTimeout(checkAdBlock, 300);
})();
