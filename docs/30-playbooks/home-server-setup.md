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
Crea/Edita el archivo `.env.dev`. Mezclamos **Servicios Locales** con **Cloudflare R2**:

| Variable | Valor para Home Server |
| :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/erpgrafico` |
| `REDIS_URL` | `redis://redis:6379/0` |
| `AWS_S3_ENDPOINT_URL`| `https://TU_ID.r2.cloudflarestorage.com` (Cloudflare R2) |
| `AWS_ACCESS_KEY_ID` | Tu Key de R2 |
| `AWS_SECRET_ACCESS_KEY`| Tu Secret de R2 |
| `NEXT_PUBLIC_API_URL`| `http://localhost/api` |

---

## 🔌 Fase 5: Conexión con Antigravity

1. En tu laptop, abre Antigravity.
2. Presiona `F1` -> **Remote-SSH: Connect to Host...** -> `pato@192.168.1.50`.
3. Una vez conectado, ve a **File -> Open Folder** y elige `/mnt/data/ERPGrafico`.
4. **Port Forwarding**: Antigravity detectará los puertos. Asegúrate de que el puerto **3000** y **80** estén mapeados.

---

## ⚡ Fase 6: Arranque del Stack

Desde la terminal integrada de Antigravity (que ya está corriendo en el servidor):

```bash
# Levanta la base de datos, redis y nginx (MinIO no es necesario si usas R2)
docker compose up -d db redis nginx

# Levanta el Backend y Frontend en modo desarrollo
docker compose up -d backend frontend celery-worker
```

**Verificación**:
Abre en el navegador de tu laptop: `http://localhost`. Deberías ver el ERPGrafico cargando al instante.

---

## 🆘 Troubleshooting Comunes

- **KVM virtualisation error**: Activa "Virtualization" en la BIOS física de la PC vieja (Fase 0).
- **VCPUs allowed error**: Si tu PC solo tiene 2 núcleos, pon `cores: 2` en la configuración de la VM en Proxmox.
- **Cambios lentos en Frontend**: Asegúrate de que el volumen del frontend en `docker-compose.yml` sea tipo bind-mount al código en disk.
