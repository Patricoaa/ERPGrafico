---
layer: 30-playbooks
doc: add-feature
task: "Add new frontend feature module (entity CRUD or workflow UI)"
triggers: ["new feature", "add module", "entity CRUD", "create view"]
preconditions:
  - 10-architecture/frontend-fsd.md
  - 20-contracts/hook-contracts.md
  - 20-contracts/api-contracts.md
  - 20-contracts/state-map.md
  - 20-contracts/component-entity-view.md
validation:
  - npx tsc --noEmit
  - npm run lint
  - npm run test
forbidden:
  - any (TypeScript)
  - raw Tailwind colors
  - @/lib/api direct import in components
  - cross-feature internal imports
status: active
owner: frontend-team
last_review: 2026-10-17
---

# Playbook — Add frontend feature

## When to use

A new business capability needs UI (list + detail + forms). Backend endpoint already exists (if not → [add-endpoint.md](add-endpoint.md) first).

## Pre-flight checklist

- [ ] Endpoint exists in backend and documented in `api-contracts.md`.
- [ ] Entity states (if any) documented in `state-map.md`.
- [ ] Chose feature folder name (singular, lowercase: `invoice`, not `invoices`).
- [ ] Checked no existing feature covers it.

## Steps

### 1. Scaffold folder

```
features/[name]/
  api/
    [name]Api.ts       # HTTP calls — thin axios wrappers
  entity-view/
    [name].entity.ts   # presentation: fields once + views per surface (ADR-0087)
  components/
    [Name]Collection.tsx
    [Name]Detail.tsx
    forms/
      [Name]Form.tsx
      schema.ts
  hooks/
    use[Name]s.ts
    use[Name]Mutations.ts
  types/
    state.ts
  index.ts
```

### 2. Write Zod schema first

```ts
// features/[name]/components/forms/schema.ts
import { z } from 'zod'

export const [Name]Schema = z.object({
  customer_id: z.string().uuid(),
  // ... match api-contracts.md request schema
})
export type [Name]Input = z.infer<typeof [Name]Schema>
```

### 2b. Write API module

```ts
// features/[name]/api/[name]Api.ts
import { api } from '@/lib/api'
import type { [Name]Input, [Name] } from '../types'

export const [name]Api = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<[Name]>>('/api/[app]/[name]s/', { params }),
  get: (id: string) =>
    api.get<[Name]>(`/api/[app]/[name]s/${id}/`),
  create: (data: [Name]Input) =>
    api.post<[Name]>('/api/[app]/[name]s/', data),
  update: (id: string, data: Partial<[Name]Input>) =>
    api.patch<[Name]>(`/api/[app]/[name]s/${id}/`, data),
  remove: (id: string) =>
    api.delete(`/api/[app]/[name]s/${id}/`),
}
```

Hooks import from `./api/[name]Api`, never from `@/lib/api` directly. See [frontend-fsd.md](../10-architecture/frontend-fsd.md) import rules.

### 3. Write hooks

- Follow [hook-contracts.md](../20-contracts/hook-contracts.md) naming + return shape.
- Errors via `showApiError` — do NOT expose `error`.
- Invalidate cache keys per [data-flow.md](../10-architecture/data-flow.md).

### 4. Write components

- **Entity presentation first** (invariant #13): declare the entity once in `features/[name]/entity-view/[name].entity.ts` with `defineEntity<T>()` and compose it with `Collection.*`. See **step 4c**. `createEntityFields` / `*Fields.ts` / `AutoEntityCard` / `DataTable` are frozen: do not use them in a new feature.
- Three states mandatory: loading (Skeleton), empty (EmptyState), error (toast handled by hook).
- Status: `StatusBadge` only.
- Forms: `react-hook-form` + `zodResolver(schema)`. El patrón canónico de edición desde lista es `useSelectedEntity` + modal local. Ver [list-modal-edit-pattern.md](../20-contracts/list-modal-edit-pattern.md).
- Colors: semantic tokens only.

### 4b. Template: Drawer CRUD Canónico

Si la entidad requiere un Drawer para Crear/Editar, este es el esqueleto obligatorio (ver [component-entity-drawers.md](../20-contracts/component-entity-drawers.md) y [component-state-sync.md](../20-contracts/component-state-sync.md)):

```tsx
"use client"

import { useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Drawer, FormSplitLayout, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit"
import { useDrawerMode, useDrawerIdentity, type DrawerBaseProps } from "@/features/_shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { useEntityMutations } from "../hooks/useEntityMutations"
import { entitySchema, type EntityFormValues } from "./schema"
import type { Entity } from "@/types"

interface EntityDrawerProps extends DrawerBaseProps {
  initialData?: Entity
}

export function EntityDrawer({
  open, onOpenChange, initialData, onSuccess, mode: modeProp
}: EntityDrawerProps) {
  const { mode, isView } = useDrawerMode({ mode: modeProp, initialData })
  const identity = useDrawerIdentity('domain.entity', mode, initialData)
  const width = formDrawerWidth("medium", !!initialData?.id)

  const form = useForm<EntityFormValues>({
    resolver: zodResolver(entitySchema),
    defaultValues: { name: "" },
  })

  // 🔴 Reset pattern: "Adjust state during render" (no useEffect)
  const prevResetKeyRef = useRef<string>("")
  const resetKey = open ? (initialData?.id?.toString() ?? "__new__") : "__closed__"
  
  if (resetKey !== prevResetKeyRef.current) {
    prevResetKeyRef.current = resetKey
    if (open) {
      form.reset(initialData ? mapEntityToForm(initialData) : defaultFormValues)
    }
  }

  const { saveEntity, isSaving } = useEntityMutations()

  const onSubmit = async (values: EntityFormValues) => {
    await saveEntity({ id: initialData?.id ?? null, payload: values })
    onSuccess?.()
    onOpenChange(false)
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side="left"
      defaultSize={width}
      icon={identity.icon}
      title={identity.title}
      subtitle={identity.subtitle}
      contentClassName={initialData ? "p-0" : undefined}
      footer={isView ? undefined : (
        <FormFooter actions={<>
          <CancelButton onClick={() => onOpenChange(false)} />
          <ActionSlideButton type="submit" form="entity-form" loading={isSaving}>
            {mode === 'create' ? "Crear" : "Guardar Cambios"}
          </ActionSlideButton>
        </>} />
      )}
    >
      <FormSplitLayout
        sidebar={<ActivitySidebar entityId={initialData?.id!} entityType="entity" />}
        showSidebar={!!initialData?.id}
      >
        <form id="entity-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4 pb-4 pt-4">
          <fieldset disabled={isView} className="contents">
            {/* campos */}
          </fieldset>
        </form>
      </FormSplitLayout>
    </Drawer>
  )
}
```

### 4c. Dar de alta la presentación de una entidad (entity-view)

Contrato: [component-entity-view.md](../20-contracts/component-entity-view.md). Guía corta con ejemplos: `frontend/components/entity-view/README.md`. Ejemplos completos: `docs/50-audit/Tablascards/06-spec.md` §14.

1. **Etiqueta.** Confirma que la entidad está en `ENTITY_REGISTRY` (`lib/entity-registry.ts`): de ahí salen el nombre, el icono, la URL canónica y el drawer. Si no está → añádela primero ([entity-identity.md](../20-contracts/entity-identity.md)).
2. **Definición** `features/[name]/entity-view/[name].entity.ts`:
   ```ts
   export const warehouseEntity = defineEntity<Warehouse>()((f) => ({
       label: "inventory.warehouse",
       fields: {
           code: f.code("code", { label: "Código" }),
           name: f.text("name", { label: "Nombre" }),
           active: f.status((w): StatusValue => (w.is_active ? { status: "ACTIVE", label: "Activa" } : { status: "INACTIVE", label: "Inactiva" }), { label: "Estado" }),
       },
   }))
   export const warehouseViews = warehouseEntity.views({
       table: { columns: ["code", "name", "active"], defaultSort: "name" },
       card: { title: "name", subtitle: ["code"], trailing: ["active"] },
   })
   ```
   - Para cada dato, elige el **tipo de valor** (contrato §2). Si es una referencia a otro documento, usa `docRef(f, …)` de `@/features/documents`.
   - Si ningún tipo encaja y lo usa una sola entidad o feature, crea una **extensión** en tu feature (contrato §3: aumentación + registro + constructor) y expórtala por tu barrel.
   - Para un dato visual de dominio dentro de la card, usa `body: { kind: "custom", component }`.
   - **Nunca** JSX inline, casts ni formateo manual: la regla ESLint y el test de contrato lo bloquean.
3. **Vista** `features/[name]/components/[Name]Collection.tsx`: el hook de la feature (invariante #5) → `useEntityCollection(entity, { rows, isLoading, isRefetching, error, refetch, rowCount })` → `<Collection.Root>` + `<Collection.Toolbar>` (búsqueda y filtros como hijos) + `<Collection.View table card />`. Documentos y movimientos paginan **en servidor** (`pagination: { mode: "server", … }` + `rowCount`).
4. **Casos especiales**:
   - tabla editable de wizard o modal → `defineEditable` + `EditableCollection`, con `editableSchema` en `schema.ts` (invariante #9);
   - pantalla con modos → `CollectionModes`;
   - kanban, árbol u otra vista de dominio → una superficie de tu feature que recibe `EntityCollection<T>`.
5. **Story** `features/[name]/entity-view/[Name].stories.tsx` con los estados loading/empty/error (decorador `withEntityView`).
6. **Capacidad que aún falta** (estado en la URL, agrupación, expansión…: contrato §10.1): añádela a `@/components/entity-view` en un lote de la Fase 7 o deja la pantalla en el sistema congelado **sin ampliarlo**. No se agregan props a `DataTable`.
7. **Verificación:** `npx tsc --noEmit`, `npm run lint` (incluye `entity-view/*`) y `npm run test -- lib/__tests__/entity-view.contract.test.ts`.

### 5. Write barrel

```ts
// features/[name]/index.ts
export { [Name]Collection, [Name]Detail, [Name]Form } from './components'
export { use[Name]s, useCreate[Name] } from './hooks'
export type { [Name]Input } from './components/forms/schema'
```

### 6. Mount route

```
app/(dashboard)/[name]/
  page.tsx      # imports from features/[name]
  layout.tsx    # optional
  [id]/page.tsx # redirect server-side a ?selected (ADR-0020)
```

> **Si la entidad está registrada en el `UniversalRegistry`** (aparece en la barra de búsqueda global), la ruta `[id]/page.tsx` DEBE ser un **redirect server-side** a `<list_url>?selected={id}` per [ADR-0020](../10-architecture/adr/0020-modal-on-list-edit-ux.md). La lista lee el param y abre su modal local con `initialData` fetcheado. Ver [list-modal-edit-pattern.md](../20-contracts/list-modal-edit-pattern.md) para el contrato completo.

```tsx
// app/(dashboard)/[module]/[entity-plural]/[id]/page.tsx
import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

export default async function [Name]DetailPage({ params }: { params: { id: string } }) {
  const listUrl = searchableEntityRoutes['[app].[entity]']  // e.g. 'sales.saleorder'
  redirect(`${listUrl}?selected=${params.id}`)
}
```


### 7. Tests

- Hook: mock `lib/api`, assert query key + invalidation.
- Component: render states, interaction (RTL).
- Form: validation with valid + invalid inputs.

### 8. Observability

- Log user actions via `trackEvent('[name].created', {...})` (see [observability.md](../40-quality/observability.md)).
- Surface errors to Sentry (already automatic via axios interceptor).

## Validation

```bash
cd frontend
npx tsc --noEmit
npm run lint
npm run test -- features/[name]
npm run dev     # smoke test in browser
```

## Definition of done

- [ ] Types derived from Zod, zero `any`.
- [ ] All three UI states handled.
- [ ] Hook returns domain-named properties.
- [ ] No cross-feature deep import.
- [ ] Entity collections built with `@/components/entity-view` (no `createEntityFields` / `DataTable` / `AutoEntityCard`, no `<table>`); entity contract test green.
- [ ] Tests pass, coverage ≥ module threshold.
- [ ] Smoke test in browser: list → create → detail → edit → delete.
- [ ] No new shared component created ad hoc (if needed → [add-shared-component.md](add-shared-component.md)).
- [ ] No contract changed (if yes → ADR).
