---
id: 0103
title: Mobile navigation sheet is an authorized SheetContent exception
status: Proposed
date: 2026-10-28
author: core-team
---

# 0103 — Mobile navigation sheet is an authorized SheetContent exception

**Related:** ADR-0091 (canonical close button), ADR-0079 (sidebar), contract `component-modal.md` § Excepciones Autorizadas, lint rule `dialog/no-direct-usage`.

## Context

`dialog/no-direct-usage` forbids `DialogContent` / `SheetContent` outside the wrappers (`BaseModal`, `Drawer`, `CollapsibleSheet`) so every panel gets the canonical header and close button. `component-modal.md` lists a single authorized exception, `UniversalSearch`.

Two files broke the rule:

- `components/layout/DashboardShell.tsx` renders the whole sidebar (module rail + module panel, ADR-0079) as an off-canvas sheet on mobile. It is navigation, not a business panel: it has no title, no form and closes on navigation. `Drawer` always renders a `PanelHeader` and is resizable, which would add a header and change the sidebar's own width on mobile.
- `components/ui/sidebar.tsx` is a shadcn primitive, the same layer as `components/ui/sheet.tsx`, which the rule already allows.

## Decision

1. The mobile navigation sheet of `DashboardShell` is an authorized exception, like `UniversalSearch`. It keeps an `sr-only` `SheetTitle` for accessibility.
2. `components/ui/*` primitives may compose `Sheet`/`Dialog` primitives; the rule's allowlist includes `components/ui/sidebar.tsx`.
3. No other navigation surface may use `SheetContent` directly: new panels use `Drawer` / `CollapsibleSheet`.

## Consequences

- `dialog/no-direct-usage` passes without disabling the rule for the layout.
- Revisit if `Drawer` gains a headerless, non-resizable variant: the mobile navigation would then move to it and this exception would be removed.
