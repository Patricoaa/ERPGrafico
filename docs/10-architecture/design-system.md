---
layer: 10-architecture
doc: design-system
status: active
owner: frontend-team
last_review: 2026-05-28
---

# Design System

> **Puerta de entrada:** para una vista consolidada (concepto, principios, mapas de referencia) consulta **[DESIGN.md](../../DESIGN.md)** en la raíz del repo. Este documento detalla la arquitectura del design system; los contratos normativos viven en `docs/20-contracts/`.

## Core Principles
1.  **Data Density over Whitespace:** ERP users need to see information at a glance. Primary interactive elements default to `h-10` (40px). `h-8` and `h-9` are permitted only in compact contexts (toolbars, secondary tabs, icon buttons) — not as a general replacement for standard inputs.
2.  **Radius Hierarchy (The Rule of Nested Corners):** Standardize on a base radius `R = 0.5rem` (8px). To ensure visual harmony in nested layouts, containers use a larger radius than their content:
    -   **Atomic Elements (8px):** Buttons, inputs, checkboxes, and small interactive elements.
    -   **Standard Containers (12px):** Cards and main section wrappers. Use `rounded-md`.
    -   **Interactive/selectable cards (8px):** `ProductCard`, `ChoiceCard`, `ContactCard`, `MfgLineCard`, `VariantSelectorModal`, `SaleOrderProductStep` (líneas), `OriginSelectionStep`, `EntityCard` (entity-view Collection) and the `PaymentMethodSelector` chosen surface use `rounded-sm` (8px) as an exception to the rule above. They share the base radius `R` with atomic elements because their visual density and selection language (ribbon CMYK, hover preview) align with the atomic tier, not the container tier. See ADR-0094, ADR-0095.
    -   **Overlays (16px):** Modals, standard Sheets, and floating popovers. Use `rounded-lg`.
    -   **Main Stage / Shell (20px):** The primary floating container of the application, as well as **Global Side Panels (Hub, Inbox)** that push the main content, and Bottom Drawers. Use `rounded-xl` to ensure parallel framing when they sit side-by-side. For the full surface treatment (radius + border + shadow + background), apply the shared `@utility panel-surface` (defined in `app/globals.css`) to all three surfaces — the main `<main>` in `DashboardShell`, `CollapsibleSheet` instances, and embedded `Drawer` instances. Do not override `border`, `shadow`, `rounded-*` or `bg-*` individually on these surfaces. **Exception:** `Drawer` side-specific radius (e.g., `rounded-t-xl` / `rounded-b-xl`) must use the Tailwind v4 `!` suffix (`rounded-t-xl!`) to win over `panel-surface`'s `rounded-xl!important`.
    -   Rounding (`rounded-full`) is reserved for icon-only buttons, status pills, and specific kinetic elements.
    -   **Macro vs Micro Overlays:** Overlays that feel "floating above the app frame" (modals, web sheets, global drawers) use `rounded-lg` (macro overlay). Tooltips, dropdowns, and context menus are *micro overlays* — their atomic-level items use `rounded-sm`, while the root popover surface uses `rounded-lg` for consistency with macro overlays. For example, `DataTableCells` style `DropdownMenuContent` at `rounded-lg` but `DropdownMenuItem` and `TooltipContent` at `rounded-sm`.
    -   > **Note:** the Tailwind radius scale is **remapped** in `globals.css` to serve this hierarchy: `--radius = 0.5rem` (8px), `--radius-md = +4px` (12px), `--radius-lg = +8px` (16px), `--radius-xl = +12px` (20px). So `rounded-md` resolves to 12px here, **not** Tailwind's default 6px. Always verify the tokens in `app/globals.css`.
3.  **Surface Patterns (Industrial Texture System):** Panels in the prepress/industrial domain use subtle background textures to reinforce the print-shop identity. These are defined as `@utility` classes in `app/globals.css` and applied via `className`:
    -   **`dot-grid-surface`** — Subtle dot grid pattern (radial-gradient, 24px spacing). Use on `bg-card` panels in POS, product grids, and any surface that needs an industrial/prepress texture. See `app/globals.css:454`. **Do not** combine with other background utilities on the same element.
    -   **`panel-surface`** — Shared surface treatment (`rounded-xl + border + shadow + bg-card`). Reserved for the main `<main>` shell, `CollapsibleSheet`, and `Drawer` instances. See `app/globals.css:444`.
4.  **Accent Utilities:** Decorative flourishes for cards and surfaces:
    -   **`ribbon-cmyk`** — 2px cyan→magenta→yellow gradient top border. Use on cards that need a print-shop accent (selected product cards, active panels). See `app/globals.css:465`.
    -   **`card-focus-spin-cmyk`** — 2px cyan→magenta→yellow gradient border that rotates on hover and speeds up on focus/selected (`accent-visible`). Included in `card-base` for entity cards. See `app/globals.css`.
3.  **Semantic Styling:** Never use hardcoded colors or spacing if a semantic token exists.

## Color Palette

El sistema de color sigue una arquitectura de 3 capas en `globals.css`. **Contrato completo y fuente autoritativa: [color-system.md](../20-contracts/color-system.md).**

## Typography
- Use modern, clean typography suitable for data-heavy applications.
- Ensure tabular numbers (`tabular-nums`) are used in DataTables and any financial/metric displays to prevent layout shifts.

## Component Guidelines

### Data Cells
For legacy and modern pages, all data display should be routed through centralized `DataCell` components. Do not build ad-hoc styled spans or divs for status badges, tags, or money displays. Use `MoneyDisplay` and `QuantityDisplay` strictly.

### Consuming Base Components (Shadcn/UI)
- **Immutability:** The `components/ui/` directory contains auto-generated components and must never be manually modified to add domain or business logic.
- **Extensibility:** If you need to alter the behavior or fixed styles of a base component, create a *wrapper* or a new specialization inside `components/shared/` that imports and consumes the primitive from `ui/`.

### Visual Regressions to Avoid
- **Black Primary:** Ensure `primary` is correctly mapped to a raw color that supports opacity.
- **Hardcoded Borders:** Never use `border-white/X` or `border-black/X`. Use semantic tokens like `border-border` or `border-sidebar-border`.
- **Inconsistent Separators:** Use `FadedSeparator` for headers/footers and `LabeledSeparator` for form sections.

## Enforcement

AI agents and developers **must** read `frontend/app/globals.css` to know the available semantic color tokens (`--color-*`). Do not invent arbitrary tokens. All other enforcement rules in [GOVERNANCE.md](../90-governance/GOVERNANCE.md).
