---
id: 0033
title: Créditos bancarios — deuda como pasivo + amortización (CLP/UF)
status: Accepted
date: 2026-06-03
author: core-team
---

# 0033 — Créditos bancarios — deuda como pasivo + amortización (CLP/UF)

## Context

El ERP no modelaba créditos bancarios: las líneas de crédito, préstamos
cuotificados (consumo, comercial, PYME) y la tabla de amortización quedaban
fuera del sistema, obligando a llevar el control fuera del software
(Excel, planillas del banco) y a rezar para cuadrar el pasivo al cierre.

Requerimientos detectados en la auditoría de Fase 1:

- Modelar el **crédito** (banco, capital, tasa, plazo, sistema de
  amortización) y sus **cuotas** persistidas.
- Modelar la **deuda como pasivo** (cuenta `LIABILITY` en contabilidad) y
  su amortización contable al pagar cada cuota.
- Soportar tanto **CLP** como **UF** (Chile), con conversión al momento
  del pago usando el valor UF vigente.
- Distinguir **capital**, **interés** y **seguro mensual** en cada cuota
  para poder hacer devengo de interés y separación de gastos.
- Cubrir el ciclo: registrar → desembolsar → pagar → prepagar →
  refinanciar.
- Alertar vencimientos y (opt-in) devengar interés mensualmente.

## Decision

Modelar `BankLoan` y `LoanInstallment` como entidades de primera clase
dentro de `treasury`, reutilizando el patrón ya establecido para
`Check` (entidad con estados + `TreasuryMovement` + `JournalEntry`).

### Deuda como pasivo (taxonomía vigente)

`BankLoan.liability_account` debe ser una `TreasuryAccount` de tipo
`CREDIT_CARD` — la única con `AccountType=LIABILITY` en la taxonomía
vigente (ADR-0031). No se añadió un nuevo `Type.LIABILITY` para no
romper la convención de que las TreasuryAccount tienen un `account_type`
que coincide 1-a-1 con los `AccountType` contables.

### Flujo de estados

```
BankLoan:    DRAFT ──disburse──▶ ACTIVE ──pago última cuota──▶ PAID
                                      │
                                      ├──prepay──▶ PAID
                                      └──refinance──▶ REFINANCED
                                      └─default──▶ DEFAULTED (manual, futuro)

LoanInstallment:  PENDING ──pay──▶ PAID
                   PENDING ──overdue task──▶ OVERDUE
                   PENDING ──refinance──▶ CANCELED
```

### Componentes

**Backend (`treasury/`):**
- `BankLoan` (modelo + `HistoricalRecords`) · `LoanInstallment` ·
  `IndicatorValue` (en `finances/`, modelo para UF/UTM/USD).
- `LoanService`: `generate_schedule` (francés/lineal, idempotente) ·
  `disburse` (idempotente si ya ACTIVE) · `pay_installment`
  (UF→CLP con `IndicatorValue.get_value`) · `prepay` (pago total,
  prorrateo 1/30 por día de interés) · `refinance` (cancela
  pendientes + concatena notas).
- `treasury.tasks`: `mark_overdue_loan_installments` (BEAT diario 08:00)
  y `accrue_monthly_loan_interest` (BEAT mensual día 1, 07:00 — opt-in).
- `BankLoanViewSet` + `LoanInstallmentViewSet` con acciones: `disburse`,
  `prepay`, `refinance`, `pay`, `schedule` (preview sin persistir),
  `amortization_table`.
- Asiento contable construido con **`is_pending_registration=True`**
  en `TreasuryService.create_movement` + JE custom con desglose
  capital/interés/seguro → evita que el flujo estándar de Treasury
  (que no conoce la `liability_account` del préstamo) borre el
  asiento por tener solo 1 ítem.

**Frontend (`features/treasury/loans/`):**
- `api.ts`, `hooks.ts` (TanStack Query con invalidación centralizada).
- `LoansView` (lista + KPIs: activos, deuda total, cuotas vencidas,
  próximo vencimiento).
- `LoanRegisterDrawer` (form RHF + zod: banco, condiciones, fechas,
  cuentas).
- `LoanDetailModal` (tabla de amortización completa + acciones de
  lifecycle: prepago, refinanciación).
- `LoanPayInstallmentModal` (pago de cuota con conversión UF→CLP
  visible cuando aplica).
- Pestaña "Préstamos" en `TreasuryHeader`; entidades registradas
  en `entity-registry.ts` (`treasury.bankloan` → `CRE-{id}`,
  `treasury.loaninstallment` → `CUO-{id}`).
- `STATUS_MAP` (badge-resolvers.ts) extendido con OVERDUE, CANCELED,
  REFINANCED, DEFAULTED.

### Conversión UF→CLP

Las cuotas de un crédito UF se **almacenan en UF** (la moneda original
del crédito). Al pagar, `LoanService.pay_installment` consulta
`IndicatorValue.get_value('UF', pay_date)` y convierte al CLP
vigente, persistiendo el valor usado en `installment.uf_value_used`
para trazabilidad. **Precondición:** el operador debe haber cargado
el valor UF del día en `IndicatorValue` (la task `fetch_from_mindicador`
es opt-in).

### Devengo de interés (opt-in)

`accrue_monthly_loan_interest` está conectado a BEAT pero **no-op
mientras `AccountingSettings` no tenga `loan_interest_expense_account`
y `loan_interest_payable_account`** (F5.1 las añadirá). Esta es una
decisión consciente: PYME no suele hacer devengo mensual, y queremos
evitar asientos con cuentas arbitrarias.

## Consequences

**Positivas:**
- Crédito y amortización quedan 100% dentro del sistema: el cuadre
  contable y el seguimiento de cuotas se hacen desde el ERP.
- La deuda se materializa como `LIABILITY` real (no como nota), por
  lo que balances y reportes de pasivos reflejan la realidad.
- Conversión UF→CLP automática con valor del día (auditable).
- Reutiliza infraestructura existente (`TreasuryService`,
  `Notification`, `JournalEntry`): sin código paralelo.
- `is_pending_registration=True` resuelve elegantemente el gap
  entre el flujo estándar de Treasury y la necesidad de JE custom.

**Trade-offs aceptados:**
- Si el operador no tiene las cuentas de gasto
  (`interest_expense_account`/`insurance_expense_account`)
  configuradas, su monto se imputa a `liability_account` en el
  asiento (en vez de fallar ruidosamente). Esto preserva la
  cuadratura D=C a costa de menor granularidad contable — F5.1
  permitirá configurar estas cuentas en `AccountingSettings`.
- El prepago prorratea interés del mes con la convención 1/30
  por día (conservador). Bancos reales pueden usar otras
  convenciones; se documenta explícitamente.

**Fuera de alcance (futuras fases):**
- Refinanciación parcial o traspaso de saldo entre créditos.
- Crédito con gracia inicial (meses sin pago).
- Amortización con sistema alemán (sólo se implementaron francés
  y lineal).
- Cuotas en moneda mixta.

## References

- `docs/50-audit/bancos/fase-2-creditos-bancarios.md` (F2.1–F2.13).
- `docs/10-architecture/adr/0031-treasury-account-vs-payment-method-taxonomy.md`
  (LIABILITY = CREDIT_CARD en taxonomía vigente).
- `docs/10-architecture/adr/0032-check-portfolio-cuenta-puente.md`
  (patrón análogo para entidad con estados + TreasuryMovement).
- Backend commits: `8f88cedc` (F2.1), `ace7a82f` (F2.2–F2.3),
  `8b8f7bdd` (F2.4–F2.8), `b397da0d` (F2.9–F2.10),
  `b6941772` (F2.11), `a11b9de2` (F2.12).
- `backend/treasury/models.py` (BankLoan:1988, LoanInstallment:2148).
- `backend/treasury/loan_service.py` (LoanService completo).
- `backend/treasury/tasks.py` (F2.9–F2.10).
- `frontend/features/treasury/loans/` (UI completa).
- 46 tests backend: `test_loans.py` (16) + `test_loans_api.py` (15) +
  `test_loan_tasks.py` (4) + `test_indicators.py` (11).
