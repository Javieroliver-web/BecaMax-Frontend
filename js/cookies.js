// ============================================================
//  COOKIES.JS – Banner de cookies GDPR (3 categorías)
// ============================================================

window.BecaMaxConsent = {
  KEY: 'becamax_cookies_consent',
  DEFAULTS: { necesarias: true, analisis: false, marketing: false },

  // Lee el consentimiento guardado. Migra en el momento el formato antiguo
  // (string simple 'essential'/'all', de antes de las 3 categorías) al
  // objeto nuevo, y lo vuelve a guardar ya migrado para no tener que
  // repetir esta conversión en cada lectura futura.
  get() {
    const raw = localStorage.getItem(this.KEY);
    if (!raw) return null;
    if (raw === 'all' || raw === 'essential') {
      const migrado = raw === 'all'
        ? { necesarias: true, analisis: true, marketing: true }
        : { necesarias: true, analisis: false, marketing: false };
      localStorage.setItem(this.KEY, JSON.stringify(migrado));
      return migrado;
    }
    try {
      return { ...this.DEFAULTS, ...JSON.parse(raw), necesarias: true };
    } catch {
      return null;
    }
  },

  save(prefs) {
    const full = { ...this.DEFAULTS, ...prefs, necesarias: true };
    localStorage.setItem(this.KEY, JSON.stringify(full));
    this.apply(full);
    return full;
  },

  hasAdsConsent() { return this.get()?.marketing === true; },
  hasAnalyticsConsent() { return this.get()?.analisis === true; },

  apply(prefs) {
    if (prefs.marketing) this.unlockAds();
    if (prefs.analisis) this.unlockAnalytics();
  },

  unlockAds() {
    if (!this.hasAdsConsent()) return;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.pauseAdRequests = 0;
    document.querySelectorAll('ins.adsbygoogle:not([data-ad-status])').forEach(() => {
      try { window.adsbygoogle.push({}); } catch (e) { /* noop */ }
    });
  },

  // Vercel Web Analytics no se carga por defecto en las páginas que
  // incluyen este fichero -- se inyecta solo si hay consentimiento de
  // Análisis, en vez de la etiqueta <script> estática de antes.
  unlockAnalytics() {
    if (!this.hasAnalyticsConsent() || document.getElementById('vercelInsightsScript')) return;
    const s = document.createElement('script');
    s.id = 'vercelInsightsScript';
    s.defer = true;
    s.src = '/_vercel/insights/script.js';
    document.head.appendChild(s);
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
    window.BecaMaxConsent.save({ analisis: true, marketing: true });
    _hideBanner(banner);
  });

  document.getElementById('cookiesAcceptEssential').addEventListener('click', () => {
    window.BecaMaxConsent.save({ analisis: false, marketing: false });
    _hideBanner(banner);
  });

  document.getElementById('cookiesCustomize').addEventListener('click', () => {
    document.getElementById('cookiesPanel').hidden = false;
  });

  document.getElementById('cookiesSavePrefs').addEventListener('click', () => {
    window.BecaMaxConsent.save({
      analisis: document.getElementById('cookiesToggleAnalisis').checked,
      marketing: document.getElementById('cookiesToggleMarketing').checked
    });
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
