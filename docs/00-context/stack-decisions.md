---
layer: 00-context
doc: stack-decisions
status: active
owner: core-team
last_review: 2026-04-21
---

# Stack Decisions

Why each core dependency exists. Changing any requires ADR.

## Frontend

| Choice | Rationale | ADR |
|--------|-----------|-----|
| Next.js 16 App Router | SSR + RSC for fast dashboards, file-based routing matches FSD | [adr/0001](../10-architecture/adr/0001-nextjs-app-router.md) |
| TypeScript strict | Zero-any policy, catches errors at compile time | [adr/0002](../10-architecture/adr/0002-typescript-strict.md) |
| Tailwind 4 (`@theme` inline) | Single source of truth in `globals.css`, no config drift | [adr/0003](../10-architecture/adr/0003-tailwind-v4.md) |
| Shadcn UI | Copy-paste, owned components, no vendor lock | [adr/0004](../10-architecture/adr/0004-shadcn.md) |
| TanStack Query | Server state cache, background refetch, devtools | [adr/0005](../10-architecture/adr/0005-tanstack-query.md) |
| Zod + react-hook-form | Runtime validation matches TS types, zero duplication | [adr/0006](../10-architecture/adr/0006-zod-rhf.md) |
| Feature-Sliced Design | Bounded contexts, cross-feature isolation via barrels | [adr/0007](../10-architecture/adr/0007-fsd.md) |

## Backend

| Choice | Rationale |
|--------|-----------|
| Django 5 + DRF | Batteries-included, admin, ORM, mature ecosystem |
| Celery + Redis | Async tasks (invoice PDF, email, reports), scheduled jobs |
| PostgreSQL | JSONB, transactions, row-level locking for reconciliation |
| MinIO | S3-compatible, on-prem option, cheap |
| JWT auth (`/api/token/`) | Stateless, SPA-friendly |

## Rejected / not used

| Alternative | Why rejected |
|-------------|--------------|
| tRPC | Django backend forces REST — no end-to-end TS types anyway |
| Prisma | Django ORM is authoritative |
| Redux / Zustand (for server state) | TanStack Query handles it |
| CSS Modules | Tailwind 4 with semantic tokens covers needs |
| MongoDB | Financial data requires ACID transactions |
