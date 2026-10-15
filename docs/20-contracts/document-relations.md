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

DocumentTypeRegistry.register(DocumentType(label="sales.saleorder", canonical_url="/sales/orders?selected={id}"))

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

1. A declared pattern / function — only when the list really opens **that** document with `?selected` (ADR-0020). OV/OC/sale invoices open the Order Hub (decision D4).
2. Otherwise the resolver **`/d/{label}/{id}`** (`app/(dashboard)/d/[label]/[id]`): redirects to the canonical URL if there is one, or opens the drawer registered in `ENTITY_DRAWERS` via `openEntity`.

`core/tests/test_document_routes_sync.py` fails if a declared canonical URL (or the resolver) has no frontend route, or if a registered type has neither a declared canonical URL nor a drawer in `ENTITY_DRAWERS`.
Universal search returns `detail_url = DocumentTypeRegistry.url_for(label, id)` (declared pattern, or the resolver when the URL depends on the instance).

| label | canonical URL |
|---|---|
| `sales.saleorder` | `/sales/orders?selected={id}` (Order Hub) |
| `purchasing.purchaseorder` | `/purchasing/orders?selected={id}` (Order Hub) |
| `billing.invoice` | sale: `/billing/sales?selected={id}` (Order Hub) · purchase: resolver |
| `treasury.treasurymovement` | `/treasury/operaciones/movements?selected={id}` |
| `accounting.journalentry` | `/accounting/entries?selected={id}` |
| `inventory.stockmove` | `/inventory/reports/movements?selected={id}` |
| everything else (e.g. `sales.saledelivery`) | `/d/{label}/{id}` |

## 5. UI components

| Component | Where | Use |
|---|---|---|
| `RelatedDocumentsTable` | `@/components/shared` | Presentation only: relations grouped by semantic (origin/generated, logistics, payments, notes/returns/reversals, accounting, other). Rows show role, `display_id`, status, date, partner, amount/quantity; inaccessible targets show "sin acceso" without link; `loading`/`empty`/`error` + unresolved count |
| `DocumentRelationsSection` | `@/features/documents` | Fetches with `useDocumentRelations` and opens each target with `openEntity` (stack + back; OV/OC → Hub per D4); types without drawer navigate to `DocumentRef.url` |
| `DocumentDrawerShell` | `@/components/shared` | Common document sheet: header (caller's `useDrawerIdentity`), `summary`, type-specific `children`, `related` slot, loading/error. Used by `SaleDeliveryDrawer`, `PurchaseReceiptDrawer` |

Sheets with the relations section (M3): delivery, receipt, invoice, treasury movement, journal entry (view), stock move, inventory document, and the Order Hub (OV/OC/invoice in note mode). Existing drawers keep their layout and add the section; full migration to `DocumentDrawerShell` happens when each drawer is touched (M5).

## 6. Legacy formats (deprecated, removal in M6)

`SaleOrderSelector/PurchaseOrderSelector.get_related_documents` (`related_documents` buckets), `Invoice.related_documents`, `JournalEntry.source_documents`/`source_info`. Do not add new consumers; use the relations endpoint.

## 7. Anti-patterns

| Anti-pattern | Correct |
|---|---|
| New ad-hoc `related_*` field in a serializer | A provider in `<app>/relations.py` |
| Linking documents through text (`description`, `reference`) | Typed FK, then a provider |
| Building document URLs in components (`/sales/orders/${id}`) | `DocumentRef.url` |
| A generic "relations" table | Typed FKs (ADR-0080 §Alternatives) |
| Ad-hoc "related documents" list inside a drawer | `DocumentRelationsSection` |
| Opening a related document with `router.push` when it has a drawer | `openEntity` (keeps the stack and "volver") |
