---
layer: 50-audit
doc: ot-wizard-task-03
phase: 2
status: pending
---

# Task 03 — Crear `WorkOrderBasicStep` (componente embebible)

## Objetivo

Desacoplar el contenido del actual `WorkOrderForm` del `BaseModal` y exponer un **componente puro de step** que pueda renderizarse como Step 0 del wizard (y también dentro de un modal standalone para retrocompatibilidad temporal).

## Depende de

- Task 01 (hooks ya migrados)
- Task 02 (schema discriminado + `WizardMode`)

## Archivos afectados

| Path | Acción |
|---|---|
| `frontend/features/production/components/forms/WorkOrderBasicStep/index.tsx` | **Nuevo** — componente sin modal |
| `frontend/features/production/components/forms/WorkOrderBasicStep/WorkOrderBasicInfo.tsx` | **Mover** desde `WorkOrderForm/` |
| `frontend/features/production/components/forms/WorkOrderBasicStep/types.ts` | **Nuevo** — props del step |
| `frontend/features/production/components/forms/WorkOrderForm/index.tsx` | Reducir a wrapper sobre el step |
| `frontend/features/production/components/index.ts` | Exportar `WorkOrderBasicStep` |

## Cambios paso a paso

### 3.1 Crear `WorkOrderBasicStep/types.ts`

```ts
import type { WorkOrderFormValues, WorkOrderInitialData } from '@/types/forms'

export interface WorkOrderBasicStepProps {
  /** Modo de operación */
  mode: 'create' | 'edit' | 'view'
  /** Datos iniciales (modo edit/view) */
  initialData?: WorkOrderInitialData
  /** Preselección de tipo (sólo modo create) */
  defaultOtType?: 'LINKED' | 'NONE'
  /** Producto preseleccionado (sólo modo create, type=NONE) */
  defaultProductId?: string
  /** Callback al submit exitoso del POST/PUT */
  onSuccess?: (workOrderId: number) => void
  /** Form ID para el submit externo desde footer del wizard */
  formId?: string
  /** Indicador de loading externo */
  loading?: boolean
  /** Setter del loading externo */
  onLoadingChange?: (loading: boolean) => void
}
```

### 3.2 Crear `WorkOrderBasicStep/index.tsx`

Responsabilidades:

- `useForm<WorkOrderFormValues>` con discriminated union (task 02).
- Reset al recibir `initialData` (idéntica lógica al actual `WorkOrderForm:127-203`).
- `onSubmit` construye `FormData` igual al actual `WorkOrderForm:249-336`.
- **NO renderiza `BaseModal` ni footer** — sólo el contenido (form + manufacturing editor + notas internas).
- Recibe `formId` externa (default: `"work-order-basic-form"`); el submit se dispara desde el footer del wizard.
- Soporta modo `'view'` (todos los inputs `disabled`).

Estructura visual:

```tsx
<Form {...form}>
  <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
    {mode === 'create' && !form.watch('otType') && <OtTypeChooser onChoose={…} />}
    {form.watch('otType') && (
      <>
        <WorkOrderBasicInfo {...passthrough} />
        {form.watch('otType') === 'LINKED' && <ManufacturingSpecsEditor … />}
        <InternalNotesField />
      </>
    )}
  </form>
</Form>
```

> Extraer el bloque "Initial Choice" (líneas 419-461 del actual `WorkOrderForm`) a un sub-componente `OtTypeChooser` local al folder.

### 3.3 Mover `WorkOrderBasicInfo`

- Mover el archivo a `WorkOrderBasicStep/WorkOrderBasicInfo.tsx`.
- Actualizar imports — leer `otType` desde `useFormContext`.
- Borrar la versión vieja en `WorkOrderForm/`.

### 3.4 Reducir `WorkOrderForm/index.tsx` a wrapper

Hasta que la task 06 lo elimine, mantenerlo como wrapper retrocompatible:

```tsx
export function WorkOrderForm({ open, onOpenChange, initialData, onSuccess, ...rest }) {
  return (
    <BaseModal open={open} onOpenChange={onOpenChange} size="full" /* … */>
      <WorkOrderBasicStep
        mode={initialData ? 'edit' : 'create'}
        initialData={initialData}
        onSuccess={(id) => { onSuccess?.(); onOpenChange(false) }}
        {...rest}
      />
    </BaseModal>
  )
}
```

> Esto garantiza que `page.tsx` y otros consumidores siguen funcionando sin tocar nada hasta task 06.

### 3.5 Exportar desde barrel

`frontend/features/production/components/index.ts`:

```ts
export { WorkOrderBasicStep } from './forms/WorkOrderBasicStep'
export type { WorkOrderBasicStepProps } from './forms/WorkOrderBasicStep/types'
```

## Contrato

- **Payload backend idéntico** — la serialización a `FormData` no cambia.
- **`WorkOrderForm` sigue funcionando** como wrapper — cero consumidores externos rotos en esta task.
- El componente nuevo es **agnóstico de su contenedor** (puede vivir en `BaseModal`, en una `<div>` del wizard, en un Drawer).

## Criterios de aceptación

- [ ] `WorkOrderBasicStep` renderiza sin `BaseModal`.
- [ ] `WorkOrderForm` (wrapper) sigue funcionando — `page.tsx` no requiere cambios.
- [ ] El submit del step se puede disparar externamente vía `formId`.
- [ ] Modo `'view'` deshabilita todos los inputs (props `disabled` recursivo o `<fieldset disabled>`).
- [ ] Test existente `WorkOrderForm.test.tsx` sigue verde (o se ajusta el path de import).
- [ ] LOC neto: `WorkOrderBasicStep/` ≈ 350–450; `WorkOrderForm/index.tsx` ≤ 50.

## Validación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- features/production
```

**Smoke test manual**:

1. Abrir `WorkOrderForm` (botón "Nueva OT") — debe verse y comportarse idéntico al actual.
2. Editar OT en MATERIAL_ASSIGNMENT desde la tabla — idéntico al actual.

## Rollback

Si algo se rompe, revertir el commit. `WorkOrderForm` como wrapper minimiza la superficie afectada.
