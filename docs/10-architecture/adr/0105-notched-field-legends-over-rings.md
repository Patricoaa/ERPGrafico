---
id: 0105
title: Notched field legends stay above rings with a surface-matched backing
status: Proposed
date: 2026-10-30
author: frontend-team
---

# 0105 — Notched field legends stay above rings with a surface-matched backing

## Context

Notched fields use a `<fieldset>` border and can receive focus, selected, or hover rings. Those effects sometimes remain visible through the transparent `<legend>` backing, leaving a colored line across the label notch and reducing legibility.

## Decision

1. Render every notched `<legend>` in a positioned layer above the fieldset ring (`z-index: 1`).
2. Give the legend an opaque background using `--notched-field-label-background`, defaulting to `--background`.
3. Set that custom property to `--card` on common elevated surfaces (cards, panels, dialogs, and sheets). Custom surfaces may set the same property to match their own background.

## Consequences

- **Positive:** rings and shadows cannot show through the label or its padding; the notch remains clean in focus and selected states.
- **Neutral:** custom surfaces with a distinct background can define `--notched-field-label-background` for an exact match.
- **Negative:** the label backing is no longer transparent; without a surface override it uses the page background token.

## Alternatives considered

- Increase only the label's `z-index`. Rejected because a transparent label still exposes the ring beneath it.
- Use one fixed `--card` background globally. Rejected because notched fields also appear directly on the page background.

## References

- Contract: [component-input.md](../../20-contracts/component-input.md)
- Design source: [DESIGN.md](../../../DESIGN.md)
- Implementation: `frontend/app/globals.css`