---
layer: 20-contracts
doc: component-section-header
status: active
owner: frontend-team
last_review: 2026-06-30
stability: contract-changes-require-ADR
---

# SectionHeader Component Contract

`SectionHeader` is the single authorized component for **section headings** inside cards and list sections — every repeatable block header in a page must use `SectionHeader`.

| Component | Use case |
|---|---|
| **PageHeader** | Page-level title + breadcrumbs + global actions |
| **PageSectionHeader** | Tabs navigation within a page |
| **SectionHeader** | Individual section heading inside a card or list |

---

## Import

```tsx
import { SectionHeader } from "@/components/shared"
```

---

## Props

```tsx
interface SectionHeaderProps {
    icon: LucideIcon
    title: string
    count?: number
    countLabel?: string
    totalAmount?: number
    href?: string
    variant?: "card" | "list"
}
```

| Prop | Required | Description |
|---|---|---|
| `icon` | Yes | Lucide icon component (rendered at `h-3 w-3`) |
| `title` | Yes | Section title text |
| `count` | No | Optional count badge (renders `· count`) |
| `countLabel` | No | Suffix for count, e.g. `"items"` |
| `totalAmount` | No | Sum of amounts to display with `MoneyDisplay` |
| `href` | No | Link target — without it, "Ver todas" is hidden |
| `variant` | No | `"card"` (default) for inside cards, `"list"` for page sections |

---

## Variants

### `variant="card"` (default)

Used inside card components (`BankOverviewCheckingCards`, `BankOverviewLoanCards`, etc.).

- Renders as a full-width `<button>` with hover-reveal "Ver todas" link
- "Ver todas" starts at `text-muted-foreground/0` and reveals on group hover
- Uses `ArrowRight` icon for the link
- `mb-3` spacing below

```tsx
<SectionHeader
    icon={Landmark}
    title="Cuentas Corrientes"
    count={15}
    href="/treasury/bank-center/2/accounts"
    variant="card"
/>
```

### `variant="list"`

Used for page-level section headings (`BankRecentActivity`, `BankUpcomingMaturities`).

- Renders as a flex row with heading and a visible "Ver todos" button
- "Ver todos" is always visible
- Uses → text arrow (no icon)

```tsx
<SectionHeader
    icon={Receipt}
    title="Movimientos Recientes"
    href="/treasury/bank-center/2/movements"
    variant="list"
/>
```

---

## Heading structure

The inner `<h2>` renders as:

```
[icon] Title · count countLabel · $totalAmount
```

All parts after `title` are optional and appear only when the corresponding prop is provided. Separators (`·`) render automatically between visible elements.

Typography: `text-[10px] font-black uppercase tracking-widest text-muted-foreground`.

---

## Rules

1. **Always use `SectionHeader` for section headings** — never write inline heading markup inside card or list components.
2. **Do not wrap `SectionHeader` in extra containers** — it manages its own spacing (`mb-3`) and layout.
3. **Do not pass `router` or click handlers** — the component uses `useRouter` internally.
4. **Use `variant="list"` only for page-level sections** where "Ver todos" should be persistently visible.
5. **Use `variant="card"` (default) for headings inside cards** where the link is minimally disruptive.
