---
id: 0013
title: ActionDock pattern for floating tasks
status: Proposed
date: 2026-05-07
author: Antigravity
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
3. **Responsive Centering**: The component must not use simple `left-1/2`. It must track the `data-hub-open` and `data-inbox-open` attributes on `document.body` via a `MutationObserver` and adjust its horizontal offset accordingly.
4. **Internal Structure**:
    - `ActionDock.Stats`: Inner-shadow container for metrics.
    - `ActionDock.Actions`: Right-aligned button group with standardized separators.

## Consequences

### Positive
- **Consistency**: All batch action bars look and behave the same.
- **Maintenance**: Repositioning logic is centralized.
- **Developer Experience**: Declarative API makes it easy to add batch actions to any table.

### Negative
- **DOM Dependency**: Relies on `document.body` attributes, which creates a loose coupling between the Shell layout and the Dock.

## Alternatives considered

- **Portal-based Dock**: Using a React Portal to render the dock into a specific "dock zone" in the Layout. Rejected because it complicates state management for context-specific actions (like the Reconciliation suggestions).
- **Simple Fixed Div**: Rejected because it doesn't handle the layout collision with side panels.

## References

- [component-contracts.md](../../20-contracts/component-contracts.md#actiondock-)
- [add-shared-component.md](../../30-playbooks/add-shared-component.md)
