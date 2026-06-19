---
layer: 99-walkthroughs
doc: home-server-deployment
status: active
owner: core-team
last_review: 2026-05-21
kind: point-in-time-narrative
---

# Walkthrough: Despliegue de Home Server Dev Lab

Este documento resume la implementación exitosa del entorno de desarrollo remoto para ERPGrafico, eliminando la dependencia de recursos locales (Laptop) y servicios de pago/lentos en la nube (Vercel/Railway).

## 🏘️ Arquitectura Final
- **Hardware**: PC Vieja (2011) con Proxmox.
- **Virtualización**: VM Ubuntu 24.04 LTS (Minimized).
- **Orquestación**: Docker Compose (Stack completo: Postgres, Redis, Cloudflare R2, Nginx, Django, Next.js).
- **Almacenamiento**: Híbrido (Postgres Local + Cloudflare R2 para Media).
- **IDE**: Antigravity (VS Code Fork) conectado vía Remote-SSH.

## ✅ Hitos Alcanzados
1. **Configuración de Hardware**: Activación de virtualización (VT-x/AMD-V) en BIOS para soporte KVM.
2. **Setup de Proxmox**: Creación de VM con balanceo de carga (2 vCPUs) y QEMU Guest Agent.
3. **Persistencia**: Implementación de un segundo disco duro virtual (`/dev/sdb`) montado en `/mnt/data` para aislar el código y la DB del sistema operativo.
4. **Networking**: Configuración de Port Forwarding en Antigravity para acceso a `localhost:3000` y `localhost:80`.
5. **Base de Datos**: Migración exitosa de más de 100 tablas y creación de superusuario administrativo.
## 🚀 Pruebas de Validación
- [x] **Conexión SSH**: Exitosa hacia `192.168.1.25`.
- [x] **Docker Stack**: Levantado correctamente con `docker compose up -d`.
- [x] **Frontend Access**: Disponible en `http://localhost` vía proxy Nginx.
- [x] **Login**: Validado con el nuevo sistema de seguridad CSRF configurado en `.env.dev`.

## Evidencias de Éxito
- Setup Final: verificado
- Migraciones OK: verificado

---
**Estado del Entorno**: 🟢 Operativo y Optimizado.
