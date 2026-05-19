---
layer: 50-audit
doc: ot-wizard-contracts
status: reference
owner: production-frontend
created: 2026-05-19
---

# Contratos a preservar — OT Wizard

Esta documentación lista **invariantes de contrato** entre frontend y backend que el refactor NO debe romper. Si una task entra en conflicto con un contrato listado aquí, detenerse y consultar.

---

## 1. Endpoint `POST /production/orders/`

### 1.1 Content-Type

`multipart/form-data` (obligatorio — hay adjuntos).

### 1.2 Campos esperados (frontend → backend)

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `description` | `string` | Sí | Título de la OT |
| `sale_order` | `string` (numeric id) | Sólo modo `LINKED` | `''`, `'none'`, `'__none__'` se tratan como ausente |
| `sale_line` | `string` (numeric id) | Sólo modo `LINKED` | Idem |
| `product_id` | `string` (numeric id) | Sólo modo `NONE` | |
| `quantity` | `string` (numeric) | Sólo modo `NONE` | |
| `uom_id` | `string` (numeric id) | Sólo modo `NONE` | Backend lanza `ValidationError` si falta |
| `start_date` | `string` (`yyyy-MM-dd`) | Sí | Formato Django |
| `estimated_completion_date` | `string` (`yyyy-MM-dd`) | No | El front usa `due_date` y mapea |
| `related_contact` | `string` (numeric id) | No | Sólo `LINKED` |
| `stage_data` | `string` (JSON) | Sí | JSON-stringified — backend `json.loads` |
| `is_manual` | `'true'` | Sí (modo `NONE`) | Flag string |
| `design_file_${n}` | `File` | No | `n` empieza en 0; uno por archivo |

### 1.3 Shape de `stage_data`

```ts
{
  product_description: string
  internal_notes: string
  contact_id?: number
  contact_name?: string
  contact_tax_id?: string
  phases: { prepress: boolean; press: boolean; postpress: boolean }
  specifications: { prepress: string; press: string; postpress: string }
  // legacy keys (mantener por backcompat con OTs viejas)
  prepress_specs: string
  press_specs: string
  postpress_specs: string
  design_needed: boolean
  folio_enabled: boolean
  folio_start: string
  print_type: 'B/N' | 'COLOR' | null
  design_attachments: string[]
  quantity?: string
  uom_id?: string
}
```

**⚠️ NO eliminar las claves legacy** (`prepress_specs`, `press_specs`, `postpress_specs`) sin migración de datos.

### 1.4 Respuesta

`201 Created` con `WorkOrderSerializer` completo. El `id` retornado es el discriminador para pasar a `mode: 'manage'` en el wizard.

### 1.5 Branching backend

`WorkOrderService.create_from_request_payload()` decide:

- Si `product_id` + (no `sale_line`) → `create_manual()`.
- Si `sale_line` no vacío → `create_from_sale_line()` + partial update.
- Else → fallback `super().create()`.

> **Implicancia**: el frontend debe enviar al menos uno de los dos campos discriminadores.

---

## 2. Endpoint `PUT /production/orders/{id}/`

- Content-Type: `multipart/form-data`.
- Mismo shape de payload que create, excepto: el backend reabre `request.FILES` para procesar `design_file_*`, `approval_file` y `final_photo` con [views.py:128-185](../../../backend/production/views.py#L128-L185).
- **Sólo editable** cuando `current_stage ∈ {MATERIAL_ASSIGNMENT, MATERIAL_APPROVAL, PREPRESS}` — regla validada en `page.tsx:237`. **El wizard debe replicar esta regla** para mostrar Step 0 en modo edit vs read-only.

---

## 3. Tipos frontend

### 3.1 Schema actual (a refactorizar en task 02)

`frontend/types/forms.ts` exporta:

```ts
export const workOrderSchema = z.object({ … })          // no discrimina LINKED/NONE
export type WorkOrderFormValues = z.infer<typeof workOrderSchema>
export interface WorkOrderInitialData { … }
```

### 3.2 Schema objetivo (post task 02)

```ts
const linkedSchema = z.object({
  otType: z.literal('LINKED'),
  sale_order: z.string().min(1),
  sale_line: z.string().min(1),
  description: z.string().min(1),
  product_description: z.string(),
  contact_id: z.string().optional(),
  start_date: z.date(),
  due_date: z.date().nullable(),
  internal_notes: z.string().optional(),
})

const noneSchema = z.object({
  otType: z.literal('NONE'),
  product_id: z.string().min(1),
  quantity: z.string().min(1),
  uom_id: z.string().min(1),
  start_date: z.date(),
  due_date: z.date().nullable(),
  internal_notes: z.string().optional(),
})

export const workOrderSchema = z.discriminatedUnion('otType', [linkedSchema, noneSchema])
export type WorkOrderFormValues = z.infer<typeof workOrderSchema>
```

**Backcompat**: mantener `WorkOrderInitialData` igual — el wizard la consume en modo `manage` desde el response del GET.

---

## 4. Wizard contract

### 4.1 Modo (a introducir en task 02)

```ts
export type WizardMode =
  | { kind: 'create'; defaultOtType?: 'LINKED' | 'NONE'; defaultProductId?: string }
  | { kind: 'manage'; orderId: number; targetStage?: StageId }
```

### 4.2 Transición create → manage

Tras `POST /production/orders/` exitoso:

1. Capturar `response.data.id`.
2. `setMode({ kind: 'manage', orderId: response.data.id })`.
3. Refetch `GET /production/orders/{id}/` para hidratar `order` en el store.
4. `setViewingStepIndex(indexOf('MATERIAL_ASSIGNMENT'))`.
5. URL replace (no push): `?modal=new → ?selected=ID`.

### 4.3 Reglas de visibilidad de Step 0

- `mode.kind === 'create'` → Step 0 visible, editable, único step accesible hasta submit.
- `mode.kind === 'manage'` + `order.current_stage ∈ {MATERIAL_ASSIGNMENT, MATERIAL_APPROVAL, PREPRESS}` → Step 0 visible y editable (reemplaza el botón "Editar" del header).
- `mode.kind === 'manage'` + otras etapas → Step 0 visible pero read-only (todos los inputs `disabled`).

---

## 5. Idempotency-Key

A introducir en task 05. Header opcional para `POST /production/orders/`:

```
Idempotency-Key: <uuid v4 generado en el cliente al abrir Step 0>
```

**Backend**: si no se implementa server-side de inmediato, el header es ignorado sin error. El cliente lo añade defensivamente — coordinar con backend para soporte futuro.

---

## 6. URL params

| Param | Significado | Compatible con |
|---|---|---|
| `?selected=ID` | Abrir wizard en modo `manage` para OT ID | Cualquier `step` |
| `?step=STAGE_ID` | Abrir wizard en una etapa específica (override de `current_stage`) | Sólo con `selected` |
| `?new=true` | Abrir wizard en modo `create` | Combinable con `type`, `product_id` |
| `?type=stock` | Preselecciona `otType=NONE` | Sólo con `new=true` |
| `?type=sale` | Preselecciona `otType=LINKED` | Sólo con `new=true` |
| `?product_id=X` | Preselecciona producto en modo `NONE` | Sólo con `new=true&type=stock` |

**Migración**: el param legacy `?modal=new` mapea a `?new=true` (mantener alias por 1 release).

---

## 7. Eventos / side effects

| Evento | Disparador | Acción |
|---|---|---|
| `work_order.created` | POST 201 exitoso | Toast success + invalidate `WORK_ORDERS_LIST_KEY` |
| `work_order.updated` | PUT 200 exitoso | Toast success + invalidate `WORK_ORDER_QUERY_KEY` |
| BOM sugerencia | Cambia `product_id` en Step 0 modo `NONE` | Hook `useBOMSuggestion` setea `due_date` si vacío (lógica actual en `WorkOrderForm:92-115`) |

---

## 8. Invariantes globales que el refactor NO debe violar

(De `CLAUDE.md` — verificar tras cada task)

1. Zero `any` en TS.
2. Sin colores Tailwind crudos.
3. Sin cross-feature internal imports (sólo barrel `index.ts`).
4. **Sin `useQuery`/`useMutation` directos en componentes**.
5. Sin `@/lib/api` directo en componentes/pages.
6. Shared via barrel.
7. `StatusBadge` único renderer de status.
8. Forms con RHF + `zodResolver` + schema en `components/forms/schema.ts` (o equivalente del feature).
9. Views Django ≤ 20 LOC.
