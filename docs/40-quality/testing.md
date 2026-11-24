---
layer: 40-quality
doc: testing
status: active
owner: qa-team
last_review: 2026-11-06
---

# Testing

## Pyramid

```
          ┌──────────┐
          │   E2E    │  ~5%  — Playwright, happy paths only
          ├──────────┤
          │ Integr.  │ ~20%  — DRF APIClient, real DB
          ├──────────┤
          │   Unit   │ ~75%  — Vitest / pytest
          └──────────┘
```

Invert at your peril — full-stack tests are slow and flaky.

## Frontend

### Stack
- **Vitest** runner.
- **React Testing Library** for components.
- **MSW** (Mock Service Worker) for network.

### Layout
Co-locate tests next to source: `SaleOrderList.test.tsx` beside `SaleOrderList.tsx`.

### What to test

| Layer | Tests |
|-------|-------|
| Zod schema | Valid + invalid inputs, edge values |
| Hook | Query key, cache invalidation, mutation call shape (MSW) |
| Component | Render states (loading/empty/error/data), interactions, a11y |
| Form | Submit valid → calls mutation; submit invalid → shows errors |

### What NOT to test

- Tailwind class strings (brittle, low value).
- Internals of Shadcn / TanStack (their job, not ours).
- Implementation details (test via public API, not via spying internals).

### Example

```ts
import { render, screen } from '@testing-library/react'
import { SaleOrderList } from './SaleOrderList'

it('shows empty state when no orders', () => {
  render(<SaleOrderList orders={[]} isLoading={false} />)
  expect(screen.getByText(/sin órdenes/i)).toBeInTheDocument()
})
```

### Coverage thresholds

- Global: objetivo de 70% lines, 60% branches. El mínimo que hace cumplir el CI es el real (22% lines, 14% branches, `vitest.config.ts`) y solo debe subir.
- Shared components: 90% lines.
- Hooks: 85% lines.
- Enforced in CI.

## Backend

### Stack
- **pytest** + `pytest-django`.
- **factory_boy** for fixtures.
- **APIClient** from DRF.

### Layout
`apps/[app]/tests/test_[concern].py` — one file per layer.

### What to test

| File | Tests |
|------|-------|
| `test_models.py` | Model invariants, constraints, signals |
| `test_services.py` | Business rules, transactions, atomicity |
| `test_selectors.py` | Selector query optimization, N+1 prevention |
| `test_views.py` | HTTP contract: status codes, auth, permission, validation |
| `test_tasks.py` | Idempotency, retry behavior |
| `test_permissions.py` | Role matrix |

### Gate de CI (`ci_gate`) y cuarentena

La marca `ci_gate` reúne los tests de invariantes y de conteo de queries (ADR-0118). Bloquean el CI y **no admiten tests en rojo**: `pytest -m ci_gate`.

Desde el 2026-11-24 la **suite completa también bloquea** el CI (Postgres, como producción). La lista de fallos conocidos llegó a 0; las causas que tenía eran:

| Síntoma | Causa | Arreglo |
|---|---|---|
| POS «No hay cuenta contable configurada», `dte_settings` y `search_postgres` (solo Postgres, según el orden) | El singleton `AccountingSettings` se escribía por `pk=1` y se leía con `first()`: con secuencias de Postgres quedaban dos filas | `core.cache.load_singleton` para lectores y escritores |
| `test_terminal_sync_tasks` (errores en el teardown) | `monkeypatch.setattr` sobre `celery_app.conf` no se puede deshacer si la clave no existía | `monkeypatch.setitem` |
| `fiscal_match` boletas / estados | El tipo DTE descartaba al único candidato TUU | El tipo desempata, no filtra |
| `test_credit_history_bounded_queries` | N+1 en `ContactSelector.get_credit_history` | Precarga de `SaleOrderSelector.get_read_queryset` + `preload_invoices` |
| `test_p26_stock_context` | La precarga de fabricables no usaba el predicado del selector | Mismo predicado |
| `test_workflow_config_permissions`, `test_aging` | Tests desalineados con ADR-0116 y con las fechas locales | Tests actualizados |

Un test que falle ahora se arregla en el mismo PR. Si de verdad necesita cuarentena, se marca con `@pytest.mark.xfail(strict=True, reason="<issue>")` y se registra aquí con su síntoma.

### Fixtures — factory_boy

```python
class SaleOrderFactory(DjangoModelFactory):
    class Meta:
        model = SaleOrder
    customer = SubFactory(CustomerFactory)
    status = 'draft'
```

### Example

```python
@pytest.mark.django_db
def test_cannot_transition_from_closed(order):
    order.status = 'closed'
    order.save()
    with pytest.raises(InvalidTransition):
        sale_order_service.transition(order, to='confirmed')
```

### Coverage thresholds

- Global: 80% lines.
- Services: 95% lines.
- Services (query functions): 90% lines.

## Integration

- Full request cycle via DRF `APIClient`.
- Real Postgres (test DB), real Celery (eager mode).
- MinIO mocked (`moto` or local MinIO container).

## E2E

- Playwright, critical user journeys only:
  - Login → create sale order → confirm → invoice.
  - Treasury reconciliation happy path.
  - Period close.
- Runs nightly + pre-release, NOT per PR.

## Contract tests

- Zod schemas parse example payloads from OpenAPI spec.
- Guards against backend/frontend drift.
- Runs in CI on both backend and frontend change.

## Mutation testing (optional, quarterly)

- `mutmut` (backend) / `stryker` (frontend).
- Target: services / business logic.
- Goal: surface tests that assert nothing.

## Flakiness policy

- A flaky test is a bug. Do not `@pytest.mark.flaky` as fix.
- Isolate and fix root cause (timing, shared state, network).
- Quarantine-then-fix, never quarantine-then-forget (SLA: 1 week).
