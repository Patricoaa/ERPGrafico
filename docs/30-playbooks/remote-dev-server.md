---
layer: 30-playbooks
doc: remote-dev-server
task: "Usar el servidor de desarrollo remoto (SSH + Mutagen)"
triggers: ["dev server", "servidor remoto", "servidor de desarrollo", "ssh", "mutagen", "correr tests", "qa local", "levantar entorno", "192.168.1.93", "logs del servidor"]
status: active
owner: core-team
last_review: 2026-10-09
kind: environment-contract
preconditions:
  - Acceso SSH con llave a pato@192.168.1.93
  - Mutagen instalado en la máquina local
validation:
  - "mutagen sync list muestra erpgrafico-sync Connected: Yes"
  - "ssh pato@192.168.1.93 'docker compose -f ~/ERPGrafico/docker-compose.yml ps' lista los contenedores Up"
forbidden:
  - Ejecutar git en el servidor (el espejo remoto no tiene .git)
  - Usar el servidor si la sincronización Mutagen no está activa
---

# Remote Dev Server — entorno de desarrollo siempre disponible

> **Contrato para agentes de IA:** existe un único entorno de desarrollo, corriendo en un servidor
> dedicado en la LAN. Siempre está disponible (mientras el host esté encendido) y es el lugar donde se
> **ejecutan** los contenedores, migraciones, tests y QA. **No existe entorno de producción todavía** —
> el proyecto está en fase de desarrollo. Ver [project-overview.md](../00-context/project-overview.md#environments).

---

## 1. Acceso

```bash
ssh pato@192.168.1.93          # acceso con llave (sin password)
cd ERPGrafico                  # equivale a /home/pato/ERPGrafico
```

| Dato | Valor |
|------|-------|
| Host | `192.168.1.93` |
| Usuario | `pato` |
| Home | `/home/pato` |
| Proyecto | `/home/pato/ERPGrafico` (`cd ERPGrafico`) |
| Compose project | `erpgrafico` |
| URL app (nginx) | `http://192.168.1.93` |
| URL frontend directo | `http://192.168.1.93:3000` |

> ⚠️ **El directorio `/home/pato/ERPGrafico` es un espejo de Mutagen, no un clon Git.**
> No tiene `.git` (`mutagen.yml` ignora `vcs`). El repositorio git vive **solo en la máquina local**
> (`/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico`). Nunca ejecutes `git` en el servidor.

> ℹ️ En el mismo host conviven otros proyectos (p. ej. `kayfabedw`, `odoo`). Filtra por
> `erpgrafico-*` al inspeccionar contenedores.

---

## 2. Servicios corriendo

| Contenedor | Puerto host | Notas |
|------------|-------------|-------|
| `erpgrafico-nginx-1` | `80` | reverse proxy (frontend + `/api`) |
| `erpgrafico-frontend-1` | `3000` | Next.js (App Router) |
| `erpgrafico-backend-1` | `8100` | Django + DRF (gunicorn) |
| `erpgrafico-db-1` | `5433` → 5432 | PostgreSQL |
| `erpgrafico-redis-1` | `6379` | cache + broker Celery |
| `erpgrafico-celery-worker-1` | interno | tareas async |
| `erpgrafico-celery-beat-1` | interno | scheduler |

```bash
# Estado de los servicios
ssh pato@192.168.1.93 'cd ~/ERPGrafico && docker compose ps'
```

---

## 3. Contrato Mutagen (obligatorio antes de tocar el servidor)

El código local se replica al servidor con **Mutagen** (two-way sync). Si el sync está caído, el
servidor ejecuta una **versión vieja** del código. Por eso, **antes de cualquier comando contra el
servidor**, verifica el sync:

### 1. Verificar

```bash
mutagen sync list        # buscar: erpgrafico-sync ... Beta: Connected: Yes
mutagen sync monitor     # vista en vivo (Ctrl+C para salir)
```

La sesión se llama **`erpgrafico-sync`**:
- Alpha (local): `/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico`
- Beta (remoto): `pato@192.168.1.93:/home/pato/ERPGrafico`

### 2. Si está caído → intentar activarlo

Desde la raíz del repo local:

```bash
mutagen project start          # arranca la sesión definida en mutagen.yml
# o bien:
mutagen sync resume erpgrafico-sync
```

### 3. Si no se puede activar → avisar al usuario

Si tras intentarlo el sync sigue sin conectar, **detente y avisa al usuario** explicando que el
servidor de desarrollo no está sincronizado. **No operes contra el servidor con código desactualizado.**
Puedes pedirle que ejecute `mutagen project start` y que revise conectividad/VPN con `192.168.1.93`.

---

## 4. Instalación de Mutagen (solo máquina local, una vez)

Mutagen requiere el binario y el bundle de agentes (se inyecta en el servidor).

```bash
cd /tmp
wget https://github.com/mutagen-io/mutagen/releases/download/v0.18.0/mutagen_linux_amd64_v0.18.0.tar.gz
tar -xzvf mutagen_linux_amd64_v0.18.0.tar.gz
sudo mv mutagen /usr/local/bin/
sudo mv mutagen-agents.tar.gz /usr/local/bin/
```

Y la llave SSH sin password:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
ssh-copy-id pato@192.168.1.93
ssh pato@192.168.1.93 'pwd'    # debe imprimir /home/pato
```

> ⚠️ Si omites mover `mutagen-agents.tar.gz`, Mutagen falla con `unable to locate agent bundle`.

La configuración vive en `mutagen.yml` (raíz del repo). Ignora `vcs`, `node_modules`, `.next`,
`__pycache__`, `venv`, datos de Postgres/Redis, y directorios de IDE; **mantiene** `.env.dev` y
`frontend/.env.local`.

---

## 5. Flujo de trabajo diario

1. Editas código **en local**. Mutagen lo empuja al servidor en milisegundos.
2. Los contenedores detectan el cambio → Next.js Fast Refresh / Django auto-reload.
3. Navegas `http://192.168.1.93` (o `http://192.168.1.93:3000`).

No hay que reiniciar nada para el 95% de los cambios.

---

## 6. Comandos canónicos (vía SSH + `docker compose exec`)

Todos los comandos de aplicación se ejecutan **dentro de los contenedores**, no en el host.

```bash
ssh pato@192.168.1.93
cd ~/ERPGrafico

# Migraciones
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate

# Datos de demo / superusuario
docker compose exec backend python manage.py setup_demo_data
docker compose exec backend python manage.py createsuperuser

# Tests
docker compose exec backend pytest
docker compose exec frontend npm run test

# Dependencias
docker compose exec frontend npm install <paquete>
docker compose exec backend pip install <paquete>

# Logs
docker compose logs -f                 # todos
docker compose logs -f frontend        # Next.js / React
docker compose logs -f backend         # Django
docker compose logs -f celery-worker   # tareas async

# Hard reset de caché Next.js (tras editar next.config.ts)
docker compose exec frontend sh -c "rm -rf .next/*" && docker compose restart frontend

# Recursos del host
docker stats
htop
```

Nota de red: `.env.dev` del servidor usa `ALLOWED_HOSTS=...,192.168.1.93` y
`NEXT_PUBLIC_API_URL=http://192.168.1.93/api`.

---

## 7. Troubleshooting

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `project already running` pero `no matching sessions exist` | sesión Mutagen sucia | `mutagen project terminate && mutagen daemon stop && mutagen daemon start && mutagen project start` |
| La interfaz no refleja cambios | el sync está caído (ver §3) | verificar/reactivar Mutagen; si no, avisar al usuario |
| La UI local no carga | acceso por ruta equivocada | usar `http://192.168.1.93` (o port-forward SSH) |
| `git: not a repository` en el servidor | el espejo no tiene `.git` (por diseño) | usar git solo en local |
