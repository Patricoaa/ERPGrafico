---
layer: 10-architecture
doc: design-system
status: active
owner: frontend-team
last_review: 2026-04-21
---

# Industrial Premium Design System

## Overview
ERPGrafico utilizes an "Industrial Premium" design system. The goal is to provide a highly functional, data-dense interface suitable for an ERP, while maintaining a modern, polished, and distinctive aesthetic.

## Core Principles
1.  **Data Density over Whitespace:** ERP users need to see information at a glance. Prioritize compact layouts (e.g., standardizing on `h-8` instead of `h-10` for common inputs).
2.  **Near-Zero Radius:** The "Industrial" look is achieved through sharp, precise edges. Avoid heavily rounded corners. The standard radius is very small. Do not use `rounded-full` or large radii unless explicitly required for specific UI components like pills or avatars.
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
For legacy and modern pages, all data display should be routed through centralized `DataCell` components. Do not build ad-hoc styled spans or divs for status badges, tags, or money displays.

### Visual Regressions to Avoid
- **Black Primary:** Ensure `primary` is correctly mapped to a raw color that supports opacity, preventing elements from rendering as black.
- **Inconsistent Radii:** Mixing `rounded-lg` with square elements breaks the Industrial Premium aesthetic. Stick to the unified radius tokens.
- **Shadows:** Use standard shadow tokens. Avoid hardcoded `box-shadow` values.

## Enforcement
The design system is enforced through:
- **Tailwind v4 `@theme` inline:** Single source of truth in `globals.css`.
- **Zero-Any / Component Contracts:** Strict TypeScript interfaces ensure components only accept allowed variants (e.g., `variant="default" | "destructive"`).
