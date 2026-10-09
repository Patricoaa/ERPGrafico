---
layer: 00-context
doc: project-overview
status: active
owner: core-team
last_review: 2026-05-21
---

# Project Overview

ERPGrafico — full-stack ERP for graphic/printing industry.

## Business domains covered

13 Django apps, each a bounded context:

| App | Responsibility |
|-----|----------------|
| `accounting` | Ledger, journal entries, chart of accounts |
| `billing` | Invoices, credit notes, electronic fiscal docs |
| `contacts` | Customers, suppliers, contact persons |
| `core` | User model, auth, shared primitives |
| `finances` | Financial reports, cash flow |
| `hr` | Employees, payroll |
| `inventory` | Stock, warehouses, movements |
| `production` | Work orders, routes, machine scheduling |
| `purchasing` | Purchase orders, supplier reconciliation |
| `sales` | Sale orders, quotes, customer-facing flows |
| `tax` | Tax calculation, fiscal periods |
| `treasury` | Bank accounts, transactions, reconciliation |
| `workflow` | State machines, approvals, cross-domain orchestration |

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind 4, Shadcn UI, TanStack Query, Zod, react-hook-form |
| Backend | Django 5, DRF, Celery, Redis |
| DB | PostgreSQL |
| Object storage | Cloudflare R2 (S3-compatible) |
| Infra | Docker Compose, Nginx reverse proxy |

## High-level flow

```
User → Nginx :80 → Next.js :3000 (SSR/App Router)
                 → Django :8100 /api/* (JWT auth)
                       ↘ PostgreSQL
                       ↘ Redis (cache + Celery broker)
                        ↘ Cloudflare R2 (file storage)
                       ↘ Celery workers (async jobs)
```

## Non-goals

- Multi-tenant SaaS (single-org deployment).
- Offline-first / PWA.
- Mobile-native apps.
- HA / multi-region / horizontal scaling (see [system-diagram.md](../10-architecture/system-diagram.md#deployment-units)).
- Enterprise observability stack (Prometheus/Grafana/Jaeger) — see [observability.md](../40-quality/observability.md).

## Environments

| Env | Host | Data |
|-----|------|------|
| Local (edición) | `localhost` (IDE + git) | No corre el stack |
| Remote dev server | `pato@192.168.1.93` → `~/ERPGrafico` (docker compose) | Sembrada vía `setup_demo_data` |

**No existe entorno de producción.** El proyecto está en fase de desarrollo y solo hay un entorno de
desarrollo remoto, accesible por SSH y sincronizado con Mutagen. Ver
[remote-dev-server.md](../30-playbooks/remote-dev-server.md) para el contrato de uso. Cuando el
proyecto pase a producción, esta tabla y los docs de entorno deben actualizarse.

## Further reading

- Stack rationale: [stack-decisions.md](stack-decisions.md)
- Domain terms: [domain-glossary.md](domain-glossary.md)
- Frontend structure: [../10-architecture/frontend-fsd.md](../10-architecture/frontend-fsd.md)
- Backend apps detail: [../10-architecture/backend-apps.md](../10-architecture/backend-apps.md)
