---
id: 0049
title: Modelo CreditLine (Línea de Crédito Rotativa)
status: Accepted
date: 2026-06-22
author: equipo-core
---

# 0049 — Modelo CreditLine (Línea de Crédito Rotativa)

## Context

Los bancos otorgan líneas de crédito rotativas (REVOLVING) que fijan un monto
aprobado, una tasa de interés y una vigencia. De ellas pueden colgar uno o
varios préstamos (`BankLoan`) que "drawan" (disponen) del cupo disponible.

Hasta ahora el sistema manejaba `BankLoan` sin asociación a una línea marco.
Para bancos con múltiples préstamos activos, no existía control centralizado
del cupo total aprobado ni visibilidad de la utilización global.

## Decision

Se crea el modelo `CreditLine` con las siguientes características:

1. **Solo REVOLVING** en esta fase. Tipos futuros (OVERDRAFT, STANDBY,
   DISCOUNT) se agregarán cuando sea necesario.

2. **`drawn_amount` es calculado** (property Python, no campo DB) como suma
   del `outstanding_balance` de los `BankLoan` en estado ACTIVE que cuelgan
   de la línea.

3. **`available_amount`** = `approved_amount - drawn_amount`, floor en 0.

4. **FK nullable** `credit_line` en `BankLoan`. Un préstamo puede crearse sin
   línea de crédito (backwards compatible).

5. **Validación en dos capas:**
   - `BankLoan.clean()`: al crear/editar, el principal no puede exceder
     `available_amount`.
   - `LoanService.disburse()`: al desembolsar, se re-valida contra el cupo
     disponible actual (pudo haber cambiado entre creación y desembolso).

6. **Data migration** 0085: para cada banco con préstamos existentes
   no-DRAFT/PAID, se crea una `CreditLine` con `approved_amount = 120%`
   del principal total y se asocian los préstamos.

7. **Task programada**: `check_credit_line_expirations` marca como EXPIRED
   las líneas ACTIVE con `valid_until ≤ today`.

8. **Permisos**: `view_creditline` agregado al rol OPERATOR.

## Estados

- `ACTIVE`: vigente, puede tener préstamos asociados.
- `EXPIRED`: vencida (valid_until alcanzado), no permite nuevos draws.
- `CANCELED`: cancelada manualmente.
- `SUSPENDED`: suspendida temporalmente.

## Consequences

- Los listados de `CreditLine` requieren `drawn_amount` calculado en
  Python (N+1 si no se usa `prefetch_related`). El serializer actual itera
  `self.loans.all()` para cada línea.
- `drawn_amount` no es filtrable ni ordenable vía ORM.
- `outstanding_balance` en `BankLoan` difiere entre el property del modelo
  (primer installment PENDING/OVERDUE) y el `SerializerMethodField` del
  serializer (`principal - sum(paid_principal)`). Ambos deben converger
  a medida que el schedule de pagos sea correcto.

## Referencias

- `backend/treasury/models.py` — CreditLine (line 2457), BankLoan.credit_line
- `backend/treasury/loan_service.py` — validación en disburse()
- `backend/treasury/migrations/0084_creditline_model.py`
- `backend/treasury/migrations/0085_auto_create_credit_lines_for_existing_banks.py`
- `docs/50-audit/bancos/fase-6-lineas-credito.md`
