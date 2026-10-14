---
id: 0079
title: Module navigation moves from top-bar tabs to a two-column sidebar (ERPNext v16 pattern)
status: Accepted
date: 2026-10-13
author: frontend-team
---

# 0079 — Module navigation in a two-column sidebar (ERPNext v16 pattern)

**Related:** `docs/20-contracts/module-layout-navigation.md` (§2, §2.1), `docs/20-contracts/component-section-header.md`, ADR-0073 (partially superseded here), ADR-0075 (motion), `components/layout/DashboardShell.tsx`.

---

## Context

Until 0.3.12 the app shell had:

- a 40 px icon-only rail with the modules of `MODULE_ORDER`;
- a top bar where `ModuleNavigationMenu` rendered the module's tabs as a horizontal `NavigationMenu`, with sub-tabs in hover dropdowns;
- search, notifications and the task inbox as icons at the top-right (`UserActions`).

Product asked to align the navigation with ERPNext v16: an icon rail plus a ~220 px panel listing the active module's views as flat items and collapsible groups, with search/notifications at the top of the panel and a top bar that only carries the view title and actions.

Tabs are declared per module in 14 `[Module]Header.tsx` files. Several are dynamic (treasury builds bank sub-tabs from `useBanks()`, many hrefs go through `getViewModeUrl`, items are permission-gated), so a static navigation registry would not fit.

## Decision

1. **Shell layout** = `ModuleRail` (56 px, module icons, logo, user menu) + `ModuleSidebarPanel` (224 px, always visible on ≥ md) + content column (top bar + page). On < md both columns open as a left `Sheet` from a ☰ button in the top bar.
2. **The panel renders `HeaderConfig.navigation`** — the same `NavigationConfig` every `[Module]Header` already publishes through `HeaderProvider`. Mapping:
   - tab without `subTabs` → flat item;
   - tab with `subTabs` → collapsible group (open when it contains the active view; user toggles kept in component state);
   - a third level (`SubTabConfig.subTabs`) → nested items, active by pathname;
   - a group with a single visible child is flattened into one item that keeps the parent's label/icon;
   - permission rules are unchanged: hidden tab ⇒ its visible children are promoted.
   Routes without module tabs (`tabs: []`, e.g. dashboard) show the module list instead.
3. **Search, Notifications and the Task Inbox** move to the top of the panel (`SidebarUtilityNav`) — see Amendment 1. The top bar keeps the view title, deep breadcrumbs, status, `titleActions`, `children` and the POS / cost-calculator shortcuts (`UserActions`).
4. **`ModuleNavigationMenu` is removed** (its only consumer was the shell). `UniversalSearch` gains an additive `renderTrigger` prop so the panel can render its own trigger.
5. **No route, view or `[Module]Header` changes.** The header contract (publish `navigation`) stays; only where it is rendered changes.

### Amendment 1 — 2026-10-13 (product review)

6. **No module selector in the panel**: the rail already switches modules. The panel starts with the global accesses.
7. **Global accesses = Search + Task inbox.** Notifications move into the **avatar menu** (rail footer) with an unread dot on the avatar.
8. **POS / cost calculator** use the rail icon size (40 px hit area, 20 px icon). The top bar spans the full width and is **not** shifted by global sheets (`totalSheetsWidth` now applies to the content area only); sheets open below it (`top: var(--header-height)`), so these shortcuts keep a fixed position.
9. **Single page title = top bar.** The top bar title is the page's only `<h1>`; `description` becomes its tooltip. In-page title/description blocks are removed: `PageSectionHeader` loses `title`, `description` and `as` and only renders in-view tabs (77 title-only usages deleted). **Supersedes ADR-0073 §1, §2 and §5**; §3 (PageHeader renders nothing in place) and §4 (`SectionHeader` = `<h2>`) still hold.
10. **Navigation survives nested PageHeaders.** `HeaderProvider` keeps `moduleNavigation` (last published navigation + root segment) independently of `config`; `clearHeader` does not reset it. Views that mount their own `PageHeader` without `navigation` (e.g. `BudgetVarianceView`, `BudgetDetailView` for `titleActions`) no longer empty the sidebar.

## Consequences

- Content loses ~240 px of horizontal space on desktop (rail 40 → 56 px plus the 224 px panel). Wide tables rely on their existing horizontal scroll.
- Sub-views that were two clicks away (hover dropdown) are now visible at once, which helps modules with many views (Settings, Inventory, Treasury).
- When a module mounts, its header publishes navigation after the first effect; the panel shows a skeleton for that frame.
- Phase 2 (not part of this ADR): per-module "Inicio" workspace pages (KPIs, charts, link cards) as in ERPNext.

## Alternatives considered

- **Central static navigation registry** in `lib/module-registry.ts` — rejected for now: would duplicate the dynamic logic of the headers (banks, view-mode URLs) and touch 14 files with no UX gain.
- **Collapsible panel** — declined by product: the panel is always visible on desktop.
