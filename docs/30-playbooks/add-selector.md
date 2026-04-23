---
layer: 30-playbooks
doc: add-selector
task: "Write complex DB queryset (select_related, prefetch_related, annotations, aggregations)"
triggers: ["selector", "queryset", "N+1", "select_related", "prefetch_related", "annotate", "aggregate", "complex query", "slow query"]
preconditions:
  - 10-architecture/backend-apps.md
  - 40-quality/performance.md
validation:
  - pytest backend/[app]/tests -v
  - python manage.py shell  # EXPLAIN ANALYZE
forbidden:
  - Queryset logic in serializers (SerializerMethodField with DB hits)
  - Queryset logic in templates or frontend hooks
  - ORM calls in Celery tasks without select_related (causes N+1 in task workers)
  - Raw SQL unless aggregation is impossible in ORM (requires ADR)
status: active
owner: backend-team
last_review: 2026-04-22
---

# Playbook — Add selector (complex queryset)

## Where query logic lives

ERPGrafico does not use dedicated `selectors.py` files. Query logic lives in:

| Location | When |
|----------|------|
| `ViewSet.get_queryset()` | List queries with filters, ordering, prefetch |
| `ViewSet.retrieve()` / detail action | Single-object with additional prefetch |
| `service.py` function | Query needed for business logic (not directly for API response) |
| `@action` method | Custom endpoint with aggregations or complex filtering |

Rule: views ≤20 lines. Extract to service when query logic exceeds 10 lines.

---

## Pre-flight checklist

- [ ] Profiled the slow query with `django-debug-toolbar` or `EXPLAIN ANALYZE`.
- [ ] Confirmed this is an N+1 or missing index, not a schema design issue.
- [ ] Chose correct location (see table above).

---

## Step 1 — Identify the N+1

Symptom: high query count in toolbar, repeated identical queries.

```python
# Detect with django-debug-toolbar in dev, or:
from django.db import connection, reset_queries
from django.conf import settings

settings.DEBUG = True
reset_queries()

# ... run the view ...

print(len(connection.queries))  # should be < 10 for a list view
for q in connection.queries:
    print(q['sql'][:120])
```

---

## Step 2 — select_related (ForeignKey / OneToOne)

For forward ForeignKey and OneToOne traversals. Generates JOIN.

```python
# backend/[app]/views.py
def get_queryset(self):
    return MyModel.objects.select_related(
        'category',           # FK on MyModel
        'category__parent',   # chain: FK on Category
        'created_by',         # FK to User
    )
```

Rule: list every FK path that the serializer (or action) accesses. One missed FK = one extra query per row.

---

## Step 3 — prefetch_related (reverse FK / M2M)

For reverse relations and ManyToMany. Runs a second query and joins in Python.

```python
def get_queryset(self):
    return MyModel.objects.select_related('category').prefetch_related(
        'tags',          # M2M
        'line_items',    # reverse FK (LineItem.order FK → Order)
    )
```

### Nested prefetch with Prefetch object

When the related queryset itself needs optimization:

```python
from django.db.models import Prefetch

def get_queryset(self):
    line_items_qs = LineItem.objects.select_related('product', 'uom').prefetch_related(
        Prefetch(
            'product__variants',
            queryset=ProductVariant.objects.filter(active=True),
            to_attr='active_variants',   # access as instance.active_variants
        )
    )

    return Order.objects.select_related('customer', 'created_by').prefetch_related(
        Prefetch('line_items', queryset=line_items_qs),
    )
```

---

## Step 4 — Annotations (computed fields)

Attach aggregated or computed values to each row in a single query.

```python
from django.db.models import Sum, Count, Avg, Value, BooleanField
from django.db.models.functions import Coalesce

def get_queryset(self):
    return Product.objects.annotate(
        total_stock=Coalesce(Sum('stock_moves__quantity'), Value(0)),
        order_count=Count('sale_order_lines', distinct=True),
        is_favorite=Exists(
            Favorite.objects.filter(user=self.request.user, product=OuterRef('pk'))
        ),
    )
```

Access in serializer:

```python
class ProductSerializer(serializers.ModelSerializer):
    total_stock = serializers.IntegerField(read_only=True)
    order_count = serializers.IntegerField(read_only=True)
    is_favorite = serializers.BooleanField(read_only=True)
```

Do NOT compute these in `SerializerMethodField` with `.count()` or `.filter()` — that is an N+1.

---

## Step 5 — Aggregations (summary across all rows)

For totals, averages, or period summaries returned by a single API action:

```python
@action(detail=False, methods=['get'])
def summary(self, request):
    qs = self.get_queryset()   # already filtered

    totals = qs.aggregate(
        total_amount=Sum('amount'),
        avg_amount=Avg('amount'),
        count=Count('id'),
    )
    return Response(totals)
```

For running balances (e.g., ledger), aggregate the opening balance first, then iterate in Python — do not compute running totals in the ORM:

```python
# Opening balance: single aggregate query
opening = base_qs.filter(date__lt=start_date).aggregate(
    debit=Sum('debit'), credit=Sum('credit')
)

# Period rows: iterate in Python
balance = opening_balance
for item in period_qs:
    balance += item.debit - item.credit
    rows.append({**item_data, 'running_balance': balance})
```

---

## Step 6 — Extract to service when view exceeds 20 lines

```python
# backend/[app]/services.py
def get_orders_with_totals(filters: dict) -> QuerySet:
    qs = SaleOrder.objects.select_related('customer', 'created_by').prefetch_related(
        Prefetch('lines', queryset=OrderLine.objects.select_related('product'))
    ).annotate(
        line_count=Count('lines'),
        total=Sum('lines__subtotal'),
    )

    if filters.get('status'):
        qs = qs.filter(status=filters['status'])
    if filters.get('customer_id'):
        qs = qs.filter(customer_id=filters['customer_id'])

    return qs
```

```python
# backend/[app]/views.py
class SaleOrderViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        filters = {
            'status': self.request.query_params.get('status'),
            'customer_id': self.request.query_params.get('customer_id'),
        }
        return get_orders_with_totals(filters)
```

---

## Step 7 — Verify with EXPLAIN ANALYZE

```python
python manage.py shell

>>> from django.db import connection
>>> qs = MyModel.objects.select_related('fk').filter(active=True)
>>> print(qs.query)                       # show ORM SQL
>>> with connection.cursor() as c:
...     c.execute(f"EXPLAIN ANALYZE {qs.query}")
...     print(c.fetchall())
```

Target: no Seq Scan on large tables, no Nested Loop with high row estimates. Add index if Seq Scan appears on a filtered column.

---

## Indexes

Add to model `Meta` when the query filters on a non-PK column:

```python
class MyModel(models.Model):
    status = models.CharField(...)
    created_at = models.DateTimeField(auto_now_add=True)
    customer = models.ForeignKey(...)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['customer', 'status']),   # compound for common filter
            models.Index(fields=['-created_at']),          # descending for ORDER BY
        ]
```

Then follow [add-migration.md](add-migration.md) for the migration.

---

## Validation

```bash
pytest backend/[app]/tests -v

# Manual: check query count
python manage.py shell
>>> from django.test.utils import override_settings
>>> from django.db import reset_queries, connection
>>> # run view logic and check len(connection.queries) < 10
```

## Definition of done

- [ ] Query count for list endpoint ≤ 5 (no N+1).
- [ ] `select_related` covers every FK/OneToOne accessed in serializer.
- [ ] `prefetch_related` covers every reverse FK / M2M accessed in serializer.
- [ ] No ORM calls inside `SerializerMethodField`.
- [ ] Complex queryset (>10 lines) extracted to service function.
- [ ] Annotations used in serializer as read-only fields, not recomputed per instance.
- [ ] EXPLAIN ANALYZE confirms no unexpected Seq Scan on large tables.
- [ ] Index added if query filters on non-indexed column.
- [ ] Tests assert correctness of returned data (not just HTTP 200).
