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
last_review: 2026-04-21
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
  components/
    [Name]List.tsx
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

### 3. Write hooks

- Follow [hook-contracts.md](../20-contracts/hook-contracts.md) naming + return shape.
- Errors via `showApiError` — do NOT expose `error`.
- Invalidate cache keys per [data-flow.md](../10-architecture/data-flow.md).

### 4. Write components

- Three states mandatory: loading (Skeleton), empty (EmptyState), error (toast handled by hook).
- Status: `StatusBadge` only.
- Forms: `react-hook-form` + `zodResolver(schema)`.
- Colors: semantic tokens only.

### 5. Write barrel

```ts
// features/[name]/index.ts
export { [Name]List, [Name]Detail, [Name]Form } from './components'
export { use[Name]s, useCreate[Name] } from './hooks'
export type { [Name]Input } from './components/forms/schema'
```

### 6. Mount route

```
app/(dashboard)/[name]/
  page.tsx      # imports from features/[name]
  layout.tsx    # optional
  [id]/page.tsx # detail
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
- [ ] Tests pass, coverage ≥ module threshold.
- [ ] Smoke test in browser: list → create → detail → edit → delete.
- [ ] No new shared component created ad-hoc (if needed → [add-shared-component.md](add-shared-component.md)).
- [ ] No contract changed (if yes → ADR).
