// Aviso de errores de JavaScript a Discord, a través del receptor /api/error del
// portfolio (Vercel), que guarda la URL del webhook. Mismo script que el portfolio.
// Script clásico y sin dependencias, cargado en el <head> antes que el resto,
// para capturar también los errores al arrancar los módulos.
(function () {
    var ENDPOINT = 'https://portfolio-javieroliver-web.vercel.app/api/error';
    var SITE = 'becamax';
    var MAX_REPORTS = 5;

    var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (local || !navigator.sendBeacon) return;

    var sent = 0;
    var seen = {};

    function report(data) {
        // Errores sin información útil ("Script error." de otro origen) o
        // provocados por extensiones del navegador del visitante, no por la web.
        if (!data.message || data.message === 'Script error.') return;
        if (/^(chrome|moz|safari)-extension:/.test(data.source || '') || /extension:\/\//.test(data.stack || '')) return;

        var key = data.message + '|' + data.source + ':' + data.line;
        if (seen[key] || sent >= MAX_REPORTS) return;
        seen[key] = true;
        sent++;

        data.site = SITE;
        data.page = location.href;
        try {
            navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(data)], { type: 'text/plain' }));
        } catch (e) { /* nunca romper la web por avisar de un error */ }
    }

    window.addEventListener('error', function (e) {
        report({
            type: 'error',
            message: String(e.message || ''),
            source: e.filename,
            line: e.lineno,
            col: e.colno,
            stack: e.error && e.error.stack ? String(e.error.stack) : ''
        });
    });

    window.addEventListener('unhandledrejection', function (e) {
        var r = e.reason;
        report({
            type: 'promesa',
            message: String((r && r.message) || r || ''),
            stack: r && r.stack ? String(r.stack) : ''
        });
    });
})();
