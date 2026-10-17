---
id: 0085
title: Stock moves owned by the business document — StockMove.source_document GFK, InventoryDocument reserved for standalone operations
status: Accepted
date: 2026-10-15
author: backend-team
---

# 0085 — Stock moves owned by the business document

**Related:** documentary audit `docs/50-audit/documental/` (assessment, target architecture, decisions D1–D7), ADR-0080 (unified document model — no parent `Document` table, no generic relation table), ADR-0016 (source-document GFK, the pattern reused here), ADR-0081 (invoices own their lines — the commercial document as the business layer), `docs/20-contracts/document-relations.md`, `docs/20-contracts/entity-identity.md`, `docs/50-audit/documental/documents-inventory.md`.

**Status note:** Accepted 2026-10-15 by the project owner (option **B** of the Phase-2 evaluation: unify stock in the commercial document). Implemented in phases 2.0–2.5; 2.0 (the enabler) lands under this ADR.

## Context

Every confirmed commercial document that moves stock **also** minted an `InventoryDocument`: a sale delivery → `DELIVERY`, a purchase receipt → `RECEIPT`, a sale/purchase return and the notes that return goods → `RECEIPT`/`DELIVERY`, and a work order → `PRODUCTION`. The two rows were joined only by a **textual pseudo-GFK** (`InventoryDocument.source_document_type` + `source_document_id`, `inventory/models.py:1452-1453`) with no referential integrity; the link was reconstructed by parsing strings, and dev data already shows the cost — 21 `RECEIPT` rows with an empty source, 148 of 186 deliveries materialised (not all), 10 of 40 receipts.

The evaluation (Phase 2, 2026-10-15) established that the **commercial document is the business layer**, not a duplicate of the stock ledger:

- `InvoiceLine.delivery_line` / `receipt_line` (`billing/models.py:297-303`) anchor **partial invoicing** (ADR-0081); `invoice_from_lines.py:46-56` selects `SaleDeliveryLine`/`PurchaseReceiptLine` as the source.
- Per-line fulfilment lives on the commercial document (`PurchaseLine.quantity_received`, `SaleLine.quantity_delivered`, `receiving_status`/`delivery_status`).
- Costing (real `unit_cost` → weighted average) and **three-way match** accounting run off the commercial document (`AccountingMapper.get_entries_for_delivery`, …).
- Legal metadata (`delivery_reference`, `related_note`, sequential folio) belongs to the commercial document.

Fusing everything into `InventoryDocument` (option C) would recreate the generic document table that ADR-0080 **rejected**, and would push commercial semantics into a stock model. Welding the seams without removing the duplicate (option A) leaves the textual pseudo-GFK and the double write forever. The owner chose **option B**: the commercial document owns its stock moves directly; `InventoryDocument` is reserved for standalone stock operations.

## Decision

1. **Business documents own their stock moves.** Sale delivery, purchase receipt, sale/purchase return, the notes that return goods, and the work order create `StockMove` rows **directly** and **no longer mint an `InventoryDocument`**.
2. **`InventoryDocument` is reserved for standalone stock operations** — those with no commercial document: `ADJUSTMENT` (manual adjust, count), `TRANSFER`, `PARTNER_CONTRIBUTION`, `PARTNER_WITHDRAWAL`. These keep the existing document + details flow.
3. **One writer for `StockMove`.** A single primitive `StockService.create_move(...)` is the only place `StockMove` is created. Both the commercial flows and `InventoryService.confirmar_documento`/`anular_documento` go through it. This makes the "single writer" invariant explicit and testable.
4. **Typed provenance on the move.** `StockMove` gains `source_document` as a **GenericForeignKey** (`source_content_type` + `source_object_id`), the same shape as `JournalEntry.source_document` (ADR-0016). It replaces the textual pseudo-GFK on `InventoryDocument` and the string parsing of `StockMove.description`. GFK is chosen because the originating-type set grows over time (delivery, receipt, returns, notes, work order) and any single typed FK would be null most of the time — the ADR-0016 rule. It is the only link that attributes moves **without a line** (BOM/component explosion, finished-product output) and **reversal** moves to their document.
5. **`StockMove.description` cites the source document folio** (e.g. `Despacho DES-186`, `Recepción REC-42`, `Producción OT-7`) instead of the `InventoryDocument` folio.
6. **No stock-data migration.** Existing `StockMove` rows and the historical `InventoryDocument` rows (RECEIPT/DELIVERY/PRODUCTION) are **preserved**; new flows simply stop creating documents. Backfill sets `source_document` on legacy moves where a typed line link already exists. Cleanup of historical documents is a later phase (ADR-0080 §M6 style), not part of this ADR.
7. **Production is included.** Work-order material consumption is already typed via `ProductionConsumption.stock_move` (`production/models.py:333`); the finished-product move gets `source_document → WorkOrder`. `production/services.py` stops minting `InventoryDocument(PRODUCTION)`.

## Consequences

- Each app's `relations.py` provider switches from "find the derived `InventoryDocument`" to reading `source_document` / the typed line link (`sales/relations.py`, `purchasing/relations.py`, `production/relations.py`, `inventory/relations.py`).
- The kardex (`StockMoveDrawer`) shows the commercial folio and resolves its source through `source_document`.
- Contract changes (layer 20): `document-relations.md` (provenance source of the `stock_move` link) and `entity-identity.md` (the `INV` document becomes a standalone-operations document only). `documents-inventory.md` is updated to state the scope.
- `backfill_document_links` and `audit_document_integrity` are updated: the audit's "commercial stock move without source document = 0" replaces "delivery has its derived document".
- Legacy branches for `RECEIPT`/`DELIVERY`/`PRODUCTION` in `confirmar_documento` and in `InventoryDocumentDetailManager` become dead for new data and are removed once historical rows are gone.
- `StockMove.source_document` has no DB-level FK to its target (GFK); integrity is carried by the immutable `StockMove` + `PROTECT`/`SET_NULL` typed line pointers that coexist.

## Alternatives considered

| Alternative | Why not |
|---|---|
| **A — weld the seams only** (keep both, fix the pseudo-GFK) | Keeps the double write and the text link forever; does not remove the redundancy the audit flagged |
| **C — fuse into `InventoryDocument`** | Recreates the generic parent `Document` table ADR-0080 rejected; pushes invoicing/fulfilment/legal semantics into a stock model |
| **Typed per-type FKs** (`StockMove.sale_delivery`, `…purchase_receipt`, …) | Grows with every type, almost all null, no single query axis; ADR-0016 chose GFK over this for exactly this reason |
| **Line-only link, no document link** | Cannot attribute BOM/component, finished-product and reversal moves that have no line |

## References

- `docs/50-audit/documental/document-system-assessment.md`, `target-document-architecture.md`, `documents-inventory.md`
- ADR-0080 (no generic document table), ADR-0081 (invoice lines), ADR-0016 (GFK pattern)
- `backend/inventory/models.py` (`InventoryDocument`, `StockMove`), `backend/inventory/services.py` (`confirmar_documento`, `StockService.adjust_stock`), `backend/production/models.py` (`ProductionConsumption`)
