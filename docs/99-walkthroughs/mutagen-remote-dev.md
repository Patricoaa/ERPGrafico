# Walkthrough: Entorno de Desarrollo Remoto con Mutagen (Live Sync)

Este documento detalla el procedimiento para configurar un entorno de desarrollo remoto donde la **edición de código ocurre en la PC Local** (con IDEs como Antigravity), pero la **ejecución y el hot-reload suceden en un servidor dedicado de 4GB** mediante Docker Compose.

Esta arquitectura elimina los altos consumos de RAM y CPU en la máquina local, sincronizando los archivos hacia el servidor en milisegundos mediante `mutagen`.

## 🏗️ Arquitectura
- **PC Local (Laptop/Antigravity)**: Sólo mantiene el código fuente, la sesión de Git y el IDE abierto. No requiere Node, Python ni Docker.
- **Servidor Remoto (4GB RAM)**: Aloja los contenedores de Docker (Next.js, Django, Postgres, Redis, Celery). No necesita tener el repositorio clonado directamente por Git.
- **Sincronización (Mutagen)**: Crea un túnel SSH bidireccional casi instantáneo ignorando directorios pesados (`node_modules`, `.next`, `venv`).

---

## 🛠️ Paso 1: Configuración de Conexión SSH (Sin contraseñas)

Mutagen necesita conectarse al servidor en segundo plano de manera invisible, por lo que es obligatorio configurar llaves SSH.

En la terminal de la **PC Local**:

1. **Generar una llave SSH segura (ed25519) sin contraseña**:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
   ```

2. **Copiar la llave al servidor remoto**:
   ```bash
   ssh-copy-id pato@192.168.1.95
   ```
   *(Pedirá la contraseña por última vez).*

3. **Verificar acceso automático**:
   ```bash
   ssh pato@192.168.1.95 'pwd'
   ```
   *(Debería imprimir `/home/pato` sin pedir credenciales).*

---

## 🚀 Paso 2: Instalación de Mutagen (PC Local)

Mutagen requiere dos componentes: el binario principal y el paquete de agentes que se inyecta en el servidor remoto. Todo se instala **sólo en la PC local**.

```bash
cd /tmp
wget https://github.com/mutagen-io/mutagen/releases/download/v0.18.0/mutagen_linux_amd64_v0.18.0.tar.gz
tar -xzvf mutagen_linux_amd64_v0.18.0.tar.gz

# Mover ambos archivos al PATH del sistema
sudo mv mutagen /usr/local/bin/
sudo mv mutagen-agents.tar.gz /usr/local/bin/
```

> **⚠️ Alerta de Error Común**: Si omites mover el archivo `mutagen-agents.tar.gz`, Mutagen fallará al arrancar con el error: `unable to locate agent bundle`.

---

## ⚙️ Paso 3: Configuración del Proyecto (`mutagen.yml`)

En la raíz del proyecto local (`/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico`), existe el archivo `mutagen.yml` que define las reglas de sincronización:

```yaml
sync:
  defaults:
    mode: "two-way-resolved"
    ignore:
      vcs: true # Ignora la carpeta .git (ahorra ancho de banda)
      paths:
        - "frontend/node_modules/"
        - "frontend/.next/"
        - "**/__pycache__/"
        - "**/*.pyc"
        - "backend/venv/"
        - "postgres_data/"
        - "redis_data/"
        - "minio_data/"
        - ".vscode/"
        - ".idea/"
        - ".gemini/"
        - ".agents/"

  erpgrafico-sync:
    alpha: "."
    beta: "pato@192.168.1.95:/home/pato/ERPGrafico"
```

---

## 🖥️ Paso 4: Preparación del Servidor

En el servidor remoto, sólo necesitamos un directorio vacío donde Mutagen "aterrizará" los archivos.
*(Ejecutar desde la PC Local o conectado por SSH)*:

```bash
ssh pato@192.168.1.95 'mkdir -p ~/ERPGrafico'
```

---

## 🔄 Paso 5: Flujo de Trabajo Diario

### Iniciar la Sincronización
En la terminal local, dentro del directorio del proyecto:
```bash
mutagen project start
```
Esto empuja todos los archivos locales permitidos al servidor en segundos.

### Levantar los Contenedores
Ingresar al servidor por SSH y levantar Docker usando los archivos recién sincronizados:
```bash
ssh pato@192.168.1.95
cd ~/ERPGrafico
docker compose -f docker-compose.yml up -d
```
A partir de aquí, el servidor iniciará y al guardar cualquier cambio en el IDE local, el hot-reload se disparará remotamente.

### Monitoreo
Para comprobar en tiempo real que los archivos viajan al guardar (debe decir `Watching for changes`):
```bash
mutagen sync monitor
```

### 🌐 Acceso desde el Navegador (Visualizar la App)
Para ver la aplicación corriendo en el servidor, tienes dos alternativas:

**Opción A: Port Forwarding vía IDE (Recomendada ⭐️)**
Si configuras tu IDE (Antigravity/VS Code) para hacer un túnel SSH (Port Forwarding) de los puertos `80` y `3000`, puedes navegar directamente a:
- 👉 **`http://localhost:3000`** (Frontend Next.js)
- 👉 **`http://localhost`** (API y estáticos vía Nginx)
*Ventaja:* Las variables de entorno (`NEXT_PUBLIC_API_URL=http://localhost/api`), las cookies de sesión y la seguridad CSRF de Django funcionarán nativamente sin tener que modificar ninguna configuración.

**Opción B: Acceso Directo por IP de Red Local**
Si no deseas mantener un túnel abierto, puedes acceder directamente mediante la IP de tu servidor:
- 👉 **`http://192.168.1.95:3000`**
*Aviso Importante:* Si usas esta ruta, estás obligado a modificar tu archivo `.env.dev` en el frontend para reflejar la red: `NEXT_PUBLIC_API_URL=http://192.168.1.95/api`. De lo contrario, el navegador intentará buscar el backend localmente en tu PC y las peticiones fallarán.

---

## ⚡ La Magia del Hot-Reload y Casos Especiales

El **95% de tu tiempo** no necesitarás tocar la terminal del servidor. La sincronización es invisible y opera así:

### 1. Desarrollo Normal (React / Django)
No tienes que ejecutar ningún comando. El flujo es automático:
1. Modificas código y presionas `Ctrl+S` en Antigravity localmente.
2. Mutagen empuja el archivo al disco del servidor en ~10ms.
3. Los contenedores Docker en el servidor detectan el cambio en el disco.
4. **Next.js** dispara el *Fast Refresh* al instante / **Django** aplica el *Auto-Reload*.
5. Tu navegador (apuntando a la IP del servidor) se actualiza solo.

### 2. Instalar Nuevas Dependencias (Frontend / Backend)
Como excluimos `node_modules` y `venv` en el `mutagen.yml`, estas carpetas viven exclusivamente en el servidor. Si necesitas agregar una librería:
1. Haz SSH al servidor (`ssh pato@192.168.1.95`) y ve a la carpeta del proyecto.
2. Ingresa al contenedor respectivo para instalarla. 
   - **Para Frontend (npm):**
     ```bash
     docker compose exec frontend npm install nombre-libreria
     ```
   - **Para Backend (pip/poetry):**
     ```bash
     docker compose exec backend pip install nombre-libreria
     ```
*(Esto asegura que la dependencia se instale en el entorno real donde corre la app).*

### 3. Crear y Ejecutar Migraciones (Base de Datos)
La base de datos (Postgres) corre en el servidor. Si modificas un archivo `models.py` en tu PC local:
1. Guardas el archivo y Mutagen lo sube al instante.
2. Entras por SSH al servidor y ejecutas los comandos de Django usando Docker:
   ```bash
   docker compose exec backend python manage.py makemigrations
   docker compose exec backend python manage.py migrate
   ```

### 4. Comandos Utilitarios Frecuentes (Demo Data, Tests, Superusuario)
Al estar en un entorno contenerizado, cualquier script de la aplicación debe ejecutarse a través de `docker compose exec`.
Si necesitas inicializar la base de datos o correr pruebas, haz SSH al servidor y utiliza estos comandos:

- **Cargar datos de prueba (Demo Data):**
  ```bash
  docker compose exec backend python manage.py setup_demo_data
  ```
- **Crear un nuevo administrador:**
  ```bash
  docker compose exec backend python manage.py createsuperuser
  ```
- **Ejecutar tests del Backend (Pytest):**
  ```bash
  docker compose exec backend pytest
  ```
- **Ejecutar tests del Frontend (Vitest):**
  ```bash
  docker compose exec frontend npm run test
  ```
- **Limpiar Caché de Next.js (Hard Reset):**
  *(Útil si editas `next.config.ts` o si necesitas forzar una compilación 100% limpia)*
  ```bash
  docker compose exec frontend sh -c "rm -rf .next/*" && docker compose restart frontend
  ```

### 5. Monitoreo, Logs y Recursos del Servidor
Dado que tu PC local ya no compila la app, no verás los errores o los `console.log` en la terminal de tu IDE. Para revisar qué está pasando, haz SSH al servidor y utiliza estos comandos:

**Ver Logs (Errores, Console.log, Peticiones):**
- **Ver TODOS los logs mezclados en vivo:**
  ```bash
  docker compose logs -f
  ```
- **Ver los logs de un servicio específico (Recomendado para debug):**
  ```bash
  docker compose logs -f frontend      # Para errores de Next.js / React
  docker compose logs -f backend       # Para errores de Django
  docker compose logs -f celery-worker # Para errores de tareas en segundo plano
  ```
*(Presiona `Ctrl + C` para salir de la vista de logs).*

**Monitorear Consumo de Recursos (RAM y CPU):**
Para asegurarte de que tu servidor de 4GB está respirando bien:
- **Ver el consumo individual de cada contenedor Docker:**
  ```bash
  docker stats
  ```
- **Ver el estado general del servidor (Memoria total y CPU):**
  ```bash
  htop
  ```
  *(Si no lo tienes instalado, ejecuta `sudo apt install htop`. Es el monitor de sistema más visual e intuitivo de Linux).*

---

## 🩺 Troubleshooting

**Problema 1**: `Error: project already running` pero el monitor dice `no matching sessions exist`.
**Causa**: Un inicio fallido dejó la sesión de Mutagen "sucia" en el daemon local.
**Solución**:
```bash
mutagen project terminate
mutagen daemon stop
mutagen daemon start
mutagen project start
```

**Problema 2**: La interfaz no carga en local.
**Solución**: Mutagen sólo sincroniza archivos. Para ver el servidor remoto como si fuera local, asegúrate de acceder mediante `http://192.168.1.95` o configurar un Port Forwarding local.
