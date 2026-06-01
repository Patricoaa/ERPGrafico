---
layer: 20-contracts
doc: color-system
status: active
owner: frontend-team
last_review: 2026-05-29
stability: contract-changes-require-ADR
---

# Color System — Centralized Colorimetry Contract

> Single source of truth for ALL color token definitions, mappings, and usage rules.
> Every other contract that references a color token MUST defer to this document.
> Implementation: `frontend/app/globals.css` within `@theme inline`.

---

## 1. Architecture: 3-Layer Token System

```
┌──────────────────────────────────────────────────────┐
│  LAYER 3 — Domain Natures (Business Concepts)        │
│  income · expense · asset · liability                │
│  → alias to Layer 2                                  │
├──────────────────────────────────────────────────────┤
│  LAYER 2 — Semantic Intents (UI Roles)               │
│  primary · info · success · warning · destructive    │
│  accent · neutral · muted                            │
│  → alias to Layer 1 or standalone                    │
├──────────────────────────────────────────────────────┤
│  LAYER 1 — Process Colors (CMYK + Pantone)           │
│  cyan · magenta · yellow · black                     │
│  red · green · blue                                  │
│  pantone-orange · pantone-violet                     │
│  → raw OKLCH values, fixed identity                  │
└──────────────────────────────────────────────────────┘
```

### Design rationale

- **Layer 1** represents physical printing process colors (CMYK ink values plus derived mixes). These are **fixed** — they do not change between light/dark mode. They exist to ground the UI in the graphic industry vocabulary.
- **Layer 2** adapts process colors to semantic UI roles. Dark mode adaptation happens here: the *intent* stays the same, the *OKLCH value* shifts for contrast.
- **Layer 3** maps business domain concepts to semantic intents. This is the layer that product managers and domain experts reason about.

### Token naming convention

```
--color-{name}     → CSS custom property in @theme inline
Layer 1:           --color-cyan, --color-magenta, --color-yellow, --color-black …
Layer 2:           --color-primary, --color-info, --color-success …
Layer 3:           --color-income, --color-expense, --color-asset, --color-liability …
```

All tokens are consumed via Tailwind utility classes:
`bg-{name}`, `text-{name}`, `border-{name}`, `ring-{name}`, `from-{name}`, `to-{name}`, `via-{name}`.

---

## 2. Layer 1 — Process Colors (CMYK + Pantone)

### 2.1 CMYK Base — The Four Process Inks

| Token | OKLCH (fixed) | CMYK Equivalent | Reference Hex | Description |
|-------|---------------|-----------------|---------------|-------------|
| `cyan` | `0.65 0.18 235` | C100 M0 Y0 K0 | #00aeef | Process Cyan — brand identity, cool |
| `magenta` | `0.55 0.28 340` | C0 M100 Y0 K0 | #ec008c | Process Magenta — graphic-industry ink (ColorBar); **no semantic role** |
| `yellow` | `0.90 0.18 95` | C0 M0 Y100 K0 | #fff200 | Process Yellow — attention, caution |
| `black` | `0.15 0.01 60` | C0 M0 Y0 K100 | #231f20 | Process Black (Key) — pure K100 ink |

> **All Layer 1 tokens are fixed across light/dark mode** — a printing ink does not change because the screen theme does. They ground the UI in the graphic-industry vocabulary and feed ColorBar/process references. Dark-mode contrast adaptation happens one level up, in Layer 2 (see §3.1, §5). Semantic grays (`neutral`, `muted`) derive from `black` but adapt independently (see §3.2).

### 2.2 Derived Process Mixes

| Token | Mix | OKLCH (fixed) | UI Role (via Layer 2) |
|-------|-----|---------------|------------------------|
| `red` | M100 + Y100 | `0.55 0.24 25` | Source of `destructive` |
| `green` | C100 + Y100 | `0.65 0.18 145` | Source of `success` |
| `blue` | C100 + M100 | `0.45 0.22 280` | Source of `info` |

These are the three standard overprint mixes from process color theory. They ensure every UI semantic color is traceable back to a CMYK operation. Like the base inks, they are **fixed** — the perceptual contrast adaptation for dark mode lives in their Layer 2 intents (`destructive`, `success`, `info`), not here.

### 2.3 Pantone Spot Colors

| Token | OKLCH (fixed) | Description |
|-------|---------------|-------------|
| `pantone-orange` | `0.72 0.18 55` | Spot color — available for explicit graphic-industry use, not mapped to any intent |
| `pantone-violet` | `0.50 0.22 300` | Spot color — available for explicit graphic-industry use, not mapped to any intent |

Pantone tokens exist for cases where a spot color is needed outside the CMYK gamut. They are **not** mapped to any semantic intent — use them explicitly when the context calls for a Pantone reference. Neither is wired to `accent` (which is now a neutral interaction surface, see §3.1) — for UI emphasis use `primary`.

### 2.4 Layer 1 Rules

1. **Never use a Layer 1 token directly for UI state.** Use the corresponding Layer 2 semantic intent instead. Exception: `ColorBar.tsx`, `IndustryMark.tsx`, `CropFrame.tsx`, and other graphic-industry-specific components that need to reference the actual process color.
2. **All Layer 1 values are fixed across light/dark mode** — inks and their overprint mixes do not change with the theme. Perceptual-contrast adaptation is a Layer 2 responsibility.
3. **Modifying a Layer 1 value requires an ADR.**

---

## 3. Layer 2 — Semantic Intents

### 3.1 Intent → Process Color Mapping

The **Light OKLCH** column is the value the intent inherits from its Layer 1 source; the **Dark OKLCH** column is the adapted value applied in `.dark` (lighter for perceptual contrast). Layer 1 itself never changes — only these Layer 2 intents do.

| Intent | Light OKLCH | Dark OKLCH | Source Layer 1 | UI Role |
|--------|-------------|-------------|----------------|---------|
| `primary` | `0.65 0.18 235` | `0.72 0.16 235` | `cyan` | Brand identity, primary actions, **emphasis** |
| `info` | `0.45 0.22 280` | `0.58 0.20 280` | `blue` | Informational, neutral states (draft, sent, in-review) |
| `success` | `0.65 0.18 145` | `0.68 0.16 145` | `green` | Positive, active, approved, completed |
| `warning` | `0.90 0.18 95` | `0.94 0.15 95` | `yellow` | Pending, attention required, caution |
| `destructive` | `0.55 0.24 25` | `0.62 0.22 25` | `red` | Error, deletion, danger, cancellation |
| `accent` | `0.90 0.03 240` | `0.22 0.02 240` | `secondary` (neutral) | **Interaction surface** — hover / focus / selected / active. Not an emphasis color. |
| `neutral` | `0.55 0.02 240` | `0.55 0.02 240` | derived from `black` (desaturated) | Inactive, excluded, gray states |
| `muted` | `0.95 0.01 240` | `0.22 0.008 240` | derived from `black` (light/dark bg) | Secondary surfaces, subtle backgrounds |

### 3.2 Neutral & Muted Derivation

- **`neutral`** is a desaturated mid-gray derived from `black` at ~55% lightness. It is **fixed across modes** — a mid-gray is neutral in both light and dark contexts. OKLCH hue `240` gives it a faint industrial-blue cast.
- **`muted`** is a surface background derived from `black` with very low opacity:
  - Light: high lightness (`0.95`) — a very light gray close to white
  - Dark: low lightness (`0.22`) — a dark gray close to the background

These are the **only** tokens that do not directly alias a single Layer 1 color. They use `black` as a reference point but have independent OKLCH values.

### 3.3 Intent → Token CSS Mapping (Canonical)

Every semantic intent uses a standardized opacity pattern across components:

```css
/* Full color */
bg-{intent}        text-{intent}         border-{intent}        ring-{intent}

/* Tinted (standard opacity) */
bg-{intent}/10     text-{intent}         border-{intent}/20

/* Subtle (low opacity) */
bg-{intent}/5      text-{intent}         border-{intent}/10

/* Shadow / glow */
shadow-[0_0_8px_var(--{intent})]
```

**Standard component recipes:**

| Context | Pattern | Example |
|---------|---------|---------|
| Badge / Chip / StatusBadge | `bg-{intent}/10 text-{intent} border-{intent}/20` | `bg-info/10 text-info border-info/20` |
| StatCard (compact) | `bg-{intent}/5 border-{intent}/10` | `bg-success/5 border-success/10` |
| StatCard (default) | `border-l-{intent}` | `border-l-warning` |
| StatCard icon | `bg-{intent}/10 text-{intent} border-{intent}/20` | `bg-destructive/10 text-destructive border-destructive/20` |
| Active ring | `ring-2 ring-{intent} ring-offset-2` | `ring-2 ring-primary ring-offset-2` |
| Trend up | `text-success` | |
| Trend down | `text-destructive` | |
| NumericFlow positive | `text-success` | |
| NumericFlow negative | `text-destructive` | |
| NumericFlow zero | `text-muted-foreground` | |
| MoneyDisplay positive | `text-success` | |
| MoneyDisplay negative | `text-destructive` | |
| Progress complete | `bg-success` + glow | |
| Progress in-progress | `bg-primary` | |
| L1 Section | `text-muted-foreground/70` | |
| L2 Legend (inactive) | `text-muted-foreground` | |
| L2 Legend (focused) | `text-primary` | |
| L3 Data value | `text-foreground` | |
| Structural icon | `text-muted-foreground/50` | |
| Active element icon | `text-primary` | |

### 3.4 Layer 2 Rules

1. **Always use Layer 2 for UI state representation.** Never reference Layer 1 directly in components that express semantic meaning.
2. **`neutral` is for inactive/excluded/expired states.** It is not a "no color" fallback — use `muted` for backgrounds and `text-muted-foreground` for low-emphasis text.
3. **`accent` is a neutral interaction surface** (hover / focus / selected / active), aliased to `secondary`. It is **not** an emphasis color — for emphasis use `primary`. Shadcn primitives (button ghost/outline, dropdown/select/menu focus, calendar range, toggle-on) rely on `accent`/`accent-foreground` being a low-chroma surface; never remap it to a saturated hue.
4. **`muted` is a surface color, not a text color.** Use `text-muted-foreground` for muted text.

---

## 4. Layer 3 — Domain Natures

### 4.1 Financial Natures

| Token | Maps to Layer 2 | Light OKLCH | Business Meaning |
|-------|-----------------|-------------|------------------|
| `income` | `success` | `0.65 0.18 145` | Revenue, sales, gains |
| `expense` | `destructive` | `0.55 0.24 25` | Costs, expenditures, losses |
| `asset` | `info` | `0.45 0.22 280` | Resources owned (cash, AR, inventory) |
| `liability` | `warning` | `0.90 0.18 95` | Obligations owed (AP, debt) |

### 4.2 Product Type Colors

| Type | Token | Light OKLCH | Intent |
|------|-------|-------------|--------|
| `STORABLE` | `info` | `0.45 0.22 280` | Physical inventory (blue = informational) |
| `CONSUMABLE` | `warning` | `0.90 0.18 95` | Consumable supplies (yellow = caution) |
| `MANUFACTURABLE` | `success` | `0.65 0.18 145` | Manufactured goods (green = production) |
| `SERVICE` | `primary` | `0.65 0.18 235` | Services (cyan = brand) |
| `SUBSCRIPTION` | `destructive` | `0.55 0.24 25` | Recurring billing (red = financial flow) |

These are identifiers, not status signals — they use semantic tokens for visual distinction, not for state meaning. Defined in: `typography-scale.md`.

### 4.3 WorkOrder Stage Colors

| Stage | Intent | CMYK Plate | Rationale |
|-------|--------|------------|-----------|
| `MATERIAL_ASSIGNMENT` | `info` | Magenta | Planning / prepress preparation |
| `MATERIAL_APPROVAL` | `warning` | Yellow | Approval bottleneck |
| `OUTSOURCING_ASSIGNMENT` | `info` | Magenta | Coordination |
| `PREPRESS` | `info` | Magenta | Process Magenta plate = prepress |
| `PRESS` | `primary` | Cyan | Process Cyan plate = printing |
| `POSTPRESS` | `warning` | Yellow | Process Yellow plate = finishing |
| `OUTSOURCING_VERIFICATION` | `info` | Magenta | Verification |
| `RECTIFICATION` | `warning` | Yellow | Corrections |
| `FINISHED` | `success` | Green | Complete (C+Y) |
| `CANCELLED` | `destructive` | Red | Terminated (M+Y) |

> **Note:** the *CMYK Plate* column is the conceptual print-process metaphor for each stage, not the literal rendered color. The **rendered** color is always the mapped Layer 2 intent: `info` now renders **blue**, `primary` cyan, `warning` yellow, `success` green, `destructive` red. Process Magenta is reserved for ColorBar / graphic-industry components (§8) and is no longer wired to any stage.

Defined in `state-map.md`.

### 4.4 Data-Viz — Categorical Palette

Charts (recharts) use a dedicated categorical palette, **not** semantic intents. Reusing `success`/`warning`/`destructive` as series colors is forbidden — a chart series is an *identifier*, not a *state*, and overloading them muddles meaning and breaks when an intent changes (e.g. when `accent` became a neutral surface).

The palette maps to the fixed CMYK/spot inks — maximally distinct hues and on-brand for a graphic-industry ERP:

| Token | Source ink | Use |
|-------|-----------|-----|
| `--chart-1` | `cyan` | First / primary series |
| `--chart-2` | `magenta` | Second series |
| `--chart-3` | `green` | Third series |
| `--chart-4` | `pantone-orange` | Fourth series |
| `--chart-5` | `blue` | Fifth series |
| `--chart-6` | `yellow` | Sixth series |

Consume via `fill="var(--chart-N)"` / `stroke="var(--chart-N)"`; cycle with `COLORS[i % COLORS.length]`. A series that is *inherently* the brand may use `var(--primary)`; a series that is *inherently* a state (e.g. a single "loss" bar) may use `var(--destructive)` — but a categorical set must use `--chart-*`. Defined in `frontend/app/globals.css` (`:root`).

---

## 5. Dark Mode Strategy

### 5.1 Principles

- **Layer 1 (process colors + mixes) is fixed.** CMYK inks and their overprints do not change in dark mode. `cyan` stays `cyan`, `black` stays `black`.
- **Layer 2 carries the adaptation.** Each semantic intent has an explicit dark value (implemented in `.dark` in `globals.css`) — lighter and slightly less saturated for perceptual contrast on the dark background — while keeping its hue identity. In dark mode an intent no longer aliases its Layer 1 source; it uses its own value.
- **`neutral` stays fixed** — a mid-gray that works equally in light and dark.
- **`accent` follows `secondary`** — it inverts automatically with the neutral surface.
- **`muted`, surfaces and `background`/`foreground` invert** — light surfaces become dark and vice-versa.

### 5.2 Adaptation Rules

| Layer / token | Dark-mode behavior |
|---------------|--------------------|
| Layer 1 inks + mixes (`cyan`…`blue`, `black`, pantone) | **No change** — fixed identity |
| Layer 2 intents (`primary`, `info`, `success`, `warning`, `destructive`) | Explicit lighter value in `.dark` (≈ +0.07–0.13 L) |
| `neutral` | No change |
| `accent` | Follows `secondary` (auto) |
| `muted` | Invert lightness: `0.95 → 0.22` |
| `foreground` | Invert: `0.12 → 0.93` |
| `background` | Invert: `0.96 → 0.13` |

> The implemented dark values live in the `.dark` block of `globals.css`. The consistency test (`color-system.contract.test.ts`) enforces that Layer 1 raws are **not** overridden in `.dark` while Layer 2 raws **are**.

---

## 6. Sidebar System

Sidebar tokens derive from process colors to maintain the same visual vocabulary:

Values below mirror `globals.css` exactly (`:root` / `.dark` raws fed through `@theme inline`):

| Token | Derives from | Light value | Dark value |
|-------|-------------|-------------|------------|
| `sidebar` | neutral surface | `0.96 0.005 240` | `0.15 0.02 240` |
| `sidebar-foreground` | neutral text | `0.30 0.03 240` | `0.95 0.01 240` |
| `sidebar-primary` | `primary` (raw) | `0.65 0.18 235` | `0.72 0.16 235` |
| `sidebar-primary-foreground` | `primary-foreground` (raw) | `0.20 0.04 235` | `0.10 0.02 235` |
| `sidebar-accent` | sidebar surface @ 5% | `0.96 0.005 240 / 0.05` | `0.95 0.01 240 / 0.05` |
| `sidebar-accent-foreground` | sidebar surface | `0.96 0.005 240` | `0.95 0.01 240` |
| `sidebar-border` | neutral @ 10% | `0.88 0.02 240 / 0.1` | `0.95 0.01 240 / 0.1` |
| `sidebar-ring` | `primary` (raw) | `0.65 0.18 235` | `0.72 0.16 235` |

---

## 7. Opacity Modifier Pattern

Tailwind v4 opacity modifiers (`/10`, `/20`, `/5`, etc.) are the **standard mechanism** for creating tints, not custom CSS variables.

| Opacity | Use case |
|---------|----------|
| `/5` | Subtle background tints (StatCard compact, boolean on) |
| `/10` | Standard tinted backgrounds (Badge, Chip, icon containers) |
| `/15` | Light border emphasis |
| `/20` | Standard border tints (Badge, Chip, StatCard) |
| `/30` | Muted surface tinting |
| `/40` | Subtle borders, structural lines |
| `/50` | Secondary text emphasis on backgrounds |
| `/60` | Lowest-emphasis backgrounds (neutral badge) |
| `/70` | L1 section text |
| `/80` | Hover state for text links |
| `/95` | Near-solid overlays |

---

## 8. Forbidden Patterns

```tsx
// ❌ Raw Tailwind color palette (violates Governance rule 12)
<span className="text-red-500">   // → use text-destructive
<span className="text-blue-600">  // → use text-info
<span className="text-gray-400">  // → use text-muted-foreground
<div className="bg-gray-100">     // → use bg-muted

// ❌ Layer 1 token used for UI state (exception: industry components)
<div className="text-magenta">     // → use text-info for informational content
<div className="bg-yellow">        // → use bg-warning for cautionary states

// ❌ Non-semantic generic colors
<div className="text-emerald-500"> // → use text-success
<div className="bg-amber-300">     // → use bg-warning

// ❌ white/black instead of theme tokens (not theme-aware; white isn't a token, black is Layer 1)
<div className="border-white/10">  // → use border-border
<div className="bg-white">         // → use bg-card / bg-background
<div className="bg-white/5 hover:bg-white/5">  // → bg-card/50 (glass) · hover:bg-accent (interaction)
<span className="bg-success text-white">  // → use text-success-foreground (the paired foreground)

// ❌ Raw black scrim for modal backdrops / image darkeners / veils
<div className="bg-black/50">      // → use bg-overlay/50 (the fixed dark scrim token)

// ❌ Literal hex / rgb in className or inline style
<div className="shadow-[...rgba(245,158,11,0.5)]">  // → oklch(var(--warning-raw)/0.5)
<div style={{ color: '#3b82f6' }}>                 // → style={{ color: 'var(--info)' }}

// ❌ Semantic intent reused as a chart series color
<Cell fill="var(--warning)" />     // → fill="var(--chart-N)" (see §4.4)

// ❌ `muted-primary` — token is prohibited and has been removed from the system
```

> **Foreground pairing:** every solid `bg-{intent}` has a paired `text-{intent}-foreground`. Use it instead of `text-white`/`text-black` so contrast stays correct in both modes.

> **Scrim token:** modal backdrops, image darkeners and veils use `bg-overlay/{N}` (`--color-overlay`, a fixed dark ink that does **not** invert — a scrim stays dark in both themes), never raw `bg-black/{N}`.

### Exceptions

The following are authorized to use process colors (Layer 1), the chart palette, and/or hardcoded values:

| Component | Reason | Token/Value |
|-----------|--------|-------------|
| `ColorBar.tsx` | CMYK printing process control strip | `var(--color-cyan)`, `var(--color-magenta)`, etc. |
| `IndustryMark.tsx` | Graphic industry decoration | `var(--mark-color)`, `var(--mark-color-active)` |
| `CropFrame.tsx` | Image crop overlay | `var(--color-primary)` via inline style |
| Charts (recharts) | Categorical data-viz series | `var(--chart-1…6)` (§4.4) |
| Company branding settings | User-configurable brand colors stored as **data** | `primary_color` / `secondary_color` hex defaults |
| `components/ui/*` overlays | Shadcn base primitives (Dialog/Sheet/AlertDialog) | stock `bg-black/{N}` scrim — do not modify (rule 22) |

---

## 9. Visual Hierarchy Tokens (Form System)

The 3-layer form system uses a fixed set of color tokens (defined in `component-visual-hierarchy.md`):

| Layer | Token | Opacity | State variation |
|-------|-------|---------|-----------------|
| L1 — Section | `text-muted-foreground` | `/70` | — |
| L2 — Legend (inactive) | `text-muted-foreground` | — | — |
| L2 — Legend (focused) | `text-primary` | — | `:focus-within` |
| L3 — Data value | `text-foreground` | — | — |
| Structural icon | `text-muted-foreground` | `/50` | — |
| Semantic icon | Functional (e.g., `text-destructive`) | — | — |
| Active element | `text-primary` or `text-foreground` | — | — |

---

## 10. Cross-Reference Table

| Topic | Referenced in |
|-------|---------------|
| Full component intent→token mappings | `component-chip.md`, `component-statcard.md`, `component-modal.md` |
| Entity state→intent mappings | `state-map.md` |
| Product type color mapping | `typography-scale.md` |
| Row action color rules | `component-row-actions.md` |
| Boolean field state colors | `component-boolean-fields.md` |
| Typography color tokens | `typography-scale.md` |
| Button variant colors | `component-button.md` |
| Design system overview | `10-architecture/design-system.md` |
| Governance (no raw colors) | `90-governance/GOVERNANCE.md` |
| PR checklist | `90-governance/pr-review-checklist.md` |
| Implementation source | `frontend/app/globals.css` — `@theme inline` |
| Badge resolver (runtime mapping) | `frontend/lib/badge-resolvers.ts` |

---

## 11. Governance

- **Modifying a Layer 1 (process color) value requires an ADR.**
- **Modifying a Layer 2 (semantic intent) alias requires an ADR** if the alias target changes.
- **Modifying a Layer 3 (domain nature) alias does NOT require an ADR** — these are business mappings that evolve with domain requirements.
- **Adding a new Layer 1 token requires an ADR.**
- **Adding a new Layer 2 or Layer 3 token** must be documented in this file and approved by the frontend team lead.
- **Violations** of the forbidden patterns (§8) block PR merge (Governance rule 12).
