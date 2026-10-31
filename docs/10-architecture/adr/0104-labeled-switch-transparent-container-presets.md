---
id: 0104
title: LabeledSwitch presets keep the container transparent and tint the ring in both states
status: Proposed
date: 2026-10-30
author: frontend-team
---

# 0104 — LabeledSwitch presets keep the container transparent and tint the ring in both states

## Context

`LabeledSwitch` already exposes semantic color presets, but they only colored the container while checked. The unchecked state used a neutral ring/no ring and hover fill, while the checked state added a tinted background. Callers consequently duplicated state colors in `className`, causing visual drift and making the preset prop incomplete.

## Decision

1. Keep the `LabeledSwitch` container background transparent in both checked and unchecked states, including hover.
2. Apply a ring tinted with the selected semantic preset in both states: `/10` when unchecked and `/20` when checked.
3. Keep the unchecked border dashed and neutral; use a solid semantic `/30` border when checked.
4. `color` presets remain the source of truth for switch, thumb, icon wrapper, and container state colors. `className` remains an explicit escape hatch for layout or deliberate overrides.

## Consequences

- **Positive:** presets fully define the default visual state; boolean controls keep an unfilled surface while their semantic tint remains visible in both states.
- **Neutral:** existing callers with color utilities in `className` can still intentionally override the preset; callers should remove duplicated state colors to use the standard.
- **Negative:** unchecked switches now show a subtle semantic ring, and active containers lose their tinted fill; this is a deliberate global visual change to the shared component.

## Alternatives considered

- Keep the checked background tint and only add the inactive ring. Rejected because it conflicts with the requested transparent-surface rule.
- Remove all inactive ring emphasis. Rejected because the preset should remain identifiable in both states.

## References

- Contract: [component-boolean-fields.md](../../20-contracts/component-boolean-fields.md)
- Design source: [DESIGN.md](../../../DESIGN.md)
- Implementation: `frontend/components/shared/LabeledSwitch.tsx`