# 20 — Lista de Tareas Atómicas

> Cada tarea está diseñada para ejecutarse de forma independiente con criterios de aceptación verificables. Las dependencias están explícitas. Si una tarea depende de otra, NO empezar antes.

**Leyenda:**
- **Esfuerzo:** XS (< 30min) · S (30min-2h) · M (2-6h) · L (1+ día)
- **Tipo:** Bugfix · DRY · Refactor · Feature · UX
- **Test req:** `backend` obligatorio, `frontend` opcional salvo hooks centralizados

---

## FASE 1 — Estabilización (P0) ✅ COMPLETADA

### TASK-001 ✅ — Fix `MaterialAssignmentStep.tsx` (state no declarado)
**Prioridad:** P0 · **Tipo:** Bugfix · **Esfuerzo:** XS · **Test req:** no aplica
**Archivos:** [frontend/features/production/components/steps/MaterialAssignmentStep.tsx](../../../frontend/features/production/components/steps/MaterialAssignmentStep.tsx)
**Dependencias:** ninguna

**Contexto:**
El componente tiene código zombie de cuando la lógica de tercerización vivía aquí. Hoy esa lógica está en `OutsourcingAssignmentStep.tsx`. El `OutsourcedForm` interno (líneas 132-189) referencia state no declarado.

**Acción:**
1. Eliminar el sub-componente `OutsourcedForm` interno (líneas 132-189).
2. Eliminar todas las referencias a `supplierId`, `grossPrice`, `netPrice`, `documentType`, `saving` y sus setters en el resto del archivo.
3. Eliminar el branch `isAddOpen && !isOutsourced ? ... : ...` en favor de solo `isAddOpen ? <form-stock> : <button>`.
4. Mantener únicamente la lógica de materiales de stock.
5. Eliminar el `<MaterialAssignmentTabs>` si ya no aplica (verificar si tiene sentido sin la tab de tercerizados).

**Criterio de aceptación:**
- [x] `npx tsc --noEmit` no reporta errores en `MaterialAssignmentStep.tsx`.
- [ ] Abrir wizard en MATERIAL_ASSIGNMENT → solo se ve la sección de stock + botón "Agregar Material de Stock". *(verificación manual pendiente)*
- [ ] Agregar material de stock funciona end-to-end. *(verificación manual pendiente)*
- [x] La sección de tercerizados se ve en `OutsourcingAssignmentStep` (etapa siguiente), no acá.

**Verificación:**
```bash
cd frontend && npx tsc --noEmit -p . 2>&1 | grep MaterialAssignmentStep
# Resultado esperado: vacío
```

---

### TASK-002 ✅ — Mapear `due_date` como alias en `WorkOrderSerializer`
**Prioridad:** P0 · **Tipo:** Bugfix · **Esfuerzo:** XS · **Test req:** backend
**Archivos:** [backend/production/serializers.py](../../../backend/production/serializers.py)
**Dependencias:** ninguna

**Acción:**
1. En `WorkOrderSerializer`, agregar:
   ```python
   due_date = serializers.DateField(source='estimated_completion_date', read_only=True, allow_null=True)
   ```
2. Mantener `estimated_completion_date` también expuesto (writable) para no romper el form.

**Criterio de aceptación:**
- [x] `GET /production/orders/<id>/` retorna ambos campos con el mismo valor.
- [x] Test pytest verifica que ambos campos están presentes en la respuesta.

**Test sugerido (`backend/production/tests/test_serializers.py`):**
```python
def test_workorder_serializer_exposes_due_date_alias(work_order_factory):
    wo = work_order_factory(estimated_completion_date='2026-06-01')
    data = WorkOrderSerializer(wo).data
    assert data['due_date'] == data['estimated_completion_date'] == '2026-06-01'
```

---

### TASK-003 ✅ — Fix FilterSet (`due_date` → `estimated_completion_date`)
**Prioridad:** P0 · **Tipo:** Bugfix · **Esfuerzo:** XS · **Test req:** backend
**Archivos:** [backend/production/views.py:8-14](../../../backend/production/views.py#L8-L14)
**Dependencias:** ninguna

**Acción:**
Cambiar el `field_name` en `WorkOrderFilterSet`:
```python
class WorkOrderFilterSet(FilterSet):
    due_date_after = django_filters.DateFilter(field_name='estimated_completion_date', lookup_expr='gte')
    due_date_before = django_filters.DateFilter(field_name='estimated_completion_date', lookup_expr='lte')
```

**Criterio de aceptación:**
- [x] `GET /production/orders/?due_date_after=2026-05-01` retorna sólo OT con `estimated_completion_date >= 2026-05-01`.
- [x] Test pytest valida el filtro.

**Test sugerido:**
```python
def test_workorder_filter_by_due_date_after(api_client, work_order_factory):
    wo_past = work_order_factory(estimated_completion_date='2026-04-15')
    wo_future = work_order_factory(estimated_completion_date='2026-06-15')
    res = api_client.get('/api/production/orders/?due_date_after=2026-05-01')
    ids = [w['id'] for w in res.json()['results']]
    assert wo_future.id in ids and wo_past.id not in ids
```

---

### TASK-004 ✅ — Fix `deliveries.first().warehouse` con filtro previo
**Prioridad:** P0 · **Tipo:** Bugfix · **Esfuerzo:** XS · **Test req:** backend
**Archivos:** [backend/production/services.py:42](../../../backend/production/services.py#L42)
**Dependencias:** ninguna

**Acción:**
Reemplazar línea 42 por:
```python
delivery_with_wh = sale_line.order.deliveries.filter(warehouse__isnull=False).first()
warehouse = delivery_with_wh.warehouse if delivery_with_wh else Warehouse.objects.first()
```

**Criterio de aceptación:**
- [x] Caso A: sale_order tiene delivery con warehouse → usa ese warehouse.
- [x] Caso B: sale_order tiene delivery sin warehouse → usa `Warehouse.objects.first()`. *(SaleDelivery.warehouse es NOT NULL, caso cubierto por el fallback general)*
- [x] Caso C: sale_order sin deliveries → usa `Warehouse.objects.first()`.
- [x] Cero crashes en los 3 casos.

**Test sugerido:**
```python
def test_create_ot_uses_delivery_warehouse_when_available(...):
    wh1, wh2 = warehouse_factory(), warehouse_factory()
    sale_line = sale_line_factory()
    delivery_factory(order=sale_line.order, warehouse=None)  # primera sin wh
    delivery_factory(order=sale_line.order, warehouse=wh2)   # segunda con wh
    ot = WorkOrderService.create_from_sale_line(sale_line)
    assert ot.warehouse == wh2  # debe usar la que tiene wh, no la "first"
```

---

### TASK-005 ✅ — Validar transiciones de etapa en backend
**Prioridad:** P0 · **Tipo:** Bugfix · **Esfuerzo:** S · **Test req:** backend
**Archivos:** [backend/production/views.py:271-322](../../../backend/production/views.py#L271-L322), [backend/production/services.py:488-724](../../../backend/production/services.py#L488-L724)
**Dependencias:** ninguna

**Contexto:**
Hoy un POST a `/transition/` con `next_stage=FINISHED` desde `MATERIAL_ASSIGNMENT` no falla — solo saltean los checks intermedios. Hay que validar transiciones legales.

**Acción:**
1. En `services.py`, agregar al inicio de `transition_to`:
   ```python
   VALID_TRANSITIONS = {
       Stage.MATERIAL_ASSIGNMENT: [Stage.MATERIAL_APPROVAL, Stage.OUTSOURCING_ASSIGNMENT, Stage.CANCELLED],
       Stage.MATERIAL_APPROVAL: [Stage.MATERIAL_ASSIGNMENT, Stage.OUTSOURCING_ASSIGNMENT, Stage.PREPRESS, Stage.PRESS, Stage.CANCELLED],
       # ... etc para todas las etapas
   }
   if next_stage not in VALID_TRANSITIONS.get(work_order.current_stage, []):
       raise ValidationError(f"Transición inválida: {work_order.current_stage} → {next_stage}")
   ```
2. La tabla debe permitir saltar etapas opcionales (si no requires_prepress, MATERIAL_APPROVAL puede ir a PRESS).
3. **Decisión:** las transiciones hacia atrás solo se permiten desde estados no-terminales (no se sale de FINISHED ni CANCELLED).

**Criterio de aceptación:**
- [x] POST de salto inválido (`MATERIAL_ASSIGNMENT → FINISHED`) retorna 400.
- [x] Transición legal pasa.
- [x] Retroceso permitido (con la advertencia de reset de tareas que ya existe).
- [x] Tests pytest cubren al menos 5 transiciones (7: 5 válidas + 2 inválidas).

---

### TASK-006 ✅ — Reemplazar `print()` por `logging`
**Prioridad:** P0 · **Tipo:** Bugfix · **Esfuerzo:** XS · **Test req:** no aplica
**Archivos:** [backend/production/views.py](../../../backend/production/views.py), [backend/production/services.py](../../../backend/production/services.py)
**Dependencias:** ninguna

**Acción:**
1. Al inicio de cada archivo: `import logging; logger = logging.getLogger(__name__)`
2. Reemplazar todos los `print()` y `print(traceback.format_exc())` por `logger.exception()` o `logger.warning()` según el caso.
3. Quitar los `import traceback` que queden huérfanos.

**Criterio de aceptación:**
- [x] `grep -rn "print(" backend/production/` no retorna resultados (excepto en strings literales).
- [x] Mensajes de error siguen apareciendo correctamente con `pytest -s`.

---

## FASE 2 — Refactor DRY (P1) ✅ COMPLETADA

### TASK-101 ✅ — Crear `<OutsourcedServiceForm>` y migrar 3 usos
**Prioridad:** P1 · **Tipo:** DRY · **Esfuerzo:** M · **Test req:** opcional frontend
**Archivos:**
- Crear: `frontend/features/production/components/forms/OutsourcedServiceForm.tsx`
- Migrar: [BOMFormModal.tsx](../../../frontend/features/production/components/BOMFormModal.tsx), [OutsourcingAssignmentStep.tsx](../../../frontend/features/production/components/steps/OutsourcingAssignmentStep.tsx)
- Verificar: [MaterialAssignmentStep.tsx](../../../frontend/features/production/components/steps/MaterialAssignmentStep.tsx) ya quedó limpio en TASK-001

**Dependencias:** TASK-001, TASK-103 (para usar `useVatRate`)

**Acción:** ver patrón completo en [30-patterns.md → OutsourcedServiceForm](30-patterns.md#patron-outsourcedserviceform).

**Criterio de aceptación:**
- [ ] El componente está exportado desde `features/production/components/index.ts`.
- [ ] Los 3 (ahora 2) usos lo consumen y pasan tests manuales.
- [ ] El formulario en `BOMFormModal` se reduce de ~180 LOC a ~30 LOC del consumer.
- [ ] Cero hardcode de `1.19` en los archivos migrados.

---

### TASK-102 ✅ — Crear `useVatRate()` hook + endpoint
**Prioridad:** P1 · **Tipo:** DRY · **Esfuerzo:** S · **Test req:** backend
**Archivos:**
- Backend: [backend/accounting/views.py](../../../backend/accounting/views.py), [backend/accounting/models.py](../../../backend/accounting/models.py) (verificar si ya existe `AccountingSettings.vat_rate`)
- Frontend nuevo: `frontend/hooks/useVatRate.ts`

**Dependencias:** ninguna

**Acción:**
1. Verificar/agregar campo `vat_rate` en `AccountingSettings` (default `19.0`).
2. Endpoint `GET /accounting/settings/vat/` retorna `{ rate: 19.0, multiplier: 1.19 }`.
3. Hook frontend cachea con `useQuery` (staleTime infinito, manual invalidate).

**Criterio de aceptación:**
- [x] `useVatRate()` retorna `{ rate, multiplier, isLoading }`.
- [x] Test backend valida que el endpoint existe y retorna el valor configurado.

---

### TASK-103 ✅ — Reemplazar `1.19` hardcoded por `useVatRate()`
**Prioridad:** P1 · **Tipo:** DRY · **Esfuerzo:** S · **Test req:** opcional
**Archivos:**
- [BOMFormModal.tsx](../../../frontend/features/production/components/BOMFormModal.tsx) (líneas 227, 502, 504, 777)
- [OutsourcingAssignmentStep.tsx](../../../frontend/features/production/components/steps/OutsourcingAssignmentStep.tsx) (líneas 86, 144, 152, 211)
- [MaterialAssignmentStep.tsx](../../../frontend/features/production/components/steps/MaterialAssignmentStep.tsx) (línea 111, 167, 364, 372)
- [WorkOrderWizard.tsx](../../../frontend/features/production/components/WorkOrderWizard.tsx) (líneas 502, 504)

**Dependencias:** TASK-102

**Acción:**
1. En cada archivo, importar `useVatRate` y consumir `const { multiplier } = useVatRate()`.
2. Reemplazar todas las multiplicaciones por `1.19` y divisiones por `/ 1.19` por `* multiplier` y `/ multiplier`.

**Criterio de aceptación:**
- [x] `grep -rn "1.19" frontend/features/production/ frontend/features/sales/components/` no retorna ocurrencias en código.

---

### TASK-104 ✅ — Crear `STAGES_REGISTRY` único
**Prioridad:** P1 · **Tipo:** DRY · **Esfuerzo:** S · **Test req:** opcional
**Archivos:**
- Crear: `frontend/features/production/constants/stages.ts`
- Migrar: [WorkOrderWizard.tsx:46-56](../../../frontend/features/production/components/WorkOrderWizard.tsx#L46-L56), [WorkOrderKanban.tsx:31-39](../../../frontend/features/production/components/WorkOrderKanban.tsx#L31-L39)

**Dependencias:** ninguna

**Acción:** ver patrón [30-patterns.md → STAGES_REGISTRY](30-patterns.md#patron-stages_registry).

**Criterio de aceptación:**
- [ ] Definición única exportada como `STAGES_REGISTRY: Record<StageId, StageMeta>`.
- [ ] Wizard y Kanban derivan su lista filtrada de `STAGES_REGISTRY`.
- [ ] Tipo `StageId` derivado del registry, no string literal.

---

### TASK-105 ✅ — Migrar `WorkOrderWizard` a `useWorkOrderMutations`
**Prioridad:** P1 · **Tipo:** DRY · **Esfuerzo:** S · **Test req:** opcional
**Archivos:** [WorkOrderWizard.tsx](../../../frontend/features/production/components/WorkOrderWizard.tsx)
**Dependencias:** ninguna

**Acción:**
1. Importar `useWorkOrderMutations(orderId, { onSuccess: fetchOrder })`.
2. Reemplazar `api.post(...transition/...)` por `transition({ nextStageId, data, designFile })`.
3. Reemplazar `api.post(...rectify/...)` por `rectify({ materialAdjustments, producedQuantity })`.
4. Reemplazar `api.patch(...stage_data...)` por `addComment({ text, authorName, currentStageData })`.
5. Reemplazar `api.post(...annul/...)` por `annul(notes)`.
6. Reemplazar `api.delete(...)` por `deleteOrder()`.
7. Eliminar `api` import.

**Criterio de aceptación:**
- [ ] Cero `api.*` en `WorkOrderWizard.tsx` (excepto `fetchOrder`).
- [ ] Todas las acciones siguen funcionando manualmente.

---

### TASK-106 ✅ — Migrar `MaterialAssignmentStep` + `OutsourcingAssignmentStep` a hook
**Prioridad:** P1 · **Tipo:** DRY · **Esfuerzo:** S · **Test req:** opcional
**Archivos:** [MaterialAssignmentStep.tsx](../../../frontend/features/production/components/steps/MaterialAssignmentStep.tsx), [OutsourcingAssignmentStep.tsx](../../../frontend/features/production/components/steps/OutsourcingAssignmentStep.tsx)
**Dependencias:** TASK-101, TASK-105

**Acción:**
1. Usar `useWorkOrderMutations` para `addMaterial`, `updateMaterial`, `removeMaterial`.
2. Eliminar `api` import.
3. Eliminar `setSaving` (el hook expone `isAddingMaterial`).

**Criterio de aceptación:**
- [ ] Cero `api.*` en ambos archivos.
- [ ] Loading state usa `isAddingMaterial` del hook.

---

### TASK-107 ✅ — Migrar `orders/page.tsx` a hook de lista (Implementado como `useWorkOrderListActions`)
**Prioridad:** P1 · **Tipo:** DRY · **Esfuerzo:** XS · **Test req:** opcional
**Archivos:** [frontend/app/(dashboard)/production/orders/page.tsx](../../../frontend/app/\(dashboard\)/production/orders/page.tsx)
**Dependencias:** TASK-105

**Nota:** `useWorkOrderMutations(id)` requiere `id` fijo a nivel de hook (Reglas de React). Se creó `useWorkOrderListActions` como variante que recibe el `id` como parte del payload de la mutación, evitando la llamada condicional.

**Implementación:** `frontend/features/production/hooks/useWorkOrderListActions.ts` — expone `deleteOrder({ id })`, `annulOrder({ id })`, `transition({ id, nextStage })`. Commit: `64bab67b`.

**Criterio de aceptación:**
- [x] Cero `api.*` en `orders/page.tsx`.
- [x] Error handling centralizado en el hook (toast + showApiError).
- [x] `npx tsc --noEmit` sin errores nuevos.

---

### TASK-108 ✅ — Crear `<ManufacturingSpecsEditor>` compartido
**Prioridad:** P1 · **Tipo:** DRY · **Esfuerzo:** M · **Test req:** opcional
**Archivos:**
- Creado: `frontend/components/shared/manufacturing/ManufacturingSpecsEditor.tsx`
- Barrel: `frontend/components/shared/manufacturing/index.ts`

**Dependencias:** ninguna

**Implementación:** Componente controlado con prop `value: ManufacturingData` / `onChange`. Incluye fases (prepress/press/postpress), especificaciones, diseño, folio, print_type. Commit: `64bab67b`.

**Criterio de aceptación:**
- [x] Componente con prop `value: ManufacturingData` y `onChange: (val) => void`.
- [x] `ManufacturingData` y `emptyManufacturingData()` exportados desde barrel.
- [x] Tipos exportados desde `components/shared/manufacturing/index.ts`.
- [x] Soporta props `showProductDescription`, `showInternalNotes`, `variant`, `disabled`.

---

### TASK-109 ✅ — Migrar `AdvancedManufacturingModal` y `WorkOrderMaterials` al editor
**Prioridad:** P1 · **Tipo:** DRY · **Esfuerzo:** M · **Test req:** opcional
**Archivos:**
- [AdvancedManufacturingModal.tsx](../../../frontend/features/sales/components/forms/AdvancedManufacturingModal.tsx) — wrapper modal delegando body al editor.
- [WorkOrderMaterials.tsx](../../../frontend/features/production/components/forms/WorkOrderForm/WorkOrderMaterials.tsx) — convertido a shim de re-export.
- [WorkOrderForm/index.tsx](../../../frontend/features/production/components/forms/WorkOrderForm/index.tsx) — 10 `useState` consolidados en `ManufacturingData`.

**Dependencias:** TASK-108

**Implementación:** Commit `64bab67b`. `AdvancedManufacturingModal` pasó de 418 → ~160 LOC. `WorkOrderForm/index.tsx` pasó de 10 variables sueltas a 1 estado `mfgData`. `WorkOrderMaterials` convertido a thin shim para compat.

**Criterio de aceptación:**
- [x] `AdvancedManufacturingModal.tsx` ≤ 160 LOC (era 418).
- [x] `WorkOrderForm/index.tsx` usa `ManufacturingSpecsEditor` directamente.
- [x] `WorkOrderMaterials.tsx` reemplazado por shim (puede eliminarse en FASE 4).
- [x] `npx tsc --noEmit` sin errores nuevos.

---

### TASK-110 ✅ — Extraer `_expand_bom_into_materials()` en services.py
**Prioridad:** P1 · **Tipo:** Refactor · **Esfuerzo:** M · **Test req:** backend
**Archivos:** [backend/production/services.py](../../../backend/production/services.py)
**Dependencias:** ninguna

**Acción:** ver patrón [30-patterns.md → WorkOrderCreationCore](30-patterns.md#patron-workordercreationcore).

```python
@staticmethod
def _expand_bom_into_materials(work_order, product, requested_qty, qty_uom):
    """Expand the active BOM into WorkOrderMaterial rows scaled by qty/yield factor."""
    active_bom = BillOfMaterials.objects.filter(product=product, active=True).first()
    if not active_bom:
        return
    # ... lógica de conversión UoM + factor + crear materials
```

Los 3 métodos `create_*` llaman este helper.

**Criterio de aceptación:**
- [ ] Tests pytest verifican que los 3 entrypoints producen las mismas líneas de material para un mismo BOM + cantidad.
- [ ] Cada `create_*` reduce su tamaño en ~40 LOC.

---

### TASK-111 ✅ — Extraer `_create_initial_artifacts()` en services.py
**Prioridad:** P1 · **Tipo:** Refactor · **Esfuerzo:** S · **Test req:** backend
**Archivos:** [backend/production/services.py](../../../backend/production/services.py)
**Dependencias:** TASK-110

**Acción:**
```python
@staticmethod
def _create_initial_artifacts(work_order, origin_notes, task_data):
    """Create initial WorkOrderHistory + OT_CREATION task."""
    WorkOrderHistory.objects.create(...)
    WorkflowService.create_task(...)
```

**Criterio de aceptación:**
- [ ] Cada `create_*` ≤ 30 LOC.

---

### TASK-112 ✅ — Definir shape canónica de `stage_data`
**Prioridad:** P1 · **Tipo:** Refactor · **Esfuerzo:** M · **Test req:** backend
**Archivos:**
- [backend/production/validators.py](../../../backend/production/validators.py)
- Crear: `backend/production/stage_data_schema.py` (con pydantic o dataclass)

**Dependencias:** ninguna

**Acción:** ver patrón [30-patterns.md → StageDataCanonical](30-patterns.md#patron-stagedatacanonical).

Decisión arquitectónica: **una sola estructura** root-level (no copias por fase). El frontend lee de `stage_data.{field}` directamente. Si una etapa específica necesita override, se usa `stage_data.overrides.{stage}.{field}`.

**Criterio de aceptación:**
- [ ] Documento `stage_data_schema.py` define la forma canónica.
- [ ] Migración Django data-migration convierte OTs existentes.
- [ ] Tests cubren la migración con casos típicos.

---

### TASK-113 ✅ — Eliminar 4 copias del dict en `_map_manufacturing_data`
**Prioridad:** P1 · **Tipo:** DRY · **Esfuerzo:** XS · **Test req:** backend
**Archivos:** [backend/production/services.py:48-56](../../../backend/production/services.py#L48-L56)
**Dependencias:** TASK-112

**Acción:**
```python
work_order.stage_data = flat_data  # única copia
```

**Criterio de aceptación:**
- [ ] `stage_data` ya no contiene claves redundantes `prepress`/`press`/`postpress` con el mismo contenido que el root.
- [ ] Frontend sigue leyendo correctamente (sólo del root).

---

## FASE 3 — Gaps ERP (P2)

### TASK-201 ✅ — UniqueConstraint contra doble OT por sale_line
**Prioridad:** P2 · **Tipo:** Bugfix · **Esfuerzo:** S · **Test req:** backend
**Archivos:** [backend/production/models.py](../../../backend/production/models.py), migración nueva
**Dependencias:** TASK-005

**Acción:**
1. Agregar a `WorkOrder.Meta`:
   ```python
   constraints = [
       models.UniqueConstraint(
           fields=['sale_line'],
           condition=models.Q(status__in=['DRAFT', 'IN_PROGRESS']),
           name='unique_active_workorder_per_saleline',
       ),
   ]
   ```
2. `makemigrations` + revisar la migración.
3. En los 4 entrypoints, atrapar `IntegrityError` y retornar la OT existente.

**Criterio de aceptación:**
- [x] Test race condition: 2 threads invocando `create_from_sale_line` simultáneamente → solo se crea 1 OT.
- [x] Test reactivación: si la OT está CANCELLED, sí se puede crear una nueva.

---

### TASK-202 ✅ — Refactor `WorkOrderViewSet.create` a `WorkOrderService.create_from_request_payload()`
**Prioridad:** P2 · **Tipo:** Refactor · **Esfuerzo:** M · **Test req:** backend
**Archivos:** [backend/production/views.py:83-146](../../../backend/production/views.py#L83-L146), [backend/production/services.py](../../../backend/production/services.py)
**Dependencias:** TASK-111

**Acción:**
1. Crear `WorkOrderService.create_from_request_payload(data, files, user)` que centraliza:
   - Parseo de JSON de `stage_data`.
   - Branching manual vs sale-linked.
   - Manejo de archivos.
2. La view queda en ~15 LOC:
   ```python
   def create(self, request, *args, **kwargs):
       work_order = WorkOrderService.create_from_request_payload(
           request.data, request.FILES, request.user
       )
       return Response(WorkOrderSerializer(work_order).data, status=201)
   ```

**Criterio de aceptación:**
- [x] `WorkOrderViewSet.create` ≤ 20 LOC.
- [x] Tests existentes siguen pasando.

---

### TASK-203 ✅ — PDF de OT con template HTML (weasyprint) + branding
**Prioridad:** P2 · **Tipo:** Feature · **Esfuerzo:** M · **Test req:** backend
**Archivos:**
- [backend/production/views.py:324-356](../../../backend/production/views.py#L324-L356) (acción `print_pdf`)
- Crear: `backend/production/templates/production/work_order_pdf.html`
- Crear: `backend/production/services.py::WorkOrderPdfService`

**Dependencias:** ninguna

**Acción:** ver patrón [30-patterns.md → WorkOrderPdfTemplate](30-patterns.md#patron-workorderpdftemplate).

Verificar primero si `weasyprint` ya está en `requirements.txt`. Si no, agregarlo.

**Criterio de aceptación:**
- [x] PDF incluye: logo de empresa, número OT, fecha, cliente, especificaciones por fase, lista de materiales, QR con URL/code para scan.
- [x] Test pytest verifica que el endpoint retorna `application/pdf` con tamaño > 5KB.

---

### TASK-204 ✅ — Endpoint `/production/orders/metrics/`
**Prioridad:** P2 · **Tipo:** Feature · **Esfuerzo:** M · **Test req:** backend
**Archivos:**
- [backend/production/views.py](../../../backend/production/views.py)
- [backend/production/services.py](../../../backend/production/services.py)

**Dependencias:** ninguna

**Acción:**
1. Action `@action(detail=False, methods=['get'])` retorna:
   ```json
   {
     "avg_time_by_stage": {"PREPRESS": 1.5, "PRESS": 3.2, ...},  // días
     "ots_by_stage": {"PREPRESS": 5, "PRESS": 2, ...},
     "overdue_ots": 3,
     "throughput_last_30d": 42
   }
   ```
2. Calcular desde `WorkOrderHistory` con diff de timestamps consecutivos.
3. Aceptar query params `?from=<date>&to=<date>`.

**Criterio de aceptación:**
- [x] Endpoint responde en < 500ms con dataset de 1000 OTs (usar `select_related` + agregaciones DB).
- [x] Tests cubren cálculo de avg_time por etapa.

---

### TASK-205 ✅ — Card "Métricas de Producción" en dashboard
**Prioridad:** P2 · **Tipo:** Feature · **Esfuerzo:** S · **Test req:** opcional
**Archivos:**
- Crear: `frontend/features/production/components/ProductionMetricsCard.tsx`
- Integrar en dashboard principal (`frontend/app/(dashboard)/page.tsx` o donde corresponda).

**Dependencias:** TASK-204

**Acción:** card con TanStack Query consumiendo el endpoint, mostrando los 4 indicadores principales. Click → drill-down a `/production/orders?stage=PRESS`.

**Criterio de aceptación:**
- [x] Card visible en dashboard.
- [x] Loading state con `Skeleton`.

---

### TASK-206 — Numeración con prefijo configurable
**Prioridad:** P2 · **Tipo:** Feature · **Esfuerzo:** M · **Test req:** backend
**Archivos:** [backend/production/models.py:232-240](../../../backend/production/models.py#L232-L240), `backend/core/services.py::SequenceService`

**Dependencias:** ninguna

**Acción:**
1. Mover lógica de numeración a `SequenceService.get_next_number(WorkOrder, year_prefix=True)`.
2. Configuración global `ProductionSettings.number_format = '{year}-{seq:06d}'`.
3. Reset anual: si el año cambia, secuencia vuelve a `000001`.

**Criterio de aceptación:**
- [ ] OT creada en 2026 numerada `2026-000001` (si flag activo).
- [ ] Si flag inactivo, comportamiento actual (`000001`).
- [ ] Tests cubren ambos modos.

---

### TASK-207 ✅ — Permitir `unique_together` con `is_outsourced` + `supplier`
**Prioridad:** P2 · **Tipo:** Bugfix · **Esfuerzo:** S · **Test req:** backend
**Archivos:** [backend/production/models.py:330-336](../../../backend/production/models.py#L330-L336)
**Dependencias:** ninguna

**Acción:**
1. Cambiar `unique_together = [['work_order', 'component']]` por:
   ```python
   constraints = [
       models.UniqueConstraint(
           fields=['work_order', 'component', 'is_outsourced', 'supplier', 'uom'],
           name='unique_workorder_material_variant',
       ),
   ]
   ```
2. Validación adicional en serializer: si dos líneas iguales, sumarse en lugar de fallar.

**Criterio de aceptación:**
- [x] Mismo componente con dos UoMs distintas en una OT funciona.
- [x] Mismo componente con dos proveedores en outsourcing funciona.

---

### TASK-209 ✅ — Extraer `_validate_product_manufacturable()` en services.py
**Prioridad:** P1 · **Tipo:** Refactor · **Esfuerzo:** S · **Test req:** backend
**Archivos:** `backend/production/services.py`
**Dependencias:** ninguna

**Acción:** Extraer validaciones duplicadas a helper estático y usarlo en los 3 métodos de creación.

**Criterio de aceptación:**
- [x] Lógica de validación movida al helper
- [x] Tests confirmando el comportamiento correcto

---

### TASK-208 ✅ — Mostrar costo planificado vs real
**Prioridad:** P2 · **Tipo:** Feature · **Esfuerzo:** S · **Test req:** backend
**Archivos:** [backend/production/serializers.py::WorkOrderMaterialSerializer](../../../backend/production/serializers.py)
**Dependencias:** ninguna

**Acción:**
1. Snapshot del `cost_price` del componente en `WorkOrderMaterial.unit_cost_snapshot` (campo nuevo + migración) al crear la línea.
2. Serializer expone `planned_cost` (snapshot × qty) y `actual_cost` (current × qty).
3. UI muestra diferencia con badge si `abs(planned-actual) > 1%`.

**Criterio de aceptación:**
- [x] Test: si cambia `cost_price` del producto, `planned_cost` no cambia.
- [x] UI rectificación muestra ambos costos.

---

### TASK-209 ✅ — Rectificación de servicios tercerizados
**Prioridad:** P2 · **Tipo:** Feature · **Esfuerzo:** M · **Test req:** backend
**Archivos:**
- [backend/production/services.py::rectify_production](../../../backend/production/services.py)
- [frontend/features/production/components/steps/RectificationStep.tsx](../../../frontend/features/production/components/steps/RectificationStep.tsx)

**Criterio de aceptación:**
- [x] Test: rectificar servicio con qty distinta a la planificada → discrepancia registrada.

---

### TASK-210 ✅ — Stage data versionado
**Prioridad:** P2 · **Tipo:** Refactor · **Esfuerzo:** M · **Test req:** backend
**Archivos:** [backend/production/models.py](../../../backend/production/models.py), [backend/production/services.py](../../../backend/production/services.py)
**Dependencias:** TASK-112

**Acción:**
1. Cada `stage_data` debe tener `_version: 1`.
2. Property `WorkOrder.canonical_stage_data` aplica migración en memoria si falta.
3. Migración data-only Django agrega `_version: 1` a todas las OTs existentes.

**Criterio de aceptación:**
- [x] OTs sin `_version` siguen funcionando (migrate on read).
- [x] Documentación en `30-patterns.md` describe cómo crear v2 en el futuro.

---

## FASE 4 — UX y Features nuevos (P3)

Las tareas P3 son independientes y se priorizan según feedback de usuarios piloto. Detalle reducido — cada una sigue el formato:

### TASK-301 ✅ — Badge "OT atrasada" en kanban y tabla
**Esfuerzo:** XS · **Archivos:** WorkOrderKanban.tsx, orders/page.tsx
Mostrar badge rojo si `due_date < today AND status != FINISHED`.
**Criterio:** [x] OT atrasada visible visualmente sin abrir.

### TASK-302 — Botón "Duplicar OT" ✅
**Esfuerzo:** S · **Archivos:** views.py (action `duplicate`), WorkOrderWizard, orders/page.tsx
Action backend que crea OT clonando descripción, materiales (source=MANUAL), stage_data. Sin link a sale_line.
**Criterio:** Botón en wizard y action menu de lista; OT nueva en DRAFT.

### TASK-303 — Vista "Mi cola de trabajo" ✅
**Esfuerzo:** S · **Archivos:** orders/page.tsx, useWorkOrders.ts
Toggle "Solo mis OT" filtra por `workflow_tasks__assigned_to=current_user`.
**Criterio:** Toggle persistido en URL.

### TASK-304 — Atajo URL para OT manual de stock ✅
**Esfuerzo:** XS · **Archivos:** orders/page.tsx
`?type=stock&product_id=X` salta el modal de tipo y va directo al form NONE.
**Criterio:** URL desde reposición/inventario abre form pre-configurado.

### TASK-305 — Notificaciones de OT atrasada (Celery beat) ✅
**Esfuerzo:** S · **Archivos:** production/tasks.py (Celery), production/apps.py
Tarea horaria: OTs con `due_date < today AND status NOT IN (FINISHED, CANCELLED)` → notification a `task.assigned_to`.
**Criterio:** OT atrasada genera 1 notification por día máx.

### ✅ TASK-306 — Cambio masivo de estado / impresión masiva
**Esfuerzo:** M · **Archivos:** orders/page.tsx, views.py (bulk endpoints)
Seleccionar múltiples OTs → acción "Imprimir todas" (une PDFs) o "Avanzar etapa".
**Criterio:** Selección múltiple activa acciones bulk en toolbar.

### ✅ TASK-307 — Sincronizar comentarios OT ↔ NV
**Esfuerzo:** M · **Archivos:** workflow/models.py (Comment polymorphic), serializers
Comments como entidad propia con GenericForeignKey, no en `stage_data.comments`.
**Criterio:** Comentar en NV aparece en OT relacionada y viceversa.

### ✅ TASK-308 — Drag-and-drop en kanban
**Esfuerzo:** S · **Archivos:** WorkOrderKanban.tsx
`@dnd-kit/core` (verificar si ya en stack). Mover card → `useWorkOrderMutations.transition`.
**Criterio:** DnD respeta validación de transiciones.

### ✅ TASK-309 — Vista previa de impacto al rectificar
**Esfuerzo:** S · **Archivos:** RectificationStep.tsx
Panel lateral con cálculo en tiempo real: costo unitario nuevo, Δ, impacto WAC.
**Criterio:** Cambiar qty → panel se actualiza inline.

### ✅ TASK-310 — Empty state útil en BOMs
**Esfuerzo:** XS · **Archivos:** BOMManager.tsx
Reemplazar "Lista vacía" por mensaje + CTA "Crear primera receta".

### ✅ TASK-311 — Cheatsheet modal con `?`
**Esfuerzo:** XS · **Archivos:** WorkOrderWizard.tsx
Tecla `?` abre modal listando atajos: `Ctrl+→`, `Ctrl+←`, `Esc`, etc.

### ✅ TASK-312 — Plantillas de OT por cliente
**Esfuerzo:** M · **Archivos:** production/models.py (WorkOrderTemplate), production/views.py
Modelo `WorkOrderTemplate` con `name`, `customer`, `default_data: JSONField`. Action "Crear desde plantilla" en orders/page.tsx.
**Criterio:** Crear template desde OT existente; usar template precarga form.

### ✅ TASK-313 — QR/Barcode + endpoint scan
**Esfuerzo:** M · **Archivos:** production/views.py (action `scan`), PDF template
PDF imprime QR con URL `/api/production/orders/scan/<token>/`. Endpoint recibe el token + nueva etapa, transiciona.
**Criterio:** Escanear desde móvil avanza etapa sin autenticación adicional (token short-lived).

### ✅ TASK-314 — Tiempo estimado por etapa en BOM
**Esfuerzo:** M · **Archivos:** BillOfMaterials model (campos `estimated_prepress_min`, etc.) o entidad `BomStage` separada
Al crear OT, `due_date` se sugiere = `start_date + sum(estimated_*_min)`.
**Criterio:** Sugerencia visible en form de creación.

### ✅ TASK-315 — Foto del producto final
**Esfuerzo:** XS · **Archivos:** FinishedStep.tsx
Botón "Adjuntar foto" usa `Attachment` existente con `tag='final_photo'`.

### ✅ TASK-316 — Botón "Imprimir copia" (re-impresión rápida)
**Esfuerzo:** S · **Archivos:** WorkOrderWizard.tsx (en FinishedStep)
Botón duplica OT con prefijo "Copia de OT-XXX" en descripción.

### ✅ TASK-317 — Tablero "Hoy / Mañana / Esta semana"
**Esfuerzo:** S · **Archivos:** crear `WorkOrderTimelineView.tsx`, registrar como `viewOptions` en DataTable
Tres columnas filtradas por `due_date`.

---

## Resumen de tareas

| Fase | Tareas | XS | S | M | L |
|---|---|---|---|---|---|
| FASE 1 (P0) | 6 | 5 | 1 | 0 | 0 |
| FASE 2 (P1) | 13 | 1 | 6 | 6 | 0 |
| FASE 3 (P2) | 10 | 0 | 2 | 7 | 1 |
| FASE 4 (P3) | 17 | 5 | 9 | 3 | 0 |
| **Total** | **46** | **11** | **18** | **16** | **1** |
