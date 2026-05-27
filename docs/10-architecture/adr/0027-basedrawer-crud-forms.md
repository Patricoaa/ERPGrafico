---
id: 0027
title: BaseDrawer as Primary Surface for Embedded CRUD Forms
status: Accepted
date: 2026-05-25
author: pato
---

# 0027 — BaseDrawer as Primary Surface for Embedded CRUD Forms

## Context

Currently all CRUD forms (create/edit) in ERPGrafico use `BaseModal` (centered Dialog) as their only surface. Three contracts explicitly prohibit using `BaseDrawer` for forms:

- `component-modal.md`: *"Se utiliza **exclusivamente** para subvistas ricas en datos (tablas, históricos, libros mayores). No usar para formularios."*
- `component-decision-tree.md`: *"No usar para formularios — solo para lectura/navegación de datos relacionados."*
- `component-form-patterns.md`: Entire decision tree routes every form category to `BaseModal`; `BaseDrawer` only appears in the read-only branch.

Meanwhile, the actual `Drawer` component in the codebase (`components/shared/Drawer.tsx`) already supports features that `BaseModal` lacks:

| Feature | BaseModal | Drawer (actual) |
|---------|-----------|-----------------|
| Side/edge | Center only | `top`, `right`, `bottom`, `left` |
| Portal boundary | `document.body` only | `"screen"` or `"embedded"` (anchors to `#main-content`) |
| Resizable | No | Yes (drag handle) |
| Overlay control | Always on | Configurable via `showOverlay` |
| Default size | Fixed sizes (sm/md/lg/xl) | `defaultSize` in px/%, `minSize`, `maxSize` |
| Context preservation | Hides entire page | Keeps page partially visible |

Key UX insight from the existing left-side embedded drawers (`LedgerModal`, `PayrollDetailSheet`): **an embedded drawer preserves the user's list context**. In complex form workflows (e.g., editing a product while referring to its list row), users benefit from seeing the underlying page partially — they don't lose their scroll position, selection, or navigation state.

The `component-modal.md` contract's BaseDrawer section is also **factually outdated**: it only documents `height` and `side="bottom"`, while the real `Drawer.tsx` component has `side`, `boundary`, `defaultSize`, `minSize`, `maxSize`, `resizable`, `showOverlay`, and `modal` — none of which appear in the contract.

### Scope of this ADR

This ADR covers **only CRUD forms** (create/edit/detail of entities). Explicitly excluded:

- **Wizards** (`GenericWizard`, `PurchaseCheckoutWizard`, `WorkOrderWizard`, `SalesCheckoutWizard`, `NoteCheckoutWizard`, etc.) — remain in `BaseModal`
- **Read-only data viewers** (ledgers, histories, document lists) — remain in `BaseDrawer` or migrate optionally
- **Confirmation dialogs** (`ActionConfirmModal`) — remain in `BaseModal`
- **Tools and utilities** (`NumpadModal`, `CostCalculatorModal`, `PINPadModal`) — remain in current surface

## Decision

1. **`BaseDrawer` is promoted** from "read-only bottom panel" to a general-purpose overlay surface supporting **both forms and read-only content**, alongside `BaseModal`.

2. **For CRUD forms specifically**, teams may choose between `BaseModal` (centered) and `BaseDrawer` (left-side embedded) based on:

   | Criteria | Prefer BaseModal | Prefer BaseDrawer |
   |----------|-----------------|-------------------|
   | Form complexity | Simple (≤6 fields) | Standard+ (7+ fields) |
   | Context preservation needed | No | Yes (user references list) |
   | FormTabs/FormSplitLayout | Optional | Common |
   | Sidebar audit (ActivitySidebar) | No | Yes |
   | Full-screen needed (`full` size) | Yes | No (max ~80% viewport) |

3. **Left-side embedded** (`side="left"`, `boundary="embedded"`) is the recommended default for CRUD form drawers because:
   - The drawer slides over the main content area but under the shell chrome (sidebar, topbar)
   - The list view remains partially visible, preserving selection context
   - The portal container (`#main-content` / `#module-sheets-portal-container`) is already shared by `CollapsibleSheet` and existing drawers

4. **The contract documentation** is updated to reflect this:

   - `component-modal.md`: BaseDrawer section updated with actual props (`side`, `boundary`, `defaultSize`, `footer`, etc.) and new allowed use case (forms).
   - `component-decision-tree.md`: "No usar para formularios" removed. Decision tree expanded to include `BaseDrawer` as a CRUD surface option.
   - `component-form-patterns.md`: Surface decision tree updated to route forms that benefit from context preservation to `BaseDrawer`. Dimensioning table updated with `defaultSize` equivalents.
   - `adr/0020-modal-on-list-edit-ux.md`: Updated to acknowledge `BaseDrawer` as an alternative surface for the `?selected={id}` pattern.

5. **Implementation order**:
   - Phase 0: Extract shared `PanelBaseProps` type + `PanelHeader` component
   - Phase 1: Align props — add `subtitle` to `BaseModal`, add `footer`/`footerClassName`/`side`/`boundary`/`defaultSize` to `BaseDrawer` contract docs
   - Phase 2: Migrate CRUD forms from `BaseModal` → `BaseDrawer` by feature, starting with simplest (`settings`, `inventory`) and ending with most complex (`contacts`, `inventory/ProductForm`)

6. **Default sizing** for CRUD form drawers:

   | Form category | `defaultSize` | Example |
   |---------------|---------------|---------|
   | Micro/Simple (1-6 fields) | `"40%"` | `GroupForm`, `CustomFieldTemplateForm` |
   | Standard (7-15 fields) | `"50%"` | `CategoryForm`, `TreasuryAccountModal` |
   | Standard + sidebar | `"55%"` | `WarehouseForm`, `PricingRuleForm` |
   | Complex (16-30 fields) + FormTabs | `"65%"` | `ContactDrawer`, `UserForm` |
   | Master (30+ fields) + FormTabs | `"75%"` | `ProductForm`, `EmployeeDrawer` |

## Consequences

### Positive

- **Context preservation**: Users editing an entity can still see the list they came from — no more losing scroll position, selection, or search state.
- **Better horizontal space utilization**: Drawers from the left can be wider than centered modals of the same viewport class, especially on ultrawide monitors.
- **Consistent portal anchoring**: All embedded surfaces (`Drawer`, `CollapsibleSheet`) use the same portal container (`#main-content` / `#module-sheets-portal-container`), making z-index and stacking predictable.
- **Contract aligned with reality**: The `Drawer.tsx` component already supports properties the contract didn't document. This ADR closes the gap.
- **Backward compatible**: `BaseModal` remains unchanged and continues to work for all existing consumers. Migration is opt-in, per-feature.

### Negative

- **Drawers cannot exceed viewport width** (max ~90% of viewport). Forms that genuinely need the full 98vw width of `BaseModal size="full"` should stay in `BaseModal`.
- **Scroll coupling**: `BaseDrawer` has `overflow-y-auto` on its content div. `FormTabs` + `FormSplitLayout` already manage their own scroll. When both are active, double-scroll can occur. Mitigation: pass `contentClassName="p-0 flex flex-col overflow-hidden"` when children manage their own scroll.
- **Left-side drawer conflicts**: If a feature already uses right-side `CollapsibleSheet` panels, a left-side drawer doesn't visually conflict (they occupy opposite edges), but the total occupied width must be considered on small viewports.

### Neutral

- **The `?selected={id}` URL pattern (ADR-0020) remains unchanged**: the redirect and query-param mechanism is surface-agnostic. Only the component mounted in response to `?selected` changes.
- **Footer parity**: `FormFooter` is already the standard footer for all form modals. Adding `footer` to `BaseDrawer` just formalizes what the `Drawer.tsx` implementation already supports at the contract level.
- **Height replaces `defaultSize`**: The old `height` prop on BaseDrawer is superseded by `defaultSize` + `side`. For backward compatibility, `height` can remain as a deprecated alias (`"default"` → `"75vh"`, `"full"` → `"90vh"`).

## Alternatives Considered

### Keep `BaseModal` for all forms, create a separate `CRUDDrawer` component

Rejected: would duplicate header/footer/overlay logic unnecessarily. The `Drawer.tsx` component is already a full-featured primitive — it only needed contract-level recognition for forms. Creating a wrapper would add maintenance surface without UX benefit.

### Only allow `BaseDrawer` for read-only, use `BaseModal` for forms (status quo)

Rejected per analysis: preserves the contract-page gap, denies the UX benefit of context preservation, and leaves the `Drawer.tsx` component's capabilities underutilized. Three real consumers (`LedgerModal`, `PayrollDetailSheet`, `SalesOrdersModal`) already demonstrate the pattern works — extending it to forms is a natural evolution.

### Allow all sides (not just left) for CRUD drawers

Deferred: left-side embedded is the only pattern with production usage (`LedgerModal`, `PayrollDetailSheet`). Right-side drawers could conflict with `CollapsibleSheet` (HubPanel etc.). Top/bottom drawers don't work well with `FormSplitLayout` (sidebar needs vertical space). If a future use case demands a different side, a follow-up ADR can extend.

## References

- [ADR-0020: Modal-on-List Edit UX (URL-State Pattern)](0020-modal-on-list-edit-ux.md)
- [component-modal.md: BaseDrawer section](../20-contracts/component-modal.md)
- [component-decision-tree.md: §4 Layout de Página](../20-contracts/component-decision-tree.md)
- [component-form-patterns.md: §1 Surface Decision Tree](../20-contracts/component-form-patterns.md)
- [Drawer.tsx implementation](../../frontend/components/shared/Drawer.tsx)
- [BaseModal.tsx implementation](../../frontend/components/shared/BaseModal.tsx)

## Changelog

- **2026-05-25**: ADR creado (F10, T-XXX). Decisión: BaseDrawer promovido a surface generalista para CRUD forms + read-only. 3 contratos actualizados.
