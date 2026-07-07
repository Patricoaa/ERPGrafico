# Phase 6 — Unified API

> `?include=legacy` (default-on) en `SaleOrderViewSet` y `ContactViewSet`. **`LegacySaleNoteSerializer`** dedicado (mismo shape que `SaleOrderSerializer`). Dual-PK resolution en `retrieve`. Código autoritativo: `05-backend-api.md`.

## Precondiciones

- [ ] Phases 1–5 cerradas (todos los modelos y datos importados).
- [ ] `SaleOrderSerializer` y `ContactSerializer` estudiados.
- [ ] Decisión arquitectónica revisada (ver `01-architecture-decision.md`).

## Tasks

| Task | Título | Salida |
|---|---|---|
| [T19](../tasks/T19-include-query-param.md) | Parser de `?include=` | Helper `_get_include` en viewsets |
| [T20](../tasks/T20-saleorder-serializer-extension.md) | Extender SaleOrderSerializer | `is_legacy` + `legacy_external_id` |
| [T21](../tasks/T21-saleorder-viewset-list.md) | Extender list | Unión `SaleOrder ∪ LegacySaleNote` |
| [T22](../tasks/T22-saleorder-viewset-retrieve.md) | Dual-PK retrieve | Try/except Http404 |
| [T23](../tasks/T23-contact-serializer-extension.md) | Extender ContactSerializer | `is_legacy` |
| [T24](../tasks/T24-legacy-sale-note-serializer.md) | Serializer dedicado | `LegacySaleNoteSerializer` |
| [T25](../tasks/T25-registry-entries.md) | Registry | Solo `legacy.legacyimport` |

## Entregables

- `backend/legacy/serializers.py` con `LegacySaleNoteSerializer` (mismo shape que `SaleOrderSerializer`).
- `backend/sales/serializers.py` extendido con `is_legacy` (=False) + `legacy_external_id` (=None) para mantener el shape unificado.
- `backend/sales/views.py` extendido con `_get_include`, `list` y `retrieve` modificados (cada tipo con su serializer).
- `backend/contacts/serializers.py` extendido con `is_legacy`.
- `backend/contacts/views.py` con `select_related('legacy_origin')` en `get_queryset`.
- `backend/core/registry.py` con entry para `legacy.legacyimport`.
- Tests: `test_sale_order_api_legacy.py`, `test_contact_api_legacy.py`, `test_serializers.py`.

## DoD de la fase

- [ ] `GET /api/sales/orders/?include=legacy` (con `legacy.view_legacy`) devuelve unión `SaleOrder ∪ LegacySaleNote`.
- [ ] `GET /api/sales/orders/?include=none` devuelve solo `SaleOrder`.
- [ ] `GET /api/sales/orders/?include=legacy` (sin permiso) devuelve solo `SaleOrder` (filtrado silencioso).
- [ ] `GET /api/sales/orders/<legacy_pk>/?include=legacy` (con permiso) → 200 con `is_legacy=true`.
- [ ] `GET /api/sales/orders/<legacy_pk>/?include=legacy` (sin permiso) → 404.
- [ ] `GET /api/contacts/contacts/` incluye `is_legacy` en cada item.
- [ ] `pytest backend/sales/tests/test_api_legacy.py backend/contacts/tests/test_api_legacy.py -v` pasa.
- [ ] No se introdujeron `any` en TypeScript (no aplica en backend).

## Decisiones tomadas en esta fase

1. **`?include=legacy` es default-on**: si el cliente no envía el param, se asume `legacy`.
2. **`?include=none`** desactiva explícitamente la unión.
3. **`?include=invalid_value`** → 400 con error claro.
4. **Permisos filtran silenciosamente**: el usuario sin `legacy.view_legacy` no ve NVs legacy, pero la request sigue siendo 200.
5. **Dual-PK retrieve**: primero intenta como `SaleOrder`; si falla, intenta como `LegacySaleNote` (con permiso), serializada con `LegacySaleNoteSerializer`.
6. **Serializer dedicado `LegacySaleNoteSerializer`** (no adapter): emite el mismo shape JSON que `SaleOrderSerializer` con `source=` para alinear nombres (`date`/`total_net`/…). Pasar un objeto ajeno por `SaleOrderSerializer` (ModelSerializer) revienta en sus method-fields/relaciones; ver `05` §2.
7. **`is_legacy` en `SaleOrderSerializer`** es `False` constante (los `SaleOrder` vivos nunca son legacy); en `LegacySaleNoteSerializer` es `True`.
8. **`Contact.is_legacy` se calcula con `hasattr(obj, 'legacy_origin')`** (1 query si se hace `select_related`).

## Serializer dedicado (reemplaza al adapter)

`LegacySaleNoteSerializer` emite el mismo shape JSON que `SaleOrderSerializer` (ver T24 y `05` §2 para el código completo):

```python
# backend/legacy/serializers.py
class LegacySaleNoteSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    date = serializers.DateField(source='issue_date', read_only=True)
    total_net = serializers.IntegerField(source='net_price', read_only=True)
    total_tax = serializers.IntegerField(source='tax_amount', read_only=True)
    total = serializers.IntegerField(source='total_price', read_only=True)
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    is_legacy = serializers.SerializerMethodField()
    # ... (fields completos en T24)
```

## Extensión de serializers vivos

```python
# SaleOrderSerializer (los SaleOrder vivos nunca son legacy)
class SaleOrderSerializer(serializers.ModelSerializer):
    is_legacy = serializers.SerializerMethodField()
    legacy_external_id = serializers.SerializerMethodField()

    class Meta:
        model = SaleOrder
        fields = [..., 'is_legacy', 'legacy_external_id']

    def get_is_legacy(self, obj):
        return False

    def get_legacy_external_id(self, obj):
        return None
```

```python
# ContactSerializer
class ContactSerializer(serializers.ModelSerializer):
    is_legacy = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = [..., 'is_legacy']

    def get_is_legacy(self, obj):
        return hasattr(obj, 'legacy_origin')  # OneToOne reverse; usar select_related
```

## Extensión de viewsets

```python
# SaleOrderViewSet
def _get_include(request):
    raw = request.query_params.get('include', 'legacy')
    if raw == 'none': return set()
    if raw in ('legacy', 'all'): return {'legacy'}
    raise ValidationError({'include': 'Valor inválido. Use none|legacy|all.'})


def list(self, request, *args, **kwargs):
    include = _get_include(request)
    live_qs = self.filter_queryset(self.get_queryset())

    if not ('legacy' in include and request.user.has_perm('legacy.view_legacy')):
        return super().list(request, *args, **kwargs)  # camino normal

    # Cada tipo con su propio serializer (mismo shape JSON).
    legacy_qs = self._filter_legacy(
        LegacySaleNote.objects.select_related('customer', 'vendor', 'work_order'),
        request,
    )
    merged = self._sort_merged(
        [('live', o) for o in live_qs] + [('legacy', n) for n in legacy_qs],
        request,
    )
    page = self.paginate_queryset(merged)
    data = [
        SaleOrderSerializer(o, context=self.get_serializer_context()).data
        if kind == 'live' else
        LegacySaleNoteSerializer(o, context=self.get_serializer_context()).data
        for kind, o in page
    ]
    return self.get_paginated_response(data)


def retrieve(self, request, *args, **kwargs):
    try:
        return super().retrieve(request, *args, **kwargs)
    except Http404:
        if request.user.has_perm('legacy.view_legacy'):
            from legacy.serializers import LegacySaleNoteSerializer
            try:
                note = LegacySaleNote.objects.select_related(
                    'customer', 'vendor', 'work_order'
                ).get(pk=kwargs['pk'])
            except LegacySaleNote.DoesNotExist:
                raise Http404
            return Response(
                LegacySaleNoteSerializer(note, context=self.get_serializer_context()).data
            )
        raise Http404
```

> ⚠️ **Limitaciones del merge** (ver `05` §1.3): `_filter_legacy` debe traducir los filtros/búsqueda/orden de DRF al queryset de `LegacySaleNote` (no se aplican solos); `_sort_merged` ordena por una key común (recomendado `date` desc). Con `include=legacy` se materializan las NVs legacy que pasen el filtro — medir performance (`08` §6).

## Registry

```python
# backend/core/registry.py
REGISTRY = {
    # ... entries existentes ...
    'legacy.legacyimport': {
        'app': 'legacy',
        'model': 'LegacyImport',
        'admin_path': '/admin/legacy/legacyimport/',
        'verbose_name': 'Importaciones legacy',
    },
    # NOTA: 'legacy.legacysalenote' y 'legacy.contactorigin' NO se registran
    # (no son entry points del usuario final).
}
```

## Tests de muestra

```python
# test_sale_order_api_legacy.py
def test_list_includes_legacy_with_permission(api_client, admin_user):
    api_client.force_authenticate(admin_user)
    r = api_client.get('/api/sales/orders/?include=legacy&page=1')
    assert r.status_code == 200
    assert any(item['is_legacy'] for item in r.data['results'])

def test_list_excludes_legacy_with_none(api_client, admin_user):
    api_client.force_authenticate(admin_user)
    r = api_client.get('/api/sales/orders/?include=none&page=1')
    assert all(not item['is_legacy'] for item in r.data['results'])

def test_retrieve_legacy_note(api_client, admin_user):
    note = LegacySaleNoteFactory()
    api_client.force_authenticate(admin_user)
    r = api_client.get(f'/api/sales/orders/{note.id}/?include=legacy')
    assert r.data['is_legacy'] is True
    assert r.data['legacy_external_id'] == note.legacy_external_id

def test_retrieve_legacy_note_no_permission(api_client, regular_user):
    note = LegacySaleNoteFactory()
    api_client.force_authenticate(regular_user)
    r = api_client.get(f'/api/sales/orders/{note.id}/?include=legacy')
    assert r.status_code == 404

def test_invalid_include_value(api_client, admin_user):
    api_client.force_authenticate(admin_user)
    r = api_client.get('/api/sales/orders/?include=foo')
    assert r.status_code == 400
```

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Performance: ~7.980 NVs adicionales en la lista | Medir (`08` §6); `?include=none` para performance crítico; evaluar `UNION` SQL si degrada |
| Conflicto de PK entre `SaleOrder` y `LegacySaleNote` | `BigAutoField` con seeds distintos; colisión imposible |
| Sort: legacy y vivos con fechas distintas | `_sort_merged` ordena por key común `date` (=`issue_date`) DESC |
| Filter/search no aplica a legacy | `_filter_legacy` traduce los query-params al queryset de `LegacySaleNote` |
| N+1 en `legacy_qs` | `select_related('customer', 'vendor', 'work_order')` |

## Comandos de verificación rápida

```bash
# 1. Listar con legacy
curl -sf -H "Authorization: Token $TOKEN" "http://localhost:8100/api/sales/orders/?include=legacy&page=1" | jq '.results | length'
# Esperado: 20 (o page_size)

# 2. Listar sin legacy
curl -sf -H "Authorization: Token $TOKEN" "http://localhost:8100/api/sales/orders/?include=none&page=1" | jq '[.results[] | select(.is_legacy == true)] | length'
# Esperado: 0

# 3. Retrieve legacy
LEGACY_PK=$(python manage.py shell -c "from legacy.models import LegacySaleNote; print(LegacySaleNote.objects.first().id)")
curl -sf -H "Authorization: Token $TOKEN" "http://localhost:8100/api/sales/orders/$LEGACY_PK/?include=legacy" | jq .is_legacy
# Esperado: true

# 4. Contact list
curl -sf -H "Authorization: Token $TOKEN" "http://localhost:8100/api/contacts/contacts/?page=1" | jq '.[0].is_legacy'
# Esperado: true o false (sin error)

# 5. Tests
pytest backend/sales/tests/test_api_legacy.py backend/contacts/tests/test_api_legacy.py -v
```

## Salida para la Phase 7

Al cerrar Phase 6, ya se puede:
- Consumir la API unificada desde el frontend (Phase 7).
- Mostrar NVs legacy en `SalesOrdersView` con chip.
- Mostrar contactos legacy en `ContactListView` con chip.
- Abrir drawers read-only.

**No** se puede aún:
- El usuario ve la UI (falta el frontend).
