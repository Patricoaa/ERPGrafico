---
id: 0052
title: Purchase checkout endpoint in idempotency closed list
status: Accepted
date: 2026-07-01
author: backend-team
---

# 0052 — Purchase checkout endpoint in idempotency closed list

## Context

The `POST /api/purchasing/orders/purchase_checkout/` endpoint performs a multi-entity
transaction: it creates or confirms a purchase order, registers a supplier invoice,
creates a treasury movement (payment), and potentially a receipt — all within a single
`@transaction.atomic` block. A double-click or network retry would produce duplicate
invoices, payments, and stock movements, causing fiscal and accounting inconsistencies.

The backend already has `@idempotent_endpoint(scope="purchasing.order.checkout")`
decorating the view, but the endpoint is not listed in the HTTP closed list in
`docs/20-contracts/idempotency.md`. Adding it requires an ADR per the contract's
own rules ("Agregar uno requiere ADR").

## Decision

Add `POST /api/purchasing/orders/purchase_checkout/` to the idempotency closed list
with scope `purchasing.order.checkout`.

## Consequences

**Positive**:
- Prevents duplicate purchase checkout submissions (double payments, duplicate invoices).
- Aligns the contract with the existing backend decorator.
- Frontend will generate and send an `Idempotency-Key` header, consistent with Sales
  checkout and other idempotent endpoints.

**Negative**:
- Frontend must generate a UUID per checkout attempt (minor complexity).

**Neutral**:
- The scope `purchasing.order.checkout` is already used by the decorator.
- The endpoint is logically similar to `pos_checkout` which is already idempotent.

## Alternatives considered

| Alternative | Reason rejected |
|-------------|-----------------|
| Remove the decorator from the backend | Would expose users to duplicate checkout risk; the `@idempotent_endpoint` + `DistributedLock` double-layer was intentional |
| Keep undocumented | Violates the contract rule that all idempotent endpoints must be in the closed list |

## References

- Contract: [idempotency.md](../../20-contracts/idempotency.md)
- View: `backend/purchasing/views.py` line 222
- Service: `backend/purchasing/services.py` lines 1294–1306 (DistributedLock wrapper)
