// ============================================================
//  FAVORITES.JS – Sistema de favoritos con Supabase
// ============================================================

const FAVORITES_KEY = 'becamax_favorites';
let _favoritesSet = new Set(); // Cache local de IDs favoritos
let _userId = null;

// ── Inicializar favoritos (llamar tras saber el userId) ────────────────────
async function initFavorites(userId) {
  _userId = userId;

  // Cargar desde localStorage como caché rápida
  try {
    const cached = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    _favoritesSet = new Set(cached);
  } catch { _favoritesSet = new Set(); }

  // Sincronizar con Supabase en background
  try {
    const { data, error } = await supabaseClient
      .from('favoritos')
      .select('beca_id')
      .eq('user_id', userId);
    if (!error && data) {
      _favoritesSet = new Set(data.map(r => r.beca_id));
      _persistFavoritesCache();
    }
  } catch (e) {
    console.warn('[Favorites] No se pudo sincronizar con Supabase:', e.message);
  }
}

function _persistFavoritesCache() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([..._favoritesSet]));
}

// ── Comprobar si una beca es favorita ────────────────────────────────────────
function isFavorite(becaId) {
  return _favoritesSet.has(String(becaId));
}

// ── Toggle favorito ──────────────────────────────────────────────────────────
async function toggleFavorite(becaId, btnEl) {
  if (!_userId) {
    const isPagesDir = window.location.pathname.includes('/pages/');
    const toPages = isPagesDir ? './' : 'pages/';
    window.location.href = toPages + 'auth.html?returnUrl=' + encodeURIComponent(window.location.pathname);
    return;
  }

  const id = String(becaId);
  const wasFav = _favoritesSet.has(id);

  // Actualizar UI inmediatamente (optimistic)
  if (wasFav) {
    _favoritesSet.delete(id);
  } else {
    _favoritesSet.add(id);
  }
  _persistFavoritesCache();
  _updateFavBtn(btnEl, !wasFav);

  // Sincronizar con Supabase. supabase-js no lanza excepcion en errores de
  // base de datos (RLS, constraints...): devuelve { error } en la propia
  // respuesta, hay que comprobarlo explicitamente o un fallo silencioso
  // se muestra igualmente como "guardado con éxito".
  try {
    if (wasFav) {
      const { error } = await supabaseClient.from('favoritos').delete().eq('user_id', _userId).eq('beca_id', id);
      if (error) throw error;
      showToast('Beca eliminada de favoritos', 'info');
    } else {
      const { error } = await supabaseClient.from('favoritos').upsert({ user_id: _userId, beca_id: id }, { onConflict: 'user_id,beca_id' });
      if (error) throw error;
      showToast('Beca añadida a favoritos', 'success');
    }
  } catch (e) {
    // Revertir en caso de error
    if (wasFav) { _favoritesSet.add(id); } else { _favoritesSet.delete(id); }
    _persistFavoritesCache();
    _updateFavBtn(btnEl, wasFav);
    showToast('Error al actualizar favoritos', 'error');
  }
}

function _updateFavBtn(btn, isFav) {
  if (!btn) return;
  btn.classList.toggle('active', isFav);
  btn.setAttribute('aria-label', isFav ? 'Quitar de favoritos' : 'Añadir a favoritos');
  btn.setAttribute('title', isFav ? 'Quitar de favoritos' : 'Guardar beca');
}

// ── Renderizar sección de favoritos en el dashboard ──────────────────────────
async function renderFavoritosSection(containerId) {
  const container = document.getElementById(containerId);
  if (!container || !_userId) return;

  const { data, error } = await supabaseClient
    .from('favoritos')
    .select('beca_id, created_at')
    .eq('user_id', _userId)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:40px 20px;">
        <div class="empty-icon" style="font-size:2.5rem;margin-bottom:10px;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
        <h3>Sin favoritos aún</h3>
        <p>Guarda becas con el botón de estrella para encontrarlas fácilmente aquí.</p>
        <a href="../index.html" class="btn btn-primary btn-sm" style="margin-top:12px;">Explorar becas</a>
      </div>`;
    return;
  }

  // Cargar datos de las becas favoritas desde el array BECAS si está disponible
  const favIds = data.map(r => String(r.beca_id));
  let becasFav = [];
  if (typeof BECAS !== 'undefined' && BECAS.length > 0) {
    becasFav = BECAS.filter(b => favIds.includes(String(b.id)));
  }

  if (becasFav.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;">Cargando datos de las becas...</p>`;
    return;
  }

  container.innerHTML = becasFav
    .map((b, i) => (typeof renderCard === 'function' ? renderCard(b, i * 30) : ''))
    .join('');
}
