# 40 — Estrategia de Testing

> Define **qué** se testea, **dónde** vive cada test y **cómo** verificarlo. Backend con pytest (obligatorio). Frontend con vitest (opcional salvo hooks centralizados).

---

## Principio rector

> Los tests deben verificar **comportamiento de negocio**, no implementación. Si refactorizas un service y los tests no cambian, el test estaba bien escrito.

Cada cambio en `backend/production/services.py` o `views.py` **debe ir con al menos un test** que falle antes del cambio y pase después.

---

## Estructura de tests backend

```
backend/production/tests/
├── __init__.py
├── conftest.py                       # fixtures compartidas
├── factories.py                      # factory-boy / model_bakery factories
├── test_models.py                    # invariantes del modelo (save, unique_constraints, properties)
├── test_serializers.py               # campos expuestos, validaciones
├── test_views.py                     # endpoints (HTTP-level)
├── test_services_creation.py         # create_from_sale_line / create_manual / create_ot_for_delivery_line
├── test_services_transition.py       # transition_to, validaciones, transición backward
├── test_services_finalize.py         # finalize_production, WAC, journal entries
├── test_services_rectify.py          # rectify_production, ajustes
├── test_services_helpers.py          # _expand_bom_into_materials, _create_initial_artifacts (extraídos en TASK-110/111)
├── test_signals.py                   # auto-create OT al confirmar sale order
└── test_pdf.py                       # PDF se genera, tamaño > N bytes
```

---

## Fixtures clave (`conftest.py`)

```python
import pytest
from decimal import Decimal

@pytest.fixture
def warehouse_factory(db):
    def make(**kwargs):
        from inventory.models import Warehouse
        defaults = {'name': 'Bodega Test', 'code': 'WH-01'}
        defaults.update(kwargs)
        return Warehouse.objects.create(**defaults)
    return make

@pytest.fixture
def manufacturable_product_factory(db, warehouse_factory):
    def make(*, with_bom=False, requires_advanced=True, **kwargs):
        from inventory.models import Product, UoM
        uom = UoM.objects.get_or_create(name='unidad', defaults={'ratio': 1})[0]
        product = Product.objects.create(
            name=kwargs.get('name', 'Tarjeta'),
            internal_code=kwargs.get('internal_code', 'TARJ-001'),
            product_type=Product.Type.MANUFACTURABLE,
            uom=uom,
            requires_advanced_manufacturing=requires_advanced,
            **{k: v for k, v in kwargs.items() if k not in ('name', 'internal_code')},
        )
        if with_bom:
            from production.models import BillOfMaterials, BillOfMaterialsLine
            bom = BillOfMaterials.objects.create(product=product, name='BOM v1', active=True)
            # Add at least 1 line - assume a component product exists
        return product
    return make

@pytest.fixture
def sale_line_factory(db, manufacturable_product_factory):
    def make(*, quantity=Decimal('100'), product=None, **kwargs):
        from sales.models import SaleOrder, SaleLine
        product = product or manufacturable_product_factory(with_bom=True)
        order = SaleOrder.objects.create(status=SaleOrder.Status.CONFIRMED, **kwargs.get('order', {}))
        line = SaleLine.objects.create(
            order=order, product=product, quantity=quantity,
            unit_price=Decimal('1000'), uom=product.uom,
        )
        return line
    return make

@pytest.fixture
def work_order_factory(db, manufacturable_product_factory):
    def make(**kwargs):
        from production.models import WorkOrder
        return WorkOrder.objects.create(
            description=kwargs.get('description', 'Test OT'),
            product=kwargs.get('product') or manufacturable_product_factory(),
            is_manual=kwargs.get('is_manual', True),
            status=kwargs.get('status', WorkOrder.Status.DRAFT),
            current_stage=kwargs.get('current_stage', WorkOrder.Stage.MATERIAL_ASSIGNMENT),
            **{k: v for k, v in kwargs.items() if k not in ('description', 'product', 'is_manual', 'status', 'current_stage')},
        )
    return make
```

---

## Tests obligatorios por tarea

### FASE 1

| Tarea | Archivo de test | Casos mínimos |
|---|---|---|
| TASK-002 | `test_serializers.py::test_workorder_due_date_alias` | Serializer expone `due_date` igual a `estimated_completion_date` |
| TASK-003 | `test_views.py::test_filter_due_date_after`, `::test_filter_due_date_before` | Filtros retornan subset correcto |
| TASK-004 | `test_services_creation.py::test_warehouse_resolution_*` | 3 casos: delivery con wh / sin wh / sin deliveries |
| TASK-005 | `test_services_transition.py::test_invalid_transition_rejected`, `::test_valid_chain` | Al menos 5 transiciones (3 válidas + 2 inválidas) |

### FASE 2

| Tarea | Archivo de test | Casos mínimos |
|---|---|---|
| TASK-102 | `test_views.py::test_vat_endpoint` | GET retorna rate + multiplier desde AccountingSettings |
| TASK-110 | `test_services_helpers.py::test_expand_bom_scales_by_factor`, `::test_expand_bom_uom_conversion` | Factor 0.5, 2.0; UoM conversion kg↔g |
| TASK-111 | `test_services_helpers.py::test_create_initial_artifacts_*` | Crea history + task (si no auto-finalize) |
| TASK-112 | `test_stage_data_schema.py::test_migrate_v1_flattens_phase_copies` | Legacy stage_data se aplana correctamente |

### FASE 3

| Tarea | Archivo de test | Casos mínimos |
|---|---|---|
| TASK-201 | `test_models.py::test_unique_active_workorder_per_saleline` | Crear 2 OT con misma sale_line → IntegrityError |
| TASK-202 | `test_views.py::test_create_workorder_*` | 3 cases: manual / linked / fallback |
| TASK-203 | `test_pdf.py::test_workorder_pdf_renders` | PDF retornado tiene size > 5KB + content_type correcto |
| TASK-204 | `test_views.py::test_metrics_endpoint` | Retorna avg_time_by_stage con dataset conocido |
| TASK-206 | `test_models.py::test_workorder_numbering_*` | Con prefijo año / sin prefijo / reset anual |
| TASK-207 | `test_models.py::test_workorder_material_unique_*` | Permite mismo componente con UoM distinta |
| TASK-208 | `test_models.py::test_workorder_material_cost_snapshot` | Snapshot inmutable al cambiar cost_price |
| TASK-209 | `test_services_rectify.py::test_rectify_outsourced` | Discrepancia en servicio queda en history |
| TASK-210 | `test_stage_data_schema.py::test_canonical_stage_data_property` | OT sin _version se migra al leer |

### FASE 4

| Tarea | Archivo de test | Casos mínimos |
|---|---|---|
| TASK-302 | `test_views.py::test_duplicate_workorder` | OT nueva con materiales clonados, sin sale_line |
| TASK-305 | `test_tasks.py::test_celery_notify_overdue` | Tarea Celery genera notification para OT overdue |
| TASK-306 | `test_views.py::test_bulk_print_pdf` | POST con N IDs retorna PDF combinado |
| TASK-312 | `test_models.py::test_workorder_template_*` | Crear template / usar template |
| TASK-313 | `test_views.py::test_scan_token_*` | Token válido transiciona / token expirado falla / token usado falla |

---

## Patrones de tests

### Patrón A: Test de transición

```python
def test_transition_blocks_invalid_stage(work_order_factory):
    wo = work_order_factory(current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT)
    with pytest.raises(ValidationError, match="Transición inválida"):
        WorkOrderService.transition_to(wo, WorkOrder.Stage.FINISHED)
```

### Patrón B: Test de race condition (TASK-201)

```python
def test_concurrent_create_from_sale_line(sale_line_factory, django_db_blocker):
    """Two concurrent threads must not create 2 OTs for the same sale_line."""
    import threading
    sl = sale_line_factory()
    results = []

    def worker():
        try:
            with django_db_blocker.unblock():
                ot = WorkOrderService.create_from_sale_line(sl)
                results.append(('ok', ot.id))
        except IntegrityError:
            results.append(('integrity_error', None))

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads: t.start()
    for t in threads: t.join()

    successes = [r for r in results if r[0] == 'ok']
    assert len(successes) == 1
    assert sl.work_orders.count() == 1
```

### Patrón C: Test del helper extraído

```python
def test_expand_bom_with_uom_conversion(manufacturable_product_factory, work_order_factory):
    """BOM yields 100g of product; we request 1kg → factor should be 10x."""
    product = manufacturable_product_factory(with_bom=True, yield_qty=100, yield_uom='g', base_uom='kg')
    wo = work_order_factory(product=product)
    component = product.boms.first().lines.first().component

    materials = WorkOrderService._expand_bom_into_materials(
        wo, product, requested_qty=Decimal('1'), qty_uom=product.uom  # 1kg
    )

    assert len(materials) == 1
    expected_planned = product.boms.first().lines.first().quantity * Decimal('10')
    assert materials[0].quantity_planned == expected_planned
```

### Patrón D: Test del endpoint con filtros

```python
def test_filter_due_date_range(api_client, work_order_factory):
    wo_early = work_order_factory(estimated_completion_date='2026-05-01')
    wo_mid   = work_order_factory(estimated_completion_date='2026-05-15')
    wo_late  = work_order_factory(estimated_completion_date='2026-06-01')

    res = api_client.get('/api/production/orders/?due_date_after=2026-05-10&due_date_before=2026-05-20')

    ids = {w['id'] for w in res.json()['results']}
    assert ids == {wo_mid.id}
```

---

## Frontend testing (opcional salvo hooks)

### Hooks que requieren test

- `useWorkOrderMutations` — test que cada mutación llama el endpoint correcto y dispara invalidación.
- `useVatRate` — test que cachea y expone defaults razonables si endpoint falla.

### Componentes que se recomienda testear (no obligatorio)

- `OutsourcedServiceForm` — schema de validación + cálculo bruto/neto.
- `ManufacturingSpecsEditor` — toggles de fases activan/desactivan inputs correctamente.

### Setup vitest

```ts
// frontend/__tests__/setup.ts (existente, verificar)
import '@testing-library/jest-dom'
```

### Patrón E: test de hook con MSW

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useVatRate } from '@/hooks/useVatRate'

test('useVatRate returns rate from endpoint', async () => {
  const queryClient = new QueryClient()
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const { result } = renderHook(() => useVatRate(), { wrapper })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.multiplier).toBe(1.19)
})
```

---

## Cobertura y CI

### Cobertura mínima objetivo

| Módulo | Cobertura objetivo |
|---|---|
| `backend/production/services.py` | **> 85%** |
| `backend/production/views.py` | **> 70%** |
| `backend/production/serializers.py` | **> 75%** |
| `backend/production/models.py` (incl. properties) | **> 80%** |

### Comandos de verificación local

```bash
# Antes de cada PR
pytest backend/production/ -v
pytest backend/production/ --cov=production --cov-report=term-missing

# Frontend type-check (siempre)
cd frontend && npm run type-check

# Frontend tests (si hay hooks tocados)
cd frontend && npm run test -- features/production
```

### Excepciones

Cuando un test sea inviable (e.g. integraciones con servicios externos no mockeables, lógica puramente UI), documentar en el cuerpo del PR con `# test_skip: <razón>`.

---

## Antipatterns a evitar

❌ **Tests que solo verifican que un mock fue llamado**:
```python
def test_transition_calls_workflow():
    with mock.patch('production.services.WorkflowService.create_task') as m:
        WorkOrderService.transition_to(...)
        m.assert_called()  # test sin valor
```

✅ **Tests que verifican comportamiento observable**:
```python
def test_transition_creates_approval_task():
    WorkOrderService.transition_to(wo, Stage.MATERIAL_APPROVAL)
    assert Task.objects.filter(
        content_type=ContentType.objects.get_for_model(wo),
        object_id=wo.id,
        task_type='OT_MATERIAL_APPROVAL',
    ).exists()
```

❌ **Tests acoplados a implementación**:
```python
def test_create_calls_save():
    with mock.patch.object(WorkOrder, 'save') as m:
        WorkOrderService.create_manual(...)
        m.assert_called()
```

✅ **Tests centrados en el resultado**:
```python
def test_create_manual_persists_workorder(manufacturable_product_factory):
    wo = WorkOrderService.create_manual(
        manufacturable_product_factory(), quantity=10, description='X'
    )
    assert WorkOrder.objects.filter(id=wo.id).exists()
    assert wo.status == WorkOrder.Status.DRAFT
```
