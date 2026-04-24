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
├── views.py           # ViewSets — thin, delegate to services
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
    └── factories.py   # factory_boy
```

## Layering — where logic goes

| Concern | Location |
|---------|----------|
| HTTP parse/serialize | `serializers.py`, `views.py` |
| Auth / permissions | `permissions.py` |
| Business rules, validation, orchestration | `services.py` |
| Complex read queries | `services.py` or `ViewSet.get_queryset()` |
| Side effects (email, PDF, push) | `tasks.py` (async) |
| Cross-domain workflows | `workflow/` app |

**Golden rule**: `views.py` never contains business logic. Never >20 lines per action.

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
