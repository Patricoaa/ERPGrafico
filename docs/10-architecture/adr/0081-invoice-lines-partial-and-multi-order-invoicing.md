---
id: 0081
title: Invoices own their lines — partial and multi-order invoicing by quantity
status: Accepted
date: 2026-10-14
author: backend-team
---

# 0081 — Invoices own their lines: partial and multi-order invoicing by quantity

**Related:** ADR-0080 (document relations), documentary audit decisions D1, D1.1–D1.4, D2, D6 (`docs/50-audit/documental/document-decisions.md`), GAP-13, GAP-14, GAP-04 (`document-migration-roadmap.md`).

**Status note:** Accepted 2026-10-14. The business rules come from decisions D1.1–D1.4 and D2 taken by the project owner; this ADR fixes the data model that implements them. Delivered in stages M4a–M4d (see *Rollout*).

---

## Context

`Invoice` has no lines. `InvoiceSelectorExt.get_lines` returns the lines of the order, totals are copied from the order (`create_sale_invoice`, `create_purchase_bill`) and the journal entry is computed from the order lines. So an invoice is always "the whole order".

The print shop needs three modes at once (D1): one invoice per order, several partial invoices per order, and one invoice covering several orders of the same customer. Decisions:

- **D1.1** — partial invoicing is **by quantity** (no percentage of progress).
- **D1.2** — a partial invoice is **tied to a delivery**: for deliverable products each invoice line points to the delivery line it bills; you cannot bill more than was delivered.
- **D1.3** — credit/debit notes reference **invoice lines** (GAP-14).
- **D1.4** — an order invoiced in part shows **"Parcial"**.
- **D2** — payments are allocated to the invoice; the order is derived. With partial/multi-order invoices, allocation **by amount** (`PaymentAllocation`) is mandatory.

## Decision

1. **`billing.InvoiceLine`** — owned by the invoice (`invoice.lines`):
   `sale_line` / `purchase_line` (FK, PROTECT, nullable) · `delivery_line` (→ `SaleDeliveryLine`) / `receipt_line` (→ `PurchaseReceiptLine`) (FK, PROTECT, nullable) · `corrected_line` (FK self, for notes — M4c) · `product`, `description`, `quantity`, `uom`, `unit_price`, `unit_price_gross`, `tax_rate`, `discount_amount`, `subtotal` (same semantics as the order line it bills).
2. **Invoice ↔ order is N:M derived from the lines** (`line.sale_line.order`). `Invoice.sale_order` / `purchase_order` stay as the *primary order* (nullable, used by the existing 1:1 flows and as a fast path); readers that need "all orders of an invoice" use the lines (relation provider, ADR-0080).
3. **Fulfilment counters:** `SaleLine.quantity_invoiced` and `PurchaseLine.quantity_invoiced` = Σ `InvoiceLine.quantity` of non-cancelled **primary** invoices (FACTURA, BOLETA, exempt variants, PURCHASE_INV). Recomputed by `InvoicingService.recompute_order(order)` after every create/cancel/annul.
4. **`invoicing_status`** on `SaleOrder` and `PurchaseOrder`: `PENDING | PARTIAL | INVOICED`, symmetric to `delivery_status` (D1.4). The main `status` keeps its transitions; `INVOICED` there means "has an invoice" as today, and the new field carries the partial/complete distinction.
5. **Validations** (M4b): `quantity_invoiced ≤ quantity` per order line; for deliverable products in a partial invoice, Σ invoiced against a delivery line ≤ delivered quantity of that line; all orders of a multi-order invoice share the same partner and side (sale/purchase).
6. **Accounting** (M4b): the invoice entry is computed from **its own lines**, not from the order.
7. **Reading:** `get_lines` returns `InvoiceLine`s when the invoice has them; the legacy fallback (order lines) remains only for invoices not yet backfilled, and for notes returns the note's own lines (`related_note`) instead of the whole order.
8. **Backfill:** existing invoices are 1:1 with their order by construction, so each gets mirror lines of the order's original lines. Done by a management command with dry-run by default (decision D3), not by a data migration.

## Rollout

| Stage | Content | Behaviour change |
|---|---|---|
| M4a | Model, counters, `invoicing_status`, mirror lines on create, reading from lines, backfill command, relations via lines | None (full-order invoices only) |
| M4b | Partial / multi-order invoicing service + endpoint, entry from lines, advances by amount (D2), D6 scenarios | New capability |
| M4c | Notes on invoice lines (GAP-14), invoicing UI | Notes flow |
| M4d | `PaymentAllocation` single source, retire `allocated_to` (GAP-04 b/c) | Payments |

## Consequences

- Invoice totals become the sum of their lines; the order total stops being the invoice total once partial invoicing exists.
- DTE/PDF output must read `invoice.lines` (M4b/M4c).
- `Invoice.sale_order`/`purchase_order` cannot be removed: they remain the primary order and the fast path for 1:1 invoices.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Separate N:M table invoice ↔ order | Duplicates what the lines already say; lines are needed anyway for quantities (D1.1) |
| Percentage-of-progress invoicing | Rejected by D1.1 |
| Overloading `SaleOrder.status` with a `PARTIALLY_INVOICED` value | Breaks existing transitions (`sales/models.py:193-196`); a separate status mirrors `delivery_status` |
