---
id: 0086
title: Document drilldown navigates to the target's canonical route — URL and module follow the relationship
status: Superseded by 0100
date: 2026-10-16
author: frontend-team
---

# 0086 — Document drilldown navigates to the target's canonical route

**Related:** ADR-0080 (unified document model — decision 6, canonical URL), ADR-0083 (document sheet + `DocumentRelationsTab`), ADR-0020 (`?selected` deep links, modal-on-list), ADR-0028 (entity drawer registry + in-memory stack), ADR-0022 (`list_url` source of truth), contract `docs/20-contracts/document-relations.md`, `docs/20-contracts/component-entity-drawers.md`, `docs/20-contracts/module-layout-navigation.md`.

---

## Context

Clicking a related document inside a document sheet (Relations tab, "documento origen", a delivery's order link…) opens the target with `openEntity`, which pushes it onto an **in-memory stack** and renders its drawer (ADR-0028). The stack gives "volver" but:

- **the URL never changes** — the browser keeps pointing at the origin document's list, so the drilldown is not shareable, not bookmarkable and not refresh-safe;
- **the module/section never changes** — the module rail and the sidebar derive from `usePathname()` (`module-layout-navigation.md` §2, §7), so drilling from an invoice into its purchase order keeps highlighting facturación instead of compras.

The user reported exactly this: a document drilldown should take the user to where the target *lives*, with the correct module highlighted and a URL that reflects it.

ADR-0080 decision 6 already defines the tool for this: the backend `DocumentTypeRegistry` emits a **canonical URL** per label — `list_url?selected={id}` when a list opens the document, otherwise the resolver `/d/{label}/{id}`. The frontend already receives it as `DocumentRef.url`. The drilldown simply does not use it.

### Why not intercepting / parallel routes

The obvious App Router answer (a `@drawer` slot + intercepting routes) was evaluated and rejected:

- an intercepted route renders the target in the slot while `children` keeps the **origin** page — but `usePathname()` already returns the **target** path, so the rail switches to the target module while the content behind the drawer is still the origin list. Rail and content disagree.
- Interception only happens on soft navigation; a refresh or shared link renders the full target page anyway, so two code paths must be kept consistent for no user-visible gain.
- It re-implements what `?selected` + the module layout already do correctly and natively.

## Decision

1. **Document drilldown navigates.** When the target's canonical URL opens a real list — i.e. `DocumentRef.url` contains `?selected=` — the drilldown does `router.push(ref.url)`. The destination module mounts (rail + sidebar follow the URL), its list opens the target via `useDocumentSheetRoute`/`useEntityRouteActions` (`?selected`), and the URL is shareable and refresh-safe.
2. **The registry decides, the frontend obeys.** The frontend never guesses the route: it navigates iff `ref.url` contains `?selected=`. Everything else (`/d/{label}/{id}`, a list without `?selected`) keeps the current in-memory `openEntity` drawer with "volver" (ADR-0028 unchanged).
3. **Master/entity references stay in the drawer.** Masters such as `contacts.contact`, `inventory.product` and `hr.employee` are not registered with a `?selected` canonical URL (they resolve to `/d/{label}/{id}`), so rule 2 leaves them in the stack — clicking a contact inside a sheet must not throw the user out of the document. Document-to-document references with a real list canonical URL (`sales.saleorder` → `/sales/dtes/orders?selected={id}`, `inventory.stockmove` → `/inventory/reports/movements?selected={id}`, invoices, journal entries…) do navigate.
4. **Applies to every document-drilldown surface**, funnelled through one helper: the Relations tab rows (`useOpenRelatedDocument`), `SourceDocumentLink`, and `DocumentRefLink` when a canonical `url` is provided. Each surface decides with the same predicate.
5. **Back semantics.** Cross-module drilldown pushes a history entry, so the native back gesture returns to the origin. The explicit "Volver a X" affordance remains only for drawer (resolver) drilldown, where there is no URL to go back to.

## Consequences

- The URL, the module rail and the sidebar are always correct for the document being shown; the drilldown is shareable and survives a refresh.
- Drilling across modules **replaces** the origin page (no overlay over it). This is intentional and matches the requested behaviour; browser Back restores the origin (client cache makes it instant).
- Drilldown to a resolver-only type (`/d/…`) is unchanged: same in-memory stack, same "volver".
- No new route files, no parallel/intercepting-route machinery, no second navigation model.
- `DocumentRefLink` gains an optional `url` prop (and, since the refactor, accepts the whole `DocumentRef`) so surfaces holding a `DocumentRef` can deep-link without re-deriving the route.
- The "one document, one navigation" invariant now holds across the sheet, the lists and the drilldown: everyone goes through `list_url?selected={id}` (ADR-0020/0080).

### Scope of this change

The rule is enforced wherever a `DocumentRef` (with its `url`) reaches the surface:

- Relations tab rows — `useOpenRelatedDocument` (uses `ref.url` from the relations endpoint).
- `SourceDocumentLink` — the `doc.url` it already receives.
- `DocumentRefLink` accepts either the whole `DocumentRef` (new optional `documentRef` prop, preferred — the `url` always travels with it) or the explicit `label`/`id`/`display` (+ optional `url`); `JournalEntryDrawer` already passes `source_document.url`.
- `SaleDeliveryDrawer` / `SaleReturnDrawer` order link — new backend `sale_order_document` (SerializerMethodField, `build_ref(..., "sales.saleorder")`).
- `saleDeliveryLineFields` stock-move link — new backend `stock_move_document` (`build_ref(..., "inventory.stockmove")`).
- `PurchaseReceiptDrawer` / `PurchaseReturnDrawer` order link — new backend `purchase_order_document` (`build_ref(..., "purchasing.purchaseorder")`).
- `purchaseReceiptLineFields` / `purchaseReturnLineFields` stock-move link — new backend `stock_move_document` (`build_ref(..., "inventory.stockmove")`).
- `WorkOrder` → OV run link — new backend `sale_order_document` (`production.serializers`).
- `InventoryDocument` "documento origen" — new backend `source_document` (via `core.documents.ref_for`).
- `CheckDrawer` OV link — new backend `sale_order_document` (`treasury`); `checkFields` uses it.
- `InvoiceSummaryTab` origin — new backend `origin_document` (`billing.serializers.InvoiceSerializer`): precedence corrected invoice → OV → OC.

### Row-identity cells (`DataCell.Entity` → `DocumentRefLink`)

A distinct case is a **table that lists documents of a given type** (a credit ledger, a credit
history): the cell shows the row's *own* identity rather than a reference to a different
document. These rows used `DataCell.Entity`, which — because a drawer exists for `sales.saleorder`
(`ENTITY_DRAWERS`) — always opened the in-context drawer and never navigated, even though the
label has a `?selected` canonical URL. The rule is the same: the backend emits the row's own
`DocumentRef` and the cell uses `DocumentRefLink`, so the row navigates like any other document
drilldown.

- `CreditHistoryEntry` (`/sales/credit_history/`, `/contacts/{id}/credit_history/`) — `SaleOrderSerializer` exposes a self `document` (`build_ref(obj, ..., "sales.saleorder")`); `creditHistoryEntryFields` renders `DocumentRefLink`.
- `CreditLedgerEntry` (`/contacts/{id}/credit_ledger/`) — `ContactSelector.get_credit_ledger` adds `document` per row; `creditLedgerEntryFields` and `ContactDrawer.CreditLedgerTable` render `DocumentRefLink`.

The frontend must not derive the route itself (rule 2). Every surface that holds only a raw id
keeps the drawer until the backend exposes a `DocumentRef` for it.


## Alternatives considered

| Alternative | Why not |
|---|---|
| Intercepting + parallel routes (`@drawer` slot) | Rail (from `usePathname`) disagrees with the content kept behind the drawer; two code paths (soft nav vs refresh); redundant with `?selected` |
| Sync the in-memory stack to a URL search param | URL changes but the module/section still do not — the user's second requirement is unmet |
| Keep everything in the drawer (status quo) | The reported bug; not shareable, not refresh-safe, wrong module highlighted |
| Frontend registry of which labels deep-link | Would be another registry; the backend canonical URL already answers it (ADR-0080 §6) |

## References

- `docs/10-architecture/adr/0080-document-model-relations-and-navigation.md` §6
- `docs/10-architecture/adr/0083-document-sheet-replaces-order-hub.md`
- `docs/20-contracts/document-relations.md`
- `docs/20-contracts/component-entity-drawers.md`
- `docs/20-contracts/module-layout-navigation.md`
- `frontend/features/documents/hooks/useOpenRelatedDocument.ts`
- `frontend/components/shared/SourceDocumentLink.tsx`
- `frontend/features/documents/components/DocumentRefLink.tsx`
