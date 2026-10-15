---
id: 0084
title: Document status decoupled from payment — one field per axis (lifecycle, invoicing, fulfilment, payment)
status: Accepted
date: 2026-10-15
author: backend-team
---

# 0084 — Document status decoupled from payment

**Related:** evaluation `docs/50-audit/documental/state-machine-evaluation.md`, ADR-0081 (`invoicing_status`, invoice lines), ADR-0083 (document sheet lifecycle), ADR-0040 (check bounce demotion — superseded on this point), contract `docs/20-contracts/state-map.md`.

**Status note:** Accepted 2026-10-15 by the project owner (option 1 of the evaluation: full decoupling before U3).

## Context

`TreasuryService` wrote `status = PAID` on the invoice/OV/OC as soon as a payment covered it, regardless of the previous state. A draft invoice (folio pending) that was paid lost its document state: in the dev data, 180 of 211 "paid" invoices had no folio and no invoice was left in `DRAFT`. `Invoice.Status` mixed issuing (`DRAFT`/`POSTED`/`CANCELLED`) with collection (`PAID`), and `SaleOrder`/`PurchaseOrder.Status` mixed the document lifecycle with invoicing (`INVOICED`), receiving (`RECEIVED`) and payment (`PAID`), although dedicated fields already existed (`invoicing_status`, `delivery_status`/`receiving_status`, `pending_amount`). Code worked around it ("allow PAID because a draft can be fully paid before folio is registered"), and the UI showed contradictory states (list card vs. document sheet).

## Decision

1. **One field per axis.** `status` is only the document lifecycle:
   - Invoice/note: `DRAFT` (folio pending; may already have a journal entry and payments) → `POSTED` (issued with folio) → `CANCELLED`.
   - OV: `DRAFT` → `CONFIRMED` (+ POS `PAYMENT_PENDING`) → `CANCELLED`. OC: `DRAFT` → `CONFIRMED` → `CANCELLED`.
2. **Payment is derived**, never stored in `status`: `payment_status` = `UNPAID` · `PARTIAL` · `PAID` from the balance (`core.payment_status.payment_status_for`, model property, exposed by the serializers). Invoicing and fulfilment keep `invoicing_status` and `delivery_status`/`receiving_status`.
3. **Treasury never writes a document status.** `TreasuryService.update_related_document_status` only syncs workflow tasks and runs "became paid" side effects when the payment crosses the threshold (`on_fully_paid`, used by the OC to advance its subscription — formerly triggered by the `PAID` status transition in `PurchaseOrder.save`). Billing no longer writes `INVOICED`/`PAID` on orders; annulling an invoice no longer "reverts" the order status. Check bounce/void (ADR-0040) no longer demotes: `payment_status` corrects itself.
4. **Readers by axis.** "Issued" = `POSTED` (tax books, NC/ND origin, billing stage, workflow billing task). "Active invoice" (effective total, BI invoiced amount) = `DRAFT` + `POSTED` (not cancelled), consistent with ADR-0081. Order lists filter payment with `filter_by_payment_status` (Python over a prefetched queryset; the paid amount has signs and allocations); invoices gain a `payment_status` filter.
5. **Issued requires folio.** `create_sale_invoice` with `POSTED` and no number creates a `DRAFT` (folio pending; its journal entry stays draft until `confirm_invoice`), the same as the POS checkout with pending registration. Before, these were `POSTED` without folio and payment turned them `PAID`. `audit_document_integrity` checks "POSTED without folio = 0".
6. **Data migration** (`billing/0020`, `sales/0019`, `purchasing/0014`): invoice `PAID` → `POSTED` with folio, `DRAFT` without; OV `INVOICED`/`PAID` → `CONFIRMED`; OC `RECEIVED`/`INVOICED`/`PAID` → `CONFIRMED`. Not reversible in data (no-op reverse).

## Consequences

- `state-map.md` updated (PaymentStatus tables; removed states). Frontend: invoice status filter without "Pagado" plus a separate "Pago" filter; cycle "Tesorería" reads `payment_status`; purchase funnel computed per axis.
- Tax books now count only issued invoices (with folio) — previously paid drafts leaked in as `PAID`.
- List payment filters are O(n) in Python; acceptable at PYME scale. If lists grow, store `payment_status` as a denormalized field updated by treasury (still a separate axis).

## Alternatives considered

| Alternative | Why not |
|---|---|
| Guard only (treasury stops writing `PAID`) | Leaves 180 corrupted invoices and the mixed enums |
| Store `payment_status` as a column now | Every payment path (cancel, annul, allocation, NC, checks) must keep it in sync; derived is always right |
| Keep `INVOICED` on orders as a summary | Duplicates `invoicing_status` and drifts (orders stayed `INVOICED` when paid) |
