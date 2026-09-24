// ============================================================
//  COOKIES.JS – Banner de cookies GDPR (3 categorías)
// ============================================================

window.BecaMaxConsent = {
  KEY: 'becamax_cookies_consent',
  DEFAULTS: { necesarias: true, analisis: false, marketing: false },
  // Versión de la política de cookies (AAAA-MM). Al cambiarla, el banner
  // vuelve a salir: un consentimiento solo vale para la política que se vio.
  VERSION: '2026-09',
  // La AEPD recomienda no dar por bueno un consentimiento de más de 24 meses.
  MESES_VALIDEZ: 24,

  // El consentimiento guardado, o null si no hay, si es de otra versión de la
  // política o si ha caducado: en esos casos hay que volver a preguntar. El
  // formato antiguo (sin versión, o el string 'all'/'essential') también
  // vuelve a preguntar: se dio con una política que ya no es la vigente.
  get() {
    const raw = localStorage.getItem(this.KEY);
    if (!raw) return null;
    try {
      const guardado = JSON.parse(raw);
      if (!guardado || guardado.version !== this.VERSION || !guardado.fecha) return null;
      const caduca = new Date(guardado.fecha);
      caduca.setMonth(caduca.getMonth() + this.MESES_VALIDEZ);
      if (!(caduca > new Date())) return null;
      return { ...this.DEFAULTS, ...guardado, necesarias: true };
    } catch {
      return null;
    }
  },

  // `accion`: 'aceptar_todo', 'rechazar' o 'personalizar'. Cada elección se
  // registra en el servidor (sin IP ni usuario) para poder demostrarla: RGPD
  // art. 7.1. Ver registrar().
  save(prefs, accion = 'personalizar') {
    let id;
    try { id = JSON.parse(localStorage.getItem(this.KEY) || '{}').id; } catch { /* nuevo */ }
    const full = {
      ...this.DEFAULTS, ...prefs, necesarias: true,
      version: this.VERSION, fecha: new Date().toISOString(),
      id: id || (crypto.randomUUID ? crypto.randomUUID() : null),
    };
    localStorage.setItem(this.KEY, JSON.stringify(full));
    this.apply(full);
    this.registrar(full, accion);
    return full;
  },

  // Mejor esfuerzo: si el backend no responde, la elección vale igual en el
  // navegador. keepalive: que llegue aunque la página se recargue justo después.
  registrar(full, accion) {
    if (!full.id || typeof CONFIG === 'undefined' || !CONFIG.API_URL) return;
    try {
      fetch(CONFIG.API_URL + '/consentimiento', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', 'x-becamax-client': '1' },
        body: JSON.stringify({
          consent_id: full.id, analisis: !!full.analisis, marketing: !!full.marketing,
          accion, version_politica: full.version,
        }),
      }).catch(() => {});
    } catch { /* nunca debe romper el banner */ }
  },

  hasAdsConsent() { return this.get()?.marketing === true; },
  hasAnalyticsConsent() { return this.get()?.analisis === true; },

  apply(prefs) {
    if (prefs.marketing) this.unlockAds();
    if (prefs.analisis) this.unlockAnalytics();
  },

  unlockAds() {
    if (!this.hasAdsConsent()) return;
    // La librería de AdSense se descarga SOLO con consentimiento de
    // Marketing: con la etiqueta fija de antes, Google recibía la IP del
    // visitante al abrir la página aunque los anuncios estuvieran en pausa
    // (revisión legal del 24/09/2026). Solo en las páginas con huecos.
    if (document.querySelector('ins.adsbygoogle') && !document.getElementById('adsenseScript')) {
      const s = document.createElement('script');
      s.id = 'adsenseScript';
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6819969179751671';
      document.head.appendChild(s);
    }
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.pauseAdRequests = 0;
    document.querySelectorAll('ins.adsbygoogle:not([data-ad-status])').forEach(() => {
      try { window.adsbygoogle.push({}); } catch (e) { /* noop */ }
    });
  },

  // Vercel Web Analytics no se carga por defecto en las páginas que
  // incluyen este fichero -- se inyecta solo si hay consentimiento de
  // Análisis. OJO: el 24/09/2026 seguía la etiqueta <script> fija en 14
  // páginas, que lo cargaba siempre; se quitaron. No volver a ponerla.
  unlockAnalytics() {
    if (!this.hasAnalyticsConsent() || document.getElementById('vercelInsightsScript')) return;
    const s = document.createElement('script');
    s.id = 'vercelInsightsScript';
    s.defer = true;
    s.src = '/_vercel/insights/script.js';
    document.head.appendChild(s);
  },

  // Retirar el consentimiento tiene que ser tan fácil como darlo (AEPD, guía
  // de cookies). Borra la elección y recarga: la página vuelve sin analítica
  // ni anuncios y con el panel para elegir de nuevo. Lo usa el botón de la
  // política de cookies.
  reabrir() {
    // Se conserva solo el identificador: así, en el registro, la nueva
    // elección queda como un cambio de opinión del mismo navegador.
    let id;
    try { id = JSON.parse(localStorage.getItem(this.KEY) || '{}').id; } catch { /* sin id */ }
    if (id) localStorage.setItem(this.KEY, JSON.stringify({ id }));
    else localStorage.removeItem(this.KEY);
    window.location.reload();
  }
};

(function () {
  const stored = window.BecaMaxConsent.get();

  // Si ya hay una preferencia guardada, aplicarla y no mostrar el banner.
  if (stored) {
    window.BecaMaxConsent.apply(stored);
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'cookiesBanner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Aviso de cookies');
  banner.innerHTML = `
    <div class="cookies-inner">
      <div class="cookies-text">
        <span class="cookies-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 9.54 13.15c-.42.16-.88.25-1.35.25a4 4 0 0 1-4-4c0-.3.03-.6.1-.88A3.5 3.5 0 0 1 13 6.5c0-.6-.15-1.16-.4-1.66A9.96 9.96 0 0 0 12 2z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="16" cy="9" r="1"/><circle cx="9" cy="14" r=".5"/></svg></span>
        <div>
          <strong>Usamos cookies</strong>
          <p>Usamos almacenamiento necesario para el funcionamiento del sitio y, si lo permites, análisis de uso y personalización de anuncios. Elige qué permitir o consulta nuestra <a href="${_cookiesUrl()}" style="color:var(--primary-light);text-decoration:underline;">política de cookies</a>.</p>
        </div>
      </div>
      <div class="cookies-actions">
        <button type="button" id="cookiesCustomize" class="btn btn-ghost btn-sm">Personalizar</button>
        <button type="button" id="cookiesAcceptEssential" class="btn btn-secondary btn-sm">Rechazar opcionales</button>
        <button type="button" id="cookiesAcceptAll" class="btn btn-primary btn-sm">Aceptar todas</button>
      </div>
    </div>
    <div class="cookies-panel" id="cookiesPanel" hidden>
      <div class="cookies-category">
        <div class="cookies-category-info">
          <strong>Necesarias</strong>
          <p>Para la seguridad y la funcionalidad básica del sitio.</p>
        </div>
        <span class="cookies-required-badge">Requerida</span>
      </div>
      <div class="cookies-category">
        <div class="cookies-category-info">
          <strong>Análisis</strong>
          <p>Permite el seguimiento del rendimiento del sitio.</p>
        </div>
        <label class="toggle" title="Análisis">
          <input type="checkbox" id="cookiesToggleAnalisis">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="cookies-category">
        <div class="cookies-category-info">
          <strong>Marketing</strong>
          <p>Permite la personalización y el seguimiento de anuncios.</p>
        </div>
        <label class="toggle" title="Marketing">
          <input type="checkbox" id="cookiesToggleMarketing">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <button type="button" id="cookiesSavePrefs" class="btn btn-primary btn-full btn-sm">Guardar preferencias</button>
    </div>`;

  document.body.appendChild(banner);

  requestAnimationFrame(() => banner.classList.add('visible'));

  document.getElementById('cookiesAcceptAll').addEventListener('click', () => {
    window.BecaMaxConsent.save({ analisis: true, marketing: true }, 'aceptar_todo');
    _hideBanner(banner);
  });

  document.getElementById('cookiesAcceptEssential').addEventListener('click', () => {
    window.BecaMaxConsent.save({ analisis: false, marketing: false }, 'rechazar');
    _hideBanner(banner);
  });

  document.getElementById('cookiesCustomize').addEventListener('click', () => {
    document.getElementById('cookiesPanel').hidden = false;
  });

  document.getElementById('cookiesSavePrefs').addEventListener('click', () => {
    window.BecaMaxConsent.save({
      analisis: document.getElementById('cookiesToggleAnalisis').checked,
      marketing: document.getElementById('cookiesToggleMarketing').checked
    }, 'personalizar');
    _hideBanner(banner);
  });

  function _hideBanner(el) {
    el.classList.remove('visible');
    el.classList.add('hiding');
    setTimeout(() => el.remove(), 400);
  }

  function _cookiesUrl() {
    const isPages = window.location.pathname.includes('/pages/');
    return isPages ? 'legal/cookies.html' : 'pages/legal/cookies.html';
  }
})();
