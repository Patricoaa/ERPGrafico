---
id: 0082
title: Typography scale reconciliation — semantic tokens, truthful N-levels and shell chrome roles
status: Accepted
date: 2026-10-14
author: frontend-team
---

# 0082 — Typography scale reconciliation

**Related:** `docs/20-contracts/typography-scale.md`, `docs/20-contracts/module-layout-navigation.md` (§2.1), ADR-0079 (shell), ADR-0073 (heading hierarchy), ADR-0068/0069 (badge/CurrencyFlow), `frontend/eslint-rules/typography-token-first.mjs`.

---

## Context

An audit of `docs/20-contracts/typography-scale.md` against the shipped frontend (2026-10) found the contract had drifted from the code in several ways:

1. **Px crudos.** The contract was written as `text-[Npx]` values and claimed they were deliberate. In practice the codebase migrated to the micro tokens (`text-4xs` 9px, `text-3xs` 10px, `text-2xs` 11px), and an ESLint rule (`typography/token-first`) now forbids literal px sizes. A residual literal remained in the shell (`SidebarNavItem` `text-[13px]`).
2. **Micro-label weight was aspirational.** The contract declared `font-black` for every N1/N2 label, but the shipped code standardizes on `font-bold` for micro uppercase labels (table headers in `ui/table.tsx` and `DataTableColumnHeader`, `FormSection`, `SectionHeader`, `LabeledInput`, `StatCard` labels, `PageTabs`), reserving `font-black` for display values (N0), action buttons and the wizard step indicator.
3. **Badge/Chip matrices were stale.** The contract listed `text-[9px]`/`text-[10px]` per Chip/StatusBadge size; `Badge` actually renders `text-xs` for xs/sm/md and only grows at lg (`text-sm`) / xl (`text-base`). Chip wraps Badge and defaults to `size="md"`.
4. **Contradictions in the same document.** The anti-pattern section said "no `font-bold` in buttons, use `font-black`", while the button scale and `component-button.md` disagreed. The shell chrome roles (topbar, rail, module panel, side panel — all introduced by ADR-0079) were not documented anywhere.
5. **`--font-mono` truthfulness.** The contract listed a generic "system monospace stack" while the app bundles JetBrains Mono via `next/font`.

Because the contract is normative (Capa 20), a stale contract makes every consumer a "violation" and hides real drift.

## Decision

1. **The typography contract is expressed in semantic tokens, never px.** `text-4xs/3xs/2xs` are fixed micro sizes for dense chrome; `text-xs/sm` are the fluid body sizes. Literal `text-[Npx]` in features/shell is forbidden; the ESLint rule is extended to also catch `text-[Nrem]`/`text-[N.em]` forms. Documented px exceptions remain (paper receipts, POS critical-touch, avatar).
2. **Micro-label weight is `font-bold`.** N1 section titles, N2 field labels, N2 table headers, N2 pagination literals and N4 tab labels use `font-bold`. `font-black` is reserved for N0 display values, the action-button scale, and the wizard step indicator. The contract's N-level table is corrected to match the shipped standard.
3. **Badge/Chip/StatusBadge matrices are corrected** to the real delegation chain (`Chip`/`StatusBadge` → `Badge`), all `text-xs font-medium` at xs/sm/md; `lg`=`text-sm`, `xl`=`text-base`.
4. **The button scale is unified on `font-black`** (`h-9 text-3xs font-black uppercase tracking-widest`). `CancelButton` is corrected from `font-medium` to `font-black` so adjacent footer actions match. `ToolbarCreateButton` is documented as an explicit toolbar-surface exception (`text-xs font-semibold`), not a form-footer action.
5. **A new "Escala del chrome del shell (ADR-0079)" section** norms the per-role typography of `DashboardShell`, `ModuleRail`, `ModuleSidebarPanel`, `SidebarNavItem`, `SidebarUtilityNav` and `PanelHeader`, and `module-layout-navigation.md §2.1` links to it.
6. **The contract is enforced by a test** (`frontend/lib/__tests__/typography.contract.test.ts`) that asserts the token values, the forbidden-size list and the shell chrome invariants, mirroring `color-system.contract.test.ts`.

## Consequences

- **Easier:** the contract now describes what ships; new shell work has a single normative reference; the lint rule and the contract agree, so violations are actionable.
- **Harder / follow-up:** the wizard step indicator (`font-black`) and the action buttons (`font-black`) remain heavier than micro labels (`font-bold`); unifying them is a deliberate, separate visual change (candidate follow-up). `ui/sidebar.tsx` in the frontend is dead code and its removal is tracked separately.
- **Neutral:** no runtime behaviour changes; this is documentation + token/weight corrections + enforcement.

## Alternatives considered

- **Reweight the code to the contract's `font-black` everywhere.** Rejected: a broad, unrequested visual change across dozens of files, and the `font-bold` split is coherent (heavy = display/action, medium-heavy = labels).
- **Leave the contract aspirational and only fix code.** Rejected: it would keep the normative doc lying about the shipped system and hide drift.
- **Skip the enforcement test, rely on the lint rule only.** Rejected: the lint rule cannot assert *which* token a role uses; a contract test pins the shell chrome roles.

## References

- `docs/20-contracts/typography-scale.md`
- `docs/20-contracts/module-layout-navigation.md`
- `docs/20-contracts/component-chip.md`, `docs/20-contracts/component-button.md`
- `frontend/eslint-rules/typography-token-first.mjs`
- `frontend/lib/__tests__/typography.contract.test.ts`
