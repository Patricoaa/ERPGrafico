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

- Global: 70% lines, 60% branches.
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

Estos tests fallan hoy, quedan fuera del gate y no deben aumentar. Requieren investigación propia. La suite local usa SQLite y el CI usa Postgres, por eso algunos fallan solo en uno de los dos (medido el 2026-11-06):

| Test | Síntoma |
|------|---------|
| `production/tests/test_p26_stock_context.py::test_manufacturable_uses_prefetched_context` | 6 queries donde se esperan 0 |
| `workflow/tests/test_workflow_config_permissions.py::test_workflow_settings_current_get_open_write_guarded` | 403 donde se espera 200 |
| `core/tests/test_permission_registry.py::test_post_migrate_sync_is_additive` | El grupo administrador no conserva el permiso de prueba |
| `sales/tests/test_pos_consumer_authz.py::test_pos_session_with_view_draftcart_connects_successfully` | Falla en la suite completa y pasa aislado; parece depender del orden |
| `accounting/tests/test_dte_settings.py::test_accounting_settings_updates_emit_and_receive_dte_lists` | Solo Postgres: falla en la suite completa y pasa aislado; parece depender del orden |
| `core/tests/test_search_postgres.py::test_universal_search_runs_full_text_on_postgres` | Solo Postgres: la búsqueda de texto completo no devuelve resultados |

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
