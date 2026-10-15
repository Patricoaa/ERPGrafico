# Contract: Document Sheet (ficha documental)

> Layer 20 · ADR-0083 (replaces the Order Hub) · builds on ADR-0080 (`DocumentRef`, relations) and `component-entity-drawers.md`.
> Code: `components/shared/DocumentDrawerShell.tsx`, `DocumentLifecycle.tsx`, `DocumentActionBar.tsx`, `DocumentFieldGrid.tsx`, `RelatedDocumentsTable.tsx`; `features/documents` (`DocumentRelationsTab`, `resolveRegistryActions`); reference implementation `features/orders/components/sheet/OrderSheet.tsx`.

## 1. When

Every **document** (OV, OC, invoice/note, delivery, receipt, payment, stock move, journal entry, work order, returns…) opens in a document sheet, from any entry point (`openEntity`, list `?selected`, relations, search). Master data (contacts, products, users) keep their own master drawers.

## 2. Anatomy

```
Drawer (left, formDrawerWidth("master"))      — or embedded body (POS)
├─ Header       identity (useDrawerIdentity) · "Volver a…" (openEntity stack) · print
├─ Lifecycle    DocumentLifecycle — only documents with a cycle (OV/OC, invoices)
├─ Action bar   DocumentActionBar — 1 primary · ≤3 secondary · "Más" (destructive last)
├─ TabBar       horizontal, variant "underline"
│   ├─ Resumen     FormSection × 4 layers + DocumentFieldGrid
│   ├─ Líneas      DataTable with <Entity>LineFields.toColumns()  (invariant 13)
│   ├─ Relaciones  DocumentRelationsTab
│   └─ (type-specific, only if Relaciones does not cover it)
└─ Sidebar      ActivitySidebar (FormSplitLayout), hidden when embedded
```

| Rule | Detail |
|---|---|
| Tabs | Horizontal `underline` (precedent: `ContactDrawer`). ≤5 visible; hide empty ones with `hidden`. |
| Resumen layers | `form-layout-architecture.md` §3: **Contexto** (partner, dates, number, origin) · **Condiciones** (payment terms, warehouse, channel, fulfilment statuses) · **Totales** (net, tax, total, paid, balance) · **Ciclo de vida** (status, created/updated, notes). Read-only values through `DocumentFieldGrid` (label N2, value N3, "—" for empty). |
| Status | Only `StatusBadge` (invariant 7) — including lifecycle steps (`variant="hub"`). |
| Money/quantities | `formatCurrency`/`DataCell.Currency`/`QuantityDisplay`, `tabular-nums`. No `toLocaleString`. |
| Cards | No cards inside the sheet; groups are `FormSection`/`SectionHeader` + borders. |

## 3. Lifecycle — `DocumentLifecycle`

`steps: { id, label, icon, status: success|active|neutral|destructive|not_applicable, progress?, detail? }[]`, `figures: { label, value }[]`, `onStepClick?`, `activeStepId?`.

- Step ids equal relation areas (`origin`, `billing`, `production`, `logistics`, `treasury`); clicking a step opens Relaciones filtered by that area.
- Computed from the document's own normalized fields (`invoicing_status`, delivery/receipt status, `pending_amount`, OT progress) — never from the deprecated `related_documents` buckets. OV/OC: `getOrderLifecycle`.

## 4. Actions — `DocumentActionBar` + registries

- Source: the per-type action registry (`features/<app>/actions.tsx`, `ActionRegistry<T>`). Evaluate with `resolveRegistryActions(registry, doc, permissions, exclude)` — permission (any of `requiredPermissions`), `excludedStatus`/`requiredStatus`, `checkAvailability`, `isDisabled` + `disabledTooltip`.
- **Primary** = first enabled action of the cycle priority (OV/OC: `complete-folio` → `create-work-order` → `register-delivery`/`register-reception` → `confirm-service-delivery` → `invoice-by-lines` → `register-payment`). No primary when the cycle is complete.
- "Ver …" actions of the Hub (`view-*`, `payment-history`) are not offered: Relaciones replaces them.
- Destructive actions (`destructive: true`: cancel/annul the document) always go last in "Más", separated.
- Execution runs inside the sheet (`useOrderActionEngine` for commercial documents). **No global engine, no `ref`.** After success: refetch the document and `useInvalidateDocuments()`.
- Actions must **not** close the sheet: the `ENTITY_DRAWERS` adapter does not wire `onSuccess` (it empties the `openEntity` stack).

## 5. Relations tab — `DocumentRelationsTab`

Props: `label`, `id`, `sectionActions?: Partial<Record<DocumentDomain, DocumentActionItem[]>>`, `rowActions?: (link) => DocumentActionItem[]`, `domain?`, `onDomainChange?`.

- Groups `GET /api/core/documents/{label}/{id}/relations/` by `target.domain` (backend-declared, `document-relations.md`) in cycle order; each group: `SectionHeader` (count + sum of non-cancelled `amount`) + its actions.
- An area with actions is shown even when empty, with the action as empty state ("Sin documentos de tesorería · Registrar pago").
- Rows: `RelatedDocumentRow` — role, `display_id` (opens with `openEntity`, stacked with "volver"; no sheet → canonical URL), date, partner, amount/quantity, `StatusBadge`, optional "⋯" row actions. `accessible=false` shows the relation without content.
- States: shaped skeleton; inline error (does not break the sheet); global empty state; count of `unresolved` references.

## 6. Embedded mode

`DocumentDrawerShell embedded` renders a compact header + body without `Drawer` and without the activity sidebar. Used by the POS (`OrderSheet embedded posSessionId`). The embedded sheet owns its action engine.

## 7. Anti-patterns

- Opening a document in a surface other than its sheet (Hub, ad-hoc modal).
- Reading `related_documents` buckets for new UI.
- Global action engines / imperative refs to run document actions.
- Hand-built label/value grids (`<span className="text-xs text-muted-foreground">` + `<p>`) instead of `DocumentFieldGrid`.
- Inline table columns for lines instead of `*Fields.toColumns()`.
