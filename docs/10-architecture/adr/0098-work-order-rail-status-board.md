---
id: 0098
title: Work order rail as a status board — per-stage evidence, blockers, progress and collapse
status: Accepted
date: 2026-10-23
author: frontend-team
---

# 0098 — Work order rail as a status board

**Related:** ADR-0096 (wizard step rail), ADR-0070 (Primary = K100), `docs/20-contracts/component-modal.md` (Sidebar primitives), `docs/20-contracts/color-system.md`

---

## Context

ADR-0096 rebuilt the shared rail (`WizardStepsSidebar`) and promised a sticky
header plus `detail` for active and past steps. The work-order adapter
(`WizardProcessSidebar`) never passed `detail`, so in the OT — the longest
wizard, 13 stages — the rail remained a table of contents:

- No per-stage evidence: materials, approvals, history and specs were already in
  the detail payload but never surfaced.
- Blockers were invisible until the operator tried to advance and the backend
  rejected the transition.
- The header counter `03 / 13` used `viewingStepIndex`, not the real stage, so it
  read as progress while only describing what was on screen.
- Rules (view / edit / rewind) were `hidden group-hover:flex`: unreachable on
  tablets, keyboard and touch.
- `CANCELLED` is excluded from `BASE_STAGES`, so `actualStepIndex` is `-1` and
  the wizard opened at the first step without explaining why nothing advanced.
- The sticky header was promised but the header was a plain flex child.

The backend already returns `stage_history` (prefetched, descending) and the
detail endpoint includes `workflow_tasks` and `materials`. The missing piece was
a frontend projection, not new data.

## Decision

Adopt **Direction C — the rail is a status board**, not a table of contents. It
subsumes the earlier alternatives (process trail and accessible governance).

### 1. Evidence model (pure, memoizable)

`features/production/lib/stageEvidence.ts` derives one `StageEvidence` per stage
from data the detail endpoint already returns:

- `stage_history`: latest entry per stage → `enteredAt` / `enteredBy`.
- `workflow_tasks`: approval task types mapped to their stage → pending and
  completed counts.
- `materials`: manual stock availability (available / missing) and outsourced
  service count.

`stageSummary()` renders the one-line detail (origin, quantities, availability,
approval progress, specs or "Desde 12/10 · Ana"). `stageGroup()` chunks the
rail into **Preparación / Producción / Cierre**.

### 2. Rail anatomy

```
ETAPAS                          Viendo 06 / 13
[██████████░░░░░░░░░░░░]  46%
─────────────────────────────────────────────
Preparación
✓ 01  Origen de Fabricación
      Vinculada a OV #123
⦿ 02  Asignación de Materiales
      3/5 disponibles · 2 faltantes  ⚠
...
Producción
○ 07  Pre-prensa
```

- Sticky header with two independent signals: **Viendo NN/NN** (what is on
  screen) and **progress bar** (where the OT really is).
- Progress-aware connector: completed portion in `success`, remaining in
  `border`.
- Group labels before the first step of each section.
- `warning` icon + native title + `aria-label` on the row, only for current and
  future stages (past blockers are history, not actionable).
- Detail remains `ReactNode`; the OT adapter passes strings derived from
  `stageEvidence`.

### 3. Contract additions (all optional)

`WizardSidebarStep`:

- `group?: string`
- `warning?: string`

`WizardStepsSidebar`:

- `progressPercent?: number` (0–100; enables progress bar + spine)
- `counterLabel?: string` (e.g. `"Viendo"`)

Compatibility: other adapters (sales, notes, purchasing) keep the gradient
connector when `progressPercent` is absent and the plain `NN / NN` counter when
`counterLabel` is absent.

### 4. Terminal states

- `CANCELLED`: no progress bar, rail read-only, explicit header note
  (`Orden cancelada · solo lectura`); blockers are suppressed because they are
  no longer actionable; governance actions are not rendered.
- `FINISHED`: progress 100 %, header note (`Producción finalizada`), no
  "next stage" action; blockers are suppressed for the same reason.
- The sticky footer collapses to a single **Cerrar** action in both terminal
  states, and the `ArrowRight` transition shortcut is guarded for `CANCELLED`
  as well as `FINISHED`.
- The mobile drawer mirrors the terminal note in its subtitle and body.
- Future steps are non-clickable by construction (`isFuture` is part of
  `isClickable`), not only when the adapter remembers to set `disabled`.

### 5. Accessibility

- Sticky header is a real sticky element, not a visual imitation.
- Row button label includes stage number, warning and availability.
- Detail is linked with `aria-describedby`.
- Actions are reachable without hover (focus-within / coarse pointer).
- Blocked reasons are exposed on a wrapper element, because disabled buttons do
  not fire tooltips reliably.

### 6. Mobile

The `md:hidden` stage `<select>` is replaced by a compact stage trigger that
opens a bottom sheet with the same status board (labels, detail, warnings,
current/actual markers).

### 7. Collapse

Power users can collapse the rail to an icon-only strip (persisted per browser).
Expanded is the default. Collapsed mode keeps tooltips/aria labels and the
connector, and hides actions until expanded.

## Implementation phases

| Phase | Scope | Commit theme |
|-------|-------|--------------|
| 0 | `WorkOrderHistoryEntry`, `stage_history`, `deriveStageEvidence`, task→stage map, tests | `stage evidence model` |
| 1 | Sticky header, dual counter, progress bar/spine, groups, warnings, OT detail | `rail as status board` |
| 2 | Keyboard/touch actions, blocked reasons, aria labels | `rail accessibility` |
| 3 | Collapsible icon-only rail + persistence | `collapsible rail` |
| 4 | Mobile stage bottom sheet | `mobile stage sheet` |
| 5 | Terminal states, final tests, contract/ADR update | `terminal states` |

## Consequences

### Positive

- Operators see *why* a stage is blocked before clicking "Siguiente".
- The rail answers "where is the OT?" and "what am I looking at?" separately.
- Materials, approvals and history stop being backend-only data.
- Touch and keyboard users can reach governance actions.
- All changes are additive to the shared rail; the other three adapters are
  unaffected unless they opt into the new props.

### Negative / risks

- The detail line adds visual density; mitigated by one-line truncation and
  `text-3xs`.
- `stage_history` ordering is normalized in the helper (latest wins), so the
  rail does not depend on API ordering.
- Progress is stage-position based (not weighted `production_progress`); it is
  honest for the rail and intentionally independent from billing/production
  weights.
- The mobile sheet is a second rendering path; it must be kept in sync with the
  rail statuses. It reuses the same evidence map and status derivation.

## Alternatives considered

- **A — process trail**: richer history but no blockers; rejected because the
  operator's main question is "what is missing?".
- **B — accessible governance only**: fixes hover/keyboard but leaves the rail
  as a table of contents; folded into Phase 2.
- **Tooltip-only blockers**: tooltips fail on disabled buttons and touch;
  rejected in favour of the inline warning icon + row label.

## References

- `frontend/components/shared/WizardStepsSidebar.tsx`
- `frontend/features/production/components/WizardProcessSidebar.tsx`
- `frontend/features/production/lib/stageEvidence.ts`
- `frontend/features/production/types.ts`
- `backend/production/serializers.py` (`stage_history`, `production_progress`)
- `docs/20-contracts/component-modal.md` § Sidebar primitives
