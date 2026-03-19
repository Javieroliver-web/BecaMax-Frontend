// ============================================================
//  PERFIL.JS – Carga y guardado de perfil de usuario
// ============================================================

async function cargarPerfil() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const { data, error } = await supabaseClient
    .from('perfiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = No rows returned (is fine for new users)
    console.error('Error al cargar perfil:', error);
    return;
  }

  if (data) {
    document.getElementById('perfTipo').value = data.tipo_estudio || '';
    document.getElementById('perfRegion').value = data.region || 'Andalucía';
    document.getElementById('perfArea').value = data.area || 'Cualquier área';
  }
}

async function guardarPerfil(e) {
  e.preventDefault();
  
  const tipo = document.getElementById('perfTipo').value;
  const region = document.getElementById('perfRegion').value;
  const area = document.getElementById('perfArea').value;
  const btn = document.getElementById('btnGuardar');

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    showToast('Sesión caducada, intenta loguearte de nuevo.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  // Usamos upsert para crear o actualizar el perfil
  const { error } = await supabaseClient
    .from('perfiles')
    .upsert([{ 
      user_id: session.user.id, 
      tipo_estudio: tipo, 
      region: region, 
      area: area 
    }], { onConflict: 'user_id' });

  btn.disabled = false;
  btn.textContent = 'Guardar configuración';

  if (error) {
    console.error('Error al guardar:', error);
    showToast('Error al guardar el perfil.', 'error');
  } else {
    showToast('✅ Perfil guardado. Tus recomendaciones se han actualizado.', 'success');
    // Tras 1 seg de lectura del toast, enviamos al dashboard
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1200);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (session) {
    cargarPerfil();
  }
});
