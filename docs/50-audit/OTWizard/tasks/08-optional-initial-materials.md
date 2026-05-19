---
layer: 50-audit
doc: ot-wizard-task-08
phase: 5
status: optional
---

# Task 08 — Backend: `initial_materials[]` en create (OPCIONAL)

## Objetivo

Permitir crear una OT + materiales en una **única transacción atómica** desde el wizard, eliminando el riesgo de dejar OTs huérfanas sin materiales si la segunda llamada falla.

## Cuándo ejecutar esta task

**Sólo si**:

- El equipo de UX detecta que es frecuente que el usuario asigne materiales inmediatamente después de crear la OT y un fallo intermitente causa dropouts.
- El equipo backend tiene capacidad para extender el serializer + tests.

**Skippeable** sin perjuicio del refactor frontend (tasks 01–07). El flujo de 2 llamadas funciona; esta task añade resiliencia.

## Depende de

— (independiente; puede ejecutarse en paralelo con tasks frontend)

## Archivos afectados

| Path | Acción |
|---|---|
| `backend/production/services.py` | Extender `create_from_request_payload` |
| `backend/production/serializers.py` | Nuevo `WorkOrderInitialMaterialSerializer` |
| `backend/production/tests/test_services.py` | Tests de atomicidad |
| `backend/production/tests/test_views.py` | Tests del endpoint con `initial_materials` |
| `frontend/features/production/components/forms/WorkOrderBasicStep/index.tsx` | (Opcional) Incluir materiales si el usuario los asignó en un sub-step |

## Cambios paso a paso

### 8.1 Serializer

```python
# backend/production/serializers.py

class WorkOrderInitialMaterialSerializer(serializers.Serializer):
    component_id = serializers.IntegerField()
    quantity_planned = serializers.DecimalField(max_digits=12, decimal_places=2)
    is_outsourced = serializers.BooleanField(default=False)
    supplier_id = serializers.IntegerField(required=False, allow_null=True)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)

    def validate(self, data):
        if data.get('is_outsourced') and not data.get('supplier_id'):
            raise serializers.ValidationError("Material tercerizado requiere supplier_id.")
        return data
```

### 8.2 Service

```python
# backend/production/services.py

@staticmethod
@transaction.atomic                  # ← clave: todo o nada
def create_from_request_payload(data, files, user):
    # … código existente sin cambios …

    initial_materials_raw = data.get('initial_materials')
    if isinstance(initial_materials_raw, str):
        try:
            initial_materials = json.loads(initial_materials_raw)
        except (json.JSONDecodeError, TypeError):
            initial_materials = []
    else:
        initial_materials = initial_materials_raw or []

    work_order = …  # resultado del branching existente

    if work_order and initial_materials:
        from .models import WorkOrderMaterial
        for m in initial_materials:
            serializer = WorkOrderInitialMaterialSerializer(data=m)
            serializer.is_valid(raise_exception=True)
            WorkOrderMaterial.objects.create(
                work_order=work_order,
                component_id=serializer.validated_data['component_id'],
                quantity_planned=serializer.validated_data['quantity_planned'],
                is_outsourced=serializer.validated_data.get('is_outsourced', False),
                supplier_id=serializer.validated_data.get('supplier_id'),
                unit_price=serializer.validated_data.get('unit_price'),
            )

    return work_order
```

> **Importante**: el `@transaction.atomic` garantiza que un fallo en `WorkOrderMaterial.objects.create` revierta la creación de la WorkOrder. Verificar que el decorator no esté ya aplicado al método (si lo está, sólo asegurarse de que el nuevo código vive dentro de su alcance).

### 8.3 Views (no requiere cambios)

`WorkOrderViewSet.create` sigue ≤ 20 LOC; la lógica nueva vive en `services.py`. Invariante #9 preservada.

### 8.4 Tests backend

```python
# backend/production/tests/test_services.py

class CreateWithInitialMaterialsTests(TestCase):
    def test_create_manual_with_materials_succeeds(self):
        # construye payload, llama al service, asserta OT + N WorkOrderMaterial
        ...

    def test_create_rolls_back_on_invalid_material(self):
        # material inválido → ninguna OT creada (transaction.atomic)
        with self.assertRaises(ValidationError):
            ...
        self.assertEqual(WorkOrder.objects.count(), 0)
        self.assertEqual(WorkOrderMaterial.objects.count(), 0)

    def test_create_outsourced_without_supplier_fails(self):
        # validación del serializer
        ...
```

### 8.5 Frontend (opcional — sólo si UX lo justifica)

Si se decide añadir un sub-step de materiales antes del POST:

- Crear `WorkOrderInitialMaterialsField` en `WorkOrderBasicStep/` (no es un step nuevo, es una sección colapsable).
- Al submit, incluir `formData.append('initial_materials', JSON.stringify(materials))`.
- Si el usuario no toca esa sección, no se envía nada y la OT se crea sin materiales (comportamiento actual).

> Recomendación: **no añadir** este sub-step a Step 0 — el wizard ya tiene `MATERIAL_ASSIGNMENT` como step dedicado. Esta task backend habilita la atomicidad para clientes futuros (mobile, integraciones), no necesariamente para el wizard web.

## Contrato

- `POST /production/orders/` acepta un nuevo campo opcional `initial_materials` (JSON-stringified array o array nativo si content-type es JSON).
- Si está ausente o vacío, comportamiento idéntico al actual (zero breaking change).
- Si está presente y un item es inválido, **toda la creación se revierte** (transactional).

## Criterios de aceptación

- [ ] `create_from_request_payload` acepta `initial_materials` y los persiste.
- [ ] Fallo en un material revierte la WorkOrder (test verde).
- [ ] El endpoint sigue funcionando sin `initial_materials` (test de regresión verde).
- [ ] `WorkOrderInitialMaterialSerializer` valida supplier_id requerido para outsourced.
- [ ] `WorkOrderViewSet.create` sigue ≤ 20 LOC.

## Validación

```bash
pytest backend/production -q --tb=short
pytest backend/production/tests/test_services.py::CreateWithInitialMaterialsTests -v
```

## Rollback

`git revert` del commit backend — el frontend que no envía `initial_materials` no se ve afectado. Cero breaking change.

## Issues abiertos

- ¿Deduplication por idempotency-key debería implementarse server-side aquí mismo? Si sí, abrir task separada.
- ¿`initial_materials` debe soportar BOM-expansion automática (`expand_from_bom: true`)? Posible follow-up.
