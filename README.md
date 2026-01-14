<p align="center">
  <img src="public/logo.png" alt="Sweaterr Logo" width="300">
</p>

# Sweaterr

Aplicación web para integrar foros de descarga directa con Sonarr/Radarr/Lidarr utilizando JDownloader como backend y IA para el mapeo de nombres.

## Características

- 🌐 **Múltiples Foros**: Configura tantos foros de descarga directa como necesites
- 🤖 **Inteligencia Artificial**: Usa IA para mapear nombres "bonitos" de foros a nombres de scene y extraer metadatos de contenido
- 📥 **JDownloader Integration**: Envía enlaces directamente a tu instancia de JDownloader con nombres de paquete enriquecidos
- 🔍 **Búsqueda Inteligente**: Busca en múltiples foros y muestra los mejores resultados con metadatos (calidad, temporada, idiomas, etc.)
- 📊 **Panel de Control**: Interfaz web completa para configuración y monitoreo con vista de tabla para foros
- 🔐 **Gestión de Sesiones FlareSolverr**: Control en tiempo real de sesiones persistentes por foro con TTL configurable
- 🐳 **Docker Ready**: Fácil despliegue con Docker y Docker Compose
- 🔒 **Sonarr/Radarr Compatible**: Funciona como indexer y client para *arr applications
- 🧪 **Testing Avanzado**: Herramientas de prueba con extracción automática de metadatos (series/películas)

## Requisitos

- Docker y Docker Compose (recomendado)
- Node.js 18+ (para desarrollo local)
- Cuenta en My JDownloader
- Cuenta en un proveedor de IA (OpenAI, DeepSeek, Perplexity, etc.)
- Acceso a foros de descarga directa con credenciales

## Instalación

### Con Docker (Recomendado)

1. **Clonar el repositorio**:

   ```bash
   git clone <repository-url>
   cd sweaterr
   ```

2. **Configurar variables de entorno**:

   ```bash
   cp .env.example .env
   # Editar .env con tus configuraciones
   ```

3. **Levantar con Docker Compose**:

   ```bash
   docker-compose up -d
   ```

4. **Acceder a la aplicación**:
   Abre <http://localhost:3000> en tu navegador

### Desarrollo Local

1. **Instalar dependencias**:

   ```bash
   npm install
   ```

2. **Configurar variables de entorno**:

   ```bash
   # Crear archivo .env.local
   echo 'DATABASE_URL="file:./dev.db"' > .env.local
   ```

3. **Configurar base de datos**:

   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **Iniciar servidor de desarrollo**:

   ```bash
   npm run dev
   ```

   La aplicación estará disponible en <http://localhost:3000>

## Configuración

### 1. Configurar JDownloader

Ve a la pestaña **Configuración** → **JDownloader**:

- **Nombre del Dispositivo**: El nombre configurado en My JDownloader
- **Email**: Tu email de My JDownloader
- **Contraseña**: Tu contraseña de My JDownloader

### 2. Configurar Inteligencia Artificial

Ve a la pestaña **Configuración** → **Inteligencia Artificial**:

- **Proveedor**: OpenAI, DeepSeek, Perplexity, o Ollama
- **Modelo**: El modelo específico del proveedor
- **API Key**: Tu API key (no necesaria para Ollama local)
- **Base URL**: URL personalizada (opcional, requerido para Ollama)

### 3. Configurar Foros

Ve a la pestaña **Foros** para ver la tabla de foros configurados con:

- **Estado de conexión** en tiempo real
- **Sesiones FlareSolverr** activas con tiempo restante
- **Duración de sesión** configurable por foro
- **Acciones rápidas** (editar/eliminar)

Para añadir un nuevo foro, click en **Añadir Foro**:

- **Nombre del Foro**: Nombre descriptivo (ej: "DescargasDD")
- **URL Base**: URL principal del foro (ej: `https://descargasdd.org`)
- **Modo de Búsqueda**:
  - **Nativo**: El foro tiene búsqueda integrada
  - **Google (site:)**: El foro redirige a Google (como DescargasDD)
  - **Google CSE**: Usa un motor CSE de Google
- **Ruta de Búsqueda**: Solo necesaria para modo nativo
- **Autenticación**: Si el foro requiere usuario y contraseña
- **Selectores CSS**: Para parsear contenido (opcional, auto-rellenado para foros conocidos)
- **Duración de Sesión**: Tiempo de vida de la sesión FlareSolverr (5-1440 minutos)

#### Gestión de Sesiones

Cada foro puede tener una sesión persistente de FlareSolverr que:

- Se crea automáticamente al primer uso con Cloudflare
- Se reutiliza durante el período configurado (TTL)
- Se muestra en la tabla con indicador de tiempo restante
- Se destruye automáticamente al expirar (limpieza cada 5 minutos)
- Mejora el rendimiento evitando resolver Cloudflare en cada request

#### Ejemplo: DescargasDD

1. Nombre: `DescargasDD`
2. URL Base: `https://descargasdd.org`
3. Modo de Búsqueda: `Google (site:)` (se auto-selecciona si pones "DescargasDD")
4. Usuario y Contraseña: Tus credenciales del foro
5. Click en **Probar Conexión** para verificar que la autenticación funciona
6. Click en **Añadir Foro**

La aplicación automáticamente:

- Detecta que es DescargasDD
- Configura los selectores CSS para parsear el contenido
- Usa Google para buscar dentro del foro
- Se autentica para poder ver y hacer clic en el botón "Gracias"
- Extrae los enlaces de descarga

## Uso

### Buscar Contenido

1. Ve a la pestaña **Descargas** → **Buscar Contenido**
2. Ingresa tu búsqueda (ej: "SurrealState S01E03")
3. Selecciona el foro o busca en todos
4. Revisa los resultados y haz clic en el que quieras descargar

### Monitorear Descargas

- **Resumen**: Vista general del estado de todos los servicios
- **Descargas**: Lista activa con progreso en tiempo real
- **Foros**: Vista de tabla con estado de conexión y sesiones FlareSolverr en tiempo real

### Testing y Análisis

La pestaña **Testing** ofrece herramientas avanzadas para:

1. **Búsqueda de Contenido**:
   - Prueba búsquedas en foros específicos
   - Ve resultados con metadatos extraídos automáticamente
   - Botones: **Buscar**, **Buscar todos** (nativo) y, dentro de resultados, **Mostrar más** / **Cargar todos**
   - **Buscar**: Ejecuta la búsqueda estándar (primera página)
   - **Buscar todos**: En modo nativo, reutiliza el `searchid` y pagina automáticamente (`page=1..N`) para devolver todos los resultados en una sola pasada
   - **Mostrar más**: Carga la siguiente página reutilizando el `searchid`
   - **Cargar todos**: Agrega todas las páginas restantes desde el estado actual, evitando duplicados

2. **Análisis de Títulos**:
   - Extrae y analiza títulos de posts individuales o múltiples URLs
   - Resuelve títulos de forma bulk para mayor eficiencia
   - Opción de bypass de Axios para forzar uso de FlareSolverr

3. **Extracción de Metadatos**:
   - Tipo de contenido (Serie/Película)
   - Año de lanzamiento
   - Temporada y episodios (para series)
   - Calidad de video (1080p, 720p, 4K, etc.) y fuente (BluRay, WEB-DL, etc.)
   - Idiomas de audio y subtítulos
   - Tamaño del archivo
   - Géneros (vía IA)

4. **Vista de Resultados en Tabla**:
   - Columnas dinámicas según tipo de contenido
   - Acciones: Extraer enlaces o Enviar a JDownloader
   - Nombre de paquete automático basado en metadatos
      - Encabezado muestra: "Mostrando X de Y resultados" o "Mostrando los Y resultados" cuando se detecta el total del foro

### Totales de resultados (vBulletin)

- En foros nativos (vBulletin) el sistema detecta el total con patrones como: `Resultados 1 al 25 de 30`, `Results 1 - 25 of 30`, o variantes de "Mostrando resultados ... de Y".
- Este total se usa para:
  - Mostrar en UI la indicación "Mostrando X de Y"
  - Detener **Buscar todos** / **Cargar todos** cuando se alcanza el total
  - Evitar mezclar resultados de búsquedas distintas, reutilizando el mismo `searchid` para todas las páginas

## Integración con Sonarr/Radarr/Lidarr

### Como Indexer

Sweaterr expone un endpoint Newznab/Torznab compatible para usarlo como indexer en *arr:

```http
GET /api/arr?t=caps&apikey=<forum_torznabApiKey>
GET /api/arr?t=tvsearch&q=<query>&season=<season>&ep=<ep>&apikey=<forum_torznabApiKey>
GET /api/arr?t=movie&q=<query>&apikey=<forum_torznabApiKey>
GET /api/arr?t=get&id=<guid>&apikey=<forum_torznabApiKey>
```

En Sonarr/Radarr: **Settings → Indexers → Add New → Newznab**

- URL: `http://<host>:3000/api/arr`
- API Key: la `torznabApiKey` del foro

Importante: la URL debe ser accesible desde el host/container de Sonarr (evita `http://localhost:3000` si Sonarr está en Docker).

### Como Client

Notifica automáticamente a Sonarr/Radarr cuando una descarga se completa:

```http
POST /api/arr/notify
{
   "type": "sonarr|radarr|lidarr",
   "url": "http://sonarr:8989",
   "apiKey": "your-api-key",
   "downloadId": "download-identifier"
}
```

## Configuración Avanzada

### Variables de Entorno

- `DATABASE_URL`: URL de la base de datos SQLite
- `NEXTAUTH_SECRET`: Secreto para NextAuth.js
- `NEXTAUTH_URL`: URL pública de la aplicación
- `LOG_LEVEL`: Nivel de logging (debug, info, warn, error)
- `FLARESOLVERR_URL`: URL del servicio FlareSolverr (recomendado). Si está presente, se usará para resolver Cloudflare con sesiones persistentes.
- `MYJD_APPKEY` (opcional): App Key para MyJDownloader. Por defecto se usa `myjd_webextension_firefox`. Útil para pruebas con claves alternativas (ej. `DEMOAPIAPP`).

### Foros Soportados

Actualmente con preconfiguración para:

- DescargasDD.org
- Extensible a otros foros mediante configuración de selectores CSS

Cada foro puede configurar:

- **Selectores de parseo**: Botón de gracias, contenedor de enlaces, título del post
- **TTL de sesión FlareSolverr**: Entre 5 minutos y 24 horas
- **Cookies persistentes**: Se guardan y reutilizan automáticamente

### Gestión de Sesiones FlareSolverr

El sistema implementa un gestor de sesiones persistentes que:

- **Crea sesiones bajo demanda**: Solo cuando es necesario resolver Cloudflare
- **Reutiliza sesiones activas**: Evita crear nuevas sesiones innecesariamente
- **TTL configurable por foro**: Cada foro puede tener su propio tiempo de expiración
- **Limpieza automática**: Destruye sesiones expiradas cada 5 minutos
- **Monitoreo en tiempo real**: La UI muestra estado y tiempo restante de cada sesión
- **Logs detallados**: Registro completo en `logs/cloudflare.log`

Ventajas:

- ✅ Reducción de ~95% en tiempo de respuesta tras primera ejecución (30s → 1s)
- ✅ Menor carga en servidor FlareSolverr
- ✅ Gestión eficiente de recursos (Chromium)
- ✅ Mejor experiencia de usuario

### Bypass de Cloudflare

Para foros detrás de Cloudflare (como DescargasDD), se utiliza **FlareSolverr** (recomendado):

```env
FLARESOLVERR_URL=http://192.168.1.100:8191
```

**Características**:

- Resuelve challenges de Cloudflare Turnstile
- Gestión automática de cookies y headers
- Sesiones persistentes con TTL configurable
- Limpieza automática de sesiones expiradas

**Fallback con Playwright**: Si no configuras FlareSolverr, la app intentará con Playwright (limitado). Instala navegadores:

```bash
npx playwright install chromium
```

### Extracción de Metadatos con IA

El sistema puede usar IA para enriquecer metadatos de contenido:

**Heurísticas integradas** (sin IA):

- Detección de tipo (serie/película) vía keywords
- Extracción de año (1950-2027)
- Temporadas: T1, Temp1, S1, Temporada 1ª, 1ª Temporada
- Calidad: 4K/2160p, 1080p, 720p + fuente (BluRay, WEB-DL, etc.)
- Idiomas: Audio y subtítulos (es-ES, es-LA, en, fr)
- Episodios: Formato X/Y (ej: 10/12)
- Tamaño: GB, GiB, MB con decimales (2.5GB, 3.14GiB)

**Con IA** (enriquecimiento):

- Validación y corrección de metadatos heurísticos
- Extracción de géneros
- Mejor precisión en títulos ambiguos
- Normalización de datos

### Proveedores de IA Soportados

- **OpenAI**: GPT-4, GPT-3.5 Turbo
- **DeepSeek**: DeepSeek Chat, DeepSeek Coder
- **Perplexity**: Modelos disponibles
- **Ollama**: Modelos locales (Llama2, CodeLlama, Mistral, etc.)

## Desarrollo

### Estructura del Proyecto

```text
src/
├── app/                    # App Router de Next.js
│   ├── api/               # APIs del backend
│   ├── page.tsx           # Página principal
│   └── layout.tsx         # Layout principal
├── components/             # Componentes React
│   ├── ui/                # Componentes shadcn/ui
│   ├── config/            # Componentes de configuración
│   ├── downloads/         # Componentes de descargas
│   └── forums/            # Componentes de foros
├── lib/                   # Utilidades y servicios
│   ├── services/          # Servicios principales
│   ├── types.ts           # Tipos TypeScript
│   └── db.ts              # Cliente Prisma
├── hooks/                 # Hooks personalizados
└── prisma/                # Esquema de base de datos
```

### Scripts Disponibles

- `npm run dev`: Servidor de desarrollo
- `npm run build`: Build de producción
- `npm run start`: Servidor de producción
- `npm run lint`: Linting del código
- `npm run db:push`: Push schema a DB
- `npm run db:generate`: Generar cliente Prisma

## Troubleshooting

### Problemas Comunes

1. **Error de conexión con JDownloader**:
   - Verifica que My JDownloader esté configurado
   - Confirma el nombre del dispositivo
   - Revisa credenciales

2. **La IA no responde**:
   - Verifica API key y modelo
   - Confirma que el proveedor esté correcto
   - Revisa límites de cuota

3. **No se encuentran resultados en foros**:
   - Verifica credenciales del foro
   - Revisa selectores CSS
   - Confirma que el foro esté accesible

### Logs

Para ver logs de la aplicación:

```bash
# Docker
docker-compose logs -f sweaterr

# Desarrollo local
npm run dev  # Logs en consola
```

## Contribuir

1. Fork del repositorio
2. Crear feature branch: `git checkout -b feature/nueva-funcionalidad`
3. Commit changes: `git commit -am 'Añadir nueva funcionalidad'`
4. Push branch: `git push origin feature/nueva-funcionalidad`
5. Submit Pull Request

## Licencia

Este proyecto está licenciado bajo la MIT License.

## Soporte

Para soporte o preguntas:

- Abrir un issue en GitHub
- Revisar la documentación
- Contactar al maintainers

---

**Nota**: Esta aplicación es para uso educativo y personal. Respeta siempre los términos de servicio de los foros y las leyes de copyright de tu jurisdicción.
