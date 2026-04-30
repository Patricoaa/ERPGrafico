# Dev con Cloud + Local Nativo

Stack de desarrollo optimizado para máquinas con recursos limitados.

| Servicio | Dónde corre | Alternativa Cloud (0 RAM) | RAM Docker |
|---|---|---|---|
| PostgreSQL | Neon.tech (cloud) | - | 0 |
| Storage | Cloudflare R2 (cloud) | - | 0 |
| Redis | Docker local | **Upstash** (cloud) | 128 MB / 0 |
| Nginx | Docker local | - | 64 MB |
| Mailpit | Docker local | - | 64 MB |
| Backend Django | Nativo | **Railway** (cloud) | 0 |
| Frontend Next.js | Nativo | **Vercel** (cloud) | 0 |
| Celery worker | Nativo | **Railway** (cloud) | 0 |
| **Total Docker** | | | **~256 MB** |

> [!TIP]
> **¿Tienes una PC vieja disponible?** Si tienes hardware extra, el [Setup de Home Server](home-server-setup.md) es la opción recomendada. Es gratuita, 100% privada y ofrece el mejor rendimiento para tu laptop.

---

## Paso 0 — Prerequisitos

```bash
# Python (verificar versión)
python --version   # 3.11+

# Node.js
node --version     # 18+

# Docker
docker --version
```

---

## Paso 1 — Configurar Neon.tech (PostgreSQL cloud)

1. Crear cuenta en [neon.tech](https://neon.tech) (gratuito, sin tarjeta)
2. **New Project** → nombre: `erpgrafico` → región más cercana (ej. `us-east-2`)
3. Una vez creado, ir a **Connection Details**
4. En el dropdown de conexión elegir **"Connection string"** y copiar la URL

   Tiene este formato:
   ```
   postgresql://usuario:password@ep-xxxxx-xxxx.us-east-2.aws.neon.tech/erpgrafico?sslmode=require
   ```

5. Pegar esa URL como `DATABASE_URL` en `.env.dev`

> **Nota sobre auto-suspend:** Neon suspende la DB tras 5 minutos sin actividad (free tier). La primera query tras inactividad tarda ~500ms extra. Normal en dev, no afecta el flujo.

---

## Paso 2 — Configurar Cloudflare R2 (Storage cloud)

### 2.1 Crear cuenta y buckets

1. Crear cuenta en [cloudflare.com](https://cloudflare.com) (gratuito, 10 GB/mes)
2. Ir a **R2 Object Storage** en el panel
3. Crear dos buckets:
   - `erpgrafico-media-public` → para archivos públicos (imágenes de productos, etc.)
   - `erpgrafico-media-private` → para archivos privados (documentos, comprobantes)

### 2.2 Habilitar acceso público al bucket público

1. Ir a `erpgrafico-media-public` → **Settings** → **Public Access**
2. Activar **r2.dev subdomain** → copiar la URL generada
   - Formato: `pub-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.r2.dev`
3. Pegar esa URL como `AWS_S3_CUSTOM_DOMAIN` en `.env.dev`

### 2.3 Obtener credenciales API

1. En R2 → **Manage R2 API tokens** → **Create API token**
2. Permisos: **Object Read & Write** → alcance: **All buckets** (o los dos buckets del proyecto)
3. Copiar `Access Key ID` y `Secret Access Key`
4. Copiar el **Account ID** (en la URL del panel o en R2 Overview)


### 2.4 Completar `.env.dev` con las credenciales R2

```env
AWS_ACCESS_KEY_ID=el_access_key_id
AWS_SECRET_ACCESS_KEY=el_secret_key
AWS_S3_ENDPOINT_URL=https://TU_ACCOUNT_ID.r2.cloudflarestorage.com
AWS_S3_CUSTOM_DOMAIN=https://pub-XXXXXXXX.r2.dev
```

---

## Paso 3 — (Opcional) Configurar Upstash (Redis cloud)

Si quieres apagar el contenedor de Redis en tu PC:

1. Crear cuenta en [upstash.com](https://upstash.com)
2. **Create Database** → name: `erpgrafico-dev` → Type: **Regional** → Select Region (ej: `us-east-1`)
3. En la pestaña **Details**, busca la sección **Redis Connect**
4. Copia la URL que empieza con `rediss://`
5. En tu `.env.dev`, reemplaza `REDIS_URL`:
   ```env
   REDIS_URL=rediss://default:tu_password@tu_endpoint.upstash.io:6379
   ```
6. **Ya puedes apagar el contenedor local**: `docker compose stop redis`

---

## Paso 4 — Configurar `.env.dev`

Editar [.env.dev](../../.env.dev) con todas las credenciales obtenidas en los pasos anteriores.

Para generar un `DJANGO_SECRET_KEY` seguro:

```bash
python -c "import secrets; print(secrets.token_hex(50))"
```

---

## Paso 5 — Levantar el stack Docker mínimo

```bash
# Desde la raíz del proyecto
docker compose -f docker-compose.cloud-dev.yml up -d
```

Verificar que los 3 servicios están corriendo:

```bash
docker compose -f docker-compose.cloud-dev.yml ps
```

Salida esperada:

```
NAME        STATUS    PORTS
nginx       running   0.0.0.0:80->80/tcp
mailpit     running   0.0.0.0:1025->1025/tcp, 0.0.0.0:8025->8025/tcp
```

---

## Paso 6 — Configurar y levantar el backend

### 5.1 Crear y activar entorno virtual (primera vez)

```bash
cd backend
python3 -m venv venv
cd          # Linux/Mac
# venv\Scripts\activate           # Windows
pip install -r requirements.txt
```

### 5.2 Cargar variables de entorno

En **cada nueva terminal** donde corras el backend:

```bash
# Desde la raíz del proyecto
set -a && source .env.dev && set +a
cd backend
source venv/bin/activate
```

> En Windows PowerShell usar: `Get-Content ..\.env.dev | ForEach-Object { $env:$(($_ -split '=')[0]) = ($_ -split '=',2)[1] }`

### 5.3 Ejecutar migraciones (primera vez o tras nuevas migraciones)

```bash
python manage.py migrate
```

Las migraciones corren directamente sobre la DB de Neon.tech — mismo comando de siempre.

### 5.4 Cargar datos de demo (opcional, primera vez)

```bash
python manage.py setup_demo_data
```

### 5.5 Arrancar el servidor

```bash
python manage.py runserver 0.0.0.0:8100
```

Django estará disponible en:
- API: `http://localhost:8100/api/`
- Admin: `http://localhost:8100/admin/`
- Via Nginx: `http://localhost/api/` y `http://localhost/admin/`

#### **Alternativa Cloud: Railway (0 RAM local - Sin Tarjeta)**
Railway es ideal para desarrollo porque te regalan crédito inicial sin pedir tarjeta y detecta Docker automáticamente.

**1. Desplegar el Backend:**
1. Crea cuenta en [railway.app](https://railway.app) (con GitHub).
2. Haz clic en **+ New Project** → **Deploy from GitHub repo**.
3. Selecciona tu repositorio.
4. En **Settings** del servicio:
   - **Root Directory**: `/backend`
   - **Custom Deploy Command**: (opcional, suele detectar el Dockerfile solo).
5. En **Variables**, haz clic en **Raw Editor** y pega el contenido de tu `.env.dev`.
6. En **Settings** → **Networking**, haz clic en **Generate Domain** para obtener tu URL de API.

**2. Ejecutar Migraciones:**
1. En Railway, haz clic en tu servicio de Backend.
2. Ve a la pestaña **View Logs**.
3. Haz clic en la opción **Terminal** o usa el botón **+ New Service** → **Empty Service** para correr comandos temporales. 
   *(Nota: Railway también permite correr migraciones automáticamente en cada deploy si lo pones en el `start.sh`)*.

---

## Paso 7 — Levantar el frontend

En una **nueva terminal**:

```bash
cd frontend
npm install     # solo primera vez
npm run dev
```

Frontend disponible en:
- Directo: `http://localhost:3000`
- Via Nginx: `http://localhost` (recomendado, evita problemas de CORS)

#### **Alternativa Cloud: Vercel (0 RAM local)**
Para evitar la compilación pesada de Next.js en local:
1. Sube tu rama a GitHub y conéctala en [Vercel](https://vercel.com).
2. Configura las variables de entorno (`NEXT_PUBLIC_API_URL` apuntando a tu backend).
3. Vercel desplegará automáticamente en cada `git push`.

---

## Paso 8 — Celery (solo cuando se necesite)

Celery **no corre siempre** en este setup. Solo levantarlo al trabajar en features que usan tareas async.

En una **nueva terminal** (con las vars de entorno cargadas):

```bash
set -a && source .env.dev && set +a
cd backend
source venv/bin/activate

# Worker — ejecuta tareas async
celery -A config worker -l INFO

# Beat — ejecuta tareas programadas (en otra terminal si es necesario)
celery -A config beat -l INFO
```

#### **Alternativa Cloud: Railway (0 RAM local)**
Si no quieres correr Celery en tu PC, puedes usar la misma cuenta de Railway:

1. En tu proyecto de Railway, haz clic en **+ New** → **GitHub Repo**.
2. Selecciona el mismo repositorio.
3. En **Settings** de este nuevo servicio (cámbiale el nombre a `celery-worker`):
   - **Root Directory**: `/backend`
   - **Custom Deploy Command**: `celery -A config worker -l INFO`
4. Asegúrate de que las **Variables** sean las mismas que el Backend.
5. ¡Listo! Tendrás el worker procesando tareas en la nube.

---

## Paso 9 — Hacer una nueva migración

El flujo es idéntico al setup anterior — Django no sabe que la DB está en Neon:

```bash
# Terminal con vars cargadas y venv activo
python manage.py makemigrations nombre_app
python manage.py migrate
```

La migración se aplica sobre la DB de Neon. No hay pasos extra.

---

## Referencias de URLs en dev

| URL | Qué es |
|---|---|
| `http://localhost` | Entrada principal (via Nginx) |
| `http://localhost/api/` | API Django |
| `http://localhost/admin/` | Django Admin |
| `http://localhost:3000` | Frontend directo (sin Nginx) |
| `http://localhost:8100` | Backend directo (sin Nginx) |
| `http://localhost:8025` | Mailpit — bandeja de emails capturados |
| `https://console.neon.tech` | Panel DB cloud |
| `https://dash.cloudflare.com` | Panel R2 cloud |

---

## Apagar el stack

```bash
# Detener Docker (redis, nginx, mailpit)
docker compose -f docker-compose.cloud-dev.yml down

# Los procesos nativos (Django, Next.js, Celery) se detienen con Ctrl+C
```

---

## Troubleshooting

**`connection refused` al conectar con Neon**
- Verificar que `DATABASE_URL` en `.env.dev` tenga `?sslmode=require` al final
- La primera query tras 5 min de inactividad tarda ~500ms — no es un error

**`NoSuchBucket` o `SignatureDoesNotMatch` en R2**
- Verificar `AWS_S3_ENDPOINT_URL` incluye el Account ID correcto
- Verificar que `AWS_S3_REGION_NAME=auto` (R2 no acepta regiones reales)
- Los buckets deben existir en R2 antes de usarlos

**Emails no aparecen en Mailpit**
- Verificar que Mailpit está corriendo: `docker compose -f docker-compose.cloud-dev.yml ps`
- Verificar que las vars de email están cargadas: `echo $EMAIL_HOST` → debe mostrar `localhost`
- La UI de Mailpit es `http://localhost:8025`, no `localhost:1025` (ese es solo el SMTP)

**Nginx retorna 502 Bad Gateway**
- El backend o frontend nativos no están corriendo
- Verificar que Django responde en `http://localhost:8100`
- Verificar que Next.js responde en `http://localhost:3000`

**`redis.exceptions.ConnectionError`**
- Redis no está corriendo: `docker compose -f docker-compose.cloud-dev.yml up -d redis`
