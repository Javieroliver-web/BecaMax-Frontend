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

function cargarCookies(consentimientoGuardado) {
  const almacen = new Map(consentimientoGuardado ? [['becamax_cookies_consent', JSON.stringify(consentimientoGuardado)]] : []);
  const inyectados = [];
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
  };
  ventana.window = ventana;
  const contexto = vm.createContext(ventana);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js', 'cookies.js'), 'utf8'), contexto);
  return { ventana, inyectados, almacen };
}

test('sin consentimiento no se carga nada de terceros', () => {
  const { inyectados } = cargarCookies(null);
  assert.deepStrictEqual(inyectados, []);
});

test('rechazar lo opcional no carga ni analítica ni anuncios', () => {
  const { inyectados } = cargarCookies({ necesarias: true, analisis: false, marketing: false });
  assert.deepStrictEqual(inyectados, []);
});

test('aceptar Análisis carga solo la analítica; Marketing, solo los anuncios', () => {
  assert.deepStrictEqual(cargarCookies({ analisis: true, marketing: false }).inyectados,
    ['/_vercel/insights/script.js']);
  const conAnuncios = cargarCookies({ analisis: false, marketing: true }).inyectados;
  assert.strictEqual(conAnuncios.length, 1);
  assert.match(conAnuncios[0], /pagead2\.googlesyndication\.com/);
});

test('retirar el consentimiento es un clic: borra la elección y recarga', () => {
  const { ventana, almacen } = cargarCookies({ analisis: true, marketing: true });
  ventana.BecaMaxConsent.reabrir();
  assert.strictEqual(almacen.has('becamax_cookies_consent'), false);
  assert.strictEqual(ventana.recargada, true);
});
