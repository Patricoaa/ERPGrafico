---
layer: 10-architecture
doc: design-system
status: active
owner: frontend-team
last_review: 2026-04-21
---

# Design System

## Overview
ERPGrafico utilizes a unified design system. The goal is to provide a highly functional, data-dense interface suitable for an ERP, while maintaining a modern, polished, and distinctive aesthetic.

## Core Principles
1.  **Data Density over Whitespace:** ERP users need to see information at a glance. Prioritize compact layouts (e.g., standardizing on `h-8` instead of `h-10` for common inputs).
2.  **Balanced Softness (8px Radius):** Standardize on a `0.5rem` (8px) radius for all containers, inputs, and buttons. This provides a modern, approachable feel while maintaining professional precision. Rounding is permitted for icon-only buttons and status pills.
3.  **Semantic Styling:** Never use hardcoded colors or spacing if a semantic token exists.

## Color Palette
The brand's primary color is **Electric Violet**.

### Color Architecture
Colors in Tailwind v4 must be defined as raw channels in `app/globals.css` to allow for opacity modifiers (e.g., `bg-primary/10`).

```css
@theme {
  --color-primary: oklch(0.45 0.25 280);
}
```

### Prohibited Patterns
- ❌ Hardcoded HEX/RGB values in components (e.g., `text-[#FF0000]`).
- ❌ Non-semantic generic colors (plain red, plain blue). Always use the curated variants defined in the theme.

## Typography
- Use modern, clean typography suitable for data-heavy applications.
- Ensure tabular numbers (`tabular-nums`) are used in DataTables and any financial/metric displays to prevent layout shifts.

## Component Guidelines

### Data Cells
For legacy and modern pages, all data display should be routed through centralized `DataCell` components. Do not build ad-hoc styled spans or divs for status badges, tags, or money displays. Use `MoneyDisplay` and `QuantityDisplay` strictly.

### Consumiendo Componentes Base (Shadcn/UI)
- **Inmutabilidad:** El directorio `components/ui/` contiene componentes autogenerados y nunca debe ser modificado manualmente para añadir lógicas de dominio o negocio.
- **Extensibilidad:** Si necesitas alterar el comportamiento o los estilos fijos de un componente base, debes crear un *wrapper* o una nueva especialización dentro de `components/shared/` que importe y consuma el primitivo de `ui/`.

### Visual Regressions to Avoid
- **Black Primary:** Ensure `primary` is correctly mapped to a raw color that supports opacity.
- **Hardcoded Borders:** Never use `border-white/X` or `border-black/X`. Use semantic tokens like `border-border` or `border-sidebar-border`.
- **Inconsistent Separators:** Use `FadedSeparator` for headers/footers and `LabeledSeparator` for form sections.

## Enforcement
The design system is enforced through:
- **Tailwind v4 `@theme` inline:** Single source of truth in `globals.css`. Agentes de IA y desarrolladores **deben** leer el archivo `app/globals.css` para conocer los colores de tokens disponibles (`--color-*`). No inventar colores arbitrarios.
- **Zero-Any / Component Contracts:** Strict TypeScript interfaces ensure components only accept allowed variants (e.g., `variant="default" | "destructive"`).
- **ESLint:** Reglas que bloquean antipatrones como `.toLocaleString()` directamente en la UI.
