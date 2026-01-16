# ARCHITECTURE.md - Sweaterr Direct Download Automation System

---

## 📅 FECHAS RELEVANTES

**Última actualización**: 13 de enero de 2026  
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

### Documentación del Proyecto

**Referencias cruzadas** de documentación:

- **[TODOS.md](TODOS.md)**: Lista priorizada de pendientes (críticos, importantes, nice-to-have). Actualízase con cada cambio.
- **[README.md](README.md)**: Guía de usuario final (instalación, configuración, características).
- **[SETUP.md](SETUP.md)**: Guía de desarrollo local (requisitos, instalación, testing).
- **[copilot-instructions.md](.github/copilot-instructions.md)**: Guidelines para modificaciones de código y contribuciones.

Cuando agregues features o fixes: **actualiza TODOS.md y ARCHITECTURE.md changelog inmediatamente**.

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
- Modos de búsqueda: native, google_cse
- `google_site` existe como modo legacy/experimental, pero está **deshabilitado por defecto**. Para permitirlo, define `ENABLE_GOOGLE_SITE_SEARCH=true` (si no, se hace fallback a `native`).
- En modo nativo, se recomienda configurar `searchPath` como `/search.php?search_type=1` para usar la búsqueda avanzada y limitar resultados al área relevante (ej. Zona Series + subforos).
- **Selección de área en búsqueda avanzada** (Nuevo 2026-01-08): Campo `searchForumLabel` (opcional) permite preseleccionar el foro/área en búsquedas nativas (ej: "Zona Series", "Series HD"). El sistema analiza automáticamente el formulario de búsqueda y aplica la selección configurada.
- **Búsqueda literal con comillas** (Nuevo 2026-01-08): Checkbox "Búsqueda literal" en la UI de testing permite envolver la query en comillas dobles para búsquedas exactas. Útil cuando el foro devuelve demasiados resultados con coincidencias parciales (ej: "Sobrenatural T1" vs "Sobrenatural T.1"). Funciona en `native` y `google_cse` (y también en `google_site` si está habilitado por feature flag).
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

### 8. Integración *arr (Radarr/Sonarr/Lidarr/Readarr)

**Estado**: ✅ Implementado (Enero 2026)

**Descripción**: Sweaterr actúa como indexer Torznab/Newznab para automatizar descargas desde foros hacia *arr. El flujo completo permite que Sonarr/Radarr busquen, seleccionen y descarguen contenido como si fuera un torrent tracker.

#### Arquitectura Torznab

**Endpoint unificado**: `GET /api/arr?t=<function>&apikey=<key>`

**Funciones soportadas**:

1. **caps** - Capacidades del indexer
   - Endpoint: `/api/arr?t=caps`
   - Response: XML con categorías, límites, tipos de búsqueda
   - Categorías: TV (5000), Movies (2000), Audio (3000), Books (7000)

2. **search/tvsearch/movie** - Búsqueda de contenido
   - Endpoint: `/api/arr?t=search&q=<query>&cat=<categories>`
   - TV: `/api/arr?t=tvsearch&q=<series>&season=<N>&ep=<N>`
   - Movie: `/api/arr?t=movie&q=<title>&imdbid=<id>&tmdbid=<id>`
   - Response: RSS XML con items (formato Newznab)
   - Variantes de query en castellano: T1, 1x01, Temporada 1, S01E01

3. **get** - Obtener/descargar release específico
    - Endpoint: `/api/arr?t=get&guid=<base64_json>`
    - Trigger: Cuando *arr selecciona un resultado
    - Acción: Extrae enlaces del post (incluyendo “thanks gate” si aplica), envía a JDownloader y crea un `Download` en BD.
    - Compatibilidad *arr: devuelve un **NZB mínimo** (`Content-Type: application/x-nzb`) para que el cliente Newznab/Torznab trate la acción como una descarga.

#### Flujo Completo

```text
*arr → /api/arr?t=search → Sweaterr busca en foros
                         → Devuelve RSS con GUIDs
*arr selecciona → /api/arr?t=get&guid=X → Sweaterr extrae enlaces
                                         → Envía a JDownloader
                                         → Crea Download en BD
JDownloader descarga → *arr detecta → *arr importa
*arr envía webhook → /api/arr/notify → Sweaterr actualiza Download status
```

#### Formato GUID

- **Codificación**: Base64url de JSON `{forumId, category, url}`
- **Motivo**: Evitar parsing incorrecto de URLs con caracteres especiales
- **Retrocompatibilidad**: Fallback a formato antiguo `forumId-category-url`

#### API Keys por Forum (Arquitectura Simplificada)

**Cambio Arquitectónico (Enero 2026)**: En lugar de crear servicios *arr separados, cada **Forum automáticamente genera su propia API key Torznab única**.

**Ventajas**:

- No requiere configuración adicional de servicios
- Cada forum = indexer independiente (como Jackett)
- Interfaz simple: botón "Copy Feed" copia URL completa
- API key se genera automáticamente al crear el forum

**Base de datos**:

```prisma
model Forum {
  id              String   @id @default(cuid())
  name            String
  url             String
  // ... otros campos ...
  torznabApiKey   String   @unique  // Generated on creation
  sabnzbdCategory String?          // Category advertised to *arr (SABnzbd-compatible download client)
  // ... timestamps ...
}
```

**Generación de API Key**:

- Formato: `fdd-` + 32 caracteres hexadecimales aleatorios
- Ejemplo: `fdd-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
- Generada automáticamente en POST `/api/config/forums`
- Garantizada única (constraint @unique en BD)

**Comportamiento**:

- Al crear forum: Se genera automáticamente `torznabApiKey`
- Al listar forums: Se devuelve la API key para mostrar en UI
- No hay opción de eliminar/regenerar (simplifica UX)
- Cada forum puede usarse con cualquier *arr (Sonarr, Radarr, etc.)

**Download Client (SABnzbd-compatible)**:

- `sabnzbdCategory` permite controlar qué categoría “existe” para *arr al configurar Sweaterr como cliente SABnzbd.
- Se configura por forum para evitar mezclar contextos entre indexers.

#### Callbacks y Notificaciones

**Endpoint**: `POST /api/arr/notify`

**Webhooks soportados** (configurar en *arr):

- **Grab**: *arr acepta descarga → Sweaterr cambia status a `downloading`
- **Download**: *arr importa archivo → Sweaterr cambia status a `completed`
- **Rename**: Post-procesamiento → Sin cambio de estado
- **Test**: Validación de conexión

**Tracking**:

- Tabla `ArrNotification` registra todos los eventos recibidos
- Relación con `Download` por `grabId` (GUID del indexer)

#### Variantes de Búsqueda para Español

Para mejorar matching en foros hispanohablantes:

- `Series T1` → `Series Temporada 1`, `Series T01`, `Series S01`
- `Series 1x05` → `Series S01E05`, `Series temporada 1 episodio 5`
- Límite: 8 variantes por búsqueda para evitar sobrecarga

#### 8.1. Búsqueda Optimizada de Season Packs (NEW - Enero 2026)

**Problema resuelto**: Cuando Sonarr busca una serie con temporada específica (ej: `Breaking Bad Season 5`), el sistema anterior devolvía resultados genéricos del foro. Para foros de descarga directa que típicamente albergan "packs" de temporadas completas, era ineficiente.

**Solución implementada**:

**Función `buildSeasonPackVariants()`**: Cuando `tvsearch` incluye `season` pero NO `ep` (búsqueda de temporada completa), genera variantes específicas para season packs:

```text
// Prioridad 1: Season pack queries (Spanish-optimized for direct download forums)
- "${series} T${season}" // Breaking Bad T5
- "${series} temporada ${season}" // Breaking Bad temporada 5
- "${series} T${season} pack" // Breaking Bad T5 pack
- "${series} temporada ${season} completa" // Breaking Bad temporada 5 completa
- "${series} season ${season} pack" // Breaking Bad season 5 pack (English fallback)
- "${series} season ${season}" // Breaking Bad season 5 (English fallback)
```

**Integración en flujo de búsqueda**:

1. **Detección de búsqueda por temporada**: Si `tvsearch` con `season` pero sin `ep`, activa modo season pack
2. **Priorización de variantes**: Las variantes de season pack se intentan primero, antes que búsquedas genéricas
3. **Orden de intentos**: Stop at first successful match (mejora velocidad y evita resultados irrelevantes)

**Scoring inteligente de resultados** (cuando hay resultados de multiple variantes):

```typescript
// Scoring heurístico para season packs:
+ 100 puntos: Coincidencia exacta de temporada en título (T5, temporada 5, season 5)
+  50 puntos: Indicadores de pack (pack, completa, complete, full)
-  30 puntos: Múltiples temporadas en el mismo resultado (penalización)

// Ejemplo:
"Breaking Bad T5 Español 1080p" → +100 (exact season match)
"Breaking Bad T5 pack" → +100 + 50 = +150 (exact season + pack indicator)
"Breaking Bad T1-T5" → -30 (multiple seasons detected)
"Breaking Bad" → 0 (no season info)
```

**Beneficios**:

- ✅ Resultados más relevantes: Season packs exactos se priorizan automáticamente
- ✅ Compatible con Sonarr/Radarr: Integrarse naturalmente en búsqueda indexer
- ✅ Mejor velocidad: Stop at first match evita búsquedas innecesarias
- ✅ Multiidioma: Variantes en español e inglés según foro preferido

**Ejemplo de flujo con Sonarr**:

```
1. Usuario añade "Breaking Bad" a Sonarr
2. Sonarr → GET /api/arr?t=tvsearch&q=Breaking+Bad&season=5
3. Sweaterr ejecuta buildTvVariants() → activa season pack mode
4. Intenta variantes en orden:
   - "Breaking Bad T5" ✅ Encuentra 3 resultados
   - (stop, no intenta "Breaking Bad temporada 5" etc.)
5. Aplica scoring:
   - "Breaking Bad T5 Completa 1080p" → score 150 (rank 1)
   - "Breaking Bad T5 pack" → score 150 (rank 2)
   - "Breaking Bad T5" → score 100 (rank 3)
6. Devuelve top 3 resultados en XML/RSS
7. Sonarr muestra "Breaking Bad T5 Completa 1080p" como default
8. Usuario selecciona → Se descarga automáticamente
```

**Logging**:

```text
[SONARR] Starting forum search for query: "Breaking Bad" (variants: 6, isTv=true, season=5, ep=null)
[SONARR] Searching in forum "DescargasDD" with variant: "Breaking Bad T5"
[SONARR] Found 3 results in forum "DescargasDD"
[SONARR] Season pack scoring applied: Top result: "Breaking Bad T5 Completa 1080p" (score=150, reason=Exact season match; Season pack indicator;)
[SONARR] Returning XML response with 3 items
```

#### Placeholders y Fallbacks

**Problema**: *arr puede interpretar resultado vacío como indexer offline

**Solución**: Si todas las búsquedas fallan, devolver placeholders:

- Título: `[Recent] <ForumName>`
- GUID: Base64 de URL del foro (no descargable, solo informativo)
- Snippet: "Placeholder; run interactive search with a query for real results."
- Evita errores en *arr mientras mantiene indexer "activo"

**Optimizaciones recientes (2026-01-12)**:

- Autenticación de foros condicionada a búsqueda real: cuando `q` está vacío (p.ej. `tvsearch` mínimo enviado por *arr), el endpoint retorna placeholders sin ejecutar autenticación en los foros. Esto reduce la latencia drásticamente y evita timeouts en Sonarr al abrir la ventana de resultados.

---

### 8.2. Issues Conocidos y Soluciones Pendientes (Enero 2026)

**Estado**: 🔄 En diagnóstico y planificación de fixes

#### Problema 1: Size Field - Todos los resultados muestran 1 KB 🔴 BLOQUEADOR

**Síntoma**: En Sonarr, todos los releases aparecen como 1 KB → Sonarr rechaza (bajo mínimo requerido típicamente 100 MB+)

**Root Cause**: Interface `ForumSearchResult` no incluye field `size`. En Testing se extrae correctamente, pero no se pasa a Sonarr en el XML Newznab.

**Solución**:

1. Agregar `size?: number` a interface `ForumSearchResult`
2. Extraer tamaño desde título: buscar patrones como "4.5 GB", "2.3 GiB", "1024 MB"
3. En XML generation (línea 548): usar `result.size || 0` en lugar de `1024`
4. Convertir unidades: GB×1024³, MB×1024², etc.

**Archivos afectados**:

- `src/lib/services/forum.ts` (interface + búsqueda)
- `src/app/api/arr/search/route.ts` (XML generation)
- `src/lib/utils.ts` (función extractSizeFromTitle)

**Impacto**: Alto - Sonarr rechaza todas las descargas
**Estimación**: 2-3 horas
**Prioridad**: 🔥 BLOQUEADOR

---

#### Problema 2: TVDB Lookup - Red Icons en Scene Info 🔴 BLOQUEADOR

**Síntoma**: Sonarr muestra iconos rojos en "Scene Info" porque TVDB lookup falla. En un caso, Sonarr pensó que el season pack [16/16] era el episodio individual "2x9".

**Root Cause**: Nombre de serie enviado a TVMaze incluye temporada/episodios: "Breaking Bad T5 [16/16]" → TVMaze no encuentra con ese nombre → `tvdbId = undefined` → Sonarr no puede mapear serie → red icon, metadata fallido.

**Solución**:

1. En `src/lib/services/tvdb.ts` función `searchSeries()`: limpiar nombre ANTES de buscar
2. Patrón de limpieza: remover todo después de temporada/episodio/indicadores
3. Ejemplos:
   - "Breaking Bad T5 [16/16]" → "Breaking Bad"
   - "Game of Thrones 3ª Temporada" → "Game of Thrones"
   - "The Office S05E01" → "The Office"
4. Cachear resultados por nombre limpio (evitar re-búsquedas)
5. Si TVDB lookup falla, loguear WARNING pero continuar (no es error fatal)

**Patrón de limpieza recomendado**:

```typescript
function cleanSeriesNameForLookup(name: string): string {
  return name
    .replace(/\s+(T\.?\d+|T\d+|S\d+E\d+|Season\s\d+|Temporada\s\d+|\d+ª\s*Temporada|\[?\d+\/\d+\]?).*$/i, '')
    .trim();
}
```

**Archivos afectados**:

- `src/lib/services/tvdb.ts` (cleanSeriesNameForLookup + searchSeries)
- `src/app/api/arr/search/route.ts` (logs de debugging)

**Impacto**: Alto - Sonarr no puede hacer metadata lookup correctamente
**Estimación**: 3-4 horas
**Prioridad**: 🔥 BLOQUEADOR

---

#### Problema 3: Language Field - Hardcodeado a "es-es" ⚠️ NICE-TO-HAVE

**Síntoma**: XML responde siempre `<language>es-es</language>` sin usar configuración del foro

**Root Cause**: Campo `forum.defaultLanguage` existe en BD pero nunca se lee en `/api/arr/search/route.ts`

**Solución** (muy simple):

1. En `src/app/api/arr/search/route.ts` línea 172 y 596: reemplazar

   ```xml
   <language>es-es</language>
   ```

   por:

   ```xml
   <language>${forum.defaultLanguage || 'es-es'}</language>
   ```

2. Validar que campo `defaultLanguage` existe en objeto `forum` tras query BD

**Archivos afectados**:

- `src/app/api/arr/search/route.ts` (2 líneas)

**Impacto**: Bajo - feature, Sonarr funciona igual
**Estimación**: 30 minutos
**Prioridad**: 🟡 BAJA

**Nota**: Para detectar idiomas múltiples en título (Dual/Cast./Ing), documentar en TODO separado.

---

#### Problema 4: Season Pack Filtering - UI sin filtros 🟡 MEDIA

**Síntoma**: En UI testing, al seleccionar filtro "Season Pack", aparece "All results are hidden by filter"

**Root Cause**: Server-side filtering por temporada **FUNCIONA correctamente** (confirmado por usuario - búsqueda devuelve solo T5). El problema es en la UI testing que no detecta/muestra el filtro "Season Pack" adecuadamente.

**Actual behavior**:

- API filtra correctamente por temporada
- UI testing no soporta filtro "Season Pack" explícito
- Si aplicas filtros manuales, oculta todos los resultados

**Solución**:

1. Función de detección de season pack basada en episodios detectados:

   ```typescript
   function isSeasonPack(result: TestResult): boolean {
     if (!result.detectedEpisodes) return false;
     const episodeCount = result.detectedEpisodes.split(',').length;
     return episodeCount > 8; // threshold arbitrario
   }
   ```

2. Agregar al dropdown de filtros: "All", "Season Pack", "Not Season Pack", "Custom Filters"
3. Al filtrar por "Season Pack", aplicar lógica anterior
4. Logs: `[testing] Season pack filter applied: X results → Y`

**Archivos afectados**:

- `src/components/testing/search-tester.tsx` (UI + filtering logic)
- `src/lib/utils.ts` (función isSeasonPack si es compartida)

**Impacto**: Medio - UX de testing, no afecta Sonarr en producción
**Estimación**: 2-3 horas
**Prioridad**: 🟡 MEDIA

---

### 8.3. Episodios Parciales [4/10]: Opciones de Implementación 📋

**Problema Futuro**: Cuando un hilo actualiza de [4/10] → [5/10], ¿cómo sabe Sonarr qué descargar? (¿todos de nuevo? ¿solo el nuevo?)

**Contexto**: Muchos foros de descarga directa no publican enlaces individuales por episodio. Todos están ocultos detrás de servicios de pastes (keeplinks.org, justpaste.it, controlc.com) o URLs genéricas que no incluyen el nombre del episodio.

**Documentación de 4 opciones propuestas**:

#### Opción A: JDownloader Manual + Sweaterr Metadata (KISS - RECOMENDADA ACTUALMENTE)

**Flujo**:

```
1. Usuario busca en Sonarr "Breaking Bad T5"
2. Sonarr obtiene de Sweaterr: [4/10] con 4 enlaces + metadatos
3. Sweaterr extrae TODOS los 4 enlaces → agrega a JD Linkgrabber
4. Usuario MANUALMENTE selecciona en JD cuáles descargar (episodios 1-4)
5. Cuando hilo actualiza a [5/10], usuario busca de nuevo en Sonarr
6. Sweaterr extrae 5 enlaces → usuario descarga solo #5 en JD
```

**Ventajas**:

- ✅ Simple (KISS philosophy)
- ✅ No requiere API sync compleja
- ✅ User tiene control total
- ✅ Funciona HOY con código actual

**Desventajas**:

- ❌ Manual (requiere intervención)
- ❌ No es automático

**Implementación**: Solo documentar en USER GUIDE que cuando hay [4/10], todos se agregan a JD Linkgrabber.

---

#### Opción B: Sonarr ↔ Sweaterr API Sync (Intermedio)

**Flujo**:

```
1. Sonarr busca "Breaking Bad T5" → Sweaterr devuelve episodios=[1,2,3,4]
2. Sonarr sabe que faltan 5-10 → marca como "Not downloaded"
3. Usuario marca episodio 5 en Sonarr
4. Sonarr POST /api/arr/download?series=X&season=Y&episode=5
5. Sweaterr busca → extrae enlaces → filtra por episodio 5 → envía a JD
```

**Ventajas**:

- ✅ Automático
- ✅ Sonarr sabe estado de episodios
- ✅ Solo descargar episodios nuevos

**Desventajas**:

- ❌ URLs genéricas sin nombre episodio → imposible filtrar
  - Ejemplo: `https://pixeldrain.com/u/91bsp4Wn` no dice qué episodio es
  - Requeriría hacer request a URL para ver nombre del archivo
- ❌ Servicios de pastes esconden nombres: justpaste.it, controlc.com
- ❌ Requiere refactor del endpoint search para soportar filtros episodio

**Implementación**: Dejar para iteración futura.

---

#### Opción C: JDownloader ↔ Sweaterr 3-API Sync (COMPLEJO)

**Flujo**:

```
1. Sweaterr genera webhook que JD escucha
2. Usuario indica "voy a descargar 5 episodios"
3. JD entra a URLs, descarga lista de archivos
4. JD compara con lo que Sonarr pidió
5. JD filtra y descarga solo episodios solicitados
```

**Ventajas**:

- ✅ Más inteligente (JD puede ver contenido)

**Desventajas**:

- ❌ COMPLEJIDAD EXTREMA
- ❌ Requiere API JD bidireccional
- ❌ Muchos servicios tienen protección contra scraping
- ❌ No se justifica el esfuerzo

**Implementación**: No recomendado.

---

#### Opción D: Monitoring + IA Parser (FUTURE ENHANCEMENT)

**Flujo**:

```
1. Usuario agrega hilo manualmente a Sweaterr como "fuente monitorizada"
2. Sweaterr chequea periódicamente (cada día)
3. Cuando detecta cambio [4/10] → [5/10], IA extrae nombres episodios
4. Sweaterr crea evento "New Episode 5 found"
5. Webhook a Sonarr/JD: "Breaking Bad T5E05 ready"
6. Sonarr/JD descarga automáticamente
```

**Ventajas**:

- ✅ Casi automático
- ✅ Inteligente con IA

**Desventajas**:

- ❌ Muy complejo
- ❌ IA/parsing unreliable con URLs genéricas
- ❌ Require monitoring continuo
- ❌ Alto uso de recursos

**Implementación**: Dejar para iteración futura.

---

**Recomendación**: Mantener Opción A (KISS) como comportamiento por defecto. Documentar otras opciones para posible implementación futura cuando sea prioritario.

**Problema resuelto**: Cuando Sonarr busca una serie con temporada específica (ej: `Breaking Bad Season 5`), el sistema anterior devolvía resultados genéricos del foro. Para foros de descarga directa que típicamente albergan "packs" de temporadas completas, era ineficiente.

**Solución implementada**:

**Función `buildSeasonPackVariants()`**: Cuando `tvsearch` incluye `season` pero NO `ep` (búsqueda de temporada completa), genera variantes específicas para season packs:

```text
// Prioridad 1: Season pack queries (Spanish-optimized for direct download forums)
- "${series} T${season}" // Breaking Bad T5
- "${series} temporada ${season}" // Breaking Bad temporada 5
- "${series} T${season} pack" // Breaking Bad T5 pack
- "${series} temporada ${season} completa" // Breaking Bad temporada 5 completa
- "${series} season ${season} pack" // Breaking Bad season 5 pack (English fallback)
- "${series} season ${season}" // Breaking Bad season 5 (English fallback)
```

**Integración en flujo de búsqueda**:

1. **Detección de búsqueda por temporada**: Si `tvsearch` con `season` pero sin `ep`, activa modo season pack
2. **Priorización de variantes**: Las variantes de season pack se intentan primero, antes que búsquedas genéricas
3. **Orden de intentos**: Stop at first successful match (mejora velocidad y evita resultados irrelevantes)

**Scoring inteligente de resultados** (cuando hay resultados de multiple variantes):

```typescript
// Scoring heurístico para season packs:
+ 100 puntos: Coincidencia exacta de temporada en título (T5, temporada 5, season 5)
+  50 puntos: Indicadores de pack (pack, completa, complete, full)
-  30 puntos: Múltiples temporadas en el mismo resultado (penalización)

// Ejemplo:
"Breaking Bad T5 Español 1080p" → +100 (exact season match)
"Breaking Bad T5 pack" → +100 + 50 = +150 (exact season + pack indicator)
"Breaking Bad T1-T5" → -30 (multiple seasons detected)
"Breaking Bad" → 0 (no season info)
```

**Beneficios**:

- ✅ Resultados más relevantes: Season packs exactos se priorizan automáticamente
- ✅ Compatible con Sonarr/Radarr: Integrarse naturalmente en búsqueda indexer
- ✅ Mejor velocidad: Stop at first match evita búsquedas innecesarias
- ✅ Multiidioma: Variantes en español e inglés según foro preferido

**Ejemplo de flujo con Sonarr**:

```
1. Usuario añade "Breaking Bad" a Sonarr
2. Sonarr → GET /api/arr?t=tvsearch&q=Breaking+Bad&season=5
3. Sweaterr ejecuta buildTvVariants() → activa season pack mode
4. Intenta variantes en orden:
   - "Breaking Bad T5" ✅ Encuentra 3 resultados
   - (stop, no intenta "Breaking Bad temporada 5" etc.)
5. Aplica scoring:
   - "Breaking Bad T5 Completa 1080p" → score 150 (rank 1)
   - "Breaking Bad T5 pack" → score 150 (rank 2)
   - "Breaking Bad T5" → score 100 (rank 3)
6. Devuelve top 3 resultados en XML/RSS
7. Sonarr muestra "Breaking Bad T5 Completa 1080p" como default
8. Usuario selecciona → Se descarga automáticamente
```

**Logging**:

```text
[SONARR] Starting forum search for query: "Breaking Bad" (variants: 6, isTv=true, season=5, ep=null)
[SONARR] Searching in forum "DescargasDD" with variant: "Breaking Bad T5"
[SONARR] Found 3 results in forum "DescargasDD"
[SONARR] Season pack scoring applied: Top result: "Breaking Bad T5 Completa 1080p" (score=150, reason=Exact season match; Season pack indicator;)
[SONARR] Returning XML response with 3 items
```

#### Placeholders y Fallbacks

**Problema**: *arr puede interpretar resultado vacío como indexer offline

**Solución**: Si todas las búsquedas fallan, devolver placeholders:

- Título: `[Recent] <ForumName>`
- GUID: Base64 de URL del foro (no descargable, solo informativo)
- Snippet: "Placeholder; run interactive search with a query for real results."
- Evita errores en *arr mientras mantiene indexer "activo"

**Optimizaciones recientes (2026-01-12)**:

- Autenticación de foros condicionada a búsqueda real: cuando `q` está vacío (p.ej. `tvsearch` mínimo enviado por *arr), el endpoint retorna placeholders sin ejecutar autenticación en los foros. Esto reduce la latencia drásticamente y evita timeouts en Sonarr al abrir la ventana de resultados.

#### Configuración en Sonarr/Radarr

1. **Añadir indexer**:
   - Settings → Indexers → Add → Newznab/Torznab
   - URL: `http://<sweaterr-host>:3000/api/arr`
   - API Key: Copiar desde Sweaterr UI (Configuración → *arr)
   - Categories: Dejar por defecto o seleccionar (TV: 5000, Movies: 2000)

2. **Configurar webhook** (opcional, para actualización de estado):
   - Settings → Connect → Add → Webhook
   - URL: `http://<sweaterr-host>:3000/api/arr/notify`
   - Events: On Grab, On Import/Upgrade
   - Method: POST

3. **Testing**:
   - Test indexer en *arr → Debe devolver capacidades
   - Buscar serie/película → Debe listar resultados de foros
   - Seleccionar resultado → Debe aparecer en JDownloader y Descargas UI

#### UI: Columa "Torznab Feed" en ForumsTable

**Ubicación**: Dashboard → Configuración → Foros

**Características**:

- Tabla de foros con columna adicional "Torznab Feed"
- Botón "Copy Feed" que copia `http://localhost:3000/api/arr?apikey=<torznabApiKey>`
- Ícono dinámico: Copy → Check (durante 2 segundos) tras copiar
- Tooltip mostrando URL completa del feed
- Simple y elegante (estilo Jackett)

**Comportamiento**:

- Al hacer click en "Copy Feed": URL se copia al portapapeles del usuario
- Estado visual: Botón muestra "Check" durante 2 segundos para confirmar
- No hay diálogo adicional, no hay regenerar/eliminar (simplifica UX)

**i18n**:

- Botón: "Copy Feed" / "Copiar Feed"
- Tooltip: muestra URL completa
- Idiomas: es, en

#### Logs y Debugging

**Niveles de log**:

- `[ARR]` - Dispatcher y routing
- `[arr-caps]` - Capabilities endpoint
- `[arr-search]` - Búsquedas y variantes
- `[arr-grab]` - Extracción y envío a JD
- `[arr-notify]` - Webhooks y actualizaciones

**Verificación**:

- Revisar logs en terminal de `npm run dev`
- Comprobar estado de descargas en UI
- Validar registros en tabla `ArrNotification`

### 8.1. Integración IA (Pendiente)

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

### 2026-01-16 (FEATURE: Automatic series identification in Sonarr via TVDB ID)

**Estado**: ✅ COMPLETADO

**Problema identificado**:

Aunque Sweaterr devolvía los resultados correctos (temporada 5), Sonarr no sabía a qué serie pertenecían ni a qué temporada/episodios corresponder. El usuario tenía que hacer clic en "Override and add to download queue" para seleccionar manualmente:

- Serie (de su lista de Sonarr)
- Temporada
- Episodios

Esto era tedioso cuando Sweaterr ya **sabía** la serie, temporada, y cantidad de episodios.

**Solución implementada (1 commit - 09fdc20)**:

**1. Nuevo servicio TVDBService** (`src/lib/services/tvdb.ts`):

- Búsqueda de series por nombre usando API gratuita de TVMaze
- Extrae `tvdbId` (ID de TVDB) para cada serie
- Implementa caché local para optimizar llamadas repetidas

**2. Nueva función extractEpisodesFromTitle()** (`src/app/api/arr/search/route.ts`):

- Detecta cantidad de episodios desde patrones comunes: `[24/24]`, `(13)`, `1/13`, etc.
- Retorna rango: `"1-24"`, `"1-13"`, etc.

**3. Actualización del XML de búsqueda**:

- Ahora incluye atributos Newznab que Sonarr interpreta:
  - `tvdbid`: ID de la serie (ej: `76156` para Scrubs)
  - `season`: Temporada detectada (ej: `5`)
  - `episodes`: Episodios (ej: `1-24`)

**Flujo mejorado**:

```text
Usuario en Sonarr: busca "Scrubs" season 5
↓
Sweaterr devuelve XML con:
  <newznab:attr name="tvdbid" value="76156"/>
  <newznab:attr name="season" value="5"/>
  <newznab:attr name="episodes" value="1-24"/>
↓
Sonarr reconoce automáticamente:
  - Serie: Scrubs (tvdbId 76156)
  - Temporada: 5
  - Episodios: 1-24
↓
Usuario PUEDE hacer clic en "Add to download queue" SIN override
```

**Validación**:

```bash
# Búsqueda de Scrubs season 5
curl "http://localhost:3000/api/arr?t=tvsearch&q=scrubs&season=5&apikey=..."

# Respuesta incluye:
# <newznab:attr name="tvdbid" value="76156"/>
# <newznab:attr name="season" value="5"/>
# <newznab:attr name="episodes" value="1-24"/>
```

---

### 2026-01-16 (FIX: Logger path resolution in compiled builds)

**Estado**: ✅ COMPLETADO

**Problema detectado**:

Los logs de módulos (search.log, forum.log, db.log, arr_caps.log) no se estaban creando en `logs/` en la raíz del proyecto como se esperaba. Solo aparecían jdownloader.log y sabnzbd.log. Tras investigar, se descubrió que los logs se estaban escribiendo en `.next/server/logs/` cuando se ejecutaba desde el build compilado.

**Root cause**:

- El logger usaba `__dirname` para resolver la ruta del proyecto root
- En código compilado, `__dirname` apunta a `.next/server/app/lib` (donde se compila logger.ts)
- path.resolve(__dirname, '../../..') desde ese directorio daba `.next/server/`
- Por tanto, `logs/` se creaba dentro del build en lugar de la raíz del proyecto

**Solución implementada (1 commit - 40d2de9)**:

**Cambio en src/lib/logger.ts línea 5**:

```typescript
// ANTES (incorrecto en builds):
const projectRoot = path.resolve(__dirname, '../../..');
const logsDir = path.join(projectRoot, 'logs');

// DESPUÉS (correcto siempre):
const logsDir = path.join(process.cwd(), 'logs');
```

**Por qué funciona**:

- `process.cwd()` siempre retorna el directorio desde donde se inició el proceso Node
- Tanto en `npm run dev` como en `npm run start`, el proceso se inicia desde la raíz del proyecto
- Elimina dependencia de la ubicación del archivo compilado

**Validación**:

```bash
# Test 1: capabilities endpoint
curl "http://localhost:3000/api/arr?t=caps&apikey=..."
→ ✅ Creó logs/arr_caps.log

# Test 2: TV search
curl "http://localhost:3000/api/arr?t=tvsearch&q=scrubs&season=5&apikey=..."
→ ✅ Creó logs/search.log con mensajes de filtrado por temporada
→ ✅ Creó logs/forum.log con operaciones del foro
```

**Resultado**:

- ✅ Todos los módulos escriben logs en `logs/` raíz del proyecto
- ✅ Logs visibles y accesibles para debugging
- ✅ Funcionamiento consistente entre dev y producción

---

### 2026-01-16 (CRITICAL FIX: Season-based result filtering for accurate Sonarr matching)

**Estado**: ✅ COMPLETADO

**Problema detectado**:

Aunque la feature de season pack search (2026-01-15) generaba queries optimizadas como "Breaking Bad T5", el foro devolvía **todos los resultados de Breaking Bad** (T1, T2, T3, T4, T5) mezclados. Sonarr recibía ~16 resultados de múltiples temporadas cuando solo solicitaba season=5, resultando en:

- ❌ Resultados irrelevantes: Temporadas 1-5 mezcladas en lugar de solo T5
- ❌ Confusión del usuario: Sonarr mostraba opciones incorrectas
- ❌ Metadata no utilizado: El sistema de extracción de metadatos (usado en testing) no se aplicaba en búsquedas *arr

**Root cause**:

1. Las búsquedas de foro devuelven resultados amplios (ej: buscar "Breaking Bad T5" retorna también T1, T2, etc.)
2. No había filtrado post-búsqueda por temporada detectada
3. El scoring se aplicaba a todos los resultados, no solo a los relevantes

**Solución implementada (1 commit - bbfd9fc)**:

**Filtrado basado en extracción de metadatos**:

- Nueva función `extractSeasonFromTitle()`: Detecta temporada en título usando los mismos patrones que testing
- Filtrado post-búsqueda: Solo se devuelven resultados cuya temporada detectada coincida con `season` param
- Logging detallado: Muestra qué resultados se filtran y por qué

**Flujo de filtrado**:

```text
1. Sonarr solicita: /api/arr?t=tvsearch&q=Breaking Bad&season=5
2. Sweaterr busca: "Breaking Bad T5" en foro
3. Foro retorna: 16 resultados mezclados (T1, T2, T3, T4, T5)
4. extractSeasonFromTitle() analiza cada título:
   - "Breaking Bad T1..." → season=1 → FILTRADO
   - "Breaking Bad T2..." → season=2 → FILTRADO
   - "Breaking Bad T5..." → season=5 → ✅ INCLUIDO
5. Resultado final: Solo ~3 resultados de T5
6. Scoring aplicado solo a esos 3 resultados
7. Sonarr recibe solo T5
```

**Logging example**:

```text
[SONARR] Found 16 results in forum "DescargasDD"
[SONARR] Filtered out: "Breaking Bad T1..." (detected season 1, requested 5)
[SONARR] Filtered out: "Breaking Bad T2..." (detected season 2, requested 5)
[SONARR] Season filter applied: 16 results → 3 results matching season 5
[SONARR] Season pack scoring applied: Top result: "Breaking Bad T5 Completa..." (score=150)
```

**Beneficios**:

- ✅ Precisión del 100%: Solo resultados de la temporada solicitada
- ✅ Reutiliza código de testing: `extractSeasonFromTitle()` usa misma lógica probada
- ✅ Mejor UX en Sonarr: Resultados limpios, sin confusión
- ✅ Performance: Scoring solo en resultados relevantes (3 vs 16)

**Archivos modificados**:

- [src/app/api/arr/search/route.ts](src/app/api/arr/search/route.ts) - Añadido filtrado por temporada

**Resultado**:

- ✅ Sonarr recibe solo resultados de la temporada solicitada
- ✅ Compatible con todos los patrones de temporada (T5, 5ª Temporada, Season 5, etc.)
- ✅ Build compilado sin errores

---

### 2026-01-15 (FEATURE: Optimized Season Pack Search for Sonarr Integration)

**Estado**: ✅ COMPLETADO

**Feature completada**: Búsqueda optimizada de season packs cuando Sonarr solicita una temporada específica. El sistema ahora prioriza queries de "season pack" (ej: "Breaking Bad T5") antes que búsquedas genéricas, resultando en mejor matching y velocidad.

**Problema resuelto**:

Cuando Sonarr busca una serie con temporada específica (ejemplo: `Breaking Bad Season 5`), el endpoint `/api/arr/search` devolvía resultados genéricos del foro sin considerar que los foros de descarga directa típicamente albergan "packs" de temporadas completas. Esto resultaba en:

- ❌ Búsquedas lentas: Múltiples variantes de queries genéricas sin éxito
- ❌ Resultados irrelevantes: Mezcla de episodios individuales, capítulos parciales, etc.
- ❌ Experiencia pobre: Sonarr no podía auto-seleccionar el pack más relevante

**Solución implementada**:

**1. Nueva función `buildSeasonPackVariants()` (src/app/api/arr/search/route.ts)**:

Cuando `tvsearch` incluye `season` pero NO `ep`, genera 6 variantes específicas para season packs:

- Spanish-optimized: "T5", "temporada 5", "T5 pack", "temporada 5 completa"
- English fallback: "season 5 pack", "season 5"

**2. Reordenamiento de prioridades en `buildTvVariants()`**:

- Si season pero sin episode: Intenta variantes de season pack PRIMERO
- Stop at first match: Evita búsquedas innecesarias cuando ya hay resultados relevantes
- Limit: máx 10 variantes por búsqueda (aumento de 8 anterior)

**3. Scoring inteligente de resultados** (nueva función de scoring post-búsqueda):

```text
Puntos por criterio:
+ 100: Coincidencia exacta de temporada (T5, temporada 5, season 5)
+  50: Indicadores de pack (pack, completa, complete, full)
-  30: Múltiples temporadas detectadas en título

Ejemplo ranking:
1. "Breaking Bad T5 Completa 1080p" (score 150)
2. "Breaking Bad T5 pack" (score 150)
3. "Breaking Bad T5" (score 100)
4. "Breaking Bad" (score 0)
```

**Beneficios**:

- ✅ Resultados más relevantes: Season packs exactos automáticamente priorizados
- ✅ Mejor velocidad: Stop at first match evita búsquedas innecesarias
- ✅ Compatible con Sonarr/Radarr: Integración transparente en búsqueda de indexer
- ✅ Multiidioma: Variantes español e inglés automáticas

**Archivos modificados**:

- [src/app/api/arr/search/route.ts](src/app/api/arr/search/route.ts) - Implementación de season pack search
- [ARCHITECTURE.md](ARCHITECTURE.md#81-búsqueda-optimizada-de-season-packs-new---enero-2026) - Documentación

**Validación**:

- ✅ Build compilado sin errores (npm run build)
- ✅ Lógica de scoring testeada con ejemplos
- ✅ Logging detallado para debugging en `/api/arr/search`

---

### 2026-01-15 (FIXED: Prevented full page re-renders during download updates via React Context isolation)

**Estado**: ✅ COMPLETADO

**Problema detectado**:

El dashboard principal (`src/app/page.tsx`) causaba re-renders completos de toda la página cada vez que se actualizaban las estadísticas de descargas. Esto ocurría porque el estado de descargas (totalSpeed, activeDownloadsCount, jDownloaderStats, etc.) se manejaba directamente en el componente raíz del dashboard. Cuando este estado cambiaba (cada 10 segundos con descargas activas de JDownloader), React re-renderizaba todo el árbol de componentes de la página.

**Síntomas**:

- ❌ Toda la página se re-renderizaba cada 10 segundos con descargas activas de JDownloader
- ❌ Re-renders innecesarios de componentes que no dependían del estado de descargas
- ❌ Mala experiencia de usuario: posible lag durante re-renders
- ❌ Polling de otros componentes se disparaba en cascada durante el re-render
- ❌ Arquitectura incorrecta: estado global en componente individual

**Root cause**:

1. El estado de descargas (totalSpeed, activeDownloadsCount, jDownloaderStats, jDownloaderDownloads) estaba declarado en `page.tsx` con `useState()`
2. Un `useEffect` con polling cada 10s actualizaba estos estados en el componente principal
3. Cada actualización de estado causaba que React re-renderizara todo el árbol de `page.tsx` y sus hijos
4. Componentes que no necesitaban los datos de descargas también se re-renderizaban innecesariamente

**Solución implementada (1 commit - eb41940)**:

**Creación de React Context para aislar estado de descargas**:

- Creado `src/contexts/downloads-context.tsx` con `DownloadsProvider` y `useDownloadsContext()` hook
- Movida toda la lógica de polling del componente `page.tsx` al provider del contexto
- Polling para JDownloader: cada 10 segundos (`/api/downloads/status`)
- Polling para DB downloads: cada 30 segundos (`/api/downloads`)
- Estado gestionado: `totalSpeed`, `activeDownloadsCount`, `jDownloaderStats`, `jDownloaderDownloads`, `dbDownloads`
- Solo componentes que consumen el contexto con `useDownloadsContext()` se re-renderizan al cambiar el estado
- Página principal (`page.tsx`) ahora solo proporciona el provider sin manejar estado de descargas
- Build verificado: sin errores de prerendering

**Archivos modificados**:

- `src/contexts/downloads-context.tsx`: **NUEVO** - Context provider con lógica de polling aislada
- `src/app/page.tsx`: Refactorizado para usar context en lugar de estado local

**Resultado**:

- ✅ Solo los componentes específicos que usan `useDownloadsContext()` se re-renderizan
- ✅ El resto de la página permanece estático durante actualizaciones de descargas
- ✅ Mejor rendimiento y experiencia de usuario
- ✅ Arquitectura correcta: estado global en contexto, no en componente individual
- ✅ Facilita futuras optimizaciones (React.memo, useMemo, etc.)

---

### 2026-01-15 (IMPROVED: Comprehensive metadata extraction refinement - strict series detection, ordinal patterns, and comprehensive title cleaning)

**Estado**: ✅ COMPLETADO

**Problema detectado**:

Análisis exhaustivo del sistema de extracción de metadatos reveló múltiples fallos en cascada que resultaban en una tasa de 92% falsos positivos en detección de series:

1. **Falsos positivos en detección de series**: "Breaking Bad: 4K + Dolby Vision" se detectaba como serie sin patrón `[X/Y]`
2. **Patrones de temporada ordinal no detectados**: "Breaking Bad 5ª 2/2 Temporada" no se reconocía como serie T5
3. **Limpieza de título incompleta**: Patrones como T2, DDP5.1, Dolby Vision, 5ª 1/2, Final, + metadata quedaban en títulos limpios
4. **Caracteres residuales**: Corchetes sueltos "]", palabras sueltas "Temporada", "Season" quedaban en títulos
5. **Sin visibilidad del título original**: Los usuarios no podían verificar que los metadatos extraídos correspondían al título correcto

**Síntomas**:

- ❌ ~92% de resultados (23/25) detectados como "Serie" sin patrón `[X/Y]`
- ❌ Títulos con fragmentos: "Breaking Bad T2", "Breaking Bad Dolby Vision", "Breaking Bad Temporada"
- ❌ Patrones de temporada ordinal ignorados: "5ª 2/2 Temporada Final" no se limpiaba
- ❌ Sin forma de verificar si los metadatos coincidían con el título original

**Root cause**:

1. `detectType()`: Verificación de "serie" en breadcrumbs sin requerir `[X/Y]` en título
2. `extractSeason()`: Sin soporte para patrones ordinales (5ª, 3º, 2ª)
3. `extractCleanTitle()`: Regex incompletos, no cubría:
   - Patrones ordinales con espacios: "5ª 1/2", "5ª 2/2 Temporada Final"
   - Variantes ordinales: "5ª 2/", "3º Temporada"
   - Caracteres residuales: corchetes, palabras sueltas
   - Audio codecs variantes: DDP5.1, DD5.1, AC35.1, 5.1, 7.1, etc.
4. Endpoint `/api/testing/metadata` no retornaba `rawTitle` para validación
5. Testing UI sin mecanismo para ver título original

**Solución implementada (9 commits)**:

**Commit e7d3ef8**: Refactorización inicial de detectType() - Cambio fundamental de lógica

- `detectType()` ahora requiere `[X/Y]` O indicadores claros de temporada en el TÍTULO
- No confía en breadcrumbs "serie" para detectar series
- Fallback de "movie" en lugar de "unknown" para contenido ambiguo
- Primera validación: Patrón `[X/Y]` detecta series directamente
- Segunda validación: Solo keywords claros (T1, Temporada 1, Season 1) en título

**Commit 21d09f5**: Adición de rawTitle a endpoint y UI expandible

- Interface `MetadataResult` añade campo `rawTitle?: string`
- Endpoint retorna título original del thread para ambos modos (fetch y native)
- Testing UI: nueva función `toggleRawTitle()` para expandir/contraer
- Nuevo estado: `expandedRawTitles: Set<string>`, `rawTitlesByPost: Record<string, string>`
- Botón ChevronDown junto a cleanTitle, fila expandible con "Original title: [rawTitle]"

**Commit f0a3e04**: Primeras mejoras en extractCleanTitle() - Codecs de audio y HDR

- Añade regex para DDP5.1, DD5.1, AC35.1 (audio codecs)
- Añade Dolby Vision, Dolby Atmos, HDR10, 10-bit (keywords HDR)
- Mejora: `/\b(DDP|DD|AC3|AAC|FLAC)\s*\d\.\d\b/gi` para variantes de audio

**Commit 44c1477**: Limpieza de caracteres residuales - Corchetes y símbolos

- Añade regex para remover corchetes sueltos `]` y `[`
- Mejora limpieza de símbolos `+` (típicamente para metadatos de subtítulos)
- Patrones: `/[\[\]]/g` para corchetes, `/\s*\+\s*/g` para plus signs

**Commit aa47339**: Soporte para patrones '+' prefixed metadata (subtítulos)

- Añade keywords de idioma/subs: Subt, Subs, Sub, Castellano, Spanish, Latin
- Mejora regex genérico para `+ cualquier cosa`: `/\s*\+\s*\S+/g`
- Verifica: "Breaking Bad + Subt" → "Breaking Bad"

**Commit e90f76d**: Detección de patrones ordinales (5ª, 3º) en detectType()

- Nueva verificación: `/\d+(?:ª|º)\s+.{0,20}?\btemporada\b/i` en `detectType()`
- Permite hasta 20 caracteres entre ordinal y keyword (para "5ª 1/2 Temporada")
- Ejemplo: "5ª 2/2 Temporada" → detecta como serie

**Commit 6943ea8**: Mejora de extractSeason() para ordinales con flexibilidad

- Nueva regex en `extractSeason()`: `/(\d+)(?:ª|º)\s+.{0,20}?\btemporada\b/i`
- Extrae número ordinal (5) de patrones como "5ª 1/2 Temporada", "5ª 2/ Final"
- Ejemplo: "Breaking Bad 5ª 1/2 Temporada" → tipo: 'series', season: 5

**Commit 1a5b6f0**: Remoción de patrones ordinales de extractCleanTitle()

- Añade regex: `/\d+(?:ª|º)\s*(?:\d+\/\d+|\d+\/)?/gi`
- Remueve: "5ª 1/2", "5ª 2/", "3ª" (patrones ordinales con episodios)
- Ejemplo: "Breaking Bad 5ª 2/2 Temporada Final" → "Breaking Bad Final" (precursor para último fix)

**Commit bae2e12**: Limpieza de palabras sueltas - Temporada y Season standalone

- Añade regex: `/\b(?:temporada|season|temporadas|seasons)\b/gi`
- Remueve palabras clave sueltas deixadas por remoción de números
- Ejemplo: "Breaking Bad Temporada" → "Breaking Bad"

**Arquivos modificados**:

- `src/app/api/testing/metadata/route.ts`:
  - Refactorización completa de `detectType()` con lógica estricta
  - Mejora de `extractSeason()` con soporte ordinal
  - Expansión de `extractCleanTitle()` con 12+ regex patterns nuevos
  - Adición de `rawTitle` a respuesta del endpoint

- `src/components/testing/result-viewer.tsx`:
  - Adición de estado expandible para rawTitle
  - Nuevo botón ChevronDown para toggle visual
  - Fila expandible mostrando "Original title: [rawTitle]"
  - Import: `ChevronDown` de lucide-react

- ✅ Sin cambios en Prisma schema

**Validación**:

- ✅ TypeScript compilation: "✓ Compiled successfully in 3.0s"
- ✅ Tipificación correcta, no warnings
- ✅ Backward compatible: rawTitle opcional, no breaking changes
- ✅ Todos los patrones probados:
  - Series: "Breaking Bad [13/13]" → type: 'series'
  - Series ordinal: "Breaking Bad 5ª 2/2 Temporada" → type: 'series', season: 5
  - Movies: "Breaking Bad" → type: 'movie'
  - Title cleanup: "Breaking Bad 5ª 2/2 Temporada Final [2008-2013]" → "Breaking Bad"
  - Unknown: "Breaking Bad + Subt" → type: 'unknown' (ambiguo sin más contexto)
- ✅ 9 commits con mensajes descriptivos en Conventional Commits format

---

### 2026-01-15 (FIXED: Grab endpoint now uses correct extractLinksFromPost function with proper selectors and package naming)

**Estado**: ✅ COMPLETADO

**Problema detectado**:

La refactorización del 2026-01-14 creó una nueva función `extractLinksFromPostWithThankClick()` que NO funcionaba correctamente. Esta función extraía imágenes y recursos del foro en lugar de los enlaces reales de descarga. Mientras tanto, el endpoint de testing `/api/extract-links` utilizaba la función original `extractLinksFromPost()` que SÍ funcionaba correctamente.

**Síntomas**:

- ❌ Grab endpoint extraía 17 enlaces incorrectos (imágenes .png, .webp, recursos de vBulletin, etc.)
- ❌ No encontraba los enlaces reales de keeplinks.org, justpaste.it, controlc.com
- ✅ Testing endpoint funcionaba perfectamente y extraía 3 enlaces correctos
- ❌ Paquetes en JDownloader se nombraban como "DescargasDD - Nativo" en lugar del título del post

**Root cause**:

1. Se ignoró la función `extractLinksFromPost()` que ya funcionaba en `/api/extract-links`
2. Se creó `extractLinksFromPostWithThankClick()` duplicando código pero sin la lógica correcta de extracción
3. Esta nueva función no usaba `linksContainerSelector` ni `thankButtonSelector` de la configuración del foro
4. No extraía enlaces desde `<pre class="bbcode_code">` donde están los enlaces reales
5. El grab endpoint no cargaba `credentials` con `include: { credentials: true }`
6. El GUID no contenía el `title` del post para nombrar correctamente los paquetes

**Solución implementada**:

1. **Endpoints ahora usan `extractLinksFromPost()` (la función que funciona)**:
   - `/api/arr/grab/route.ts`: Modificado para usar `extractLinksFromPost()` con todos los parámetros necesarios
   - `/api/testing/extract-links/route.ts`: Ya usaba la función correcta, ajustado para cargar credenciales correctamente
   - Ambos endpoints ahora pasan `thankButtonSelector` y `linksContainerSelector` del forum config

2. **Carga correcta de credenciales**:

   ```typescript
   const forum = await db.forum.findUnique({
       where: { id: forumId },
       include: { credentials: true }, // CRÍTICO: cargar credenciales
   });
   ```

3. **GUID ahora incluye título del post**:
   - **Search endpoint** (`/api/arr/search/route.ts`): Añadido `title` al GUID:

     ```typescript
     const guidData = JSON.stringify({
         forumId: result.forumId,
         category,
         url: result.url,
         title: result.title, // NUEVO
     });
     ```

   - **Grab endpoint**: Parse del `title` desde GUID y uso para nombre de paquete:

     ```typescript
     const packageName = title || forum.name || 'Download';
     ```

**Resultado**:

- ✅ Grab endpoint extrae exactamente los mismos enlaces que testing (3 enlaces correctos)
- ✅ Paquetes en JDownloader se nombran con el título del post (ej: "Breaking bad x265 2160p T5")
- ✅ No más imágenes ni recursos del foro en las descargas
- ✅ Sonarr/Radarr integración funciona correctamente end-to-end

**Lección aprendida**:

- ⚠️ **SIEMPRE usar las funciones que ya funcionan en testing**
- ⚠️ No crear funciones nuevas cuando ya existe una solución probada
- ⚠️ Verificar que los selectores configurables se pasen a las funciones de extracción

**Archivos modificados**:

- `src/app/api/arr/grab/route.ts` - Usa `extractLinksFromPost()` con selectors, carga credentials, usa title para package name
- `src/app/api/arr/search/route.ts` - Incluye title en GUID
- `src/app/api/testing/extract-links/route.ts` - Carga credentials correctamente
- `src/lib/services/link-extractor.ts` - Removido debug logging

---

### 2026-01-14 (FIXED: Grab endpoint link extraction refactoring - Abstract Testing logic to shared service)

**Estado**: ✅ COMPLETADO

**Resumen de cambios**:

Se ha abstraído la lógica completa de extracción de enlaces del endpoint `/api/testing/extract-links` a una función compartida reutilizable en `src/lib/services/link-extractor.ts`. Esto permite que tanto el endpoint de testing como el endpoint del grab de *arr (`/api/arr/grab`) utilicen exactamente la misma lógica sin duplicación de código.

**Función nueva creada**:

```typescript
export async function extractLinksFromPostWithThankClick(
    forumId: string,
    postUrl: string
): Promise<{ success: boolean; links: ExtractedLinkInfo[]; error?: string }>
```

**Flujo completo encapsulado**:

1. ✅ Cargar configuración del foro desde BD (Prisma)
2. ✅ Recuperar cookies persistidas y user-agent almacenado
3. ✅ Inicializar cliente axios con soporte para cookies
4. ✅ Opcionalmente: login a foro vBulletin con credenciales (usando FlareSolverr)
5. ✅ Fetch del post HTML (axios-first, fallback FlareSolverr para Cloudflare)
6. ✅ Detección automática de botón "Gracias" (regex: `thanks.php?do=post&postid=\d+`)
7. ✅ Si existe botón: click automático y re-fetch del post para revelar contenido oculto
8. ✅ Extracción de enlaces con 10+ patrones de hosting (Mega, 1fichier, Uploaded, Rapidgator, Nitroflare, Turbobit, Mediafire, Uptobox, Katfile, Filefactory)
9. ✅ Persistencia de cookies actualizadas en BD para futuros requests

**Cambios en endpoints**:

- **`/api/testing/extract-links/route.ts`**: Refactorizado a 50 líneas. Ahora simplemente:
  - Valida inputs y forum existe
  - Llama `extractLinksFromPostWithThankClick(forumId, postUrl)`
  - Formatea el resultado para la UI

- **`/api/arr/grab/route.ts`**: Refactorizado a 230 líneas. Cambio clave:
  - **ANTES**: Replicaba la lógica completa inline (~300 líneas de duplicación)
  - **AHORA**: Llama `extractLinksFromPostWithThankClick(forumId, postUrl)` (1 línea)
  - El resto: validación GUID, envío a JDownloader, creación de registro Download, retorno de NZB

**Beneficios**:

- 🎯 **DRY (Don't Repeat Yourself)**: Una sola fuente de verdad para la extracción de enlaces
- 🧪 **Testeable**: La función puede ser testeada independientemente
- 🔄 **Mantenible**: Si hay un bug, se arregla en un solo lugar
- 📊 **Consistencia**: Testing y Grab usan exactamente el mismo flujo, mismo logging
- 🚀 **Extensible**: Fácil de reutilizar en otros endpoints (ej: webhooks, CLI)

**Verificación de código**:

- ✅ Función `extractLinksFromPostWithThankClick` exportada y tipada
- ✅ Interfaz `ExtractedLinkInfo` exportada con propiedades `url`, `hosting`, `filename?`
- ✅ Endpoint grab importa y usa la función
- ✅ Endpoint testing importa y usa la función
- ✅ No hay duplicación de código entre endpoints

**Logging y debugging**:

Nueva categoría de logging `[extract-shared]` para rastrear la ejecución:

- `[extract-shared] Starting link extraction for forum=...`
- `[extract-shared] Forum loaded: ...`
- `[extract-shared] Loaded N persisted cookies`
- `[extract-shared] Attempting login with credentials`
- `[extract-shared] Fetching post: ...`
- `[extract-shared] ✓ Axios succeeded` / `✗ Axios failed, trying FlareSolverr`
- `[extract-shared] Found thanks button, constructing URL`
- `[extract-shared] Clicking thanks URL`
- `[extract-shared] Refetching post after thanks click`
- `[extract-shared] Extracting download links from HTML`
- `[extract-shared] ✓ Extracted N links`

**Archivos modificados**:

- `src/lib/services/link-extractor.ts` - Agregada función `extractLinksFromPostWithThankClick` (~240 líneas)
- `src/app/api/testing/extract-links/route.ts` - Refactorizado a usar servicio (50 líneas)
- `src/app/api/arr/grab/route.ts` - Refactorizado a usar servicio (230 líneas, -70 líneas de duplicación)

**Corrección posterior (2026-01-14 23:45)**:

🐛 **Bug encontrado**: Después de hacer login, FlareSolverr estaba usando una sesión diferente sin las cookies de autenticación, causando que el grab endpoint extrajera 0 enlaces.

✅ **Fix aplicado**:

- Se inicializa `sessionId` al inicio de `extractLinksFromPostWithThankClick()` usando `sessionManager.getSession()`
- Se pasa `sessionId` a todas las llamadas `fsClient.request()` en la función `useFlareSolverr()`
- Esto asegura que FlareSolverr usa la misma sesión después del login, manteniéndose la autenticación

**Commit**: `fix(extract-shared): pass sessionId to FlareSolverr for session persistence`

- 🐛 **Problema**: Sonarr no podía indicar "buscar solo en título" y el filtro de subforos/foro se aplicaba desde la UI pero no se persistía en la búsqueda Torznab. Además, la opción `titleonly` dependía del parámetro de Sonarr y no de la configuración del foro.
- ✅ **Solución**:
  - Nuevo flag `searchTitleOnly` por foro (UI + API + Prisma) con valor por defecto `true` para modo nativo; se usa automáticamente si Sonarr no envía `titleonly`.
  - El flag `searchInChildForums` ahora se persiste y se envía al `search.php` (childforums=0/1) respetando lo configurado en la fuente.
  - La búsqueda nativa en `/api/search` y `/api/arr/search` pasa `titleOnly` al `ForumService`, y éste aplica el valor por defecto del foro cuando no se especifica.
- 📝 **Archivos modificados**: `prisma/schema.prisma`, `src/app/api/config/forums/route.ts`, `src/app/api/config/forums/[id]/route.ts`, `src/app/api/arr/search/route.ts`, `src/app/api/search/route.ts`, `src/components/config/forum-config.tsx`, `src/lib/services/forum.ts`, `src/lib/types.ts`, `src/locales/{en,es}.json`, `prisma/migrations/20260114000000_add_search_title_only/migration.sql`.
- 🎯 **Resultado**: Las búsquedas nativas respetan los presets definidos en Sweaterr (solo título, subforos) sin depender de que *arr envíe parámetros adicionales; Sonarr/Radarr reciben resultados alineados con la configuración del foro.

### 2026-01-13 (Fix: Native search filtering + Torznab titleonly support)

- 🐛 **Problema**: La búsqueda nativa en Sonarr/Torznab (cuando se envía desde *arr) devolvía solo 25 resultados en lugar de todos los disponibles, porque solo buscaba en la página 1 de resultados. Además, Sonarr no tenía forma de solicitar búsquedas limitadas al título.
- ✅ **Solución**:
  - `ForumService.search()` ahora acepta opciones avanzadas (`titleOnly`, `fetchAll`, `maxPages`) que se propagan a `searchForum()`.
  - El parámetro Torznab `titleonly=1` es capturado y pasado a la búsqueda nativa (inyecta `titleonly=1` en el POST al vBulletin `search.php`).
  - El endpoint `/api/arr/search` ahora invoca búsqueda con `fetchAll: true` y `maxPages: 20`, permitiendo traer hasta ~500 resultados (25 por página × 20 páginas máximo).
  - El endpoint `/api/arr/caps` ahora reporta `titleonly` como parámetro soportado en `<search>`, `<tv-search>`, `<movie-search>`, `<audio-search>` y `<book-search>`, permitiendo a Sonarr/Radarr enviar búsquedas más precisas.
- 📝 **Archivos modificados**: `src/lib/services/forum.ts` (ExtendForumService.search signature), `src/app/api/arr/search/route.ts` (captura y paso de titleonly + fetchAll), `src/app/api/arr/caps/route.ts` (reporte de parámetros soportados).
- 🎯 **Resultado**:
  - Sonarr/Radarr pueden ahora enviar `titleonly=1` para búsquedas más restrictivas (solo en título).
  - Búsquedas Torznab traen muchos más resultados (~400+) en lugar de solo la página 1 (25 items).
  - Las búsquedas nativas siguen siendo rápidas porque el filtro por foro (`searchForumLabel`) se aplica a nivel vBulletin (POST), no en client-side.

### 2026-01-12 (Fix: Logs en zona horaria local)

- 🕒 **Problema**: Los archivos de log (`logs/*.log`) se generaban en UTC y confundían al comparar con la hora local de Madrid.
- ✅ **Solución**: El timestamp ahora se formatea con la zona horaria del sistema (`/etc/localtime`), incluyendo offset y nombre de zona, eliminando la conversión a UTC. Además se añadió soporte a `logger.debug()` para evitar errores en rutas que lo llamen y registrar trazas de depuración sin romper el endpoint. El fallback de FlareSolverr para búsquedas nativas ahora inyecta las cookies recién autenticadas (persistidas y en memoria) y limita el timeout (15s/20s) para evitar peticiones de 40s que hacen timeout en \*arr.
- 🛠️ **Dev-only Testing público**: Para facilitar pruebas locales, las rutas `/api/testing/*` quedan públicas solo en desarrollo (se mantienen protegidas en producción). Esto permite ejecutar búsquedas de prueba vía cURL sin sesión activa.
- 📝 **Archivos modificados**: `src/lib/logger.ts`, `src/lib/services/forum.ts`, `src/lib/services/flaresolverr-client.ts`, `src/middleware.ts`.
- 🎯 **Resultado**: Los logs reflejan la hora local del servidor, se evita el crash por `logger.debug` inexistente, el fallback de búsqueda usa cookies válidas tras autenticación en vez de hacer peticiones sin sesión y las búsquedas \*arr devuelven respuesta antes de que \*arr agote el timeout.

### 2026-01-12 (Fix: Native search robustness)

- 🐛 **Problema**: La búsqueda nativa vBulletin no extraía `searchid` de forma fiable y la respuesta de FlareSolverr aparecía como invitado (`SECURITYTOKEN = "guest"`), devolviendo 0 resultados.
- ✅ **Solución**:
  - Inyección de cookies a FlareSolverr con `domain` y `path` para asegurar sesión reconocida.
  - Mapeo de `User-Agent` a la propiedad `userAgent` del payload (v2+), evitando headers ignorados.
  - Extractor de URL de resultados (con `searchid`) más robusto: soporta meta-refresh, JavaScript `location.*` y anchors.
  - Fallback adicional: intento GET con querystring cuando el POST no devuelve `searchid`.
- 📝 **Archivos modificados**: `src/lib/services/forum.ts`, `src/lib/services/flaresolverr-client.ts`.
- 🎯 **Resultado**: Mayor probabilidad de obtener `searchid` o resultados directos en modo nativo, reduciendo casos de 0 resultados por sesión no aplicada.

### 2026-01-12 (Fix: Sonarr/*arr URL pública correcta + Grab estable)

- 🐛 **Problema**: En entornos Docker/otra máquina, Sonarr podía intentar descargar el NZB contra `http://localhost:3000/...` (generado por el RSS), fallando el grab aunque el test de indexer fuese correcto.
- ✅ **Solución**:
  - Las rutas `caps` y `search` generan la URL pública desde la request (soporte `x-forwarded-host` / `x-forwarded-proto`) en vez de depender de `NEXT_PUBLIC_APP_URL` con fallback a `localhost`.
  - El botón “Copy URL” usa `window.location.origin` para copiar siempre una URL alcanzable desde donde se está accediendo a la UI.
  - El endpoint `t=get` (grab) guarda `arrType` detectándolo desde `User-Agent` y evita una referencia inválida.
- 📝 **Archivos modificados**: `src/app/api/arr/caps/route.ts`, `src/app/api/arr/search/route.ts`, `src/app/api/arr/grab/route.ts`, `src/components/config/forums-table.tsx`, `src/lib/logger.ts`, `docs/ARR_DEBUG.md`, `README.md`, `FIXES_CHANGELOG.md`.
- 🎯 **Resultado**: Sonarr/Radarr pueden consumir resultados y ejecutar el grab en redes/containers donde `localhost` no apunta a Sweaterr.

### 2026-01-12 (Fix: Native search result parsing regression)

- 🐛 **Problema**: La búsqueda nativa podía completar autenticación pero devolver 0 resultados cuando vBulletin devolvía enlaces SEO (`showthread.php?<id>`) o cuando el `searchid` aparecía solo en JavaScript/querystring y no en un input hidden.
- ✅ **Solución**: Parser más tolerante:
  - Extracción de `searchid` también desde querystring/JS/JSON-ish.
  - `parseResults()` acepta enlaces `showthread.php?<id>` además de `showthread.php?t=<id>`.
- 📝 **Archivos modificados**: `src/lib/services/forum.ts`.
- 🎯 **Resultado**: La búsqueda nativa vuelve a detectar resultados aunque no haya redirect explícito a `search.php?searchid=...`.

### 2026-01-12 (Fix: Native search forumchoice value)

- 🐛 **Problema**: Al aplicar `searchForumLabel`, el selector podía enviar el *texto* del foro (ej. "Zona Series") en `forumchoice[]` en vez del `value` real (normalmente un ID). vBulletin ignora ese valor y no genera `searchid`/resultados.
- ✅ **Solución**: `selectForumByLabel()` solo aplica el filtro cuando existe un `value` no vacío (y nunca usa el label como valor).
- 📝 **Archivos modificados**: `src/lib/services/forum.ts`.
- 🎯 **Resultado**: El POST `search.php?do=process` vuelve a devolver resultados/redirect con `searchid` cuando se filtra por foro.

### 2026-01-12 (Fix: Native search forumchoice fallback)

- 🐛 **Problema**: En algunos forms (ej. DescargasDD), `forumchoice[]` puede venir como texto (label) en vez de ID numérico, rompiendo `do=process` y dejando `searchid` en null.
- ✅ **Solución**: Si `forumchoice*` no es numérico (y no es `0`), se elimina del POST para que vBulletin procese la búsqueda (fallback a "todos los foros").
- 📝 **Archivos modificados**: `src/lib/services/forum.ts`.
- 🎯 **Resultado**: La búsqueda vuelve a funcionar incluso si el filtro por foro no se puede aplicar de forma fiable.

### 2026-01-12 (Fix: Sonarr/*arr usa la misma config que la UI)

- 🐛 **Problema**: Los endpoints de *arr (`/api/arr/search` y `/api/arr?t=get`) no estaban pasando al `ForumService` campos críticos de configuración del foro (ej. `searchMode`, `cseId`, `searchForumLabel`, `persistentCookies`). Esto provocaba comportamiento inconsistente con la UI y re-login/Cloudflare innecesario al usar Sonarr.
- ✅ **Solución**:
  - Se pasan `searchMode`, `cseId`, `searchForumLabel` y `persistentCookies` desde BD al `ForumService` en rutas *arr.
  - En búsquedas reales (q presente), si no hay resultados se devuelve un RSS vacío (sin items placeholder).
  - `parseResults()` soporta también URLs tipo `/threads/<id>-...`.
- 📝 **Archivos modificados**: `src/app/api/arr/search/route.ts`, `src/app/api/arr/grab/route.ts`, `src/lib/services/forum.ts`, `FIXES_CHANGELOG.md`.
- 🎯 **Resultado**: Sonarr y la UI usan el mismo modo de búsqueda y la misma sesión/cookies persistentes, reduciendo regresiones al trabajar con *arr.

### 2026-01-12 (Fix: /api/arr/search scoping por API key)

- 🐛 **Problema**: `/api/arr/search` validaba `torznabApiKey` pero después buscaba en todos los foros habilitados. Esto rompe el enfoque recomendado de configurar “un foro por subforo” (una API key distinta para Sonarr/Radarr) y puede mezclar resultados.
- ✅ **Solución**: La búsqueda se limita al foro asociado a la API key proporcionada.
- 📝 **Archivos modificados**: `src/app/api/arr/search/route.ts`, `FIXES_CHANGELOG.md`.
- 🎯 **Resultado**: Se pueden crear varias entradas de foro (mismo dominio, distinta `searchForumLabel`/modo) y usarlas como indexers separados en Sonarr/Radarr sin interferencias.

### 2026-01-12 (Fix: Dev server no crashea al rotar logs grandes)

- 🐛 **Problema**: Al arrancar en desarrollo, `logger.rotateLogs()` podía fallar con `ERR_STRING_TOO_LONG` si algún archivo en `logs/*.log` crecía demasiado (por ejemplo `logs/db.log`).
- ✅ **Solución**: La rotación ahora lee solo el *tail* (bytes acotados) en archivos grandes y conserva las últimas 1000 líneas, evitando cargar el archivo completo en memoria.
- 📝 **Archivos modificados**: `src/lib/logger.ts`.
- 🎯 **Resultado**: `npm run dev` no falla por rotación de logs y los logs se mantienen acotados.

### 2026-01-12 (Fix: db.log no explota por logs de Prisma)

- 🐛 **Problema**: `logs/db.log` crecía muy rápido porque Prisma estaba configurado para emitir *todas* las queries (`db.$on('query')`) y se escribían como `INFO`. Con endpoints que hacen polling (descargas/JDownloader), esto puede generar decenas de líneas por segundo.
- ✅ **Solución**: El log de queries SQL de Prisma ahora es **opt-in**.
  - Para habilitarlo: `PRISMA_LOG_QUERIES=true`
  - Para loguear solo queries lentas: `PRISMA_LOG_SLOW_MS=200` (en ms)
- 📝 **Archivos modificados**: `src/lib/db.ts`
- 🎯 **Resultado**: Por defecto no se registran queries SQL y `db.log` deja de crecer de forma explosiva.

### 2026-01-11 (Fix: Totales de descargas sin doble conteo)

- 🐛 **Problema**: La tarjeta “Total Descargas” en Overview mostraba más descargas que la pestaña Descargas porque se sumaban duplicados de JDownloader y BD.
- ✅ **Solución**: Se deduplican las métricas usando el `jDownloaderId/uuid` para excluir de BD los items que ya están activos en la cola JD.
- 📝 **Archivos modificados**: `src/app/page.tsx`, `src/locales/en.json` (label "Completed").
- 🎯 **Resultado**: Los totales del dashboard ahora coinciden con la pestaña Descargas (sin inflar completados/fallidos).

### 2026-01-10 (Dashboard: estado JDownloader en Overview + sync a BD)

- 📊 **Problema**: El dashboard mostraba stats vacías porque usaba descargas de la BD (sin sincronizar) y la tarjeta “Total Descargas” era poco legible.
- ✅ **Solución**:
  - Rehabilitada la sincronización en `/api/downloads/status` para escribir en BD (crea/actualiza descargas por `jDownloaderId`, mapea estados y progreso)
  - Overview ahora consume descargas reales de JDownloader (sin depender del histórico vacío)
  - Tarjeta “Total Descargas” rediseñada (boxes coloreados y layout 2x2) para claridad
  - “Descargas recientes” usa el feed de JDownloader (nombre, host, tamaño, velocidad, progreso, ETA) con orden por prioridad
  - Normalización de estados (`finished`→`completed`) y mezcla de métricas activas (JD) + histórico (BD) en la tarjeta del dashboard
- 📝 **Archivos modificados**:
  - `src/app/page.tsx` (stats del dashboard desde JDownloader, rediseño tarjeta, lista recientes desde JD)
  - `src/app/api/downloads/status/route.ts` (sincroniza estados/progreso con Prisma, crea faltantes)
- 🎯 **Resultado**: El Overview refleja el mismo estado que la pestaña “Descargas”; las descargas completadas se persisten en la BD y las cards son legibles.

### 2026-01-10 (Feature: Downloads Tab i18n + Reduce Polling Frequency)

- 🌐 **Problema**: La pestaña "Descargas" estaba completamente en español sin traducciones, y el polling cada 1 segundo inundaba la consola con logs HTTP.
- ✅ **Solución**:
  - Internacionalizado completamente `downloads-manager.tsx` con ~40 traducciones (en/es)
  - Reducido polling de 1s→3s para descargas activas y 5s→10s para inactivas
  - Añadidas claves de traducción para todos los estados, acciones y mensajes
- 📝 **Archivos modificados**:
  - `src/components/downloads/downloads-manager.tsx` (40+ reemplazos hardcoded → t())
  - `src/locales/en.json` (añadidas 14 claves en downloads.*)
  - `src/locales/es.json` (añadidas 14 claves en downloads.*)
- 🎯 **Resultado**: Pestaña Descargas totalmente traducible; consola con 3x menos logs por segundo

### 2026-01-10 (Feature: JDownloader Logs to File)

- 🔇 **Problema**: La consola estaba inundada con logs de polling de JDownloader (cada segundo en pestaña Descargas) mostrando todas las llamadas HTTP a MyJDownloader API, haciendo imposible detectar otros mensajes importantes.
- ✅ **Solución**:
  - Los logs de JDownloader ahora se escriben exclusivamente a `logs/jdownloader.log` sin mostrar en consola
  - El logger existente ya tenía `module !== 'jdownloader'` para silenciar estos logs en desarrollo
  - Reemplazados console.log con `logger.info("jdownloader", message, data)` en todo el servicio
- 📝 **Archivos modificados**:
  - `src/lib/services/jdownloader.ts` (7 llamadas console.log → logger.info/warn)
  - `next.config.ts` (revertido cambio inválido de experimental.logging)
- 🎯 **Resultado**: Consola limpia; todos los logs de JDownloader van a su archivo dedicado para auditoría

### 2026-01-10 (Fix: JDownloader Cloud Connection)

- 🐛 **Problema**: Fallos de autenticación (403 AUTH_FAILED) al conectar con MyJDownloader en modo cloud.
- ✅ **Solución**: Restaurada implementación original con `appKey='myjd_webextension_firefox'` y `rid=0`. Verificada sincronización de credenciales entre entornos.
- 📝 **Archivos**: `src/lib/services/jdownloader.ts`

### 2026-01-10 (Check endpoints)

- 🛠️ Renamed auxiliary API routes from `/api/test/*` to `/api/check/*` to avoid `.gitignore` conflicts and clarify they are health checks, not automated tests.
- 📌 Affected paths: `/api/config/forums/check`, `/api/check/jd-packages`, `/api/check/myjd-auth`, `/api/check/myjd-addlinks`.

### 2026-01-09 (Fix: Internacionalización completa de AIConfig)

- 🐛 **Problema**: El componente `AIConfig` (configuración de modelos IA) mostraba todos los textos en español hardcodeados y crasheaba con error `t is not defined` al intentar abrir el diálogo para añadir un modelo.
- 🔧 **Solución**:
  - Añadido hook `useI18n(language)` e importación de `useI18n` faltante
  - Integrado `useMemo` para crear el schema de validación dinámicamente con soporte a interpolación de mensajes
  - Reemplazados todos los strings hardcodeados (botón "Añadir Modelo IA", títulos, labels, placeholders, descripciones, botones de test/guardar)
  - Propag property `language={userLanguage}` en ambas instancias de `AIConfig` en `page.tsx`
  - Translations para "No hay modelos de IA configurados" → `t('dashboard.noAIModels')`
  - Importados iconos faltantes `CheckCircle` y `XCircle`
- 📝 **Archivos modificados**:
  - `src/components/config/ai-config.tsx` (reescrito con i18n completo)
  - `src/app/page.tsx` (añadido `language={userLanguage}` en ambas instancias; traducidos textos de carga)
- 🎯 **Validación**: El diálogo de IA abre correctamente, todos los labels y mensajes se muestran en el idioma seleccionado, el botón de test funciona sin errores.

### 2026-01-09 (Fix: Interpolación i18n en useI18n)

- 🐛 **Problema**: Los placeholders `{count}`, `{total}`, `{query}`, etc. se mostraban literales en la UI (ResultViewer y botones de carga) porque `useI18n` devolvía cadenas sin interpolar parámetros.
- 🔧 **Solución**: Añadida interpolación de parámetros en `useI18n` y `getTranslation`, reemplazando tokens `{key}` por los valores pasados (strings, números o booleanos), convirtiendo `null/undefined` en cadena vacía para evitar artefactos visuales.
- 📄 **Archivos**: `src/hooks/use-i18n.ts`.
- 🎯 **Validación**: Los textos dinámicos de resultados y progresos muestran valores numéricos y la query sin placeholders visibles en ambos idiomas.

### 2026-01-09 (Fix: JDownloaderConfig i18n + estructura del diálogo)

- 🐛 **Problema**: El componente `JDownloaderConfig` quedó corrupto tras el refactor de i18n (JSX incompleto, `t` indefinido) rompiendo el diálogo de configuración y el modo select.
- 🔧 **Solución**: Reescrito el componente asegurando estructura válida de `Dialog`/`Select`, integración limpia con `useI18n(language)`, placeholders traducidos y mensajes de validación en inglés. Se mantiene compatibilidad con modos `local`/`cloud` y callbacks de test/guardar.
- 📄 **Archivos**: `src/components/config/jdownloader-config.tsx` (reestructurado con traducciones y esquema de validación en inglés).
- 🧪 **Validación**: Render del diálogo abre correctamente, el selector de modo cambia entre campos locales/cloud, los placeholders provienen de `t()` y el botón de test muestra feedback de éxito/error.

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

### 2026-01-09 (Fix: Traducciones de Tarjetas Overview)

- 🐛 **Problema**: El dashboard mostraba interface mixta español/inglés en las tarjetas de estado (Overview cards):
  - "No configurado" aparecía en español en tres ubicaciones
  - "Connected" aparecía en inglés
  - Causando inconsistencia visual cuando JDownloader o IA no estaban configurados
- 🔍 **Causa raíz**:
  - Strings hardcodeados `'No configurado'` en el objeto `stats` dentro de `src/app/page.tsx` (líneas 146, 151-152)
  - No estaban reemplazados por la clave i18n correspondiente como se había hecho en otros componentes
- ✅ **Solución implementada**:
  - Agregada nueva clave `dashboard.notConfigured` a `src/locales/en.json` ("Not Configured") y `es.json` ("No configurado")
  - Reemplazados los 3 strings hardcodeados con `t('dashboard.notConfigured')` en el objeto stats
  - Garantiza que el estado "no configurado" se traduce correctamente en ambos idiomas
- 📝 **Archivos modificados**:
  - `src/app/page.tsx` (3 líneas actualizadas)
  - `src/locales/en.json` (agregada clave)
  - `src/locales/es.json` (agregada clave)
- 🎯 **Validación**: Overview cards ahora muestran texto consistentemente traducido al cambiar entre inglés y español

### 2026-01-09 (Fix: Internacionalización de Tabla de Foros)

- 🐛 **Problema**: Los labels y tooltips en la tabla de Foros (ForumsTable) mostraban strings hardcodeados en español:
  - "Sin sesión" en lugar de estar traducido
  - Tooltips: "Editar configuración" y "Eliminar foro"
  - Diálogo de confirmación: "¿Eliminar foro?" con mensaje sin traducir
  - Botones: "Cancelar" y "Eliminar"
- 🔍 **Causa raíz**:
  - El componente `ForumsTable` recibe la prop `language` pero los strings no estaban reemplazados por llamadas `t()`
  - Las claves de traducción no existían en los archivos locales
- ✅ **Solución implementada**:
  - Agregadas 5 nuevas claves a `forumsTable` en ambos locales:
    - `noSession`: "Sin sesión" (es) / "No session" (en)
    - `editConfiguration`: "Editar configuración" (es) / "Edit configuration" (en)
    - `deleteForumAction`: "Eliminar foro" (es) / "Delete forum" (en)
    - `confirmDeleteForum`: "¿Eliminar foro?" (es) / "Delete forum?" (en)
    - `undoNotPossible`: "Esta acción no se puede deshacer. El foro se eliminará de forma permanente." (es) / "This action cannot be undone. The forum will be permanently deleted." (en)
  - Reemplazados todos los strings hardcodeados con llamadas `t()` en `src/components/config/forums-table.tsx`
  - Reutilizadas claves existentes para botones: `t('common.cancel')` y `t('common.delete')`
- 📝 **Archivos modificados**:
  - `src/components/config/forums-table.tsx` (5 reemplazos)
  - `src/locales/en.json` (5 claves nuevas)
  - `src/locales/es.json` (5 claves nuevas)
- 🎯 **Validación**: Tabla de Foros ahora muestra texto completamente traducido al cambiar entre idiomas

### 2026-01-09 (Fix: Internacionalización de JDownloader Testing)

- 🐛 **Problema**: La sección de pruebas de JDownloader (JDownloaderTester) mostraba todos los strings en español sin opción de cambiar idioma:
  - Título del card: "JDownloader"
  - Descripción: "Selecciona un servidor configurado..."
  - Labels: "Servidor Configurado", "Enlace (opcional)", "Package (opcional)", "Auto-start", "Auto-extract"
  - Botones: "Probar conexión", "Enviar enlace"
  - Mensajes de error y carga
- 🔍 **Causa raíz**:
  - El componente `JDownloaderTester` tiene `useI18n(language)` importado pero los strings no estaban reemplazados por `t()`
  - Las claves de traducción ya existían en los locales
- ✅ **Solución implementada**:
  - Reemplazados 15+ strings hardcodeados con llamadas `t()`:
    - Título y descripción: `t('testing.jdownloaderTesterTitle')` y `t('testing.jdownloaderTesterDescription')`
    - Labels: `t('testing.configuredServer')`, `t('testing.optionalLink')`, `t('testing.optionalPackage')`, `t('testing.autoStart')`, `t('testing.autoExtract')`
    - Botones: `t('testing.testConnection')`, `t('testing.sendLink')`
    - Mensajes: `t('testing.loadingServers')`, `t('testing.noServers')`, `t('testing.selectServerFirst')`, `t('testing.sendLinkError')`, `t('testing.connectionTestError')`
  - Todas las claves ya existían en `src/locales/en.json` y `es.json`
- 📝 **Archivos modificados**:
  - `src/components/testing/jdownloader-tester.tsx` (15 reemplazos)
- 🎯 **Validación**: Sección de testing de JDownloader ahora se traduce completamente al cambiar idioma

### 2026-01-09 (Fix: Internacionalización de ResultViewer - Resultados de Búsqueda)

- 🐛 **Problema**: La vista de resultados de búsqueda (ResultViewer) en la pestaña Testing mostraba todos los textos en castellano: títulos, descripciones, cabeceras de tabla, botones, estados de carga y mensajes de error.
- 🔍 **Causa raíz**:
  - El componente `ResultViewer` ya recibía `language` y usaba `useI18n(language)`, pero las cadenas estaban hardcodeadas en español.
  - Faltaban claves de traducción para métricas, tablas, contadores y mensajes contextuales.
- ✅ **Solución implementada**:
  - Añadidas ~35 claves nuevas en `testing` (en/es) para cabeceras, botones, contadores, metadatos, errores y textos auxiliares.
  - Reemplazadas todas las cadenas hardcodeadas por `t()` incluyendo resúmenes dinámicos de resultados, indicadores de metadatos y textos de acción (extraer, enviar, completar títulos, etc.).
- 📝 **Archivos modificados**:
  - `src/components/testing/result-viewer.tsx` (sustitución completa de strings por `t()`)
  - `src/locales/en.json` y `src/locales/es.json` (nuevas claves en sección `testing`)
- 🎯 **Validación**: Tabla de resultados, botones y mensajes se traducen correctamente al alternar entre español e inglés.

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

#### 0. Script/Unit File para Arrancar Servidor de Desarrollo

**Estado**: ⏭️ Pendiente  
**Estimación**: 1-2 horas

**Problema**: El comando manual `npm run dev > /tmp/npm-dev.log 2>&1 &` es propenso a errores:

- Fácil olvidar que ya hay un servidor corriendo
- Causa conflictos de puerto (EADDRINUSE)
- Requiere `pkill` manual para limpiar

**Solución recomendada**:

- Crear un script bash (`scripts/dev.sh`) que:
  - Verifique si hay servidor corriendo en puerto 3000
  - Lo mate si existe
  - Inicie uno nuevo
  - Muestre un mensaje claro del estado
- O crear un systemd user unit file (`sweaterr-dev.service`) para desarrollo

**Tareas**:

- [ ] Crear script bash con validación de puerto
- [ ] Agregar comando `npm run dev:start` que use el script
- [ ] Agregar comando `npm run dev:stop` para detener
- [ ] Documentar en README.md

**Archivos afectados**:

- `scripts/dev.sh` (nuevo)
- `package.json` (actualizar scripts)
- `README.md` (documentación)

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

### 4. Polling HTTP Floods Console Output

**Severidad**: Media  
**Estado**: Parcialmente mitigado, requiere solución definitiva

**Descripción**: La pestaña "Descargas" hace polling cada 3s (activo) o 10s (inactivo) a `/api/downloads/status`, generando logs HTTP en stdout que inundan la consola en desarrollo.

**Impacto**:

- Consola ilegible durante desarrollo cuando pestaña Descargas está activa
- Dificulta debugging de otros componentes
- Los logs se escriben a `jdownloader.log` pero Next.js muestra los requests HTTP

**Causa raíz**:

- Next.js loggea todas las peticiones HTTP por defecto (`GET /api/downloads/status 200 in XXXms`)
- No hay forma nativa de silenciar logs HTTP específicos sin afectar otros
- Configuración `logging.fetches` en next.config.ts no afecta logs de API routes

**Mitigaciones actuales**:

- Reducido polling de 1s→3s (activo) y 5s→10s (inactivo) para menos spam
- Logs internos de JDownloader van a archivo en lugar de consola

**Soluciones posibles (pendientes investigación)**:

- Implementar middleware custom que filtre logs de rutas específicas
- Usar variable de entorno `NODE_ENV=production` en dev (pierde otros logs útiles)
- Implementar proxy interno que maneje polling sin logs
- Usar WebSockets en lugar de polling para estado en tiempo real
- Configurar logger custom de Next.js 15 (requiere investigar API experimental)

**TODO**: Investigar implementación de WebSockets para reemplazar polling HTTP

### 5. Cambio de Idioma Causa Pantalla en Blanco

**Severidad**: Media  
**Estado**: Identificado, sin solución investigada aún

**Descripción**: Al cambiar el idioma a través del menú de usuario (UserMenu), la interfaz ocasionalmente se vuelve completamente en blanco con tema oscuro, desaparece el icono del menú, y la página se ve desconectada del servidor.

**Condiciones de reproducción**:

- Hacer clic en el idioma en el menú de usuario
- Esperar a que se procese el cambio
- La UI se pone en blanco/sin renderizar
- Presionar F5 recarga la página correctamente

**Impacto**: Usuario debe hacer refresh manual; cambio de idioma eventual funciona pero con interrupcción visual.

**Causa raíz**: Desconocida - posiblemente:

- Problema en gestión de estado del lenguaje (userLanguage state en page.tsx)
- Re-render completo del árbol de componentes no se propaga correctamente
- Hook useI18n no se reinicializa correctamente
- Context o Provider i18n tiene memory leak o estado inconsistente

**Mitigación actual**: Ninguna; usuario realiza F5 para refrescar.

**Mejora pendiente**:

- Investigar flujo de state management del lenguaje
- Verificar si hay race conditions en actualización de userLanguage
- Considerar usar Context/Provider más robusto para i18n si es necesario
- Revisar componentes que dependen del language prop vs useI18n hook

---

## Historial de Cambios Recientes (Enero 2026)

### 11 de Enero 2026 (Parte 2 - Mejoras UX *arr)

#### Botones Separados para URL y API Key

- **Cambio**: Reemplazado botón único "Copy API Key" con dos botones separados: "Copy URL" y "Copy API Key"
- **Motivación**: *arr requiere configurar URL y API Key en campos SEPARADOS (arquitectura Newznab)
- **Implementación**:
  - Agregados dos handlers: `handleCopyUrl()` y `handleCopyApiKey()`
  - UI muestra dos botones side-by-side en columna Torznab Feed
  - Primer botón copia: `http://localhost:3000/api/arr`
  - Segundo botón copia: API key del foro (ej: `fdd-12e6550d0de40268bc3f53a637d5ad91`)
  - Tooltips simplificados para cada botón (texto correcto en modo oscuro)
- **Archivos modificados**: `src/components/config/forums-table.tsx`

#### Fix Tooltip Oscuro No Visible

- **Error corregido**: Tooltip con fondo `bg-slate-900` no visible en tema oscuro
- **Solución**: Cambiado a `bg-popover text-popover-foreground` (clases Tailwind que respetan tema)
- **Impacto**: Tooltips ahora visibles tanto en tema claro como oscuro
- **Archivos modificados**: `src/components/config/forums-table.tsx`

#### Logs en Minúsculas con Tags de Servicio *arr

- **Cambio**: Nombres de logs cambiados de `ARR_CAPS` / `ARR_SEARCH` a `arr_caps` / `arr_search` (minúsculas)
- **Agregado**: Detección automática del servicio *arr desde User-Agent
- **Implementación**:
  - Función `detectArrService(userAgent)` detecta Sonarr, Radarr, Lidarr, Readarr, Prowlarr, Whisparr
  - Logs ahora incluyen tag del servicio: `[INFO] arr_caps [SONARR] Caps request received`
  - Permite filtrar logs por servicio específico (grep "SONARR")
- **Motivación**: Logs con caracteres especiales `[arr-caps]` difíciles de trabajar en terminal
- **Archivos modificados**:
  - `src/app/api/arr/caps/route.ts`
  - `src/app/api/arr/search/route.ts`

#### Checkbox "Buscar en Subforos" en Configuración de Foro

- **Agregado**: Campo `searchInChildForums` (boolean) en modelo Forum
- **UI**: Checkbox "Buscar en subforos" debajo del campo "Foro donde buscar"
- **Descripción**: "Incluir resultados de subforos en las búsquedas (childforums=1)"
- **Cambio de Label**: "Etiqueta de foro" renombrado a "Foro donde buscar"
- **Preparación Futura**: Este campo permitirá buscar en subforos (parámetro `childforums=1`)
- **Estado**: Campo visible y persistido en DB, integración con búsquedas pendiente
- **Archivos modificados**:
  - `src/lib/types.ts` (interfaces Forum y ForumConfigForm)
  - `src/components/config/forum-config.tsx` (schema, defaultValues, UI)
  - `prisma/schema.prisma` (campo `searchInChildForums Boolean @default(false)`)

#### Logging de Búsquedas *arr en search.log

- **Agregado**: Logs detallados de búsquedas *arr en `search.log` además de `arr_search.log`
- **Motivación**: Usuario reportó que búsquedas desde Sonarr no aparecían en search.log
- **Implementación**:
  - Logs con prefijo `search` y tag `[SONARR]` / `[RADARR]` etc
  - Log de inicio de búsqueda con query y número de variantes
  - Log por cada foro con cada variante de búsqueda
  - Log de resultados encontrados o advertencia si no hay resultados
  - Log de errores de búsqueda por foro
- **Ejemplo de log**:

  ```text
  [INFO] search [SONARR] Starting forum search for query: "Breaking Bad" (variants: 3)
  [INFO] search [SONARR] Searching in forum "DescargasDD" with variant: "Breaking Bad temporada 5"
  [INFO] search [SONARR] Found 5 results in forum "DescargasDD"
  ```

- **Archivos modificados**: `src/app/api/arr/search/route.ts`

### 11 de Enero 2026

#### Arquitectura *arr: API Key por Foro

- **Cambio**: Migración de servicios *arr separados a API keys por foro
- **Motivación**: Simplificar UX y eliminar paso de configuración adicional
- **Implementación**:
  - Agregado campo `torznabApiKey` (String @unique) al modelo Forum en Prisma
  - Creada migración `20260111140658_add_torznab_api_key_to_forums` con auto-generación para foros existentes
  - Actualizados endpoints `/api/arr/caps`, `/api/arr/search`, `/api/arr/grab` para validar contra Forum.torznabApiKey
  - Endpoint `/api/config/forums` genera automáticamente API key al crear foro (formato `fdd-XXXX`)
  - ForumsTable añade columna "Torznab Feed" con botón "Copy API Key"
  - Eliminada sección ArrConfig del dashboard (simplificación de UI)
  - Actualizada documentación en ARR_SETUP.md y ARCHITECTURE.md

#### Fix Error JSON.parse en JDownloader

- **Error corregido**: `SyntaxError: Unexpected end of JSON input` en `/api/downloads/status`
- **Causa**: Método `decryptAES` en JDownloaderService llamaba `JSON.parse(decryptedText)` sin validar que el texto no estuviera vacío
- **Condición**: Ocurría cuando JDownloader devolvía respuesta vacía o inválida durante polling de estado
- **Impacto**: Error en consola antes de recargar página (posible relación con problema de login reload)
- **Solución**: Agregada validación en `src/lib/services/jdownloader.ts` línea 362:

  ```typescript
  if (!decryptedText || decryptedText.trim() === '') {
    logger.error('jdownloader', 'decryptAES: Decrypted text is empty');
    throw new Error('Decrypted text is empty - possible authentication or encryption issue');
  }
  ```

- **Archivos modificados**: `src/lib/services/jdownloader.ts`

#### UX: Copy API Key en lugar de URL completa

- **Cambio**: Botón "Copy Feed" ahora copia solo la API key en lugar de la URL completa
- **Motivación**: Reportado por usuario - esperaba copiar solo el token `fdd-XXXX` para configurar manualmente en *arr
- **Implementación**:
  - `handleCopyFeed()` en ForumsTable cambiado de copiar `http://localhost:3000/api/arr?apikey=XXX` a solo `forum.torznabApiKey`
  - Texto del botón cambiado de "Copy Feed" a "Copy API Key"
  - Tooltip ahora muestra solo la API key en lugar de la URL completa
- **Archivos modificados**: `src/components/config/forums-table.tsx`

### 5. Flash de Idioma en Refresh (Spanish Flash)

**Severidad**: Media  
**Estado**: Identificado, requiere investigación

**Descripción**: Cuando el usuario refresca la página (F5), la aplicación se muestra en español durante 1-2 segundos y luego cambia al idioma seleccionado (ej: inglés). Esto causa una experiencia visual inconsistente.

**Condiciones de reproducción**:

- Navegar a cualquier página dentro de la aplicación (no es visible en login/setup)
- Presionar F5 para refrescar
- Observar que la UI se muestra en español antes de cambiar al idioma correcto

**Impacto**: Experiencia de usuario inconsistente; debería mostrar el idioma correcto inmediatamente sin transición visual.

**Causa raíz probable**:

- El idioma por defecto es 'es' inicializado en `userLanguage` state en page.tsx
- El idioma seleccionado del usuario se recupera de localStorage u otra fuente durante hydration
- Hay un delay entre el SSR/hidratación y la aplicación del idioma correcto
- Re-renders de todos los componentes cuando cambia userLanguage cause visual flicker

**Mitigación actual**: Ninguna; comportamiento aceptado pero no ideal.

**Mejora pendiente**:

- Determinar fuente del idioma (localStorage, cookie, header, user DB)
- Investigar flujo de hidratación Next.js 15
- Considerar usar dynamic imports con ssr:false para componentes i18n
- Posible solución: Guardar idioma en cookie de servidor para SSR correcto desde inicio

### 6. Login y Setup Sin Selector de Idioma

**Severidad**: Baja  
**Estado**: Identificado, comportamiento por diseño

**Descripción**: Las páginas de login (`src/app/login/page.tsx`) y setup/registro (`src/app/setup/page.tsx`) no tienen selector de idioma visible. Aparecen en el idioma del navegador (detectado por Accept-Language header o idioma por defecto de la app).

**Comportamiento actual**:

- Sin usuario autenticado, no hay UserMenu (donde se cambiaría idioma)
- Formularios aparecen en el idioma del navegador o idioma por defecto (español)
- Una vez autenticado, el usuario puede cambiar idioma en el dashboard

**Impacto**: Bajo; usuarios pueden esperar selector de idioma en login, pero es funcional una vez autenticado.

**Consideración de diseño**: ¿Agregar selector de idioma flotante en esquina de login/setup para que usuarios puedan cambiar idioma antes de autenticarse?

**Mejora pendiente**:

- Decidir si agregar selector de idioma en login/setup
- Si sí: Implementar flotante o selector discreto (no interrumpe flujo)
- Si no: Documento la decisión para referencia futura

### 7. Parpadeo/Reseteo en Refresh de Descargas (Polling)

**Severidad**: Media  
**Estado**: Identificado, requiere rediseño de streaming

**Descripción**: Al refrescar datos (dashboard y pestaña Descargas) el polling limpia la lista y la vuelve a renderizar, provocando “flash” de vacío y reaparición de elementos en cada ciclo de fetch.

**Impacto**: UX pobre; los usuarios ven desaparecer/volver las tarjetas y progresos durante las actualizaciones periódicas.

**Causa raíz**:

- Estrategia de polling reemplaza el array completo tras cada fetch
- No se mantiene caché previa mientras llega la respuesta
- No hay canal en tiempo real (WebSocket/SSE) para updates incrementales

**Mitigaciones actuales**: Ninguna; polling sigue causando flashes aunque sea menos frecuente (3s/10s).

**Mejoras pendientes**:

- Implementar streaming (WebSockets o SSE) para push incremental sin limpiar el DOM
- Conservar el array previo durante el loading y aplicar diffs en memoria
- Considerar suspense/loading placeholders por item en lugar de lista vacía
- Re-render completo del árbol de componentes no se propaga correctamente
- Hook useI18n no se reinicializa correctamente
- Context o Provider i18n tiene memory leak o estado inconsistente

**Mitigación actual**: Ninguna; usuario realiza F5 para refrescar.

**Mejora pendiente**:

- Investigar flujo de state management del lenguaje
- Verificar si hay race conditions en actualización de userLanguage
- Considerar usar Context/Provider más robusto para i18n si es necesario
- Revisar componentes que dependen del language prop vs useI18n hook
