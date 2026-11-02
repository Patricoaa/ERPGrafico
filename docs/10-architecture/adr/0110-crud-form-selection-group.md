---
id: 0110
title: Unified card selection for CRUD forms
status: Proposed
date: 2026-11-02
author: frontend-team
---

# 0110 — Unified card selection for CRUD forms

## Context

CRUD forms currently represent option selection with several unrelated patterns: `LabeledCheckboxGroup`, hand-built `RoleCard`/`TeamCard`, and hand-built circular-checkbox cards. Unique selection cards also use `ChoiceCard` even though that family is primarily used by checkout and wizard flows. These alternatives have different markup, keyboard behavior, and selection styling.

## Decision

Introduce `FormSelectionGroup` for card-style option selection in CRUD forms. Its discriminated `mode` supports `single` radio semantics and `multiple` checkbox semantics with a shared loose header (required icon, label, and optional suffix), option anatomy, selected state, and CMYK indicator. Do not wrap it in `LabeledContainer`. Migrate CRUD consumers of `LabeledCheckboxGroup`, user role/team cards, the POS-terminal payment-method cards, and unique-choice cards in CRUD forms. Migrate the remaining `LabeledCheckboxGroup` consumer as well, then remove `LabeledCheckboxGroup` and the local role/team card implementations.

Keep `ChoiceCard`/`ChoiceGroup` unchanged for checkout and wizard flows. Keep `MultiSelectTagInput`, entity selectors, and table/entity-view bulk selection unchanged.

## Consequences

- CRUD form selection has a consistent accessible radio/checkbox-card model and appearance.
- Single-selection keyboard behavior is centralized; multiple-selection options share card styles without duplicating interaction handlers.
- `CardSurface` now supports the checkbox ARIA role and an explicit tab stop for radio-group navigation.
- The new component remains beta while migrations validate the public API.
- Selectors and tag inputs intentionally keep their more compact, context-specific interaction patterns.

## Alternatives considered

- Extend `ChoiceCard` to multiple-selection: rejected because checkout/wizard choice semantics and visuals should remain stable and it would overload a proven radio-specific component.
- Keep separate `LabeledCheckboxGroup` and role/team implementations: rejected because it retains duplicate visual and accessibility behavior.
- Replace all selects and multi-selects with cards: rejected because field selectors and compact value pickers solve different interaction needs.

## References

- [FormSelectionGroup contract](../../20-contracts/component-form-selection-group.md)
- [Card family contract](../../20-contracts/component-card-family.md)
- [Boolean fields contract](../../20-contracts/component-boolean-fields.md)
