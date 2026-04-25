# Form Layout Architecture

This contract defines the structural rules for arranging components within forms to ensure consistency, scannability, and visual integration.

## 1. Grid Systems

The project uses two primary grid systems depending on the container size:

### 4-Column Grid (Modals, Sheets, Sidebars)
Standard for medium to small containers (e.g., `BaseModal` size `md` to `lg`).
- **Base Class**: `grid grid-cols-4 gap-4`
- **Logic**: Allows for granularity of 25% increments (1/4, 1/2, 3/4, Full).

### 12-Column Grid (Main Pages, Full-Screen Views)
Standard for desktop-first data-heavy forms.
- **Base Class**: `grid grid-cols-12 gap-6`
- **Logic**: Allows for more complex layouts (e.g., 1/3, 1/6 increments).

---

## 2. Standard Field Widths (4-Column System)

Fields should have a width proportional to the data they contain and their importance.

| Data Type | Standard Span | Rationale |
| :--- | :--- | :--- |
| **Primary Names / IDs** | `col-span-3` or `Full` | High visibility, usually contains long text. |
| **Short Metadata** (Priority, Code) | `col-span-1` | Compact data that doesn't need horizontal room. |
| **Entity Selectors** (Product, Account) | `col-span-3` or `Full` | Needs room for names and internal badges. |
| **Standard Selects** (Status, Category) | `col-span-1` or `col-span-2` | Depends on text length of options. |
| **Dates / Times** | `col-span-2` | Standard width for consistency with other date fields. |
| **Price / Quantity** | `col-span-1` or `col-span-2` | Usually paired together (3:1 or 2:2 ratio). |
| **Boolean Toggles** (Switches) | `Full` | Uses the `justify-between` pattern for clear separation. |
| **Text Areas / Notes** | `Full` | Maximum room for multi-line text. |

---

## 3. Semantic Ordering (The Layered Approach)

Follow this order within the form's vertical flow to improve user cognition:

### Layer 1: Scope & Context (The "What")
- **Components**: Name, Code, Product, Category, Customer.
- **Goal**: Identify the entity being created/edited.

### Layer 2: Configuration & Parameters (The "How")
- **Components**: Quantities, Rules, Filters, Types, Methods.
- **Goal**: Define the logic of the action.

### Layer 3: Results & Impacts (The "Outcome")
- **Components**: Price (Net/Gross), Discounts, Totals, Taxes.
- **Goal**: Show the immediate effect of the configuration.

### Layer 4: Lifecycle & Metadata (The "When/Status")
- **Components**: Validity dates, Active/Inactive status, Internal notes.
- **Goal**: Manage state and history.

---

## 4. Spacing & Separators

- **Between Sections**: Use `FormSection` with icons and a standard vertical gap (`space-y-6` on form, but `pt-4` inside `FormSection`).
- **Between Fields**: `gap-4` (Standard) or `gap-6` (Complex grids).
- **Internal Padding**: Always `px-1 pb-4` for the form container to avoid border collisions with modal scroll areas.

---

## 5. Form Footer

The footer MUST be clearly separated from the content.

- **Standard**: Sticky at the bottom if the form overflows.
- **Alignment**: Primary action (Save/Create) on the right.
- **Secondary**: Cancel/Back button to the left of the primary action.
- **Contextual**: Delete/Danger actions to the far left.
