---
layer: 40-quality
doc: performance
status: active
owner: platform-team
last_review: 2026-11-06
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

Revisión manual con la salida de `next build`. Lighthouse CI aún no está configurado.

### Backend

| Metric | Budget |
|--------|--------|
| p50 `/api/*` | <100ms |
| p95 `/api/*` | <300ms |
| p99 `/api/*` | <1s |
| Queries por petición | Constante respecto de las filas (obligatorio); revisar sobre 20 (ADR-0118) |
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
- Test con marca `ci_gate`: 1 fila contra N, con relaciones pobladas ([zero-n-plus-one-policy.md](../90-governance/zero-n-plus-one-policy.md)).
- `select_related` solo para lo que se lee: cada join de más añade tiempo de planificación.
- Un serializer anidado por respuesta, nunca por fila.

### Indexes
- Every FK: indexed (Django default).
- Frequent filter/order fields: explicit `db_index=True` or composite `Meta.indexes`.
- Verify with `EXPLAIN ANALYZE` before adding. Above 5 joins, check `Planning Time` as well as execution.

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
| `django-debug-toolbar` | Local N+1 detection (no instalado; agregar bajo demanda) |
| `silk` | Local request profiling (no instalado; agregar bajo demanda) |
| `py-spy` | Prod flame graphs (sampled) |
| Chrome DevTools → Performance | Frontend CPU |
| Lighthouse | Route-level audit |
| `react-scan` | Re-render detection |

## Regression detection

- **Activo:** ninguno automático por ahora. La latencia se revisa a mano en Sentry ([observability.md](observability.md)).
- **Listo, sin efecto hasta reactivar el CI:** tests con marca `ci_gate` ([ci-cd.md](ci-cd.md)).
- **Planificado, sin configurar:** Lighthouse CI por PR, carga con k6 (no existe staging) y alerta de p95 por endpoint (no existe producción).

## Checklist per PR

- [ ] New query path: `EXPLAIN ANALYZE` reviewed.
- [ ] Indexes adequate.
- [ ] No N+1 (test `ci_gate`: 1 fila contra N con relaciones pobladas).
- [ ] Bundle size delta reported.
- [ ] No new sync work >300ms in request path.
- [ ] Views ≤20 lines per action (enforced by `test_views_under_20_lines`, marca `ci_gate`).
