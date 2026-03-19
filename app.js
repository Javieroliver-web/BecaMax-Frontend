// ============================================================
//  APP.JS – Motor de filtrado, render y lógica principal (index.html)
// ============================================================

// ---- Estado global -----------------------------------------
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
  if (u === 'cerrada')    return '⬛ Cerrada';
  if (u === 'urgente')    return `🔴 ${dias}d restantes`;
  if (u === 'proximo')    return `🟡 ${dias}d restantes`;
  return `🟢 ${dias}d restantes`;
}

function formatImporte(b) {
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
    if (importeMin !== null && b.importe.max < importeMin)  return false;
    if (importeMax !== null && b.importe.min > importeMax)  return false;

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
    if (orden === 'importe_desc') return b.importe.max - a.importe.max;
    if (orden === 'importe_asc')  return a.importe.min - b.importe.min;
    if (orden === 'nombre')       return a.nombre.localeCompare(b.nombre);
    return 0;
  });
}

// ---- Render de card ----------------------------------------
function renderCard(b, delay = 0) {
  const dias = diasRestantes(b.deadline);
  const u    = urgencia(dias);
  const pct  = u === 'cerrada' ? 100 : Math.max(0, Math.min(100, 100 - (dias / 365) * 100));

  return `
  <article class="beca-card ${u === 'cerrada' ? 'cerrada' : ''}" style="animation-delay:${delay}ms">
    <div class="card-top">
      <div class="card-badges">
        <span class="badge badge-tipo">${tipoLabel(b.tipo)}</span>
        <span class="badge badge-${u}">${urgenciaLabel(u, dias)}</span>
      </div>
    </div>
    <div class="card-body">
      <div class="card-nombre">${b.nombre}</div>
      <div class="card-entidad">${b.entidad}</div>
      <p class="card-desc">${b.descripcion}</p>
    </div>
    <div class="card-meta">
      <div class="meta-item">
        <div class="meta-label">Importe</div>
        <div class="meta-value">${formatImporte(b)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Plazo</div>
        <div class="meta-value">${formatFecha(b.deadline)}</div>
      </div>
    </div>
    <div class="countdown-bar">
      <div class="countdown-fill ${u}" style="width:${pct}%"></div>
    </div>
    <div class="card-actions">
      <a href="${b.url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Ver beca ↗</a>
      <button class="btn btn-secondary btn-sm" onclick="verRequisitos(${b.id})" title="Requisitos">📋 Requisitos</button>
    </div>
  </article>`;
}

// ---- Stats del hero ----------------------------------------
function actualizarStats(becasFiltradas) {
  const abiertas  = BECAS.filter(b => diasRestantes(b.deadline) >= 0);
  const urgentes  = BECAS.filter(b => { const d = diasRestantes(b.deadline); return d >= 0 && d <= 7; });
  const maxImp    = Math.max(...BECAS.map(b => b.importe.max));
  document.getElementById('statTotal').textContent   = abiertas.length;
  document.getElementById('statUrgente').textContent = urgentes.length;
  document.getElementById('statMaxImporte').textContent = maxImp.toLocaleString('es-ES') + ' €';
}

// ---- Render principal --------------------------------------
function renderGrid() {
  const filtradas  = aplicarFiltros(BECAS);
  const ordenadas  = ordenar(filtradas, ordenActual);
  const grid       = document.getElementById('becasGrid');
  const countEl    = document.getElementById('countText');

  countEl.textContent = ordenadas.length;

  if (ordenadas.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Sin resultados</h3>
        <p>Prueba a cambiar los filtros o amplía la búsqueda.</p>
      </div>`;
    return;
  }

  grid.innerHTML = ordenadas.map((b, i) => renderCard(b, i * 40)).join('');
}

// ---- Modal requisitos --------------------------------------
function verRequisitos(id) {
  const b = BECAS.find(x => x.id === id);
  if (!b) return;
  const lista = b.requisitos.map(r => `<li style="margin-bottom:6px">✅ ${r}</li>`).join('');
  // Reutilizamos el modal de alerta como modal de info
  const modal = document.getElementById('modalAlerta');
  modal.querySelector('.modal-title').textContent    = b.nombre;
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
  modal.querySelector('.modal-title').textContent    = '🔔 Guardar alerta';
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
    window.location.href = 'auth.html?returnUrl=' + encodeURIComponent(window.location.href);
    return;
  }

  const nombre = document.getElementById('alertaNombre').value.trim() || 'Mi alerta';
  const { error } = await supabaseClient
    .from('filtros_guardados')
    .insert([{ user_id: session.user.id, nombre, filtros: filtrosActivos, activo: true }]);

  document.getElementById('modalAlerta').classList.remove('active');

  if (error) showToast('Error al guardar la alerta', 'error');
  else       showToast('✅ Alerta guardada correctamente', 'success');
}

// ---- Event listeners ---------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  actualizarStats();
  renderGrid();

  // Búsqueda
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', () => {
    filtrosActivos.busqueda = searchInput.value.trim();
    searchClear.classList.toggle('visible', !!searchInput.value);
    renderGrid();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    filtrosActivos.busqueda = '';
    searchClear.classList.remove('visible');
    renderGrid();
  });

  // Filtros
  document.getElementById('filtroTipo').addEventListener('change',      e => { filtrosActivos.tipo       = e.target.value; renderGrid(); });
  document.getElementById('filtroRegion').addEventListener('change',    e => { filtrosActivos.region     = e.target.value; renderGrid(); });
  document.getElementById('filtroArea').addEventListener('change',      e => { filtrosActivos.area       = e.target.value; renderGrid(); });
  document.getElementById('filtroPlazo').addEventListener('change',     e => { filtrosActivos.plazo      = e.target.value; renderGrid(); });
  document.getElementById('filtroImporteMin').addEventListener('input', e => { filtrosActivos.importeMin = e.target.value ? Number(e.target.value) : null; renderGrid(); });
  document.getElementById('filtroImporteMax').addEventListener('input', e => { filtrosActivos.importeMax = e.target.value ? Number(e.target.value) : null; renderGrid(); });

  // Ordenación
  document.getElementById('sortSelect').addEventListener('change', e => { ordenActual = e.target.value; renderGrid(); });

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
    renderGrid();
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
