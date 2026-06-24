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

### Cross-app data contracts

Serializers from different apps must NOT import each other directly at the top level — this creates fragile coupling and circular import chains. When data from one app is needed inside another app's serializer:

| Pattern | When | Example |
|---------|------|---------|
| **Lazy import inside method** | Read-only, small field subset | `InvoiceSerializer` imports `TreasuryMovementSerializer` inside `get_serialized_payments()` |
| **Adapter function** | Computed data from another domain | `accounting/adapters.py` exposes `get_settings_fields()` consumed by `sales/views.py` instead of direct model access |
| **Interface / protocol class** | Multiple apps consume the same foreign domain data | Create `production/adapters.py` with `BomData` protocol used by `inventory` and `sales` |
| **Move to workflow/** | Orchestration across ≥3 apps | Create a workflow action that calls each domain's service |

**Adapter pattern (recommended for read access):**

```python
# backend/accounting/adapters.py
from dataclasses import dataclass

@dataclass
class AccountingSettingsData:
    default_revenue_account_id: int | None
    default_cost_account_id: int | None
    check_portfolio_account_id: int | None

def get_accounting_settings() -> AccountingSettingsData:
    from accounting.models import AccountingSettings
    obj = AccountingSettings.objects.first()
    if not obj:
        return AccountingSettingsData(None, None, None)
    return AccountingSettingsData(
        default_revenue_account_id=obj.default_revenue_account_id,
        default_cost_account_id=obj.default_cost_account_id,
        check_portfolio_account_id=obj.check_portfolio_account_id,
    )
```

**Rule:** A serializer from app A importing a serializer from app B is a code smell. It signals missing adapter layer or missing workflow action. If unavoidable, document the cross-app dependency in a comment and add an ADR if the pattern spreads.

## Transactions

- Services that mutate ≥2 tables: wrap in `transaction.atomic()`.
- Reconciliation operations: use `select_for_update()` on target rows with explicit ordering to prevent deadlocks.
- Celery tasks that write: transaction per task, idempotency key stored.

### When NOT to use `transaction.atomic()`

| Scenario | Risk | Alternative |
|----------|------|-------------|
| Long-running loops (>1k iterations) with per-row writes | Timeout, connection pool exhaustion | Batch writes, Celery task per batch |
| Nested `transaction.atomic()` in service → service calls | Unexpected savepoints, deadlocks | Flatten: extract inner logic into a non-transactional function, wrap at the outermost caller only |
| Read-only queries | Unnecessary overhead | No wrapper needed |
| Operations calling external APIs (email, PDF, HTTP webhook) | Rollback can't undo external side effect | Move side effect to Celery task after DB commit via `on_commit()` |

### Prefer `select_for_update()` over Nested atomic

When two services both wrap `transaction.atomic()` and one calls the other, the inner atomic creates a savepoint rather than extending the outer transaction. Use `select_for_update()` explicitly on contested rows instead:

```python
# ✅ Explicit row lock
with transaction.atomic():
    order = SaleOrder.objects.select_for_update().get(pk=order_id)
    movement = TreasuryMovement.objects.select_for_update().get(pk=movement_id)
    order.status = SaleOrder.Status.PAID
    order.save()
    movement.status = TreasuryMovement.Status.RECONCILED
    movement.save()
```

**Rule:** Audit existing `@transaction.atomic` decorators. Any service method that calls another service's `@transaction.atomic` method should be slimmed to a single explicit `select_for_update()` block at the outermost caller.

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

## Shared patterns

Reusable patterns that avoid duplication across apps.

### Shared enums (`core/models/enums.py`)

Do NOT repeat `TextChoices` classes across apps. Centralize in `core/models/enums.py`:

```python
# backend/core/models/enums.py
class Status(models.TextChoices):
    DRAFT = 'DRAFT', 'Borrador'
    CONFIRMED = 'CONFIRMED', 'Confirmado'
    PAID = 'PAID', 'Pagado'
    CANCELLED = 'CANCELLED', 'Anulado'

class PaymentMethod(models.TextChoices):
    CASH = 'CASH', 'Efectivo'
    CARD = 'CARD', 'Tarjeta'
    TRANSFER = 'TRANSFER', 'Transferencia'
    CHECK = 'CHECK', 'Cheque'
    CREDIT = 'CREDIT', 'Crédito'
```

Import where needed:
```python
from core.models.enums import Status, PaymentMethod

class SaleOrder(models.Model):
    status = models.CharField(max_length=20, choices=Status.choices)
```

**Rule:** Any new `TextChoices` that would be shared across ≥2 apps must live in `core/models/enums.py`. App-local enums (used in one app only) stay in that app's `models.py`.

### Reusable mixins (`core/mixins.py`)

Common view-level guards extracted into `core/mixins.py`:

```python
# backend/core/mixins.py
class DraftOnlyUpdateMixin:
    """Blocks PATCH/PUT on non-DRAFT instances."""
    def perform_update(self, serializer):
        if self.get_object().status != 'DRAFT':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only DRAFT records can be edited.')
        serializer.save()
```

Additional mixins to add as patterns emerge:
- `CompanyScopedMixin` — filters queryset by `request.user.company`
- `PeriodScopedMixin` — filters by active fiscal period
- `AuditLogMixin` — logs every state transition to `ActionLog`

### Base ViewSets (`core/views.py`)

Extract repeated ViewSet patterns into base classes:

```python
# backend/core/views.py
class SingletonSettingsViewSet(viewsets.GenericViewSet):
    """Base for settings panels (company-level singleton, no list/delete).
    
    Provides `current` action that returns the singleton or 404 on GET,
    and `partial_update` on PATCH. Subclasses set `serializer_class` only.
    """
    lookup_field = None  # singleton — no pk in URL

    def get_object(self):
        obj, _ = self.queryset.model.objects.get_or_create(pk=1)
        return obj

    @action(detail=False, methods=['get', 'patch'])
    def current(self, request):
        if request.method == 'GET':
            return Response(self.serializer_class(self.get_object()).data)
        instance = self.get_object()
        serializer = self.serializer_class(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
```

**Rule:** If the same ViewSet pattern appears in ≥3 apps, extract to `core/views.py`. Current candidates: `AccountingSettingsViewSet`, `SalesSettingsViewSet`, `HRSettingsViewSet`, `WorkflowSettingsViewSet`, `ProductionSettingsViewSet`, `ReconciliationSettingsViewSet`.

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
