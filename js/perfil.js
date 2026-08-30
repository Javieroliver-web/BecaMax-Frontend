// ============================================================
//  PERFIL.JS – Carga y guardado de perfil de usuario (Múltiples secciones)
// ============================================================

// Supabase Storage a veces devuelve un 503 puntual al servir una foto de
// avatar. Comprobado que el archivo existe y responde 200 vía fetch() en
// el mismo momento en que el <img> falla: es una respuesta mala cacheada
// en el CDN concreta para esa variante de petición, no un problema real
// del archivo. Un <img> tampoco reintenta solo tras un error, así que sin
// esto se quedaba mostrando el icono de imagen rota indefinidamente. En
// cada reintento se añade un parámetro distinto para forzar una petición
// nueva que no pueda servirse desde esa entrada de caché mala.
function cargarImagenConReintento(img, url, intentosRestantes = 2) {
  img.onerror = () => {
    if (intentosRestantes <= 0) return;
    setTimeout(() => {
      const urlSinCache = url + (url.includes('?') ? '&' : '?') + '_r=' + Date.now();
      cargarImagenConReintento(img, urlSinCache, intentosRestantes - 1);
    }, 500);
  };
  img.src = url;
}

// Las fotos que suben los usuarios vienen tal cual las hace el móvil (pueden
// superar los 4000px de lado y varios MB), muy por encima de lo que necesita
// un avatar circular pequeño. Redimensionamos a un máximo de 512px y
// recomprimimos a JPEG en el propio navegador antes de subir, para no gastar
// almacenamiento ni ancho de banda de más en cada carga del perfil.
async function redimensionarImagen(file, maxLado = 512, calidad = 0.85) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);

  return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', calidad));
}

async function cargarPerfil() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  // 1. Cargar metadatos de usuario (Datos Personales)
  const user = session.user;
  document.getElementById('perfEmail').value = user.email || '';
  // El registro guarda el nombre como user_metadata.nombre (auth.js);
  // full_name solo se usa si Configuración lo actualiza mas tarde. Sin
  // este fallback, cualquiera que se hubiera registrado normalmente veia
  // este campo vacio pese a que la cabecera si mostraba su nombre bien.
  const nombreGuardado = user.user_metadata?.full_name || user.user_metadata?.nombre;
  if (nombreGuardado) {
    document.getElementById('perfNombre').value = nombreGuardado;
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
    
    // Disparar evento change para actualizar las opciones de área si es FP
    document.getElementById('perfTipo').dispatchEvent(new Event('change'));

    document.getElementById('perfRegion').value = data.region || 'Andalucía';
    
    // Pequeño timeout para asegurar que el DOM actualizó las opciones
    setTimeout(() => {
      document.getElementById('perfArea').value = data.area || 'Cualquier área';
    }, 50);
    
    if (data.avatar_url) {
      cargarImagenConReintento(document.getElementById('perfilAvatarImg'), data.avatar_url);
      // Actualizar también el header por si acaso
      const nameEls = document.querySelectorAll('#headerUserName');
      nameEls.forEach(el => {
        el.innerHTML = `<img src="${data.avatar_url}" class="header-avatar-img" alt=""> ${el.textContent}`;
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
    showToast('Datos personales actualizados correctamente.', 'success');
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
    showToast('Perfil académico guardado. Tus recomendaciones se han actualizado.', 'success');
  }
}


document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (session) {
    cargarPerfil();
  }

  // Lógica para cambiar las áreas de estudio dinámicamente si elige FP
  const perfTipo = document.getElementById('perfTipo');
  const perfArea = document.getElementById('perfArea');
  
  if (perfTipo && perfArea) {
    perfTipo.addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === 'fp') {
        perfArea.innerHTML = `
          <option value="Formación Profesional">Informática y Comunicaciones</option>
          <option value="Formación Profesional">Sanidad</option>
          <option value="Formación Profesional">Administración y Gestión</option>
          <option value="Formación Profesional">Comercio y Marketing</option>
          <option value="Formación Profesional">Hostelería y Turismo</option>
          <option value="Formación Profesional">Servicios Socioculturales y a la Comunidad</option>
          <option value="Formación Profesional">Electricidad y Electrónica</option>
          <option value="Formación Profesional">Actividades Físicas y Deportivas</option>
          <option value="Formación Profesional">Imagen y Sonido</option>
          <option value="Formación Profesional">Otras Familias de FP</option>
        `;
      } else if (v === 'universitaria' || v === 'master' || v === 'investigacion') {
        perfArea.innerHTML = `
          <option value="Cualquier área">Cualquier área / General</option>
          <option value="Ciencia y Tecnología">Ciencias de la Salud</option>
          <option value="Ciencia y Tecnología">Ingeniería y Arquitectura</option>
          <option value="Ciencia y Tecnología">Ciencias (Puras / Exactas)</option>
          <option value="Arte y Diseño">Artes y Humanidades</option>
          <option value="Educación">Ciencias Sociales, Jurídicas y Educación</option>
        `;
      } else if (v === 'artistica') {
        perfArea.innerHTML = `
          <option value="Arte y Diseño">Música y Conservatorio</option>
          <option value="Arte y Diseño">Danza y Arte Dramático</option>
          <option value="Arte y Diseño">Artes Plásticas y Diseño</option>
        `;
      } else if (v === 'idiomas') {
        perfArea.innerHTML = `
          <option value="Idiomas">Idiomas y Acreditaciones</option>
        `;
      } else {
        perfArea.innerHTML = `
          <option value="Cualquier área">Cualquier área / General</option>
          <option value="Ciencia y Tecnología">Ciencias y Tecnología</option>
          <option value="Arte y Diseño">Artes</option>
          <option value="Educación">Humanidades y Ciencias Sociales</option>
        `;
      }
    });
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

  cargarImagenConReintento(document.getElementById('perfilAvatarImg'), url);
  document.getElementById('modalAvatares').classList.remove('active');

  const { error } = await supabaseClient
    .from('perfiles')
    .update({ avatar_url: url })
    .eq('user_id', session.user.id);

  if (error) {
    console.error('Error al guardar avatar:', error);
    showToast('Error al actualizar el avatar.', 'error');
  } else {
    showToast('Foto de perfil actualizada.', 'success');
    // Actualizar nombre en el header si existe (para refrescar imagen global)
    if (typeof updateHeaderAuth === 'function') updateHeaderAuth();
  }
}

// Event listener para subida de imagen personalizada
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('uploadAvatar');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return;

      // Cerrar modal temporalmente y mostrar toast de carga
      document.getElementById('modalAvatares').classList.remove('active');
      showToast('Subiendo imagen...', 'info');

      // Nombre de archivo único (siempre .jpeg: redimensionarImagen recomprime a JPEG)
      const fileName = `${session.user.id}-${Math.random()}.jpeg`;
      const filePath = `${session.user.id}/${fileName}`;

      const archivoRedimensionado = await redimensionarImagen(file);

      // Subir al bucket
      const { error: uploadError } = await supabaseClient.storage
        .from('avatars')
        .upload(filePath, archivoRedimensionado, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });

      if (uploadError) {
        console.error('Upload Error:', uploadError);
        showToast('Error al subir la imagen. Comprueba el tamaño.', 'error');
        return;
      }

      // Obtener URL pública
      const { data: publicUrlData } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (publicUrlData && publicUrlData.publicUrl) {
        await guardarAvatar(publicUrlData.publicUrl);
      }
    });
  }
});

