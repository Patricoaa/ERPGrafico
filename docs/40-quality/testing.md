---
layer: 40-quality
doc: testing
status: active
owner: qa-team
last_review: 2026-04-21
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
| `test_selectors.py` | Query correctness, filter combinations |
| `test_views.py` | HTTP contract: status codes, auth, permission, validation |
| `test_tasks.py` | Idempotency, retry behavior |
| `test_permissions.py` | Role matrix |

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
- Selectors: 90% lines.

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
