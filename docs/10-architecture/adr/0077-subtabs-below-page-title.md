---
id: 0077
title: Sub-tab row embedded under the page title/subtitle (PageSectionHeader.subTabsBelow) — L4 row moved out of the shell
status: Proposed
date: 2026-08-13
author: core-team
---

# 0077 — Sub-tab row embedded under the page title/subtitle

**Related:** ADR-0076 (navigation accents), `PageSectionHeader.tsx`, `DashboardShell.tsx`, `HeaderProvider.tsx` (`NavigationConfig`), `module-layout-navigation.md`

---

## Context

The shell rendered a floating "quaternary" sub-tab row (`TabBar` `variant="underline"`) between the top bar and the page content whenever a module header set `navigation.subSubActiveValue` and the active sub-tab exposed nested `subTabs` (`DashboardShell.tsx`, the `l4Tabs` block). That mechanism was active in exactly three places:

- **Tesorería / bank-center** — `/treasury/bank-center/{bankId}/...` → Resumen, Movimientos, Cheques, Préstamos, Tarjeta, Conciliación (`BANK_SUB_VIEWS`).
- **Inventario / uoms** — `/inventory/products/uoms/{units|categories}` → Unidades, Categorías de Medida.
- **Settings / cuentas contables** — `/settings/accounts/{tab}` → Estructura, Ventas, Facturación, Compras, Inventario, Tesorería, RRHH, Socios, Impuestos (`ACCOUNT_TABS`).

Problem: the row was a detached strip (`px-8 pb-2`) floating above the content, visually disconnected from the page's title/subtitle. In the bank-center view the only visible title+subtitle is the `PageSectionHeader` rendered inside the page ("Resumen" + bank name), so the sub-tabs appeared *above* the title they belong to. The `PageHeader` renders nothing in place (it syncs config to `HeaderProvider`), and with `navigation` set the shell top bar shows the module dropdown instead of the title text — so the shell could not know where the page's own title/subtitle block lives.

## Decision

1. **Move the L4 sub-tab row out of the shell and into the page content**, rendered as a full-width `underline` row directly **below** each page's title/subtitle block.
2. **Extend `PageSectionHeader`** (shared, client) with an optional `subTabsBelow?: boolean` (default `false`). When set, `subTabs` render as a full-width `variant="underline"` `dense` row (`justify-start`, `w-full`) below the title/description block, reusing the existing `TabBar` routing logic (active from `pathname` segments, `router.push` on change). Existing callers (≈100) are unaffected.
3. **Remove `subSubActiveValue` (and the already-dead `subSubSubActiveValue`) from `NavigationConfig`** in `HeaderProvider.tsx` and stop passing them from `BankPageHeader`, `TreasuryHeader`, `InventoryHeader` and `SettingsHeader`. `InventoryHeader` keeps its local `subSubActiveValue` variable for title selection — it is just no longer part of the navigation contract. The `l4Tabs` computation and render block are deleted from `DashboardShell.tsx`.
4. **Each affected view renders its own sub-tab row under its title/subtitle**:
   - Bank-center: `BankCenterDashboard` passes `subTabs={getSubViewTabs(bankId)}` + `subTabsBelow` to its `PageSectionHeader`; the "Tarjeta" second-level tabs (`cards/unbilled` ↔ `cards/statements`) render as an additional underline row below it.
   - Inventario uoms: `uoms/units` and `uoms/categories` pages render `PageSectionHeader` (title/description that `InventoryHeader` already defined) + the two sub-tabs.
   - Settings cuentas: `settings/accounts/[tab]` fixes its title to "Cuentas Contables" (was "Cuentas de Usuario") and renders `ACCOUNT_TABS` as `subTabsBelow`.
5. **Remove `BankSubTabBar`** (`features/treasury/components/BankSubTabBar.tsx`) — it was never used and is superseded by `PageSectionHeader.subTabsBelow`. `getSubViewTabs` / `SUB_VIEWS_BASE` remain (consumed by `BankCenterDashboard`).

## Consequences

### Positivas

- Sub-tabs are visually attached to the page's title/subtitle instead of floating between the top bar and the content.
- The pattern is reusable: any page that wants a sub-tab row under its header block sets `subTabs` + `subTabsBelow` on `PageSectionHeader`.
- The shell stops driving view-specific navigation; module headers own their navigation, consistent with `module-layout-navigation.md`.
- Dead contract fields removed.

### Negativas

- Each affected view must opt in (no longer automatic via `subSubActiveValue`). New three-level navigation requires the page to render the sub-tab row itself.
- Contract change (removing `subSubActiveValue`, adding `subTabsBelow`) — hence this ADR.

### Archivos modificados

- `frontend/components/shared/PageSectionHeader.tsx` — `subTabsBelow` prop, full-width underline row below the header block
- `frontend/components/providers/HeaderProvider.tsx` — `NavigationConfig`: removed `subSubActiveValue` / `subSubSubActiveValue`
- `frontend/components/layout/DashboardShell.tsx` — removed `l4Tabs` computation + render block (and unused `TabBar`/`useRouter`)
- `frontend/features/treasury/components/BankPageHeader.tsx` — removed `subSubActiveValue`
- `frontend/features/treasury/components/TreasuryHeader.tsx` — removed `subSubActiveValue`
- `frontend/app/(dashboard)/inventory/InventoryHeader.tsx` — removed `subSubActiveValue` from `navigation` (local var kept for titles)
- `frontend/app/(dashboard)/settings/SettingsHeader.tsx` — removed `subSubActiveValue`
- `frontend/features/treasury/components/BankCenterDashboard.tsx` — `subTabs={getSubViewTabs(bankId)}` + `subTabsBelow`; card second-level row
- `frontend/app/(dashboard)/inventory/products/uoms/units/page.tsx` and `.../categories/page.tsx` — `PageSectionHeader` + sub-tabs
- `frontend/app/(dashboard)/settings/accounts/[tab]/page.tsx` — title fixed to "Cuentas Contables", `subTabs={ACCOUNT_TABS…}` + `subTabsBelow`
- `frontend/features/treasury/components/BankSubTabBar.tsx` — removed (unused)
- `docs/20-contracts/module-layout-navigation.md` — §2 navigation note

## Alternatives considered

- **Keep the shell `l4Tabs` mechanism and reposition it** under a shell-rendered title/subtitle block: rejected — the shell does not know each page's in-content title block, and bank-center/inventory/settings each have different title sources.
- **Per-view dedicated sub-tab bar components** (e.g. keep `BankSubTabBar`): rejected — duplicates routing/rendering logic; `PageSectionHeader.subTabsBelow` centralizes it.
- **Keep `subSubActiveValue` as an opt-in flag** in the contract: rejected — dead contract surface; the field no longer drives anything after the shell block is removed.

## References

- `frontend/components/shared/PageSectionHeader.tsx` — `subTabsBelow`
- `frontend/components/layout/DashboardShell.tsx` — former `l4Tabs` block (removed)
- `frontend/components/providers/HeaderProvider.tsx` — `NavigationConfig`
- `frontend/features/treasury/constants.ts` — `SUB_VIEWS_BASE`, `getSubViewTabs`
- `frontend/features/treasury/navigation.ts` — `BANK_SUB_VIEWS`, `buildBankSubTabs`
- `frontend/features/settings/constants.ts` — `ACCOUNT_TABS`
- `docs/20-contracts/module-layout-navigation.md`
