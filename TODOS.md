# TODOs Pendientes - Sweaterr

Estado: 11 de enero de 2026

## ✅ COMPLETADOS RECIENTES

- 2026-01-30: Real-time speed and ETA for Sonarr Activity via package-level JDownloader sync.
- 2026-01-28: Synced JDownloader progress to ARR downloads and enabled auto-start/auto-extract in the qBittorrent facade.

## 🔴 CRÍTICOS (Afectan UX/Functionality)

### 0. **Docker Compose: Imagen con nombre genérico y healthcheck robusto** ✅

- **Severidad**: Media (UX/infraestructura)
- **Área**: Docker (`docker-compose.yml`, `Dockerfile`)
- **Estado**: ✅ **COMPLETADO** (22 de enero 2026)
- **Problemas corregidos**:
  1. Docker Compose generaba nombre de imagen `sweaterr-sweaterr` (patrón `{dir}-{service}`) → Cambiar a `sweaterr:latest`
  2. Healthcheck fallaba con "Connection refused" en primeros 40s (Prisma migrations + build startup tardan más) → Aumentar `start_period` a 60s
  3. Warning: "Docker Compose requires buildx plugin" al ejecutar `docker-compose build` → Documentado en TODOS.md como FYI (no es error crítico, solo warning)
- **Cambios**:
  - `docker-compose.yml`: Agregar `image: sweaterr:latest` en servicio sweaterr
  - `docker-compose.yml`: Aumentar `start_period: 60s` en healthcheck
  - Documentación en este TODO para futuras builds
- **Resultado**:
  - ✅ Imagen se llama `sweaterr:latest` en lugar de `sweaterr-sweaterr`
  - ✅ Healthcheck acepta arrancada lenta sin "unhealthy" falso
  - ✅ Warning buildx es opcional (informativo, no bloquea)
- **Horas invertidas**: ~0.5 horas
- **Prioridad**: ✅ COMPLETADO

### 1. **Implementación Endpoint *arr (Torznab Bridge)** 🔗 ✅

- **Severidad**: Crítica (funcionalidad core)
- **Área**: Backend API (`src/app/api/arr/*`)
- **Estado**: ✅ **COMPLETADO** (11 de enero 2026)
- **Problema**: Sweaterr debe actuar como indexer Torznab para *arr (Sonarr/Radarr/Lidarr)
- **Funcionalidad implementada**:
  - [x] Endpoint `GET /api/arr?t=caps` que devuelve capacidades Torznab
  - [x] Endpoint `GET /api/arr?t=search|tvsearch|movie` para búsquedas
  - [x] *arr hace peticiones → sweaterr busca en foros → devuelve RSS/XML
  - [x] Usuario selecciona resultado en *arr →*arr envía a sweaterr como descarga
  - [x] Endpoint `GET /api/arr?t=get&guid=X` extrae enlaces y envía a JDownloader
  - [x] Sweaterr crea Download record con tag *arr y metadata
  - [x] Endpoint `POST /api/arr/notify` recibe webhooks de *arr
  - [x] Webhooks actualizan estado de Download (Grab→downloading, Download→completed)
  - [x] Sistema de API keys por servicio *arr (Sonarr, Radarr, Lidarr, Readarr)
  - [x] GUID mejorado: Base64url JSON para evitar parsing de URLs con caracteres especiales
  - [x] Variantes de búsqueda en español (T1, 1x01, Temporada 1, S01E01)
  - [x] Placeholders para evitar errores de indexer offline
- **Archivos creados/modificados**:
  - `src/app/api/arr/route.ts` - Dispatcher unificado
  - `src/app/api/arr/caps/route.ts` - Capacidades Torznab
  - `src/app/api/arr/search/route.ts` - Búsquedas con variantes español
  - `src/app/api/arr/grab/route.ts` - Extracción de enlaces y envío a JD
  - `src/app/api/arr/notify/route.ts` - Webhooks y actualización de estado
  - `src/app/api/config/arr/route.ts` - CRUD de servicios *arr
  - `src/app/api/config/arr/[id]/route.ts` - Operaciones individuales (con await params Next.js 15)
  - `src/components/config/arr-config.tsx` - UI de configuración
- **Documentación**: Sección completa en ARCHITECTURE.md con guía de configuración
- **Horas estimadas**: 8-10 horas ➡️ **Invertidas**: ~6 horas
- **Prioridad**: 🔥 COMPLETADO
- **Próximos pasos opcionales**:
  - Integración IA para parsing de títulos (enriquecimiento de metadatos)
  - Testing end-to-end con instancia real de Sonarr/Radarr
  - Rate limiting por foro para evitar baneos
  - Fallback de búsqueda por "Alternate Titles" para mejorar matching según idioma del foro
  - Validar y cerrar empaquetado Docker (imagen + compose) para despliegue reproducible

### 1.1. **Cambiar Arquitectura *arr: API Key por Foro** ✅

- **Severidad**: Alta (Mejora de UX)
- **Área**: Backend/Frontend (`src/app/api/arr/*`, `src/components/config/forums-table.tsx`)
- **Estado**: ✅ **COMPLETADO** (11 de enero 2026)
- **Problema**: Usuarios tenían que crear servicios *arr separados manualmente
- **Solución implementada**:
  - [x] Agregar campo `torznabApiKey` al modelo `Forum` (Prisma)
  - [x] Generar API key automáticamente al crear forum (formato `fdd-XXXX`)
  - [x] Migración para añadir API keys a forums existentes
  - [x] Actualizar todos los endpoints `/api/arr/*` para validar contra `Forum.torznabApiKey`
  - [x] Eliminar necesidad de tabla/UI de `ArrService`
  - [x] Añadir columna "Torznab Feed" en tabla de Foros
  - [x] Botón "Copy API Key" para copiar solo el token (estilo Jackett)
- **Ventajas**:
  - No requiere configuración adicional de servicios
  - Cada forum = indexer independiente
  - Interfaz simple con botón Copy API Key
  - Flexible: mismo forum en múltiples *arr
- **Archivos modificados**:
  - `prisma/schema.prisma` - Campo `torznabApiKey` en Forum
  - `src/app/api/arr/caps/route.ts` - Validación por forum
  - `src/app/api/arr/search/route.ts` - Validación por forum
  - `src/app/api/arr/grab/route.ts` - Validación por forum
  - `src/app/api/config/forums/route.ts` - Generación automática de API key
  - `src/components/config/forums-table.tsx` - Columna "Torznab Feed" con Copy button
  - `src/app/page.tsx` - Eliminada sección ArrConfig
  - `docs/ARR_SETUP.md` - Guía actualizada
  - `ARCHITECTURE.md` - Documentación de nueva arquitectura
- **Horas invertidas**: ~2 horas

### 2. **Formulario de Login se Recarga a Sí Mismo**

- **Severidad**: Alta (UX confusa)
- **Área**: Frontend Auth (`src/app/login/page.tsx`)
- **Problema**: Primera vez que inicia sesión, el form se recarga; segunda vez entra correctamente
- **Nota adicional**: Podría estar relacionado con el error `SyntaxError: Unexpected end of JSON input` que ocurre justo antes de recargar
- **Impacto**: Usuario se confunde, piensa que falló el login cuando en realidad está cargando
- **Causa probable**:
  - Redirect post-login causa re-render antes de que navegador procese el cambio
  - Error en `/api/downloads/status` al desencriptar respuesta vacía de JDownloader
- **Tareas**:
  - [x] Agregar validación en `decryptAES` para evitar JSON.parse de string vacío
  - [ ] Verificar lógica de post-submit en login form
  - [ ] Verificar lógica de post-submit en login form
  - [ ] Validar que el redirect a `/` es inmediato (no hay delay)
  - [ ] Mostrar spinner/loading state hasta que redirection ocurra
  - [ ] Tests: login → dashboard sin re-renderizar form
- **Estimación**: 1-2 horas

### 3. **Sistema de Seguridad / Session Persistence**

- **Severidad**: Alta (Seguridad)
- **Área**: Auth/Middleware (`src/middleware.ts`, `src/app/api/auth/*`)
- **Problema**:
  - Usuario mata servidor e inicia de nuevo horas/días después
  - Navegador todavía tiene la página cargada (cached)
  - No ve icono de usuario ni configuración (admin-only)
  - Debe saber que iniciar sesión nuevamente; URL no debería cambiar
  - Debería redirigirse automáticamente a `/login` si la sesión expiró
- **Solución**:
  - [ ] Middleware valida JWT en cada request
  - [ ] Si token expirado/inválido → redirige a `/login`
  - [ ] UI detecta sesión inválida y muestra modal/toast "Tu sesión expiró"
  - [ ] Actualizar el token silenciosamente si es posible (refresh token pattern)
  - [ ] Botón "Reintentar" en lugar de recargar página manualmente
  - [ ] Si no hay usuario autenticado, bloquear acceso a cualquier página y redirigir a `/login`
  - [ ] En el formulario de login, añadir enlaces visibles a "Register" y "Forgot password"
- **Archivos**: `src/middleware.ts`, `src/hooks/use-api.ts` (agregar interceptor 401)
- **Estimación**: 2-3 horas

### 4. **Parpadeo/Flicker en Dashboard y Descargas** ⚠️

- **Severidad**: Alta
- **Área**: Frontend (page.tsx, downloads-manager.tsx)
- **Problema**: El polling reemplaza arrays completos cada 3-10 segundos, causando flash de vacío y re-render total de listas
- **Impacto**: UX pobre; tarjetas/elementos desaparecen y reaparecen constantemente
- **Soluciones propuestas**:
  - Implementar WebSockets/SSE para push incremental sin limpiar DOM
  - Mantener array previo y aplicar diffs locales
  - Usar Suspense/loading placeholders por item
- **Archivos afectados**: `src/app/page.tsx`, `src/components/downloads/downloads-manager.tsx`
- **Estimación**: 4-6 horas

### 5. **Reload Completo de UI Cada Pocos Segundos** ✅

- **Severidad**: Crítica (UX bloqueada) ➡️ **RESUELTO**
- **Área**: Frontend/App Router (`src/app/page.tsx`, `src/hooks/use-api.ts`, `next.config.ts`, `src/lib/logger.ts`, `src/contexts/downloads-context.tsx`)
- **Estado**: ✅ **COMPLETADO** (15 de enero 2026) - Branch `fix/prevent-constant-reloads` con 7 commits
- **Problema**: La UI se recargaba COMPLETA cada pocos segundos en desarrollo, especialmente con descargas activas de JDownloader; polling disparaba reload total en vez de refresco de datos
- **Impacto**: Formularios, configuraciones y descargas eran inutilizables; imposible interactuar con la interfaz
- **Root causes identificados**:
  1. Webpack watchando logs/db-journal en project root causaba file-change reloads
  2. `useEffect` sin dependency array en `/api/auth/me` causaba auth token log spam
  3. useEffect con `downloads` en dependency array causaba re-renders en cascada
  4. Logger escribiendo en project root en lugar de `/logs` (Webpack watchers detectaban cambios)
  5. Múltiples polling intervals activos en desarrollo (30s, 10s, 3s)
  6. Interval de velocidad con `activeDownloadsCount` en dependencies se recreaba constantemente
  7. **Arquitectura incorrecta**: Estado de descargas en componente page.tsx causaba full page re-renders
- **Solución implementada (7 commits)**:
  - **Commit dbe2220**: Webpack watchOptions ignoring logs/db files
  - **Commit 6e505fa**: Fixed auth useEffect dependency array
  - **Commit 4999814**: Changed downloads to useRef to prevent dependency issues
  - **Commit 3c1ec00**: Logger absolute path fix (prevents root logs)
  - **Commit 2535386**: Disabled polling in development mode for all hooks
  - **Commit 8ba841a**: Fixed download speed polling interval dependency
  - **Commit eb41940**: **Refactor arquitectural - React Context isolation**
    - Creado `src/contexts/downloads-context.tsx` con `DownloadsProvider` y `useDownloadsContext()`
    - Movida lógica de polling de descargas del componente `page.tsx` al provider del contexto
    - Solo componentes que consumen el contexto se re-renderizan al actualizar descargas
    - Previene full page re-renders cuando cambian estadísticas de descargas
    - Polling: 10s para JDownloader, 30s para DB downloads
- **Archivos modificados**:
  - `next.config.ts` - watchOptions para ignorar logs/db
  - `src/lib/logger.ts` - Path absoluto a /logs
  - `src/hooks/use-api.ts` - Polling disabled en dev
  - `src/components/config/forums-table.tsx` - Polling disabled en dev
  - `src/components/config/forum-session-settings.tsx` - Polling disabled en dev
  - `src/components/downloads/downloads-manager.tsx` - Polling disabled en dev
  - `src/contexts/downloads-context.tsx` - **NUEVO** - Context provider con polling aislado
  - `src/app/page.tsx` - Refactorizado para usar context
- **Resultado**:
  - ✅ Página ya no se recarga en desarrollo sin descargas activas
  - ✅ Con descargas activas, solo componentes específicos se re-renderizan
  - ✅ Arquitectura correcta: estado global en contexto, no en componente individual
  - ✅ Build verificado sin errores de prerendering
- **Horas invertidas**: ~4 horas
- **Prioridad**: ✅ RESUELTO

### 6. **Passwords en Texto Plano en BD**

- **Severidad**: Media (Seguridad)
- **Área**: Auth/Config
- **Problema**: Credenciales (JDownloader, Foros, IA) se almacenan sin encriptar
- **Tareas**:
  - [ ] Implementar encriptación AES/bcrypt antes de guardar
  - [ ] Actualizar migration de Prisma
  - [ ] Validar compatibilidad con login actual
- **Archivos**: `src/app/api/config/*`, Prisma schema

### 7. **Sin Rate Limiting**

- **Severidad**: Media
- **Problema**: Riesgo de ban en foros por exceso de requests
- **Soluciones**:
  - [ ] Throttling en `cloudflare-handler.ts` (min 1 req/segundo por foro)
  - [ ] Configuración por foro (TTL de throttle)
- **Estimación**: 2-3 horas

## 🟡 IMPORTANTES (Features/Polish)

### 4. **Procesos Chromium Acumulándose - FlareSolverr**

- **Severidad**: Media
- **Problema**: SessionManager cleanup no destruye sesiones correctamente, dejan procesos huérfanos
- **Tareas**:
  - [ ] Agregar logging detallado en cleanup task
  - [ ] Validar ejecución de `destroySession()`
  - [ ] Crear endpoint `/api/check/flaresolverr-sessions` para diagnóstico
  - [ ] UI de debug para ver sesiones activas
- **Estimación**: 3-4 horas

### 5. **Selectores CSS Sin Verificación**

- **Problema**: No está claro si los selectores CSS configurados en UI se usan realmente en extracción de enlaces
- **Tareas**:
  - [ ] Verificar que `extract-links/route.ts` recibe y usa los selectores
  - [ ] Agregar logs: "Using selectors: {thankButton, linksContainer, postTitle}"
  - [ ] Documentar flujo de selectores en ARCHITECTURE.md
  - [ ] Tests E2E con selectores custom
- **Estimación**: 2-3 horas

### 6. **Sin Timeouts Largos / UI Congelada**

- **Problema**: Test de conexión a foros tarda ~30s, UI se cuelga sin feedback
- **Tareas**:
  - [ ] Implementar AbortController con timeout (15s)
  - [ ] Mostrar spinner/progress durante conexión
  - [ ] Toast de "Timeout - reintenta" en caso de fallo
- **Estimación**: 2 horas

### 7. **Detección de Idiomas Mejorada**

- **Problema**: Regex no detecta abreviaturas (Jap, Esp) ni formatos con slash (Audio1/Audio2)
- **Tareas**:
  - [ ] Mejorar regex con abreviaturas comunes
  - [ ] Detectar "/Subs" patterns
  - [ ] Usar IA como fallback para casos complejos
  - [ ] Tests con ejemplos reales
- **Archivos**: `src/app/api/testing/metadata/route.ts`
- **Estimación**: 3 horas

### 8. **Tablas Dinámicas Series vs Películas**

- **Problema**: Tabla de resultados mezcla series y películas con columnas inapropiadas (Season/Episode para películas)
- **Tareas**:
  - [ ] Agregar Select en tester para filtrar por tipo
  - [ ] Renderizar columnas dinámicas (Series: Season, Episode | Películas: Year, Quality)
  - [ ] API filtering opcional
- **Archivos**: `src/components/testing/search-tester.tsx`, `result-viewer.tsx`
- **Estimación**: 2-3 horas

### 9. **Configuración de FlareSolverr desde UI**

- **Severidad**: Media (Usabilidad)
- **Área**: Backend/Frontend (`src/app/api/config/flaresolverr/*`, `src/components/config/*`, Prisma schema)
- **Problema**: Actualmente FlareSolverr se configura vía variable de entorno `FLARESOLVERR_URL` en `.env.local`; no es configurable dinámicamente desde la UI
- **Funcionalidad**:
  - [ ] Crear tabla `FlareSolverrConfig` en Prisma (url, timeout, enabled, createdAt, updatedAt)
  - [ ] API endpoints: `GET/POST /api/config/flaresolverr` para CRUD
  - [ ] Componente UI en pestaña Configuración: formulario con URL y timeout (ms)
  - [ ] Fallback a variable de entorno si no existe config en BD
  - [ ] Test de conexión desde UI (ping `/health` endpoint de FlareSolverr)
  - [ ] Validación: URL debe ser http/https, timeout entre 5000-60000ms
  - [ ] Actualizar `cloudflare-handler.ts` y `flaresolverr-client.ts` para leer de BD primero
- **Beneficios**: Configuración más accesible sin editar archivos; ajuste de timeout por usuario
- **Archivos**:
  - `prisma/schema.prisma` (nueva tabla FlareSolverrConfig)
  - `src/app/api/config/flaresolverr/route.ts` (nuevo)
  - `src/components/config/flaresolverr-config.tsx` (nuevo)
  - `src/lib/services/cloudflare-handler.ts` (leer config de BD)
  - `src/hooks/use-api.ts` (añadir `useFlareSolverrConfig()`)
- **Estimación**: 3-4 horas

### 10. **Integración con Inteligencia Artificial**

- **Severidad**: Alta (Feature core para automatización)
- **Área**: Backend/IA (`src/app/api/ai/*`, `src/lib/services/ai/*`, Prisma schema)
- **Problema**: Dos casos de uso críticos para automatización:
  1. **Resolución de nombres de hilos a formato "scene"**: Extraer metadatos estructurados (calidad, episodios, idiomas, codec) desde títulos de foros caóticos
  2. **Generación de comentarios automáticos**: Muchos foros banean usuarios inactivos; IA debe comentar de forma natural para evitar suspensiones
- **Funcionalidad Caso 1 - Resolución de Nombres**:
  - [ ] Endpoint `/api/ai/parse-title` que recibe título de foro y devuelve JSON estructurado
  - [ ] Extracción: season, episode, quality (720p/1080p/4K), codec (x264/x265/AV1), audio (AAC/DTS/AC3), idiomas
  - [ ] Fallback a regex si IA falla
  - [ ] Integración con búsqueda de foros: normalizar resultados antes de enviar a *arr
  - [ ] Cache de parsing (evitar llamadas duplicadas para mismo título)
- **Funcionalidad Caso 2 - Comentarios Humanos**:
  - [ ] Endpoint `/api/ai/generate-comment` con contexto del hilo (título, primeros posts)
  - [ ] Generar comentarios naturales, variados, coherentes con temática
  - [ ] Configuración: frecuencia de comentarios (N descargas = 1 comentario), blacklist de frases spam
  - [ ] UI en Configuración: toggle "Auto-comentar", templates personalizables
  - [ ] Tracking de comentarios enviados por foro (evitar spam)
  - [ ] Validación: longitud mínima/máxima, no repetir comentarios
- **Archivos**:
  - `src/lib/services/ai/title-parser.ts` (caso 1)
  - `src/lib/services/ai/comment-generator.ts` (caso 2)
  - `src/app/api/ai/parse-title/route.ts` (nuevo)
  - `src/app/api/ai/generate-comment/route.ts` (nuevo)
  - `prisma/schema.prisma` (tabla AIComments: forumId, postUrl, generatedText, sentAt)
  - `src/components/config/ai-config.tsx` (UI para configurar ambos casos)
- **Beneficios**:
  - Caso 1: *arr puede mapear correctamente releases de foros a metadatos estructurados
  - Caso 2: Usuario evita baneos por inactividad, mantiene cuentas válidas
- **Dependencias**: Requiere configuración OpenAI/Anthropic en settings (ya existe AIConfig en schema)
- **Estimación**: 10-12 horas (6h caso 1, 4h caso 2, 2h UI)
- **Prioridad**: Alta (relacionado con TODO #1 *arr Torznab; el parsing de nombres es esencial para matching)

### 11. **Soporte PostgreSQL**

- **Severidad**: Media (Escalabilidad)
- **Área**: Backend/Infraestructura (`prisma/schema.prisma`, `.env`, Docker)
- **Problema**: Actualmente sweaterr usa SQLite (`file:./dev.db`), que es limitado para producción multi-usuario o despliegues escalables
- **Funcionalidad**:
  - [ ] Actualizar Prisma schema para soportar PostgreSQL (dual provider o switch)
  - [ ] Crear migration script para migrar de SQLite a PostgreSQL
  - [ ] Configuración vía variable de entorno `DATABASE_URL` (postgres:// o file://)
  - [ ] Docker Compose con servicio PostgreSQL opcional
  - [ ] Documentación en README/SETUP.md para ambas opciones
  - [ ] Tests de compatibilidad (SQLite vs PostgreSQL)
- **Beneficios**: Mayor rendimiento, concurrent writes, mejor soporte para producciónn
- **Archivos**:
  - `prisma/schema.prisma` (datasource db con env switch)
  - `docker-compose.yml` (añadir servicio postgres)
  - `.env.example` (añadir ejemplo DATABASE_URL postgres)
  - Documentación (README.md, SETUP.md)
- **Estimación**: 4-6 horas
- **Compatibilidad**: Mantener retrocompatibilidad con SQLite para desarrollo local

## 🟢 NICE-TO-HAVE (Futuro)

### 12. **Script de Arranque para Desarrollo**

- [ ] Crear `scripts/dev.sh` con validación de puerto 3000
- [ ] Comandos: `npm run dev:start`, `npm run dev:stop`
- [ ] Documenta en README
- **Estimación**: 1-2 horas

### 13. **Gestión Avanzada de Subforos (Estilo Jackett)**

**Severidad**: Media (mejora de UX y funcionalidad)  
**Área**: Backend/Frontend (`src/app/api/arr/*`, `src/components/config/forums-table.tsx`)

**Descripción**: Jackett expone cada subforo/categoría como un indexer separado en *arr. Sweaterr debe hacer lo mismo para permitir que usuarios configuren qué subforo usar en cada*arr sin tener que crear múltiples foros en Sweaterr.

**Beneficios**:

- Un foro en Sweaterr = múltiples indexers en *arr (e.g., "Wolfmax 4k - Series", "Wolfmax 4k - Películas")
- Usuario configura una sola vez el foro, luego elige el subforo en cada *arr
- Cada subforo puede tener selectors CSS diferentes (si aplica)
- Más flexible: cambiar subforo sin reconfigurar el foro en Sweaterr

**Tareas a implementar**:

1. **Obtención Automática de Subforos**
   - [ ] Endpoint `/api/config/forums/[id]/subforos` que detecte subforos disponibles
   - [ ] Analiza el formulario de búsqueda del foro (busca `<select>`, `<option>` con subforos)
   - [ ] Extrae IDs/nombres de subforos (ej: `forumid=5` → "Series", `forumid=3` → "Películas")
   - [ ] Cachea resultado (TTL 24h) para no parsear el formulario cada vez
   - [ ] Fallback a lista vacía si no puede detectar subforos (foro sin subforos)
   - **Archivos**: `src/app/api/config/forums/[id]/subforos/route.ts` (nuevo)

2. **Almacenamiento de Subforos en BD**
   - [ ] Agregar array `subforos?: {id: string, name: string}[]` al modelo Forum en Prisma
   - [ ] Endpoint POST para refrescar lista de subforos (manual o automático)
   - [ ] UI para mostrar subforos detectados en tabla de foros
   - **Archivos**: `prisma/schema.prisma`, migrations

3. **Búsqueda en Múltiples Subforos**
   - [ ] Endpoint `/api/arr/search` acepta parámetro `subforos: string[]` (IDs de subforos)
   - [ ] Si no se especifica, busca en todos los subforos del foro
   - [ ] Busca en paralelo con Promise.all para cada subforo
   - [ ] Combina resultados (elimina duplicados por URL)
   - [ ] Agrupa resultados por subforo en respuesta si es necesario
   - **Archivos**: `src/app/api/arr/search/route.ts` (modificar)

4. **Publicación de Subforos en *arr (Estilo Jackett)**
   - [ ] Endpoint `/api/arr?t=caps&subforo=X` devuelve categorías específicas del subforo
   - [ ] API key del foro valida, pero se añade parámetro `subforo` para filtrar
   - [ ] GUID incluye subforo: Base64(forumId, **subforo**, category, url)
   - [ ] En *arr, usuario ve múltiples indexers:
     - "Wolfmax 4k" (busca todos los subforos)
     - "Wolfmax 4k - Series" (solo subforo Series)
     - "Wolfmax 4k - Películas" (solo subforo Películas)
     - etc.
   - [ ] Cada indexer puede tener diferentes Quality Profiles en *arr
   - **Archivos**: `src/app/api/arr/caps/route.ts`, `src/app/api/arr/search/route.ts`, `src/app/api/arr/grab/route.ts`

5. **UI para Gestionar Subforos**
   - [ ] Botón "Detectar Subforos" en ForumsTable
   - [ ] Dialog que muestra lista de subforos encontrados
   - [ ] Toggle enable/disable por subforo (en caso de que el usuario no quiera exponer todos)
   - [ ] Selector en testing para probar búsquedas en subforos específicos
   - **Archivos**: `src/components/config/forums-table.tsx`, nuevo componente `subforos-dialog.tsx`

6. **Documentación**
   - [ ] Guía en ARR_SETUP.md: "Configurar múltiples indexers desde un solo foro"
   - [ ] Ejemplo con Wolfmax 4k (Series + Películas)
   - [ ] Notas sobre detección automática y refreshing
   - **Archivos**: `docs/ARR_SETUP.md`

**Ejemplo de flujo final**:

```text
1. Usuario configura foro "Wolfmax 4k" en Sweaterr
2. Hace click en "Detectar Subforos"
3. Sweaterr obtiene: ["Series", "Películas", "Docu", "Anime"]
4. Se guardan en BD con toggle enabled
5. En Sonarr: Usuario añade indexer "Wolfmax 4k - Series" (URL con ?subforo=Series)
6. En Radarr: Usuario añade indexer "Wolfmax 4k - Películas" (URL con ?subforo=Películas)
7. Sonarr busca en subforo Series, Radarr en subforo Películas
8. Mismo foro, múltiples usos según *arr
```

**Estimación**: 8-10 horas  
**Prioridad**: 🔥 Media-Alta (mejora significativa de UX)  
**Depende de**: Arquitectura *arr completada ✅

### 14. **Multi-Foro Simultáneo en Búsqueda**

- [ ] Buscar en todos los foros configurados en paralelo (Promise.all)
- [ ] Ranking/scoring de resultados por foro
- **Estimación**: 3-4 horas

### 15. **Caché de Búsquedas**

- [ ] Redis/in-memory para resultados recientes (TTL 1 hora)
- [ ] Evita búsquedas duplicadas en foros lentos
- **Estimación**: 3 horas

### 16. **Notificaciones (Discord/Telegram)**

- [ ] Webhook cuando descarga completa
- [ ] Configurable en settings
- **Estimación**: 4-5 horas

### 17. **Dashboard con Estadísticas**

- [ ] Gráficos de descargas por foro, por tipo (serie/película), por mes
- [ ] Top foros más usados
- [ ] Métricas de velocidad/éxito de búsqueda
- **Estimación**: 6-8 horas

### 18. **Soporte Multi-Plataforma de Fuentes (Foros, DDL, Streaming)**

- **Severidad**: Media (Arquitectura escalable)
- **Área**: Backend/Frontend (`src/app/api/config/forums/*`, `src/components/config/*`, Prisma schema)
- **Problema**: Actualmente el código está parcialmente hardcodeado para descargasdd.org (vBulletin); no permite añadir otros tipos de foros (phpBB, Invision Community) ni sitios de descarga directa (DDL) o streaming
- **Funcionalidad**:
  - [ ] Parametrizar tipo de plataforma en configuración de fuente (`forumType`: vBulletin, phpBB, InvisionCommunity, CustomDDL, Streaming)
  - [ ] Abstraer lógica de búsqueda/extracción por tipo de plataforma (estrategia pattern)
  - [ ] UI con selector de tipo de plataforma al añadir fuente
  - [ ] Permitir configuración de selectores CSS custom para plataformas no estándar
  - [ ] Validación de campos requeridos según tipo de plataforma
  - [ ] Documentación de cómo añadir soporte para nuevas plataformas
- **Impacto**: Permite expandir sweaterr a cualquier fuente de descarga directa sin hardcodear
- **Archivos**:
  - `prisma/schema.prisma` (añadir `forumType` enum)
  - `src/lib/services/platform-handlers/` (nuevo: vbulletin.ts, phpbb.ts, custom.ts)
  - `src/components/config/forum-config.tsx` (añadir selector tipo)
- **Estimación**: 8-12 horas
- **Dependencias**: Refactor de `cloudflare-handler.ts` para soportar estrategias de plataforma

### 19. **Renombrar "Foros" → "Fuentes/Orígenes"**

- **Severidad**: Baja (Nomenclatura/UX)
- **Área**: Frontend/Backend/i18n (`src/locales/*.json`, `src/components/*`, `src/app/api/config/*`)
- **Problema**: La sección "Foros" es restrictiva; sweaterr puede consumir foros, sitios DDL, streaming, etc.
- **Solución**:
  - [ ] Renombrar tabla `Forum` → `Source` en Prisma (migration)
  - [ ] Actualizar API routes: `/api/config/forums` → `/api/config/sources`
  - [ ] Cambiar i18n: `forums.*` → `sources.*` (en/es)
  - [ ] Actualizar UI: "Foros" → "Fuentes" o "Orígenes" (español) / "Sources" (inglés)
  - [ ] Actualizar hooks: `useForums()` → `useSources()`
  - [ ] Actualizar componentes: `forum-config.tsx` → `source-config.tsx`, etc.
  - [ ] Documentación: Actualizar README y ARCHITECTURE.md
- **Archivos**: Múltiples (schema, API routes, hooks, componentes, i18n)
- **Estimación**: 4-6 horas
- **Orden**: Hacer DESPUÉS de implementar multi-plataforma (#18) para evitar doble refactor

### 20. **Rediseño de Interfaz: Layout Funcional Profesional**

- **Severidad**: Baja (UX/Estética, pero no bloqueante)
- **Área**: Frontend (`src/app/layout.tsx`, `src/app/page.tsx`, `src/components/*`)
- **Problema**: UI actual basada en tarjetas y toasts ocupa mucho espacio y no es óptima para uso intensivo
- **Contexto**: Sweaterr se usará principalmente como indexer para *arr; la UI debe ser funcional, no solo visual
- **Propuesta de diseño**:
  - [ ] **Sidebar fijo izquierdo** con navegación (Dashboard, Sources, Downloads, Configuration, Testing)
  - [ ] **Pantalla completa** para contenido sin desperdiciar espacio en tarjetas/cards
  - [ ] **Formularios inline** en lugar de popups/dialogs para configuración
  - [ ] **Tablas densas** para listas de descargas/fuentes (más filas visibles)
  - [ ] **Mantener dark mode** y paleta de colores actual (funciona bien)
  - [ ] **Eliminar toasts excesivos**: solo para errores críticos o confirmaciones importantes
  - [ ] **Header minimalista**: logo, título, user menu, sin ocupar altura extra
- **Referencia visual**: Inspiración en UIs tipo Sonarr/Radarr (sidebar + content area)
- **Beneficios**:
  - Más información visible sin scroll
  - Configuración más rápida (sin abrir/cerrar modales)
  - Aspecto profesional tipo "admin panel"
  - Mejor para monitores grandes y uso prolongado
- **Archivos**:
  - `src/app/layout.tsx` (añadir sidebar permanente)
  - `src/app/page.tsx` (convertir tabs a routes: `/`, `/sources`, `/downloads`, etc.)
  - `src/components/ui/*` (adaptar Card → inline forms, Dialog → full-page)
  - `tailwind.config.ts` (ajustar spacing para densidad)
- **Estimación**: 12-16 horas (refactor significativo de UI)
- **Prioridad**: Baja (funciona actualmente; mejoría cosmética/UX)
- **Orden**: Hacer DESPUÉS de #1 *arr Torznab y #4 Flicker (funcionalidad antes que estética)

## 📋 CAMBIOS RECIENTES (Enero 2026)

### Merged a Master (2026-01-11)

- ✅ Sincronización de descargas JDownloader ↔ BD
- ✅ Deduplicación de totales en dashboard (no inflar completados)
- ✅ Normalización de estados (finished→completed)
- ✅ Tarjeta "Total Descargas" rediseñada
- ✅ i18n completo de pestaña Descargas
- ✅ Reducción de polling (3s activos / 10s inactivos)
- ✅ Logs de JDownloader a archivo (`logs/jdownloader.log`)

### Documentación

- ✅ ARCHITECTURE.md actualizado con changelog
- ✅ JSON locale (en/es) corregido y ampliado
- 📝 Este archivo: TODOS.md creado

---

## Cómo Contribuir

1. **Selecciona un TODO** de arriba (preferiblemente en rojo/amarillo)
2. **Crea una rama** `feature/nombre-descriptivo`
3. **Implementa cambios** siguiendo [copilot-instructions.md](.github/copilot-instructions.md)
4. **Actualiza ARCHITECTURE.md** changelog y este fichero
5. **Merge a master** cuando esté listo

---

## Métricas

- **TODOs Críticos**: 7 (incluye *arr indexer, login reload, session persistence, reload UI)
- **TODOs Importantes**: 8 (añadidos: IA Integration, FlareSolverr UI config, PostgreSQL)
- **Nice-to-Have**: 9 (incluye: multi-plataforma fuentes, renombrar "Foros", rediseño UI)
- **Total**: 24 items
- **Horas Estimadas**: ~100-134 horas para completar todo
- **Prioridad**: #1 *arr Torznab → #2-4 Auth/Session/Login → #5 Reload UI → #6-7 Flicker/Security/Rate Limiting → #9-10 FlareSolverr+IA → #11 PostgreSQL → #18-20 Multi-plataforma/Renombrar/Rediseño
