# Boolean Fields: Switches & Checkboxes

This contract defines how binary selection controls must be implemented to maintain visual consistency with the "Notched Industrial" aesthetic.

## General Rule: No Naked Controls

Switches and Checkboxes MUST NOT be placed directly on the form surface. They must always be wrapped in a `LabeledContainer` to ensure they share the same border and legend architecture as text inputs and selectors.

---

## The "Notched Boolean" Pattern

### 1. Structure
- **Legend (L2)**: Describes the category or the field name (e.g., "STATUS", "NOTIFICATIONS").
- **Internal Label**: A concise description of what the toggle does (e.g., "Active", "Allow public view").
- **Control**: The Switch or Checkbox component, right-aligned.

### 2. Layout
Use a `flex justify-between items-center` container.
- Internal Label: `text-xs font-bold text-foreground`
- Control: Standard UI component with `primary` color theme.

### 3. Usage Guidelines

| Control | When to use | Example |
| :--- | :--- | :--- |
| **Switch** | Binary status, on/off settings, immediate system states. | Rule status, Auto-save, Dark mode. |
| **Checkbox** | Marking items, lists, multi-select, terms of service. | Select all, Newsletter opt-in, Delete confirmation. |

---

## Component Specs

### LabeledSwitch
- **Height**: Minimum `1.5rem` internal area.
- **Internal Padding**: `pr-4` for the control to avoid sticking to the border.

### LabeledCheckbox
- **Height**: Minimum `1.5rem` internal area.
- **Consistency**: Use the same vertical alignment as `LabeledSwitch`.
