# Contract: Document Sheet (ficha documental)

> Layer 20 · ADR-0083 (replaces the Order Hub) · builds on ADR-0080 (`DocumentRef`, relations) and `component-entity-drawers.md`.
> Code: `components/shared/DocumentDrawerShell.tsx`, `DocumentLifecycle.tsx`, `DocumentActionsMenu.tsx`, `DocumentFieldGrid.tsx`, `RelatedDocumentsTable.tsx`; `features/documents` (`DocumentRelationsTab`, `resolveRegistryActions`); reference implementation `features/orders/components/sheet/OrderSheet.tsx`.

## 1. When

Every **document** (OV, OC, invoice/note, delivery, receipt, payment, stock move, journal entry, work order, returns…) opens in a document sheet, from any entry point (`openEntity`, list `?selected`, relations, search). Master data (contacts, products, users) keep their own master drawers.

## 2. Anatomy

```
Drawer (left, formDrawerWidth("master"))      — or embedded body (POS)
├─ Header       identity (useDrawerIdentity) · "Volver a…" (openEntity stack)
│               · [Acciones ▾] DocumentActionsMenu (next to close; includes Imprimir)
├─ Lifecycle    DocumentLifecycle — steps only, no figures (OV/OC, invoices)
├─ TabBar       horizontal, variant "underline"
│   ├─ Resumen     Contexto (DocumentFieldGrid) + Productos (table + totals box)
│   ├─ Relaciones  DocumentRelationsTab
│   └─ (type-specific, only if Relaciones does not cover it)
└─ Sidebar      ActivitySidebar (FormSplitLayout), hidden when embedded
```

Reference implementation (owner-approved pilot, 2026-10-15): `OrderSheet` (OV).

| Rule | Detail |
|---|---|
| Tabs | Horizontal `underline` (precedent: `ContactDrawer`). ≤5 visible; hide empty ones with `hidden`. |
| Resumen | **Contexto**: partner (link to its sheet), date **with time**, the few fields that qualify the document (channel, warehouse, POS session) and **notes**. No document number (it is the title), no repeated statuses (the lifecycle shows them). All values **left-aligned** (`DataCell` cells center by default: pass `w-auto justify-start text-left`). **Productos** (documents with lines): table from `<Entity>LineFields.toColumns()` (invariant 13) — product and linked documents (OT…) open their sheet stacked on the document; prices/subtotals net; fulfilled/invoiced as plain quantities (no %). Under it, a right-aligned totals box: Subtotal (Σ line subtotals), IVA, Total, Pagado, Saldo pendiente. No separate "Líneas" tab. |
| Status | Only `StatusBadge` (invariant 7) — including lifecycle steps (`variant="hub"`). |
| Money/quantities | `formatCurrency`/`DataCell.Currency`/`QuantityDisplay`, `tabular-nums`. No `toLocaleString`. |
| Cards | No cards inside the sheet; groups are `FormSection`/`SectionHeader` + borders. |

## 3. Lifecycle — `DocumentLifecycle`

`steps: { id, label, icon, status: success|active|neutral|destructive|not_applicable, progress?, detail? }[]`, `onStepClick?`, `activeStepId?`. No figures: amounts live in the Resumen totals box.

- Step ids equal relation areas (`origin`, `billing`, `production`, `logistics`, `treasury`); clicking a step opens Relaciones filtered by that area.
- Computed from the document's own normalized fields (`invoicing_status`, delivery/receipt status, `pending_amount`, OT progress) — never from the deprecated `related_documents` buckets. OV/OC: `getOrderLifecycle`.

## 4. Actions — `DocumentActionsMenu` + registries

One **"Acciones" button in the Drawer header, next to close** (`headerActions`). Menu order: "Siguiente paso" (primary), the other actions, **Imprimir**, then destructive ones separated. Disabled actions stay visible with their reason underneath.

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
- Rows: `RelatedDocumentRow` — line 1: `display_id` (opens with `openEntity`, stacked with "volver"; no sheet → canonical URL) + type/role; line 2: `DocumentRef.detail` (payment method + reference, DTE type, stage, line count…), date, and the partner **only when it differs from the sheet's own partner**. Right: amount (relation amount, e.g. allocated, else `DocumentRef.amount`), `StatusBadge`, optional "⋯" row actions. `accessible=false` shows the relation without content.
- Group total = Σ non-cancelled amounts (not shown for Contactos).
- States: shaped skeleton; inline error (does not break the sheet); global empty state; count of `unresolved` references.

## 5b. Navigation

The list `?selected={id}` opens the sheet **through the `openEntity` stack** (not a page-local drawer), so everything opened from it (product, OT, related documents) shows "Volver a {display}". Closing the stack clears `?selected`. Sheets call `setEntityDisplay(label, id, display_id)` once loaded so the back label shows the real number. Entity drawers that need full data (e.g. product) accept an `id`-only open via a loader (`ProductDrawerById`).

## 6. Embedded mode

`DocumentDrawerShell embedded` renders a compact header + body without `Drawer` and without the activity sidebar. Used by the POS (`OrderSheet embedded posSessionId`). The embedded sheet owns its action engine.

## 7. Anti-patterns

- Opening a document in a surface other than its sheet (Hub, ad-hoc modal).
- Reading `related_documents` buckets for new UI.
- Global action engines / imperative refs to run document actions.
- Hand-built label/value grids (`<span className="text-xs text-muted-foreground">` + `<p>`) instead of `DocumentFieldGrid`.
- Inline table columns for lines instead of `*Fields.toColumns()`.
