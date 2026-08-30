// ============================================================
//  APP.JS – Motor de filtrado, render y lógica principal (index.html)
// ============================================================

// ---- Estado global -----------------------------------------
let BECAS = []; // Se cargará desde el backend
let filtrosActivos = {
  busqueda: '',
  tipo: '',
  region: '',
  area: '',
  importeMin: null,
  importeMax: null,
  plazo: '',
};
let ordenActual = 'deadline';

let currentPage = 1;
const PAGE_SIZE = 12;

// Utilidad de seguridad para evitar XSS
function sanitizeHTML(str) {
  if (typeof str !== 'string') return str;
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

// Utilidad de rendimiento (Debounce)
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// URL del backend obtenida de config.js
const API_URL = CONFIG.API_URL;

async function cargarBecas() {
  const grid = document.getElementById('becasGrid');
  if (grid) {
    // Render skeletons
    grid.innerHTML = Array(6).fill('').map(() => `
      <article class="skeleton-card">
        <div style="display:flex;justify-content:space-between">
          <div style="display:flex;gap:8px"><div class="skeleton-badge"></div><div class="skeleton-badge"></div></div>
          <div class="skeleton-badge" style="width:32px;height:32px;border-radius:8px"></div>
        </div>
        <div class="skeleton-line long tall" style="margin-top:8px"></div>
        <div class="skeleton-line short"></div>
        <div style="margin-top:12px"><div class="skeleton-line full"></div><div class="skeleton-line medium" style="margin-top:4px"></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px">
          <div><div class="skeleton-line xs" style="margin-bottom:6px"></div><div class="skeleton-line medium tall"></div></div>
          <div><div class="skeleton-line xs" style="margin-bottom:6px"></div><div class="skeleton-line medium tall"></div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px"><div class="skeleton-btn" style="flex:1"></div><div class="skeleton-btn" style="flex:1"></div></div>
      </article>
    `).join('');
  }

  try {
    // Construir query params con los filtros activos para que el backend filtre en servidor
    const params = new URLSearchParams();
    if (filtrosActivos.busqueda)   params.set('busqueda',   filtrosActivos.busqueda);
    if (filtrosActivos.tipo)       params.set('tipo',       filtrosActivos.tipo);
    if (filtrosActivos.region)     params.set('region',     filtrosActivos.region);
    if (filtrosActivos.area)       params.set('area',       filtrosActivos.area);
    if (filtrosActivos.plazo)      params.set('plazo',      filtrosActivos.plazo);
    if (filtrosActivos.importeMin !== null) params.set('importeMin', filtrosActivos.importeMin);
    if (filtrosActivos.importeMax !== null) params.set('importeMax', filtrosActivos.importeMax);
    params.set('orden', ordenActual);
    params.set('limit', '100');

    const response = await fetch(`${API_URL}/becas?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    BECAS = result.data || [];

    // Indicar en consola si estamos usando datos estáticos o Supabase
    if (result.meta?.fuente === 'estatico') {
      console.info('[BecaMax] Cargando becas desde datos estáticos (fallback).');
    } else {
      console.info(`[BecaMax] ${result.meta?.total ?? BECAS.length} becas cargadas desde Supabase.`);
    }

    actualizarStats();
    renderGrid();
  } catch (error) {
    console.warn('[BecaMax] No se pudo conectar con el backend, usando datos locales:', error.message);
    // Fallback: usar el array estático incluido en la página si el backend no responde
    if (typeof BECAS_ESTATICAS !== 'undefined') {
      BECAS = BECAS_ESTATICAS;
      actualizarStats();
      renderGrid();
    }
  }
}


async function fetchNews() {
  try {
    const panel = document.getElementById('newsPanel');
    if (!panel) return;

    // Consultamos la noticia activa (expiración nula o futura)
    const { data: news, error } = await supabaseClient
      .from('noticias')
      .select('*')
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!news) {
      panel.style.display = 'none';
      return;
    }

    const dateStr = new Date(news.created_at).toLocaleDateString();
    panel.innerHTML = `
      <div class="news-panel-header">
        <span> mensaje del admin</span>
      </div>
      <div class="news-panel-content">${sanitizeHTML(news.content)}</div>
      <span class="news-panel-date">Publicado el ${sanitizeHTML(dateStr)}</span>
    `;
    panel.style.display = 'block';

  } catch (err) {
    console.error('Error al cargar noticias:', err);
  }
}

// Eliminado esperarBackend() porque la pantalla de carga se quitó

// ---- Utilidades de fecha -----------------------------------
function diasRestantes(deadline) {
  const hoy  = new Date(); hoy.setHours(0,0,0,0);
  const fin  = new Date(deadline);
  return Math.ceil((fin - hoy) / 86400000);
}

function formatFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
}

function urgencia(dias) {
  if (dias < 0)  return 'cerrada';
  if (dias <= 7)  return 'urgente';
  if (dias <= 30) return 'proximo';
  return 'disponible';
}

function urgenciaLabel(u, dias) {
  if (u === 'cerrada') return 'Cerrada';
  return `${dias}d restantes`;
}

function formatImporte(b) {
  if (!b.importe) return 'Consultar';
  if (b.importe.min === b.importe.max) return `${b.importe.min.toLocaleString('es-ES')} €`;
  return `${b.importe.min.toLocaleString('es-ES')} – ${b.importe.max.toLocaleString('es-ES')} €`;
}

function tipoLabel(t) {
  const map = {
    universitaria:'Universitaria', bachillerato:'Bachillerato',
    fp:'FP', master:'Máster', idiomas:'Idiomas',
    investigacion:'Investigación', movilidad:'Movilidad', artistica:'Artística',
    formacion:'Formación', primaria:'Primaria/ESO'
  };
  return map[t] || t;
}

// ---- Filtrado ----------------------------------------------
function aplicarFiltros(becas) {
  const { busqueda, tipo, region, area, importeMin, importeMax, plazo } = filtrosActivos;
  return becas.filter(b => {
    const dias = diasRestantes(b.deadline);
    const u = urgencia(dias);

    if (tipo   && b.tipo !== tipo)   return false;
    if (region && b.region !== region && b.region !== 'Nacional') return false;
    if (area   && b.area !== area && b.area !== 'Cualquier área') return false;
    if (importeMin !== null && b.importe && b.importe.max < importeMin)  return false;
    if (importeMax !== null && b.importe && b.importe.min > importeMax)  return false;

    if (plazo === 'urgente')    return u === 'urgente';
    if (plazo === 'proximo')    return u === 'proximo';
    if (plazo === 'disponible') return u === 'disponible';
    if (plazo === 'abiertas')   return u !== 'cerrada';

    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        b.nombre.toLowerCase().includes(q)   ||
        b.entidad.toLowerCase().includes(q)  ||
        b.etiquetas.some(e => e.toLowerCase().includes(q))
      );
    }
    return true;
  });
}

// ---- Ordenación --------------------------------------------
function ordenar(becas, orden) {
  return [...becas].sort((a, b) => {
    if (orden === 'deadline') {
      return new Date(a.deadline) - new Date(b.deadline);
    }
    if (orden === 'importe_desc') return (b.importe?.max ?? 0) - (a.importe?.max ?? 0);
    if (orden === 'importe_asc')  return (a.importe?.min ?? 0) - (b.importe?.min ?? 0);
    if (orden === 'nombre')       return a.nombre.localeCompare(b.nombre);
    return 0;
  });
}

// ---- Render de card ----------------------------------------
function renderCard(b, delay = 0) {
  const dias = diasRestantes(b.deadline);
  const u    = urgencia(dias);
  const pct  = u === 'cerrada' ? 100 : Math.max(0, Math.min(100, 100 - (dias / 365) * 100));
  const yaFavorita = typeof isFavorite === 'function' && isFavorite(b.id);
  const favLabel = yaFavorita ? 'Quitar de favoritos' : 'Añadir a favoritos';

  return `
  <article class="beca-card ${u === 'cerrada' ? 'cerrada' : ''}" style="animation-delay:${delay}ms" tabindex="0">
    <div class="card-top">
      <div class="card-badges">
        <span class="badge badge-tipo">${sanitizeHTML(tipoLabel(b.tipo))}</span>
        <span class="badge badge-${u}">${sanitizeHTML(urgenciaLabel(u, dias))}</span>
      </div>
      <button class="btn-fav ${yaFavorita ? 'active' : ''}" onclick="typeof toggleFavorite === 'function' ? toggleFavorite('${sanitizeHTML(b.id)}', this) : null" aria-label="${favLabel}" title="${favLabel}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>
    </div>
    <div class="card-body">
      <div class="card-nombre font-heading">${sanitizeHTML(b.nombre)}</div>
      <div class="card-entidad">${sanitizeHTML(b.entidad)}</div>
      <p class="card-desc">${sanitizeHTML(b.descripcion)}</p>
    </div>
    <div class="card-meta">
      <div class="meta-item">
        <div class="meta-label">Importe</div>
        <div class="meta-value">${sanitizeHTML(formatImporte(b))}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Plazo</div>
        <div class="meta-value">${sanitizeHTML(formatFecha(b.deadline))}</div>
      </div>
    </div>
    <div class="countdown-bar" aria-hidden="true">
      <div class="countdown-fill ${u}" style="width:${pct}%"></div>
    </div>
    <div class="card-actions">
      <a href="pages/beca-detalle.html?id=${sanitizeHTML(b.id)}" class="btn btn-secondary btn-sm" aria-label="Ver detalles de ${sanitizeHTML(b.nombre)}">Detalles</a>
      <a href="${safeUrl(b.url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" aria-label="Ir a web oficial de ${sanitizeHTML(b.nombre)}">Ver beca</a>
    </div>
  </article>`;
}

// ---- Stats del hero ----------------------------------------
function actualizarStats(becasFiltradas) {
  const abiertas = BECAS.filter(b => diasRestantes(b.deadline) >= 0);
  const maxImp   = Math.max(0, ...BECAS.map(b => b.importe?.max ?? 0));
  document.getElementById('statTotal').textContent = abiertas.length;
  const finEl = document.getElementById('statFinanciacion');
  if (finEl) finEl.textContent = maxImp > 0 ? maxImp.toLocaleString('es-ES') + ' €' : '—';
}

// ---- Render principal --------------------------------------
function renderGrid(append = false) {
  const filtradas  = aplicarFiltros(BECAS);
  const ordenadas  = ordenar(filtradas, ordenActual);
  const grid       = document.getElementById('becasGrid');
  const countEl    = document.getElementById('countText');

  countEl.textContent = ordenadas.length;

  if (ordenadas.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
        <h3>Sin resultados</h3>
        <p>Prueba a cambiar los filtros o amplía la búsqueda.</p>
      </div>`;
    return;
  }

  if (append) {
    const newItems = ordenadas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const newHtml = newItems.map((b, i) => renderCard(b, i * 40)).join('');
    grid.insertAdjacentHTML('beforeend', newHtml);
  } else {
    const paginated = ordenadas.slice(0, currentPage * PAGE_SIZE);
    const html = paginated.map((b, i) => renderCard(b, (i % PAGE_SIZE) * 40)).join('');
    grid.innerHTML = html;
  }

  // Comprobar si hay más becas por cargar
  let loadMoreBtn = document.getElementById('loadMoreBtn');
  
  if (ordenadas.length > currentPage * PAGE_SIZE) {
    if (!loadMoreBtn) {
      loadMoreBtn = document.createElement('div');
      loadMoreBtn.id = 'loadMoreBtn';
      loadMoreBtn.style.gridColumn = '1 / -1';
      loadMoreBtn.style.textAlign = 'center';
      loadMoreBtn.style.marginTop = '20px';
      loadMoreBtn.innerHTML = `<button class="btn btn-secondary">Cargar más resultados ⬇</button>`;
      loadMoreBtn.onclick = () => {
        currentPage++;
        renderGrid(true);
      };
      grid.parentNode.insertBefore(loadMoreBtn, grid.nextSibling); // Insertar justo después del grid
    }
    loadMoreBtn.style.display = 'block';
  } else {
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  }
}

// ---- Modal requisitos --------------------------------------
function verRequisitos(id) {
  const b = BECAS.find(x => x.id === id);
  if (!b) return;
  const lista = b.requisitos.map(r => `<li style="margin-bottom:6px">${sanitizeHTML(r)}</li>`).join('');
  // Reutilizamos el modal de alerta como modal de info
  const modal = document.getElementById('modalAlerta');
  modal.querySelector('.modal-title').textContent    = sanitizeHTML(b.nombre);
  modal.querySelector('.modal-subtitle').textContent = 'Requisitos principales:';
  document.getElementById('alertaFiltrosResumen').innerHTML = `<ul style="list-style:none;padding:0">${lista}</ul>`;
  document.getElementById('alertaNombre').parentElement.style.display = 'none';
  document.getElementById('btnConfirmarAlerta').style.display = 'none';
  document.getElementById('btnCerrarModal').textContent = 'Cerrar';
  modal.classList.add('active');
}

// ---- Modal guardar alerta ----------------------------------
function abrirModalAlerta() {
  const { tipo, region, area, importeMin, importeMax, plazo, busqueda } = filtrosActivos;
  const partes = [];
  if (tipo)       partes.push('Tipo: ' + tipoLabel(tipo));
  if (region)     partes.push('Ámbito: ' + region);
  if (area)       partes.push('Área: ' + area);
  if (importeMin) partes.push('Importe mín: ' + importeMin + ' €');
  if (importeMax) partes.push('Importe máx: ' + importeMax + ' €');
  if (plazo)      partes.push('Plazo: ' + plazo);
  if (busqueda)   partes.push('Búsqueda: "' + busqueda + '"');

  const modal = document.getElementById('modalAlerta');
  modal.querySelector('.modal-title').textContent    = 'Guardar alerta';
  modal.querySelector('.modal-subtitle').textContent = 'Te avisaremos por email cuando haya becas nuevas que encajen con estos filtros.';
  document.getElementById('alertaFiltrosResumen').innerHTML =
    partes.length ? partes.join(' · ') : 'Sin filtros (todas las becas)';
  document.getElementById('alertaNombre').parentElement.style.display = '';
  document.getElementById('alertaNombre').value = '';
  document.getElementById('btnConfirmarAlerta').style.display = '';
  document.getElementById('btnCerrarModal').textContent = 'Cancelar';
  modal.classList.add('active');
}

async function confirmarAlerta() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/pages/auth.html?returnUrl=' + encodeURIComponent(window.location.href);
    return;
  }

  const nombre = document.getElementById('alertaNombre').value.trim() || 'Mi alerta';
  const { error } = await supabaseClient
    .from('filtros_guardados')
    .insert([{ user_id: session.user.id, nombre, filtros: filtrosActivos, activo: true }]);

  document.getElementById('modalAlerta').classList.remove('active');

  if (error) showToast('Error al guardar la alerta', 'error');
  else       showToast('Alerta guardada correctamente', 'success');
}

// ---- Event listeners ---------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  cargarBecas();
  fetchNews();

  // Búsqueda con debounce — llama a la API con el término de búsqueda
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const debouncedCargar = debounce(cargarBecas, 350);

  searchInput.addEventListener('input', () => {
    filtrosActivos.busqueda = searchInput.value.trim();
    searchClear.classList.toggle('visible', !!searchInput.value);
    currentPage = 1;
    debouncedCargar();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    filtrosActivos.busqueda = '';
    searchClear.classList.remove('visible');
    cargarBecas();
  });

  // Filtros — cada cambio recarga desde el backend con el nuevo filtro
  document.getElementById('filtroTipo').addEventListener('change',      e => { filtrosActivos.tipo       = e.target.value; currentPage = 1; cargarBecas(); });
  document.getElementById('filtroRegion').addEventListener('change',    e => { filtrosActivos.region     = e.target.value; currentPage = 1; cargarBecas(); });
  document.getElementById('filtroArea').addEventListener('change',      e => { filtrosActivos.area       = e.target.value; currentPage = 1; cargarBecas(); });
  document.getElementById('filtroPlazo').addEventListener('change',     e => { filtrosActivos.plazo      = e.target.value; currentPage = 1; cargarBecas(); });
  document.getElementById('filtroImporteMin').addEventListener('input', e => { filtrosActivos.importeMin = e.target.value ? Number(e.target.value) : null; currentPage = 1; debouncedCargar(); });
  document.getElementById('filtroImporteMax').addEventListener('input', e => { filtrosActivos.importeMax = e.target.value ? Number(e.target.value) : null; currentPage = 1; debouncedCargar(); });

  // Ordenación — recarga con el nuevo orden
  document.getElementById('sortSelect').addEventListener('change', e => { ordenActual = e.target.value; currentPage = 1; cargarBecas(); });

  // Reset filtros
  document.getElementById('btnResetFiltros').addEventListener('click', () => {
    filtrosActivos = { busqueda:'', tipo:'', region:'', area:'', importeMin:null, importeMax:null, plazo:'' };
    searchInput.value = '';
    searchClear.classList.remove('visible');
    document.getElementById('filtroTipo').value = '';
    document.getElementById('filtroRegion').value = '';
    document.getElementById('filtroArea').value = '';
    document.getElementById('filtroPlazo').value = '';
    document.getElementById('filtroImporteMin').value = '';
    document.getElementById('filtroImporteMax').value = '';
    currentPage = 1;
    cargarBecas();
  });

  // Guardar alerta
  document.getElementById('btnGuardarAlerta').addEventListener('click', abrirModalAlerta);
  document.getElementById('btnConfirmarAlerta').addEventListener('click', confirmarAlerta);
  document.getElementById('btnCerrarModal').addEventListener('click', () => {
    document.getElementById('modalAlerta').classList.remove('active');
  });
  document.getElementById('modalAlerta').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });
});

// Se ha movido el chequeo de sesión global a auth.js (updateHeaderAuth)
