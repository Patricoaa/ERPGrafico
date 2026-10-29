---
id: 0102
title: Work order stage graph owned by the server — applicable stages, cancellation through annulment, merged stage_data
status: Proposed
date: 2026-10-27
author: production-team
---

# 0102 — Work order stage graph owned by the server

**Related:** ADR-0091 (edit policy), contract `state-map.md` § WorkOrder, `deletion-policy.md` (WorkOrder = Anulación).

## Context

An audit of the OT flow (POS → OV → wizard → stages) found that the wizard and the server held two different stage graphs:

- The server accepted forward moves from a fixed allowlist per stage; the wizard computed its own rail from the materials and phases. OTs without materials, prepress-only jobs or jobs without print phases had no valid "Siguiente" (dead ends), and `FINISHED` was unreachable when the rail hid `RECTIFICATION`.
- `transition`/`bulk_transition` to `CANCELLED` skipped the annulment rules (limit stage, consumptions, purchase orders); `annul_work_order` itself let an OT in `RECTIFICATION` through.
- The Express flow (`mfg_auto_finalize`) finished the OT through `transition_to(FINISHED)` from the first stage, which the allowlist rejects; and services read the flag from the manufacturing profile only, which real products don't have.
- A rewind was blocked by any confirmed purchase order, even when it did not reopen the outsourcing assignment.
- Generic `PATCH` replaced `stage_data` wholesale from the client's copy, wiping keys written by the server meanwhile.

## Decision

1. **The server owns the stage graph** (`WorkOrderService.STAGE_SEQUENCE`). A stage is *mandatory* for an OT when it applies to it: `MATERIAL_APPROVAL` with own materials, `PREPRESS`/`PRESS`/`POSTPRESS` when the OT requires them, `OUTSOURCING_VERIFICATION` with outsourced services, and always `RECTIFICATION`. A forward move may skip only non-mandatory stages (`allowed_forward_stages`). `FINISHED` is reachable only from `RECTIFICATION`. A move to the current stage is rejected.
2. **The rail follows the server.** The serializer exposes `stage_plan` (stages the wizard shows) and `next_stage`; the wizard renders `stage_plan` and keeps its local derivation only as a fallback.
3. **Cancelling is annulling.** `transition_to(…, CANCELLED)` delegates to `annul_work_order`, which uses the model's `is_cancellable`. Annulling cancels the OT's open tasks (`Task.Status.CANCELLED`). Bulk moves cannot rewind (a rewind needs a reason; wizard only).
4. **Rewind blockers depend on the target.** Confirmed purchase orders block only rewinds to `OUTSOURCING_ASSIGNMENT` or earlier; stock consumptions block any rewind. `side_effects.rewind_blockers_by_stage` gives the UI the same answer per stage. A rewind reopens the target stage's approval; later stages reopen theirs when the OT enters them again (no automatic approval on the user's behalf any more).
5. **Express finalizes directly** (`_finalize_express`): consumes the BOM and closes the OT without walking the stage graph. At dispatch a failure aborts the delivery; the delivery and its COGS mapper skip the BOM explosion only for lines whose OT is `FINISHED`. `Product.is_express` is the single reader of the flag (profile first, legacy field otherwise); phase flags follow the same rule in `WorkOrder._requires_phase`.
6. **`PATCH stage_data` merges** into the stored dict; clients send only the keys they edit.
7. **Creation never falls back to a bare model create**: a payload without product nor sale line, or a non-manufacturable line, is a 400. Design files are kept for both origins, whatever key the client used.
8. **A WorkOrder is annulled, never deleted** (`deletion-policy.md`: WorkOrder = Anulación). `DELETE /api/production/orders/{id}/` answers 405; the row action and the wizard offer only "Anular", also for a draft OT (gated by `is_cancellable`).
9. **Adding a material merges only into the same variant** — component, own/outsourced, supplier and UoM, the identity of `unique_workorder_material_variant`. The POS planning drafts go through it, so an outsourced draft no longer takes over the BOM row of the same component and quantities in different UoMs are no longer added.
10. **Checkout of an existing order carries the manufacturing edits**: `order_data = {id, line_edits: [{line_id, manufacturing_data}]}`, in the checkout's line order (the order that keys `line_<n>_design_<m>`). `SalesService.apply_checkout_line_edits` saves them on the lines and re-keys the files to the pk order `confirm()` uses. Only a DRAFT order accepts edits; once confirmed the OT owns the configuration and the checkout hides its manufacturing step.

## Consequences

- OTs that were stuck can move on; transitions that used to skip mandatory stages (e.g. `MATERIAL_ASSIGNMENT → PRESS` with own materials) are now rejected.
- Products flagged Express through the legacy field start creating their OT at dispatch (until now a dormant path); a dispatch fails when the OT cannot consume its components (insufficient stock), instead of leaving them unconsumed.
- Clients can no longer delete `stage_data` keys through `PATCH` (none did).
- An OT created by mistake is annulled instead of deleted: it keeps its number and history, and frees its sale line (the per-line uniqueness only counts DRAFT/IN_PROGRESS OTs).
- The OT no longer gets `approval_attachment: null` from the sale: the customer's approval is captured at the prepress approval.
