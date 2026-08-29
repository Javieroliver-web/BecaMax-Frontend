// ============================================================
//  COOKIES.JS – Banner de cookies GDPR
// ============================================================

window.BecaMaxConsent = {
  KEY: 'becamax_cookies_consent',
  get() { return localStorage.getItem(this.KEY); },
  hasAdsConsent() { return this.get() === 'all'; },
  unlockAds() {
    if (!this.hasAdsConsent()) return;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.pauseAdRequests = 0;
    document.querySelectorAll('ins.adsbygoogle:not([data-ad-status])').forEach(() => {
      try { window.adsbygoogle.push({}); } catch (e) { /* noop */ }
    });
  }
};

(function () {
  const COOKIE_KEY = window.BecaMaxConsent.KEY;

  // Si ya aceptó, no mostrar nada
  if (localStorage.getItem(COOKIE_KEY)) {
    window.BecaMaxConsent.unlockAds();
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'cookiesBanner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Aviso de cookies');
  banner.innerHTML = `
    <div class="cookies-inner">
      <div class="cookies-text">
        <span class="cookies-icon"></span>
        <div>
          <strong>Usamos cookies</strong>
          <p>Utilizamos cookies esenciales para el funcionamiento del sitio y, si lo aceptas, cookies analíticas para mejorar la experiencia. Consulta nuestra <a href="${_cookiesUrl()}" style="color:var(--primary-light);text-decoration:underline;">política de cookies</a>.</p>
        </div>
      </div>
      <div class="cookies-actions">
        <button id="cookiesAcceptEssential" class="btn btn-secondary btn-sm">Solo esenciales</button>
        <button id="cookiesAcceptAll" class="btn btn-primary btn-sm">Aceptar todas</button>
      </div>
    </div>`;

  document.body.appendChild(banner);

  // Animación de entrada
  requestAnimationFrame(() => banner.classList.add('visible'));

  document.getElementById('cookiesAcceptAll').addEventListener('click', () => {
    localStorage.setItem(COOKIE_KEY, 'all');
    window.BecaMaxConsent.unlockAds();
    _hideBanner(banner);
  });

  document.getElementById('cookiesAcceptEssential').addEventListener('click', () => {
    localStorage.setItem(COOKIE_KEY, 'essential');
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
