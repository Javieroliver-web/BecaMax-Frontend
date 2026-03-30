// ============================================================
//  PERFIL.JS – Carga y guardado de perfil de usuario (Múltiples secciones)
// ============================================================

async function cargarPerfil() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  // 1. Cargar metadatos de usuario (Datos Personales)
  const user = session.user;
  document.getElementById('perfEmail').value = user.email || '';
  if (user.user_metadata && user.user_metadata.full_name) {
    document.getElementById('perfNombre').value = user.user_metadata.full_name;
  }

  // 2. Cargar perfil académico (base de datos pública)
  const { data, error } = await supabaseClient
    .from('perfiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = No rows returned
    console.error('Error al cargar perfil académico:', error);
    return;
  }

  if (data) {
    document.getElementById('perfTipo').value = data.tipo_estudio || '';
    document.getElementById('perfRegion').value = data.region || 'Andalucía';
    document.getElementById('perfArea').value = data.area || 'Cualquier área';
    
    if (data.avatar_url) {
      document.getElementById('perfilAvatarImg').src = data.avatar_url;
      // Actualizar también el header por si acaso
      const nameEls = document.querySelectorAll('#headerUserName');
      nameEls.forEach(el => {
        el.innerHTML = `<img src="${data.avatar_url}" class="header-avatar-img"> ${el.textContent}`;
      });
    }
  }
}

async function guardarDatosPersonales(e) {
  e.preventDefault();
  
  const nombre = document.getElementById('perfNombre').value;
  const btn = document.getElementById('btnGuardarPersonales');

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const { data, error } = await supabaseClient.auth.updateUser({
    data: { full_name: nombre }
  });

  btn.disabled = false;
  btn.textContent = 'Guardar Datos';

  if (error) {
    console.error('Error al actualizar datos personales:', error);
    showToast('Error al actualizar nombre.', 'error');
  } else {
    showToast('✅ Datos personales actualizados correctamente.', 'success');
    // Actualizar nombre en el header si existe
    const headerName = document.getElementById('headerUserName');
    if (headerName) headerName.textContent = nombre;
  }
}

async function guardarPerfilAcademico(e) {
  e.preventDefault();
  
  const tipo = document.getElementById('perfTipo').value;
  const region = document.getElementById('perfRegion').value;
  const area = document.getElementById('perfArea').value;
  const btn = document.getElementById('btnGuardarAcademico');

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    showToast('Sesión caducada, intenta loguearte de nuevo.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  // Usamos update para no alterar otros campos como el avatar
  const { error } = await supabaseClient
    .from('perfiles')
    .update({ 
      tipo_estudio: tipo, 
      region: region, 
      area: area 
    })
    .eq('user_id', session.user.id);

  btn.disabled = false;
  btn.textContent = 'Guardar Perfil Académico';

  if (error) {
    console.error('Error al guardar perfil académico:', error);
    showToast('Error al actualizar perfil.', 'error');
  } else {
    showToast('🎓 Perfil académico guardado. Tus recomendaciones se han actualizado.', 'success');
  }
}


document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (session) {
    cargarPerfil();
  }
});

// ============================================================
// LÓGICA DE AVATARES
// ============================================================
const AVATARES_PREDEFINIDOS = [
  'Felix', 'Luna', 'Alex', 'Sam', 'Oliver', 'Emma', 'Avery', 'Caleb', 'Chloe'
];

function abrirModalAvatares() {
  const grid = document.getElementById('avatarsGrid');
  grid.innerHTML = '';
  
  AVATARES_PREDEFINIDOS.forEach(seed => {
    const url = `https://api.dicebear.com/9.x/micah/svg?seed=${seed}`;
    const div = document.createElement('div');
    div.className = 'avatar-choice';
    div.innerHTML = `<img src="${url}" alt="${seed} Avatar">`;
    div.onclick = () => guardarAvatar(url);
    grid.appendChild(div);
  });

  document.getElementById('modalAvatares').classList.add('active');
}

async function guardarAvatar(url) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  // Cambiar miniatura UI instantáneamente
  document.getElementById('perfilAvatarImg').src = url;
  document.getElementById('modalAvatares').classList.remove('active');

  // Guardar en Supabase usando UPDATE en lugar de UPSERT para no sobrescribir datos valiosos
  const { error } = await supabaseClient
    .from('perfiles')
    .update({ avatar_url: url })
    .eq('user_id', session.user.id);

  if (error) {
    console.error('Error al guardar avatar:', error);
    showToast('Error al actualizar el avatar.', 'error');
  } else {
    showToast('📸 Foto de perfil actualizada.', 'success');
    updateHeaderAuth(); // Refrescar globales si es necesario
  }
}

