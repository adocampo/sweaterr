<p align="center">
  <img src="public/sweaterr.png" alt="Sweaterr Logo" width="300">
</p>

# Sweaterr

Aplicación web para integrar foros de descarga directa con Sonarr/Radarr/Lidarr utilizando JDownloader como backend y IA para el mapeo de nombres.

## Características

- 🌐 **Múltiples Foros**: Configura tantos foros de descarga directa como necesites
- 🤖 **Inteligencia Artificial**: Usa IA para mapear nombres "bonitos" de foros a nombres de scene
- 📥 **JDownloader Integration**: Envía enlaces directamente a tu instancia de JDownloader
- 🔍 **Búsqueda Inteligente**: Busca en múltiples foros y muestra los mejores resultados
- 📊 **Panel de Control**: Interfaz web completa para configuración y monitoreo
- 🐳 **Docker Ready**: Fácil despliegue con Docker y Docker Compose
- 🔒 **Sonarr/Radarr Compatible**: Funciona como indexer y client para *arr applications

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

Ve a la pestaña **Foros** → **Añadir Foro**:

- **Nombre del Foro**: Nombre descriptivo (ej: "DescargasDD")
- **URL Base**: URL principal del foro (ej: `https://descargasdd.org`)
- **Modo de Búsqueda**:
  - **Nativo**: El foro tiene búsqueda integrada
  - **Google (site:)**: El foro redirige a Google (como DescargasDD)
  - **Google CSE**: Usa un motor CSE de Google
- **Ruta de Búsqueda**: Solo necesaria para modo nativo
- **Autenticación**: Si el foro requiere usuario y contraseña
- **Selectores CSS**: Para parsear contenido (opcional, auto-rellenado para foros conocidos)

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
- **Foros**: Estado de conexión de cada foro configurado

## Integración con Sonarr/Radarr/Lidarr

### Como Indexer

La aplicación expone una API compatible con Sonarr/Radarr para buscar contenido:

```http
GET /api/arr/indexer?query=<search_query>
```

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
- `FLARESOLVERR_URL`: URL del servicio FlareSolverr (opcional). Si está presente, se usará para resolver Cloudflare y obtener cookies de sesión.

### Foros Soportados

Actualmente con preconfiguración para:

- DescargasDD.org
- Extensible a otros foros mediante configuración de selectores CSS

### Bypass de Cloudflare

Para foros detrás de Cloudflare (como DescargasDD), hay dos estrategias:

- Playwright (Chromium): navegación automática para pasar el reto y enviar formularios.
- FlareSolverr: servicio dedicado para resolver el reto y devolver cookies.

Para usar FlareSolverr, configura en `.env.local`:

```env
FLARESOLVERR_URL=http://192.168.1.100:8191
```

Si no configuras FlareSolverr, la app intentará con Playwright. Para Playwright, instala los navegadores:

```bash
npx playwright install chromium
```

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
