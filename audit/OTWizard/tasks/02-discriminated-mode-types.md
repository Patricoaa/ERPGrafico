---
layer: 50-audit
doc: ot-wizard-task-02
phase: 1
status: pending
---

# Task 02 — Tipos discriminados + Zod refactor

## Objetivo

Eliminar las validaciones condicionales a mano en `WorkOrderForm` reemplazando el schema actual por un `z.discriminatedUnion` y exportando un tipo `WizardMode` que el wizard consumirá en task 04.

## Depende de

— (independiente de Task 01)

## Archivos afectados

| Path | Acción |
|---|---|
| `frontend/types/forms.ts` | Refactor de `workOrderSchema` |
| `frontend/features/production/types.ts` | Añadir `WizardMode` |
| `frontend/features/production/components/forms/WorkOrderForm/index.tsx` | Adaptar a discriminated union |
| `frontend/features/production/components/forms/WorkOrderForm/WorkOrderBasicInfo.tsx` | Adaptar `otType` desde el form |

## Cambios paso a paso

### 2.1 Refactor `workOrderSchema`

`frontend/types/forms.ts` — reemplazar la export actual por:

```ts
import { z } from 'zod'

const baseFields = {
  start_date: z.date(),
  due_date: z.date().nullable(),
  internal_notes: z.string().optional().default(''),
}

const linkedSchema = z.object({
  otType: z.literal('LINKED'),
  description: z.string().min(1, 'Descripción requerida'),
  sale_order: z.string().min(1, 'Nota de venta requerida'),
  sale_line: z.string().min(1, 'Ítem de venta requerido'),
  product_description: z.string().min(1, 'Descripción de producto requerida'),
  contact_id: z.string().optional().default(''),
  ...baseFields,
})

const noneSchema = z.object({
  otType: z.literal('NONE'),
  description: z.string().optional().default(''),
  product_id: z.string().min(1, 'Producto requerido'),
  quantity: z.string().min(1, 'Cantidad requerida'),
  uom_id: z.string().min(1, 'Unidad de medida requerida'),
  ...baseFields,
})

export const workOrderSchema = z.discriminatedUnion('otType', [linkedSchema, noneSchema])
export type WorkOrderFormValues = z.infer<typeof workOrderSchema>
export type WorkOrderLinkedValues = z.infer<typeof linkedSchema>
export type WorkOrderNoneValues = z.infer<typeof noneSchema>
```

> Mantener `WorkOrderInitialData` tal cual está.

### 2.2 Añadir `WizardMode`

`frontend/features/production/types.ts`:

```ts
import type { StageId } from '../constants/stages'

export type WizardMode =
  | { kind: 'create'; defaultOtType?: 'LINKED' | 'NONE'; defaultProductId?: string }
  | { kind: 'manage'; orderId: number; targetStage?: StageId }
```

### 2.3 Adaptar `WorkOrderForm`

- `useForm<WorkOrderFormValues>(...)` queda igual; el discriminador `otType` ahora vive **dentro del form state**, NO en `useState` separado.
- Reemplazar el `useState<"LINKED" | "NONE" | null>` por:
  - Mientras el usuario no eligió, no se renderiza el form (igual que hoy).
  - Al elegir, `form.reset({ otType: choice, … })` con defaults apropiados.
- Eliminar branches `otType === "LINKED"` que hoy se basan en estado local — pasar a leer `form.watch('otType')`.
- Type-guard al armar el payload: `if (data.otType === 'LINKED') { … } else { … }` — TypeScript narrowing hace que `data.product_id` sólo exista en la rama `NONE` y `data.sale_line` sólo en `LINKED`.

### 2.4 Adaptar `WorkOrderBasicInfo`

- Remover prop `otType: "LINKED" | "NONE"`; leer desde `useFormContext<WorkOrderFormValues>().watch('otType')`.
- Beneficio: una sola fuente de verdad.

## Contrato

Ver [contracts.md §3.2](../contracts.md#32-schema-objetivo-post-task-02).

- El **payload al backend NO cambia** — el shape multipart sigue idéntico (`stage_data` JSON, `is_manual: 'true'` cuando `otType === 'NONE'`, etc.).
- Sólo cambia la **representación interna** del form.

## Criterios de aceptación

- [ ] `workOrderSchema` es `z.discriminatedUnion('otType', [...])`.
- [ ] `WorkOrderFormValues` es la unión inferida — no hay campos opcionales que en realidad son obligatorios en uno de los modos.
- [ ] El estado `otType` ya NO vive en `useState` dentro de `WorkOrderForm` (vive en el form).
- [ ] `WorkOrderBasicInfo` no recibe prop `otType` — la lee del form context.
- [ ] Payload `FormData` al backend produce el mismo shape que antes (verificar manualmente con DevTools Network o test de integración).
- [ ] Cero `any`, cero `as any` introducidos.
- [ ] `WizardMode` exportada desde `features/production/types.ts`.

## Validación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- features/production/components/forms/WorkOrderForm/__tests__
```

**Smoke test manual** (con dev server):

1. Crear OT manual desde toolbar — verificar que dispara `POST /production/orders/` con `is_manual=true`, `product_id`, `quantity`, `uom_id`.
2. Crear OT linked — verificar que dispara `POST /production/orders/` con `sale_order` y `sale_line`.
3. En ambos casos, la OT debe aparecer en estado DRAFT / MATERIAL_ASSIGNMENT.

## Rollback

`git revert <commit>`. Como el payload de salida no cambió, no hay datos corruptos posibles.
