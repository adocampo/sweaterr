# Resumen de Cambios - *arr Integration Fixes (11 Enero 2026)

## ✅ CORREGIDOS

### 0. **qBittorrent Facade: Package-level progress sync + Real-time Speed/ETA** (30 Enero 2026)

**Problema**: Sonarr Activity no mostraba el progreso de descargas activas. El sync comparaba a nivel de archivo individual (ej. `BB4d.5x01.x265...`) en vez de a nivel de paquete (ej. `Breaking Bad T5...`), causando:

- `progress: 0` para descargas activas aunque JDownloader reportaba progreso real
- Los registros con `jDownloaderId` ya establecido eran ignorados en el matching
- ETA mostraba valores incorrectos (8640000 = infinity, o 0) en lugar del tiempo real restante
- Velocidad mostraba 0 en Sonarr Activity

**Corrección**:

- ✅ Reescrito el bloque de sync en `/api/qbittorrent/api/v2/torrents/info`
- ✅ Los ítems de JDownloader ahora se agrupan por `category` (nombre del paquete)
- ✅ Se calcula el progreso total del paquete: `loadedSize / totalSize` de todos los archivos
- ✅ Se determina el estado del paquete: `allFinished` → completed, `anyRunning` → downloading
- ✅ Matching por título normalizado (sin depender de `jDownloaderId`)
- ✅ **Speed real-time**: Se solicitan campos `speed`, `bytesTotal`, `bytesLoaded` a nivel de paquete
- ✅ **ETA calculado correctamente**: `amountLeft / speed` (bytes restantes ÷ velocidad en bytes/s)
- ✅ Interfaz `JDownloaderDownload` extendida con `packageSpeed`, `packageEta`, `packageBytesTotal`, `packageBytesLoaded`
- ✅ Agregado logging: `Synced package "pkgName" -> title (X.X%, status, speed=XMB/s, eta=Xs, remaining=XGB)`

**Archivos**: `src/app/api/qbittorrent/api/v2/torrents/info/route.ts`, `src/lib/services/jdownloader.ts`

---

### 0.1. **JDownloader Local: forceExtract support** (29 Enero 2026)

**Problema**: El endpoint `/api/downloads/extract` solo funcionaba con JDownloader Cloud (MyJDownloader). Los usuarios en modo local no podían forzar la extracción de archivos ya descargados.

**Corrección**:

- ✅ Añadido método `forceExtract()` a `JDownloaderLocalService` usando el endpoint `/extraction/startExtractionNow`
- ✅ Actualizado `/api/downloads/extract` para detectar el modo (local/cloud) y usar el servicio correcto
- ✅ Ambos modos ahora soportan forzar extracción de paquetes existentes

**Archivos**: `src/lib/services/jdownloader.ts`, `src/app/api/downloads/extract/route.ts`

### 1. **API Key vs URL** (CRÍTICO)

**Problema**: Estaba copiando la URL completa `http://192.168.1.10:3000/api/arr?apikey=fdd-xxx`  
**Corrección**:

- ✅ Button ahora copia SOLO la API key: `fdd-12e6550d0de40268bc3f53a637d5ad91`
- ✅ Tooltip muestra URL y API Key SEPARADAS para claridad:

  ```text
  URL: http://192.168.1.10:3000/api/arr
  API Key: fdd-12e6550d0de40268bc3f53a637d5ad91
  ```

- ✅ Archivo: `src/components/config/forums-table.tsx`

### 2. **Nombres de Logs** (UX de Debugging)

**Problema**: Logs con caracteres especiales `[arr-caps]` difíciles de buscar/filtrar  
**Corrección**:

- ✅ `[arr-caps]` → `ARR_CAPS`
- ✅ `[arr-search]` → `ARR_SEARCH`
- ✅ Nombres simples, sin caracteres especiales, fáciles de grep
- ✅ Archivos: `src/app/api/arr/caps/route.ts`, `src/app/api/arr/search/route.ts`

### 3. **Campo searchInChildForums** (Para Subforos)

**Implementación**:

- ✅ Campo booleano agregado a modelo Forum en Prisma
- ✅ Migración creada: `20260111_add_search_in_child_forums`
- ✅ Default: `false` (búsqueda normal, sin subforos)
- ✅ Ready para: Checkbox en UI de configuración del foro
- ✅ Archivos: `prisma/schema.prisma`, migrations

### 4. **Sonarr en Docker: URLs con localhost + Grab crash** (CRÍTICO)

**Problema**:

- Cuando el RSS devolvía enlaces con `http://localhost:3000/...`, Sonarr (en Docker/otra máquina) intentaba descargar contra su propio `localhost` y fallaba.
- El endpoint `t=get` (grab) referenciaba `service.type` sin existir, pudiendo romper el flujo al seleccionar un resultado.

**Corrección**:

- ✅ En `caps` y `search`, las URLs públicas ahora se generan desde la request (soporta `x-forwarded-host` / `x-forwarded-proto`).
- ✅ El botón de copiar URL usa `window.location.origin` para evitar defaults incorrectos.
- ✅ `grab` guarda `arrType` detectándolo desde `User-Agent`.

**Archivos**: `src/app/api/arr/caps/route.ts`, `src/app/api/arr/search/route.ts`, `src/app/api/arr/grab/route.ts`, `src/components/config/forums-table.tsx`

### 5. **Native search: 0 resultados por links SEO / searchid no estándar**

**Problema**: En algunas respuestas vBulletin, los hilos aparecen como `showthread.php?<id>` (SEO) en vez de `showthread.php?t=<id>`, y el `searchid` puede venir en JavaScript o querystring, causando 0 resultados.

**Corrección**:

- ✅ `parseResults()` acepta `showthread.php?<id>`.
- ✅ Extracción de `searchid` más tolerante (hidden input, querystring, JS).

**Archivo**: `src/lib/services/forum.ts`

### 6. **Native search: forumchoice[] enviaba label en vez de ID**

**Problema**: Con `searchForumLabel`, el selector podía mandar `forumchoice[]="Zona Series"` (label) en vez del `value` real del option/input (ID). Resultado: `do=process` no generaba `searchid`.

**Corrección**:

- ✅ Solo aplicar la selección cuando existe `value` no vacío; nunca usar el texto del option como valor.

**Archivo**: `src/lib/services/forum.ts`

### 7. **Native search: fallback cuando forumchoice no es numérico**

**Problema**: En DescargasDD el form puede exponer `forumchoice[]` como texto (ej. `" Zona Series"`). vBulletin no genera `searchid` y la búsqueda devuelve 0.

**Corrección**:

- ✅ Si `forumchoice*` no es numérico (y no es `0`), se elimina del POST para forzar búsqueda en todos los foros (fallback funcional).

**Archivo**: `src/lib/services/forum.ts`

### 8. **Sonarr: /api/arr no usaba searchMode ni cookies persistentes**

**Problema**: La UI podía buscar bien (porque el foro está configurado con `searchMode`, `cseId`, `searchForumLabel` y cookies persistentes), pero `/api/arr/search` y `/api/arr?t=get` no pasaban esos campos al `ForumService`.

Efectos típicos:

- Sonarr disparaba logins/re-autenticación (Cloudflare) innecesarios, haciendo que “a veces funcione y a veces no”.
- El modo de búsqueda podía no coincidir con el de la UI.
- Cuando no había resultados reales, se devolvían *placeholders* que confunden a *arr.

**Corrección**:

- ✅ `/api/arr/search` y `/api/arr?t=get` ahora pasan `searchMode`, `cseId`, `searchForumLabel` y `persistentCookies` al `ForumService`, alineando Sonarr con la configuración real del foro.
- ✅ En búsquedas reales (q presente), si no hay resultados se devuelve un RSS vacío (sin *placeholders*).
- ✅ Parser nativo soporta URLs tipo `/threads/<id>-...` además de `showthread.php?...`.

**Archivos**: `src/app/api/arr/search/route.ts`, `src/app/api/arr/grab/route.ts`, `src/lib/services/forum.ts`

### 9. **Sonarr/Radarr: una API key debe buscar SOLO su foro**

**Problema**: `/api/arr/search` validaba la API key contra un foro, pero luego buscaba en *todos* los foros habilitados. Esto impide el setup “1 foro por subforo” (una API key para Sonarr y otra para Radarr) y puede mezclar resultados entre fuentes.

**Corrección**:

- ✅ Ahora `/api/arr/search` busca únicamente en el foro asociado a `torznabApiKey`.

**Archivo**: `src/app/api/arr/search/route.ts`

### 10. **Sonarr: 0 resultados por retorno incorrecto de `ForumService.search()`** (CRÍTICO)

**Problema**: Aunque el parser (especialmente en modo Google CSE) detectaba resultados válidos, Sonarr recibía 0 items porque `ForumService.search()` devolvía un objeto wrapper `{ results: [...] }` y el endpoint *arr lo trataba como si fuera un array.

**Corrección**:

- ✅ `ForumService.search()` devuelve directamente un array de resultados (`ForumSearchResult[]`).

**Archivo**: `src/lib/services/forum.ts`

### 11. **Sonarr: `t=get` debe devolver un `.torrent` real + compatibilidad con Download Client** (CRÍTICO)

**Problema**:

- Sonarr descargaba el resultado pero al añadirlo al cliente mostraba **"Invalid torrent file specified"**.
- La causa era que el endpoint de grab devolvía una respuesta no-torrent (XML/NZB), mientras Sonarr valida y espera un `.torrent` real (bencoded).

**Corrección**:

- ✅ `/api/arr/grab` devuelve ahora un `.torrent` real (bencoded) con `Content-Type: application/x-bittorrent`.
- ✅ Se embebe un payload en `comment` como `sweaterr:<base64url(JSON)>` para transportar contexto.
- ✅ Se añade un *qBittorrent-compatible facade* (`/api/qbittorrent/api/v2/*`) para que Sonarr gestione Activity/control.
- ✅ Compatibilidad: `torrents/add` acepta multipart field `torrents` (plural) y múltiples ficheros (comportamiento de qBittorrent Web API).

**Archivos**: `src/app/api/arr/grab/route.ts`, `src/app/api/qbittorrent/api/v2/torrents/add/route.ts`, `src/app/api/qbittorrent/api/v2/torrents/info/route.ts`, `src/lib/bencode.ts`

### 12. **Modo `google_site` deshabilitado por defecto (feature flag)**

**Problema**: `google_site` es un modo frágil (bloqueos/captcha) y no era el objetivo actual. Mantenerlo activo podía causar comportamientos inesperados.

**Corrección**:

- ✅ `google_site` solo se ejecuta si `ENABLE_GOOGLE_SITE_SEARCH=true`.
- ✅ Si no está habilitado, se hace fallback a `native`.

**Archivo**: `src/lib/services/forum.ts`

### 13. **Sonarr/Radarr: Download Client SABnzbd-compatible + categorías por foro**

**Problema**:

- *arr puede exigir un Download Client (tipo SABnzbd) para completar el flujo “Add to download queue”.
- El test de Sonarr puede fallar si la **categoría** configurada no “existe” en el Download Client.

**Corrección**:

- ✅ Endpoint SABnzbd-compatible expuesto en `/api/sabnzbd/api` (subset).
- ✅ Soporte de categorías en `get_config`, `fullstatus` y `get_cats`.
- ✅ Configuración por foro vía campo `sabnzbdCategory` para evitar mezclar contextos entre indexers.

**Archivos**: `src/app/api/sabnzbd/api/route.ts`, `src/components/config/forum-config.tsx`, `prisma/schema.prisma`, `prisma/migrations/*`

### 14. **Dev server: crash al rotar logs gigantes (`ERR_STRING_TOO_LONG`)**

**Problema**: Si algún log crecía mucho (ej. `logs/db.log`), al arrancar (`npm run dev`) `Logger.rotateLogs()` hacía `readFileSync()` completo y Node lanzaba `ERR_STRING_TOO_LONG`.

**Corrección**:

- ✅ Rotación segura: en archivos grandes, se lee solo el *tail* (bytes acotados) y se conservan las últimas 1000 líneas.
- ✅ Evita cargar logs multi-GB en memoria y elimina el error al arrancar.

**Archivo**: `src/lib/logger.ts`

### 15. **db.log gigante por logs de queries Prisma**

**Problema**: `logs/db.log` se llenaba de entradas SQL (p.ej. selects sobre `jdownloader_configs`) porque Prisma estaba configurado para loguear todas las queries. Con endpoints/polling esto genera decenas por segundo.

**Corrección**:

- ✅ Los logs de queries Prisma ahora son **opt-in**: por defecto no se registran queries SQL.
- ✅ Para habilitar debug puntual: `PRISMA_LOG_QUERIES=true`
- ✅ Para limitarlo a queries lentas: `PRISMA_LOG_SLOW_MS=200`

**Archivo**: `src/lib/db.ts`

### 16. **Sonarr Activity + JDownloader auto-start/extract (qBittorrent facade)**

**Problem**:

- Sonarr Activity did not reflect download progress/finish when using the qBittorrent facade.
- JDownloader did not auto-start or auto-extract after links were sent by Sonarr.

**Fix**:

- Sync `/api/downloads/status` now matches JDownloader items back to ARR download records (by title/category) and updates `status`/`progress`.
- qBittorrent facade now sends `autostart=true` and `autoExtract=true`, and starts the download controller (local + cloud).

**Files**: `src/app/api/qbittorrent/api/v2/torrents/add/route.ts`, `src/app/api/downloads/status/route.ts`, `src/lib/services/jdownloader.ts`

## 📋 PENDIENTE

### 1. **Checkbox en UI del Foro** (searchInChildForums)

**Qué hacer**:

- [ ] Agregar checkbox "Buscar en subforos" en dialog de configuración del foro
- [ ] Mostrar cuando `searchMode = 'native'` (ya que solo aplica a búsqueda nativa)
- [ ] Sincronizar con BD

**Archivo a modificar**: `src/components/config/forum-config.tsx`

### 2. **Categorías Dinámicas en /api/arr/caps**

**Problema**: Devuelve todas las categorías (TV, Movies, Audio, Books) sin importar el foro  
**Solución necesaria**:

- [ ] Detectar tipo de foro basado en el nombre (contiene "Series" → TV only, "Películas" → Movies only)
- [ ] O agregar campo `type` al modelo Forum con opciones: series | movies | music | books
- [ ] Devolver SOLO las categorías relevantes en capabilities XML

**Categorías esperadas por Sonarr**:

```xml
<category id="5000" name="TV">
  <subcat id="5020" name="Foreign"/>
  <subcat id="5030" name="SD"/>
  <subcat id="5040" name="HD"/>
  <subcat id="5045" name="UHD"/>
</category>
```

**Archivos a modificar**: `src/app/api/arr/caps/route.ts`, Prisma schema (si agregas campo type)

### 3. **Integración de searchInChildForums en Búsquedas**

**Qué hacer**:

- [ ] Pasar parámetro `childforums=1` a búsqueda del foro si `searchInChildForums=true`
- [ ] Aplica solo cuando `searchMode='native'`
- [ ] En endpoint `/api/arr/search`: detectar el parámetro y pasarlo al ForumService

**Archivos a modificar**: `src/app/api/arr/search/route.ts`, `src/lib/services/forum.ts`

### 4. **Error "Unexpected end of JSON input"** (CRÍTICO)

**Estado**: SIN SOLUCIONAR - Requiere investigación más profunda

**Síntomas**:

- Ocurre aleatoriamente durante navegación
- Causa recargas inesperadas de la página
- Error: `SyntaxError: Unexpected end of JSON input` en `/`

**Intentos previos**:

- ✅ Validación en `jdownloader.ts` decryptAES (JSON vacío)
- ❌ Pero sigue ocurriendo

**Investigación necesaria**:

- [ ] Revisar todos los endpoints que pueden devolver respuestas vacías
- [ ] Verificar si error viene de `/api/downloads/status`
- [ ] Revisar hooks en `page.tsx` que hacen fetch
- [ ] Posible solución: try-catch adicional en useEffect de polling

**Logs recomendados para debug**:

```bash
# En terminal
tail -f logs/app.log | grep "ARR_\|JSON\|error" || true

# O en browser console
window.addEventListener('error', (e) => console.log('Global error:', e.message, e.stack));
```

---

## Commits Realizados

```bash
75f8e51 fix(arr): corregir API Key, logs simples, y agregar searchInChildForums
```

---

## PRÓXIMOS PASOS (Orden Recomendado)

1. **Implementar checkbox searchInChildForums en UI** (~1 hora)
2. **Detectar tipo de foro y categorías dinámicas** (~2 horas)
3. **Integrar searchInChildForums en búsquedas** (~1 hora)
4. **Investigar y corregir JSON.parse error** (~2-3 horas)

---

## Testing

Después de cada cambio:

```bash
npm run build  # Verificar TypeScript
npm run dev    # Ejecutar en desarrollo
```

En Sonarr:

1. Ir a Settings → Indexers → Edit Sweaterr
2. Copiar API Key desde botón en Sweaterr
3. Pegar en Sonarr:
   - URL: `http://192.168.1.10:3000/api/arr`
   - API Key: `fdd-xxx...` (pegado aquí)
4. Click **Test** y buscar logs `ARR_CAPS` en terminal

---

## Notas

- **Logging**: Busca `ARR_CAPS` o `ARR_SEARCH` en stdout de `npm run dev`
- **Documentación**: Revisar `docs/ARR_DEBUG.md` para guía completa
- **Estructura**: Un forum = un indexer, con su propia API key única
