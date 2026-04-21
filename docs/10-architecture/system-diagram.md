---
layer: 10-architecture
doc: system-diagram
status: active
owner: core-team
last_review: 2026-04-21
---

# System Diagram

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

| Unit | Containerized | Scalable |
|------|---------------|----------|
| Next.js | Yes | Horizontal |
| Django | Yes | Horizontal (stateless) |
| Celery worker | Yes | Horizontal |
| Celery beat | Yes | Singleton (lock-based) |
| Postgres | Yes (dev); managed (prod) | Vertical + read replicas |
| Redis | Yes | Sentinel cluster (prod) |
| MinIO | Yes | Multi-node |

## Trust boundaries

1. **Public internet → Nginx** — TLS termination, rate limit.
2. **Nginx → Django** — JWT required on `/api/*` except `/api/token/`.
3. **Django → Postgres** — connection pool, least-privilege user.
4. **Celery → same boundaries as Django** — shares credentials.
