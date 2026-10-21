---
id: 0091
title: Economic immutability — documents with posted derivatives are corrected by annul + recreate, enforced by a declarative edit policy
status: Accepted
date: 2026-10-21
author: backend-team
---

# 0091 — Economic immutability and declarative edit policy

**Related:** evaluation `docs/50-audit/editabilidad-documental/evaluacion-editabilidad.md`, contract `docs/20-contracts/state-map.md` (edit restrictions, journal reversal flow), `docs/20-contracts/deletion-policy.md`, ADR-0084 (one status field per axis), ADR-0085 (stock moves owned by business document).

**Status note:** Principle accepted 2026-10-21 by the project owner. The owner delegated the choice of mechanism (model vs. service) to a best-practice evaluation (§ "Mechanism") and chose to build the common mechanism before patching individual holes.

## Context

`state-map.md` declares edit restrictions per entity ("only editable in `DRAFT`", immutable fields), but enforcement is opt-in per ViewSet: four services (`BillingService`, `SalesService`, `PurchasingService`, `JournalEntryService`) each repeat a `validate_editable`, and every other model is unprotected. Documents that already generated a posted journal entry or a treasury movement accept `PATCH`/`DELETE` without checking state — `TreasuryMovement`, `Payroll`, `PayrollItem`, `SalaryAdvance`, `PayrollPayment`, F29, deliveries. Editing them leaves the derivatives untouched, so RRHH/treasury/ledger diverge (origin case: a paid salary advance whose amount was edited and then discounted in a payroll with the new amount). Frontend drawers decide `readOnly` on their own, which hides the backend gaps.

## Decision

### Principle — economic immutability

1. When a record has **posted derivatives** (a `POSTED` journal entry, a treasury movement, stock moves), its **economic fields** — amount, date, counterparty, accounts, lines, links that feed a derivative — are immutable. Descriptive fields (`notes`, attachments, audit metadata) stay editable.
2. A locked record is corrected by **annul + recreate**: annul produces the reversal (`REVERSAL` journal entry linked via `reversal_of`, inverse treasury movement, inverse stock moves) and the original stays intact for audit.
3. Edits are **never propagated** to derivatives. Propagation is rejected: each document has different derivatives, cascades are fragile, and it erases the audit trail the reversal model already provides.
4. Delete follows the same lock: a locked record is never hard-deleted (`deletion-policy.md`).

### Mechanism — declare on the model, enforce at the write boundaries

- **Declaration (single source of truth):** each model with derivatives declares an `EditPolicy`:
  - `editable_statuses` — statuses where the record is freely editable (e.g. `{"DRAFT"}`), and/or
  - `is_locked(instance)` — predicate for models whose lock is not a status (e.g. `TreasuryMovement`: its journal entry is `POSTED`; `SalaryAdvance`: it has a payment),
  - `mutable_when_locked` — field names still writable when locked (default `{"notes"}`),
  - `deletable` — whether an unlocked record may be hard-deleted.
  - `is_purgeable(instance)` — a locked record that may still be hard-deleted (cancelled, no accounting trace).
  - **Master data (class C, added 2026-10-21):** `frozen_when_used` + `is_used(instance)` — the record stays editable, but these fields are rejected once it has history (e.g. `Account.account_type` with journal items, `Product.uom` with stock moves).
- **Enforcement:**
  - API: a ViewSet mixin applies the policy in `update`, `partial_update` and `destroy`, comparing the incoming validated fields against `mutable_when_locked`.
  - Services and nested endpoints (payroll items, advance linking, Celery tasks): call `assert_editable(instance, fields)` from the same policy.
  - System transitions (posting writes `status`/`journal_entry`/totals; annul) run inside services and are explicitly allowed — the policy guards *user edits*, not the state machine.
- **Not in `Model.save()`:** a `save()` override would also block the service transitions that legitimately write locked fields, and `QuerySet.update()`/bulk writes bypass it anyway, so it gives false confidence.
- **Not only in serializers:** serializers miss service and Celery paths, and per-serializer `read_only_fields` is exactly the opt-in pattern that failed.
- The existing `validate_editable` helpers are re-expressed through the policy.

### Transversal evaluation — contract test (ratchet)

A contract test enumerates **every concrete model** and requires one of:
- an `EditPolicy` (models with derivatives or a status lifecycle), or
- an explicit classification in a baseline (`master`, `config`, `log`/`append-only`, `child-of:<parent>`) with a reason.

Unclassified models fail. The baseline of known-unprotected models may only shrink. This makes the inventory complete by construction and covers new models automatically.

### Frontend

Serializers expose `is_editable` (and `editable_fields` where partial editing applies). Drawers derive `mode`/`readOnly` from it instead of local deductions.

## Consequences

- One mechanism replaces four copies of `validate_editable`; every model gets a reviewed policy.
- Corrections of paid/posted documents require an annul flow per entity; entities without one (e.g. `SalaryAdvance`) need it before they can be locked.
- `SalaryAdvance` gains a status (`DRAFT` → `PAID` → `DISCOUNTED`, `CANCELLED`) and an entry in `state-map.md`.
- `state-map.md` "Edit restrictions" become the human-readable mirror of each `EditPolicy`; drift is caught by the contract test.
- Before locking, existing inconsistencies must be counted and fixed on the dev server (advance amount ≠ its movement; movement amount ≠ its journal entry).

## Alternatives considered

| Alternative | Why not |
|---|---|
| Propagate edits to derivatives | Fragile per document, erases audit trail, contradicts the reversal model |
| Guard in `Model.save()` | Blocks legitimate service transitions; bypassed by `QuerySet.update()` |
| Guard only in serializers / per ViewSet | Current state; opt-in, misses services and Celery |
| Patch `TreasuryMovement` first, mechanism later | Owner chose the common mechanism first to avoid another round of ad-hoc guards |
| PostgreSQL triggers | Strongest guarantee but logic outside Django, harder to test/evolve at PYME scale; may be reconsidered for `JournalItem` only |
