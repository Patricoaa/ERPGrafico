---
id: 0045
title: Cargos configurables de préstamos — mora, comisión de apertura, ITE
status: Accepted
date: 2026-06-05
author: core-team
---

# 0045 — Cargos configurables de préstamos (mora, comisión, impuesto de timbres)

## Context

La cuota de un `BankLoan` solo modelaba `principal + interés + seguro`, y el
desembolso no contemplaba costos iniciales. Faltaban tres conceptos habituales en
Chile: **comisión de apertura**, **impuesto de timbres y estampillas (ITE)** —ambos
al desembolso— e **interés de mora** sobre cuotas vencidas. Antes, una cuota
vencida solo cambiaba de estado (`OVERDUE`) sin recargo contable.

Se evaluó un modelo genérico de cargos (`LoanChargeType` configurable) vs. campos
fijos. Para una PYME se eligió **campos fijos**: cubre el caso real con mínima
complejidad y sin tablas ni UI de configuración nuevas.

## Decision

Campos opcionales en `BankLoan` (todos default 0 → comportamiento actual intacto):
`opening_fee`, `stamp_tax` (cobrados al desembolso) y `penalty_rate` (tasa de mora
mensual). `LoanInstallment.penalty_paid` guarda la mora cobrada (trazabilidad).

Cuentas de gasto en `AccountingSettings`: `loan_commission_expense_account`,
`loan_stamp_tax_expense_account`, `loan_penalty_expense_account`.

### Desembolso (comisión + ITE neteados)

```
Debe  banco           principal − comisión − ITE   (efectivo neto recibido)
Debe  comisión_exp    opening_fee
Debe  ITE_exp         stamp_tax
Haber pasivo          principal                     (la deuda nace por el capital)
```

### Pago de cuota vencida (mora)

Si la cuota está `OVERDUE` y `penalty_rate > 0`:
`mora = cuota_total × penalty_rate/100 × días_atraso/30` (prorrateo 1/30, igual que
`prepay`). Se agrega una línea `Debe loan_penalty_expense_account` y el OUTBOUND
aumenta en ese monto. En créditos UF la mora se convierte con el mismo valor UF del
pago.

### Fail-loud

Si un cargo (> 0) no tiene su cuenta de gasto configurada, la operación **falla con
un mensaje accionable** (a diferencia del fallback de interés/seguro de ADR-0033):
el operador optó explícitamente por el cargo, así que debe indicar dónde se imputa.

### Cuadratura en pesos enteros

`JournalItem.debit/credit` son `decimal_places=0` (pesos enteros). Para evitar
descuadres de 1 peso cuando los componentes tienen centavos (la mora los introduce),
los constructores de asiento calculan la **línea de cuadre** (banco) como la suma de
los débitos **redondeados a peso entero en Python** (`_peso`, HALF_EVEN), en vez de
un agregado SQL (que en SQLite devuelve el valor crudo de 2 decimales y diverge del
`check_balance`, que lee fila a fila). Cross-DB y exacto.

## Consequences

**Positivas:** mora/comisión/ITE quedan contabilizados con cuentas configurables; el
caso PYME-Chile queda cubierto sin tablas nuevas; defaults 0 preservan el
comportamiento previo (40 tests de préstamos verdes).

**Trade-offs / fuera de alcance:**
- Conjunto de cargos cerrado (no arbitrario). Si se necesitan cargos definidos por el
  usuario, migrar a un modelo `LoanChargeType` (otra ADR).
- Base de la mora = cuota total con prorrateo 1/30; bancos reales pueden usar otras
  convenciones.
- Reajuste UF por corrección monetaria del pasivo sigue fuera de alcance (ADR-0033).

## References

- `backend/treasury/models.py` (`BankLoan`, `LoanInstallment`).
- `backend/accounting/models.py` (`AccountingSettings`).
- `backend/treasury/loan_service.py` (`disburse`, `pay_installment`, `_peso`,
  `_build_disbursement_entry`, `_build_installment_entry`).
- Migraciones `treasury/0070_*`, `accounting/0023_*`.
- `docs/10-architecture/adr/0033-bank-loans-liabilidad-y-uf.md`.
