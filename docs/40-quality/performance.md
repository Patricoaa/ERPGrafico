---
layer: 40-quality
doc: performance
status: active
owner: platform-team
last_review: 2026-04-21
---

# Performance

Budget-driven. If a change exceeds budget, it must be justified or optimized before merge.

## Budgets

### Frontend

| Metric | Budget |
|--------|--------|
| First-load JS (route) | <200 KB gzipped |
| Route LCP | <2.5s on 4G Moto G4 |
| TTI | <3.5s |
| Hydration CPU | <150ms on target device |
| Bundle total | <1 MB gzipped |

Enforced via `next build` output + Lighthouse CI per PR.

### Backend

| Metric | Budget |
|--------|--------|
| p50 `/api/*` | <100ms |
| p95 `/api/*` | <400ms |
| p99 `/api/*` | <1s |
| DB query per request | ≤10 |
| Celery task p95 | task-specific, documented |

## Frontend techniques

### Bundle
- Dynamic import for heavy routes (`next/dynamic`).
- Tree-shaken barrel exports (no re-export of unused).
- No heavy dep in shared chunk (moment → use `date-fns` or native `Intl`).

### Rendering
- Server Components default; Client Components only when interactive.
- Memoize expensive derived props (`useMemo`).
- Virtualize long lists (`@tanstack/react-virtual`) at ≥100 rows.

### Data
- Configure TanStack Query `staleTime` to avoid redundant refetch.
- Prefetch on hover for detail pages (`queryClient.prefetchQuery`).
- Paginate ≥50 items.

### Images
- `next/image` always. Never `<img src="">`.
- Correct `sizes` prop.

## Backend techniques

### N+1
- `select_related` for FK traversal.
- `prefetch_related` for reverse + M2M.
- Use selectors to centralize optimization.
- Integration test asserts `assertNumQueries(<=N)` on list endpoints.

### Indexes
- Every FK: indexed (Django default).
- Frequent filter/order fields: explicit `db_index=True` or composite `Meta.indexes`.
- Verify with `EXPLAIN ANALYZE` before adding.

### Caching
- Redis for hot reads (rate tables, role tree).
- Cache key versioned per entity update.
- TTL explicit; no infinite caches.

### Pagination
- Cursor pagination for >10k rows tables.
- Never return unbounded list.

### Async boundary
- Any op >300ms synchronous: move to Celery.
- See [add-background-task.md](../30-playbooks/add-background-task.md).

## Profiling

| Tool | Use |
|------|-----|
| `django-debug-toolbar` | Local N+1 detection |
| `silk` | Local request profiling |
| `py-spy` | Prod flame graphs (sampled) |
| Chrome DevTools → Performance | Frontend CPU |
| Lighthouse | Route-level audit |
| `react-scan` | Re-render detection |

## Regression detection

- Lighthouse CI per PR → fail if LCP regresses >10%.
- k6 load test nightly on staging for top 5 endpoints.
- Prod p95 latency alert per endpoint.

## Checklist per PR

- [ ] New query path: `EXPLAIN ANALYZE` reviewed.
- [ ] Indexes adequate.
- [ ] No N+1 (integration test asserts query count).
- [ ] Bundle size delta reported.
- [ ] No new sync work >300ms in request path.
