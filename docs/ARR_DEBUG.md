# Debugging Sweaterr *arr Integration

## Cómo Verificar que Sonarr/Radarr Está Conectando con Sweaterr

### 1. Logs en la Terminal de Sweaterr

Cuando ejecutas `npm run dev`, los logs de las peticiones de *arr aparecen en stdout con prefijos `[arr-*]`:

**Ejemplo - Petición de Capabilities (cuando añades el indexer):**

```
[arr-caps] Caps request received. API Key: fdd-12e65...
[arr-caps] Forum lookup result: Found forum 'Zona Series'
[arr-caps] Returning capabilities for forum 'Zona Series'
```

**Ejemplo - Petición de Búsqueda (cuando Sonarr busca contenido):**

```
[arr-search] Search request: type=tvsearch, query="Breaking Bad S01E01", season=1, ep=1, imdbid=undefined, tmdbid=undefined, cats=5000, apikey=fdd-12e65...
[arr-search] Forum lookup result: Found forum 'Zona Series'
[arr-search] Found 1 enabled forums to search in
```

**Ejemplo - Si falla (API key incorrecta):**

```
[arr-caps] Caps request received. API Key: INVALID...
[arr-caps] Forum lookup result: NOT FOUND
[arr-caps] Invalid API key or forum disabled. Forum: not found
```

### 2. Dónde Buscar los Logs

#### Opción A: Terminal donde ejecutas `npm run dev`

- Los logs aparecen directamente en el stdout
- Busca líneas que empiecen con `[arr-` seguidas de `caps`, `search`, `grab`, o `notify`

#### Opción B: Archivo de Log (si rediriges)

Si ejecutas `npm run dev > app.log 2>&1`, los logs irán a `app.log`

#### Opción C: Inspeccionar con `grep` en Tiempo Real

```bash
# En otra terminal, monitorea los logs de *arr
tail -f <archivo-log> | grep "\[arr-"

# O si estás en la terminal principal
# Los logs aparecen conforme llegan las peticiones
```

### 3. Verificación Step-by-Step

#### Paso 1: Agregar Indexer en Sonarr/Radarr

1. Abre Sonarr/Radarr
2. Ve a **Settings → Indexers → Add New → Newznab**
3. Pega la URL copiada de Sweaterr: `http://192.168.1.10:3000/api/arr?apikey=fdd-12e6550d0de40268bc3f53a637d5ad91`
4. Haz click en **Test**

**Resultado esperado en logs de Sweaterr:**

```
[arr-caps] Caps request received. API Key: fdd-12e6550d...
[arr-caps] Forum lookup result: Found forum 'Zona Series'
[arr-caps] Returning capabilities for forum 'Zona Series'
```

Si ves este log, ✅ **Sonarr está conectando correctamente con Sweaterr**.

#### Paso 2: Realizar Búsqueda Manual

1. En Sonarr, ve a una serie
2. Haz click en el ícono 🔍 al lado de un episodio (búsqueda interactiva)
3. Selecciona el indexer "Sweaterr" de la lista

**Resultado esperado en logs de Sweaterr:**

```
[arr-search] Search request: type=tvsearch, query="Breaking Bad S01E01", season=1, ep=1, imdbid=undefined, tmdbid=undefined, cats=5000, apikey=fdd-12e6550d...
[arr-search] Forum lookup result: Found forum 'Zona Series'
[arr-search] Found 1 enabled forums to search in
```

Si ves estos logs, ✅ **Sonarr está enviando búsquedas a Sweaterr correctamente**.

### 4. Problemas Comunes y Soluciones

#### Problema: No veo ningún log de `[arr-*]`

**Posibles causas:**

1. La URL no es correcta (verifica que sea `/api/arr?apikey=XXX`)
2. La API key está mal (cópiala nuevamente desde Sweaterr)
3. Sweaterr no está corriendo (verifica que `npm run dev` esté activo)
4. El firewall bloquea las conexiones entre Sonarr y Sweaterr
5. Sonarr está en Docker y no puede alcanzar la red de Sweaterr

**Soluciones:**

- Verifica la URL manualmente: `curl "http://192.168.1.10:3000/api/arr?t=caps&apikey=fdd-12e6550d..."`
  - Debería devolver XML con las capacidades
- Verifica que Sonarr puede hacer ping a la máquina de Sweaterr
- En Docker, verifica que están en la misma red o que expusiste correctamente el puerto

#### Problema: Veo error "Invalid API Key"

```
[arr-caps] Caps request received. API Key: fdd-12e6550d...
[arr-caps] Forum lookup result: NOT FOUND
[arr-caps] Invalid API key or forum disabled. Forum: not found
```

**Soluciones:**

- La API key no existe en la BD de Sweaterr
- El foro fue eliminado
- El foro está deshabilitado (toggle en la tabla de foros)
- Copia la API key nuevamente desde Sweaterr (botón "Copy Newznab URL")

#### Problema: Veo error "Forum disabled"

```
[arr-caps] Forum lookup result: Found forum 'Zona Series'
[arr-caps] Invalid API key or forum disabled. Forum: found but disabled
```

**Soluciones:**

- El foro está deshabilitado en Sweaterr
- Ve a Configuración → Foros y habilita el toggle del foro

### 5. Información de la Búsqueda

Una vez que Sonarr está conectando, los logs mostrarán:

```
[arr-search] Search request: type=tvsearch, query="Breaking Bad", season=1, ep=1, imdbid=undefined, tmdbid=undefined, cats=5000, apikey=fdd-12e6550d...
```

**Significado de los parámetros:**

- `type=tvsearch` - Búsqueda de series (en Radarr sería `movie`)
- `query="Breaking Bad"` - Lo que Sonarr está buscando
- `season=1, ep=1` - Temporada y episodio específicos
- `cats=5000` - Categoría Torznab (5000 = TV, 2000 = Movies)
- `apikey=fdd-...` - API key del forum

### 6. Estado Actual

**Comportamiento esperado (después de los cambios):**

- Categorías mostradas en Sonarr: ✅ TV (5000), Foreign (5020), SD (5030), HD (5040), UHD (5045)
- Categorías mostradas en Radarr: ✅ Movies (2000) + TV + Audio + Books (como fallback)
- Logging: ✅ Detallado con prefijo `[arr-caps]` y `[arr-search]`

**Trabajo pendiente (TODO #13 - Subforos):**

- ❌ Detectar tipo de foro (Serie/Película/Música) y mostrar SOLO esas categorías
- ❌ Exponer subforos como indexers separados en *arr
- ❌ Parámetro `?subforo=` para filtrar búsquedas

---

## Comandos Útiles para Testing Manual

```bash
# Test capabilities endpoint
curl "http://192.168.1.10:3000/api/arr?t=caps&apikey=fdd-12e6550d0de40268bc3f53a637d5ad91"

# Test search endpoint
curl "http://192.168.1.10:3000/api/arr?t=tvsearch&q=Breaking%20Bad&season=1&ep=1&apikey=fdd-12e6550d0de40268bc3f53a637d5ad91"

# Ver logs en tiempo real
tail -f <archivo-log> | grep "\[arr-"

# Ver solo errores
tail -f <archivo-log> | grep -E "\[arr-.*Invalid|Forum lookup result: NOT FOUND"
```

---

## Referencia de Categorías Torznab

| ID   | Nombre     | Subcategorías                               |
|------|------------|---------------------------------------------|
| 5000 | TV         | Foreign (5020), SD (5030), HD (5040), UHD (5045) |
| 2000 | Movies     | Foreign (2010), SD (2020), HD (2030), UHD (2040), BluRay (2045), 3D (2050) |
| 3000 | Audio      | MP3 (3010), FLAC (3020), Other (3030)      |
| 7000 | Books      | Ebook (7010), Comics (7020)                |

---

## Próximas Mejoras (TODO)

- [ ] Detectar tipo de foro automáticamente basado en el nombre o configuración
- [ ] Devolver solo las categorías relevantes según el tipo de foro
- [ ] Agregar parámetro `?subforo=` para búsquedas en subforos específicos
- [ ] Exponer cada subforo como un indexer separado en *arr (estilo Jackett)
