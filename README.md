# BecasAndalucía 🎓

Gestor de becas con filtros, alertas de plazo y notificaciones por email. Orientado inicialmente a Andalucía, escalable a nivel nacional.

---

## Estructura del proyecto

```
index.html          ← Buscador principal
auth.html           ← Registro / Login
dashboard.html      ← Panel de alertas del usuario
styles.css          ← Design system completo
app.js              ← Motor de filtrado y render
auth.js             ← Lógica Supabase Auth (compartida)
dashboard.js        ← Gestión CRUD de alertas
supabase.js         ← Configuración del cliente Supabase
data/becas.js       ← Dataset de becas (~20 entradas iniciales)
```

---

## Setup en 3 pasos

### 1. Supabase (Auth + Base de datos)

1. Crea cuenta gratuita en [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Ve a **Project Settings → API** y copia:
   - `Project URL` → pégala en `supabase.js` como `SUPABASE_URL`
   - `anon/public key` → pégala como `SUPABASE_ANON_KEY`

4. En el **SQL Editor** de Supabase, ejecuta el script `supabase/setup.sql`:

```sql
-- Tabla de filtros guardados
CREATE TABLE filtros_guardados (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  filtros    JSONB NOT NULL DEFAULT '{}',
  activo     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seguridad: cada usuario solo ve sus alertas
ALTER TABLE filtros_guardados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias alertas" ON filtros_guardados
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

5. En **Authentication → Settings**:
   - Configura la URL de confirmación de email (tu dominio o `http://localhost:5500`)
   - Activa "Email confirmations" si quieres confirmar el email antes de entrar

### 2. Resend (emails de alerta) — Fase futura

1. Crea cuenta gratuita en [resend.com](https://resend.com) (3.000 emails/mes gratis)
2. Obtén tu API key
3. La Edge Function de Supabase (`supabase/functions/`) la configuraremos en la siguiente fase

### 3. Abrir en local

Abre con **VS Code + Live Server** (botón "Go Live" abajo a la derecha), o:
```
npx serve .
```
Navega a `http://localhost:5500`

---

## Google AdSense (cuando tengas cuenta aprobada)

Busca en `index.html` el comentario `<!-- ADSENSE:` y descomenta el bloque `<ins>`.

---

## Roadmap

- [x] MVP: filtros, countdown, cards, dataset inicial
- [x] Auth: registro, login, logout (Supabase)
- [x] Alertas: guardar/activar/desactivar/eliminar desde dashboard
- [ ] Fase 2: Integración BDNS API (Hacienda) para becas en tiempo real
- [ ] Fase 2: Edge Function Supabase + Resend para envío de emails
- [ ] Fase 3: Scraper de convocatorias abiertas de la Junta y MEC
- [ ] Fase 3: Panel de administración para añadir becas manualmente
- [ ] Google AdSense activado
