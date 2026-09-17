---
id: 0071
title: Ledger ink metaphor carve-out (Cyan/Magenta/Yellow in the ledger summary)
status: Accepted
date: 2026-09-17
author: frontend-team
---

# 0071 — Ledger ink metaphor carve-out (Cyan/Magenta/Yellow in the ledger summary)

**Related:** ADR-0029 (Color system), ADR-0064 (Layer-1 categorical intents), `color-system.md` (§2.4, §4.5, §8, §11), `docs/50-audit/design-system-ui-audit.md` (§4.4, §8.2, T3)

---

## Context

The accounting ledger summary (`LedgerDrawer` / `LedgerSummaryPanel`) renders the four account figures using the graphic-industry ink vocabulary:

| Figure | Treatment |
|--------|-----------|
| Saldo Inicial | neutral (`foreground`), not an ink |
| Cargos (Debe) | Process Cyan |
| Abonos (Haber) | Process Magenta |
| Saldo Final | Process Yellow |

`color-system.md` §2.4 reserves Layer 1 inks for UI *identity* (`ColorBar`, charts, categorical chips — ADR-0064) and forbids using them for semantic meaning; §8 lists the authorized exceptions. The ledger case is neither a chart nor a categorical chip: the ink **does** encode meaning (Debit / Credit / Balance), which makes it a genuine exception to the contract rather than an existing rule.

Two facts force an explicit decision:

1. **The metaphor is deliberate** (product/design taste, resolved in the design review §8.2): an accounting ledger rendered in printing inks is on-brand for a graphic-industry ERP.
2. **The inks fail WCAG as text.** Measured on the fixed OKLCH values (§2.1) against light surfaces: Cyan `2.5:1`, Yellow `1.2:1`, Magenta `4.2:1` (all below the 4.5:1 AA threshold for small text; Magenta also falls to `3.1:1` on its own dark tint). They perform well on the dark surface (6.7:1 / 14.8:1 / 4.0:1).

Keeping the metaphor therefore requires keeping the ink as a *non-text* carrier and taking the label text to a legible token.

## Decision

1. **Authorize a scoped carve-out**: the ledger summary is allowed to use Process Cyan / Magenta / Yellow as a fixed identity metaphor, added to the exception table of `color-system.md` §8 and documented in a new §4.6.
2. **Ink lives on border, tinted background and icon** (`border-{ink}/30`, `bg-{ink}/10`, `bg-{ink}/20`, `text-{ink}` on the icon only). These are decorative/graphical carriers; the meaning is also in the label text, so they are exempt from SC 1.4.11.
3. **Label text uses `text-foreground`** (18:1 on light, 16:1 on dark). The ink is *not* used as small text — this fixes the SC 1.4.3 failures without dropping the metaphor.
4. **Cue icons are mandatory** (`ArrowUpRight` for Cargos, `ArrowDownRight` for Abonos, `Scale` for Saldo Final, `Calculator` for Saldo Inicial) so the distinction survives color-blindness.
5. **Enforce with a contract test** (`frontend/lib/__tests__/semantic-ink.test.ts`): the set of files allowed to contain raw `cyan|magenta|yellow` utilities is an explicit allowlist (`Badge`, `TabBar`, `DataTableCells`, `LedgerSummaryPanel`, `Cart`, `POSApprovalCard`). Any new file is blocked until classified.
6. **Never `destructive` for balances**; no `.dark` override for the inks (Layer 1 stays fixed).

## Consequences

### Positivas
- The ledger keeps its on-brand C-M-Y identity while meeting WCAG AA for its labels.
- The carve-out is now bounded and testable: the allowlist makes "0 semantic ink uses" enforceable in CI instead of a manual count.
- The semantic content lives in text + icon, so the summary reads correctly without color.

### Negativas
- The contract has a new exception; `color-system.md` §8 and §11 must carry it (this ADR provides the required approval).
- Ink-colored labels are gone in the light theme (they were illegible); the metaphor is now border/tint/icon-led.
- The ledger comparison cards were extracted into `LedgerSummaryPanel` so the carve-out and its test have a single, dependency-light surface.

### Archivos modificados
- `frontend/features/accounting/components/LedgerSummaryPanel.tsx` — new presentational surface (carve-out + cues)
- `frontend/features/accounting/components/LedgerDrawer.tsx` — uses `LedgerSummaryPanel`, documents the metaphor
- `frontend/lib/__tests__/semantic-ink.test.ts` — new allowlist guard
- `frontend/features/accounting/components/__tests__/LedgerSummaryPanel.test.tsx` — renders the four figures + cue icons
- `docs/20-contracts/color-system.md` — §4.6, §8 exceptions, §11 governance note

## Alternatives considered

- **Map Debe/Haber/Saldo to semantic intents** (`success`/`warning`/`info`): rejected by the design review — it discards the deliberate printing metaphor and would mislabel Debit/Credit as "positive/negative" states, which accounting does not assert.
- **Keep ink-colored labels**: rejected — fails SC 1.4.3 in the light theme (Cyan 2.5:1, Yellow 1.2:1).
- **Adapt the inks for dark mode**: rejected — Layer 1 is fixed by definition (§2.4); adaptation is a Layer 2 responsibility and would break the "process ink" identity.
- **Darken the ink with an opacity/size trick**: rejected — the inks are fixed values; no opacity makes Yellow readable as small text on a light surface.

## References

- `docs/20-contracts/color-system.md` — §2.4 Layer 1 rules, §4.5 categorical chips, §8 exceptions, §11 governance
- `docs/10-architecture/adr/0064-badge-layer1-categorical-intents.md`
- `docs/10-architecture/adr/0029-color-system-robustening.md`
- `docs/50-audit/design-system-ui-audit.md` — §4.4 census, §8.2 decision, T3
