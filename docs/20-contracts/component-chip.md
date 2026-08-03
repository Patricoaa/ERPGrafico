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
// 1. Uso básico (Ad-hoc)
<Chip>Almacenable</Chip>
<Chip intent="success">Activo</Chip>
<Chip size="xs" intent="warning">CREDITO</Chip>
<Chip size="md" intent="primary" icon={ShieldCheck}>Sistema</Chip>

// 2. Uso Inteligente (Recomendado)
<Chip.Category domain="product_type" value="STORABLE" />
<Chip.Flag isTrue={isActive} trueLabel="Activo" falseLabel="Inactivo" falseIntent="destructive" />
<Chip.Count value={count} label="Seleccionados" hideOnZero />
```

---

## Props

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `size` | `'xs' \| 'sm' \| 'md'` | ❌ | `'sm'` | See size matrix below |
| `intent` | `'neutral' \| 'info' \| 'success' \| 'warning' \| 'destructive' \| 'primary' \| 'cyan' \| 'magenta' \| 'yellow' \| 'black'` | ❌ | `'neutral'` | Maps to semantic tokens (Layer 2) or, for categorical chips, the fixed process inks `cyan`/`magenta`/`yellow`/`black` (Layer 1, ADR-0064) |
| `appearance` | `'solid' \| 'ghost'` | ❌ | `'solid'` | `ghost` removes the background tint (borderless default). Never changes typography |
| `icon` | `LucideIcon` | ❌ | — | Rendered at 10–11px, same color as text |
| `className` | `string` | ❌ | — | **Layout/position only.** Never override typography or color here. |
| `children` | `ReactNode` | ✅ | — | Label text |

---

## Size matrix

| `size` | Height | Padding | Font size | Gap | Typical use |
|--------|--------|---------|-----------|-----|-------------|
| `xs` | `h-[18px]` | `px-2` | `text-[9px]` | `gap-1` | Table cells, dense lists, inline annotations |
| `sm` (default) | `h-[22px]` | `px-2.5` | `text-[10px]` | `gap-1` | General UI chrome, form labels, sidebar |
| `md` | auto | `px-2 py-0.5` | `text-xs` | `gap-1` | Detail views, modal sections, emphasis |

**Invariant typography** (never override): `font-sans font-medium text-xs`, borderless, `rounded-sm` (CurrencyFlow aesthetic, ADR-0068).

---

## Intent → token mapping

| `intent` | Background | Text | Border |
|----------|-----------|------|--------|
| `neutral` (default) | `bg-muted/60` | `text-muted-foreground` | none (borderless) |
| `info` | `bg-info/10` | `text-info` | none (borderless) |
| `success` | `bg-success/10` | `text-success` | none (borderless) |
| `warning` | `bg-warning/10` | `text-warning` | none (borderless) |
| `destructive` | `bg-destructive/10` | `text-destructive` | none (borderless) |
| `primary` | `bg-primary/10` | `text-primary` | none (borderless) |

### Layer 1 categorical intents (ADR-0064)

For categorical chips only (`Chip.Category`, field type `chip-category`) — never for workflow state. Fixed process inks, no dark-mode override:

| `intent` | Background | Text | Border |
|----------|-----------|------|--------|
| `cyan` | `bg-cyan/10` | `text-cyan` | none (borderless) |
| `magenta` | `bg-magenta/10` | `text-magenta` | none (borderless) |
| `yellow` | `bg-yellow/10` | `text-yellow` | none (borderless) |
| `black` | `bg-black/10` | `text-black` | none (borderless) |

Domain mapping: `payment_method` → CASH=`cyan`, CARD/CARD_TERMINAL/DEBIT_CARD/CREDIT_CARD=`magenta`, TRANSFER=`yellow`, CHECK=`black`, OTHER=`neutral` (`color-system.md §4.5`).

---

## Appearance (`ghost`)

`appearance="ghost"` renders the chip without its background tint — it keeps the intent text color and removes **only** the background (borderless by default, ADR-0068). It never changes typography: `font-sans font-medium text-xs` applies to both `solid` and `ghost`.

**Dense-table note:** `DataCell.Chip` and `DataCell.Status` render the standard solid tinted badge (same as CurrencyFlow columns). The legacy ghost-pill presentation (ADR-0065) was superseded by ADR-0068.

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
<Chip.Category domain="product_type" value="STORABLE" />

// BOM status in manufacturing tab
<Chip.Flag isTrue={hasBom} trueLabel="BOM ACTIVA" falseLabel="SIN RECETA" falseIntent="destructive" />

// Count badge on a tab trigger
<Chip.Count value={count} size="xs" />

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

All three components share the **CurrencyFlow aesthetic** (ADR-0068): `font-sans font-medium text-xs`, borderless, `rounded-sm`, normal tracking. The legacy `font-mono font-black uppercase border rounded-full` look is no longer a default — it is only reachable via explicit `className` overrides in legacy consumers.

| Component | Font weight | Letter spacing | Rationale |
|-----------|-------------|----------------|-----------|
| `Chip` | `font-medium` | normal | Tags and annotations follow the standard data-cell typography |
| `StatusBadge` | `font-medium` | normal | Same unified look as every other badge in the app |
| `EntityBadge` | `font-medium` | normal | ID codes render at `text-xs` with the standard weight |

All three share `font-sans font-medium text-xs` for visual consistency with `DataCell.CurrencyFlow`.

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
<StatusBadge status="POSTED" variant="badge" />
```

---

## Documented exceptions (ADR-0069)

The CurrencyFlow default applies to every badge/chip/tag. A small set of **justified** exceptions exists; they are the only places where the rules above may be relaxed. All are audited and must be referenced from ADR-0069.

| Exception | Where | Rationale | Allowed deviation |
|-----------|-------|-----------|-------------------|
| **Notification bubbles** | `UserActions.tsx:193`, `DraftCartsClientView.tsx:383`, `QuickActionsMenu` | Unread-count convention on icons (`99+`, dot bubbles) | `rounded-full border-2 border-background`, `font-black`, `text-[9px]`. Do **not** use `Chip`/`Badge` for these. |
| **Interactive tag-input pills** | `MultiTagInput.tsx`, `MultiSelectTagInput.tsx` | Removable tag pills with an X button — interactive, not static labels | Use shared `Badge intent="neutral" size="sm"` + `animate-in zoom-in-95` + `IconButton` close. No typography overrides. |
| **Monospace for codes/SKU/version/%** | `ProductVariantsTab` SKU, `ReconciliationPanel` codes, `SettingsPageClient` versions, `ReconciliationIntelligencePanel` %, `ProductManufacturingTab` item count, `UnifiedNoteWizard` ref, `bomFields` hints | Technical identifiers and numeric readouts read better in `font-mono` | `className="font-mono"` is the **only** authorized typographic override. Never combine with `uppercase`/`font-bold`/custom sizes. |
| **Inline notice/validation callouts** | `TaskActionCard` (validation boxes), `ManualTerminalNotice` (`/* intentional: badge density */`), `SessionCloseModal`, `Step1_Customer`, `Step2_PurchaseDTE`, `ProductClientView` | Alert/notice boxes with icon + sentence text — not badges | Rendered as plain `div`/`Alert`. Border is allowed for affordance. Do not apply the Chip stencil. |
| **POS touch density** | `ProductSelector` (POS grid) | High-density touch UI uses the smallest standard size | Standard `size="xs"` (18px). No pixel-level `h-4`/`text-[9px]` overrides. |

These exceptions exist so the invariant stays strict everywhere else. If a new consumer needs one of these patterns, reuse the named exception — never invent a new one without an ADR.
