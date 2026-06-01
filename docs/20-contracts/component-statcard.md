---
layer: 20-contracts
doc: component-statcard
status: active
owner: frontend-team
last_review: 2026-05-24
stability: contract-changes-require-ADR
---

# StatCard Component Contract

`StatCard` is the single authorized component for all **summary / KPI / metric cards** across the application — dashboard numbers, insight stats, ratio displays, and any card whose primary purpose is to surface a value + label.

- **StatCard** → summary KPIs, dashboard metrics, insight cards, stat boxes
- **`<Card>` raw** → generic containers with arbitrary content (forms, detail panels, charts)
- **`EntityCard`** → entity summary cards with ID + status + actions

---

## Import

```tsx
import { StatCard } from "@/components/shared"
```

---

## Basic usage

```tsx
// 1. Default variant (dashboard KPI)
<StatCard
  label="Ventas Totales"
  value={<MoneyDisplay amount={sales.total_sales} digits={0} />}
  icon={DollarSign}
  trend={{ direction: "up", value: "+12.5% vs período anterior" }}
  accent="info"
/>

// 2. Compact variant (insight modal, tinted bg)
<StatCard
  label="Ventas Totales"
  value={<>{data.total_sold} <span className="text-xs">uds</span></>}
  variant="compact"
  accent="success"
/>

// 3. Minimal variant (stat box inside a card or modal)
<StatCard
  label="Procesadas"
  value={progress.processed}
  subtext={`de ${progress.total}`}
  variant="minimal"
  accent="muted"
/>

// 4. Clickable filter card
<StatCard
  label="Total"
  value={metrics.total}
  onClick={() => setActiveFilter('all')}
  active={activeFilter === 'all'}
  accent="primary"
/>

// 5. With href (navigable)
<StatCard
  label="Sin Conciliar"
  value={lines.pending}
  icon={Clock}
  subtext="Movimientos por procesar"
  href="/treasury/reconciliation?tab=statements"
  accent="warning"
/>

// 6. With children (extra content inside card)
<StatCard label="Tasa de Conciliación" value={`${rate}%`} accent="success">
  <Progress value={rate} className="h-1.5 mt-1" />
</StatCard>
```

---

## Props

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `label` | `string` | ✅ | — | Card title / metric name |
| `value` | `ReactNode` | ✅ | — | The metric value. Use `MoneyDisplay` for currency |
| `icon` | `LucideIcon` | ❌ | — | Placed in CardHeader (default) or inline (compact) |
| `subtext` | `string` | ❌ | — | Description or secondary label |
| `trend` | `{ direction: 'up' \| 'down'; value: string; label?: string }` | ❌ | — | Renders TrendingUp/Down icon + text |
| `accent` | `'primary' \| 'info' \| 'success' \| 'warning' \| 'destructive' \| 'accent' \| 'muted'` | ❌ | `'primary'` | Maps to border tint, bg tint, icon color (see accent map) |
| `variant` | `'default' \| 'compact' \| 'minimal'` | ❌ | `'default'` | See variant specs below |
| `valueSize` | `'sm' \| 'md' \| 'lg' \| 'xl'` | ❌ | `'lg'` | sm = `text-lg`, md = `text-xl`, lg = `text-2xl`, xl = `text-3xl` |
| `href` | `string` | ❌ | — | Wraps card in `<Link>` |
| `onClick` | `() => void` | ❌ | — | Makes card clickable (role="button") |
| `active` | `boolean` | ❌ | `false` | Adds ring-2 ring-offset-2 for filter cards |
| `loading` | `boolean` | ❌ | `false` | Shows Skeleton placeholder |
| `children` | `ReactNode` | ❌ | — | Rendered after value/subtext inside card content |
| `className` | `string` | ❌ | — | Container overrides (see className rule below) |

---

## Variant specs

### `default` (dashboard KPI)
```
┌─────────────────────────────┐
│ label                  [icon]│  ← CardHeader
├─────────────────────────────┤
│ V A L U E                   │  ← text-2xl font-black font-heading
│ ▲ trend text / subtext      │
│ [children]                  │
└─────────────────────────────┘
```
- Wrapper: `<Card>` with `border-l-4 border-l-{accent}` + `shadow-sm`
- When `onClick`: `cursor-pointer hover:border-primary/20`
- When `active`: `ring-2 ring-{accent} ring-offset-2`
- When `href`: wrapped in `<Link>`

### `compact` (insight modal, tinted)
```
┌─────────────────────────────┐
│ label                  [icon]│  ← CardContent (no CardHeader)
│ V A L U E                   │  ← text-xl font-black
│ subtext                     │
└─────────────────────────────┘
```
- Wrapper: `<Card>` with `bg-{accent}/5 border-{accent}/10`
- No CardHeader — label is a `<p>` inside CardContent

### `minimal` (stat box)
```
┌──────────────────────┐
│ LABEL                 │  ← text-[10px] font-black uppercase
│ VALUE                 │  ← valueSize * font-black font-heading
│ subtext               │
└──────────────────────┘
```
- Wrapper: `<div>` with `rounded-lg bg-{accent}/5 border-{accent}/20 p-3`
- No Card components — smallest footprint
- Value uses `accentText[accent]` color
- `className` can override padding/border-radius for special cases

---

## Accent → token mapping

| `accent` | `default` border-l | `compact`/`minimal` bg | Icon color |
|----------|--------------------|------------------------|------------|
| `primary` (default) | `border-l-primary` | `bg-primary/5 border-primary/10` | `text-primary` |
| `info` | `border-l-info` | `bg-info/5 border-info/10` | `text-info` |
| `success` | `border-l-success` | `bg-success/5 border-success/10` | `text-success` |
| `warning` | `border-l-warning` | `bg-warning/5 border-warning/10` | `text-warning` |
| `destructive` | `border-l-destructive` | `bg-destructive/5 border-destructive/10` | `text-destructive` |
| `accent` | `border-l-accent` | `bg-accent/5 border-accent/10` | `text-accent` |
| `muted` | `border-l-muted` | `bg-muted/30 border-border/40` | `text-muted-foreground` |

---

## Value size matrix

| `valueSize` | Font size | Typical use |
|-------------|-----------|-------------|
| `sm` | `text-lg` | Compact cards with long values |
| `md` | `text-xl` | Medium emphasis (e.g., financial cards with subtext) |
| `lg` (default) | `text-2xl` | Standard dashboard KPI |
| `xl` | `text-3xl` | Hero metrics, ratios, percentage displays |

---

## The `className` rule

`className` is for **layout/position overrides and special visual treatments**:

```tsx
// ✅ Layout overrides
<StatCard className="col-span-full" />           // Grid spanning
<StatCard className="md:col-span-2" />           // Responsive layout
<StatCard className="text-center" />             // Center alignment (minimal variant)

// ✅ Special visual treatments
<StatCard className="bg-white/5 backdrop-blur-sm" />  // Glass aesthetic
<StatCard className="bg-foreground text-background" /> // Inverted colors (keep using Card for this)

// ❌ Do NOT use className to override typography
<StatCard className="text-sm font-normal" />     // Use valueSize prop instead
```

For unique visual treatments (glass, inverted colors) that go beyond accent-based theming, pass the appropriate classes via `className`. The component's internal styles provide a sensible base.

---

## When to use each variant

### `default`
**Dashboard overviews, page-level KPIs, grid of 3–7 metrics.** Examples: BIAnalyticsView, RatiosView, DashboardKPIs, PortfolioKpiGrid, BudgetDetailView.

- Has `border-l-4` accent bar
- Icon in CardHeader (top-right)
- Value is always `text-foreground` (accent is in the border + icon)

### `compact`
**Modal insight panels, summary stats inside tabs.** Examples: ProductInsightsModal, SubscriptionHistoryModal.

- Tinted background `bg-{accent}/5`
- No border-left accent bar
- Tighter spacing, smaller typography

### `minimal`
**Stat boxes inside other Cards, progress modals, accordion sections.** Examples: ProductionMetricsCard inner metrics, AutoMatchProgressModal, SubscriptionsView, EquityStatsSheet, PartnerProfileTab.

- Plain `<div>` wrapper (no Card component)
- Value inherits `accentText[accent]` color
- Smallest footprint — use `className` for custom padding/alignment

---

## Anti-patterns

```tsx
// ❌ Raw Card for a simple KPI
<Card>
  <CardHeader><CardTitle>Ventas Totales</CardTitle></CardHeader>
  <CardContent>
    <MoneyDisplay amount={total} />
  </CardContent>
</Card>

// ✅ Correct — use StatCard
<StatCard label="Ventas Totales" value={<MoneyDisplay amount={total} />} />

// ❌ Raw div for a metric box
<div className="bg-success/5 rounded-lg p-3 text-center">
  <p>Conciliadas</p>
  <p className="text-2xl">{count}</p>
</div>

// ✅ Correct — use StatCard minimal variant
<StatCard label="Conciliadas" value={count} variant="minimal" accent="success" className="text-center" />

// ❌ Overriding value typography
<StatCard label="X" value={42} className="text-3xl" />

// ✅ Correct — use valueSize
<StatCard label="X" value={42} valueSize="xl" />

// ❌ StatCard for generic content containers
<StatCard label="Configuración">
  <AccountSelector ... />
</StatCard>

// ✅ Correct — use raw <Card>
<Card><CardContent><AccountSelector ... /></CardContent></Card>
```

---

## Boundary with raw `<Card>`

| Question | Answer |
|----------|--------|
| Is it a summary KPI / metric / stat number? | `StatCard` |
| Is it a generic container with arbitrary content (form, chart, table)? | raw `<Card>` |
| Is it an entity card with ID + status + actions? | `EntityCard` |
| Is it the card that wraps a title + description + chart? | raw `<Card>` with `<CardHeader>` |
| Is it a display-only value with label and optional icon/trend? | `StatCard` |
