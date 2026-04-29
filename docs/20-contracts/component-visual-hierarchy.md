# Visual Hierarchy & Information Layers

This contract defines the structural and typographic hierarchy for all forms in ERPGrafico. Its goal is to maintain a high-density "Industrial Premium" aesthetic while ensuring clear information architecture.

## The Three-Layer System

All forms MUST be organized into three distinct layers of information:

| Layer | Component | Purpose | Context |
| :--- | :--- | :--- | :--- |
| **Level 1** | `FormSection` | Grouping logical fields. | High-level architecture. |
| **Level 2** | `Legend` (Notch) | Field identification. | Component boundary. |
| **Level 3** | `Value` (Input) | The actual data. | User content. |

---

## Level 1: Sections (`FormSection`)

Sections use a "Line-Title-Line" pattern to break the vertical flow without adding bulk.

- **Typography**: `text-[11px] font-black uppercase tracking-[0.25em]`
- **Color**: `text-muted-foreground/70`
- **Lines**: `h-px bg-border/40`
- **Spacing**: `pt-4 pb-1` (Internal gap)
- **Icons**: Optional leading icon next to text.
    - **Size**: `h-3.5 w-3.5`
    - **Color**: `text-muted-foreground/50` (Muted by default)

## Level 2: Field Legends (Notches)

Legends are part of the `notched-field` pattern (fieldset/legend).

- **Typography**: `text-[10px] font-black uppercase tracking-[0.15em]`
- **Color**: `text-muted-foreground` (Inactive) / `text-primary` (Focused)
- **Positioning**: Sits on the border notch.

## Level 3: Data Values

The actual content typed or selected by the user.

- **Typography**: `text-sm font-normal`
- **Color**: `text-foreground` (Pure black/white)
- **Contrast Rule**: Data values must be the highest contrast elements in the field to ensure readability.

---

## Iconography Consistency

To avoid visual fatigue, icons within components (selectors, sections, etc.) must follow these rules:

1.  **Structural Icons**: (Sections, search icons) Use `text-muted-foreground/50`.
2.  **Semantic Icons**: (Warning, Info) Use their respective functional colors (`destructive`, `warning`).
3.  **Active Elements**: (Selected items in dropdowns) Can use `text-primary` or `text-foreground`.
