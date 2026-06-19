---
layer: 10-architecture
doc: backend-apps
status: active
owner: backend-team
last_review: 2026-04-23
---

# Backend — Django Apps

## App skeleton (each app follows)

```
apps/[app_name]/
├── __init__.py
├── apps.py
├── models.py          # ORM entities
├── serializers.py     # DRF serializers (1 per entity + variants)
├── views.py           # ViewSets — thin, delegate to services/selectors
├── selectors.py       # Complex read queries — called by get_queryset() and read actions
├── services.py        # Business logic — NOT in views or serializers
├── tasks.py           # Celery tasks
├── signals.py         # Post-save hooks (use sparingly)
├── permissions.py     # DRF permission classes
├── urls.py            # Routes mounted under /api/[app]/
├── admin.py           # Django admin config
├── migrations/
└── tests/
    ├── test_models.py
    ├── test_views.py
    ├── test_services.py
    ├── test_selectors.py
    └── factories.py   # factory_boy
```

## Layering — where logic goes

| Concern | Location |
|---------|----------|
| HTTP parse/serialize | `serializers.py`, `views.py` |
| Auth / permissions | `permissions.py` |
| Business rules, validation, orchestration | `services.py` |
| Complex read queries (annotations, joins, filters) | `selectors.py` |
| Side effects (email, PDF, push) | `tasks.py` (async) |
| Cross-domain workflows | `workflow/` app |

**Golden rule**: `views.py` never contains business logic. Never >20 lines per action.

## Selectors — read query layer

`selectors.py` owns every non-trivial read. Views call selectors; selectors never call services.

```python
# ✅ selectors.py
def list_products(*, user, params: dict) -> QuerySet:
    """Annotated product list with favorites, BOM prefetch, and sort."""
    ...
    return queryset

def get_account_ledger(*, account, start_date, end_date) -> dict:
    """Running balance computation for libro mayor."""
    ...
    return {"opening_balance": ..., "movements": [...]}

# ✅ views.py — thin
class ProductViewSet(ModelViewSet):
    def get_queryset(self):
        return list_products(user=self.request.user, params=self.request.query_params)
```

Rules:
- Selector functions use **keyword-only args** (`*`).
- `get_queryset()` must call a selector — inline query logic forbidden.
- Selectors that return computed data (not QuerySet) return a plain `dict`.
- Never import a selector from a different app — use `workflow/` or pass data as args.

```python
# ✅ correct
class SaleOrderViewSet(ModelViewSet):
    def create(self, request):
        data = SaleOrderCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = sale_order_service.create(user=request.user, **data.validated_data)
        return Response(SaleOrderSerializer(order).data, status=201)

# ❌ wrong — business logic in view
class SaleOrderViewSet(ModelViewSet):
    def create(self, request):
        # 100 lines of stock checks, pricing, folio assignment...
```

## URL conventions

- Mount: `config/urls.py` → `path("api/[app]/", include("apps.[app].urls"))`
- ViewSet basenames: singular (`sale-order`, not `sale-orders`)
- Actions: standard REST + DRF `@action` for custom verbs

## Cross-app references

- Prefer `ForeignKey` only when domains truly couple (Invoice → Customer).
- Avoid importing service from another app inside a view; use `workflow/` to orchestrate.
- Signals for loose coupling; document receiver in [workflow-signals-registry.md](workflow-signals-registry.md).

## Transactions

- Services that mutate ≥2 tables: wrap in `transaction.atomic()`.
- Reconciliation operations: use `select_for_update()` on target rows.
- Celery tasks that write: transaction per task, idempotency key stored.

## Migrations

- One migration per logical change.
- Data migrations via `RunPython` with reverse callable.
- Never edit an applied migration — add a new one.
- See [playbooks/add-migration.md](../30-playbooks/add-migration.md).

## Audit trail / history (simple-history)

Change auditing uses `django-simple-history`. There are **two ways** to enable it — choosing the right one avoids the most common error (`MultipleRegistrationsError` when duplicating records).

### Via inheritance (preferred for transactional documents)

`core/models/abstracts.py` defines two abstract base models with history **already included**:

| Abstract base | Inherits from | What it provides |
|---|---|---|
| `AuditedModel` | `TimeStampedModel` | `created_at`, `updated_at` + `history = HistoricalRecords(inherit=True)` |
| `TransactionalDocument` | `AuditedModel` | Above + `number`, `status`, `notes`, `journal_entry`, totals |

Any model extending one of these **is already audited** — do not add additional `HistoricalRecords()`. Currently covers: `Invoice`, `SaleOrder`, `SaleDelivery`, `SaleReturn`, `PurchaseOrder`, etc.

```python
# ✅ correct — history is inherited
class Invoice(TransactionalDocument):
    dte_type = models.CharField(...)
    # DO NOT declare history here

# ❌ duplication → MultipleRegistrationsError on startup
class Invoice(TransactionalDocument):
    history = HistoricalRecords()  # already exists via inheritance
```

### Via explicit declaration (non-transactional models)

For entities that are not transactional documents (catalogs, settings, masters) that need auditing, declare the field locally:

```python
from simple_history.models import HistoricalRecords

class Product(models.Model):
    name = models.CharField(...)
    history = HistoricalRecords()
```

Apps using this pattern: `inventory`, `treasury`, `accounting`, `hr`, `contacts`, `production`, `tax`.

### How to verify if a model is audited

`grep HistoricalRecords` is unreliable because it can come via inheritance. Verify at runtime:

```python
from sales.models import SaleOrder
hasattr(SaleOrder, 'history')                    # True if audited
SaleOrder.history.model._meta.db_table           # history table name
```

### Consumers

- **UI**: `frontend/features/audit/components/ActivitySidebar.tsx` consumes `useEntityHistory` and renders a timeline with field-by-field diff.
- **Backend**: `core.views.GlobalAuditLogView` combines `ActionLog` (privileged actions) with per-model histories.

### Overall strategy

See [docs/50-audit/observability/strategy.md](../50-audit/observability/strategy.md) for the full architecture decision (business audit log, SIEM, APM, analytics).

## Per-app quick reference

| App | Key entities | Owns Celery? |
|-----|-------------|--------------|
| `accounting` | JournalEntry, Account, FiscalPeriod | Yes (period close) |
| `billing` | Invoice, CreditNote, Folio | Yes (PDF gen, email) |
| `contacts` | Customer, Supplier, ContactPerson | No |
| `core` | User, Role | No |
| `finances` | Report, CashFlowSnapshot | Yes (scheduled reports) |
| `hr` | Employee, Payroll | Yes (payroll run) |
| `inventory` | StockItem, Warehouse, Movement | No |
| `production` | WorkOrder, Route, Operation, Machine | Yes (scheduling) |
| `purchasing` | PurchaseOrder, Reconciliation | No |
| `sales` | SaleOrder, Quote | No |
| `tax` | TaxRate, FiscalDocument | Yes (fiscal submit) |
| `treasury` | BankAccount, Transaction | Yes (import, reconcile) |
| `workflow` | State, Transition, Approval | Yes (transitions) |
