# 📋 Plan de Remediación: Auditoría de Producción

Este documento detalla las tareas accionables derivadas de la [Auditoría Técnica del Módulo de Producción](production-audit.md). El plan está organizado en fases según la criticidad y el impacto.

---

## Fase 1: Correcciones Críticas (Backend & Datos)
*Objetivo: Resolver inconsistencias contables y riesgos de integridad de datos.*

### [OT-01] Solucionar Brecha Contable en Consumos ✅ COMPLETADO
~~🔴 P1 / Esfuerzo: M~~
**Implementación:** `finalize_production` en `production/services.py` ahora genera el asiento contable para **ambos** escenarios:
- `track_inventory=True` → Débito: Inventario de Producto Terminado (Asset Account) / Crédito: Inventario de Componentes
- `track_inventory=False` → Débito: COGS/Gasto / Crédito: Inventario de Componentes
- El asiento de entrada también se vincula al `StockMove` del producto terminado cuando aplica.
- **Pendiente:** Crear tests unitarios que verifiquen ambos escenarios y que las cuentas cuadren.

### [OT-02] Resolver Race Condition en Numeración de OTs ✅ COMPLETADO
~~🔴 P1 / Esfuerzo: S~~
**Implementación:** La numeración fue **centralizada en `models.py:save()`** usando `select_for_update()` dentro de `transaction.atomic()`. Las llamadas duplicadas en `services.py:create_from_sale_line` y `services.py:create_ot_for_delivery_line` fueron eliminadas — ahora se pasa `number=None` y el modelo lo genera de forma segura. La numeración además aplica `zfill(6)` para formato consistente.

### [OT-03] Eliminar o Implementar Estado PLANNED ✅ COMPLETADO (Opción A)
~~🔴 P1 / Esfuerzo: S~~
**Implementación:** `Status.PLANNED` fue **eliminado** de `models.py`. Se optó por la Opción A (eliminar) dado que no tenía transición ni lógica asociada.
- `production/migrations/0004_remove_planned_status.py` — data migration que convierte cualquier OT con `status='PLANNED'` a `DRAFT` antes de que la restricción de la aplicación la bloquee. Incluye reverse `noop` (seguro para rollback).

---

## Fase 2: Optimización de Rendimiento y Reglas de Negocio (Backend)
*Objetivo: Mejorar tiempos de respuesta y alinear el sistema con la realidad física (mermas).*

### [OT-04] Optimizar N+1 en `WorkOrderMaterialSerializer` ✅ COMPLETADO
~~🟠 P2 / Esfuerzo: M~~
**Implementación:**
1. `views.py` — `select_related` + `prefetch_related` en el `queryset` base (pre-existente).
2. `views.py` — Nuevo método `_build_stock_context(work_order)`: ejecuta **una sola query** `StockMove.objects.filter(warehouse=..., product_id__in=...).values('product_id').annotate(total=Sum('quantity'))` y devuelve `{product_id: stock_float}`.
3. `views.py` — `retrieve()` sobreescrito: inyecta `stocks_by_product` en el contexto del serializer antes de serializar.
4. `views.py` — `transition` action: también usa `_build_stock_context()` para la validación de disponibilidad de stock, evitando queries individuales.
5. `serializers.py` — `get_stock_available()` lee primero de `context['stocks_by_product']` (cero queries adicionales en `retrieve`). Cae al caché por request como fallback para `list()` y otras actions.

### [OT-05] Permitir Ajuste de Cantidad Producida en OTs de NV ✅ COMPLETADO (Opción A — alerta)
~~🟠 P2 / Esfuerzo: M~~
**Implementación:**
- Se eliminó la validación en `rectify_production` que impedía ajustar `produced_quantity` en OTs vinculadas a una NV.
- `finalize_production` usa `actual_quantity_produced` en lugar de `sale_line.quantity` cuando está seteado (incluso en OTs de NV).
- Si hay discrepancia (`produced ≠ sold`), se registra en `WorkOrderHistory` con texto descriptivo y el campo `notes`.
- `WorkOrderSerializer` expone `production_discrepancy: {produced, sold, delta}` (null si no hay discrepancia).
- `FinishedStep.tsx` muestra un banner de alerta visible cuando `production_discrepancy` es no-nulo.
- Decisión de negocio: **sin cambios automáticos en la NV** — el vendedor actúa manualmente.

### [OT-06] Unificar bandera `mfg_auto_finalize` ✅ COMPLETADO
~~🟠 P2 / Esfuerzo: M~~
**Implementación:** Todos los accesos a `mfg_auto_finalize` ahora usan `product.mfg_profile.mfg_auto_finalize` con fallback a `product.mfg_auto_finalize` cuando no hay perfil:
- `production/services.py` líneas 129, 146, 288, 361, 378 — unificadas.
- `inventory/models.py` — `Product.save()`, `is_express_variant`, `missing_bom` unificadas.

### [OT-07] Corregir Lógica de Reversión de Consumos ✅ COMPLETADO (Opción A)
~~🟠 P2 / Esfuerzo: S~~
**Implementación:** Se eliminó el bloque de código muerto (líneas 464-481 originales) en `annul_work_order`. La regla de negocio confirmada es: **nunca permitir anulación si hay consumos registrados**. El código inaccesible fue removido, limpiando la ambigüedad.

---

## Fase 3: Refactorización Arquitectónica (Frontend)
*Objetivo: Desacoplar, hacer testeable y escalar la UI de producción.*

### [OT-08] Refactor: Extraer Mutations a Hooks ✅ COMPLETADO
~~🟡 P3 / Esfuerzo: L~~
**Implementación:** `features/production/hooks/useWorkOrderMutations.ts`
- `useWorkOrderMutations(orderId, { onSuccess? })` expone todas las mutaciones usando `useMutation` de TanStack Query.
- Mutaciones: `transition` (multipart FormData), `rectify`, `addMaterial`, `updateMaterial`, `removeMaterial`, `annul`, `deleteOrder`, `addComment`.
- Cada mutación invalida `['work-order', orderId]` y `['work-orders']` (lista/kanban) al tener éxito.
- El parámetro `onSuccess` permite que el wizard llame a su `fetchOrder` como fallback hasta que OT-10 migre a `useQuery`.
- Estados de carga exportados: `isTransitioning`, `isRectifying`, `isAddingMaterial`, `isAnnuling`, `isDeleting`.
- Barrel `hooks/index.ts` creado para unificar imports de todos los hooks del feature.
- Constantes exportadas: `WORK_ORDER_QUERY_KEY`, `WORK_ORDERS_LIST_KEY`.

### [OT-09] Validar esquema de `stage_data` ✅ COMPLETADO
~~🟡 P3 / Esfuerzo: L~~
**Implementación:**
- **Frontend** — `features/production/schemas/stageData.ts`:
  - `WorkOrderPhaseDataSchema` (Zod): shape común de cada fase (prepress/press/postpress) + raíz.
  - `WorkOrderStageDataSchema` (Zod): extiende PhaseData con `quantity`, `uom_*`, `phases`, y sub-objetos `prepress`/`press`/`postpress`.
  - `parseStageData(raw)`: parsea con fallback seguro a `{}` y log de advertencia.
  - `validateTransitionData(raw)`: lanza `ZodError` con mensajes por campo, para usar antes de enviar al API.
  - Barrel `schemas/index.ts` expone todo el módulo.
- **`types.ts`**: `WorkOrder.stage_data` ahora usa `WorkOrderStageData` (inferido de Zod) en lugar de la interfaz manual duplicada.
- **Backend** — `production/validators.py`:
  - `validate_transition_data(data, stage)`: valida tipos de campos críticos (`bool`, `str`, `list`, `float`) con errores por campo.
  - `validate_stage_data(stage_data)`: valida el objeto raíz completo incluyendo sub-objetos de fase.
- **`production/services.py`**: `transition_to()` llama `validate_transition_data()` antes de fusionar `data` en `stage_data`.

### [OT-10] Descomponer `WorkOrderWizard.tsx` (God Object) ✅ COMPLETADO
~~🟠 P2 / Esfuerzo: XL~~
**Resultado:** `WorkOrderWizard.tsx` **118 KB → 26 KB** (1,717 → 582 líneas). Cada componente de etapa es independientemente testeable.

**Implementación:**
- `WorkOrderWizardStore.ts` — Zustand store con estado compartido: `order`, `taskNotes`/`taskFiles`, estados de modales, rectification state. Acción `reset()` limpia al cerrar.
- `steps/ApprovalTaskList.tsx` — Componente reutilizable para renderizar `TaskActionCard` filtradas por `task_type`.
- `steps/MaterialAssignmentStep.tsx` — Tabla de materiales + formulario add/edit local (15 variables de estado que antes vivían en el wizard).
- `steps/MaterialApprovalStep.tsx` — Lista de stock con badge disponible/sin stock.
- `steps/OutsourcingAssignmentStep.tsx` — Lista de tercerizados + formulario propio.
- `steps/OutsourcingVerificationStep.tsx` — Estado de recepción de OCs.
- `steps/PrepressStep.tsx` — Archivos del checkout + adjuntos + tareas.
- `steps/PressStep.tsx` — Tareas de aprobación de impresión.
- `steps/PostpressStep.tsx` — Tareas de aprobación de post-impresión.
- `steps/FinishedStep.tsx` — Pantalla de finalización.
- `steps/index.ts` — Barrel actualizado con todos los steps.
- **`WorkOrderWizard.tsx`** — Orquestador delgado: fetch, keyboard nav, handlers de transición/anulación/delete, router de steps por `currentStageId`, modales de confirmación.

---

## ❓ Preguntas y Definiciones Pendientes

*Sin preguntas abiertas — todas las tareas están implementadas.*

---

## Resumen de Estado

| Tarea | Descripción | Estado |
|-------|-------------|--------|
| OT-01 | Brecha contable track_inventory | ✅ Completado (tests pendientes) |
| OT-02 | Race condition numeración OTs | ✅ Completado |
| OT-03 | Estado PLANNED (dead code) | ✅ Completado — eliminado + migración 0004 |
| OT-04 | N+1 en serializer de materiales | ✅ Completado (una query anotada + fallback caché) |
| OT-05 | Cantidad producida en OTs de NV | ✅ Completado (Opción A: alerta, sin cambio en NV) |
| OT-06 | mfg_auto_finalize duplicado | ✅ Completado |
| OT-07 | Código muerto en anulación | ✅ Completado — código muerto eliminado |
| OT-08 | Extraer mutations a hooks | ✅ Completado |
| OT-09 | Validar esquema stage_data | ✅ Completado |
| OT-10 | Descomponer WorkOrderWizard | ✅ Completado (118KB → 26KB) |
