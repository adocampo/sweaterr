# TODOs Pendientes - Sweaterr

Estado: 11 de enero de 2026

## 🔴 CRÍTICOS (Afectan UX/Functionality)

### 1. **Implementación Endpoint *arr (Torznab Bridge)** 🔗

- **Severidad**: Crítica (funcionalidad core)
- **Área**: Backend API (`src/app/api/arr/*`)
- **Problema**: Sweaterr debe actuar como indexer Torznab para *arr (Sonarr/Radarr/Lidarr)
- **Funcionalidad**:
  - [ ] Endpoint `GET /api/arr` que devuelve feed RSS/Torznab de búsquedas configuradas
  - [ ] *arr hace peticiones de búsqueda a sweaterr → sweaterr busca en foros + IA → devuelve resultados
  - [ ] Usuario selecciona resultado en *arr →*arr envía a sweaterr como descarga
  - [ ] Sweaterr envía a JDownloader con tag *arr (serie, película, etc.)
  - [ ] JDownloader descarga → sweaterr notifica a *arr de completado (webhook/callback)
  - [ ] *arr importa automáticamente el contenido descargado
- **Archivos**: `src/app/api/arr/` (nuevo directorio), `src/lib/services/torznab-formatter.ts` (nuevo)
- **Dependencias**: Ya existe `/api/search` y `/api/downloads/status`, reutilizar lógica
- **Estimación**: 8-10 horas
- **Prioridad**: 🔥 ANTES QUE TODO (es la razón de ser de sweaterr)

### 2. **Formulario de Login se Recarga a Sí Mismo**

- **Severidad**: Alta (UX confusa)
- **Área**: Frontend Auth (`src/app/login/page.tsx`)
- **Problema**: Primera vez que inicia sesión, el form se recarga; segunda vez entra correctamente
- **Impacto**: Usuario se confunde, piensa que falló el login cuando en realidad está cargando
- **Causa probable**: Redirect post-login causa re-render antes de que navegador procese el cambio
- **Tareas**:
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

### 2. **Passwords en Texto Plano en BD**

- **Severidad**: Media (Seguridad)
- **Área**: Auth/Config
- **Problema**: Credenciales (JDownloader, Foros, IA) se almacenan sin encriptar
- **Tareas**:
  - [ ] Implementar encriptación AES/bcrypt antes de guardar
  - [ ] Actualizar migration de Prisma
  - [ ] Validar compatibilidad con login actual
- **Archivos**: `src/app/api/config/*`, Prisma schema

### 3. **Sin Rate Limiting**

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

## 🟢 NICE-TO-HAVE (Futuro)

### 9. **Script de Arranque para Desarrollo**

- [ ] Crear `scripts/dev.sh` con validación de puerto 3000
- [ ] Comandos: `npm run dev:start`, `npm run dev:stop`
- [ ] Documenta en README
- **Estimación**: 1-2 horas

### 10. **Gestión Avanzada de Subforos**

- [ ] Toggle `searchInChildForums` en configuración foro
- [ ] Selección múltiple de subforos
- [ ] Listado automático de subforos disponibles
- [ ] Integración con endpoint Torznab para *arr
- **Estimación**: 5-6 horas

### 11. **Multi-Foro Simultáneo en Búsqueda**

- [ ] Buscar en todos los foros configurados en paralelo (Promise.all)
- [ ] Ranking/scoring de resultados por foro
- **Estimación**: 3-4 horas

### 12. **Caché de Búsquedas**

- [ ] Redis/in-memory para resultados recientes (TTL 1 hora)
- [ ] Evita búsquedas duplicadas en foros lentos
- **Estimación**: 3 horas

### 13. **Notificaciones (Discord/Telegram)**

- [ ] Webhook cuando descarga completa
- [ ] Configurable en settings
- **Estimación**: 4-5 horas

### 14. **Dashboard con Estadísticas**

- [ ] Gráficos de descargas por foro, por tipo (serie/película), por mes
- [ ] Top foros más usados
- [ ] Métricas de velocidad/éxito de búsqueda
- **Estimación**: 6-8 horas

### 15. **Soporte Multi-Plataforma de Fuentes (Foros, DDL, Streaming)**

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

### 16. **Renombrar "Foros" → "Fuentes/Orígenes"**

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
- **Orden**: Hacer DESPUÉS de implementar multi-plataforma (#15) para evitar doble refactor

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

- **TODOs Críticos**: 6 (incluye *arr indexer, login reload, session persistence)
- **TODOs Importantes**: 5
- **Nice-to-Have**: 8 (añadidos: multi-plataforma fuentes, renombrar "Foros")
- **Total**: 19 items
- **Horas Estimadas**: ~65-90 horas para completar todo
- **Prioridad**: #1 *arr Torznab → #2-4 Auth/Session/Login → #5-7 Flicker/Security/Rate Limiting → #15-16 Multi-plataforma + Renombrar
