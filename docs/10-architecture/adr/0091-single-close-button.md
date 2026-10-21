# ADR-0091: Single Canonical Close Button (SheetCloseButton)

## Status

Accepted

## Context

The codebase had three divergent close-button styles across modals, drawers, sheets, and panels:

1. **Radix native X** (`components/ui/dialog.tsx`, `components/ui/sheet.tsx`): `absolute top-4 right-4 rounded-xs opacity-70 hover:opacity-100`, `<XIcon className="size-4" />` + `<span className="sr-only">Close</span>` (English, no tooltip).
2. **SheetCloseButton** (`components/shared/SheetCloseButton.tsx`): `rounded-full h-8 w-8 ghost variant`, `hover:bg-muted hover:text-foreground transition-all duration-200`, `<X className="h-4 w-4" />` + `<span className="sr-only">{label}</span>` (Spanish "Cerrar", optional tooltip).
3. **Inline X buttons**: e.g., `UniversalSearch` had `<Button variant="ghost"><X className="size-4 text-muted-foreground/60" /></Button>` — no accessible name, different visual style.

Additionally, 7 components violated the modal contract (`docs/20-contracts/component-modal.md`) by importing `DialogContent`/`SheetContent` directly instead of using `BaseModal`/`Drawer`.

## Decision

**`SheetCloseButton` is the single canonical close button** for all modals, drawers, sheets, and panels in the application.

### Enforcement

1. **BaseModal** and **Drawer** render `PanelHeader` with `onClose`, which renders `SheetCloseButton`. They disable Radix's native close button (`showCloseButton={false}` / `hideCloseButton={true}`).
2. **CollapsibleSheet** intentionally hides the Radix X and closes via its vertical tab (documented exception).
3. **UniversalSearch** (the only authorized exception per `component-modal.md`) now uses `SheetCloseButton` inline with `label="Cerrar búsqueda"`.
4. **ESLint rule `dialog/no-direct-usage` (error)** blocks direct imports of `DialogContent`/`SheetContent` from `@/components/ui` outside the allowlist:
   - `components/ui/dialog.tsx`
   - `components/ui/sheet.tsx`
   - `components/shared/BaseModal.tsx`
   - `components/shared/Drawer.tsx`
   - `components/shared/CollapsibleSheet.tsx`
   - `components/shared/UniversalSearch.tsx`
5. **Contract test `close-button.contract.test.ts`** verifies:
   - `SheetCloseButton` exists, exports from barrel, has canonical markup.
   - `BaseModal`/`Drawer` use `PanelHeader` with `onClose` and disable Radix X.
   - No direct `DialogContent`/`SheetContent` imports outside allowlist.
   - Features don't import `SheetCloseButton` directly (use `PanelHeader` via `BaseModal`/`Drawer`).

### Migration (completed in same PR)

The 7 violating components were migrated:
- `DatePicker` → `BaseModal` + `Calendar` icon
- `DateRangeFilter` → `BaseModal` + footer (Cancel/Aceptar)
- `InventoryCountClientView` → `BaseModal` + preserved `onPointerDownOutside`
- `CartItem` (POS UOM selector) → `BaseModal size="xs"`
- `F29CloseModal` → `BaseModal` + `FileText` icon
- `PayrollPaymentsDrawer` → `Drawer` (shared)
- `CreditLineDrawer` → `Drawer` (shared) + `boundary="screen"` for nested drawer + footer with form submit

### Exceptions (documented, no code change)

- **Sidebar móvil** (`components/ui/sidebar.tsx`): `hideCloseButton={true}`, closes via overlay/ESC.
- **Nav móvil** (`components/layout/DashboardShell.tsx`): `hideCloseButton={true}`, closes via overlay.
- **CollapsibleSheet** consumers without `PanelHeader` (`ReconciliationPanel`, `ProfileSidePanel`): close via vertical tab. `TaskInboxSidebar` already adds `PanelHeader` with `onClose`.
- **Toasts (sonner)**: no close button by design (timeout/click to dismiss).
- **AlertDialog**: no close button by design (action buttons only).

## Consequences

### Positive

- **Visual consistency**: One close button style everywhere (circular ghost, 32px, Spanish label, tooltip support).
- **Accessibility**: All close buttons have `sr-only` label ("Cerrar" or custom), UniversalSearch now has accessible name.
- **Maintainability**: Single source of truth for close button behavior/style.
- **Contract compliance**: Modal contract now has zero violations; `component-modal.md` exception list is accurate.

### Negative

- **Migration effort**: 7 components migrated, CreditLineDrawer required `boundary="screen"` for nested drawer case.
- **Visual change**: Components previously using Radix X now show the ghost circular style (slightly larger hit target, different hover).

## Alternatives Considered

1. **Promote Radix X to canonical**: Rejected — Radix X is `rounded-xs`, no tooltip, English "Close", opaque 70% style; doesn't match design system.
2. **Allow both styles with documentation**: Rejected — leads to inconsistency; already had 3 styles.
3. **Modify `components/ui/dialog.tsx` and `sheet.tsx`**: Rejected — contract forbids modifying Shadcn base (`components/ui/`); would affect all consumers including those that should keep Radix X (none in our codebase after migration).

## References

- `docs/20-contracts/component-contracts.md` (SheetCloseButton 🟢)
- `docs/20-contracts/component-modal.md` (exception list)
- `docs/20-contracts/component-decision-tree.md` (close button rule)
- `docs/20-contracts/component-drawer.md` (Drawer close button note)
- `frontend/eslint-rules/no-direct-dialog-usage.mjs`
- `frontend/lib/__tests__/close-button.contract.test.ts`
- Migration PR: Phase 0-4 commits