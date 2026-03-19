// ============================================================
//  INCIDENCIAS.JS – Envío de feedback de usuarios a Supabase
// ============================================================

async function enviarIncidencia(e) {
  e.preventDefault();
  
  const tipo = document.getElementById('incTipo').value;
  const desc = document.getElementById('incDesc').value.trim();
  const btn = document.getElementById('btnEnviar');

  if (!tipo || !desc) {
    showToast('Por favor, rellena todos los campos.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando...';

  // Obtenemos el user_id si está logueado, sino null
  const { data: { session } } = await supabaseClient.auth.getSession();
  const userId = session ? session.user.id : null;

  // Insertar en la tabla incidencias
  const { error } = await supabaseClient
    .from('incidencias')
    .insert([{
      user_id: userId,
      tipo: tipo,
      descripcion: desc,
      estado: 'pendiente'
    }]);

  btn.disabled = false;
  btn.textContent = 'Enviar mensaje';

  if (error) {
    console.error(error);
    showToast('Hubo un error al enviar el reporte. Inténtalo de nuevo.', 'error');
  } else {
    document.getElementById('formIncidencia').style.display = 'none';
    document.getElementById('incidenciaSuccess').style.display = 'block';
  }
}
