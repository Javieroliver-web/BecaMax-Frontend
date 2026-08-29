// ============================================================
//  ADMIN.JS – Lógica protegida para las vistas de Administrador
// ============================================================

async function requireAdmin() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (!session) {
    window.location.href = '/pages/auth.html';
    return false;
  }

  const { data: perfil, error } = await supabaseClient
    .from('perfiles')
    .select('rol')
    .eq('user_id', session.user.id)
    .single();

  if (error || !perfil || perfil.rol !== 'admin') {
    window.location.href = '/index.html';
    return false;
  }

  const adminBody = document.getElementById('adminBody');
  if (adminBody) {
    adminBody.style.display = 'block';
  }
  return true;
}

// ------------------------------------------------------------
//  MONITORIZACIÓN Y GESTIÓN
// ------------------------------------------------------------

async function cargarDatosDashboard() {
  // 1. Cargar Usuarios
  const { data: perfiles, error: errPerfiles } = await supabaseClient
    .from('perfiles')
    .select('*')
    .order('updated_at', { ascending: false });

  if (errPerfiles) {
    console.error('Error cargando usuarios:', errPerfiles);
    showToast('Error cargando lista de usuarios', 'error');
  } else {
    document.getElementById('statUsuarios').textContent = perfiles.length;
    const bloqueados = perfiles.filter(p => p.estado === 'bloqueado').length;
    document.getElementById('statBloqueados').textContent = bloqueados;

    const list = document.getElementById('usersList');
    if (perfiles.length > 0) {
      list.innerHTML = perfiles.map(u => {
        const isBlocked = u.estado === 'bloqueado';
        const isAdmin = u.rol === 'admin';
        return `
          <tr>
            <td title="${u.user_id}" style="font-family:monospace; font-size:0.8rem;">${u.user_id.substring(0,8)}...</td>
            <td><span class="badge ${isAdmin ? 'badge-admin' : 'badge-user'}">${u.rol.toUpperCase()}</span></td>
            <td><span class="badge ${isBlocked ? 'badge-bloqueado' : 'badge-activo'}">${(u.estado || 'activo').toUpperCase()}</span></td>
            <td>${u.tipo_estudio || '—'}</td>
            <td>${u.region || '—'}</td>
            <td>${new Date(u.updated_at).toLocaleDateString()}</td>
            <td>
              <div class="action-group">
                ${isBlocked 
                  ? `<button class="btn btn-secondary btn-sm" onclick="cambiarEstadoUsuario('${u.user_id}', 'activo')" title="Activar Permisos"></button>`
                  : `<button class="btn btn-warning btn-sm" onclick="cambiarEstadoUsuario('${u.user_id}', 'bloqueado')" title="Bloquear Acceso" ${isAdmin ? 'disabled' : ''}></button>`
                }
                <button class="btn btn-danger btn-sm" onclick="eliminarUsuarioDefinitivo('${u.user_id}')" title="Borrado físico de la base de datos" ${isAdmin ? 'disabled' : ''}></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      list.innerHTML = `<tr><td colspan="7">No hay usuarios registrados.</td></tr>`;
    }
  }

  // 2. Cargar Logs
  const { data: logs, error: errLogs } = await supabaseClient
    .from('system_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (errLogs) {
    console.warn('Tabla de logs no encontrada o sin permisos:', errLogs);
    document.getElementById('statLogs').textContent = 'Error';
  } else {
    document.getElementById('statLogs').textContent = logs.length;
    const logsList = document.getElementById('logsList');
    if (logs.length > 0) {
      logsList.innerHTML = logs.map(l => `
        <tr>
          <td>${new Date(l.created_at).toLocaleString()}</td>
          <td><b>${l.action}</b></td>
          <td>${l.details || '—'}</td>
          <td title="${l.admin_id}">${l.admin_id ? l.admin_id.substring(0,8) : 'Sistema'}</td>
          <td title="${l.user_id}">${l.user_id ? l.user_id.substring(0,8) : '—'}</td>
        </tr>
      `).join('');
    } else {
      logsList.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay logs recientes registrados.</td></tr>`;
    }
  }
}

async function cambiarEstadoUsuario(userId, nuevoEstado) {
  if (!confirm(`¿Estás seguro de que deseas marcar este usuario como ${nuevoEstado.toUpperCase()}?`)) return;

  const { error } = await supabaseClient
    .from('perfiles')
    .update({ estado: nuevoEstado })
    .eq('user_id', userId);

  if (error) {
    console.error('Error al cambiar estado:', error);
    showToast('Error al actualizar estado del usuario', 'error');
  } else {
    showToast(`Usuario ${nuevoEstado} exitosamente`, 'success');
    
    // Opcional: Registrar en system_logs
    const sessionUrl = await supabaseClient.auth.getSession();
    const adminId = sessionUrl.data.session?.user?.id;
    if (adminId) {
      await supabaseClient.from('system_logs').insert([{
        admin_id: adminId,
        user_id: userId,
        action: `USER_${nuevoEstado.toUpperCase()}`,
        details: `Cambiado estado a ${nuevoEstado}`
      }]);
    }
    
    cargarDatosDashboard();
  }
}

async function eliminarUsuarioDefinitivo(userId) {
  const code = Math.floor(1000 + Math.random() * 9000);
  const promptValue = prompt(` ATENCIÓN: Esta acción es IRREVERSIBLE. Se eliminará el usuario y todos sus datos dependientes de Auth y Base de Datos. INGRESA EL CÓDIGO ${code} PARA CONFIRMAR:`);
  
  if (promptValue !== code.toString()) {
    showToast('Código incorrecto. Borrado cancelado.', 'error');
    return;
  }

  showToast('Iniciando borrado...', 'info');
  
  try {
    const backendUrl = CONFIG.BASE_URL;
      
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(`${backendUrl}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || 'Error en petición al servidor');
    }

    showToast('Usuario ELIMINADO de la base de datos', 'success');
    cargarDatosDashboard();

  } catch (error) {
    console.error('Delete error:', error);
    showToast(`Fallo crítico al borrar: ${error.message}`, 'error');
  }
}

// ------------------------------------------------------------
//  GESTIÓN DE NOTICIAS
// ------------------------------------------------------------

async function publicarNoticia() {
  const content = document.getElementById('newsContent').value.trim();
  const expiration = document.getElementById('newsExpiration').value;
  const btn = document.getElementById('btnPostNews');

  if (!content) {
    showToast('El mensaje no puede estar vacío', 'warning');
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = ' Publicando...';

    const backendUrl = CONFIG.BASE_URL;
      
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(`${backendUrl}/api/admin/news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content, expiration })
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.message || 'Error al publicar noticia');
    }

    showToast(' Noticia publicada exitosamente', 'success');
    document.getElementById('newsContent').value = '';
    
  } catch (error) {
    console.error('Error post noticia:', error);
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = ' Publicar Noticia Ahora';
  }
}

// Inicialización de eventos para noticias
document.addEventListener('DOMContentLoaded', () => {
    const btnNews = document.getElementById('btnPostNews');
    if (btnNews) {
        btnNews.addEventListener('click', publicarNoticia);
    }
});
