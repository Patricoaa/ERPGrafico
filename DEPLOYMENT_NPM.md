# 🚀 Guía de Despliegue en Producción con Nginx Proxy Manager (NPM)

Esta guía documenta la **Opción de Nginx Sidecar**. En esta arquitectura, Nginx Proxy Manager (NPM) actúa como puerta de enlace pública manejando SSL y dominios, mientras que un contenedor Nginx "Sidecar" local dentro de tu aplicación se encarga de servir los archivos estáticos/media al instante y enrutar el resto de las peticiones a Django y Next.js.

**Ventajas de esta arquitectura:**
- NPM se mantiene limpio y genérico (solo reenvía tráfico a una IP y puerto).
- Las descargas de archivos estáticos e imágenes (media) no consumen RAM ni procesador en Django.
- Se asegura la retención de los archivos subidos al usar volúmenes nombrados compartidos.

---

## 1. Archivos Requeridos

Deberás añadir los siguientes dos archivos a tu proyecto (o servidor de producción).

### A. Configuración de Nginx (Sidecar)

Crea el archivo **`nginx/nginx.prod.conf`**.

```nginx
# nginx/nginx.prod.conf

upstream frontend {
    server frontend:3000;
}

upstream backend {
    # En producción deberías usar Gunicorn en el backend en lugar del servidor de desarrollo
    server backend:8100;
}

server {
    listen 80;
    server_name _; 

    # Tamaño máximo de archivos para subida
    client_max_body_size 20M;

    # 1. API y Admin de Django
    location /api/ {
        proxy_pass         http://backend;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location /admin/ {
        proxy_pass         http://backend;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }

    # 2. Servir Archivos Subidos (Media) DIRECTAMENTE desde el Volumen
    location /media/ {
        alias /app/media/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        access_log off;
    }

    # Opcional: También servir static_files comprimidos de Django
    location /static/ {
        alias /app/staticfiles/;
        expires 30d;
    }

    # 3. Next.js App
    location /_next/static/ {
        proxy_pass http://frontend;
        proxy_cache_bypass $http_upgrade;
        expires 365d;
        access_log off;
    }

    location / {
        proxy_pass         http://frontend;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### B. El archivo Docker Compose de Producción

Crea el archivo **`docker-compose.prod.yml`** en la raíz. Este unificará tu proyecto y asignará el volumen de Media a Nginx.

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    restart: always
    env_file: .env.prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - erp_net

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - erp_net

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: development # O un target production si lo optimizas después
    restart: always
    env_file: .env.prod
    environment:
      - DJANGO_DEBUG=False
    # gunicorn recomendado para producción:
    command: ["gunicorn", "--bind", "0.0.0.0:8100", "--workers", "3", "--timeout", "120", "config.wsgi:application"]
    volumes:
      - media_data:/app/media   # VOLUMEN DE ARCHIVOS COMPARTIDO
      - static_data:/app/staticfiles
    networks:
      - erp_net
    depends_on:
      - db
      - redis

  # Celery
  celery-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    env_file: .env.prod
    command: ["celery", "-A", "config", "worker", "-l", "INFO", "--concurrency=2"]
    volumes:
      - media_data:/app/media
    networks:
      - erp_net
    depends_on:
      - db
      - redis

  celery-beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    env_file: .env.prod
    command: ["celery", "-A", "config", "beat", "-l", "INFO", "--scheduler", "django_celery_beat.schedulers:DatabaseScheduler"]
    networks:
      - erp_net
    depends_on:
      - db
      - redis

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: always
    env_file: .env.prod
    environment:
      - NODE_ENV=production
    command: ["npm", "run", "start"]
    networks:
      - erp_net

  # === EL NGINX SIDECAR ===
  nginx-sidecar:
    image: nginx:1.27-alpine
    restart: always
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
      - media_data:/app/media:ro      # ACCESO LECTURA A LAS IMÁGENES
      - static_data:/app/staticfiles:ro
    ports:
      # Puerto que expondremos a NPM (ejemplo: 8080 en localhost)
      - "127.0.0.1:8080:80"
    networks:
      - erp_net
    depends_on:
      - backend
      - frontend

networks:
  erp_net:
    driver: bridge # Si NPM vive en la misma máquina en red Docker, usa 'external: true' para su red

volumes:
  postgres_data:
  redis_data:
  media_data:     # Aquí vivirán persistentes los archivos subidos
  static_data:
```

---

## 2. Configuración en Nginx Proxy Manager (NPM)

Asegúrate de correr tu aplicación primero: `docker compose -f docker-compose.prod.yml up -d`

Luego, entra al panel web de NPM y configura esto:

1. Ve a **Proxy Hosts** -> **Add Proxy Host**.
2. **Domain Names:** `erp.tudominio.com` (u otro correspondiente).
3. **Scheme:** `http`
4. **Forward Hostname / IP:** Si NPM corre en la misma máquina, puedes poner la IP del servidor en la red de docker (`172...`) o dejar que mapee por tu IP estática local del servidor. Si usas red docker unida, usa el nombre del contenedor `nginx-sidecar`. Si no lo unes a redes de docker, pon la **IP local de la máquina del host VPS** (ej: la IP eth0 interna).
5. **Forward Port:** `8080` (Apunta directamente a tu Sidecar expuesto que pusimos arriba).
6. **Block Common Exploits:** Activar.
7. Pestaña **SSL**: 
   - Solicita un certificado para tu dominio.
   - Selecciona **Force SSL**.
8. Guardar.

### 🌟 Lo que hemos conseguido:
```
Navegador (Pide foto con HTTPS) 
   ↳ Nginx Proxy Manager (Recibe HTTPS -> Convierte a HTTP interno y manda a IP:8080)
        ↳ Nginx Sidecar (Ve que es '/media/', lee desde el volumen persistente 'media_data')
             ↳ Responde directo la imagen (Django nunca recibe ningún byte de esta carga).
```
