---
layer: 30-playbooks
doc: add-shared-component
task: "Promote or create component in /components/shared/"
triggers: ["shared component", "promote to shared", "reusable UI"]
preconditions:
  - 10-architecture/frontend-fsd.md
  - 20-contracts/component-contracts.md
validation:
  - npx tsc --noEmit
  - npm run lint
  - npm run test
forbidden:
  - modifying /components/ui/ (Shadcn base)
  - raw Tailwind colors
  - missing loading/empty/error handling
status: active
owner: frontend-team
last_review: 2026-04-21
---

# Playbook — Add shared component

## When

Component is used (or imminently will be) in ≥3 unrelated features. Below 3 = keep feature-local.

## Steps

### 1. Justify promotion

Document in PR:
- Consumers (list features).
- Why not extend existing shared component.
- Contract stability — will props stay?

### 2. Extract to `/components/shared/[Name]/`

```
components/shared/[Name]/
  [Name].tsx
  [Name].test.tsx
  [Name].stories.tsx    (optional, Storybook)
  index.ts
```

### 3. Define props with Zod or explicit type

```ts
type [Name]Props = {
  title: string
  onAction?: () => void
  className?: string
}
```

No `any`, no `object`, no `Function`. Discriminated unions for variants.

### 4. Handle three states

```tsx
if (isLoading) return <Skeleton... />
if (!items.length) return <EmptyState... />
// happy path — errors bubble via toast from caller's hook
```

### 5. Respect design tokens

- Semantic colors only.
- `h-10` minimum for interactive.
- 8pt grid for spacing.
- `font-heading` for titles; `font-sans` default.

### 6. Write contract entry

Edit `20-contracts/component-contracts.md`:
- Add section under 🟢 Stable (or 🟡 Beta).
- Full prop table.
- Usage example.
- States handled.

If component was in 🔴 pending list → move out.

### 7. Update consumers

Replace feature-local copies with import from `@/components/shared/[Name]`.

### 8. Tests

- Render each prop variant.
- State transitions (loading → empty → data).
- Accessibility — axe no violations.
- Keyboard interaction where applicable.

### 9. ADR (if non-trivial)

Required when:
- Component exposes slot/render-prop API.
- Introduces new pattern (e.g. compound component).
- Replaces an existing shared component.

## Validation

```bash
cd frontend
npx tsc --noEmit
npm run lint
npm run test components/shared/[Name]
# visual: Storybook or dev server
```

## Definition of done

- [ ] Documented in component-contracts.md.
- [ ] Three states handled.
- [ ] Tests cover all variants.
- [ ] All known consumers migrated.
- [ ] No regressions (run full test suite).
- [ ] ADR if non-trivial.
