# 🚀 Instrucciones de Setup desde Cero - Sweaterr

## Requisitos Previos

- Node.js 18+ instalado
- Docker con FlareSolverr corriendo en `192.168.1.100:8191`
- Git instalado

---

## Paso 1: Clonar el Repositorio

```bash
cd ~/development
git clone git@github.com:adocampo/sweaterr.git sweaterr
cd sweaterr
```

---

## Paso 2: Crear Archivo `.env.local`

**CRÍTICO**: Este archivo NO está en GitHub y debes crearlo manualmente.

```bash
cat > .env.local << 'EOF'
DATABASE_URL="file:./dev.db"
FLARESOLVERR_URL=http://192.168.1.100:8191
EOF
```

### Variables Opcionales (agregar si es necesario)

```bash
# JWT Secret (genera uno random si quieres autenticación)
JWT_SECRET="tu-secret-key-super-seguro"

# Google CSE (si usas búsqueda google_cse)
NEXT_PUBLIC_CSE_ID="44f04a516a5b84434"

# Proxy para FlareSolverr (si Google bloquea tu IP)
FLARESOLVERR_PROXY_URL="http://user:pass@proxy-host:port"
```

---

## Paso 3: Instalar Dependencias

```bash
npm install
```

---

## Paso 4: Configurar Base de Datos (Prisma)

### Aplicar Migraciones

```bash
npx prisma migrate dev
```

Esto creará:

- `prisma/dev.db` (base de datos SQLite)
- Todas las tablas necesarias

### Verificar Prisma Client

```bash
npx prisma generate
```

---

## Paso 5: Iniciar Servidor de Desarrollo

```bash
npm run dev
```

El servidor estará en: `http://localhost:3000`

---

## Paso 6: Configurar Primer Usuario (Setup)

1. Navega a: `http://localhost:3000/setup`
2. Crea el usuario administrador:
   - Username: `admin`
   - Email: `admin@example.com`
   - Password: `tu-password`

---

## Paso 7: Configurar Foro de Prueba (DescargasDD)

1. Login en: `http://localhost:3000/login`
2. Ve a la pestaña **"Configuración"** → **"Foros"**
3. Click en **"Añadir Foro"**
4. Configuración para DescargasDD:

   ```
   Nombre: DescargasDD
   URL Base: https://descargasdd.org
   Ruta de Búsqueda: /search.php?search_type=1
   Modo de Búsqueda: native
   Etiqueta de Foro: Zona Series
   TTL Sesión FlareSolverr: 30 minutos
   
   Credenciales (Opcional):
   Usuario: user
   Contraseña: password
   ```

5. Click **"Guardar"**
6. Click **"Probar Conexión"** para verificar

---

## Paso 8: Probar Búsqueda Nativa

1. Ve a la pestaña **"Testing"**
2. Selecciona foro: **DescargasDD**
3. Query: `Breaking Bad T1`
4. Marca **"Buscar solo en título"**
5. Click **"Buscar"**

**Resultado esperado**: 4-10 resultados de Breaking Bad Temporada 1

---

## 🐛 Troubleshooting

### Problema: "Cannot find module '@prisma/client'"

**Solución**:

```bash
npx prisma generate
npm install @prisma/client
```

### Problema: "ECONNREFUSED 192.168.1.100:8191"

**Solución**: Verifica que FlareSolverr esté corriendo:

```bash
curl http://192.168.1.100:8191/v1
```

Respuesta esperada: `{"error": "Request is missing 'cmd' parameter"}`

### Problema: "SECURITYTOKEN = guest" en logs

**Causa**: Cookies expiradas o credenciales incorrectas.

**Solución**:

1. Ve a Configuración → Foros
2. Click en icono de refresh (🔄) para borrar cookies
3. Si no funciona, re-autentica con credenciales válidas

### Problema: Búsqueda retorna 0 resultados

**Diagnóstico**:

```bash
tail -50 logs/search.log
```

**Busca en los logs**:

- `SECURITYTOKEN = "guest"` → Problema de autenticación
- `Could not extract search results URL (searchid)` → Problema de parsing
- `Axios native search attempt failed` → Cloudflare bloqueando

**Solución según el error**:

- Guest: Refresca cookies o re-autentica
- No searchid: Verifica que `searchMode = native` y `searchPath` correcto
- Axios 403: FlareSolverr tomará el relevo automáticamente

---

## 📁 Estructura de Archivos NO en GitHub

Estos archivos NO están en el repositorio y se generan localmente:

```
sweaterr/
├── .env.local                    # Variables de entorno (CRÍTICO)
├── prisma/
│   └── dev.db                    # Base de Datos SQLite
├── logs/                          # Logs por módulo
│   ├── search.log
│   ├── forum.log
│   ├── cloudflare.log
│   └── ...
├── node_modules/                  # Dependencias npm
├── .next/                         # Build de Next.js
└── ARCHITECTURE.md                # Documentación técnica
```

---

## ✅ Verificación Final

Ejecuta estos comandos para verificar que todo está OK:

```bash
# 1. Base de datos existe
ls -lh prisma/dev.db

# 2. FlareSolverr responde
curl http://192.168.1.100:8191/v1

# 3. Servidor dev corriendo
curl http://localhost:3000/api/config/forums

# 4. Logs se están generando
ls -lh logs/
```

Si todos los comandos funcionan, el setup está completo. ✨

---

## 🔄 Para Sincronizar Cambios desde GitHub

Si ya tienes el repo clonado y quieres actualizarlo:

```bash
cd ~/development/sweaterr
git pull origin master
npm install                    # Por si hay nuevas dependencias
npx prisma migrate dev         # Aplicar nuevas migraciones
npm run dev                    # Reiniciar servidor
```

**IMPORTANTE**: NO borres `.env.local` ni `prisma/dev.db` al actualizar.

---

## 📞 Soporte

Si algo falla, revisa:

1. Logs en `logs/search.log` y `logs/forum.log`
2. Console del navegador (F12)
3. Terminal donde corre `npm run dev`

Comparte los logs relevantes para debugging.
