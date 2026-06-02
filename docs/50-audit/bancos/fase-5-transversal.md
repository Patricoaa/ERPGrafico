---
layer: 50-audit
doc: bancos/fase-5-transversal
status: active
owner: core-team
last_review: 2026-06-02
kind: roadmap
---

# Fase 5 — Transversal (consolidación)

Vistas y servicios que unifican todo lo bancario una vez que existen las entidades
(créditos, tarjeta, cheques). Esfuerzo: L.

**Precondiciones generales:** se aprovecha mejor tras Fases 2–4, pero F5.1 puede hacerse
antes (la necesitan F2 y F3).

---

### F5.1 · Cuentas de gasto financiero en `AccountingSettings`
- **Objetivo:** centralizar las cuentas contables de costos financieros que usan créditos y
  tarjetas (hoy no existen en settings).
- **Dificultad:** S
- **Archivos clave:** `backend/accounting/models.py` (`AccountingSettings`), migración,
  `frontend/features/settings/components/TreasurySettingsView.tsx` (sección "Financiero").
- **Cambios esperados:** FKs `interest_expense_account` (intereses pagados de préstamo/tarjeta),
  `insurance_expense_account` (seguros), y reutilizar `bank_commission_account` (ya existe)
  para gastos bancarios. Exponer en el panel de settings.
- **DoD:** las cuentas se configuran desde la UI; `LoanService.pay_installment` y el pago de
  tarjeta las leen de settings (en vez de parámetros temporales).

### F5.2 · "Centro de Bancos" — vista unificada por banco
- **Objetivo:** una pantalla por banco que muestre todo: cuentas, tarjetas, cheques, créditos,
  saldos y próximos vencimientos.
- **Dificultad:** L
- **Archivos clave:** backend `treasury/views.py` (action `bank_overview` o
  `BankDashboardViewSet`), `treasury/reports_service.py`; frontend
  `frontend/app/(dashboard)/treasury/banks/[id]/page.tsx` o sección en `/treasury/accounts`.
- **Cambios esperados:**
  - Endpoint que agrega por `Bank`: `TreasuryAccount`(s), tarjetas (deuda), cheques en
    cartera/girados, créditos activos (deuda + próxima cuota), y un calendario de
    vencimientos consolidado.
  - UI: tarjetas resumen + tabla de próximos vencimientos (cuotas, cheques a fecha, fecha de
    pago de tarjeta).
- **DoD:** la vista de un banco muestra saldos correctos y los próximos N vencimientos.

### F5.3 · Proyección de flujo de caja con vencimientos
- **Objetivo:** que el flujo de caja proyectado incluya las salidas/entradas futuras de
  cuotas de crédito, cheques a fecha y pagos de tarjeta.
- **Dificultad:** L
- **Archivos clave:** `backend/finances/services.py` (`get_cash_flow`, línea 267),
  frontend `features/finance/components/CashFlowTable.tsx`.
- **Cambios esperados:** sumar a la proyección: `LoanInstallment` PENDING por `due_date`,
  `Check` `IN_PORTFOLIO` por `due_date` (entradas), `CreditCardStatement` OPEN por `due_date`
  (salidas). Distinguir realizado vs proyectado.
- **DoD:** el flujo proyectado refleja una cuota de crédito futura y un cheque a fecha.

### F5.4 · Calendario unificado de vencimientos + notificaciones
- **Objetivo:** un solo lugar (y alertas) para todos los vencimientos bancarios.
- **Dificultad:** M
- **Archivos clave:** `backend/treasury/tasks.py` (consolidar F2.10 + F4.6 + tarjeta),
  notificaciones in-app, beat schedule.
- **Cambios esperados:** task diario que recolecta vencimientos de cuotas, cheques y estados
  de cuenta de tarjeta a N días y emite notificación/badge unificado.
- **DoD:** con datos de prueba a vencer, el task emite una notificación consolidada.

### F5.5 · Docs + ADR de cierre
- **Dificultad:** S
- **Cambios esperados:** ADR-0036 "Centro de Bancos y proyección de vencimientos".
  Actualizar `README.md` de esta carpeta marcando todas las fases ✅ y el dominio bancario
  como completo.
- **DoD:** índice actualizado; ADR creado.

---

## Verificación de la fase
- `make`/`npm` checks limpios; tests de los servicios de agregación verdes.
- Manual: Centro de Bancos de un banco con cuentas + crédito + cheque + tarjeta muestra todo;
  el flujo de caja proyecta los vencimientos.

---

## Cierre del dominio bancario

Al completar las Fases 1–5, los procesos del pedido original quedan cubiertos:
banco · cuenta bancaria · cuentas de tesorería · movimientos · cheques (recibidos + propios
+ endoso) · tarjetas (débito/crédito como métodos/pasivo + estado y pago) · pago de tarjetas
y comisiones (adquirencia + tarjeta propia) · créditos bancarios + pago de cuotas ·
conciliación bancaria. **Fuera de alcance** (decisión del usuario): los entregables de
conciliación del Sprint 6 descartado.
