'use strict';
// Las pantallas privadas solo se abren navegando por la web (decisión de
// Javier, 24/09/2026): js/navegacion.js manda a la portada a quien llega
// escribiendo la dirección, desde un marcador o desde otra web.
//   node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGES = path.join(__dirname, '..', 'pages');
const PRIVADAS = ['dashboard', 'perfil', 'configuracion', 'incidencias',
  'admin-dashboard', 'admin-incidencias', 'admin-monitorizacion'];
// Deben poder abrirse directamente: enlaces de correos (auth), buscadores
// (guías, becas, faq) y la ley (legales, siempre accesibles).
const PUBLICAS = ['auth', 'beca-detalle', 'faq', 'guias', 'guia-beca-mec', 'guia-fp-andalucia',
  'legal/aviso-legal', 'legal/cookies', 'legal/privacidad'];

const leer = (p) => fs.readFileSync(path.join(PAGES, p + '.html'), 'utf8');

test('cada pantalla privada carga la guarda ANTES que cualquier otro script', () => {
  for (const p of PRIVADAS) {
    const html = leer(p);
    const guarda = html.indexOf('<script src="/js/navegacion.js"></script>');
    assert.ok(guarda > 0, `${p}.html no carga js/navegacion.js`);
    assert.strictEqual(html.indexOf('<script'), guarda, `${p}.html tiene scripts antes de la guarda`);
  }
});

test('las páginas públicas no la cargan', () => {
  for (const p of PUBLICAS) {
    assert.ok(!/<script[^>]+navegacion\.js/.test(leer(p)), `${p}.html no debe cargar la guarda`);
  }
});

test('ninguna página HTML queda sin clasificar', () => {
  const todas = fs.readdirSync(PAGES, { recursive: true })
    .filter((f) => f.endsWith('.html')).map((f) => f.replace(/\\/g, '/').replace(/\.html$/, ''));
  const sinClasificar = todas.filter((p) => !PRIVADAS.includes(p) && !PUBLICAS.includes(p));
  assert.deepStrictEqual(sinClasificar, [], 'decide si estas pantallas son privadas o públicas');
});

function ejecutar({ referrer, pase, tipo = 'navigate' }) {
  const almacen = new Map(pase ? [['becamax_pase_navegacion', '1']] : []);
  const destino = [];
  const ctx = {
    URL,
    performance: { getEntriesByType: () => [{ type: tipo }] },
    document: { referrer },
    sessionStorage: {
      getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
      setItem: (k, v) => almacen.set(k, v),
      removeItem: (k) => almacen.delete(k),
    },
    window: { location: { origin: 'https://becamax.vercel.app', replace: (u) => destino.push(u) } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'navegacion.js'), 'utf8'), ctx);
  return { destino, paseRestante: almacen.has('becamax_pase_navegacion') };
}

test('acceso directo, desde otra web o con referrer raro → portada', () => {
  for (const referrer of ['', 'https://www.google.com/', 'no es una url']) {
    assert.deepStrictEqual(ejecutar({ referrer }).destino, ['/'], `referrer ${JSON.stringify(referrer)}`);
  }
});

test('navegando por la propia web se queda', () => {
  assert.deepStrictEqual(ejecutar({ referrer: 'https://becamax.vercel.app/pages/dashboard' }).destino, []);
});

test('el pase de la vuelta de Google vale una sola vez', () => {
  const r = ejecutar({ referrer: 'https://accounts.google.com/', pase: true });
  assert.deepStrictEqual(r.destino, []);
  assert.strictEqual(r.paseRestante, false);
});

test('recargar o volver atrás a una pantalla en la que ya se estaba no echa (F5 tras el login con Google)', () => {
  for (const tipo of ['reload', 'back_forward']) {
    assert.deepStrictEqual(ejecutar({ referrer: 'https://accounts.google.com/', tipo }).destino, [], tipo);
  }
});

test('escribir la dirección sigue echando', () => {
  const r = ejecutar({ referrer: '', tipo: 'navigate' });
  assert.deepStrictEqual(r.destino, ['/']);
});
