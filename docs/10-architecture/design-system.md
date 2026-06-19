---
layer: 10-architecture
doc: design-system
status: active
owner: frontend-team
last_review: 2026-05-28
---

# Design System

## Overview
ERPGrafico utilizes a unified design system. The goal is to provide a highly functional, data-dense interface suitable for an ERP, while maintaining a modern, polished, and distinctive aesthetic.

## Core Principles
1.  **Data Density over Whitespace:** ERP users need to see information at a glance. Primary interactive elements default to `h-10` (40px). `h-8` and `h-9` are permitted only in compact contexts (toolbars, secondary tabs, icon buttons) — not as a general replacement for standard inputs.
2.  **Radius Hierarchy (The Rule of Nested Corners):** Standardize on a base radius `R = 0.5rem` (8px). To ensure visual harmony in nested layouts, containers use a larger radius than their content:
    -   **Atomic Elements (8px):** Buttons, inputs, checkboxes, and small interactive elements.
    -   **Standard Containers (12px):** Cards and main section wrappers. Use `rounded-md`.
    -   **Overlays (16px):** Modals, standard Sheets, and floating popovers. Use `rounded-lg`.
    -   **Main Stage / Shell (20px):** The primary floating container of the application, as well as **Global Side Panels (Hub, Inbox)** that push the main content, and Bottom Drawers. Use `rounded-xl` to ensure parallel framing when they sit side-by-side. For the full surface treatment (radius + border + shadow + background), apply the shared `@utility panel-surface` (defined in `app/globals.css`) to all three surfaces — the main `<main>` in `DashboardShell`, `CollapsibleSheet` instances, and embedded `Drawer` instances. Do not override `border`, `shadow`, `rounded-*` or `bg-*` individually on these surfaces.
    -   Rounding (`rounded-full`) is reserved for icon-only buttons, status pills, and specific kinetic elements.
    -   > **Note:** the Tailwind radius scale is **remapped** in `globals.css` to serve this hierarchy: `--radius = 0.5rem` (8px), `--radius-md = +4px` (12px), `--radius-lg = +8px` (16px), `--radius-xl = +12px` (20px). So `rounded-md` resolves to 12px here, **not** Tailwind's default 6px. Always verify the tokens in `app/globals.css`.
3.  **Semantic Styling:** Never use hardcoded colors or spacing if a semantic token exists.

## Color Palette

The color system follows a **3-layer architecture** orchestrated in `globals.css`. Full contract: **[color-system.md](../20-contracts/color-system.md)**.

### Layers

| Layer | Purpose | Examples | Dark mode |
|-------|---------|----------|-----------|
| **Layer 1 — Process** | CMYK + Pantone identity (fixed inks) | `--cyan`, `--magenta`, `--yellow`, `--black` | Fixed (inks don't change) |
| **Layer 2 — Semantic** | System intents aliased to Layer 1 | `--primary` → `--cyan`, `--info` → `--blue` | Layer 2 carries the dark-mode adaptation |
| **Layer 3 — Domain** | Business domain natures aliased to Layer 2 | `--income` → `--success`, `--asset` → `--info` | Inherits from Layer 2 |

### Primary identity

Primary = **Process Cyan** (`oklch(0.65 0.18 235)`) via `text-primary` / `bg-primary`.

### Color Architecture
Colors must be defined as raw OKLCH channels in `app/globals.css` to support Tailwind v4 opacity modifiers (e.g., `bg-primary/10`).

### Prohibited Patterns
- ❌ Hardcoded HEX/RGB values in components (e.g., `text-[#FF0000]`).
- ❌ Non-semantic generic colors (plain red, plain blue). Always use the curated tokens defined in the theme.
- ❌ Direct use of Layer 1 process tokens (`bg-cyan`, `text-magenta`) outside graphic industry components.
- ✅ Use Layer 2 semantic tokens (`bg-primary`, `text-info`, `border-warning`) for all application UI.

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
The design system is enforced through:
- **Tailwind v4 `@theme` inline:** Single source of truth in `globals.css`. Agentes de IA y desarrolladores **deben** leer el archivo `app/globals.css` para conocer los colores de tokens disponibles (`--color-*`). No inventar colores arbitrarios.
- **Zero-Any / Component Contracts:** Strict TypeScript interfaces ensure components only accept allowed variants (e.g., `variant="default" | "destructive"`).
- **ESLint:** Reglas que bloquean antipatrones como `.toLocaleString()` directamente en la UI.
