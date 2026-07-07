# 00 — Reporte de Auditoría: Módulo de Producción

> Auditoría hecha en 2026-05-15 sobre ~2.764 LOC backend + ~5.798 LOC frontend. Cubre creación de OT (4 entrypoints), gestión por etapas, BOM, rectificación, tercerización y finalización con WAC.

---

## 1. Bugs críticos (P0 — parchar antes de cualquier otra cosa)

### 1.1 `MaterialAssignmentStep.tsx` no compila en TypeScript
**Archivo:** [frontend/features/production/components/steps/MaterialAssignmentStep.tsx:51-91](../../../frontend/features/production/components/steps/MaterialAssignmentStep.tsx#L51-L91)

El componente referencia `setSupplierId`, `setGrossPrice`, `setNetPrice`, `setDocumentType`, `setSaving`, `supplierId`, `grossPrice`, `netPrice`, `documentType`, `saving` — **ninguno está declarado con `useState`**. Confirmado vía `tsc --noEmit`: 23 errores TS2304 ("Cannot find name") en este archivo.

**Impacto:** la tab "tercerizados" embebida en el step de asignación de materiales está rota en runtime.

**Origen probable:** refactor incompleto — la lógica de outsourcing fue movida a `OutsourcingAssignmentStep.tsx` pero quedó código zombie en `MaterialAssignmentStep` que ahora ya no debería estar.

### 1.2 FilterSet apunta a campo inexistente
**Archivo:** [backend/production/views.py:8-14](../../../backend/production/views.py#L8-L14)

```python
due_date_after = django_filters.DateFilter(field_name='due_date', lookup_expr='gte')
```
El modelo tiene `estimated_completion_date`, no `due_date`. Los filtros pasan silenciosamente sin filtrar.

### 1.3 Frontend lee `order.due_date` (no existe en el serializer)
**Archivos:** [WorkOrderKanban.tsx:125](../../../frontend/features/production/components/WorkOrderKanban.tsx#L125), [orders/page.tsx:165-170](../../../frontend/app/\(dashboard\)/production/orders/page.tsx#L165-L170), [WorkOrderForm/index.tsx:111](../../../frontend/features/production/components/forms/WorkOrderForm/index.tsx#L111)

Todas las columnas "Fecha Entrega" muestran `—` o `undefined`. **Decisión tomada (ver README):** exponer `due_date` como alias readonly en el serializer apuntando a `estimated_completion_date`.

### 1.4 `transition` permite saltos arbitrarios
**Archivo:** [backend/production/views.py:288-295](../../../backend/production/views.py#L288-L295)

```python
for choice, label in WorkOrder.Stage.choices:
    if choice == next_stage:
        stage_match = choice
```
Sólo valida que la clave exista en el enum, no que la transición sea válida desde la etapa actual. El service tiene checks dispersos (approvals pending, stock, etc.) pero permite, por ejemplo, ir de `MATERIAL_ASSIGNMENT` directamente a `FINISHED` saltándose la cadena.

### 1.5 `annul_work_order` documenta lo que no hace
**Archivo:** [backend/production/services.py:401-486](../../../backend/production/services.py#L401-L486)

Docstring dice "reverses stock movements" pero el método solo cancela POs y marca la OT como cancelada. En la práctica, la VALIDATION 2 ya bloquea anular si hay consumos, así que el comportamiento es correcto — pero el docstring miente y desorienta al lector.

### 1.6 `sale_line.order.deliveries.first().warehouse` puede crashear
**Archivo:** [backend/production/services.py:42](../../../backend/production/services.py#L42)

```python
warehouse = sale_line.order.deliveries.first().warehouse if sale_line.order.deliveries.filter(warehouse__isnull=False).exists() else Warehouse.objects.first()
```
El `.first()` no aplica el filtro `warehouse__isnull=False` (lo aplica un check separado con `.exists()`). Si el primer delivery por `Meta.ordering` no tiene warehouse, hace `None.warehouse` → AttributeError.

---

## 2. Violaciones DRY mayores (P1)

### 2.1 Tres copias del formulario "Servicio Tercerizado"

| Ubicación | Líneas |
|---|---|
| [BOMFormModal.tsx:786-963](../../../frontend/features/production/components/BOMFormModal.tsx#L786-L963) | ~180 |
| [MaterialAssignmentStep.tsx:132-189](../../../frontend/features/production/components/steps/MaterialAssignmentStep.tsx#L132-L189) | ~60 (rotas, ver 1.1) |
| [OutsourcingAssignmentStep.tsx:178-234](../../../frontend/features/production/components/steps/OutsourcingAssignmentStep.tsx#L178-L234) | ~60 |

Mismo set de campos (servicio, proveedor, cantidad, UoM, precio bruto, documento), misma conversión bruto/neto al 1.19 hardcoded, mismas validaciones. **Solución:** ver [30-patterns.md → OutsourcedServiceForm](30-patterns.md#patron-outsourcedserviceform).

### 2.2 Tres `create_*` en services.py con duplicación masiva
**Archivo:** [backend/production/services.py:19-397](../../../backend/production/services.py#L19-L397)

`create_from_sale_line`, `create_manual` y `create_ot_for_delivery_line` duplican:
- Validación `requires_bom_validation` (×3)
- Expansión BOM con conversión UoM (×3)
- Creación de `WorkOrderHistory` inicial (×3)
- Tarea `OT_CREATION` (×3)
- Branch de auto-finalize (×2, idéntico)

**Solución:** extraer `_expand_bom_into_materials()` y `_create_initial_artifacts()`. Ver [30-patterns.md → WorkOrderCreationCore](30-patterns.md#patron-workordercreationcore).

### 2.3 Hook `useWorkOrderMutations` existe pero nadie lo usa
**Archivo:** [hooks/useWorkOrderMutations.ts](../../../frontend/features/production/hooks/useWorkOrderMutations.ts) (242 LOC)

Centraliza `transition`, `rectify`, `addMaterial`, `updateMaterial`, `removeMaterial`, `annul`, `deleteOrder`, `addComment` con cache invalidation. **Pero:**
- `WorkOrderWizard.tsx` hace 5+ `api.post`/`api.delete` directos.
- `MaterialAssignmentStep.tsx`, `OutsourcingAssignmentStep.tsx` también.
- `orders/page.tsx` también.

**Viola la regla #4 de [CLAUDE.md](../../../CLAUDE.md):** "No `useQuery`/`useMutation` directamente en componentes". Extensible a `api.*` directo.

### 2.4 Configuración de fases duplicada en 3 lugares
La estructura "switches prepress/press/postpress + textareas de specs + folio + design_files + print_type" aparece en:
- [`AdvancedManufacturingModal.tsx`](../../../frontend/features/sales/components/forms/AdvancedManufacturingModal.tsx) — 417 LOC (sales/checkout)
- [`WorkOrderMaterials.tsx`](../../../frontend/features/production/components/forms/WorkOrderForm/WorkOrderMaterials.tsx) — 252 LOC (production/form)
- Hardcoded en `WorkOrderForm/index.tsx` state local (~10 `useState`)

**Solución:** ver [30-patterns.md → ManufacturingSpecsEditor](30-patterns.md#patron-manufacturingspecseditor).

### 2.5 `manufacturing_data` ↔ `stage_data` con 4 copias del mismo dict
**Archivo:** [backend/production/services.py:48-56](../../../backend/production/services.py#L48-L56)

```python
work_order.stage_data = {
    'prepress': flat_data,   # copia 1
    'press': flat_data,      # copia 2
    'postpress': flat_data,  # copia 3
    **flat_data              # copia 4 en root
}
```
Comentario: "for backward compat / wizard compat". Si una se actualiza y otra no, hay drift silencioso.

### 2.6 Tres listas de `Stage` distintas
| Lugar | Entradas |
|---|---|
| [models.py:18-28](../../../backend/production/models.py#L18-L28) | 11 (canónica) |
| [WorkOrderWizard.tsx:46-56](../../../frontend/features/production/components/WorkOrderWizard.tsx#L46-L56) | 10 |
| [WorkOrderKanban.tsx:31-39](../../../frontend/features/production/components/WorkOrderKanban.tsx#L31-L39) | 7 |

Agregar una etapa nueva implica tocar 3 lugares. **Solución:** ver [30-patterns.md → STAGES_REGISTRY](30-patterns.md#patron-stages_registry).

### 2.7 IVA `1.19` hardcoded en 8+ sitios
Frontend: `BOMFormModal`, `MaterialAssignmentStep`, `OutsourcingAssignmentStep`, `WorkOrderWizard` (PO preview), etc. Si IVA cambia o un cliente factura exento, hay que tocar todos los archivos. **Debe leerse de `AccountingSettings.vat_rate`.**

### 2.8 `MaterialAssignmentStep` y `OutsourcingAssignmentStep` duplican la mitad del componente
Mismo `<OutsourcedForm>` (que en `MaterialAssignmentStep` está roto), misma lógica `handleEdit`, `handleDelete`, mismo `reset()`. Si se aplica el patrón `OutsourcedServiceForm` correctamente, `MaterialAssignmentStep` queda solo con la lógica de materiales de stock.

---

## 3. Gaps de buenas prácticas ERP (P2)

### 3.1 Sin patrón configurable de numeración de OT
[models.py:232-240](../../../backend/production/models.py#L232-L240): `000001`, `000002`. Falta prefijo por año (`2026-000123`), reset anual, captura manual desde migración.

### 3.2 Servicios tercerizados no rectifican
`finalize_production` consume planificado siempre que no haya rectificación. Y la rectificación solo aplica a materiales de stock — la UI lo dice explícito. Si el proveedor entregó menos cantidad, el costo queda inflado y no aparece como discrepancia.

### 3.3 No hay lock contra dobles OT por `sale_line`
`create_from_sale_line` se invoca desde 4 entrypoints (signal, sales/checkout, billing/note, views). El check `if not line.work_orders.exists()` está solo en el signal. Race conditions producen 2 OT.

**Solución:** `UniqueConstraint(fields=['sale_line'], condition=Q(status__in=['DRAFT','IN_PROGRESS']))`.

### 3.4 PDF generado con `reportlab.canvas` plano
[views.py:324-356](../../../backend/production/views.py#L324-L356): `p.drawString(100, 800, ...)`. Sin logo, sin código QR, sin specs técnicas legibles. Para una imprenta este PDF **es** el documento de taller.

**Solución:** migrar a `weasyprint` con template HTML. Ver [30-patterns.md → WorkOrderPdfTemplate](30-patterns.md#patron-workorderpdftemplate).

### 3.5 `print()` y `print(traceback.format_exc())` como logging
[views.py:144-145, 191, 508](../../../backend/production/views.py#L144) y varios en `services.py`. Reemplazar por `logging.getLogger(__name__).exception(...)`.

### 3.6 `views.py` infringe regla "views ≤ 20 líneas"
El `create` de [views.py:83-146](../../../backend/production/views.py#L83-L146) tiene 64 líneas, hace parsing manual de JSON, branching por tipo, manejo de archivos. Mover a `WorkOrderService.create_from_request_payload()`.

### 3.7 `WorkOrderMaterial.unique_together = [['work_order', 'component']]` impide casos legítimos
Si receta usa el mismo componente con dos UoMs (kg vs g) o dos proveedores en outsourcing, choca. Considerar agregar `is_outsourced`, `supplier` y `uom` al unique_together.

### 3.8 Costo planificado vs real no se distingue
`WorkOrderMaterialSerializer.get_total_cost` siempre usa `cost_actual_del_componente`. Si entre planificar y fabricar el papel sube de precio, el "costo total" pintado en pantalla diverge del JournalEntry final.

### 3.9 `stage_data` JSONField sin versión ni esquema
Cada OT vieja puede tener forma distinta. Frontend hace `?.` en todas partes. Agregar `stage_data._version: 1` y migrar al leer.

### 3.10 Sin métricas de tiempo por etapa
`WorkOrderHistory` tiene timestamps suficientes para computar "tiempo promedio en prepress", "OTs > N días en cola". Faltan endpoint `/production/orders/metrics/` y card en dashboard. Es **el** KPI fundamental de una imprenta.

---

## 4. Oportunidades UX/UI (P3 — alto valor, bajo esfuerzo)

### 4.1 Botón "Duplicar OT"
La BOM ya tiene Clonar. Replicar el patrón en OT. Caso de uso: fabrica 5.000 tarjetas iguales para Cliente A, mañana Cliente B pide lo mismo.

### 4.2 Cambio masivo de estado / impresión masiva
Seleccionar N OTs en DataTable → "imprimir todas" / "marcar como en prensa".

### 4.3 Vista "Mi cola de trabajo"
Toggle `mode=mine` filtrando por `task.assigned_to == current_user`.

### 4.4 Atajo para OT manual de stock
`/production/orders/new?type=stock&product_id=X` salta el modal de tipo. Mantener el modal para el caso general.

### 4.5 Notificaciones de OT atrasada
Celery beat horario: OT con `due_date < today AND status != FINISHED` → notification al responsable. Reusar `workflow.Notification`.

### 4.6 Badge "atrasada" en kanban/tabla
`due_date < today AND status != FINISHED` → badge rojo. UI pura, sin lógica nueva.

### 4.7 Sincronizar comentarios entre OT y NV
`stage_data.comments` solo se ve en la OT. Si vendedor anota en NV "cliente pidió cambio a las 11am", producción no lo ve. Posibilidad: feed unificado por `related_contact + sale_order`.

### 4.8 Drag-and-drop en kanban
Mover card entre columnas dispara `handleTransition` con validación previa. Usar `@dnd-kit/core` (probablemente ya en el stack).

### 4.9 Vista previa de impacto al rectificar
Mientras edita cantidades reales en `RectificationStep`, mostrar inline:
- Nuevo costo unitario
- Δ vs planificado
- Impacto en WAC del producto terminado

### 4.10 Empty state útil en BOMs
"Lista vacía" → "Crea una receta para que las OT se llenen automáticamente con materiales. [Crear primera receta]".

### 4.11 Atajos de teclado documentados
Ya existen `Ctrl+→` / `Ctrl+←`. Agregar `?` → cheatsheet modal.

### 4.12 Plantillas de OT por cliente
Cliente A siempre pide tarjetas 9×5 papel couché 250g → guardar plantilla. Botón "Crear desde plantilla" en lista.

### 4.13 QR/Barcode en hoja de OT
Imprimir QR en PDF, scan desde planta → marca avance de etapa sin abrir la app. Endpoint `/production/orders/scan/<code>/transition`.

### 4.14 Tiempo estimado por etapa en BOM
Campo `estimated_minutes` en `BillOfMaterialsLine` (o entidad nueva `BomProcessStep`). Permite estimar `due_date` automáticamente al crear OT.

### 4.15 Foto del producto final
En `FinishedStep`, permitir adjuntar foto (`Attachment` ya soporta archivos). Sirve como prueba de calidad y referencia futura.

### 4.16 Re-impresión rápida
Botón "Imprimir copia" en OT FINISHED → crea OT nueva pre-llenada con descripción "Copia de OT-XXX".

### 4.17 Tablero "Hoy / Mañana / Esta semana"
Vista alternativa al kanban filtrando por `due_date`. Útil para reuniones de planning matutinas.

---

## 5. Resumen de hallazgos por prioridad

| Prioridad | Cantidad | Estimación total |
|---|---|---|
| P0 — Bugs | 6 | 1 día |
| P1 — DRY | 8 | 4-5 días |
| P2 — Gaps ERP | 10 | 8-10 días |
| P3 — UX/Features | 17 | 12-15 días |
| **Total** | **41** | **~5 semanas** persona-completa |

Para el desglose ordenado por dependencias ver [10-roadmap.md](10-roadmap.md). Para tareas atómicas ejecutables, [20-task-list.md](20-task-list.md).

---

## 6. Decisiones de diseño que NO se cambian

Para evitar scope creep, este audit **explícitamente NO recomienda**:

- Implementar MRP / planificación de capacidad de máquina.
- Modelo de operaciones / routings tipo Odoo MRP (steps por máquina con tiempos).
- Multi-tenant / multi-planta.
- Integración con sistemas de ERP externos (SAP, Defontana, etc.).
- Reemplazar `stage_data: JSONField` por tabla normalizada (sobre-ingeniería para el caso de uso).
- Versionado de BOM con efectividad por fecha (suficiente con `active=True` + clonar).

El espíritu del módulo es **simple, suficiente para imprenta pequeña, sin barreras**.
