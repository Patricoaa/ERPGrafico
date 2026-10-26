---
id: 0098
title: Form initialization resets in a layout effect (React 19 cross-component update rule)
status: Accepted
date: 2026-10-23
author: frontend-team
---

# 0098 — Form initialization resets in a layout effect

## Context

ADR-0051 made "adjust state during render" the canonical pattern for synchronizing state, including `form.reset()` from server data (`useInitializeForm`) and drawer open/entity changes (`useInitializeDrawerForm`).

React 19 tightened the rule that a component must not update another component while rendering. `form.reset()` mutates react-hook-form's store, which mounted `Controller` components subscribe to. When `initialData` arrives **after** the drawer has opened (e.g. `BOMDrawer` opened from `?selected=`, `ProductDrawer` opened from a subscription, or any edit flow where the parent fetches the entity), the reset ran during the parent's render while `Controller`s were already mounted, producing:

```
Cannot update a component (`Controller`) while rendering a different component (`BOMDrawer`).
```

This is not specific to BOMDrawer: every drawer/form that receives async `initialData` after mount shares the same pattern and the same latent warning.

## Decision

1. Form-store initialization (`form.reset()` from server data, drawer open, or entity change) **must run in a layout effect**, not during render.
2. The canonical hooks `useInitializeForm` and `useInitializeDrawerForm` implement this with `useIsomorphicLayoutEffect` (`useLayoutEffect` on the client, `useEffect` during SSR to avoid the server warning).
3. The reset key (`open` + entity id, or first truthy server payload) remains the only trigger. The effect runs once per key change; data refreshes for the same entity do not reset the form.
4. "Adjust state during render" remains canonical for **local `useState`** synchronization (props → state, URL → state). It must not be used to mutate react-hook-form's store while `Controller`s may be mounted.
5. `form.reset()` must not be moved to a plain `useEffect`: that runs after paint and would flash stale/empty values in edit drawers.

This supersedes the form-initialization mechanics of ADR-0051; the rest of ADR-0051 remains accepted.

## Consequences

**Positive**

- Removes the React 19 cross-component update warning for every async edit drawer with a single centralized change.
- Keeps initialization before paint, so there is no visual flash of empty form values.
- No per-drawer loading gates are required; the fix applies to all ~60 consumers of the hooks.

**Negative**

- Layout effects run after the render commit, so initialization costs one extra render before paint instead of zero.
- The ADR-0051 wording that `form.reset()` during render is safe for RHF is no longer valid for React 19 and must not be copied into new code.
- Hooks use an isomorphic layout effect to avoid the `useLayoutEffect` SSR warning.

**Neutral**

- `useAutoSaveForm` is unaffected: `form.reset()` emits watch events without `info.name`, which the autosave subscription already ignores.

## Alternatives considered

| Alternative | Reason rejected |
|-------------|-----------------|
| Gate each drawer's `<Form>` behind a loading flag so `Controller`s are unmounted when the reset happens | Fixes only the drawers that adopt it; must be repeated in every async edit flow and is easy to regress. |
| Use `useEffect` instead of `useLayoutEffect` | Runs after paint → visible flash of stale/empty values when async `initialData` arrives. |
| Keep render-phase reset and suppress the React warning | Masks a real cross-component store update; React may escalate it in future versions. |
| Reset the form inside the data-fetching hook | Couples feature hooks to a specific form instance and does not cover drawer open/close resets. |

## References

- [ADR-0051](./0051-adjust-state-during-render.md) — adjust state during render (local state remains canonical)
- [component-state-sync.md](../20-contracts/component-state-sync.md) — updated form-initialization variants
- [hook-contracts.md](../20-contracts/hook-contracts.md) — `useInitializeForm`
- `frontend/hooks/useInitializeDrawerForm.ts`
- `frontend/hooks/useInitializeForm.ts`
- React: [Cannot update a component while rendering a different component](https://react.dev/link/setstate-in-render)
