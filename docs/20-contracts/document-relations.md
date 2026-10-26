---
layer: 20-contracts
doc: document-relations
status: active
owner: backend-team
last_review: 2026-10-14
stability: contract-changes-require-ADR
---

# Document relations — DocumentRef, relation providers and canonical document URLs

Decision: [ADR-0080](../10-architecture/adr/0080-document-model-relations-and-navigation.md) (Accepted 2026-10-14).
Origin: documentary audit [`docs/50-audit/documental/`](../50-audit/documental/document-system-assessment.md).

## 1. `DocumentRef`

The only shape that represents "a document" between modules and towards the UI.

| field | type | notes |
|---|---|---|
| `label` | `string` | `app.model`, same key as `UniversalRegistry` / `ENTITY_REGISTRY` / `ENTITY_DRAWERS` |
| `id` | `number` | pk |
| `display_id` | `string` | `obj.display_id`, else the registry short template |
| `title` / `icon` | `string` / `string \| null` | from `SearchableEntity` |
| `domain` | `string` | operational area (ADR-0083, see below); always present, also for dangling refs |
| `amount` | `string \| null` | document amount: `DocumentType.amount_field` or first of `effective_total`, `total`, `amount`; `null` when not meaningful (deliveries, entries, stock moves, contacts) or no access |
| `detail` | `string \| null` | short type-specific text that identifies the document in a list (`DocumentType.detail(obj)`): payment = movement type · method · ref; invoice = DTE type · payment method; delivery = lines · warehouse; OT = stage · description; entry = description; contact = name · tax id · email |
| `status` / `status_display` | `string \| null` | `null` when the type has no status or the user has no access |
| `date` | ISO `string \| null` | first of `date`, `delivery_date`, `receipt_date`, `return_date`, `created_at` (or declared field) |
| `partner_name` | `string \| null` | customer / supplier / contact / partner (or declared path) |
| `url` | `string \| null` | canonical URL (§4); `null` when `exists=false` |
| `accessible` | `boolean` | user has the type's view permission; if `false`, status/date/partner are `null` |
| `exists` | `boolean` | `false` = dangling reference (deleted target, broken GFK/PGFK) |

Backend: `core.documents.build_ref(obj, user)` / `ref_for(label, id, user)`. Frontend type: `DocumentRef` from `@/features/documents` (Zod-validated).

## 2. Endpoints (read-only)

| Method | URL | Response |
|---|---|---|
| GET | `/api/core/documents/{label}/{id}/` | `DocumentRef` (404 if the document does not exist) |
| GET | `/api/core/documents/{label}/{id}/relations/?semantic=&direction=` | `{document: DocumentRef, relations: DocumentLink[], unresolved: {label, id, role, reason}[]}` |

- 404 for an unknown label; 403 if the user cannot view **the requested** document. Related documents without permission are returned with `accessible=false` (the relation is shown, its content is not).
- `unresolved` lists targets that do not exist; they never appear in `relations`.
- Frontend hooks: `useDocumentRef(label, id)`, `useDocumentRelations(label, id, filters?)`.

### `DocumentLink`

| field | values |
|---|---|
| `semantic` | `derivation` · `fulfillment` · `settlement` · `posting` · `correction` · `reference` · `association` |
| `direction` | `outgoing` (this document → target) · `incoming` (target → this document) |
| `role` | target's role: `delivery`, `invoice`, `credit_note`, `debit_note`, `payment`, `sale_order`, `purchase_order`, `stock_move`, `inventory_document`, `journal_entry`, `source_document`, `work_order`, `return`, `reverses`, `reversal`, `corrected_invoice`… |
| `amount` / `quantity` | optional (payment amount, delivered quantity) |
| `is_dependency` | `true` for derivation/fulfillment chains; `false` for loose associations |

Invoice ↔ order is always a list in both directions (decision D1): consumers must not assume one order per invoice.

## 3. Providers

Each app declares its types and providers in **`<app>/relations.py`** (autodiscovered by `CoreConfig.ready`):

```python
from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider

DocumentTypeRegistry.register(DocumentType(label="sales.saleorder", canonical_url="/sales/dtes/orders?selected={id}"))

@relation_provider("sales.saleorder")
def sale_order_relations(order):
    for delivery in order.deliveries.all():
        yield Link("fulfillment", "outgoing", "delivery", delivery)
```

Rules:
- Providers read **typed FKs only**. No parsing of `description`/`reference` text, no heuristic matching.
- A target that may not exist (GFK/PGFK) is yielded as `(label, id)`; the service reports it in `unresolved`.
- Duplicate (role, target) pairs are collapsed by the service.
- Pilot coverage (M2): `sales.saleorder`, `sales.saledelivery`, `billing.invoice`, `treasury.treasurymovement`, `accounting.journalentry`, `inventory.stockmove`, `inventory.inventorydocument`. Purchasing/production/other modules: phase M5.

## 4. Canonical URL

Generated only by `DocumentTypeRegistry.canonical_url(label, obj)`:

1. A declared pattern / function — only when the list really opens **that** document with `?selected` (ADR-0020). OV, OC and invoices open their document sheet (ADR-0083).
2. Otherwise the resolver **`/d/{label}/{id}`** (`app/(dashboard)/d/[label]/[id]`): redirects to the canonical URL if there is one, or opens the drawer registered in `ENTITY_DRAWERS` via `openEntity`.

`core/tests/test_document_routes_sync.py` fails if a declared canonical URL (or the resolver) has no frontend route, or if a registered type has neither a declared canonical URL nor a drawer in `ENTITY_DRAWERS`.
Universal search returns `detail_url = DocumentTypeRegistry.url_for(label, id)` (declared pattern, or the resolver when the URL depends on the instance).

**Drilldown (ADR-0100; ADR-0086 superseded).** All consumers go through `useOpenDocument`. A document with a registered drawer opens as a workspace tab over the origin list (module and URL unchanged, ADR-0101); without a drawer the frontend navigates to the canonical `DocumentRef.url`. Masters (contact, product…) use the resolver, so they keep the drawer. See `component-entity-drawers.md` §5.2.

| label | canonical URL |
|---|---|
| `sales.saleorder` | `/sales/dtes/orders?selected={id}` (document sheet, ADR-0083) |
| `purchasing.purchaseorder` | `/purchasing/dtes/orders?selected={id}` (document sheet, ADR-0083) |
| `billing.invoice` | sale: `/sales/dtes?selected={id}` (document sheet) · purchase: resolver (ADR-0089) |
| `treasury.treasurymovement` | `/treasury/operaciones/movements?selected={id}` |
| `accounting.journalentry` | `/accounting/entries?selected={id}` |
| `inventory.stockmove` | `/inventory/reports/movements?selected={id}` |
| everything else (e.g. `sales.saledelivery`) | `/d/{label}/{id}` |

## 5. UI components

| Component | Where | Use |
|---|---|---|
| `RelatedDocumentsTable` | `@/components/shared` | Presentation only: relations grouped by semantic (origin/generated, logistics, payments, notes/returns/reversals, accounting, other). Rows show role, `display_id`, status, date, partner, amount/quantity; inaccessible targets show "sin acceso" without link; `loading`/`empty`/`error` + unresolved count |
| `DocumentRelationsSection` | `@/features/documents` | Fetches with `useDocumentRelations` and opens each target with the ADR-0086 rule: navigate to `DocumentRef.url` when it opens a list (`?selected=`), else `openEntity` (stack + back) |
| `DocumentDrawerShell` | `@/components/shared` | Common document sheet (ADR-0083): lifecycle, action bar, tabs, activity sidebar, `embedded`; legacy `summary`/`children`/`related` layout still used by `SaleDeliveryDrawer`, `PurchaseReceiptDrawer`. Contract: [component-document-sheet.md](./component-document-sheet.md) |
| `DocumentRelationsTab` | `@/features/documents` | Relations tab of the document sheet: groups by `domain`, area and row actions, area filter (ADR-0083) |

Every document opens its document sheet with the relations tab (ADR-0083, U2–U5; see `component-document-sheet.md`). `DocumentRelationsSection` remains for forms with a view mode (journal entry).

### `domain` (ADR-0083)

Operational area of the document type: `origin | billing | production | logistics | treasury | accounting | contacts | other`, in lifecycle order. Declared by `DocumentTypeRegistry` — `DocumentType(domain=...)` overrides the app default (`DEFAULT_DOMAIN_BY_APP`; OV/OC declare `origin`). The document sheet's relations tab groups by it (`component-document-sheet.md` §5). Additive field; unknown values parse as `other` in the frontend.

### Indirect links (ADR-0083)

After the providers, the service appends for every document (respecting `semantic`/`direction` filters, deduplicated):
- `posting` → the `journal_entry` of each related document that has one (the document itself does not reference them);
- `association` → the counterparty of the document and of each related document (`partner_path` / default paths), role `customer` | `supplier` | `contact`, each contact once.

## 6. Legacy relation formats — removed (ADR-0083 U6, 2026-10-15)

The three legacy formats were retired once the Order Hub was removed. Do not reintroduce them.

| Removed | Replacement |
|---|---|
| `related_documents` buckets of OV/OC (`get_related_documents`) | Typed summary fields on the order serializers: `invoices`, `notes` (`{id, display_id, number, dte_type, dte_type_display, status, total}`), `deliveries` (OV) / `receipts` (OC) (`{id, display_id, status, date}`), plus `serialized_payments` (now with `status`). Built by `SaleOrderSelector` / `PurchaseOrderSelector.get_document_summary`. Full relations: the relations endpoint |
| `Invoice.related_documents`, `related_stock_moves`, `related_returns` | Relations endpoint (no consumer read real data from them: the list had no payments and the moves had no state) |
| `JournalEntry.source_documents` | `source_document`: a `DocumentRef` (+ `source_content_type_id` / `source_object_id` for the edit form) |

**Removed in M6:** `StockMove.related_documents` (no readers since M3), GFK `TreasuryMovement.allocated_to` and its columns (no writers or readers; empty; migration `treasury/0094`), `DRAWER_MAP` (M5).

## 7. Anti-patterns

| Anti-pattern | Correct |
|---|---|
| New ad-hoc `related_*` field in a serializer | A provider in `<app>/relations.py` |
| Linking documents through text (`description`, `reference`) | Typed FK, then a provider |
| Building document URLs in components (`/sales/dtes/orders/${id}`) | `DocumentRef.url` |
| A generic "relations" table | Typed FKs (ADR-0080 §Alternatives) |
| Ad-hoc "related documents" list inside a drawer | `DocumentRelationsSection` |
| Stacking an in-memory drawer for a document whose canonical URL opens a list | Navigate to `DocumentRef.url` when it has `?selected=` (URL + module follow the relationship, ADR-0086); `openEntity` only for resolver/master targets |
