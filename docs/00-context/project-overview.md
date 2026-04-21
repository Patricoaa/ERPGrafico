---
layer: 00-context
doc: project-overview
status: active
owner: core-team
last_review: 2026-04-21
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
| Object storage | MinIO (S3-compatible) |
| Infra | Docker Compose, Nginx reverse proxy |

## High-level flow

```
User → Nginx :80 → Next.js :3000 (SSR/App Router)
                 → Django :8100 /api/* (JWT auth)
                       ↘ PostgreSQL
                       ↘ Redis (cache + Celery broker)
                       ↘ MinIO (file storage)
                       ↘ Celery workers (async jobs)
```

## Non-goals

- Multi-tenant SaaS (single-org deployment).
- Offline-first / PWA.
- Mobile-native apps.

## Environments

| Env | URL pattern | Data |
|-----|-------------|------|
| Local | `localhost` | Seeded via `setup_demo_data` |
| Staging | TBD | Anonymized prod snapshot |
| Prod | TBD | Real data |

## Further reading

- Stack rationale: [stack-decisions.md](stack-decisions.md)
- Domain terms: [domain-glossary.md](domain-glossary.md)
- Frontend structure: [../10-architecture/frontend-fsd.md](../10-architecture/frontend-fsd.md)
- Backend apps detail: [../10-architecture/backend-apps.md](../10-architecture/backend-apps.md)
