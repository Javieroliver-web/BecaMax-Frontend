// ============================================================
//  ADMIN.JS – Lógica protegida para las vistas de Administrador
// ============================================================

/**
 * Verifica que el usuario tenga sesión Y su rol sea 'admin'.
 * Si no es admin, lo redirige a index.html.
 * @returns {boolean} true si es admin, false si ha sido redirigido.
 */
async function requireAdmin() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (!session) {
    window.location.href = 'auth.html';
    return false;
  }

  // Comprobar rol en la tabla perfiles
  const { data: perfil, error } = await supabaseClient
    .from('perfiles')
    .select('rol')
    .eq('user_id', session.user.id)
    .single();

  if (error || !perfil || perfil.rol !== 'admin') {
    // Si no es admin, fuera
    window.location.href = 'index.html';
    return false;
  }

  // Evitar parpadeos: mostramos el body solo cuando confirmamos que es admin
  const adminBody = document.getElementById('adminBody');
  if (adminBody) {
    adminBody.style.display = 'block';
  }

  return true;
}
