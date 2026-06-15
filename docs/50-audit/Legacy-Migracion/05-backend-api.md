# 05 — Backend API (endpoints + serializadores)

> API unificada vía `?include=legacy`. 2 endpoints exclusivos del import/registro. Sin vistas paralelas.

## 0. Vista global de endpoints

| Endpoint | Método | Permisos | Propósito |
|---|---|---|---|
| `/api/sales/orders/?include=legacy` | GET | `sales.view_saleorder` (o `legacy.view_legacy`) | Lista unificada |
| `/api/sales/orders/?include=none` | GET | mismo | Lista solo vivos |
| `/api/sales/orders/<pk>/?include=legacy` | GET | mismo | Detalle; PK puede ser `SaleOrder` o `LegacySaleNote` |
| `/api/contacts/contacts/` | GET | `contacts.view_contact` | Lista con flag `is_legacy` |
| `/api/contacts/contacts/<pk>/` | GET | mismo | Detalle con `is_legacy` |
| `/api/legacy/imports/commit/` | POST | `legacy.import_legacy` | Dispara import (alternativa al management command) |
| `/api/legacy/imports/<id>/` | GET | `legacy.view_legacy` | Estado del import |
| `/api/legacy/sale-notes/<id>/register-payment/` | POST | `legacy.pay_pending_legacy` AND `treasury.add_treasurymovement` | Pago nuevo |

## 1. Query param `?include=`

### 1.1 Parser

```python
# backend/sales/views.py
def _get_include(request):
    raw = request.query_params.get('include', 'legacy')
    if raw == 'none':
        return set()
    if raw == 'legacy':
        return {'legacy'}
    if raw == 'all':
        return {'legacy'}
    raise ValidationError({'include': 'Valor inválido. Use none|legacy|all.'})
```

### 1.2 Default

`?include=legacy` (default-on). Si el cliente quiere **solo vivos**, pasa `?include=none`.

### 1.3 Validación de permisos por tipo

- Si el usuario **no** tiene `legacy.view_legacy` y pide `?include=legacy`, se filtra silenciosamente: solo ve `SaleOrder` vivos.
- Si el usuario **sí** tiene `legacy.view_legacy`, ve la unión completa.

```python
def list(self, request, *args, **kwargs):
    include = _get_include(request)
    live_qs = self.filter_queryset(self.get_queryset())

    if not ('legacy' in include and request.user.has_perm('legacy.view_legacy')):
        return super().list(request, *args, **kwargs)  # camino normal, sin merge

    # Merge SaleOrder ∪ LegacySaleNote. Cada uno con su serializer (mismo shape JSON).
    legacy_qs = self._filter_legacy(
        LegacySaleNote.objects.select_related('customer', 'vendor', 'work_order'),
        request,
    )
    live = [('live', o) for o in live_qs]
    legacy = [('legacy', n) for n in legacy_qs]
    merged = self._sort_merged(live + legacy, request)  # ordena por la key común (date)

    page = self.paginate_queryset(merged)
    data = [
        SaleOrderSerializer(o, context=self.get_serializer_context()).data
        if kind == 'live' else
        LegacySaleNoteSerializer(o, context=self.get_serializer_context()).data
        for kind, o in page
    ]
    return self.get_paginated_response(data)
```

> ⚠️ **Limitaciones conocidas del merge** (decidir en T19/T21 antes de implementar):
> - **Filtros/búsqueda/orden de DRF** aplican al queryset vivo pero **no** automáticamente al de legacy: `_filter_legacy` debe **traducir explícitamente** los query-params relevantes (rango de fecha, `status`, `customer`, search) al queryset de `LegacySaleNote`, o los items legacy ignorarían los filtros.
> - **Materialización**: con `include=legacy` se cargan en memoria todas las NVs legacy que pasen el filtro (hasta ~7.980). Para una PYME de nodo único es tolerable con `select_related`, pero hay que medir (`08` §6). Si degrada, evaluar `UNION` a nivel SQL o restringir `include=legacy` a vistas que ya filtran por fecha/cliente.
> - El orden por defecto debe ser una **key común** a ambos tipos (recomendado `date` desc); ordenar por campos que solo existen en uno de los dos no es soportado en el merge.

## 2. Serialización de NV legacy con forma `SaleOrder`

> ⚠️ **REESCRITO.** El plan previo proponía un adapter "duck-typed" para pasarlo por `SaleOrderSerializer`. **No funciona** contra el serializer real (`sales/serializers.py:140`):
> - El serializer expone **`date`** (no `issue_date`), **`total_net` / `total_tax` / `total` / `total_discount_amount`** (no `net_price` / `tax_amount` / `total_price`), `display_id`, `customer_name` (`source='customer.name'`), `channel` / `channel_display`.
> - Tiene `SerializerMethodField`s — `total_paid`, `pending_amount`, `production_progress` — y bloques anidados de **facturas / despachos / pagos** que acceden a `obj.effective_total`, `obj.work_orders.all()`, relaciones de `SaleOrder` que un objeto plano **no tiene** → reventaría.
>
> **Decisión adoptada**: en vez de forzar un objeto ajeno por un `ModelSerializer`, se usa un **serializer dedicado** `LegacySaleNoteSerializer` que **emite el mismo shape JSON** que el frontend espera de una NV (mismos nombres de campo). El viewset elige el serializer por tipo de item.

`backend/legacy/serializers.py`:

```python
class LegacySaleNoteSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer = serializers.PrimaryKeyRelatedField(read_only=True)
    # Nombres alineados al SaleOrderSerializer:
    date = serializers.DateField(source='issue_date', read_only=True)
    total_net = serializers.IntegerField(source='net_price', read_only=True)
    total_tax = serializers.IntegerField(source='tax_amount', read_only=True)
    total = serializers.IntegerField(source='total_price', read_only=True)
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    is_legacy = serializers.SerializerMethodField()
    legacy_external_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = LegacySaleNote
        fields = [
            'id', 'number', 'display_id', 'customer', 'customer_name', 'date',
            'status', 'total_net', 'total_tax', 'total', 'total_paid',
            'pending_amount', 'is_legacy', 'legacy_external_id', 'description',
            'is_pending', 'category_snapshot',
        ]

    def get_total_paid(self, obj):
        return obj.legacy_payments.aggregate(s=Sum('amount'))['s'] or 0

    def get_pending_amount(self, obj):
        return max(0, obj.total_price - self.get_total_paid(obj))  # 7 NVs sobrepagadas → clamp a 0

    def get_is_legacy(self, obj):
        return True

    # `number` y `display_id`: properties en el modelo (number=legacy_number, display_id=f"NV-{legacy_external_id}")
```

**Por qué no el adapter**: serializar un objeto que no es `SaleOrder` por `SaleOrderSerializer` (un `ModelSerializer`) es frágil — los method-fields y relaciones anidadas asumen el ORM de `SaleOrder`. El serializer dedicado produce el mismo contrato JSON sin acoplarse a esos internals.

## 3. `SaleOrderSerializer` extendido

`backend/sales/serializers.py`:

```python
class SaleOrderSerializer(serializers.ModelSerializer):
    is_legacy = serializers.SerializerMethodField()
    legacy_external_id = serializers.SerializerMethodField()

    class Meta:
        model = SaleOrder
        fields = [..., 'is_legacy', 'legacy_external_id']

    def get_is_legacy(self, obj):
        return False   # los SaleOrder vivos nunca son legacy

    def get_legacy_external_id(self, obj):
        return None
```

**Por qué constantes**: los `SaleOrder` vivos pasan siempre por este serializer y nunca son legacy; las NVs legacy usan `LegacySaleNoteSerializer` (§2). Estos dos campos existen solo para que ambos tipos compartan el mismo shape JSON en la lista unificada.

## 4. `ContactSerializer` extendido

`backend/contacts/serializers.py`:

```python
class ContactSerializer(serializers.ModelSerializer):
    is_legacy = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = [..., 'is_legacy']

    def get_is_legacy(self, obj):
        return hasattr(obj, 'legacy_origin')
```

**Sin overhead**: el `hasattr` resuelve vía `related_name='legacy_origin'` sin query extra (cuando se hace `.select_related('legacy_origin')` en el viewset).

## 5. `SaleOrderViewSet.retrieve` dual-PK

```python
def retrieve(self, request, *args, **kwargs):
    pk = kwargs.get(self.lookup_field or 'pk')

    # Intentar primero como SaleOrder
    try:
        return super().retrieve(request, *args, **kwargs)
    except Http404:
        pass

    # Intentar como LegacySaleNote
    if request.user.has_perm('legacy.view_legacy'):
        from legacy.models import LegacySaleNote
        from legacy.serializers import LegacySaleNoteSerializer
        try:
            note = LegacySaleNote.objects.select_related(
                'customer', 'vendor', 'work_order'
            ).get(pk=pk)
        except LegacySaleNote.DoesNotExist:
            raise Http404

        if not self._legacy_visible_to_user(note, request.user):
            raise Http404

        serializer = LegacySaleNoteSerializer(note, context=self.get_serializer_context())
        return Response(serializer.data)

    raise Http404
```

**Riesgo de colisión**: si el mismo PK existe en `SaleOrder` y `LegacySaleNote`, gana `SaleOrder`. Es aceptable porque los PKs son `BigAutoField` y la probabilidad de colisión es nula en este dataset.

## 6. Endpoints exclusivos

### 6.1 `POST /api/legacy/imports/commit/`

```python
class LegacyImportCommitView(APIView):
    permission_classes = [IsAuthenticated, LegacyImportPermission]

    def post(self, request):
        idempotency_key = request.headers.get('Idempotency-Key')
        if not idempotency_key:
            return Response({'detail': 'Idempotency-Key header requerido.'}, status=400)

        # Verificar idempotencia
        existing = LegacyImport.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return Response(LegacyImportSerializer(existing).data, status=200)

        # Disparar Celery task
        task = run_legacy_import_task.delay(
            dsn=request.data.get('dsn') or os.environ.get('LEGACY_DSN'),
            stage=request.data.get('stage', 'all'),
            batch_size=int(request.data.get('batch_size', 500)),
            dry_run=bool(request.data.get('dry_run', False)),
            started_by_id=request.user.id,
            idempotency_key=idempotency_key,
        )

        import_run = LegacyImport.objects.create(
            stage=request.data.get('stage', 'all'),
            status=LegacyImport.Status.RUNNING,
            started_by=request.user,
            dry_run=bool(request.data.get('dry_run', False)),
            legacy_dsn=(request.data.get('dsn') or '').split('@')[-1],
            idempotency_key=idempotency_key,
        )

        return Response(LegacyImportSerializer(import_run).data, status=201)
```

**Idempotencia**: si el mismo `Idempotency-Key` se re-envía, se devuelve el `LegacyImport` existente con 200 (no 201).

### 6.2 `POST /api/legacy/sale-notes/<id>/register-payment/`

```python
class RegisterLegacyPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # Validar permisos compuestos
        if not (request.user.has_perm('legacy.pay_pending_legacy')
                and request.user.has_perm('treasury.add_treasurymovement')):
            raise PermissionDenied('Requiere legacy.pay_pending_legacy y treasury.add_treasurymovement.')

        idempotency_key = request.headers.get('Idempotency-Key')

        note = get_object_or_404(LegacySaleNote, pk=pk)
        serializer = LegacyPaymentRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            registration, created = LegacyPaymentRegistration.objects.get_or_create(
                idempotency_key=idempotency_key,
                defaults={
                    'sale_note': note,
                    'registered_by': request.user,
                    'paid_at': serializer.validated_data['paid_at'],
                    'amount': serializer.validated_data['amount'],
                    'method': serializer.validated_data['method'],
                    'notes': serializer.validated_data.get('notes'),
                },
            )
        return Response(LegacyPaymentRegistrationSerializer(registration).data,
                        status=201 if created else 200)
```

**Por qué ambos permisos**: el usuario fue explícito: registrar un pago nuevo sobre NV legacy **requiere** la capacidad de registrar pagos en general (`treasury.add_treasurymovement`) **y** la capacidad específica de pagar pendientes legacy (`legacy.pay_pending_legacy`). Sin ambos → 403.

## 7. URL routing

`backend/legacy/urls.py`:

```python
from django.urls import path
from . import views

urlpatterns = [
    path('imports/commit/', views.LegacyImportCommitView.as_view(), name='legacy-import-commit'),
    path('imports/<int:pk>/', views.LegacyImportDetailView.as_view(), name='legacy-import-detail'),
    path('sale-notes/<int:pk>/register-payment/', views.RegisterLegacyPaymentView.as_view(), name='legacy-register-payment'),
]
```

`backend/config/urls.py`:

```python
urlpatterns = [
    ...
    path('api/legacy/', include('legacy.urls')),
    ...
]
```

## 8. Cache y performance

- **`SaleOrderViewSet.list`**: el `select_related` de la lista viva se mantiene; el queryset legacy usa su propio `select_related` (`customer`, `vendor`, `work_order`).
- **`LegacySaleNote` list**: `select_related('customer', 'related_contact', 'vendor', 'work_order')` para evitar N+1.
- **`ContactListView` con `is_legacy`**: `select_related('legacy_origin')` para evitar N+1 del `hasattr`.

## 9. Errores y códigos HTTP

| Caso | Código |
|---|---|
| `?include=invalid_value` | 400 |
| NV legacy pedida por `retrieve` sin permiso | 404 (no 403, para no filtrar existencia) |
| `register-payment` sin ambos permisos | 403 |
| `register-payment` con monto ≤ 0 | 400 |
| `imports/commit` sin `Idempotency-Key` | 400 |
| Import Celery task FAILED | 500 (con `error_log` en respuesta) |

## 10. OpenAPI / Swagger

- Los 2 endpoints exclusivos se documentan automáticamente con `drf-spectacular` (tags: `legacy`).
- Los 4 endpoints de `sales` y `contacts` se etiquetan con `is_legacy: bool` en su shape.
- Un grupo de tags `legacy` agrupa los 2 endpoints exclusivos para que aparezcan separados en Swagger UI.

## 11. Tests de API

- `test_list_includes_legacy`: GET con `?include=legacy` (permiso OK) → mezcla SaleOrder + LegacySaleNote.
- `test_list_excludes_legacy_no_permission`: GET con `?include=legacy` sin `legacy.view_legacy` → solo SaleOrder.
- `test_retrieve_legacy_note`: GET `/api/sales/orders/<legacy_pk>/` → 200 con shape correcto.
- `test_retrieve_legacy_note_no_permission`: GET `/api/sales/orders/<legacy_pk>/` sin permiso → 404.
- `test_register_payment_requires_both_permissions`: sin `treasury.add_treasurymovement` → 403.
- `test_register_payment_idempotency`: 2 POSTs con misma `Idempotency-Key` → mismo `registration`, segundo es 200.
