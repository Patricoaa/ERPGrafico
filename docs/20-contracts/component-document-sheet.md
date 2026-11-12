# Contract: Document Sheet (ficha documental)

> Layer 20 · ADR-0083 (replaces the Order Hub) · builds on ADR-0080 (`DocumentRef`, relations) and `component-entity-drawers.md`.
> Code: `components/shared/DocumentDrawerShell.tsx`, `DocumentLifecycle.tsx`, `DocumentActionsMenu.tsx`, `DocumentFieldGrid.tsx`, `RelatedDocumentsTable.tsx`; `features/documents` (`DocumentRelationsTab`, `resolveRegistryActions`); reference implementation `features/orders/components/sheet/OrderSheet.tsx`.

## 1. When

Every **document** (OV, OC, invoice/note, delivery, receipt, payment, stock move, journal entry, work order, returns…) opens in a document sheet, from any entry point (`openEntity`, list `?selected`, relations, search). Master data (contacts, products, users) keep their own master drawers.

## 2. Anatomy

```
Drawer (left, formDrawerWidth("master"))      — or embedded body (POS)
├─ Header       identity (useDrawerIdentity) · "Volver a…" (openEntity stack)
│               · ⋮ DocumentActionsMenu (circular ghost button next to close; includes Imprimir)
├─ Lifecycle    DocumentLifecycle — steps only, no figures (OV/OC, invoices)
├─ TabBar       horizontal, variant "underline"
│   ├─ Resumen     Contexto (DocumentFieldGrid) + Productos (table + totals box)
│   ├─ Relaciones  DocumentRelationsTab
│   └─ (type-specific, only if Relaciones does not cover it)
└─ Sidebar      ActivitySidebar (FormSplitLayout), hidden when embedded
```

Reference implementations: `OrderSheet` (OV/OC, owner-approved pilot 2026-10-15), `InvoiceSheet` (invoices/notes, U3) and the generic **`DocumentSheet`** (`@/features/documents`, U5) used by every other document: deliveries, receipts, purchase returns, inventory documents, stock moves, treasury movements, checks, terminal batches, profit distributions. New documents must use `DocumentSheet` (pass `context`, `sections`, `status`, actions) instead of composing the shell by hand. Documents whose UI is a workflow of its own (work order, payroll) keep it and expose relations with `DocumentRelationsButton`.

| Rule | Detail |
|---|---|
| Tabs | Horizontal `underline` (precedent: `ContactDrawer`). ≤5 visible; hide empty ones with `hidden`. |
| Header | Always **title + subtitle**, so every sheet has the same two-line header. Title = document number (`display_id`); subtitle = what qualifies it (registry `subtitleTemplate`/`description` + `subtitleSuffixTemplate`), falling back to the **entity type name** (e.g. "Orden de Venta"). Never filler such as "Detalle del…". |
| Tab rule | The underline `TabBar` draws its bottom rule as the container's own `border-b` (in flow, `shrink-0`), so it renders in every entity; the active bar overlaps it. Do not re-add it as an absolutely positioned element. |
| Embedded tables | `Collection` drops the bottom rule of the last row of the last `tbody` (the container already has a border; the `tfoot` keeps its own `border-t`). Do not compensate per sheet. |
| Source document | Shown and navigated through **Relaciones**. Forms (e.g. `JournalEntryFormDrawer`) have no manual source-document selector; the `source_*` link is system-managed (automatic documents) and PATCH leaves it untouched. |
| Resumen | **Contexto** (no section header, **one row** of up to 4 fields): partner (link to its sheet), date **with time**, the field that qualifies the document (channel or warehouse; POS session when present) and **notes** (clamped to 2 lines). No document number (it is the title), no repeated statuses (the lifecycle shows them). All values **left-aligned** (`DataCell` cells center by default: pass `w-auto justify-start text-left`). **Productos** (documents with lines): table from `<Entity>LineFields.toColumns()` (invariant 13) — product and linked documents (OT…) open their sheet stacked on the document; column order: product · quantity · unit price · fulfilled · invoiced · linked documents · **subtotal last** — set `placement: 'detail'` on every field, otherwise `toColumns()` reorders by semantic zone (amounts go to the header zone); prices/subtotals **net**: gross-first documents (OV) store gross lines, so the serializer exposes `unit_price_net`/`subtotal_net` (allocation of `total_net`, `allocate_line_nets`, exact sum); fulfilled/invoiced as plain quantities (no %). Under it, a right-aligned totals box: Subtotal (Σ line subtotals), IVA, Total, Pagado, Saldo pendiente. No separate "Líneas" tab. |
| Status | Only `StatusBadge` (invariant 7) — including lifecycle steps (`variant="hub"`). |
| Money/quantities | `formatCurrency`/`DataCell.Currency`/`QuantityDisplay`, `tabular-nums`. No `toLocaleString`. |
| Cards | No cards inside the sheet; groups are `FormSection`/`SectionHeader` + borders. |

## 3. Lifecycle — `DocumentLifecycle`

`steps: { id, label, icon, status: success|active|neutral|destructive|not_applicable, progress?, detail? }[]`, `onStepClick?`, `activeStepId?`. No figures: amounts live in the Resumen totals box.

- Step ids equal relation areas (`origin`, `billing`, `production`, `logistics`, `treasury`); clicking a step opens Relaciones filtered by that area.
- Computed from the document's own normalized fields (`invoicing_status`, delivery/receipt status, `pending_amount`, OT progress) — never from relation buckets (retired in U6; orders expose typed `invoices`/`notes`/`deliveries`/`receipts`). OV/OC: `getOrderLifecycle`.

## 4. Actions — `DocumentActionsMenu` + registries

One **actions button in the Drawer header, next to close** (`headerActions`), with the same language as the close button (circular ghost icon `⋮`, tooltip "Acciones · {next step}", dot (`bg-primary`) when a next step is pending) and the `DataCell.ActionMenu` item style. Menu order: "Siguiente paso" (primary), the other actions, **Imprimir**, then destructive ones separated. Disabled actions stay visible with their reason underneath.

- Source: the per-type action registry (`features/<app>/actions.tsx`, `ActionRegistry<T>`). Evaluate with `resolveRegistryActions(registry, doc, permissions, exclude)` — permission (any of `requiredPermissions`), `excludedStatus`/`requiredStatus`, `checkAvailability`, `isDisabled` + `disabledTooltip`.
- **Primary** ("Siguiente paso") = first enabled action of the cycle priority (OV/OC: `complete-folio` → `create-work-order` → `register-delivery`/`register-reception` → `confirm-service-delivery` → `invoice-by-lines` → `register-payment`). No primary when the cycle is complete.
- "Ver …" actions of the Hub (`view-*`, `payment-history`) are not offered: Relaciones replaces them.
- Destructive actions (`destructive: true`: cancel/annul the document) always go last, separated.
- Execution runs inside the sheet (`useOrderActionEngine` for commercial documents). **No global engine, no `ref`.** After success: refetch the document and `useInvalidateDocuments()`.
- Actions must **not** close the sheet: the `ENTITY_DRAWERS` adapter does not wire `onSuccess` (it empties the `openEntity` stack).

## 5. Relations tab — `DocumentRelationsTab`

Props: `label`, `id`, `sectionActions?: Partial<Record<DocumentDomain, DocumentActionItem[]>>`, `rowActions?: (link) => DocumentActionItem[]`, `domain?`, `onDomainChange?`.

- Groups `GET /api/core/documents/{label}/{id}/relations/` by `target.domain` (backend-declared, `document-relations.md`) in cycle order; each group: `SectionHeader` (count + sum of non-cancelled `amount`) + its actions.
- An area with actions is shown even when empty, with the action as empty state ("Sin documentos de tesorería · Registrar pago").
- Areas: Origen, Facturación, Manufactura, Logística, Tesorería, Contabilidad, **Contactos**, Otros. The backend adds indirect links for the sheet: **journal entries of the related documents** (Contabilidad) and the **counterparties** (customer/supplier/contact) of the document and its related documents (Contactos, each once).
- Rows: `RelatedDocumentRow` — **one line, the whole row is the link** to the entity's sheet (`openEntity`, stacked with "volver"; no sheet → canonical URL): entity icon (`getEntityIcon`, `ENTITY_REGISTRY`) · `display_id` · type/role · `DocumentRef.detail` **only for Contactos and Tesorería** (truncated; partner only when it differs from the sheet's own) · amount (relation amount, e.g. allocated, else `DocumentRef.amount`) · `StatusBadge`. Only what identifies the document; everything else is one click away in its sheet (full text in the row tooltip). Row actions "⋯" sit outside the link. `accessible=false` shows the row without link ("· sin acceso").
- Group total = Σ non-cancelled amounts (not shown for Contactos).
- States: shaped skeleton; inline error (does not break the sheet); global empty state; count of `unresolved` references.

## 5b. Navigation

The list `?selected={id}` opens the sheet **through the `openEntity` stack** (not a page-local drawer), so everything opened from it (product, OT, related documents) shows "Volver a {display}". Closing the stack clears `?selected`. Sheets call `setEntityDisplay(label, id, display_id)` once loaded so the back label shows the real number. Entity drawers that need full data (e.g. product) accept an `id`-only open via a loader (`ProductDrawerById`).

### Lists

Document lists open the sheet with `useDocumentSheetRoute(label)` (`@/hooks`): `?selected={id}` ↔ the `openEntity` stack; `toggle(id)` for row clicks, `selectedId` for row highlight. Lists embedded in a host with their own panel (POS) pass `null`.

## 6. Embedded mode

`DocumentDrawerShell embedded` renders a compact header + body without `Drawer` and without the activity sidebar. Used by the POS (`OrderSheet embedded posSessionId`). The embedded sheet owns its action engine.

**POS (ADR-0121):** the sales drawer is the only drawer of the POS. Rows open their document embedded in that same drawer (`embedded`), replacing the list, with «Volver a la lista» (`onBack`). The embedded sheet does not draw its own header: title, subtitle and actions are portaled into the container header through `DocumentHeaderSlotContext`. Opening another document replaces it. At most one nested drawer (product, contact, work order) may sit above it, replacing any previous one; the sales drawer wraps its subtree in `EntityNavigationScope` and `DrawerScope { boundary: "screen", className: "pos-motion" }` (`components/shared/Drawer.tsx`). Motion is ease-in (`--ease-pos-enter`, globals.css).

## 6b. POS session sheet (`treasury.possession`)

`POSSessionSheet` (`features/treasury`) is the only surface of a POS session: sessions list (`?selected`), the Caja POS **Relaciones** tab and any `openEntity("treasury.possession", id)`. It composes `DocumentDrawerShell` (not `DocumentSheet`) because its Resumen is an executive view. Idea: the Resumen explains the session in seconds; the other tabs explain the detail without duplicating each other.

| Tab | Answers | Content |
|---|---|---|
| Resumen | What happened; does anything need attention | Alerts first (cash difference, pending terminal payments) with a button to the tab that investigates them · indicators (ventas netas, órdenes de venta + devoluciones, ticket medio bruto with its criterion, duración + time zone) · operational info (responsable, cerrada por, apertura/cierre, fondo, punto de venta) · **net** collections by method with % (after refunds) |
| Ventas | What was sold/returned/collected | Commercial balance (gross, returns, net, counts kept separate, tax note) · one table of sales (+) and returns (−) with document link (`openEntity`), date-time, customer (walk-in flagged), method, amount, status |
| Tesorería | How much cash there should be | Esperado / contado / diferencia · transparent formula (fondo + ventas efectivo − devoluciones + entradas − retiradas) · **every** treasury movement associated with the session (sale collections included, each opening its movement sheet) · movements outside the session |
| Cierre (closed only) | How it ended; do declared amounts match | Who/when, result («Coincide» ≠ «revisado»), cash count (expected, declared, difference with its declared reason, the adjustment movement it generated, cash withdrawn at close and what stays in the box), non-cash collections, closing notes with author and time; the cash difference is shown once (not repeated in Incidencias) |
| Actividad | Who did what, when | Read-only chronological history, newest first, time zone visible, filters by event type and responsible; each event may link to its document |
| Relaciones | Linked documents | The Caja POS (`pos_box`) and the session's sales (`pos_sale`) |

Backend: `GET treasury/pos-sessions/{id}/overview/` (alerts, sales balance + rows, net collections, closing) and `/activity/` (`treasury/pos_session_overview.py`, fixed query count — zero N+1) next to the existing `/summary/` (cash ledger). Activity merges session open/close, operator passes, draft-step tracking (`SaleTrackingEvent`, including POS partner withdrawals via `Step.PARTNER_WITHDRAWAL`), treasury movements without a sale (incl. cash partner withdrawals), returns and work orders. Activity has one row per sale (who, customer, amount, method; partial payments show «cobrado/pendiente»), one «Faltante/Sobrante de caja» row for the close difference (linked to its adjustment movement, which is not repeated as a movement) and an `amount` column. Ventas rows carry `collected`/`pending` (pending = total − returned − collected) and a «Por cobrar» KPI. Descriptions are always Spanish; `reference` is a clickable link to the related document. KPI sections (first block of Resumen, Ventas, Tesorería, Cierre) use `StatCard` with no section divider. The actions menu downloads the X (open) / Z (closed) PDF.

Not captured by the system yet (so not shown): counts by denomination, declared amounts for card/transfer, supervisor review status and POS connection state at close.

**Payment methods are never hardcoded:** Cobros por métodos lists the methods enabled today for the Caja POS (`allowed_payment_methods`, active, for sales) with their configured names, plus any method that collected in the session and is no longer enabled (marked «ya no habilitado»); legacy movements without a method group by type.

**Configuration lock (`treasury/pos_lock.py`):** while a session is OPEN, the Caja POS, its allowed payment methods, the treasury accounts it uses (default, allowed, method account/settlement, session account) and the accounting accounts linked to those (plus the `pos_*` accounts of `AccountingSettings`) cannot be edited or archived through the API (`DOCUMENT_LOCKED`, 422). Serializers expose `pos_session_locked` (precomputed with `annotate_pos_lock`, no N+1); `PosTerminalDrawer` shows a notice and disables the form. Closing the session releases the lock.

Caja POS ↔ sesiones: backend labels `treasury.posterminal` (provider `pos_terminal_relations`: every session of the box, newest first, role `pos_session`) and `treasury.possession` (links back with role `pos_box`). The box drawer (`PosTerminalDrawer`) has tabs **Configuración** / **Relaciones**.

## 6c. Partner sheet (`contacts.partner`)

`PartnerDrawer` (`features/partners`) follows the POS session pattern (ADR-0133): Resumen explains the partner in seconds, other tabs answer different questions.

| Tab | Answers | Content | Secondary actions |
|---|---|---|---|
| Resumen | How is the partner; what needs attention | Alerts first (excess capital, pending capital, dividends payable, retained earnings without destination), each with a button (runs the action or goes to the tab) · KPIs (`StatCard`: participation %, subscribed, paid-in, net equity) · partner data (linked contact, partner since, tax id) · equity composition | Those of each alert |
| Capital | How much subscribed, contributed, owed | Subscribed / paid-in / pending / excess with visible formula · participation history (`partnerStake`) · capital movements from the ledger | Registrar aporte · Pagar capital pendiente · Suscribir / reducir · Formalizar exceso · Transferir (origin prefilled) |
| Resultados y retiros | What is owed, what was withdrawn | Retained earnings, dividends payable, provisional withdrawals and their movements (type filter) | Registrar retiro · Pagar dividendos · Distribuir utilidades retenidas |
| Distribuciones | Which distributions | `partnerDistribution` entity-view; rows open the distribution | none |
| Libro | Which entries back it | `PartnerLedgerPanel` | none |
| Relaciones | What it links to | `DocumentRelationsTab` with label `contacts.partner`: contact, journal entries of its movements, distributions it takes part in | none |

**Actions and `placement`.** `partnerActions` (`features/partners/components/partnerActions.tsx`) is the single source; each action has `placement: "capital" | "results" | "menu"`. `partnerActionsFor(partner, placement)` returns only the visible actions of that placement; tabs and the header «⋯» menu render only that output and add no visibility logic. Visibility rules are unchanged (`partner_excess_capital > 0`, `partner_pending_capital > 0`, `partner_dividends_payable_balance > 0`, `partner_earnings_balance > 0`; contribution and withdrawal always). «Dar de baja» is in the menu, disabled with `disabledReason` when `demoteBlockedReason` is set. Movement types are classified into Capital / Results / omitted in `partnerMovement.entity`, guarded by a test against the backend `PartnerTransaction.Type`.

**Backend.** `GET /contacts/{id}/partner_overview/` (`contacts/partner_overview.py`, fixed query count, N+1 test): alerts (`code`, `severity`, `amount`, `target_tab`, `action`), KPIs, partner data, composition. **Alerts are owned by the backend**; the frontend maps `action` to `run(...)` and never recomputes thresholds (a parity test compares them with the row-level `visible` rules). 404/400 if the contact is not a partner; read permission like `partner_statement`.

**Relaciones.** Provider in `contacts/relations.py` for `contacts.partner` (a view label over `Contact` restricted to partners: `DocumentType.queryset` / `permission`, see `document-relations.md` §3). Journal entries and resolutions are preloaded (`select_related`) because showing a journal entry costs 2 extra queries in core otherwise.

## 7. Anti-patterns

- Opening a document in a surface other than its sheet (Hub, ad-hoc modal).
- Reintroducing relation buckets (`related_documents`-style dicts) instead of the relations endpoint or typed summary fields.
- Global action engines / imperative refs to run document actions.
- Hand-built label/value grids (`<span className="text-xs text-muted-foreground">` + `<p>`) instead of `DocumentFieldGrid`.
- Inline table columns for lines instead of `*Fields.toColumns()`.
