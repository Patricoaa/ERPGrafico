---
id: 0156
title: Movimientos con el empleado — anticipos, pagos de remuneración y préstamos como un solo documento asignable a liquidaciones
status: Accepted
date: 2026-11-23
author: backend-team + frontend-team
---

# 0156 — Movimientos con el empleado (`EmployeeMovement`)

**Relacionado:** ADR-0091 (edit policy), ADR-0154 (Employee archivable), ADR-0155 (dominio `hr` y ventana reciente), `docs/20-contracts/state-map.md`, `docs/20-contracts/document-relations.md`.

## Contexto

El anticipo de sueldo (`SalaryAdvance`) y el pago de remuneración (`PayrollPayment` tipo `SALARIO`) eran dos conceptos separados que hacían lo mismo desde el punto de vista del empleado: dinero que entra o sale entre la empresa y la persona, y que se reconcilia con una liquidación. No existían préstamos con interés, el vínculo anticipo↔liquidación era 1:1 y total, y la ficha del empleado no mostraba un historial unificado ni el estado de lo adeudado.

## Decisión

1. **Un solo documento.** `EmployeeMovement` con `kind` ∈ `PAYMENT` (pago de remuneración), `ADVANCE` (anticipo) y `LOAN` (préstamo). Folio `MOV-n`. Estados `DRAFT → POSTED → SETTLED`, `CANCELLED` (ADR-0091: editable solo en `DRAFT`; anulación con motivo que revierte el asiento de tesorería).
2. **Asignación a liquidaciones.** `PayrollAllocation(movement, payroll, installment?, amount, principal_part, interest_part)`: un movimiento se asigna total o parcialmente a una o más liquidaciones en `DRAFT` del mismo empleado; Σ asignaciones ≤ líquido de la liquidación. El tope legal de descuentos (`GlobalHRSettings.loan_deduction_cap_percent`, 15 % por defecto) solo advierte.
3. **Préstamos.** `LoanInstallment` (`PENDING` → `APPLIED`). Cuota fija (sistema francés) con tasa mensual o anual; la tasa anual se convierte a **mensual efectiva** `(1 + anual)^(1/12) − 1`. El interés de cada cuota es `round(saldo × tasa)` y se reconoce **al aplicar la cuota a una liquidación contabilizada**; la última cuota absorbe el redondeo y debe saldar el préstamo. Cuota < interés se rechaza.
4. **Recálculo del resto.** Al editar la cuota de una asignación se reconstruyen las cuotas pendientes con el capital restante y el plazo restante original (no se alarga el préstamo). Quitar una asignación hace lo mismo.
5. **Saldo único.** `payroll_balance(payroll) = net_salary − Σ asignaciones cuyo movimiento está en POSTED/SETTLED`. Es la única fuente del saldo a pagar; el pago de sueldo (`pay_salary`) crea un movimiento `PAYMENT` por ese saldo.
6. **Contabilidad.** Desembolso: Dr cuenta del tipo (`account_anticipos` / `account_prestamos_trabajadores`) · Cr tesorería. Al contabilizar la liquidación se acreditan anticipos y préstamos (capital) e intereses ganados (`account_intereses_prestamos`); Remuneraciones por pagar = líquido − Σ asignaciones.
7. **Migración.** `SalaryAdvance` y `PayrollPayment` SALARIO se migran a movimientos (DRAFT→DRAFT, PAID→POSTED, DISCOUNTED→SETTLED, CANCELLED→CANCELLED; el descuento previo se convierte en una asignación). Reversible. Luego se elimina `SalaryAdvance`.
8. **Superficies.** `hr.employeemovement` reemplaza a `hr.salaryadvance` (lista `/hr/movements`, `/hr/advances` redirige); pestaña **Movimientos** en la ficha del empleado con el historial unificado y el estado de cada préstamo/anticipo; sección **Anticipos y préstamos** en la liquidación para asignar.

## Consecuencias

- `PayrollPayment` queda solo para Previred hasta el subproyecto 2 (pago único por período repartido entre liquidaciones, «Otros descuentos» como entidad propia).
- `hr.salaryadvance`, el bundle `hr.salary_advances` y el permiso `annul_salaryadvance` desaparecen; los reemplazan `hr.employee_movements` y `annul_employeemovement`.
- El plan de cuotas editable es a nivel de asignación: la cuota de una liquidación ya contabilizada no se modifica.
- La migración de datos se valida solo en Postgres (la cadena de migraciones no corre sobre SQLite).
- Las relaciones documentales: empleado→movimiento (asociación suelta), movimiento↔liquidación por asignación (dependencia), movimiento→asiento→movimiento de tesorería.
