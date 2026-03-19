// ============================================================
//  DASHBOARD.JS – Gestión de alertas del usuario
// ============================================================

let alertaSeleccionadaId = null;

// ---- Etiquetas legibles de filtros -------------------------
function resumenFiltros(filtros) {
  const partes = [];
  if (filtros.tipo)       partes.push(filtros.tipo);
  if (filtros.region)     partes.push(filtros.region);
  if (filtros.area && filtros.area !== 'Cualquier área') partes.push(filtros.area);
  if (filtros.importeMin) partes.push('Desde ' + filtros.importeMin + ' €');
  if (filtros.importeMax) partes.push('Hasta ' + filtros.importeMax + ' €');
  if (filtros.plazo)      partes.push(filtros.plazo);
  if (filtros.busqueda)   partes.push('"' + filtros.busqueda + '"');
  return partes.length ? partes : ['Todas las becas'];
}

// ---- Contar coincidencias de un filtro ---------------------
function contarCoincidencias(filtros) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return BECAS.filter(b => {
    const dias = Math.ceil((new Date(b.deadline) - hoy) / 86400000);
    if (filtros.tipo   && b.tipo !== filtros.tipo) return false;
    if (filtros.region && b.region !== filtros.region && b.region !== 'Nacional') return false;
    if (filtros.area   && b.area !== filtros.area && b.area !== 'Cualquier área') return false;
    if (filtros.importeMin && b.importe.max < filtros.importeMin) return false;
    if (filtros.importeMax && b.importe.min > filtros.importeMax) return false;
    if (filtros.plazo === 'abiertas' && dias < 0) return false;
    return true;
  }).length;
}

// ---- Formatear fecha corta ---------------------------------
function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
}

// ---- Render de una alerta ----------------------------------
function renderAlerta(alerta) {
  const tags = resumenFiltros(alerta.filtros);
  const n    = contarCoincidencias(alerta.filtros);
  const id   = alerta.id;

  return `
  <div class="alerta-card" id="alerta-${id}">
    <div class="alerta-info">
      <div class="alerta-nombre">${alerta.nombre}</div>
      <div class="alerta-tags">
        ${tags.map(t => `<span class="alerta-tag">${t}</span>`).join('')}
      </div>
      <div class="alerta-coincidencias">🎓 ${n} beca${n !== 1 ? 's' : ''} coincide${n !== 1 ? 'n' : ''} ahora</div>
    </div>
    <div class="alerta-actions">
      <label class="toggle" title="Activar/desactivar">
        <input type="checkbox" ${alerta.activo ? 'checked' : ''} onchange="toggleAlerta('${id}', this.checked)">
        <span class="toggle-slider"></span>
      </label>
      <button class="btn btn-secondary btn-sm" onclick="editarAlerta('${id}', '${alerta.nombre.replace(/'/g,"\\'")}')">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="eliminarAlerta('${id}')">🗑️</button>
    </div>
  </div>`;
}

// ---- Render becas recomendadas (todas las alertas activas mezcladas) --
function renderBecasRecomendadas(alertas) {
  const activas = alertas.filter(a => a.activo);
  if (!activas.length) {
    document.getElementById('becasRecomendadas').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔕</div>
        <h3>Sin alertas activas</h3>
        <p>Activa al menos una alerta para ver las becas recomendadas.</p>
      </div>`;
    return;
  }

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const idsVistos = new Set();
  const recomendadas = [];

  activas.forEach(a => {
    BECAS.forEach(b => {
      if (idsVistos.has(b.id)) return;
      const dias = Math.ceil((new Date(b.deadline) - hoy) / 86400000);
      if (dias < 0) return;
      const f = a.filtros;
      if (f.tipo   && b.tipo !== f.tipo) return;
      if (f.region && b.region !== f.region && b.region !== 'Nacional') return;
      if (f.area   && b.area !== f.area && b.area !== 'Cualquier área') return;
      if (f.importeMin && b.importe.max < f.importeMin) return;
      if (f.importeMax && b.importe.min > f.importeMax) return;
      idsVistos.add(b.id);
      recomendadas.push(b);
    });
  });

  if (!recomendadas.length) {
    document.getElementById('becasRecomendadas').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🎓</div>
        <h3>Sin coincidencias actuales</h3>
        <p>No hay becas abiertas que encajen con tus filtros ahora mismo.</p>
      </div>`;
    return;
  }

  // Reutilizar renderCard de app.js
  document.getElementById('becasRecomendadas').innerHTML =
    recomendadas.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
                .map((b, i) => renderCard(b, i * 40))
                .join('');
}

// ---- Helper Funciones --------------------------------------
async function cargarBecasPerfil() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const { data: perfil, error } = await supabaseClient
    .from('perfiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single();
  
  if (!perfil || (!perfil.tipo_estudio && !perfil.region && (!perfil.area || perfil.area === 'Cualquier área'))) {
    document.getElementById('becasPerfil').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1; padding:40px 20px;">
        <div class="empty-icon" style="font-size:2.5rem; margin-bottom:10px;">⚙️</div>
        <h3>Perfil incompleto</h3>
        <p>Configura lo que estudias para recibir recomendaciones automáticas aquí.</p>
        <a href="perfil.html" class="btn btn-primary btn-sm" style="margin-top:12px;">Configurar perfil</a>
      </div>`;
    return;
  }
  
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const recomendadas = BECAS.filter(b => {
    const dias = Math.ceil((new Date(b.deadline) - hoy) / 86400000);
    if (dias < 0) return false;
    if (perfil.tipo_estudio && b.tipo !== perfil.tipo_estudio) return false;
    if (perfil.region && b.region !== perfil.region && b.region !== 'Nacional') return false;
    if (perfil.area && perfil.area !== 'Cualquier área' && b.area !== perfil.area && b.area !== 'Cualquier área') return false;
    return true;
  });

  if (!recomendadas.length) {
    document.getElementById('becasPerfil').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1; padding:40px 20px;">
        <div class="empty-icon" style="font-size:2.5rem; margin-bottom:10px;">🎓</div>
        <h3>Sin coincidencias</h3>
        <p>No hay becas abiertas que encajen estrictamente con tu perfil actual.</p>
      </div>`;
    return;
  }
  
  document.getElementById('becasPerfil').innerHTML =
    recomendadas.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
                .map((b, i) => renderCard(b, i * 40))
                .join('');
}

// ---- Funciones CRUD (Alertas) ------------------------------
async function cargarAlertas() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const { data: alertas, error } = await supabaseClient
    .from('filtros_guardados')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  const lista = document.getElementById('alertasList');
  const countEl = document.getElementById('alertasCount');

  if (error || !alertas || alertas.length === 0) {
    countEl.textContent = '0 alertas';
    lista.innerHTML = `
      <div class="dashboard-empty">
        <div class="dashboard-empty-icon">🔔</div>
        <h3>Sin alertas guardadas</h3>
        <p>Ve al buscador, aplica filtros y guarda una alerta para recibir notificaciones.</p>
        <a href="index.html" class="btn btn-primary">🔍 Ir al buscador</a>
      </div>`;
    renderBecasRecomendadas([]);
    return;
  }

  countEl.textContent = `${alertas.length} alerta${alertas.length !== 1 ? 's' : ''}`;
  lista.innerHTML = alertas.map(renderAlerta).join('');
  renderBecasRecomendadas(alertas);
}

async function toggleAlerta(id, activo) {
  const { error } = await supabaseClient
    .from('filtros_guardados')
    .update({ activo })
    .eq('id', id);
  if (error) showToast('Error al actualizar la alerta', 'error');
  else showToast(activo ? '✅ Alerta activada' : '⏸️ Alerta pausada', 'info');
}

function editarAlerta(id, nombreActual) {
  alertaSeleccionadaId = id;
  document.getElementById('editAlertaNombre').value = nombreActual;
  document.getElementById('modalEditarAlerta').classList.add('active');
}

async function guardarEditAlerta() {
  const nuevoNombre = document.getElementById('editAlertaNombre').value.trim();
  if (!nuevoNombre || !alertaSeleccionadaId) return;

  const { error } = await supabaseClient
    .from('filtros_guardados')
    .update({ nombre: nuevoNombre })
    .eq('id', alertaSeleccionadaId);

  document.getElementById('modalEditarAlerta').classList.remove('active');
  alertaSeleccionadaId = null;

  if (error) showToast('Error al renombrar', 'error');
  else { showToast('✅ Alerta renombrada', 'success'); await cargarAlertas(); }
}

async function eliminarAlerta(id) {
  if (!confirm('¿Eliminar esta alerta?')) return;
  const { error } = await supabaseClient
    .from('filtros_guardados')
    .delete()
    .eq('id', id);
  if (error) showToast('Error al eliminar', 'error');
  else { showToast('🗑️ Alerta eliminada', 'info'); await cargarAlertas(); }
}

// ---- Helpers (los mismos que app.js, para las recomendadas)
function diasRestantes(deadline) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return Math.ceil((new Date(deadline) - hoy) / 86400000);
}
function urgencia(dias) {
  if (dias < 0) return 'cerrada';
  if (dias <= 7) return 'urgente';
  if (dias <= 30) return 'proximo';
  return 'disponible';
}
function urgenciaLabel(u, dias) {
  if (u === 'cerrada') return '⬛ Cerrada';
  if (u === 'urgente') return `🔴 ${dias}d restantes`;
  if (u === 'proximo') return `🟡 ${dias}d restantes`;
  return `🟢 ${dias}d restantes`;
}
function formatImporte(b) {
  if (b.importe.min === b.importe.max) return b.importe.min.toLocaleString('es-ES') + ' €';
  return b.importe.min.toLocaleString('es-ES') + ' – ' + b.importe.max.toLocaleString('es-ES') + ' €';
}
function tipoLabel(t) {
  const map = { universitaria:'Universitaria', bachillerato:'Bachillerato', fp:'FP', master:'Máster', idiomas:'Idiomas', investigacion:'Investigación', movilidad:'Movilidad', artistica:'Artística', formacion:'Formación', primaria:'Primaria/ESO' };
  return map[t] || t;
}
function renderCard(b, delay = 0) {
  const dias = diasRestantes(b.deadline);
  const u = urgencia(dias);
  const pct = u === 'cerrada' ? 100 : Math.max(0, Math.min(100, 100 - (dias / 365) * 100));
  return `
  <article class="beca-card ${u === 'cerrada' ? 'cerrada' : ''}" style="animation-delay:${delay}ms">
    <div class="card-top"><div class="card-badges">
      <span class="badge badge-tipo">${tipoLabel(b.tipo)}</span>
      <span class="badge badge-${u}">${urgenciaLabel(u, dias)}</span>
    </div></div>
    <div class="card-body">
      <div class="card-nombre">${b.nombre}</div>
      <div class="card-entidad">${b.entidad}</div>
      <p class="card-desc">${b.descripcion}</p>
    </div>
    <div class="card-meta">
      <div class="meta-item"><div class="meta-label">Importe</div><div class="meta-value">${formatImporte(b)}</div></div>
      <div class="meta-item"><div class="meta-label">Plazo</div><div class="meta-value">${new Date(b.deadline).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'})}</div></div>
    </div>
    <div class="countdown-bar"><div class="countdown-fill ${u}" style="width:${pct}%"></div></div>
    <div class="card-actions">
      <a href="${b.url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Ver beca ↗</a>
    </div>
  </article>`;
}

// ---- Init ---------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  const nombre = session.user.user_metadata?.nombre || session.user.email.split('@')[0];
  const nameEl = document.getElementById('headerUserName');
  if (nameEl) nameEl.textContent = nombre;

  await cargarAlertas();
  await cargarBecasPerfil();

  document.getElementById('btnGuardarEditAlerta').addEventListener('click', guardarEditAlerta);
  document.getElementById('btnCerrarEditModal').addEventListener('click', () => {
    document.getElementById('modalEditarAlerta').classList.remove('active');
  });
  document.getElementById('modalEditarAlerta').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });
});
