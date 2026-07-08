---
id: 0050
title: Refactor CreditLine — sobregiro vinculado a TreasuryAccount
status: Accepted
date: 2026-06-22
supersedes: 0049
author: equipo-core
---

# 0050 — Refactor CreditLine — sobregiro vinculado a TreasuryAccount

## Context

La implementación original de CreditLine (ADR-0049) modelaba la línea de crédito
como un marco para agrupar préstamos bancarios (`BankLoan`), con `drawn_amount`
calculado desde el saldo vivo de los préstamos. Este diseño presentaba varios
problemas:

1. **Confusión conceptual**: una línea de crédito bancaria (sobregiro) es una
   facilidad de una cuenta corriente, no un contenedor de préstamos.
2. **Doble contabilidad**: los préstamos ya tienen su propio seguimiento de
   deuda; la superposición con CreditLine duplicaba la lógica.
3. **Sin integración con tesorería**: el sobregiro no se reflejaba en el
   saldo disponible de la cuenta bancaria.
4. **Acoplamiento innecesario**: `BankLoan` tenía FK a `CreditLine`, pese a
   que un préstamo puede existir sin línea de crédito.

## Decision

Se refactoriza CreditLine como un **sobregiro (overdraft) exclusivamente**,
desvinculado de `BankLoan` e integrado con `TreasuryAccount`:

1. **`CreditLine.treasury_account`** — `OneToOneField` a `TreasuryAccount`
   con `account_type=CHECKING`. Cada cuenta corriente puede tener a lo sumo
   una línea de crédito.

2. **`credit_limit`** (renombrado de `approved_amount`) — monto máximo
   autorizado. Se elimina `credit_line_type` (solo existe sobregiro).

3. **`used_amount`** — se calcula desde `TreasuryMovement` con los nuevos
   tipos `CREDIT_LINE_DRAW` (disposición) y `CREDIT_LINE_REPAY` (abono).
   Ya no depende de `BankLoan`.

4. **Auto-draw en TreasuryService**: cuando un `OUTBOUND`/`TRANSFER` en una
   cuenta CHECKING supera el saldo contable, se crea automáticamente un
   movimiento `CREDIT_LINE_DRAW` por el excedente, marcado como
   `is_pending_registration=True` (sin asiento contable — el movimiento
   original ya registra el gasto).

5. **`TreasuryAccount.available_liquidity`**: property que retorna
   `balance + credit_line.available_amount`, integrando el cupo disponible
   en el saldo operable de la cuenta.

6. **Se elimina la FK `credit_line` de `BankLoan`** y toda validación
   relacionada en `loan_service.py`. Los préstamos son independientes de
   las líneas de crédito.

7. **Data migration 0086**: copia `approved_amount` → `credit_limit` y
   vincula cada CreditLine a la primera cuenta CHECKING del banco asociado.

## Estados

No cambian respecto a ADR-0049: `ACTIVE`, `EXPIRED`, `CANCELED`, `SUSPENDED`.
Se elimina la validación de `CreditLine.Status` como clase enum — ahora es
`CharField` con `TextChoices`.

## Propiedades calculadas

| Propiedad | Fórmula |
|-----------|---------|
| `used_amount` | `SUM(CREDIT_LINE_DRAW) - SUM(CREDIT_LINE_REPAY)` |
| `available_amount` | `max(credit_limit - used_amount, 0)` |
| `utilization_rate` | `(used_amount / credit_limit) * 100` (None si credit_limit = 0) |
| `available_liquidity` (en TreasuryAccount) | `balance + credit_line.available_amount` |

## Consequences

- **Positivo**: modelo conceptualmente correcto (sobregiro de cuenta corriente).
- **Positivo**: el saldo disponible de la cuenta refleja el cupo de la línea.
- **Positivo**: eliminación del acoplamiento BankLoan ↔ CreditLine.
- **Negativo**: requerimiento de que el usuario asocie explícitamente la línea
  a una TreasuryAccount CHECKING al crearla.
- **Negativo**: datos históricos de CreditLine (migración 0085) requieren
  migración de datos (0086) que asume existencia de cuenta CHECKING por banco.
- **Neutral**: `used_amount` requiere agregación de TreasuryMovements en
  cada acceso (propiedad Python) — no ordenable/filtrable vía ORM.

## Alternatives considered

1. **Mantener FK BankLoan**: se descartó porque el dominio de préstamos
   (deuda programada) es distinto del dominio de sobregiro (facilidad de
   cuenta corriente). Mantener el FK forzaba validaciones cruzadas frágiles.

2. **Calcular used_amount desde el saldo negativo de la cuenta**: se descartó
   por falta de auditoría. El modelo con movimientos explícitos
   CREDIT_LINE_DRAW/REPAY permite rastrear cada disposición y abono.

3. **No crear movimientos auto-draw**: se descartó porque obligaba al usuario
   a registrar manualmente la disposición. El auto-draw con
   `is_pending_registration=True` mantiene la pista de auditoría sin duplicar
   asientos contables.

## Referencias

- `backend/treasury/models.py` — CreditLine (~line 2479), TreasuryMovement (~line 81)
- `backend/treasury/services.py` — TreasuryService.create_movement() auto-draw
- `backend/treasury/serializers.py` — CreditLineSerializer, CreditLineWriteSerializer
- `backend/treasury/views.py` — CreditLineViewSet
- `backend/treasury/migrations/0086_refactor_credit_line.py`
- `frontend/features/treasury/credit-lines/` — módulo frontend completo
- `docs/20-contracts/state-map.md` — §CreditLine
- `docs/50-audit/bancos/fase-6-lineas-credito.md`
