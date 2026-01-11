# TODOs Pendientes - Sweaterr

Estado: 11 de enero de 2026

## 🔴 CRÍTICOS (Afectan UX/Functionality)

### 1. **Parpadeo/Flicker en Dashboard y Descargas** ⚠️
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

- **TODOs Críticos**: 3
- **TODOs Importantes**: 5
- **Nice-to-Have**: 6
- **Total**: 14 items
- **Horas Estimadas**: ~40-50 horas para completar todo
