# ARCHITECTURE.md - Sweaterr Direct Download Automation System

---

## 📅 FECHAS RELEVANTES

**Última actualización**: 09 de enero de 2026  
**Inicio del proyecto**: Diciembre 2025  
**Estado del proyecto**: En desarrollo activo  
**Versión actual**: 1.3.1

---

## 🤖 NOTAS PARA LLMs

### Instrucción Permanente de Documentación

- **Documentar en tiempo real**: Cada cambio, decisión, prueba y error debe registrarse inmediatamente en este documento sin esperar confirmación del usuario.
- **Incluir errores**: Los bugs encontrados y sus resoluciones deben documentarse para evitar regresiones.
- **Esta instrucción es permanente**: Debe leerse y aplicarse como parte del contexto antes de trabajar en cualquier tarea.

### Flujo de trabajo documental

- **ROADMAP = features futuras**: Solo planes/funcionalidades aún no implementadas.
- **ISSUES = bugs/regresiones**: Problemas detectados que sí tienen solución con el stack actual. Se resuelven aquí y luego pasan a CHANGELOG.
- **PROBLEMAS CONOCIDOS = sin solución actual**: Limitaciones del stack; si encontramos solución, se mueven a ISSUES.
- **MOVE**: Al completar un feature, pasarlo de ROADMAP → CARACTERÍSTICAS y registrar en CHANGELOG. Al cerrar un bug, moverlo de ISSUES → CHANGELOG.
- **CHANGELOG solo éxitos**: Nada pendiente o fallido aquí.

### Cómo Entender Este Proyecto

1. **Lee primero**:
   - Esta sección completa (NOTAS PARA LLMs)
   - RESUMEN EJECUTIVO para contexto general
   - CARACTERÍSTICAS DE LA APLICACIÓN para funcionalidades disponibles

2. **Enfócate en los núcleos del sistema**:
   - `src/lib/services/cloudflare-handler.ts` y `flaresolverr-client.ts` - Bypass de Cloudflare (corazón del proyecto)
   - `src/hooks/use-api.ts` - Hooks CRUD para todos los servicios
   - `src/app/page.tsx` - Dashboard principal con 5 tabs

3. **Flujo típico de operación**:

   ```text
   Usuario configura servicio (foro/JD/IA) en UI
   → API guarda en DB (Prisma + SQLite)
   → Usuario ejecuta acción (buscar/extraer/descargar)
   → cloudflare-handler.ts usa FlareSolverr cuando necesario
   → Sistema retorna resultado (cookies, datos, enlaces)
   ```

4. **Variable crítica**: `FLARESOLVERR_URL` en `.env.local`
   - Sin esta variable, el sistema cae a Playwright (que no funciona con Cloudflare Turnstile)
   - El proyecto está diseñado para FlareSolverr como solución principal

5. **Patrón de múltiples instancias**:
   - Foros, *arr, JDownloader e IA soportan múltiples configuraciones
   - Hooks en plural: `useForums()`, `useJDownloaders()`, `useAIModels()`
   - Endpoints: `/list` (GET/POST) y `/list/[id]` (DELETE/PATCH)
   - UI: Tarjetas con switch toggle, botones icon, AlertDialog
   - **CRÍTICO Next.js 15**: Siempre hacer `await params` en rutas dinámicas `[id]`

6. **Sistema i18n obligatorio** (desde 2026-01-09):
   - **NUNCA hardcodear texto en componentes**: Todo texto visible debe venir de `t(key)`
   - **Añadir labels PRIMERO**: Antes de crear cualquier componente con texto, añadir las claves en `es.json` y `en.json`
   - **Estructura**: Organizar por sección lógica (auth, forums, dashboard, components, etc.)
   - **Uso**: `const { t } = useI18n('es')` en componentes client-side, luego `t('section.key')`
   - **Validación**: Verificar que el texto se muestra correctamente en ambos idiomas (español e inglés)

### Cómo Continuar el Trabajo

1. **Antes de modificar código**:
   - Leer sección CHANGELOG para ver cambios recientes
   - Verificar ROADMAP para alinear con prioridades activas
   - Revisar PROBLEMAS CONOCIDOS para no reintroducir issues

2. **Al hacer cambios**:
   - Actualizar este documento inmediatamente
   - Documentar en la sección correspondiente
   - Si es bug: agregar a CHANGELOG con fecha
   - Si es feature: agregar a CARACTERÍSTICAS y CHANGELOG, remover de ROADMAP
   - Si es limitación conocida: documentar en PROBLEMAS CONOCIDOS

3. **Testing obligatorio**:
   - Probar con credenciales válidas E inválidas
   - Verificar FlareSolverr: `curl http://192.168.1.100:8191`
   - Revisar logs en terminal donde corre `npm run dev`
   - Ejecutar `npm run build` para verificar TypeScript

### Contexto del Usuario

- **Usuario**: malevolent
- **Sistema**: Linux
- **FlareSolverr**: Docker @ 192.168.1.100:8191 (always-on)
- **Foro de prueba**: DescargasDD.org
- **Credenciales de prueba**:
  - ✅ Válidas: username=malevolent, password=aCW7KF5dVUjeNxk
  - ❌ Inválidas: username=malevolent, password=password_malo
- **Idioma preferido**: Español (España)
- **Preferencias de desarrollo**:
  - Desarrollo iterativo (una feature a la vez)
  - Documentación exhaustiva en cada paso
  - Validación manual tras cada cambio
  - Commits descriptivos en español

### Convenciones del Proyecto

- **Commits**: Descriptivos, en español, siguiendo Conventional Commits cuando posible
- **Logs**: `console.log` con prefijos descriptivos: `[FlareSolverr]`, `[CloudflareHandler]`, `[SessionMgr]`
- **Errores API**: Siempre retornar `{ success: false, error: string }`
- **TypeScript**: Strict mode, evitar `any` salvo casos justificados y documentados
- **CSS**: Tailwind + shadcn/ui, no CSS custom salvo necesario
- **i18n**: Todos los textos de UI deben estar en `src/locales/{es,en}.json`

---

## 🎯 CARACTERÍSTICAS DE LA APLICACIÓN

### Stack Tecnológico

```text
Frontend:
- Next.js 15.3.5 (App Router)
- React 19
- TypeScript 5.x
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod

Backend:
- Next.js API Routes
- Prisma ORM
- SQLite (dev.db en desarrollo)

Servicios Externos:
- FlareSolverr (Docker @ 192.168.1.100:8191) - Bypass Cloudflare Turnstile
- JDownloader2 - Gestor de descargas (MyJDownloader + API local)
- Radarr/Sonarr - Automatización *arr (Torznab compatible)
- Playwright (fallback legacy cuando FlareSolverr no disponible)

Infraestructura:
- Docker Compose
- Caddy (reverse proxy)
```text

### 1. Sistema de Bypass Cloudflare ⭐ NÚCLEO DEL PROYECTO

**Estado**: ✅ Implementado y funcional

**Problema resuelto**: Los foros modernos de descarga directa implementan Cloudflare Turnstile que:

- Bloquea navegadores headless (Playwright infinite loop)
- Detecta automatización y deniega acceso
- Requiere resolución de challenges interactivos

**Solución FlareSolverr** (Preferida):

- Cliente HTTP para FlareSolverr API v1
- Comandos: `request.get` y `request.post` (NO usar `request` genérico)
- Timeout: 60 segundos configurable
- Captura: cookies, headers, user agent, HTML completo
- Sesiones persistentes con TTL configurable (5 min - 24 horas)

**Archivos clave**:

- `src/lib/services/flaresolverr-client.ts` - Cliente FlareSolverr
- `src/lib/services/cloudflare-handler.ts` - Lógica de autenticación
- `src/lib/services/flaresolverr-session-manager.ts` - Gestión de sesiones
- `src/lib/cookie-jar-store.ts` - CookieJar en memoria por dominio

**Flujo de autenticación**:

1. Warm-up GET a baseUrl (cookies iniciales)
2. Login POST con credenciales vBulletin
3. Validación dual: Parsing HTML + Verificación cookies de sesión
4. Persistencia de cookies en BD para reutilización

**Optimizaciones**:

- Reutilización de cookies persistidas (evita challenges repetidos)
- SessionManager con cleanup automático cada 5 minutos
- CookieJar con headers de navegador real
- Detección de páginas de bloqueo (ej: LaLiga)

### 2. Gestión de Foros (CRUD Completo)

**Estado**: ✅ Implementado

**Características**:

- CRUD completo: Crear, Leer, Actualizar, Eliminar
- Múltiples foros configurables simultáneamente
- Credenciales opcionales (usuario/password)
- Modos de búsqueda: native, google_site, google_cse
- En modo nativo, se recomienda configurar `searchPath` como `/search.php?search_type=1` para usar la búsqueda avanzada y limitar resultados al área relevante (ej. Zona Series + subforos).
- **Selección de área en búsqueda avanzada** (Nuevo 2026-01-08): Campo `searchForumLabel` (opcional) permite preseleccionar el foro/área en búsquedas nativas (ej: "Zona Series", "Series HD"). El sistema analiza automáticamente el formulario de búsqueda y aplica la selección configurada.
- **Búsqueda literal con comillas** (Nuevo 2026-01-08): Checkbox "Búsqueda literal" en la UI de testing permite envolver la query en comillas dobles para búsquedas exactas. Útil cuando el foro devuelve demasiados resultados con coincidencias parciales (ej: "Sobrenatural T1" vs "Sobrenatural T.1"). Funciona en todos los modos de búsqueda (native, Google site, Google CSE).
- Selectores CSS personalizables por foro
- Sesiones FlareSolverr persistentes con TTL
- Cookies persistidas con reutilización automática

**API Endpoints**:

- `GET /api/config/forums` - Listar todos
- `POST /api/config/forums` - Crear nuevo
- `PUT /api/config/forums/[id]` - Actualizar existente
- `DELETE /api/config/forums/[id]` - Eliminar
- `POST /api/config/forums/test` - Probar conexión
- `GET /api/config/forums/[id]/session` - Estado de sesión FlareSolverr
- `PATCH /api/config/forums/[id]/session` - Actualizar TTL sesión
- `DELETE /api/config/forums/[id]/refresh-cookies` - Borrar cookies

**UI**:

- Tabla responsive con estado de sesión en tiempo real (refresh cada 30s)
- Columnas: Foro | URL | Estado | Sesión | Duración | Acciones
- Dialog de configuración con formulario completo
- Auto-fill para foros conocidos (DescargasDD)
- Campo opcional para etiqueta de foro (mostrado cuando `searchMode = native`)

**Base de datos**:

```prisma
model Forum {
  id                      String
  name                    String
  baseUrl                 String
  searchPath              String
  searchMode              String?
  searchForumLabel        String? // Etiqueta para preseleccionar área en búsqueda avanzada
  cseId                   String?
  thankButtonSelector     String?
  linksContainerSelector  String?
  postTitleSelector       String?
  flaresolverrSessionTTL  Int? @default(30)
  persistentCookies       String?
  cookiesUpdatedAt        DateTime?
  enabled                 Boolean @default(true)
  credentials             ForumCredential?
}
```

### 3. Sistema de Extracción de Enlaces

**Estado**: ✅ Implementado

**Problema resuelto**: Enlaces ocultos tras botón "Gracias" que requiere:

- Autenticación previa
- Click en botón específico
- Bypass de Cloudflare
- Parseo de HTML post-revelación

**Flujo de extracción**:

1. Login al foro (si requiere credenciales)
2. Fetch del post con cookies de sesión
3. Detección de contenido oculto
4. Simulación de click en "Gracias" (vía FlareSolverr o axios)
5. Re-fetch del post actualizado
6. Extracción de URLs con regex de bloques bbcode

**Características**:

- Soporte para 10+ hostings (Mega, 1fichier, Uploaded, etc)
- Reutilización de cookies para velocidad
- Fallbacks inteligentes cuando falla selector
- Logging detallado para debugging

**API Endpoint**:

- `POST /api/extract-links` - Extrae enlaces de URL de post

**UI**:

- Botón "Extraer Enlaces" en cada resultado
- Card de enlaces agrupados por hosting
- Botón copy-to-clipboard por enlace
- Integración con JDownloader ("Enviar a JD")

### 4. Sistema de Testing/Emulación

**Estado**: ✅ Implementado

**Funcionalidades**:

- Búsqueda en foros (native, Google site:, Google CSE)
- Extracción de metadatos (tipo, título, año, temporada, calidad, idiomas, tamaño)
- Completado automático de títulos
- Resolución bulk de múltiples títulos
- Integración con IA para enriquecimiento de metadatos
- Envío directo a JDownloader

**Características avanzadas**:

- Flag `bypassAxios` para forzar uso de FlareSolverr
- Heurísticas mejoradas para detección de temporadas (T1, Temporada 1ª, etc)
- Parsing de tamaño con decimales (2.5GB, 1,5GB)
- Detección de idiomas audio/subtítulos
- CookieJar reutilizable entre requests

**API Endpoints**:

- `POST /api/testing/search` - Búsqueda en foro
- `POST /api/testing/title` - Completar título de post
- `POST /api/testing/titles` - Resolución bulk de títulos
- `POST /api/testing/metadata` - Extraer metadatos
- `GET/PATCH /api/testing/settings` - Configuración de testing
- `POST /api/testing/jdownloader/add-links` - Enviar a JD

### 5. Sistema de Autenticación

**Estado**: ✅ Implementado (20/12/2025)

**Arquitectura**:

- JWT tokens con 7 días de validez
- Bcrypt para hashing de passwords
- Middleware de protección de rutas (Edge Runtime compatible)
- Sistema de roles: Admin y User

**Flujo**:

1. Setup inicial: Crear primer admin
2. Login: Email/password → JWT token + Cookie
3. Middleware verifica token en cada request
4. Logout: Limpia cookie y redirige a /login

**Gestión de usuarios** (solo Admin):

- CRUD completo de usuarios
- Cambio de rol (admin/user)
- No permite eliminarse a sí mismo

**Preferencias de usuario**:

- Idioma: es (Español) / en (English)
- Tema: system / light / dark
- Persistencia vía `PATCH /api/auth/me`

**Rutas públicas**:

- `/login`, `/setup`
- `/api/auth/*`
- `/api/arr/*` (para webhooks externos)

### 6. Sistema i18n (Internacionalización)

**Estado**: ✅ Implementado

**Idiomas soportados**:

- Español (es)
- English (en)

**Archivos**:

- `src/locales/es.json` - Traducciones español
- `src/locales/en.json` - Traducciones inglés

**Uso**:

```typescript
const { t } = useI18n('es'); // o propLanguage del componente
const text = t('forums.addForum'); // "Añadir Foro"
```

**Estructura**:

```json
{
  "auth": { "login": "...", "setup": "..." },
  "forums": { "addForum": "...", "editForum": "..." },
  "dashboard": { "cards": {...}, "tabs": {...} },
  "components": { "buttons": {...}, "labels": {...} },
  "common": { "save": "...", "cancel": "..." }
}
```

**Cobertura completa**:

- ✅ Todas las páginas principales (setup, login, dashboard)
- ✅ Todos los componentes de configuración
- ✅ Mensajes de validación y errores
- ✅ Labels, placeholders y tooltips
- ✅ Diálogos y alertas
- ✅ ~150+ claves de traducción en cada idioma

### 7. Integración JDownloader2

**Estado**: ✅ Implementado

**Modos soportados**:

- **MyJDownloader Cloud**: Autenticación oficial con handshake AES/HMAC
- **API Local**: RemoteAPI deprecated (puerto 3128)

**Funcionalidades**:

- Añadir enlaces a LinkGrabber
- Mover a Downloads
- Iniciar/Pausar/Reanudar/Eliminar descargas
- Cambiar ruta de descarga
- Forzar extracción de archivos
- Auto-extract al finalizar
- Polling de estado (1s activo, 5s reposo)

**Características avanzadas**:

- Mapeo de estados JD → UI (running, paused, extracting, finished)
- Barra de progreso con animación durante extracción
- Drawer de detalles con información completa
- Toasts informativos para cada acción

**Múltiples instancias**:

- Soporte para múltiples configuraciones JD
- Toggle enable/disable sin eliminar
- Filtrado: Solo instancias habilitadas en Testing

### 8. Integración *arr (Radarr/Sonarr)

**Estado**: ✅ Implementado

**Características**:

- Indexer Torznab/Newznab compatible
- Endpoint unificado: `GET /api/arr?t=caps|search|tvsearch|movie|get`
- Capacidades: búsqueda TV, películas, obtención directa
- Variantes de query para castellano (T1, 1x01, Temporada 1, etc)

**Categorías soportadas**:

- 5000: TV
- 2000: Movies

**Fallbacks**:

- Resultados placeholder cuando búsqueda falla (evita 0 resultados)
- FlareSolverr automático en caso de 403

### 9. Gestión de Múltiples Instancias

**Estado**: ✅ Implementado para todos los servicios

**Servicios con múltiples instancias**:

- Foros de descarga
- Servicios *arr (Radarr/Sonarr)
- JDownloader2
- Modelos de IA

**Patrón común**:

- CRUD completo: Listar, Crear, Actualizar, Eliminar
- Toggle enable/disable sin eliminación
- UI con tarjetas + switch + botones icon
- AlertDialog de confirmación para delete
- Auto-refresh tras cambios (sin F5)

**API Pattern**:

- `GET/POST /api/config/{service}/list`
- `DELETE/PATCH /api/config/{service}/list/[id]`

### 10. Integración con IA

**Estado**: ✅ Implementado

**Proveedores soportados**:

- OpenAI
- DeepSeek
- Perplexity
- Ollama (local)

**Funcionalidades**:

- Enriquecimiento de metadatos de medios
- Detección de tipo (serie/película)
- Extracción de año, temporada, calidad
- Detección de idiomas audio/subtítulos
- Géneros y descripción

**Configuración**:

- Múltiples modelos configurables
- API key + Base URL personalizable
- Toggle enable/disable

---

## 📖 RESUMEN EJECUTIVO

Blazarr es un sistema automatizado de descarga directa que integra foros de descarga (vBulletin), bypass de protecciones Cloudflare Turnstile, gestión de descargas mediante JDownloader2, y automatización de contenido multimedia vía servicios *arr (Radarr/Sonarr).

**Problema que resuelve**: Los foros de descarga directa modernos tienen múltiples capas de protección (Cloudflare Turnstile, autenticación, sistemas de agradecimiento) que requieren intervención manual repetitiva. Blazarr automatiza todo el flujo desde la búsqueda hasta la descarga, eliminando el trabajo manual.

**Ventajas clave**:

- **Bypass automático de Cloudflare** vía FlareSolverr (solución robusta y mantenida)
- **Múltiples foros simultáneos** con configuraciones independientes
- **Sesiones persistentes** que reducen tiempo de ejecución en ~95% (30s → 1s)
- **Click automático en "Gracias"** para revelar enlaces ocultos
- **Integración directa con JDownloader** (local + cloud)
- **Compatible con *arr** como indexer Torznab/Newznab
- **Sistema de testing completo** para probar flujos antes de automatizar

**Arquitectura**:

- Monolito Next.js con App Router (frontend + backend unificado)
- Base de datos SQLite (Prisma ORM)
- FlareSolverr en Docker para bypass de Cloudflare
- JDownloader2 para gestión de descargas
- Sistema de autenticación JWT con roles

---

## 🏗️ ARQUITECTURA GENERAL

### Estructura del Proyecto

```text
blazarr/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx             # Dashboard principal (5 tabs)
│   │   ├── login/               # Página de login
│   │   ├── setup/               # Setup inicial (primer admin)
│   │   ├── api/                 # API Routes
│   │   │   ├── auth/           # Autenticación
│   │   │   ├── config/         # Configuración servicios
│   │   │   │   ├── forums/     # CRUD foros
│   │   │   │   ├── jdownloader/# CRUD JDownloader
│   │   │   │   ├── ai/         # CRUD IA
│   │   │   │   └── arr/        # CRUD *arr
│   │   │   ├── downloads/      # Gestión descargas JD
│   │   │   ├── extract-links/  # Extracción de enlaces
│   │   │   ├── testing/        # Endpoints de testing
│   │   │   └── arr/            # Indexer Torznab
│   │   └── globals.css
│   ├── components/
│   │   ├── config/             # Componentes configuración
│   │   │   ├── forum-config.tsx
│   │   │   ├── forums-table.tsx
│   │   │   ├── jdownloader-config.tsx
│   │   │   ├── ai-config.tsx
│   │   │   └── arr-config.tsx
│   │   ├── downloads/          # UI descargas JD
│   │   ├── testing/            # UI testing
│   │   ├── user-menu.tsx       # Menú de usuario
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/
│   │   ├── use-api.ts          # Hooks CRUD todos servicios
│   │   ├── use-i18n.ts         # Hook i18n
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── services/
│   │   │   ├── cloudflare-handler.ts        # ⭐ Bypass Cloudflare
│   │   │   ├── flaresolverr-client.ts       # ⭐ Cliente FlareSolverr
│   │   │   ├── flaresolverr-session-manager.ts
│   │   │   ├── link-extractor.ts
│   │   │   ├── forum.ts
│   │   │   ├── jdownloader.ts
│   │   │   ├── ai.ts
│   │   │   └── auth.ts
│   │   ├── cookie-jar-store.ts
│   │   ├── db.ts               # Cliente Prisma
│   │   ├── edge-jwt.ts         # JWT para Edge Runtime
│   │   ├── logger.ts           # Sistema de logging
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── locales/
│   │   ├── es.json             # Traducciones español
│   │   └── en.json             # Traducciones inglés
│   └── middleware.ts           # Protección de rutas
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── logs/                        # Logs por módulo
│   ├── cloudflare.log
│   ├── extract.log
│   ├── testing.log
│   ├── metadata.log
│   └── db.log
├── .env.local                   # Variables de entorno
├── docker-compose.yml
├── Dockerfile
├── Caddyfile
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

### Variables de Entorno Requeridas

```bash
# Base de datos
DATABASE_URL="file:./dev.db"

# Autenticación
JWT_SECRET="your-secret-key-change-in-production"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# FlareSolverr (CRÍTICO)
FLARESOLVERR_URL="http://192.168.1.100:8191"

# FlareSolverr Proxy (Opcional)
# Útil cuando Google bloquea `google_site` por IP (CAPTCHA / "unusual traffic").
# El formato depende del tipo de proxy (http/socks5) y puede incluir credenciales.
FLARESOLVERR_PROXY_URL="http://user:pass@proxy-host:port"

# Google Custom Search Engine (Opcional)
NEXT_PUBLIC_CSE_ID="44f04a516a5b84434"

# IA (Opcional según provider)
OPENAI_API_KEY="sk-..."
DEEPSEEK_API_KEY="..."
```

---

## 📝 CHANGELOG

### 2026-01-09 (Localización i18n Completa)

- ✨ **Sistema i18n completo**: Implementada localización exhaustiva reemplazando todas las cadenas hardcodeadas en español e inglés por labels traducibles desde `es.json` y `en.json`.
- 📄 **Archivos de traducción expandidos**: Añadidas ~150 nuevas claves de traducción organizadas por sección (setup, login, dashboard, forums, testing, components, validation, errors).
- 🌐 **Páginas localizadas**:
  - **Setup** (`src/app/setup/page.tsx`): Validación de usuario/contraseña, mensajes de error, labels de formulario
  - **Login** (`src/app/login/page.tsx`): Campos de autenticación, botones, mensajes de error
  - **Dashboard** (`src/app/page.tsx`): Títulos de cards, descripciones, tabs, diálogos, estados vacíos (~100+ reemplazos)
- 🔧 **Componentes de configuración localizados**:
  - `forum-session-settings.tsx`: Estado de sesión, recomendaciones, duraciones
  - `forum-config.tsx`: Placeholders, ejemplos de selectores CSS
  - `jdownloader-config.tsx`: Nombres de conexión, hosts, puertos
  - `ai-config.tsx`: Descripciones de API keys por proveedor
- 📦 **Downloads localizados** (`downloads-manager.tsx`): Atributos title de botones
- 🛠️ **Proceso de implementación**:
  - Audit completo de cadenas hardcodeadas en toda la aplicación
  - Scripts de Python para reemplazos masivos en archivos grandes
  - Hooks `useI18n('es')` añadidos a componentes client-side
  - Corrección de errores de importación (placement de imports)
- 📊 **Estadísticas**: 10 archivos modificados, 365 inserciones(+), 99 eliminaciones(-)
- 🎯 **Convención establecida**: De ahora en adelante, **todos** los textos nuevos deben añadirse primero a ambos archivos de localización (es.json y en.json) antes de ser usados en componentes

### 2026-01-09 (Fix: Singleton Pattern para FlareSolverrSessionManager - Sessions Ahora Visibles en UI)

- 🐛 **Bug crítico**: Las sesiones de FlareSolverr se creaban correctamente (logs lo confirmaban) pero no eran visibles en la UI de ForumsTable, que mostraba "Sin sesión".
- 🔍 **Causa raíz**:
  - `FlareSolverrSessionManager` no era un verdadero singleton en modo desarrollo
  - Cada importación del módulo en el contexto de hot-reload podía crear una nueva instancia
  - La sesión se creaba en una instancia, pero se recuperaba desde una instancia diferente → null
  - Flujo fallido: POST check endpoint (instancia A) → crea sesión → GET session endpoint (instancia B) → null
- ✅ **Solución implementada** (Patrón Singleton Robusto):
  - Agregada variable global `globalSessionManagerInstance` para garantizar una única instancia
  - Función getter `getGlobalSessionManager()` con lazy initialization
  - Exportación de singleton usa la función getter: `export const sessionManager = getGlobalSessionManager()`
  - **Garantía**: Incluso en hot-reloads sucesivos, la variable global persiste y retorna la misma instancia
- 🎯 **Validación post-fix**:
  - ✅ POST `/api/config/forums/check` crea sesión: logs muestran `[SessionMgr] Created session for descargasdd.org`
  - ✅ GET `/api/config/forums/[id]/session` recupera sesión: retorna JSON completo con sessionId, ageSeconds, expiresInSeconds
  - ✅ Sessions persisten entre requests: mismo sessionId recuperado múltiples veces
  - ✅ TTL tracking funciona: expiresInSeconds cuenta atrás correctamente
- 💡 **Implicación para UI**:
  - ForumsTable ahora recibe datos de sesión en lugar de null
  - Countdown timer puede mostrar TTL restante
  - "Sin sesión" reemplazado por "30 min" (ejemplo)
  - UI polls cada 30s y recibe datos actualizados
- 📝 **Archivos modificados**:
  - `src/lib/services/flaresolverr-session-manager.ts` (main fix - singleton pattern)
  - `src/app/api/config/forums/check/route.ts` (enhanced logging)
  - `src/app/api/config/forums/[id]/session/route.ts` (enhanced logging)
  - `src/middleware.ts` (made check endpoint public)
- 🔬 **Patrón técnico** (aplicable a otros singletons):

  ```typescript
  // ANTES (vulnerable a hot-reload):
  export const sessionManager = new FlareSolverrSessionManager();

  // DESPUÉS (robusto):
  let globalSessionManagerInstance: FlareSolverrSessionManager | null = null;
  function getGlobalSessionManager(): FlareSolverrSessionManager {
      if (!globalSessionManagerInstance) {
          globalSessionManagerInstance = new FlareSolverrSessionManager();
      }
      return globalSessionManagerInstance;
  }
  export const sessionManager = getGlobalSessionManager();
  ```

### 2026-01-09 (Fix: Endpoint de Test de Foros + Inicio de Sesión FlareSolverr)

- 🐛 **Bug crítico**: El endpoint de test de foros no existía, causando error `JSON.parse: unexpected end of data at line 1 column 1` en la UI al intentar probar conexión.
- 🔍 **Causa raíz**:
  1. El directorio se llamaba `test/` pero el [.gitignore](.gitignore#L78) tiene regla `test` que ignora cualquier archivo/directorio con ese nombre
  2. Esto evitó que el endpoint se subiera a Git, quedando solo local
- ✅ **Solución implementada**:
  - **Renombrado** directorio de `test/` a `check/` para evitar .gitignore
  - Creado endpoint en `src/app/api/config/forums/check/route.ts`
  - Actualizado `use-api.ts` para llamar a `/api/config/forums/check`
- 🎯 **Implementación robusta** (versión existente restaurada):
  - Usa `ForumService` (abstracción correcta de alto nivel)
  - **Reutiliza cookies persistentes de BD** si el foro ya existe (más eficiente)
  - Incluye **cleanup de recursos Playwright** en bloque `finally` (previene memory leaks)
  - Con credenciales: Llama a `forumService.authenticate()` con FlareSolverr + Cloudflare bypass
  - Sin credenciales: Fallback a `fetch()` simple con timeout de 10s
  - Acepta códigos 200/403/401 como válidos (403/401 indican que el sitio existe pero requiere login)
- 🚀 **Optimización FlareSolverr**: Después de autenticación exitosa, el endpoint intenta crear una sesión de FlareSolverr para el foro:
  - Si hay `FLARESOLVERR_URL` configurada y el foro existe en BD, llama a `sessionManager.getSession()`
  - Si tiene éxito, la sesión queda lista en memoria para búsquedas posteriores (sin delays por Turnstile)
  - Si falla, la autenticación sigue siendo exitosa pero se sugiere que próximas búsquedas requerirán más tiempo
  - El usuario ve feedback visual indicando si la sesión se inició correctamente
- 📝 **API mejorada**:
  - POST `/api/config/forums/check` ahora devuelve `{ success, message, sessionStarted? }`
  - Hook `useForums()` devuelve objeto con `{ success, message, sessionStarted }` en lugar de solo booleano
  - Componente `ForumConfig` es backwards-compatible con ambos formatos
- ✨ **UX mejorado**: El mensaje de éxito ahora incluye info de sesión FlareSolverr cuando se inicia correctamente

### 2026-01-08 (Búsqueda Literal con Comillas)

### 2026-01-08 (Mejoras de UI y Fix Google Site Search)

- 🎨 **Checkbox "Buscar solo en título" condicional**: El checkbox ahora solo se muestra cuando el foro seleccionado usa búsqueda nativa (searchMode = 'native'). En otros modos (google_site, google_cse) no es relevante y se oculta automáticamente.
- 🗑️ **Eliminado botón "Completar todos los títulos"**: Botón redundante removido de ResultViewer. En modo CSE no funciona, y en modo nativo ya existe el botón "Buscar todos" que cumple mejor función al traer todos los posts directamente.
- 🐛 **Fix: Google site:search preserva comillas**: Corregido bug donde las comillas en la query se perdían al pasar por axios params. Ahora se usa construcción directa de URL con `encodeURIComponent` para preservar las comillas dobles necesarias en búsquedas literales. Antes: `params: { q: gq }` → Ahora: `/search?q=${encodeURIComponent(gq)}`.
- 🎯 **Implementación técnica**:
  - SearchTester: Agregado `searchMode` a interface `ForumOption` y lógica para detectar modo nativo
  - ResultViewer: Simplificada toolbar eliminando texto y botón innecesarios
  - ForumService: Cambiado de axios params object a construcción directa de URL en google_site

- ✨ **Búsqueda literal**: Implementado checkbox "Búsqueda literal (con comillas)" en la UI de testing que envuelve la query en comillas dobles para búsquedas exactas. Cuando está activado, la query `Sobrenatural T1` se convierte en `"Sobrenatural T1"` antes de enviarla al motor de búsqueda.
- 🛠️ **Funcionalidad multiplataforma**: La búsqueda literal funciona en todos los modos de búsqueda (native vBulletin, Google site:search, Google CSE), asegurando consistencia independientemente del motor utilizado.
- 🎯 **Caso de uso**: Útil cuando la búsqueda normal devuelve demasiados resultados con coincidencias parciales. Por ejemplo, sin comillas "Sobrenatural T1" puede devolver 30 resultados (incluye "Sobrenatural T.1", "Sobrenatural 01", etc.), mientras que con comillas devuelve solo 4 resultados exactos.

#### 2026-01-08 (Fix: Google site:search migrado a FlareSolverr)

- 🐛 **Problema crítico**: Google bloquea scraping directo con axios. Devuelve 200 OK pero con HTML de interstitial ("Enable JavaScript") en lugar de resultados reales. Dos intentos fallaron:
  1. Añadir cookies CONSENT - No suficiente sin browser fingerprinting
  2. Enhancear headers (Sec-Fetch-*, Accept, User-Agent) - Google detecta el patrón de axios
  
- ✨ **Solución final: FlareSolverr**: Migrado `google_site` (búsqueda site:domain.com) de axios directo a FlareSolverr, ejecutando JavaScript real en browser headless (Chromium).
  - **Antes**: `axios.get('https://google.com/search?q=site:domain.com+query')` → HTML de "Enable JavaScript"
  - **Ahora**: `FlareSolverrClient.solve({ url: 'https://google.com/search?q=site:domain.com+query' })` → HTML con SERP completa

- 🔍 **Detección de problema**: Los logs mostraban "Found 0 potential result containers" + meta refresh a noscript, indicando que Google activamente bloquea scraping sin browser.

- ✅ **Resultado**: `google_site` ahora devuelve resultados correctamente. Usa FlareSolverr tal como `google_cse` (ya lo hacía). Reutiliza sesiones de FlareSolverr entre búsquedas para velocidad.

- 🛠️ **Robustez extra (2026-01-08)**: Mejorado el flujo `google_site` para soportar URLs SEO de vBulletin (`/threads/...`) además de `showthread.php`, construir `site:` usando el host limpio (sin `https://` ni trailing slash), añadir paginación por `start=` y ejecutar la búsqueda dentro de una sesión explícita de FlareSolverr (create/destroy) para estabilizar resultados.

- 🛠️ **Mitigación de interstitial/consent (2026-01-09)**: Cuando Google devuelve una página de bloqueo/consent (sin contenedores de resultados), `google_site` reintenta automáticamente con variantes más “HTML simple” (`gbv=1` y dominio `google.es`), añade cookie conservadora `CONSENT=YES+` + `User-Agent`, y aplica un fallback final que escanea anchors para reducir fallos de 0 resultados.

- 🛠️ **Error explícito en bloqueo Google (2026-01-09)**: Cuando Google devuelve `/sorry/index` (reCAPTCHA / "unusual traffic"), `google_site` devuelve un error claro en el endpoint de testing en lugar de 0 resultados silenciosos, recomendando configurar `FLARESOLVERR_PROXY_URL` o usar `google_cse` / búsqueda nativa.

- 🛠️ **FlareSolverr client: proxy + compatibilidad (2026-01-08)**: El cliente ahora soporta proxy opcional vía `FLARESOLVERR_PROXY_URL` y deja de enviar `headers` en el payload (parámetro eliminado en FlareSolverr v2+). Se mantiene compatibilidad mapeando `User-Agent` a `userAgent`.

- 📝 **Cambios técnicos** (src/lib/services/forum.ts líneas ~210-306):
  - Eliminado axios directo para google_site
  - Ahora usa `flaresolverrClient.solve({ url, cookies, sessionId })` igual que CSE
  - Parser de resultados (Cheerio) sigue siendo igual: extrae `<div class="g">` → links showthread
  - Deduplicación y conversión URLs relativas → absolutas preservadas
  - Logs: "Using FlareSolverr for Google site:search..." + detalles por resultado

  - Backend: `ForumService.searchForum()` recibe opción `literalSearch` y aplica comillas al query antes de ejecutar búsqueda
  - Logs: Se registra en logs si la búsqueda es literal y muestra tanto el query original como el final

- ✨ **Searchid Pagination**: Implementada paginación persistente en búsqueda nativa vBulletin. El primer POST genera `searchid` que se reutiliza en GETs posteriores (`search.php?searchid=X&page=N`) en lugar de hacer nuevos POST. Esto evita búsquedas diferentes en cada página.
- 🛠️ **Axios fallback a FlareSolverr**: Cuando Axios intenta paginar con searchid y recibe 403 (Cloudflare), automáticamente usa FlareSolverr en lugar de fallar. Flujo: Axios (principal) → FlareSolverr (fallback si 403) → retorna resultados con searchid persistente.
- 🛠️ **Total Results Extraction**: Se extrae del HTML de vBulletin el número total de resultados (ej: "Results 1-25 of 30"). Los patrones soportan inglés y español. Se usa para limitar `fetchAll` (no itera más allá de total) y se muestra en UI como "25 de 30 resultados".

### 2026-01-08 (Searchid & Total Results)

- 🎯 **UI Mejorada**:
  - Botón "Mostrar más" muestra "(25 de 30)" cuando hay total disponible
  - Botón "Cargar todos" muestra "(5 pendientes)" si hay más por cargar
  - Ambos botones se deshabilitan cuando `results.length >= totalResults`
  - CardDescription ahora muestra "25 de 30 resultados" en lugar de "25 resultados"
- 🛠️ **Logging detallado en fetchAll**: Se agregaron logs de progreso página por página para debugging (URL, resultados encontrados, resultados nuevos, total acumulado/esperado).
- 📄 **Tipos**: `ForumSearchResponse` incluye `totalResults?`, API devuelve `totalResults` en respuesta JSON, componentes actualizados para recibir/mostrar totalResults.

#### 2026-01-08 (Fixes de paginación y totales)

- 🐛 **Fix `Cargar todos` con `searchId`**: Cuando se llamaba `fetchAll=true` con `searchId` ya existente, el flujo devolvía solo la primera página. Ahora el servicio itera correctamente por `page=1..N` tanto en Axios como en FlareSolverr, agregando resultados únicos y deteniéndose cuando no hay nuevos o se alcanza el total.
- 🛠️ **Patrones españoles mejorados**: Añadidos patrones para extraer totales como "Mostrando resultados del 1 al 25 de 30" y variantes (mensajes/resultados). La extracción ahora toma el último grupo numérico si el patrón produce múltiples capturas.
- 🎯 **UI**: Con `totalResults` disponible, la cabecera muestra "Mostrando X de Y" y los botones indican pendientes. Si `totalResults` no está disponible, `Cargar todos` recorre páginas hasta que no hay nuevos resultados, evitando mezclar búsquedas distintas al reutilizar `searchId`.

### 2026-01-08 (Continued)

- ✨ Búsqueda avanzada con selección de foro: Nuevo campo `searchForumLabel` (opcional) en configuración de foros permite preseleccionar área de búsqueda (ej: "Zona Series", "Series HD") en la búsqueda nativa avanzada.
- 🛠️ Integración en formulario: Búsqueda nativa ahora analiza el campo de selección de foro (`forumchoice`, `forum`, etc.) en el formulario de búsqueda y aplica automáticamente el valor que coincida con `searchForumLabel` si está configurado.
- 🛠️ searchForumLabel: Se marca el foro como aplicado cuando la coincidencia proviene del select o de checkboxes/radios para evitar filtrados posteriores innecesarios y reflejar correctamente la selección en logs.
- 🛠️ Normalización de etiquetas: La coincidencia de `searchForumLabel` es ahora insensible a acentos/espacios, contempla `id` además de `name`, fuerza `childforums=1` y reconoce selects múltiples como `forumchoice[]`.
- 🛠️ Selección de formulario: El form picker prioriza formularios con selects múltiples de foros (`forumchoice[]`) y campos relacionados, evitando capturar formularios sin selector de foro cuando `searchForumLabel` está configurado.
- 🛠️ FlareSolverr POST: Se fuerza `Content-Type: application/x-www-form-urlencoded` en el POST de búsqueda nativa para que el foro procese correctamente el formulario y genere el `searchid`.
- 🛠️ Búsqueda nativa (POST): Se excluyen botones de guardar preferencias (`doprefs`) al construir el payload; solo se envía `dosearch` para evitar redirecciones de “Preferencias de búsqueda guardadas” sin `searchid`.
- 📄 Tipos actualizados: `Forum` y `ForumConfigForm` incluyen `searchForumLabel?: string`; Prisma schema migrado (`add_search_forum_label`); Prisma Client regenerado.
- 🌐 i18n: Etiquetas añadidas en `locales/{es,en}.json` para "Etiqueta de foro (búsqueda avanzada)" con descripción de uso.
- 🛠️ Fix búsqueda nativa: El flujo `native` prioriza Axios usando cookies persistentes autenticadas (evita respuestas como guest); si Axios falla, usa FlareSolverr con inyección de `Cookie`/`User-Agent` en la misma sesión. Selector de formulario endurecido (evita capturar el form de login por `securitytoken` y prioriza `search.php`). Extracción de `searchid` más robusta (URL final + meta refresh / JS + `<input name="searchid">`) y fallback para parsear resultados directamente si el POST ya devuelve la lista (sin redirect); destrucción de sesión garantizada con `finally`.
- 🛠️ Fix cookies y parsing (2026-01-08 tarde): FlareSolverr recibe cookies autenticadas como arreglo (`payload.cookies`) en vez de cabecera `Cookie`, evitando respuestas guest. Parser de resultados nativos ahora exige `showthread.php?t=\d+`, ignora anclas numéricas/paginación y deduplica por URL; se reactivó `searchForumLabel` para filtrar al subforo correcto y se añade `snippet` cuando está presente.

### 2026-01-08

- ✨ Búsqueda nativa DescargasDD: Implementado flujo `search.php?search_type=1` con obtención del `searchid` vía FlareSolverr y paginación por `page=`.
- 🛠️ Parsing de resultados nativos: Extracción de `showthread` con título completo, foro (línea "Foros:") y fecha del último mensaje (línea "Último mensaje:"). Deduplicación por URL.
- 🧭 Sesión FlareSolverr: Se crea sesión temporal para mantener estado/cookies durante la generación del `searchid`; destrucción al finalizar.
- 📄 Documentación: Añadida esta entrada al changelog y referencia en Configuración de foros para usar `searchMode = native` con `searchPath = /search.php`.

### 2026-01-07

- ✅ Reorganización completa de ARCHITECTURE.md con nueva estructura
- ✅ Separación clara: Características | Changelog | Roadmap | Limitaciones
- ✅ TODO consolidado en ROADMAP (eliminadas tareas dispersas)
- ✅ Verificado cambio de idioma (es/en) en UI de foros
- 🛠️ Fix TTL FlareSolverr: Persistencia corregida (minutos→milisegundos) en POST/PUT; UI ajustada con step=1 y rango 5–1440 min; la tabla muestra la duración correcta en minutos/horas.
- ✨ Búsqueda CSE con paginación: API acepta `page`, `fetchAll` y `maxPages`; UI añade "Mostrar más" y "Cargar todos" que agregan resultados sin resetear.
- 🛠️ Parsing CSE mejorado: El parser cambia de regex a selectores cheerio (`.gsc-result .gs-title a`) usando `data-ctorig` cuando está disponible. Esto evita duplicados entre páginas y hace que la paginación muestre resultados distintos cuando los hay; además se fuerza paginación con `start`/`num` en la URL para obtener páginas diferentes desde servidor.

### 2026-01-06

**Interfaz de Foros en Tabla**:

- ✅ Reemplazada vista de tarjetas por tabla responsive
- ✅ Columnas: Foro | URL | Estado | Sesión FlareSolverr | Duración | Acciones
- ✅ Estado de sesión en tiempo real (refresh cada 30s)
- ✅ TTL en formato legible (30 min, 1h 30m, 2h)
- ✅ Tooltips con detalles de sesión (ID, edad, tiempo restante)

**Extracción de Metadatos**:

- ✅ Endpoint `POST /api/testing/metadata`
- ✅ Heurísticas mejoradas: temporadas (T1, Temporada 1ª), decimales en tamaño
- ✅ Integración con IA para enriquecimiento
- ✅ Reutilización de cookies para velocidad

**Correcciones Next.js 15**:

- ✅ `await params` en todas las rutas dinámicas
- ✅ Archivos corregidos: `forums/[id]/session/route.ts`

**Limpieza de Sesiones FlareSolverr**:

- ✅ SessionManager ahora destruye sesiones en FlareSolverr (no solo en memoria)
- ✅ Cleanup task cada 5 minutos con logging detallado
- ✅ Solución a procesos Chromium huérfanos

### 2026-01-05

**Testing: Logs dedicados y reutilización de cookies**:

- ✅ Nuevo módulo 'testing' en logger → `logs/testing.log`
- ✅ Todos los logs de testing van a archivo (no stdout)
- ✅ Reutilización automática de cookies tras primer fetch
- ✅ Reducción ~95% en tiempo (30s → 1s) tras primera ejecución

**Sistema de semáforos (bypass) y resolución bulk**:

- ✅ Tabla `TestingSettings` con flag `bypassAxios`
- ✅ Endpoint `GET/PATCH /api/testing/settings`
- ✅ Nuevo endpoint `POST /api/testing/titles` (bulk)
- ✅ UI: Checkbox en Testing para bypass
- ✅ Hook `useBulkTitles()` para resolver múltiples títulos

**Google CSE: Implementación del parsing**:

- ✅ Parsing robusto de resultados Google CSE
- ✅ Regex para extraer enlaces `showthread`
- ✅ Conversión de URLs relativas a absolutas
- ✅ Logging detallado de cada match
- ✅ Deduplicación de resultados

### 2025-12-22

**CookieJar persistente**:

- ✅ `src/lib/cookie-jar-store.ts` - CookieJar en memoria por dominio
- ✅ Conserva `cf_clearance` y cookies de sesión entre peticiones
- ✅ Reutilización en endpoints de título y extracción de enlaces
- ✅ Fusión de cookies tras FlareSolverr (persiste en BD + jar)

**Endpoint de título optimizado**:

- ✅ Intenta axios + CookieJar primero
- ✅ Si 403/challenge → FlareSolverr una vez
- ✅ Fusiona cookies y reintenta
- ✅ Persistencia de User-Agent junto a cookies

**Cliente FlareSolverr mejorado**:

- ✅ Timeout ampliado
- ✅ Reintento automático en caso de timeout

### 2025-12-21

**Persistencia de User-Agent**:

- ✅ Guardado de `userAgent` junto con cookies en `persistentCookies`
- ✅ Formato JSON: `{ cookies: [...], userAgent: "..." }`
- ✅ Axios aplica User-Agent persistido al reutilizar cookies

**Extracción de botón "Gracias"**:

- ✅ Regex anclada a `p={postId}` específico
- ✅ Soporte para `&amp;` en HTML
- ✅ Logs de debugging cuando no se encuentra

**Envío a JDownloader desde Testing**:

- ✅ Endpoint `POST /api/testing/jdownloader/add-links`
- ✅ Botón "Enviar a JDownloader" por tarjeta
- ✅ Usa `packageName` del título del post

**Indexer *arr (Torznab/Newznab)**:

- ✅ Ruta unificada `GET /api/arr?t=caps|search|tvsearch|movie|get`
- ✅ Compatible con Sonarr/Radarr/Lidarr
- ✅ Capacidades: búsqueda TV, películas
- ✅ Variantes de query para castellano

### 2025-12-20

**Sistema de Autenticación completo**:

- ✅ Setup inicial, login, logout
- ✅ JWT tokens + bcrypt
- ✅ Middleware de protección (Edge Runtime compatible)
- ✅ Gestión de usuarios (CRUD, solo admin)
- ✅ Preferencias de usuario (idioma, tema)
- ✅ Sistema de roles (Admin/User)

**Sistema i18n**:

- ✅ Español e inglés
- ✅ Hook `useI18n()`
- ✅ Archivos JSON por idioma

**Rebranding**:

- ✅ Sweaterr → Blazarr
- ✅ Logos y favicons

### 2025-12-19

**Fixes críticos UI y Resume/Pause**:

- ✅ Pausar/Reanudar con parámetros correctos
- ✅ DeleteFiles funcionando
- ✅ UI mejorada (botones dinámicos según estado)
- ✅ URL visible en drawer

**Fix setDownloadDirectory - Query Params**:

- ✅ Cambio de ruta usa query params correctamente
- ✅ Persiste cambios sin reseteo

**Fix Auto-Refresh**:

- ✅ Flag `isEditingPath` para evitar sobrescritura
- ✅ Auto-refresh respeta edición manual

### 2025-12-18

**MyJDownloader Cloud API**:

- ✅ Autenticación oficial con handshake AES/HMAC
- ✅ Construcción correcta de URL dispositivo
- ✅ Estructura `jdData` correcta
- ✅ Content-Type: `application/aesjson`

**Sistema de Edición Completo**:

- ✅ ARR Config: Modal edición + clipboard fallback
- ✅ JDownloader Config: Toggle enabled funcional
- ✅ AI Config: PUT en lugar de PATCH
- ✅ Downloads Status: Guard para modo local

**Bug: Toggle JDownloader No Funcionaba**:

- ✅ Detección de toggle vs edición completa
- ✅ Logs añadidos para debugging
- ✅ Refetch automático tras toggle

**HTTP 400 Polling Error - JDownloader Local API**:

- ✅ Skip polling en modo local (API no soporta `getStatus()`)
- ✅ Consola sin errores 400 recurrentes

### 2025-12-17

**Handshake oficial MyJDownloader**:

- ✅ loginSecret/deviceSecret (SHA256)
- ✅ HMAC-SHA256 signature
- ✅ Endpoints `/my/connect` y `/t_<deviceId>_<sessiontoken>/...`

**API local (RemoteAPI Deprecated)**:

- ✅ Puerto 3128 confirmado funcional
- ✅ `POST /linkgrabberv2/addLinks` operativo

### 2025-12-16

**PUT/DELETE endpoints foros**:

- ✅ Endpoint PUT sin duplicación
- ✅ Endpoint DELETE con cascade

**Validación dual autenticación**:

- ✅ HTML parsing + session cookies
- ✅ Detección de contraseñas incorrectas

**Pestaña Testing/Emulación**:

- ✅ Búsqueda en foros
- ✅ Extracción de enlaces
- ✅ Click "Gracias"
- ✅ 10+ hostings soportados

**Sistema Múltiples Instancias**:

- ✅ JDownloader e IA refactorizados
- ✅ Patrón *arr aplicado
- ✅ Toggle enable/disable
- ✅ Fix Next.js 15: `await params`

### 2025-12-15

**Integración inicial FlareSolverr**:

- ✅ Cliente básico
- ✅ Bug fix: `request.get`/`request.post`
- ✅ Campo `response` para HTML

---

## 🧩 DECISIONES TÉCNICAS Y RAZONES

### ¿Por qué FlareSolverr en lugar de Playwright?

**Decisión**: FlareSolverr como solución principal, Playwright solo como fallback legacy.

**Razones**:

- Playwright falla con Turnstile (infinite loop documentado)
- FlareSolverr usa navegadores reales con perfiles persistentes
- Evita detección de headless
- Mantenido activamente por comunidad Sonarr/Radarr
- Soporte para sesiones persistentes (reduce latencia ~95%)

### ¿Por qué Next.js API Routes en lugar de backend separado?

**Decisión**: Monolito Next.js con App Router.

**Razones**:

- **Simplicidad**: Un solo build, un solo deployment
- **TypeScript end-to-end**: Tipos compartidos frontend/backend
- **Server-side rendering**: Opción de SSR si se necesita
- **Menos infraestructura**: No requiere orquestación de microservicios

**Contras conocidos**:

- Escalabilidad limitada (no es problema para uso personal/familiar)
- Más difícil separar backend si se necesita en futuro

### ¿Por qué SQLite y no PostgreSQL?

**Decisión**: SQLite en desarrollo, migración a PostgreSQL en producción.

**Razones SQLite**:

- Portabilidad: DB es un solo archivo
- Suficiente para desarrollo y uso personal
- Sin setup de servidor de BD
- Prisma soporta ambos (migración fácil)

**Plan futuro**:

- Producción → PostgreSQL para mejor concurrencia
- Respaldos más robustos
- Mejor performance con múltiples usuarios

### ¿Por qué no reusar sesiones del navegador directamente?

**Decisión**: API headless con FlareSolverr.

**Razones**:

- **Automatización**: Integraciones *arr requieren API
- **Escalabilidad**: Búsquedas paralelas sin interferencia
- **Cookies persistentes**: Implementado para velocidad
- **Testing**: Emular flujos sin navegador real

### ¿Por qué JWT en lugar de sesiones de servidor?

**Decisión**: JWT tokens con 7 días de validez.

**Razones**:

- Stateless: No requiere almacenamiento de sesiones
- Compatible con Edge Runtime de Next.js
- Escalable horizontalmente
- Logout funciona limpiando cookie client-side

**Contras conocidos**:

- No se pueden invalidar tokens antes de expiración (mitigado con TTL corto)

---

## 🚀 ROADMAP

### Features futuras (aún no implementadas)

#### 1. Detección de Idiomas Mejorada

**Estado**: ⏭️ Pendiente  
**Estimación**: 2-3 horas

**Problema**: Regex no detecta abreviaturas (Jap, Esp) ni formatos con slash.

**Solución recomendada**: Híbrido (regex mejorado + IA fallback)

**Tareas**:

- [ ] Mejorar regex para abreviaturas
- [ ] Detectar formatos con slash (Audio1/Audio2)
- [ ] Usar IA como fallback
- [ ] Tests con ejemplos conocidos

**Archivos afectados**:

- `src/app/api/testing/metadata/route.ts`

#### 2. Tablas Dinámicas Series vs Películas

**Estado**: ⏭️ Pendiente  
**Estimación**: 1-2 horas

**Problema**: Tabla mezcla series y películas con columnas que no aplican a ambos.

**Solución recomendada**: Select para filtrar por tipo en búsqueda.

**Tareas**:

- [ ] Agregar Select en `search-tester.tsx`
- [ ] Renderizar columnas dinámicas según tipo
- [ ] Filtrado opcional en API

**Archivos afectados**:

- `src/components/testing/search-tester.tsx`
- `src/components/testing/result-viewer.tsx`

#### 3. Documentación de Selectores CSS

**Estado**: ⏭️ Pendiente  
**Estimación**: 2-3 horas

**Tareas**:

- [ ] Wiki con ejemplos de selectores por foro
- [ ] Fallbacks por defecto en código
- [ ] Tabla de referencia en este documento
- [ ] Validación de selectores CSS en UI

### Futuro (Ideas/Exploración)

### Gestión Avanzada de Subforos

- **Toggle búsqueda en subforos**: Campo `searchInChildForums` (boolean) en configuración del foro para controlar si se busca en subforos hijos (`childforums=1`) o solo en el foro seleccionado (`childforums=0`).
- **Múltiples subforos simultáneos**: Permitir seleccionar varios subforos en la configuración del foro (array de IDs/etiquetas) para realizar búsquedas en múltiples áreas a la vez.
- **Listado de subforos disponibles**: Endpoint que analice el formulario de búsqueda del foro y extraiga los subforos disponibles con sus IDs/nombres.
- **UI de selección de subforos**: Componente con checkboxes para cada subforo disponible, permitiendo selección múltiple.
- **Integración con *arr**: Exponer la configuración de subforos a través del endpoint Torznab (`/api/arr`) para que Sonarr/Radarr/Lidarr realicen búsquedas en los subforos configurados.
- **Prioridad de subforos**: Sistema de ranking/orden para subforos según velocidad, calidad o preferencia del usuario.

- **UI de configuración de selectores**: Editor visual para testear selectores CSS en tiempo real
- ✨ **Metadatos optimizados para búsqueda nativa**: El endpoint `/api/testing/metadata` ahora acepta `directTitles` (array con `{url, title, snippet}`) para parsear metadatos directamente del título completo sin necesidad de fetch. Esto aprovecha que la búsqueda nativa ya devuelve títulos completos, eliminando ~95% del tiempo de procesamiento.
- 🛠️ Modo directo vs fetch: El endpoint detecta automáticamente si debe usar modo directo (título ya disponible) o modo legacy (fetch del thread). Retorna `mode: 'direct'` o `mode: 'fetch'` en la respuesta, junto con `totalResults`.
- 🛠️ **UI de Testing**: Cuando el foro está en modo de búsqueda `native`, el tester envía `directTitles` y fuerza modo directo. Para `google_site`/`google_cse`, usa el modo legacy con `postUrls`. Ahora muestra tiempo de extracción de metadatos y modo usado.
- 🛠️ **Filtro 'Buscar solo en título'**: Añadido checkbox en el tester que controla `titleonly` en la búsqueda nativa (POST `search.php`) y aplica `intitle:` en Google Site Search. Permite limitar resultados a coincidencias en el título.
- ✨ **Selección de foro por defecto**: El tester de búsqueda selecciona automáticamente el primer foro configurado al cargar, evitando estados en blanco.
- 🐛 **Fix extracción de temporada**: Regex de `extractSeason()` reordenado para priorizar patrones ordinales ("15ª Temporada") sobre patrones genéricos, evitando detección incorrecta (antes "15ª Temporada" se detectaba como T3, ahora T15).
- ✨ **Métricas de rendimiento**: La UI muestra el tiempo de extracción de metadatos (en ms), el modo usado (direct/fetch) y el total de resultados procesados junto al contador de resultados.
- 📋 **ROADMAP**: Añadida sección "Gestión Avanzada de Subforos" con tareas para toggle `searchInChildForums`, selección múltiple de subforos, UI con checkboxes, listado automático de subforos disponibles e integración con endpoint Torznab para *arr.
- **Multi-foro simultáneo**: Buscar en todos los foros configurados en paralelo
- **Sistema de prioridades**: Ranking de foros según velocidad/disponibilidad
- **Caché de búsquedas**: Redis para resultados recientes
- **Docker-compose completo**: Incluir FlareSolverr, JDownloader, Radarr/Sonarr
- **Notificaciones**: Discord/Telegram cuando descarga completa
- **Panel de estadísticas**: Dashboards con métricas de uso

---

## 🐞 ISSUES

No hay issues activos relacionados con TTL FlareSolverr; el problema de persistencia y el control de input se han resuelto el 2026-01-07 (ver CHANGELOG).

### 2. Procesos Chromium Acumulándose - FlareSolverr

**Problema**: SessionManager cleanup no destruye sesiones correctamente, dejando procesos huérfanos.

**Tareas**:

- [ ] Agregar logging detallado en cleanup task
- [ ] Validar ejecución de `destroySession()`
- [ ] Crear endpoint `/api/config/forums/sessions/status` para diagnóstico
- [ ] UI de debug para ver sesiones activas
- [ ] Verificar TTL consistency entre manager y BD

### 3. Verificar Selectores CSS en Extracción

**Problema**: No está claro si selectores configurados en UI se usan realmente en extracción.

**Tareas**:

- [ ] Verificar que `extract-links/route.ts` pasa selectores al extractor
- [ ] Agregar logs "Using selector: {selector}"
- [ ] Si falta implementación, agregar parámetros
- [ ] Documentar flujo de selectores en este archivo

### 4. Passwords en Texto Plano

**Estado**: ⏭️ Pendiente

**Riesgo**: Exposición de credenciales si la base de datos es comprometida.

**Tareas**:

- [ ] Encriptar antes de guardar (bcrypt/crypto)
- [ ] Validar compatibilidad con login actual

### 5. Sin Rate Limiting

**Estado**: ⏭️ Pendiente

**Riesgo**: Ban en foros por exceso de requests.

**Tareas**:

- [ ] Implementar throttling en `cloudflare-handler.ts`
- [ ] Añadir configuración por foro (opcional)

### 6. Sin Manejo de Timeouts Largos

**Estado**: ⏭️ Pendiente

**Impacto**: UI se cuelga ~30s en test de conexión inicial.

**Tareas**:

- [ ] Añadir feedback visual/no-blocking (spinner + estado)
- [ ] Considerar WebSocket para updates en vivo

### 7. Selectores CSS Hardcodeados

**Estado**: ⏭️ Pendiente

**Riesgo**: Si el foro cambia HTML, selectores fallan.

**Tareas**:

- [ ] Editor visual o validación de selectores
- [ ] Fallbacks inteligentes en extractor

### 8. Sin Tests Unitarios

**Estado**: ⏭️ Pendiente

**Riesgo**: Regresiones en refactors.

**Tareas**:

- [ ] Configurar Jest + React Testing Library
- [ ] Cubrir flujos críticos (auth, extractor, JD)

---

## ⚠️ PROBLEMAS CONOCIDOS Y LIMITACIONES

Estos no tienen solución viable con el stack actual; si aparece una, mover a ISSUES.

### 1. API Local JDownloader Sin Polling

**Severidad**: Baja  
**Estado**: Documentado como limitación

**Descripción**: API local (puerto 3128) no soporta consulta de estado de descargas.

**Impacto**: No se puede mostrar progreso en tiempo real en modo local.

**Mitigación**: Usar modo MyJDownloader para polling.

**Sin solución**: API deprecated, no se actualizará.

### 2. Google CSE Pagination con FlareSolverr

**Severidad**: Media  
**Estado**: Sin solución actual

**Descripción**: Google CSE usa navegación basada en JavaScript con hash (`#gsc.page=2`). FlareSolverr renderiza la página pero no siempre ejecuta el JavaScript de paginación completamente, devolviendo el HTML de página 1 incluso cuando se solicita página 2.

**Impacto**: La búsqueda con "Mostrar más" devuelve los mismos resultados repetidamente, sin avanzar a nuevas páginas. Afecta solo a modo `google_cse`.

**Causa raíz**:

- Google CSE requiere que el navegador ejecute JavaScript para procesar el evento de cambio de página
- FlareSolverr ejecuta JavaScript pero podría no esperar lo suficiente o perder el estado JS entre requests
- El hash URL (`#gsc.page=N`) es solo para navegación cliente; no hay parámetros servidor que fuercen cambio de página en Google CSE

**Mitigación actual**:

- Logs detectan si no hay nuevos resultados únicos en la página ("pagination halted")
- El sistema deduplica resultados entre páginas para evitar mostrar duplicados

**Mejora pendiente**:

- Aumentar timeout de FlareSolverr o investigar wait strategies para JavaScript rendering
- Considerar `google_site` como alternativa (más lenta pero sin paginación JS)

### 3. Cloudflare Turnstile en Threads Específicos

**Severidad**: Media  
**Estado**: Mitigado con CookieJar y detección

**Descripción**: DescargasDD requiere resolver Turnstile en CADA thread (`/showthread.php`), incluso con cookies válidas.

**Impacto**: Cada thread requiere FlareSolverr (~15s), cookies no sirven.

**Mitigación actual**:

- CookieJar reutiliza cookies para búsquedas (`/search.php`)
- Detección de URLs thread → FlareSolverr directo (ahorra timeout de 20s)

**Mejora pendiente**: Cache de respuestas FlareSolverr o configurar FlareSolverr con VPN para evitar bloqueos regionales.

---

### FIN DEL DOCUMENTO

**Versión**: 1.4.0 (09/01/2026)  
**Estado**: En desarrollo activo  
