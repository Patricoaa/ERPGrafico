---
id: 0115
title: Materialized posted totals on accounting accounts
status: Accepted
date: 2026-11-05
author: fullstack-team
---

# 0115 — Saldos contabilizados materializados por cuenta

## Context

`GET /api/accounting/accounts/` calculaba `debit_total`, `credit_total` y `posted_items_count` con `Sum`/`Count` sobre `journal_items` en cada petición (`accounting/selectors.py`). Ese costo crece con todos los movimientos contabilizados, no con la página. La misma lista anotaba `Count("children")` en el mismo join, lo que multiplicaría las sumas de una cuenta padre por su número de hijos. En el flujo normal una cuenta padre no tiene ítems (el modelo lo valida), así que el efecto es latente, pero el join existía.

## Decision

1. Tres campos en `Account`: `posted_debit_total`, `posted_credit_total`, `posted_items_count`. No editables. Migración `0044` con backfill.
2. `accounting/balances.py` los mantiene:
   - Al guardar un asiento cuyo estado (cargado o nuevo) afecta saldo (`POSTED`, `CLOSED`, `REVERSAL`), se recalculan las cuentas de sus ítems.
   - Al crear, modificar o eliminar un ítem de un asiento que afecta saldo, se recalcula su cuenta.
   - Cada recálculo es una sola sentencia `UPDATE` con subqueries correlacionadas, sin importar el número de cuentas.
3. La lista de cuentas lee los campos planos; ya no hace joins de suma. `Account.debit_total`, `credit_total` y `has_posted_items` leen los mismos campos.
4. `refresh_account_totals` permite recalcular todo tras una corrupción o restauración.

## Consequences

- Lectura O(1) por cuenta. Escritura: un `UPDATE` extra por publicación o anulación de asiento.
- Supuesto: los ítems de un asiento que afecta saldo no cambian sin pasar por las señales. La edición de asientos publicados está bloqueada (ADR-0091). Los ítems creados con `bulk_create` no disparan señales: si el asiento ya está publicado, hay que llamar a `refresh_accounts_of_entry`, como hace `InventoryService.confirmar_documento`. Los asientos de apertura y cierre nacen en `DRAFT` y se recalculan al publicarlos.
- `has_posted_items` ahora usa los estados que afectan saldo (antes solo `POSTED`), igual que la lista.
- Los saldos materializados no son fuente de verdad contable: el libro mayor sigue siendo `JournalItem`.
- Una instancia ya cargada no ve publicaciones posteriores. Las validaciones que mueven dinero usan `TreasuryAccount.fresh_balance()`; `current_balance` queda para lecturas.

## Verification

- `accounting/tests/test_account_materialized_totals.py`: publicación, borrador, anulación, ítem añadido o eliminado, asiento recargado, jerarquía en la lista, recálculo completo.
- `accounting/tests/test_p110_budget.py::test_generate_opening_entry_bounded_queries` sigue en el límite de 39 consultas.
- Suite `accounting` y `finances`: 62 pasan.
