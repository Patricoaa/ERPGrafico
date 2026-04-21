---
layer: 20-contracts
doc: component-contracts
status: active
owner: frontend-team
last_review: 2026-04-21
stability: contract-changes-require-ADR
---

# Component Contracts

Public API of every shared component in `components/shared/`. Consumers import only what's documented here. Changing a prop requires ADR.

## Legend

- 🟢 Stable — safe to use
- 🟡 Beta — API may still change
- 🔴 Pendiente de contrato — read source before use
- Columns: `prop` | `type` | `required` | `default` | `notes`

---

## StatusBadge 🟢

Only authorized component for rendering entity states. No ad-hoc badges allowed.

```tsx
<StatusBadge variant="sale-order" status="in_production" />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `variant` | `'sale-order' \| 'purchase-order' \| 'work-order' \| 'invoice' \| 'payment' \| 'generic'` | ✅ | — | Maps to state-map entity |
| `status` | entity-specific union (see [state-map](state-map.md)) | ✅ | — | Must be valid for variant |
| `size` | `'sm' \| 'md' \| 'lg'` | ❌ | `'md'` | 40px min height `md`+ |
| `className` | `string` | ❌ | — | Merged via `cn()` |

States handled: — (pure presentational, no async).

---

## Skeleton family 🟢

| Component | Use for |
|-----------|---------|
| `CardSkeleton` | Card/tile loading |
| `TableSkeleton` | Tabular data loading |
| `FormSkeleton` | Form loading after edit-mode entry |
| `SkeletonShell` | Full-page shell (layout + inner skeletons) |

Common props: `rows?`, `columns?`, `className?`.

---

## EmptyState 🟢

```tsx
<EmptyState
  icon={<PackageIcon />}
  title="Sin órdenes"
  description="Crea la primera para empezar"
  action={<Button>Crear</Button>}
/>
```

| prop | type | required |
|------|------|----------|
| `icon` | `ReactNode` | ❌ |
| `title` | `string` | ✅ |
| `description` | `string` | ❌ |
| `action` | `ReactNode` | ❌ |

---

## PageHeader 🟢

| prop | type | required | notes |
|------|------|----------|-------|
| `title` | `string` | ✅ | uses `font-heading` |
| `subtitle` | `string` | ❌ | |
| `breadcrumbs` | `Array<{label; href?}>` | ❌ | |
| `actions` | `ReactNode` | ❌ | Right-aligned |
| `tabs` | `ReactNode` | ❌ | Below title |
| `backHref` | `string` | ❌ | Renders chevron-left |

---

## 🔴 Pending contract — read source first

Do not assume API. Open source in `components/shared/` before use. Document here after stabilization.

- `ActionConfirmModal`
- `DataManagement`
- `DatePicker`
- `DateRangeFilter`
- `DocumentAttachmentDropzone`
- `DocumentCompletionModal`
- `FacetedFilter`
- `FolioValidationInput`
- `PeriodValidationDateInput`
- `MoneyDisplay`
- `GenericWizard`
- `ReportTable`
- `CollapsibleSheet`
- `CommentSystem`
- `AttachmentList`
- `ToolbarCreateButton`
- `PageTabs`
- `TransactionViewModal`

When promoting any of these to 🟢:
1. Add section above with full prop table.
2. Confirm three-state handling (`loading`/`empty`/`error`).
3. Add ADR if API shape is non-trivial.
4. Add unit tests for each prop variant.

## Forbidden usage

- Creating a new badge component instead of using `StatusBadge`.
- Passing raw Tailwind color classes to any shared component.
- Modifying `/components/ui/` (Shadcn base).
