---
layer: 20-contracts
doc: component-chip
status: active
owner: frontend-team
last_review: 2026-05-15
stability: contract-changes-require-ADR
---

# Chip Component Contract

`Chip` is the single authorized component for all **non-status, non-entity-ID** informational labels: type tags, category pills, feature flags, count indicators, and similar annotations.

- **StatusBadge** → workflow states (POSTED, IN_PRODUCTION, PAID, etc.)
- **EntityBadge** → entity ID prefixes (OC-001, VT-042, etc.)
- **Chip** → everything else: labels, categories, type tags, counters, flags

---

## Import

```tsx
import { Chip } from "@/components/shared"
```

---

## Basic usage

```tsx
<Chip>Almacenable</Chip>
<Chip intent="success">Activo</Chip>
<Chip size="xs" intent="warning">CREDITO</Chip>
<Chip size="md" intent="primary" icon={ShieldCheck}>Sistema</Chip>
```

---

## Props

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `size` | `'xs' \| 'sm' \| 'md'` | ❌ | `'sm'` | See size matrix below |
| `intent` | `'neutral' \| 'info' \| 'success' \| 'warning' \| 'destructive' \| 'primary'` | ❌ | `'neutral'` | Maps to semantic color tokens |
| `icon` | `LucideIcon` | ❌ | — | Rendered at 10–11px, same color as text |
| `className` | `string` | ❌ | — | **Layout/position only.** Never override typography or color here. |
| `children` | `ReactNode` | ✅ | — | Label text |

---

## Size matrix

| `size` | Height | Padding | Font size | Gap | Typical use |
|--------|--------|---------|-----------|-----|-------------|
| `xs` | `h-[18px]` | `px-2` | `text-[9px]` | `gap-1` | Table cells, dense lists, inline annotations |
| `sm` (default) | `h-[22px]` | `px-2.5` | `text-[10px]` | `gap-1` | General UI chrome, form labels, sidebar |
| `md` | `h-[26px]` | `px-3` | `text-[11px]` | `gap-1.5` | Detail views, modal sections, emphasis |

**Invariant typography** (never override): `font-mono font-black uppercase tracking-widest`

---

## Intent → token mapping

| `intent` | Background | Text | Border |
|----------|-----------|------|--------|
| `neutral` (default) | `bg-muted/60` | `text-muted-foreground` | `border-border/50` |
| `info` | `bg-info/10` | `text-info` | `border-info/20` |
| `success` | `bg-success/10` | `text-success` | `border-success/20` |
| `warning` | `bg-warning/10` | `text-warning` | `border-warning/20` |
| `destructive` | `bg-destructive/10` | `text-destructive` | `border-destructive/20` |
| `primary` | `bg-primary/10` | `text-primary` | `border-primary/20` |

---

## When to use each size

**`xs`** — Use inside table cells, next to product names in dropdowns, or as count badges overlaid on buttons. The 18px height fits within a standard `h-10` row without increasing row height.

**`sm`** (default) — The general-purpose size. Use in form sections, wizard steps, card headers, and sidebar annotations.

**`md`** — Use in detail view panels, modal sub-headers, or when the chip needs to match the visual weight of a nearby heading.

---

## The `className` rule

`className` is **layout-only**: `ml-1`, `animate-pulse`, `cursor-help`, `shrink-0`.

Never use `className` to override:
- Font size (`text-[10px]`, `text-sm`)
- Font weight (`font-bold`, `font-semibold`)
- Letter spacing (`tracking-wide`, `tracking-tight`)
- Colors (`text-red-500`, `bg-blue-100`)

These are part of the invariant and are applied internally by `intent` and `size`.

---

## Canonical examples

```tsx
// Type tag in a table cell (product type)
<Chip size="xs" intent="info">Almacenable</Chip>

// BOM status in manufacturing tab
<Chip intent="success">BOM ACTIVA</Chip>
<Chip intent="destructive" className="animate-pulse">SIN RECETA</Chip>

// Count badge on a tab trigger
<Chip size="xs" intent={count > 0 ? "primary" : "neutral"} className="ml-1">
  {count}
</Chip>

// Feature flag in a settings row
<Chip size="xs" intent="primary">SYSTEM</Chip>

// Readonly annotation
<Chip icon={Lock}>Gestionada por sistema</Chip>

// Period chip with icon
<Chip intent="warning" icon={ShieldCheck} className="cursor-help animate-pulse-subtle">
  F29 Cerrado
</Chip>
```

---

## Typography alignment across badge components

All three components share `font-mono uppercase` and `rounded-full border`. The differences below are **intentional** — do not "fix" them:

| Component | Font weight | Letter spacing | Rationale |
|-----------|-------------|----------------|-----------|
| `Chip` | `font-black` | `tracking-widest` | Short tags at small sizes (9–11px) need maximum weight and wide spacing to remain legible |
| `StatusBadge` | `font-black` | `tracking-tight` | Longer state labels ("En Proceso", "Sin Conciliar") at medium sizes — tight tracking prevents overflow |
| `EntityBadge` | `font-black` | `tracking-tight` | ID codes can be long ("OC-2025-001") — same rationale as StatusBadge |

All three now share `font-black` weight for visual consistency. The tracking difference is load-bearing.

---

## Boundary with StatusBadge

Do **not** use `Chip` for workflow states (order status, payment status, work order stage). Those must use `StatusBadge` with the appropriate `variant`. The distinction:

| Question | Answer |
|----------|--------|
| Is it a workflow state that can transition? | `StatusBadge` |
| Is it an entity ID or reference number? | `EntityBadge` |
| Is it a category, type tag, feature flag, or count? | `Chip` |
| Is it a label inside a detail panel or modal section? | `Chip` with `size="sm"` or `size="md"` |

---

## Anti-patterns

```tsx
// ❌ Ad-hoc badge for a type tag
<Badge className="text-[9px] bg-warning/10 text-warning border-none font-black uppercase">
  CREDITO
</Badge>

// ✅ Correct
<Chip size="xs" intent="warning">CREDITO</Chip>

// ❌ Overriding typography in className
<Chip className="font-bold text-sm tracking-normal">Label</Chip>

// ✅ Correct (typography is invariant, className is layout-only)
<Chip className="ml-2">Label</Chip>

// ❌ Using Chip for a workflow state
<Chip intent="success">POSTED</Chip>  // This is a status → use StatusBadge

// ✅ Correct
<StatusBadge variant="invoice" status="POSTED" />
```
