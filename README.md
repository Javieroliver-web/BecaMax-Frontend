# BecaMax 🎓

Buscador y gestor de becas y ayudas para estudiantes: filtros por tipo de estudio/región, alertas de plazo, favoritos, panel de perfil académico y panel de administración. Datos sincronizados desde la BDNS (Base de Datos Nacional de Subvenciones).

Proyecto dividido en dos repositorios, ambos desplegados en Vercel:

- **Frontend-BecaMax** (este repo) — sitio estático (HTML/CSS/JS vanilla), en [becamax.vercel.app](https://becamax.vercel.app)
- **Backend-BecaMax** — API Express (Node.js) que expone becas, alertas, panel admin y sincronización BDNS

Toda la persistencia (usuarios, becas, alertas, favoritos, avatares, noticias, logs) vive en **Supabase** (Postgres + Auth + Storage), con Row Level Security activada en todas las tablas de usuario.

---

## Estructura del proyecto

```
index.html                 ← Buscador principal / dashboard público
pages/
  auth.html                 ← Registro / Login
  dashboard.html             ← Panel de alertas del usuario logueado
  perfil.html                ← Perfil académico + foto de avatar
  configuracion.html         ← Ajustes de cuenta
  beca-detalle.html          ← Ficha de una beca + creación de alertas
  incidencias.html            ← Reporte de incidencias del usuario
  guias.html, guia-*.html     ← Guías informativas
  faq.html                    ← Preguntas frecuentes
  legal/                       ← Aviso legal, privacidad, cookies
  admin-dashboard.html         ← Panel admin (noticias, métricas)
  admin-monitorizacion.html    ← Panel admin (logs, salud del sistema)
  admin-incidencias.html       ← Panel admin (incidencias reportadas)
js/
  supabase.js, config.js       ← Cliente y configuración de Supabase
  app.js                        ← Motor de filtrado/render del buscador
  auth.js                       ← Lógica de sesión Supabase (compartida)
  dashboard.js                  ← CRUD de alertas del usuario
  favorites.js                  ← Sistema de favoritos (tabla `favoritos`)
  perfil.js                     ← Perfil académico y avatar
  configuracion.js               ← Ajustes de cuenta
  admin.js                       ← Lógica de los paneles de admin
  incidencias.js, cookies.js, adblock.js, logger.js
data/becas.js                  ← Dataset de respaldo (las becas reales vienen de Supabase, sincronizadas desde la BDNS)
vercel.json                    ← Cabeceras de seguridad (CSP, Referrer-Policy, Permissions-Policy)
```

---

## Setup en local

### 1. Supabase (Auth + Base de datos + Storage)

1. Crea cuenta en [supabase.com](https://supabase.com) y un proyecto.
2. En **Project Settings → API**, copia `Project URL` y `anon/public key` a `js/config.js`.
3. Crea las tablas necesarias (`becas`, `perfiles`, `filtros_guardados`/alertas, `favoritos`, `noticias`, `system_logs`, `incidencias`) con RLS activada — ver el esquema vivo del proyecto en el dashboard de Supabase, no hay un `setup.sql` único ya que el esquema evolucionó de forma incremental.
4. Crea un bucket público **`avatars`** en Storage para las fotos de perfil.
5. En **Authentication → Settings**, configura la URL de confirmación de email.

### 2. Backend (API)

El repo `Backend-BecaMax` expone `/api/becas`, `/api/alerts`, `/api/admin`, `/api/logs` y `/api/bdns`. Necesita sus propias variables de entorno (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `FRONTEND_URL`, etc.) — ver ese repo para el detalle.

### 3. Abrir el frontend en local

```
npx serve .
```

Navega a `http://localhost:3000` (o el puerto que indique `serve`).

---

## Seguridad

- Content-Security-Policy, Referrer-Policy y Permissions-Policy configuradas en `vercel.json`.
- RLS en todas las tablas de Supabase con datos de usuario.
- Rate limiting y CORS restringido en el backend (ver `Backend-BecaMax/src/app.js`).

## Google AdSense

Activado en `index.html`, pero **no solicitar la revisión todavía**: el sitio corre en `becamax.vercel.app`, un subdominio compartido propiedad de Vercel, y AdSense rechaza automáticamente ese tipo de dominio por no poder verificar la propiedad (pasa igual con `*.github.io`, `*.netlify.app`, etc.) — es un bloqueo estructural, no de contenido. Hace falta comprar un dominio propio y conectarlo primero (ver `tareas_pendientes_becamax.txt` para el detalle y los pasos de migración).

---

## Roadmap

- [x] MVP: filtros, countdown, cards, buscador
- [x] Auth, alertas, favoritos y perfil académico (Supabase)
- [x] Sincronización automática con la BDNS (Hacienda)
- [x] Panel de administración (noticias, monitorización, incidencias)
- [x] Content-Security-Policy completa
- [ ] Edge Function + envío de emails para alertas de plazo
- [ ] Revisión de Google AdSense
