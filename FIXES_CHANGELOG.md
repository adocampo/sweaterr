# Resumen de Cambios - *arr Integration Fixes (11 Enero 2026)

## ✅ CORREGIDOS

### 1. **API Key vs URL** (CRÍTICO)
**Problema**: Estaba copiando la URL completa `http://192.168.1.10:3000/api/arr?apikey=fdd-xxx`  
**Corrección**:
- ✅ Button ahora copia SOLO la API key: `fdd-12e6550d0de40268bc3f53a637d5ad91`
- ✅ Tooltip muestra URL y API Key SEPARADAS para claridad:
  ```
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

