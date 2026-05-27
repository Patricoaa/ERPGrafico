# Form Layout Architecture

## Form Width Constants

Form container width is selected by **complexity tier** (field/section count) via the type-safe helpers in `@/lib/form-widths`. The system absorbs the ~288 px `ActivitySidebar` automatically in edit mode.

> **Canonical reference**: see [docs/20-contracts/form-layout-architecture.md §8](../../../docs/20-contracts/form-layout-architecture.md#8-form-width-constants) for the full contract. The summary below is a quick-reference only.

### Two helpers, two surfaces

| Surface | Helper | Returns |
|---------|--------|---------|
| `<Drawer />` | `formDrawerWidth(complexity, hasSidebar)` | `string` (`"30%"`, `"55%"`, …) |
| `<BaseModal />` | `formModalSize(complexity, hasSidebar)` | CVA token (`"sm"`, `"md"`, `"lg"`, …) |

### Complexity tiers

| `FormComplexity` | Fields | Drawer create / edit | Modal create / edit |
|:----------------:|:------:|:--------------------:|:-------------------:|
| `"micro"`   | 1     | 25% / 40% | xs / sm |
| `"simple"`  | 2–3   | 30% / 45% | sm / md |
| `"medium"`  | 4–6   | 40% / 55% | md / lg |
| `"complex"` | 7+    | 50% / 65% | lg / xl |
| `"master"`  | multi-tab | 65% / 80% | xl / 2xl |

### Usage

```typescript
import { formDrawerWidth } from "@/lib/form-widths"

const width = formDrawerWidth("medium", !!initialData?.id)

// <Drawer defaultSize={width} />
```

```typescript
import { formModalSize } from "@/lib/form-widths"

const size = formModalSize("complex", !!initialData)

// <BaseModal size={size} />
```

> ❌ **No acceder al objeto por string** (ej: `FORM_WIDTHS.complex.edit`). Esa API anterior fue eliminada — generaba bugs silenciosos por casing.

## Activity Sidebar Rule

The Activity Sidebar must only appear in edit mode (when an entity ID exists) and never in creation mode.

### Implementation

Use `FormSplitLayout` to conditionally render the sidebar:

```typescript
<FormSplitLayout
  sidebar={initialData?.id ? (
    <ActivitySidebar
      entityId={initialData.id}
      entityType="your-entity-type"
    />
  ) : undefined}
  showSidebar={!!initialData?.id}
>
  {/* Form content */}
</FormSplitLayout>
```

### Important Notes

1. The sidebar width is fixed at 4rem (64px) as defined in `globals.css`.
2. Width constants already compensate for the sidebar's presence in edit mode.
3. Always use `FormFooter` for form actions (already enforced in other contracts).
4. The `entityType` prop must match the audit log type (e.g., "payment", "customer", "product").

## Form Structure

All forms must follow this structure:

1. Drawer with dynamic width based on mode and tier
2. Conditional Activity Sidebar via FormSplitLayout (edit mode only)
3. Form with react-hook-form and zodResolver
4. FormFooter with SubmitButton and CancelButton

## Validation

- Use Zod schemas with `zodResolver`
- All forms must use `react-hook-form`
- Never use `useQuery` or `useMutation` directly in form components
- Business logic should be in service layers or hooks, not in form components

## Related Contracts

- [Component Decision Tree](./component-decision-tree.md) - for choosing existing components
- [Form Footer](./component-form-footer.md) - for FormFooter usage
- [Activity Sidebar](./component-activity-sidebar.md) - for ActivitySidebar usage