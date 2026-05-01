# Playbook: Setup de Home Server (Proxmox + Cloudflare R2)

Este manual guía la creación de un entorno de desarrollo profesional en hardware propio.
**Arquitectura**: PC Vieja -> Proxmox -> VM Ubuntu Server -> Docker Stack -> Cloudflare R2.

---

## 🛑 Fase 1: Preparación del Entorno (Proxmox)

En este paso configuramos la "caja" donde vivirá el proyecto sin usar USBs físicos.

1. **Descargar ISO**: Ve a tu nodo Proxmox -> Storage **"local"** -> **ISO Images** -> **Download from URL**.
   - URL: `https://releases.ubuntu.com/24.04/ubuntu-24.04-live-server-amd64.iso`
2. **Crear VM**: Clic en **Create VM** (ID 100+).
   - **General**: Nombre `erpgrafico-dev`.
   - **OS**: Selecciona la ISO descargada.
   - **System**: Marca **[x] QEMU Agent**.
   - **Disks**: 30GB en tu **SSD**. Bus: **VirtIO Block**.
   - **CPU**: 2 Cores (Type: **host**).
   - **Memory**: 4096 MB (4GB).
   - **Network**: Bridge `vmbr0`, Model `VirtIO`.
3. **(Opcional) Segundo Disco**: Hardware -> Add -> Hard Disk (50GB+). Útil para separar datos del sistema.
4. **Iniciar**: Dale a **Start** y abre la **Console**.

---

## 🐧 Fase 2: Instalación de Ubuntu Server

Sigue el asistente en la consola de Proxmox:

1. **Layout**: Selecciona **Ubuntu Server (Minimized)** para ahorrar RAM.
2. **Network**: Toma nota de la IP asignada (ej. `192.168.1.50`).
3. **Storage**: "Use an entire disk" (el de 30GB).
4. **User**: Nombre `pato`, usuario `pato`, elige password.
5. **Software**: **¡OBLIGATORIO!** Marca con espacio: `[x] Install OpenSSH Server`.
6. **Finalizar**: Una vez termine, elige **Reboot**. Ya puedes cerrar la consola de Proxmox y pasar a tu laptop.

---

## 🛠️ Fase 3: Configuración del Servidor (Vía SSH)

Abre una terminal en tu laptop y conéctate: `ssh pato@192.168.1.50`.

### 3.1 Instalar herramientas base
```bash
sudo apt update && sudo apt install -y git curl build-essential qemu-guest-agent
sudo systemctl enable --now qemu-guest-agent # Para que Proxmox vea la IP
```

### 3.2 Instalar Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
exit # Cierra sesión para aplicar cambios de grupo
```

### 3.3 Preparar el disco de datos (Si añadiste el segundo disco)
```bash
# Reconectate: ssh pato@192.168.1.50
sudo mkfs.ext4 /dev/sdb
sudo mkdir -p /mnt/data
echo '/dev/sdb /mnt/data ext4 defaults 0 2' | sudo tee -a /etc/fstab
sudo mount -a
sudo chown -R pato:pato /mnt/data
```

---

## 📂 Fase 4: Despliegue del Proyecto

### 4.1 Clonar el código
```bash
cd /mnt/data  # O en tu home si no usas segundo disco
git clone https://github.com/tu-usuario/ERPGrafico.git
cd ERPGrafico
```

### 4.2 Configurar Variables (.env.dev)

Debes crear este archivo en la raíz del proyecto (`/mnt/data/ERPGrafico/.env.dev`). El contenido mezcla el uso de la base de datos local (Docker) con el almacenamiento en la nube (Cloudflare R2).

#### Paso a paso para crear el archivo:
1. Ejecuta: `nano .env.dev`
2. Pega el siguiente contenido (ajustando tus datos de Cloudflare):

```env
# --- Configuración Básica ---
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=cambiame_por_algo_seguro_o_usa_el_comando_abajo
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.50 # Pon aquí la IP de tu PC vieja

# --- Base de Datos (USANDO DOCKER LOCAL) ---
DATABASE_URL=postgresql://postgres:postgres@db:5432/erpgrafico

# --- Cache y Broker (USANDO DOCKER LOCAL) ---
REDIS_URL=redis://redis:6379/0

# --- Storage (USANDO CLOUDFLARE R2) ---
AWS_ACCESS_KEY_ID=tu_access_key_id
AWS_SECRET_ACCESS_KEY=tu_secret_access_key
AWS_S3_ENDPOINT_URL=https://TU_ACCOUNT_ID.r2.cloudflarestorage.com
AWS_S3_CUSTOM_DOMAIN=https://pub-xxxxxx.r2.dev
AWS_STORAGE_BUCKET_NAME=erpgrafico-media-public

# --- Frontend ---
# Esta URL es la que usará el navegador en tu laptop
NEXT_PUBLIC_API_URL=http://localhost/api
```

3. **Tip**: Para generar una `SECRET_KEY` rápida, corre esto en la terminal:
   `python3 -c 'import secrets; print(secrets.token_hex(50))'`

---

## Fase 5: Conexión y Sincronización (SFTP Mirror)

**¡IMPORTANTE!**: Si tu Home Server tiene hardware antiguo (ej. AMD A4, Intel pre-2012), el método "Remote-SSH" puede fallar. Usaremos el método **Mirroring**, que es más estable y rápido.

### 5.1 En tu Laptop (Antigravity)
1. Instala la extensión **"SFTP"** (Natizyskunk).
2. Abre la carpeta del proyecto LOCALMENTE en tu laptop.
3. Presiona `F1` o `Ctrl+Shift+P` -> **SFTP: Config**.
4. Pega la configuración apuntando a la IP de tu servidor (ej. `192.168.1.25`) y el `remotePath: "/mnt/data/ERPGrafico"`.
5. Asegúrate de poner `"uploadOnSave": true`.

### 5.2 Flujo de Trabajo
1. **Programas en Laptop**: Antigravity usa tu CPU moderno para la IA.
2. **Guardas**: El archivo se sube automáticamente al servidor.
3. **Docker reacciona**: Como los archivos están vinculados, Django/Next.js recargan solos.
4. **Verificas**: Abre en tu navegador `http://192.168.1.94`.

---

## ⚡ Fase 6: Arranque del Stack

- **Almacenamiento**: Híbrido (Postgres Local + Cloudflare R2 para Media).
- **IDE**: Antigravity (VS Code Fork) corriendo localmente con sincronización **SFTP Mirror**.
- **Sincronización**: Latencia de subida < 300ms, disparando Hot Reload en el servidor.

## ✅ Hitos Alcanzados
1. **Configuración de Hardware**: Activación de virtualización (VT-x/AMD-V) en BIOS para soporte KVM.
2. **Setup de Proxmox**: Creación de VM con balanceo de carga (2 vCPUs) y QEMU Guest Agent.
3. **Persistencia**: Implementación de un segundo disco duro virtual (`/dev/sdb`) montado en `/mnt/data` para aislar el código y la DB del sistema operativo.
4. **Networking**: Configuración de acceso directo vía IP local (Evitando fallos de KVM Server Instruction Set).
5. **Base de Datos**: Migración exitosa de más de 100 tablas y creación de superusuario administrativo.
6. **Sincronización**: Configuración de extensión SFTP para desarrollo distribuido sin crasheos de hardware.

## 🚀 Pruebas de Validación
- [x] **Conexión SSHFS/SFTP**: Exitosa hacia `192.168.1.25`.
- [x] **Docker Stack**: Levantado correctamente con `docker compose up -d`.
- [x] **Frontend Access**: Disponible en `http://192.168.1.25` vía proxy Nginx.
- [x] **Hot Reload**: Validado al cambiar código en laptop y ver reflejo inmediato en server.

## 🆘 Troubleshooting Comunes

- **KVM virtualisation error**: Activa "Virtualization" en la BIOS física de la PC vieja (Fase 0).
- **VCPUs allowed error**: Si tu PC solo tiene 2 núcleos, pon `cores: 2` en la configuración de la VM en Proxmox.
- **Cambios lentos en Frontend**: Asegúrate de que el volumen del frontend en `docker-compose.yml` sea tipo bind-mount al código en disk.
