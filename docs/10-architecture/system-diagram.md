---
layer: 10-architecture
doc: system-diagram
status: active
owner: core-team
last_review: 2026-05-21
---

# System Diagram

> **Topology:** single-node on home-server (Proxmox + VM Ubuntu + Docker Compose). No load balancer, no DB replicas, no clusters. Scale vertically (more RAM/CPU/disk) before considering multi-node — see §"Deployment units".

## Runtime topology

```
┌─────────┐
│ Browser │
└────┬────┘
     │ HTTPS
┌────▼──────────────────────┐
│ Nginx :80                 │ reverse proxy
└──┬────────────────┬───────┘
   │                │
   │ / *            │ /api/* + /admin/*
┌──▼─────────┐  ┌───▼──────────┐
│ Next.js    │  │ Django :8100 │ DRF + JWT
│ :3000      │  │              │
│ (App       │  │ • sales      │
│  Router)   │  │ • purchasing │
└────────────┘  │ • production │
                │ • ... 13 apps│
                └──┬───┬───┬───┘
                   │   │   │
        ┌──────────┘   │   └─────────┐
        │              │             │
   ┌────▼────┐   ┌─────▼───┐   ┌─────▼─────┐
   │Postgres │   │ Redis   │   │ MinIO     │
   │(data)   │   │(cache + │   │(files,    │
   │         │   │ broker) │   │ PDFs)     │
   └─────────┘   └────┬────┘   └───────────┘
                     │
              ┌──────▼───────┐
              │ Celery       │
              │  worker      │
              │  beat (cron) │
              │  flower :5555│
              └──────────────┘
```

## Request lifecycle — typical API call

```
Browser
  → Next.js RSC or client fetch
  → axios (lib/api.ts) with JWT in Authorization header
  → Nginx /api/*
  → DRF view
    → permission check (JWT → User)
    → serializer validation
    → service layer (business logic)
    → ORM → PostgreSQL
    → response serialization
  ← JSON
← TanStack Query cache
← React component re-renders
```

## Async job lifecycle

```
DRF view enqueues: task.delay(args)
  → Redis (broker queue)
  → Celery worker picks up
  → executes task (may hit Postgres, MinIO)
  → result → Redis (backend)
  → Flower displays status
```

## Deployment units

All components run as Docker containers on a single host. The actual scaling strategy is **vertical** (increase host resources) or **move individual services to the cloud** (R2 already in use for media) before considering any multi-node topology.

| Unit | Contenedor | Estrategia de escalado (v1) | Si presión sostenida |
|------|-----------|-----------------------------|----------------------|
| Next.js | Sí | Single instance | Subir RAM del host; ya hace SSR cacheado |
| Django | Sí (gunicorn N workers) | Subir workers/threads del proceso | Considerar Cloudflare en frente |
| Celery worker | Sí | Single contenedor con concurrencia configurable | Separar queues (sales / billing / heavy) |
| Celery beat | Sí | Singleton (no se replica por diseño) | — |
| Postgres | Sí | Single instance + `CONN_MAX_AGE` + tuning vía PgTune | Migrar a managed (Supabase / Neon free tier) antes que replicación on-prem |
| Redis | Sí | Single instance, AOF persistence opcional | — |
| MinIO | Sí (local) | Single node; media de baja frecuencia delegada a Cloudflare R2 | R2 ya cubre HA de archivos críticos |

**What is NOT in scope for v1:** Postgres read replicas, Redis Sentinel/Cluster, Nginx load balancer, MinIO multi-node, autoscaling. See [observability.md#roadmap](../40-quality/observability.md#roadmap-cuando-deje-de-aplicar-pyme) for the conditions that trigger revisiting this.

## Trust boundaries

1. **Public internet → Nginx** — TLS termination, rate limit.
2. **Nginx → Django** — JWT required on `/api/*` except `/api/token/`.
3. **Django → Postgres** — connection pool, least-privilege user.
4. **Celery → same boundaries as Django** — shares credentials.
