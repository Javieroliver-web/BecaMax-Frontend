'use strict';
// Guardas de la revisión legal del 24/09/2026 (LSSI art. 22.2 y guía de
// cookies de la AEPD). Se ejecuta con Node, sin dependencias ni package.json:
//   node --test tests/
//
// Aquel día Vercel Web Analytics se cargaba en 14 páginas y la librería de
// AdSense en 3 ANTES del consentimiento, por etiquetas <script> fijas que
// contradecían a js/cookies.js y a la propia política. Estos tests fallan si
// vuelven.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');

function htmls(dir = RAIZ) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return ['node_modules', '.git', 'tests'].includes(e.name) ? [] : htmls(ruta);
    return e.name.endsWith('.html') ? [ruta] : [];
  });
}

test('ninguna página carga analítica ni anuncios con una etiqueta fija', () => {
  const culpables = htmls().filter((f) => {
    const t = fs.readFileSync(f, 'utf8');
    return /<script[^>]*src="[^"]*_vercel\/insights\/script\.js"/.test(t)
      || /<script[^>]*src="[^"]*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/.test(t);
  }).map((f) => path.relative(RAIZ, f));
  assert.deepStrictEqual(culpables, [], 'deben cargarse desde js/cookies.js y solo con consentimiento');
});

test('las páginas con huecos de anuncios incluyen el gestor de consentimiento', () => {
  const sinGestor = htmls().filter((f) => {
    const t = fs.readFileSync(f, 'utf8');
    return t.includes('class="adsbygoogle') && !t.includes('cookies.js');
  }).map((f) => path.relative(RAIZ, f));
  assert.deepStrictEqual(sinGestor, []);
});

test('se pueden descargar los datos propios desde Configuración (arts. 15 y 20 RGPD)', () => {
  const pagina = fs.readFileSync(path.join(RAIZ, 'pages', 'configuracion.html'), 'utf8');
  assert.match(pagina, /id="btnDescargarDatos"[^>]*onclick="descargarMisDatos\(\)"/);
  const js = fs.readFileSync(path.join(RAIZ, 'js', 'configuracion.js'), 'utf8');
  assert.match(js, /\/auth\/mis-datos/);
  // La página no manda ningún identificador: el backend lo saca de la sesión.
  assert.doesNotMatch(js.slice(js.indexOf('async function descargarMisDatos')), /user_?id|usuarioId/i);
  const privacidad = fs.readFileSync(path.join(RAIZ, 'pages', 'legal', 'privacidad.html'), 'utf8');
  assert.match(privacidad, /descargar en un archivo todo lo que guardamos sobre ti/);
});

// ── js/cookies.js en un navegador mínimo de mentira ─────────────────────────

// Un consentimiento vigente: versión actual de la política y fecha de hoy.
const vigente = (prefs) => ({ ...prefs, version: '2026-09', fecha: new Date().toISOString(), id: 'id-del-navegador' });

function cargarCookies(consentimientoGuardado) {
  const almacen = new Map(consentimientoGuardado ? [['becamax_cookies_consent', JSON.stringify(consentimientoGuardado)]] : []);
  const inyectados = [];
  const enviados = [];
  const elemento = (tag) => ({
    tag, attrs: {}, style: {}, set innerHTML(v) { this._html = v; },
    setAttribute(k, v) { this.attrs[k] = v; }, appendChild() {}, addEventListener() {},
    // El banner busca sus botones dentro de sí mismo: se devuelven de mentira.
    querySelector: () => elemento('boton'), querySelectorAll: () => [], remove() {},
    classList: { add() {}, remove() {}, toggle() {} },
  });
  const documento = {
    head: { appendChild: (s) => inyectados.push(s.src) },
    body: { appendChild() {} },
    createElement: elemento,
    // Las piezas del banner existen (sus id empiezan por "cookies"); los
    // scripts de terceros, no: así cookies.js decide si inyectarlos.
    getElementById: (id) => (id.startsWith('cookies') ? elemento(id) : null),
    querySelector: (sel) => (sel === 'ins.adsbygoogle' ? {} : null),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const ventana = {
    localStorage: {
      getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
      setItem: (k, v) => almacen.set(k, String(v)),
      removeItem: (k) => almacen.delete(k),
    },
    location: { pathname: '/index.html', reload() { ventana.recargada = true; } },
    document: documento,
    setTimeout: () => 0,
    requestAnimationFrame: () => 0,
    CONFIG: { API_URL: 'https://backend.example/api' },
    crypto: { randomUUID: () => 'uuid-nuevo' },
    fetch: (url, init) => { enviados.push({ url, init }); return Promise.resolve({ ok: true }); },
  };
  ventana.window = ventana;
  const contexto = vm.createContext(ventana);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js', 'cookies.js'), 'utf8'), contexto);
  return { ventana, inyectados, almacen, enviados };
}

test('sin consentimiento no se carga nada de terceros', () => {
  const { inyectados } = cargarCookies(null);
  assert.deepStrictEqual(inyectados, []);
});

test('rechazar lo opcional no carga ni analítica ni anuncios', () => {
  const { inyectados } = cargarCookies(vigente({ necesarias: true, analisis: false, marketing: false }));
  assert.deepStrictEqual(inyectados, []);
});

test('aceptar Análisis carga solo la analítica; Marketing, solo los anuncios', () => {
  assert.deepStrictEqual(cargarCookies(vigente({ analisis: true, marketing: false })).inyectados,
    ['/_vercel/insights/script.js']);
  const conAnuncios = cargarCookies(vigente({ analisis: false, marketing: true })).inyectados;
  assert.strictEqual(conAnuncios.length, 1);
  assert.match(conAnuncios[0], /pagead2\.googlesyndication\.com/);
});

test('un consentimiento de otra versión de la política o de hace más de 24 meses no vale', () => {
  const otraVersion = { ...vigente({ analisis: true, marketing: true }), version: '2025-01' };
  assert.deepStrictEqual(cargarCookies(otraVersion).inyectados, [], 'hay que volver a preguntar');
  const viejo = vigente({ analisis: true, marketing: true });
  viejo.fecha = new Date(Date.now() - 25 * 30 * 24 * 3600 * 1000).toISOString();
  assert.deepStrictEqual(cargarCookies(viejo).inyectados, [], 'caducado: hay que volver a preguntar');
  // El formato antiguo, sin versión, tampoco: se dio con otra política.
  assert.deepStrictEqual(cargarCookies('all').inyectados, []);
  assert.deepStrictEqual(cargarCookies({ analisis: true, marketing: true }).inyectados, []);
});

test('cada elección se registra en el servidor sin IP ni usuario', () => {
  const { ventana, enviados, almacen } = cargarCookies(null);
  ventana.BecaMaxConsent.save({ analisis: true, marketing: false }, 'personalizar');
  assert.strictEqual(enviados.length, 1);
  const [{ url, init }] = enviados;
  assert.strictEqual(url, 'https://backend.example/api/consentimiento');
  assert.strictEqual(init.headers['x-becamax-client'], '1');
  assert.deepStrictEqual(JSON.parse(init.body), {
    consent_id: 'uuid-nuevo', analisis: true, marketing: false, accion: 'personalizar', version_politica: '2026-09',
  });
  const guardado = JSON.parse(almacen.get('becamax_cookies_consent'));
  assert.strictEqual(guardado.version, '2026-09');
  assert.ok(guardado.fecha);
});

test('retirar el consentimiento es un clic: vuelve a preguntar y conserva el identificador', () => {
  const { ventana, almacen } = cargarCookies(vigente({ analisis: true, marketing: true }));
  ventana.BecaMaxConsent.reabrir();
  assert.deepStrictEqual(JSON.parse(almacen.get('becamax_cookies_consent')), { id: 'id-del-navegador' });
  assert.strictEqual(ventana.recargada, true);
  // Y al volver a elegir, el registro es del mismo navegador (cambio de opinión).
  const tras = cargarCookies({ id: 'id-del-navegador' });
  assert.deepStrictEqual(tras.inyectados, [], 'sin elección vigente no se carga nada');
  tras.ventana.BecaMaxConsent.save({ analisis: false, marketing: false }, 'rechazar');
  assert.strictEqual(JSON.parse(tras.enviados[0].init.body).consent_id, 'id-del-navegador');
});
