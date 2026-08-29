/**
 * BecaMax - Configuración
 * Gestión de accesibilidad, seguridad y eliminación de cuentas.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (session) {
      cargarPreferencias();
    }
  
    const deleteInput = document.getElementById('inputEliminarConfirm');
    if(deleteInput) {
      deleteInput.addEventListener('input', (e) => {
        const btn = document.getElementById('btnConfirmarEliminar');
        if (e.target.value === 'BORRAR') {
          btn.disabled = false;
        } else {
          btn.disabled = true;
        }
      });
    }
  });
  
  // ==========================================
  // APARIENCIA E INICIALIZACIÓN
  // ==========================================
  function cargarPreferencias() {
    // Revisar local storage para el tema unificado
    const useLightMode = localStorage.getItem('theme') === 'light';
    const toggle = document.getElementById('toggleTheme');
    
    if (useLightMode) {
      document.body.classList.add('light-mode');
      if (toggle) toggle.checked = true;
    } else {
      document.body.classList.remove('light-mode');
      if (toggle) toggle.checked = false;
    }
    
    // Notificaciones
    const toggleCorreos = document.getElementById('toggleCorreos');
    const confFrecuencia = document.getElementById('confFrecuencia');
    
    if (toggleCorreos) {
      const savedCorreos = localStorage.getItem('becamax_correos');
      if (savedCorreos !== null) toggleCorreos.checked = savedCorreos === 'true';
      
      toggleCorreos.addEventListener('change', (e) => {
        localStorage.setItem('becamax_correos', e.target.checked);
        showToast('Preferencia de correos guardada', 'success');
      });
    }
    
    if (confFrecuencia) {
      const savedFrecuencia = localStorage.getItem('becamax_frecuencia');
      if (savedFrecuencia !== null) confFrecuencia.value = savedFrecuencia;
      
      confFrecuencia.addEventListener('change', (e) => {
        localStorage.setItem('becamax_frecuencia', e.target.value);
        showToast('Frecuencia de alertas guardada', 'success');
      });
    }
  }
  
  function alternarTema() {
    const toggle = document.getElementById('toggleTheme');
    // Actualizar también el botón del header de auth.js si está visible
    const headerToggle = document.getElementById('themeToggle');

    if (toggle.checked) {
      document.body.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
      if(headerToggle) headerToggle.innerHTML = '';
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
      if(headerToggle) headerToggle.innerHTML = '';
    }
  }
  
  // ==========================================
  // SEGURIDAD
  // ==========================================
  async function actualizarContrasena(e) {
    e.preventDefault();
    
    const password = document.getElementById('confPassword').value;
    const passwordConfirm = document.getElementById('confPasswordConfirm').value;
    const btn = document.getElementById('btnGuardarSeguridad');
  
    if (password !== passwordConfirm) {
      showToast('Las contraseñas no coinciden.', 'error');
      return;
    }
  
    if (password.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }
  
    btn.disabled = true;
    btn.textContent = 'Actualizando...';
  
    const { data, error } = await supabaseClient.auth.updateUser({
      password: password
    });
  
    btn.disabled = false;
    btn.textContent = 'Actualizar Contraseña';
  
    if (error) {
      console.error('Error al cambiar contraseña:', error);
      showToast('Error al cambiar la contraseña. ' + error.message, 'error');
    } else {
      showToast(' Contraseña actualizada correctamente.', 'success');
      document.getElementById('confPassword').value = '';
      document.getElementById('confPasswordConfirm').value = '';
    }
  }
  
  // ==========================================
  // ELIMINAR CUENTA (ZONA DE PELIGRO)
  // ==========================================
  function procesoEliminarCuenta() {
    document.getElementById('inputEliminarConfirm').value = '';
    document.getElementById('btnConfirmarEliminar').disabled = true;
    document.getElementById('modalEliminar').classList.add('active');
  }
  
  async function ejecutarEliminacionCuenta() {
    const btn = document.getElementById('btnConfirmarEliminar');
    btn.disabled = true;
    btn.textContent = 'Destruyendo datos...';
  
    try {
      // Llamar al RPC interno de Supabase para autoborrado
      const { error } = await supabaseClient.rpc('delete_my_account');
      
      if (error) throw error;
      
      // La base de datos, en cascada, purgará todo (perfiles, alertas, incidencias).
      await supabaseClient.auth.signOut();
      
      showToast('Tu cuenta ha sido eliminada por completo. ¡Buena suerte!', 'success');
      
      // Esperamos 3 segundos antes de redirigir para que el usuario pueda leer el mensaje
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 3000);
  
    } catch (err) {
      console.error('Error purgueando cuenta:', err);
      showToast('Hubo un problema. Por favor intentalo de nuevo o contacta soporte.', 'error');
      btn.disabled = false;
      btn.textContent = 'Eliminar Ahora';
      document.getElementById('modalEliminar').classList.remove('active');
    }
  }
  
