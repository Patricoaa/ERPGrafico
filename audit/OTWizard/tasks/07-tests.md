---
layer: 50-audit
doc: ot-wizard-task-07
phase: 4
status: pending
---

# Task 07 — Tests

## Objetivo

Garantizar regresión cero y cobertura del nuevo flujo: tests unitarios del step, tests de integración del wizard en modos create y manage, y smoke E2E manual documentado.

## Depende de

- Task 06 (estado final del cleanup)

## Archivos afectados

| Path | Acción |
|---|---|
| `frontend/features/production/components/forms/WorkOrderBasicStep/__tests__/WorkOrderBasicStep.test.tsx` | **Nuevo / migrado** del antiguo `WorkOrderForm.test.tsx` |
| `frontend/features/production/components/__tests__/WorkOrderWizard.test.tsx` | **Nuevo o ampliado** — cubre `mode: 'create'` y transición |
| `frontend/features/production/hooks/__tests__/useActiveBom.test.ts` | **Nuevo** (si no existe) |
| `frontend/features/production/components/forms/WorkOrderForm/__tests__/` | **Eliminar** (si sobrevive en task 06) |
| Backend: `backend/production/tests/test_views.py` | Asegurar tests existentes siguen verdes |

## Casos de test

### 7.1 `WorkOrderBasicStep`

**Modo create — NONE**

- [ ] Render inicial muestra el `OtTypeChooser`.
- [ ] Tras seleccionar "Producción para Stock", muestra `ProductSelector`, `quantity`, `uom_id`.
- [ ] Submit con producto/qty/uom válidos arma `FormData` con `is_manual='true'`, `product_id`, `quantity`, `uom_id`, `stage_data` JSON.
- [ ] Submit sin producto muestra error del schema.
- [ ] `onSuccess` recibe el `workOrderId` retornado por la mock del POST.

**Modo create — LINKED**

- [ ] Tras seleccionar "Vincular a Venta", muestra `AdvancedSaleOrderSelector`.
- [ ] Al seleccionar SO, fetch de líneas vía `useSaleOrderManufacturableLines` (mockear).
- [ ] Submit incluye `sale_order` y `sale_line` en el FormData.
- [ ] `is_manual` NO se envía.

**Modo edit**

- [ ] Recibe `initialData`, hidrata todos los campos.
- [ ] Inputs visibles y editables.
- [ ] Submit hace PUT a `/production/orders/{id}/`.

**Modo view**

- [ ] Recibe `initialData`, todos los inputs deshabilitados.
- [ ] No hay botón submit (el footer del contenedor decide).

**Idempotency**

- [ ] Cada submit en modo create lleva header `Idempotency-Key`.
- [ ] La key es estable durante la sesión del step (no se regenera entre validaciones).

### 7.2 `WorkOrderWizard`

**Modo create**

- [ ] Abre en step 0 (BASIC_INFO).
- [ ] Steps siguientes deshabilitados hasta tener `orderId`.
- [ ] Tras submit exitoso, transiciona a MATERIAL_ASSIGNMENT automáticamente.
- [ ] `WizardHeader` muestra "OT #N" tras la transición.

**Modo manage**

- [ ] Abre en `targetStage` si se pasa, sino en `current_stage`.
- [ ] Step 0 visible y editable si la OT está en MATERIAL_ASSIGNMENT/MATERIAL_APPROVAL/PREPRESS.
- [ ] Step 0 visible y read-only en otras etapas.
- [ ] El botón "Editar" en `WizardHeader` navega al Step 0, no abre modal.

**Regresión**

- [ ] Todas las transiciones de etapa (PRESS → POSTPRESS, etc.) siguen funcionando.
- [ ] Anular, eliminar, duplicar OT siguen funcionando desde el header.

### 7.3 Backend (regresión)

```bash
pytest backend/production -q
```

- [ ] Tests de `WorkOrderViewSet.create` siguen pasando.
- [ ] Tests de `create_from_request_payload` (manual + linked) siguen pasando.
- [ ] Si task 08 se implementa, añadir tests de `initial_materials[]`.

## Smoke E2E manual

Documentar en `docs/50-audit/OTWizard/smoke-test.md` (crear como parte de esta task):

```md
## Smoke OT Wizard Unificado

### 1. Crear OT manual
- Toolbar → "Nueva OT" → seleccionar "Producción para Stock"
- Elegir producto, qty, uom, fechas → "Crear orden"
- ✓ Wizard cambia a etapa MATERIAL_ASSIGNMENT sin recargar
- ✓ URL contiene `?selected=<NEW_ID>&step=MATERIAL_ASSIGNMENT`

### 2. Crear OT linked
- Toolbar → "Nueva OT" → seleccionar "Vincular a Venta"
- Elegir NV, ítem, fechas, specs → "Crear orden"
- ✓ Mismas validaciones que (1)

### 3. Editar OT en MATERIAL_ASSIGNMENT
- Abrir OT existente desde tabla → click "Editar" en header
- ✓ Navega al Step 0 dentro del mismo modal
- Modificar descripción, "Guardar cambios" → PUT 200
- ✓ Datos actualizados en la OT

### 4. View OT en PRESS
- Abrir OT en etapa PRESS → click "Editar"
- ✓ Step 0 visible, inputs deshabilitados

### 5. Cerrar wizard
- Esc o botón cerrar → URL limpia (sin selected/step/new)

### 6. Doble click submit
- En step 0 modo create, click rápido x2 en "Crear orden"
- ✓ Sólo 1 POST exitoso; el segundo (si llega) usa la misma Idempotency-Key
```

## Contrato

- No se elimina ningún test existente sin reemplazo equivalente.
- Mocks de API usan `msw` o equivalente ya presente en el repo (verificar con `frontend/test-setup.ts`).

## Criterios de aceptación

- [ ] `npm run test` pasa al 100%.
- [ ] Coverage de `features/production/components/forms/` ≥ coverage previo.
- [ ] `pytest backend/production` pasa al 100%.
- [ ] `smoke-test.md` creado y documenta los 6 casos.
- [ ] Al menos un test asserta que **no hay `BaseModal` anidado** en el flujo (renderizar wizard, buscar instancias de `[role="dialog"]` en el árbol — debe ser 1).

## Validación

```bash
cd frontend
npm run test
npm run test:coverage   # si existe el script

cd ../
pytest backend/production -q --tb=short
```

## Rollback

Tests fallidos no se mergean. Si tras merge se descubre un test frágil, marcarlo `skip` con un TODO referenciando un issue y abrir tarea de fix.
