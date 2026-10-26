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

1. **The tab bar replaces the topbar.** `WorkspaceTabBar` (`components/layout/`, `h-12` = `--header-height`) is the first panel of the viewport in `DashboardShell`; the old topbar is gone. The view's status, actions (`titleActions`, `children`), deep breadcrumbs and the mobile menu button live at its ends (`UserActions` was empty and has been removed). The active tab's content fills the area below the bar (see 10); to see the list again, click the page tab.
2. **One row, one style.** Every tab uses the same folder-tab style: (a) the **page** chosen in the rail (title and icon from the view's header; the only `<h1>` is `sr-only`; not closable; active when no other tab is, clicking it returns to the list without closing the others), (b) the **documents** opened from it and (c) the **Cost Calculator**, only when chosen in the rail. There are no sibling-page tabs and no permanent calculator button: the rail is the only way to pick a page or the tool.
3. **Ephemeral tabs** live in `GlobalModalProvider` (`tabs` + `activeKey`): a document (`openEntity`) or a tool (`openTool("cost-calculator")`). Opening an already-open document activates it; the bar holds at most 8 (the oldest is dropped). Only the active tab is mounted. Tools stay mounted while their tab exists, so the calculator keeps its lines when another tab is active.
4. **They close with the page.** A `pathname` change clears all tabs. Internal links with unsaved changes go through the guard first (capture-phase click handler in the provider).
5. **Closing** a tab (×, middle click, `Delete`, the drawer's X, saving) activates the right neighbour, else the left one.
6. **List selection** (`?selected`) is one tab, the previewed row: choosing another row replaces it; closing the tab clears `?selected`. `useDocumentSheetRoute` drives this with `openRootEntity` / `closeEntityByRef` / `isEntityOpen`. Documents opened from a document add tabs.
7. **Unsaved changes (ADR-0100 §6) are unchanged**: a dirty form blocks opening, switching, closing and leaving until Guardar y continuar / Descartar y continuar / Seguir editando. Because only the active tab is mounted, switching away from a dirty tab asks first.
8. **Module indicator** moves into the tab: its tooltip adds the module when the document lives outside the page's module.
9. **Removed:** `EntityTrail`, `EntityNavigationContext`, `?stack=` (`useDrilldownStackUrl`, `lib/drilldownStackUrl`), pinned documents (`lib/pinnedDocuments`), `goBackEntity`. Tabs are not serialized: reload and shared links do not restore them, and browser Back/Forward no longer touch them.
10. **Panels are always full-size.** Inside a tab, `Drawer` (via `PersistentPanelContext`) fills the whole area under the bar, is not resizable and is not dismissed by outside clicks, so the origin list and the rest of the page are not operable while a tab is open; only the bar is. Close with the drawer's X, Escape or the tab's ×. Nested drawers keep their own size and behaviour.
11. **Accessibility.** The ephemeral group is a `tablist` (`role="tab"`, `aria-selected`, roving `tabindex`); arrows/Home/End move focus, Enter/Space activate, `Delete` closes. Page links are a `nav` with `aria-current="page"`. The close button is a sibling of the tab (no nested interactive).

## Consequences

- One mental model: the bar says what is open; no hidden stack.
- Tabs lose their scroll and inner tab on switching (only the active one is mounted). Keeping them alive is an option if usage shows it matters; it would need one Radix sheet per tab.
- The list is not visible while a document tab is active (by design): the page tab returns to it.
- Page-mounted form drawers (create/edit, wizards) are not tabs yet; they stay overlays.
- Lost: shareable stack URLs and Back/Forward over documents. The `?selected` URL of the previewed row remains.
