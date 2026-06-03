# 05 — Backend API (endpoints + adapter + serializadores)

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
    qs = self.filter_queryset(self.get_queryset())

    items = list(qs)
    if 'legacy' in include and request.user.has_perm('legacy.view_legacy'):
        from legacy.adapters import LegacySaleNoteAsSaleOrderShape
        from legacy.models import LegacySaleNote
        legacy_qs = self.filter_legacy_queryset(LegacySaleNote.objects.all(), request)
        items += [LegacySaleNoteAsSaleOrderShape(n) for n in legacy_qs]

    items = self.sort_items(items, request)
    page = self.paginate_queryset(items)
    serializer = self.get_serializer(page, many=True)
    return self.get_paginated_response(serializer.data)
```

## 2. Adapter `LegacySaleNoteAsSaleOrderShape`

`backend/legacy/adapters.py`:

```python
class LegacySaleNoteAsSaleOrderShape:
    """Adapta LegacySaleNote para que sea indistinguible de SaleOrder
    en el serializer."""

    def __init__(self, note: LegacySaleNote):
        self._n = note

    @property
    def id(self): return self._n.id

    @property
    def number(self): return self._n.legacy_number

    @property
    def issue_date(self): return self._n.issue_date

    @property
    def customer(self): return self._n.customer

    @property
    def related_contact(self): return self._n.related_contact

    @property
    def vendor(self): return self._n.vendor  # LegacyVendor, no Contact

    @property
    def status(self): return self._n.status

    @property
    def net_price(self): return self._n.net_price

    @property
    def tax_amount(self): return self._n.tax_amount

    @property
    def total_price(self): return self._n.total_price

    @property
    def description(self): return self._n.description

    @property
    def is_legacy(self): return True

    @property
    def legacy_external_id(self): return self._n.legacy_external_id

    @property
    def work_order(self): return self._n.work_order

    @property
    def created_at(self): return self._n.created_at

    @property
    def updated_at(self): return self._n.updated_at
```

**Decisión**: duck-typing. El adapter expone los mismos atributos que `SaleOrder` consume en el serializer. No hereda de `SaleOrder` (no tendría sentido — son modelos distintos).

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
        # Si el objeto es el adapter, ya tiene is_legacy
        if hasattr(obj, 'is_legacy'):
            return obj.is_legacy
        return False

    def get_legacy_external_id(self, obj):
        if hasattr(obj, 'legacy_external_id'):
            return obj.legacy_external_id
        return None
```

**Por qué `SerializerMethodField`**: `SaleOrder` no debe contaminarse con campos legacy. La lógica vive en el serializer y en el adapter.

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
        from legacy.adapters import LegacySaleNoteAsSaleOrderShape
        try:
            note = LegacySaleNote.objects.select_related(
                'customer', 'related_contact', 'vendor', 'work_order'
            ).get(pk=pk)
        except LegacySaleNote.DoesNotExist:
            raise Http404

        if not self._legacy_visible_to_user(note, request.user):
            raise Http404

        adapter = LegacySaleNoteAsSaleOrderShape(note)
        serializer = self.get_serializer(adapter)
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

- **`SaleOrderViewSet.list`**: el `select_related` de la lista viva se mantiene; el adapter no requiere queries adicionales.
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
