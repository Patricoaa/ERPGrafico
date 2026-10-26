---
id: 0101
title: Workspace tab bar — page navigation plus per-page ephemeral document and tool tabs
status: Proposed
date: 2026-10-26
author: frontend-team
---

# 0101 — Workspace tab bar

**Related:** ADR-0100 (stack over the origin list, unsaved-changes guard — this ADR replaces its breadcrumbs, `?stack=` and pins), ADR-0079 (module sidebar), ADR-0083 (document sheet), ADR-0020 (`?selected`), contract `module-layout-navigation.md` §2.1.

## Context

ADR-0100 let documents stack over the origin list, first with a "Volver" link, then with breadcrumbs, `?stack=` in the URL and pinned chips. Product feedback rejected that shape: the user expects a **permanent bar at the top of the viewport with tabs**, not a stack with a trail. Tabs are **ephemeral per page** (they close when the page changes), documents and drawers open as tabs, the **Cost Calculator** is one more tab, and pinning is not needed.

## Decision

1. **A permanent `WorkspaceTabBar`** (`components/layout/`) sits under the topbar in `DashboardShell`, above the content area. The origin list stays visible and usable; the active tab's content opens in the right-hand panel, as drawers already do (anchored below the bar because they are embedded in `#main-content`).
2. **Two groups in one bar.** Left: the module's sibling pages as navigation links (`resolvePageTabs`: the active group's views, or the module's groups when it has none; permissions as in the sidebar). Right: the ephemeral tabs.
3. **Ephemeral tabs** live in `GlobalModalProvider` (`tabs` + `activeKey`): a document (`openEntity`) or a tool (`openTool("cost-calculator")`). Opening an already-open document activates it; the bar holds at most 8 (the oldest is dropped). Only the active tab is mounted. Tools stay mounted while their tab exists, so the calculator keeps its lines when another tab is active.
4. **They close with the page.** A `pathname` change clears all tabs. Internal links with unsaved changes go through the guard first (capture-phase click handler in the provider).
5. **Closing** a tab (×, middle click, `Delete`, the drawer's X, saving) activates the right neighbour, else the left one.
6. **List selection** (`?selected`) is one tab, the previewed row: choosing another row replaces it; closing the tab clears `?selected`. `useDocumentSheetRoute` drives this with `openRootEntity` / `closeEntityByRef` / `isEntityOpen`. Documents opened from a document add tabs.
7. **Unsaved changes (ADR-0100 §6) are unchanged**: a dirty form blocks opening, switching, closing and leaving until Guardar y continuar / Descartar y continuar / Seguir editando. Because only the active tab is mounted, switching away from a dirty tab asks first.
8. **Module indicator** moves into the tab: its tooltip adds the module when the document lives outside the page's module.
9. **Removed:** `EntityTrail`, `EntityNavigationContext`, `?stack=` (`useDrilldownStackUrl`, `lib/drilldownStackUrl`), pinned documents (`lib/pinnedDocuments`), `goBackEntity`. Tabs are not serialized: reload and shared links do not restore them, and browser Back/Forward no longer touch them.
10. **Accessibility.** The ephemeral group is a `tablist` (`role="tab"`, `aria-selected`, roving `tabindex`); arrows/Home/End move focus, Enter/Space activate, `Delete` closes. Page links are a `nav` with `aria-current="page"`. The close button is a sibling of the tab (no nested interactive).

## Consequences

- One mental model: the bar says what is open; no hidden stack.
- Tabs lose their scroll and inner tab on switching (only the active one is mounted). Keeping them alive is an option if usage shows it matters; it would need one Radix sheet per tab.
- Page-mounted form drawers (create/edit, wizards) are not tabs yet; they stay overlays.
- Lost: shareable stack URLs and Back/Forward over documents. The `?selected` URL of the previewed row remains.
