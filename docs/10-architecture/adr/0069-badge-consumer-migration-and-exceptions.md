---
id: 0069
title: Badge consumer migration and justified visual exceptions
status: Proposed
date: 2026-08-03
author: core-team
---

# 0069 — Badge consumer migration and justified visual exceptions

**Amends:** ADR-0068 (consumer scope), `component-chip.md` (§Documented exceptions)

**Related:** ADR-0068 (CurrencyFlow default), ADR-0065 (DataCell.Status), ADR-0064 (Layer-1 categorical intents), `component-contracts.md` (Forbidden usage), GOVERNANCE §15

---

## Context

ADR-0068 changed the badge **primitives** to the CurrencyFlow aesthetic (`font-sans font-medium text-xs`, borderless, `rounded-sm`). A follow-up audit of every badge/chip/tag consumer (`Chip` ×58, `StatusBadge` ×40, `EntityBadge` ×3, `DataCell.Status/Chip/Category` ~20, plus direct `ui/badge` imports) found three problems:

1. **Direct `@/components/ui/badge` imports bypassed the shared wrapper.** Nine files imported the shadcn primitive directly and used its `variant` system instead of the shared `intent` system — `FacetedFilter` rendered a solid `bg-primary` count, `MultiTagInput`/`MultiSelectTagInput` used `h-6 border-secondary/50 font-bold` tag pills, `ProductSelector` used `outline` with pixel-level `h-4 text-[9px]` overrides, etc. These did not inherit the ADR-0068 default.

2. **Legacy stencil reimplementations were still live.** Ad-hoc `span`/`div` "badges" with `font-black/font-bold uppercase border bg-{intent}/10 rounded-sm/full` existed across ~10 files (`Step2_ManufacturingDetails`, `DraftCartsClientView`, `LoanDetailModal`, `ProductVariantsTab`, `SessionOpenModal`, `WorkOrderKanban`, `AccountingPeriodCloseChecklist`, `TaskActionCard`, `HRSettingsView`, `BillChargesModal`) — the exact look ADR-0068 retired.

3. **A few overrides were actually legitimate patterns**, not violations (notification bubbles, interactive tag pills, monospace codes, POS touch density, inline callouts). They needed to be *documented*, not erased.

## Decision

1. **Every badge consumer migrates to the shared system.** The nine `ui/badge` importers move to `Badge`/`Chip` from `@/components/shared`, mapping shadcn `variant` → `intent` (outline/secondary → `neutral`, success/info/warning/destructive unchanged, default/secondary `bg-primary` → `primary`). Pixel-level overrides (`h-4`, `text-[9px]`, `border-{intent}/50`, `tracking-*`, `font-bold`, `uppercase`) are removed; `size="xs"` covers dense surfaces.

2. **Legacy stencils are replaced by `Chip`/`Chip.Category`/`StatusBadge`.** Ad-hoc `font-black uppercase border` pills become standard chips with the matching `intent`. Workflow-state-like chips that already have a status renderer use `StatusBadge` only if they are real workflow states; otherwise `Chip`.

3. **`ui/badge.tsx` becomes a private primitive.** Its direct import is now forbidden (`component-contracts.md` §Forbidden usage). The shared `Badge` is the single source of visual truth.

4. **Justified exceptions are codified in `component-chip.md` §Documented exceptions** (the only allowed relaxations, audited below). New consumers must reuse these named exceptions; inventing a new one requires an ADR:

   | Exception | Consumers | Allowed deviation |
   |-----------|-----------|-------------------|
   | Notification bubbles | `UserActions`, `DraftCartsClientView` count, `QuickActionsMenu` | `rounded-full border-2 border-background`, `font-black`, `text-[9px]`; not `Chip`/`Badge` |
   | Interactive tag-input pills | `MultiTagInput`, `MultiSelectTagInput` | shared `Badge intent="neutral" size="sm"` + `animate-in` + `IconButton` close; no typography overrides |
   | Monospace codes/SKU/version/% | `ProductVariantsTab`, `ReconciliationPanel`, `SettingsPageClient`, `ReconciliationIntelligencePanel`, `ProductManufacturingTab`, `UnifiedNoteWizard`, `bomFields` | `className="font-mono"` is the only authorized typographic override |
   | Inline notice/validation callouts | `TaskActionCard`, `ManualTerminalNotice` (`/* intentional: badge density */`), `SessionCloseModal`, `Step1_Customer`, `Step2_PurchaseDTE`, `ProductClientView` | plain `div`/`Alert`, border allowed; not the Chip stencil |
   | POS touch density | `ProductSelector` (POS grid) | standard `size="xs"` (18px); no pixel-level overrides |

5. **`EntityCard.Badge` prop `variant` is replaced by `intent`** (zero external consumers confirmed by grep); the internal badge now renders the standard tinted `size="sm"` chip and drops its `uppercase tracking-wide` legacy override.

## Consequences

### Positivas
- Uniform application of the ADR-0068 aesthetic across all ~130 badge consumers; zero `ui/badge` imports remain.
- Legacy stencil duplicates eliminated — one visual system, one implementation.
- Exceptions are explicit and auditable instead of accidental.

### Negativas
- Broad diff (~25 source files); requires visual QA of POS (ProductSelector), checkout (Step2), filters (FacetedFilter) and tag inputs.
- `EntityCard.Badge` API change (contract); mitigated by zero consumers.
- Tag-input pills lose their `h-6`/border look in exchange for the standard `size="sm"` tinted badge.

### Archivos modificados
- **Shared:** `AutoSaveStatusBadge`, `EntityCard`, `FacetedFilter`, `MultiTagInput`, `MultiSelectTagInput`, `UniversalSearch`
- **Features/app:** `JobsView`, `ProductManufacturingTab`, `ProductSelector`, `Step2_ManufacturingDetails`, `DraftCartsClientView`, `LoanDetailModal`, `ProductVariantsTab`, `SessionOpenModal`, `WorkOrderKanban`, `AccountingPeriodCloseChecklist`, `TaskActionCard`, `HRSettingsView`, `BillChargesModal`, `UnifiedNoteWizard`, `NoteItemsSummary`, `Step1_Items`, `NoteStep_LineItems`, `ProfileSidePanel`, `ReconciliationPanel`, `AddPartnerModal`
- **Docs:** `component-chip.md` (§Documented exceptions), `component-contracts.md` (Chip + Forbidden usage), ADR README, ADR-0068 (consumer scope pointer)

## Alternatives considered

- **Leave `ui/badge` importers as-is:** rejected — they render with the shadcn `variant` palette, not the shared `intent` system, so they missed the ADR-0068 default.
- **Add a dedicated `Tag`/`InputChip` component for tag inputs:** rejected for now — the interactive pill pattern is small and reuses `Badge`; a dedicated interactive tag primitive can be split out later if tag inputs grow.
- **Keep legacy stencils as "intentional legacy":** rejected — the user asked for a uniform application; undocumented legacy duplicates were the audit's core finding.

## References

- `docs/10-architecture/adr/0068-badge-currencyflow-default.md` — the default this ADR applies to every consumer
- `docs/10-architecture/adr/0065-datacell-status-ghost-pill-unification.md` — table-cell presentation superseded by 0068
- `docs/20-contracts/component-chip.md` §Documented exceptions — the audited exceptions table
- `docs/20-contracts/component-contracts.md` §Forbidden usage — `ui/badge` direct import ban
- `docs/90-governance/GOVERNANCE.md` — §15 border radius, §18 status renderer
