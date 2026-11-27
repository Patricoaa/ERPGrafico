---
id: 0013
title: ActionDock pattern for floating tasks
status: Accepted
date: 2026-05-07
author: frontend-team
---

# 0013 — ActionDock pattern for floating tasks

## Context

The ERP requires several workbenches (Reconciliation, Production planning, Bulk invoicing) where users select multiple items to perform batch actions. 

Previously, these workbenches implemented their own "floating taskbars" at the bottom of the screen. This led to:
- Code duplication.
- Inconsistent aesthetics.
- Layout collisions when global side panels (Hub, Inbox) were open, as the taskbars would be partially covered or visually off-center.

## Decision

Implement a standardized `ActionDock` component in `components/shared/` using a **compound component pattern**.

### Constraints & Rules:
1. **Z-Index**: Must stay at `z-[100]` to be above most content but below modals if necessary.
2. **Animation**: Entry and exit must use `framer-motion` (AnimatePresence) to avoid jarring UI jumps.
3. **Responsive Centering**: The dock is centered with `left-1/2 -translate-x-1/2`. It no longer tracks panel attributes: the task inbox is a blocking full-viewport overlay that does not push the canvas (ADR-0161), and the former `data-hub-open` attribute disappeared with the Hub (ADR-0083). Entity drawers still repel `#main-content` through `totalSheetsWidth`.
4. **Internal Structure**:
    - `ActionDock.Stats`: Inner-shadow container for metrics.
    - `ActionDock.Actions`: Right-aligned button group with standardized separators.

## Consequences

### Positive
- **Consistency**: All batch action bars look and behave the same.
- **Maintenance**: Repositioning logic is centralized.
- **Developer Experience**: Declarative API makes it easy to add batch actions to any table.

### Negative
- ~~**DOM Dependency**: Relies on `document.body` attributes, which creates a loose coupling between the Shell layout and the Dock.~~ Superseded by ADR-0161: the dock no longer observes body attributes.

## Alternatives considered

- **Portal-based Dock**: Using a React Portal to render the dock into a specific "dock zone" in the Layout. Rejected because it complicates state management for context-specific actions (like the Reconciliation suggestions).
- **Simple Fixed Div**: Rejected because it didn't handle collision with the Hub/Inbox panels; those panels no longer push the canvas (ADR-0161), so the dock is now a simple centered fixed div.

## References

- [component-contracts.md](../../20-contracts/component-contracts.md#actiondock-)
- [add-shared-component.md](../../30-playbooks/add-shared-component.md)
