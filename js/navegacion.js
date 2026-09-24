// ============================================================
//  NAVEGACION.JS – las pantallas privadas solo se abren navegando por la web.
//
//  Si alguien escribe la dirección de una pantalla privada, la abre desde un
//  marcador o llega desde otra web, se le lleva a la portada. Se carga el
//  PRIMERO en el <head> de esas pantallas, para que no lleguen a verse.
//
//  Se deja pasar si:
//   - la página anterior es de BecaMax (enlace, recarga, atrás/adelante), o
//   - hay un "pase" de un solo uso: lo deja auth.html justo antes de ir al
//     login con Google, porque la vuelta de Google llega "de fuera".
//
//  OJO: esto ordena la navegación, NO es seguridad. Quien quiera puede saltárselo;
//  lo que protege los datos es la sesión y la RLS de Supabase, en el servidor.
//  Las páginas públicas (portada, login, legales, guías, becas, 404) no lo cargan:
//  los enlaces de los correos, los buscadores y la ley necesitan poder abrirlas.
// ============================================================
(function () {
  var PASE = 'becamax_pase_navegacion';

  var desdeLaWeb = false;
  try {
    desdeLaWeb = !!document.referrer && new URL(document.referrer).origin === window.location.origin;
  } catch (e) { /* referrer raro: se trata como acceso directo */ }

  var conPase = false;
  try {
    conPase = sessionStorage.getItem(PASE) === '1';
    sessionStorage.removeItem(PASE);
  } catch (e) { /* sin sessionStorage: solo cuenta el referrer */ }

  // Recargar o ir atrás/adelante a una pantalla en la que YA se estaba: al
  // recargar, document.referrer sigue siendo el de la llegada, y tras el login
  // con Google ese es accounts.google.com (el pase ya se gastó), así que F5 en
  // el panel echaba a la portada. Quien escribe la dirección nunca llega a
  // quedarse (se le reemplaza la entrada), así que no puede recargarla.
  var yaEstaba = false;
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    yaEstaba = !!nav && (nav.type === 'reload' || nav.type === 'back_forward');
  } catch (e) { /* navegador sin la API: solo cuentan referrer y pase */ }

  if (!desdeLaWeb && !conPase && !yaEstaba) {
    window.location.replace('/');
  }
})();

// Lo usa auth.html antes de salir hacia el login con Google.
function darPaseDeNavegacion() {
  try { sessionStorage.setItem('becamax_pase_navegacion', '1'); } catch (e) { /* ignorar */ }
}
