# Configuración de *arr con Sweaterr

Esta guía explica cómo configurar Sonarr, Radarr, Lidarr o Readarr para usar Sweaterr como indexer Torznab.

## Requisitos Previos

1. **Sweaterr funcionando**: `npm run dev` en puerto 3000 (o producción)
2. **Al menos un foro configurado** con credenciales válidas
3. **JDownloader configurado** y conectado
4. **Instancia de *arr** instalada (Sonarr, Radarr, etc.)

## Paso 1: Obtener la API Key del Foro

Cada foro en Sweaterr tiene su propia **API key Torznab** generada automáticamente. No necesitas crear ningún servicio separado.

1. Abre Sweaterr en tu navegador: `http://localhost:3000`
2. Inicia sesión con tu usuario admin
3. Ve a **Configuración** (pestaña superior)
4. En la sección **"Foros"**, encontrarás la tabla de foros configurados
5. En la columna **"Torznab Feed"**, busca el foro que quieras usar con *arr
6. Click en el botón **"Copy Feed"** para copiar la URL completa con API key
   - Formato: `http://localhost:3000/api/arr?apikey=fdd-xxxxxxxxxxxxxxxxxxxxxxxx`
7. La URL se copiará automáticamente al portapapeles

## Paso 2: Añadir Indexer en Sonarr/Radarr

### Sonarr

1. Abre Sonarr: `http://localhost:8989`
2. Ve a **Settings → Indexers**
3. Click en el botón **"+"** (Add Indexer)
4. Busca **"Newznab"** en la lista (o "Generic Newznab")
5. Rellena los campos:
   - **Name**: Nombre descriptivo (ej: `Sweaterr - DescargasDD`)
   - **Enable RSS**: ✅ (recomendado para monitoreo automático)
   - **Enable Automatic Search**: ✅
   - **Enable Interactive Search**: ✅
   - **URL**: Pega la URL copiada del "Copy Feed" button
     - Ejemplo: `http://localhost:3000/api/arr?apikey=fdd-xxxxxxxxxxxxxxxxxxxxxxxx`
   - **API Key**: Dejar vacío (ya está incluido en la URL)
   - **Categories**: Dejar vacío o seleccionar `5000 - TV`
   - **Additional Parameters**: Vacío
6. Click **"Test"** para verificar conexión
   - Debe mostrar "✅ Test was successful"
7. Click **"Save"**

### Radarr

1. Abre Radarr: `http://localhost:7878`
2. Ve a **Settings → Indexers**
3. Click en **"+"**
4. Selecciona **"Newznab"**
5. Rellena los campos:
   - **Name**: `Sweaterr - DescargasDD` (o nombre del foro)
   - **Enable RSS**: ✅
   - **Enable Automatic Search**: ✅
   - **Enable Interactive Search**: ✅
   - **URL**: Pega la URL del "Copy Feed" button
   - **API Key**: Dejar vacío
   - **Categories**: Dejar vacío o seleccionar `2000 - Movies`
6. Click **"Test"** → Debe ser exitoso
7. Click **"Save"**

## Paso 3: Configurar Webhook (Opcional pero Recomendado)

Los webhooks permiten que *arr notifique a Sweaterr cuando una descarga es importada, actualizando el estado en la UI.

### En Sonarr/Radarr

1. Ve a **Settings → Connect**
2. Click en **"+"**
3. Selecciona **"Webhook"**
4. Rellena:
   - **Name**: `Sweaterr Notify`
   - **On Grab**: ✅
   - **On Import**: ✅
   - **On Upgrade**: ✅
   - **On Rename**: ❌ (opcional)
   - **URL**: `http://localhost:3000/api/arr/notify`
   - **Method**: `POST`
   - **Username/Password**: Dejar vacío
5. Click **"Test"** → Debe devolver "✅ Success"
6. Click **"Save"**

## Paso 4: Probar el Indexer

### Búsqueda Interactiva

1. En Sonarr: Ve a una serie → **Search** → Click en 🔍 al lado de un episodio
2. En Radarr: Ve a una película → **Search** → Click en 🔍
3. Debería aparecer el indexer que configuraste (ej: "Sweaterr - DescargasDD") buscando
4. Tras unos segundos, debería mostrar resultados de tus foros configurados

### Búsqueda Automática

1. Añade una serie/película nueva a monitoreo
2. *arr buscará automáticamente en Sweaterr
3. Si encuentra resultados que cumplan los Quality Profiles, los descargará

### Verificar en Sweaterr

1. Ve a la pestaña **"Descargas"** en Sweaterr
2. Debería aparecer la descarga con:
   - Título del release
   - Estado: `pending` → `downloading` → `completed`
   - Origen: `*arr` (Sonarr/Radarr)

## Flujo Completo de Descarga

```
1. *arr busca contenido
   ↓
2. *arr consulta indexer Sweaterr (usando API key del foro)
   ↓
3. Sweaterr busca SOLO en el foro asociado
   ↓
4. Sweaterr devuelve resultados a *arr (RSS/XML)
   ↓
5. *arr selecciona mejor resultado según Quality Profile
   ↓
6. *arr envía comando de descarga a Sweaterr
   ↓
7. Sweaterr extrae enlaces del post del foro
   ↓
8. Sweaterr envía enlaces a JDownloader
   ↓
9. JDownloader descarga archivos
   ↓
10. *arr detecta archivos completados
   ↓
11. *arr importa y organiza archivos
   ↓
12. *arr envía webhook a Sweaterr
   ↓
13. Sweaterr actualiza estado a "completed" ✅
```

## Ventajas de esta Arquitectura

- **Una API key por foro**: Cada foro tiene su propio indexer
- **Flexible**: Puedes usar varios foros diferentes con *arr
- **Interfaz parecida a Jackett**: Botón "Copy Feed" copia la URL completa
- **No requiere configuración separada**: La API key se genera automáticamente
- **Seguro**: Cada foro tiene su token único

## Troubleshooting

### Error: "Unable to connect to indexer"

- Verifica que Sweaterr esté ejecutándose
- Comprueba la URL copiada contiene el parámetro `apikey=`
- Si *arr está en Docker, usa la IP del host en lugar de `localhost`

### Error: "Invalid API Key"

- Asegúrate de haber copiado correctamente la URL del botón "Copy Feed"
- Verifica que el foro esté **Enabled** (toggle verde) en Sweaterr
- Regenera una nueva URL si ha cambiado

### No aparecen resultados

- Verifica que tengas foros configurados y habilitados en Sweaterr
- Comprueba que las credenciales del foro sean válidas
- Revisa los logs en la terminal de Sweaterr: busca `[arr-search]`
- Prueba una búsqueda manual en Sweaterr → Testing para verificar que funciona

### Descarga no aparece en JDownloader

- Verifica que JDownloader esté configurado y autenticado
- Revisa logs en Sweaterr: busca `[arr-grab]`
- Comprueba que el post del foro tenga enlaces válidos
- Asegúrate de que el botón "Gracias" se haya clickeado correctamente

### Webhook no funciona

- Verifica la URL del webhook: `http://<sweaterr-host>:3000/api/arr/notify`
- Revisa logs en Sweaterr: busca `[arr-notify]`
- Comprueba que el evento esté seleccionado (On Import, On Grab)
- Si *arr está en Docker, verifica que pueda alcanzar la red de Sweaterr

## Categorías Soportadas

Sweaterr soporta las siguientes categorías Torznab:

| ID   | Categoría | Subcategorías                               |
|------|-----------|---------------------------------------------|
| 2000 | Movies    | Foreign, SD, HD, UHD, BluRay, 3D           |
| 5000 | TV        | Foreign, SD, HD, UHD                        |
| 3000 | Audio     | MP3, FLAC, Other                            |
| 7000 | Books     | Ebook, Comics                               |

## Variantes de Búsqueda en Español

Sweaterr optimiza las búsquedas para foros hispanohablantes con variantes automáticas:

- `Breaking Bad S01E05` se busca también como:
  - `Breaking Bad 1x05`
  - `Breaking Bad Temporada 1 Episodio 5`
  - `Breaking Bad T1 Cap 5`

Esto mejora la tasa de aciertos en foros con nomenclatura no estándar.

## Notas Adicionales

- **Múltiples indexers**: Puedes configurar varios foros diferentes como indexers en *arr
- **Seguridad**: Cada API key es única por foro; sin ella, *arr no podrá acceder
- **Logs**: Todos los eventos se registran en la tabla `ArrNotification` para auditoría
- **Placeholders**: Si una búsqueda falla, Sweaterr devuelve placeholders para evitar que *arr marque el indexer como offline

## Soporte

Para más información, consulta:

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Documentación técnica completa
- [TODOS.md](../TODOS.md) - Estado de features y pendientes
- Issues en GitHub (si aplicable)

---

**¡Disfruta de la automatización con Sweaterr! 🎉**

### Sonarr

1. Abre Sonarr: `http://localhost:8989`
2. Ve a **Settings → Indexers**
3. Click en el botón **"+"** (Add Indexer)
4. Busca **"Newznab"** en la lista (o "Generic Newznab")
5. Rellena los campos:
   - **Name**: `Sweaterr` (o el nombre que prefieras)
   - **Enable RSS**: ✅ (recomendado para monitoreo automático)
   - **Enable Automatic Search**: ✅
   - **Enable Interactive Search**: ✅
   - **URL**: `http://localhost:3000/api/arr`
     - Si Sonarr está en otro host: `http://<sweaterr-host>:3000/api/arr`
   - **API Key**: Pega la API key que copiaste de Sweaterr
   - **Categories**: Dejar vacío o seleccionar `5000 - TV`
   - **Additional Parameters**: Vacío
6. Click **"Test"** para verificar conexión
   - Debe mostrar "✅ Test was successful"
7. Click **"Save"**

### Radarr

1. Abre Radarr: `http://localhost:7878`
2. Ve a **Settings → Indexers**
3. Click en **"+"**
4. Selecciona **"Newznab"**
5. Rellena los campos:
   - **Name**: `Sweaterr`
   - **Enable RSS**: ✅
   - **Enable Automatic Search**: ✅
   - **Enable Interactive Search**: ✅
   - **URL**: `http://localhost:3000/api/arr`
   - **API Key**: Pega la API key de Sweaterr
   - **Categories**: Dejar vacío o seleccionar `2000 - Movies`
6. Click **"Test"** → Debe ser exitoso
7. Click **"Save"**

## Paso 3: Configurar Webhook (Opcional pero Recomendado)

Los webhooks permiten que *arr notifique a Sweaterr cuando una descarga es importada, actualizando el estado en la UI.

### En Sonarr/Radarr

1. Ve a **Settings → Connect**
2. Click en **"+"**
3. Selecciona **"Webhook"**
4. Rellena:
   - **Name**: `Sweaterr Notify`
   - **On Grab**: ✅
   - **On Import**: ✅
   - **On Upgrade**: ✅
   - **On Rename**: ❌ (opcional)
   - **URL**: `http://localhost:3000/api/arr/notify`
   - **Method**: `POST`
   - **Username/Password**: Dejar vacío
5. Click **"Test"** → Debe devolver "✅ Success"
6. Click **"Save"**

## Paso 4: Probar el Indexer

### Búsqueda Interactiva

1. En Sonarr: Ve a una serie → **Search** → Click en 🔍 al lado de un episodio
2. En Radarr: Ve a una película → **Search** → Click en 🔍
3. Debería aparecer **"Sweaterr"** en la lista de indexers buscando
4. Tras unos segundos, debería mostrar resultados de tus foros configurados

### Búsqueda Automática

1. Añade una serie/película nueva a monitoreo
2. *arr buscará automáticamente en Sweaterr
3. Si encuentra resultados que cumplan los Quality Profiles, los descargará

### Verificar en Sweaterr

1. Ve a la pestaña **"Descargas"** en Sweaterr
2. Debería aparecer la descarga con:
   - Título del release
   - Estado: `pending` → `downloading` → `completed`
   - Origen: `*arr` (Sonarr/Radarr)

## Flujo Completo de Descarga

```
1. *arr busca contenido
   ↓
2. *arr consulta indexer Sweaterr
   ↓
3. Sweaterr busca en foros configurados
   ↓
4. Sweaterr devuelve resultados a *arr (RSS/XML)
   ↓
5. *arr selecciona mejor resultado según Quality Profile
   ↓
6. *arr envía comando de descarga a Sweaterr
   ↓
7. Sweaterr extrae enlaces del post del foro
   ↓
8. Sweaterr envía enlaces a JDownloader
   ↓
9. JDownloader descarga archivos
   ↓
10. *arr detecta archivos completados
   ↓
11. *arr importa y organiza archivos
   ↓
12. *arr envía webhook a Sweaterr
   ↓
13. Sweaterr actualiza estado a "completed" ✅
```

## Troubleshooting

### Error: "Unable to connect to indexer"

- Verifica que Sweaterr esté ejecutándose
- Comprueba la URL: debe ser `http://<host>:3000/api/arr` (sin trailing slash)
- Revisa que la API key sea correcta
- Si *arr está en Docker, usa la IP del host en lugar de `localhost`

### Error: "Invalid API Key"

- Copia nuevamente la API key desde Sweaterr UI
- Asegúrate de no copiar espacios extra
- Verifica que el servicio *arr esté **Enabled** (toggle verde) en Sweaterr

### No aparecen resultados

- Verifica que tengas foros configurados y habilitados en Sweaterr
- Comprueba que las credenciales del foro sean válidas
- Revisa los logs en la terminal de Sweaterr: busca `[arr-search]`
- Prueba una búsqueda manual en Sweaterr → Testing para verificar que funciona

### Descarga no aparece en JDownloader

- Verifica que JDownloader esté configurado y autenticado
- Revisa logs en Sweaterr: busca `[arr-grab]`
- Comprueba que el post del foro tenga enlaces válidos
- Asegúrate de que el botón "Gracias" se haya clickeado correctamente

### Webhook no funciona

- Verifica la URL del webhook: `http://<sweaterr-host>:3000/api/arr/notify`
- Revisa logs en Sweaterr: busca `[arr-notify]`
- Comprueba que el evento esté seleccionado (On Import, On Grab)
- Si *arr está en Docker, verifica que pueda alcanzar la red de Sweaterr

## Categorías Soportadas

Sweaterr soporta las siguientes categorías Torznab:

| ID   | Categoría | Subcategorías                               |
|------|-----------|---------------------------------------------|
| 2000 | Movies    | Foreign, SD, HD, UHD, BluRay, 3D           |
| 5000 | TV        | Foreign, SD, HD, UHD                        |
| 3000 | Audio     | MP3, FLAC, Other                            |
| 7000 | Books     | Ebook, Comics                               |

## Variantes de Búsqueda en Español

Sweaterr optimiza las búsquedas para foros hispanohablantes con variantes automáticas:

- `Breaking Bad S01E05` se busca también como:
  - `Breaking Bad 1x05`
  - `Breaking Bad Temporada 1 Episodio 5`
  - `Breaking Bad T1 Cap 5`

Esto mejora la tasa de aciertos en foros con nomenclatura no estándar.

## Notas Adicionales

- **Múltiples instancias**: Puedes añadir varios servicios (ej: "Sonarr 1080p" y "Sonarr 4K") con API keys diferentes
- **Seguridad**: La API key es necesaria para todas las peticiones; sin ella, *arr no podrá acceder
- **Logs**: Todos los eventos se registran en la tabla `ArrNotification` para auditoría
- **Placeholders**: Si una búsqueda falla, Sweaterr devuelve placeholders para evitar que *arr marque el indexer como offline

## Soporte

Para más información, consulta:

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Documentación técnica completa
- [TODOS.md](../TODOS.md) - Estado de features y pendientes
- Issues en GitHub (si aplicable)

---

**¡Disfruta de la automatización con Sweaterr! 🎉**
