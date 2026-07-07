---
layer: 50-audit
doc: ot-wizard-task-04
phase: 3
status: completed
---

# Task 04 — Wizard con `mode: 'create' | 'manage'`

## Objetivo

Embeber `WorkOrderBasicStep` como **Step 0** del `WorkOrderWizard` y unificar create + manage bajo un único `BaseModal`. Eliminar el modal anidado actual.

## Depende de

- Task 03 (`WorkOrderBasicStep` ya existe y funciona)

## Archivos afectados

| Path | Acción |
|---|---|
| `frontend/features/production/components/WorkOrderWizard.tsx` | Refactor mayor — acepta `mode` |
| `frontend/features/production/components/WizardProcessSidebar.tsx` | Añadir step 0 condicional |
| `frontend/features/production/components/WizardHeader.tsx` | Eliminar `onEdit` (o redirigirlo) |
| `frontend/features/production/components/WizardStickyFooter.tsx` | Botón "Crear orden" en step 0 modo create |
| `frontend/features/production/components/WorkOrderWizardStore.ts` | Añadir `wizardMode` y selectores |

## Cambios paso a paso

### 4.1 Refactor de `WorkOrderWizard` props

```ts
import type { WizardMode } from '../types'

interface WorkOrderWizardProps {
  mode: WizardMode
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (workOrderId: number) => void
}
```

**Eliminar** props `orderId` y `targetStage` directos — viven dentro del discriminated `mode`.

### 4.2 Estado interno

```ts
const [currentMode, setCurrentMode] = useState<WizardMode>(mode)
const isCreating = currentMode.kind === 'create'
const orderId = currentMode.kind === 'manage' ? currentMode.orderId : null
```

### 4.3 Fetch condicional

`fetchOrder()` sólo se llama cuando `currentMode.kind === 'manage'`. En modo `create`, `order` es `null` hasta que el POST tenga éxito.

### 4.4 Step 0 en `WizardProcessSidebar`

Añadir un step virtual al inicio:

```ts
const STEP_BASIC: WorkOrderStage = {
  id: 'BASIC_INFO',
  label: 'Información Básica',
  icon: FileEdit,
  color: 'bg-muted',
  alwaysShow: true,
  showInKanban: false,
  order: 0,
}
```

> **No agregar a `STAGES_REGISTRY`** del backend — es puramente UI. Crear constante local en el wizard.

Lógica de visibilidad:

- `mode.kind === 'create'` → sólo Step 0 visible y clickeable; el resto bloqueado hasta tener `orderId`.
- `mode.kind === 'manage'` → Step 0 visible siempre. Editable sólo si `order.current_stage ∈ {MATERIAL_ASSIGNMENT, MATERIAL_APPROVAL, PREPRESS}`; en otras etapas, modo `'view'`.

### 4.5 Render del step

En el bloque central del wizard, antes de los `currentStageId === '…'`:

```tsx
{currentStageId === 'BASIC_INFO' && (
  <WorkOrderBasicStep
    mode={isCreating ? 'create' : isEditable ? 'edit' : 'view'}
    initialData={order as any}
    defaultOtType={isCreating ? currentMode.defaultOtType : undefined}
    defaultProductId={isCreating ? currentMode.defaultProductId : undefined}
    formId="wizard-basic-form"
    loading={loading}
    onLoadingChange={setLoading}
    onSuccess={(workOrderId) => {
      if (isCreating) {
        setCurrentMode({ kind: 'manage', orderId: workOrderId })
        // post-POST: el effect que watch'ea orderId disparará fetchOrder y moverá a MATERIAL_ASSIGNMENT
      } else {
        fetchOrder()
      }
    }}
  />
)}
```

### 4.6 Footer adaptado

`WizardStickyFooter` necesita un caso nuevo:

- Si `currentStageId === 'BASIC_INFO'` y `mode === 'create'`:
  - Botón primario: `<ActionSlideButton form="wizard-basic-form" type="submit" disabled={loading}>Crear orden</ActionSlideButton>`.
  - Sin botón "Anterior" (es el primer step).
  - Sin botón "Siguiente etapa" (el siguiente movimiento es resultado del submit, no transición de stage).
- Si `currentStageId === 'BASIC_INFO'` y `mode === 'manage'`:
  - Si etapa editable: botón "Guardar cambios" + botón "Ir a etapa actual".
  - Si no editable: solo "Ir a etapa actual".

### 4.7 Transición automática post-create

```ts
useEffect(() => {
  if (currentMode.kind !== 'manage') return
  if (!order) return                  // todavía no hidratado
  if (viewingStepIndex !== 0) return  // ya navegó
  // Si veníamos de un create, mover a MATERIAL_ASSIGNMENT
  const wasCreating = wasCreatingRef.current
  if (wasCreating) {
    setViewingStepIndex(STAGES.findIndex(s => s.id === 'MATERIAL_ASSIGNMENT'))
    wasCreatingRef.current = false
  }
}, [order, currentMode, viewingStepIndex])
```

Usar un `useRef` `wasCreatingRef` para detectar el flanco de subida `create → manage`.

### 4.8 Eliminar el modal anidado de edit

En el render actual de `WorkOrderWizard.tsx:452-460`:

```diff
- {isEditOpen && order && (
-   <WorkOrderForm
-     open={isEditOpen}
-     onOpenChange={setIsEditOpen}
-     initialData={order as any}
-     onSuccess={() => { setIsEditOpen(false); fetchOrder() }}
-   />
- )}
```

Y en `WizardHeader`, la prop `onEdit` ahora navega al step:

```ts
onEdit={() => setViewingStepIndex(0)}  // Step 0 = BASIC_INFO
```

### 4.9 Eliminar import de `WorkOrderForm` en `WorkOrderWizard`

El `dynamic(() => import('./forms/WorkOrderForm'))` en `WorkOrderWizard.tsx:44-47` desaparece.

## Contrato

- Ver [contracts.md §4](../contracts.md#4-wizard-contract).
- **Backend NO cambia** — sigue siendo `POST /production/orders/` desde el step en modo create.
- Tras POST exitoso, refetch via `useWorkOrders` queryKey (`WORK_ORDERS_LIST_KEY`) — la lista se actualiza sola.

## Criterios de aceptación

- [ ] El wizard funciona en modo `create` sin orderId.
- [ ] El wizard funciona en modo `manage` con orderId (regresión cero).
- [ ] Tras POST exitoso, el wizard transiciona automáticamente a MATERIAL_ASSIGNMENT sin reload de página.
- [ ] El botón "Editar" del `WizardHeader` ahora navega al Step 0 (no abre modal).
- [ ] No hay `BaseModal` anidado en ninguna ruta del flujo.
- [ ] El footer muestra "Crear orden" en step 0 modo create, "Guardar cambios" en step 0 modo edit, y las acciones de etapa normales en otros steps.
- [ ] En etapas no editables (`PRESS`, `POSTPRESS`, etc.), el step 0 sigue accesible pero todos los inputs están deshabilitados.
- [ ] LOC de `WorkOrderWizard.tsx` ≤ 800 (era 672 + máx +130).

## Validación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- features/production
```

**Smoke test manual** (con dev server):

1. **Create manual**: abrir wizard con `mode: 'create', defaultOtType: 'NONE'` → llenar Step 0 → submit → verificar:
   - POST 201 en Network.
   - Wizard ahora muestra "OT #N" en header.
   - Step actual cambia a MATERIAL_ASSIGNMENT automáticamente.
2. **Create linked**: idem con `defaultOtType: 'LINKED'`.
3. **Edit en MATERIAL_ASSIGNMENT**: abrir wizard sobre OT existente → click "Editar" → debe navegar a Step 0 dentro del mismo modal → modificar y submit → PUT 200 → seguir en Step 0 con datos actualizados.
4. **View en PRESS**: abrir wizard sobre OT en etapa PRESS → click "Editar" → Step 0 visible, inputs deshabilitados.

## Rollback

Feature flag durante la transición:

```ts
const UNIFIED_WIZARD = process.env.NEXT_PUBLIC_OT_WIZARD_UNIFIED === 'true'
```

`page.tsx` selecciona entre flujo viejo (modal `WorkOrderForm` + wizard separado) y nuevo según la flag. Eliminar la flag en task 06 tras validación.
