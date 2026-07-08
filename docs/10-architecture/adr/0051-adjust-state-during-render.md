---
id: 0051
title: Adjust State During Render — canonical pattern for state synchronization
status: Accepted
date: 2026-06-22
author: frontend-team
---

# 0051 — Adjust State During Render

## Context

The React Compiler (part of the eslint toolchain) detects when `setState` is called synchronously within a `useEffect` body and flags it as an error:

```
Error: Calling setState synchronously within an effect can trigger cascading renders
```

An audit of the frontend (`npm run lint`) revealed **18 occurrences** of this pattern. All 18 follow one of three scenarios:

| Scenario | Occurrences | Example |
|----------|-------------|---------|
| **A. Form initialization from server data** | 10 | `useEffect { if (settings && !initialized) { form.reset(settings); setInitialized(true) } }` |
| **B. URL param → local state sync** | 6 | `useEffect { if (isHubOpen && selectedId) setHubEverOpened(true) }` |
| **C. Props → local state sync** | 2 | `useEffect { setDialogOpen(isNewModalOpen) }` |

The existing project already uses an alternative pattern — **"adjust state during render"** — in at least 4 locations (`WorkOrderWizard.tsx:251`, `ActionConfirmModal.tsx:45`, `HubPanelProvider.tsx:45`, `AnalysisDashboard.tsx:56`). However, this pattern is undocumented and inconsistent.

Additionally, the existing documentation in `component-form-patterns.md` §4 recommends `useEffect` + `form.reset()` for form initialization — which triggers the same React Compiler error.

## Decision

1. Adopt **"adjust state during render"** as the canonical pattern for all synchronous state synchronization (props→state, URL→state, server data→form state).

2. **Forbid** `useEffect` + `setState` for synchronous state synchronization. `useEffect` is reserved for **side effects** (fetch, subscriptions, analytics, DOM manipulation, imperative timers).

3. The pattern mechanics:

   ```
   // ✅ ADJUST STATE DURING RENDER (canonical)
   // Synchronizes state synchronously during render, avoiding cascading re-renders.
   // React batches the state update with the current render — no extra cycle.
   
   if (incomingValue !== previousValue) {
       previousValue = incomingValue
       setLocalState(incomingValue)
   }
   ```

4. Formalize in a new contract `docs/20-contracts/component-state-sync.md` with variants for each scenario (A/B/C), a decision tree, and forbidden patterns.

5. Expose a reusable hook `useInitializeForm` in `frontend/hooks/useInitializeForm.ts` for scenario A (form initialization from server data — 10 occurrences).

## Consequences

**Positive**:
- Eliminates 18 React Compiler errors
- Reduces renders: `n` renders instead of `n × 2` (no render→effect→render cycle)
- Prevents spurious saves in `useAutoSaveForm` triggered by cascading `form.watch()` callbacks
- Single documented pattern replaces 3 ad-hoc implementations
- Reusable hook eliminates boilerplate from 8+ identical form initialization blocks in `UnifiedAccountsView.tsx`

**Negative**:
- "Adjust state during render" is counter-intuitive — mutating state during render feels like a side effect
- Requires updating existing documentation (`component-form-patterns.md` §4) that currently recommends the forbidden pattern
- `form.reset()` during render is safe for RHF but may feel unfamiliar

**Neutral**:
- The pattern is already used in 4 places in the project — the change is formalization, not introduction
- `useEffect` remains the correct place for actual side effects; this ADR narrows its scope

## Alternatives considered

| Alternative | Reason rejected |
|-------------|-----------------|
| Suppress React Compiler warnings | Loses CI protection; pattern still causes unnecessary re-renders |
| Keep `initialized` flag but move outside effect | Already partially done — but doesn't solve the root cause (synchronous setState in effect body) |
| Use `useMemo` instead | `useMemo` is for derived data, not state synchronization with side effects on other systems (RHF form) |
| Create a custom ESLint rule to allow the pattern | The React Compiler rule is correct — setState in effect IS suboptimal. Fix the pattern, not the linter. |

## References

- React docs: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- Contract: [component-state-sync.md](../../20-contracts/component-state-sync.md)
- Contract: [component-form-patterns.md](../../20-contracts/component-form-patterns.md) (updated)
- Hook: [useInitializeForm.ts](../../../frontend/hooks/useInitializeForm.ts)
