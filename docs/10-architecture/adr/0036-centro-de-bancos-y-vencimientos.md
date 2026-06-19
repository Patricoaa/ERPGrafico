---
layer: 10-architecture
doc: adr/0036-centro-de-bancos-y-vencimientos
id: 0036
title: "Centro de Bancos y proyección de vencimientos"
status: Accepted
date: 2026-06-03
author: core-team
---

# ADR-0036: Centro de Bancos y proyección de vencimientos

## Contexto

Las Fases 1–4 de la auditoría de Bancos crearon entidades independientes
(créditos, tarjetas, cheques) pero sin una vista consolidada por banco y sin
integrar los vencimientos futuros en la proyección de flujo de caja. La Fase 5
(F5.1–F5.5) cierra el dominio bancario con:

1. Cuentas de gasto financiero centralizadas en AccountingSettings.
2. Una pantalla "Centro de Bancos" por banco que agrega todo.
3. Proyección de flujo de caja con vencimientos futuros.
4. Calendario unificado de vencimientos con alertas Celery.

## Decisión

### F5.1 — Cuentas de gasto financiero en AccountingSettings

Se añaden 3 FKs a `AccountingSettings`:
- `interest_expense_account` (EXPENSE): intereses de préstamos y tarjetas.
- `insurance_expense_account` (EXPENSE): seguros de desgravamen/cesantía.
- `interest_payable_account` (LIABILITY): intereses devengados no pagados.

Migración `accounting/0021`. Se exponen en el panel de settings bajo la pestaña
"Financiero". `LoanService.pay_installment()` y `CardService.apply_charges()`
resuelven estas cuentas desde settings como fallback cuando no se pasan como
parámetro.

### F5.2 — Centro de Bancos (vista unificada por banco)

- **Backend**: action `bank_overview` en `BankViewSet` (GET /banks/{id}/overview/).
  Retorna: cuentas del banco, deuda de tarjeta, cheques en cartera/girados,
  préstamos activos, y calendario consolidado de vencimientos a 30 días.
- **Frontend**: página `/treasury/banks/[id]/page.tsx` con componente
  `BankCenterView`. 6 StatCards de resumen, tabla de cuentas, tabla de
  vencimientos. Accesible desde la acción "Ver Centro" en la lista de bancos.
- **Header**: ruta `banks` registrada en `TreasuryHeader` con título
  "Centro de Bancos".

### F5.3 — Proyección de flujo de caja con vencimientos

- **Backend**: action `future_maturities` en `TreasuryDashboardViewSet`
  (GET /dashboard/future_maturities/). Query params: `days_ahead` (default 90),
  `treasury_account` (opcional). Retorna lista de ítems y resumen mensual.
  Fuentes: LoanInstallment, Check (RECEIVED + ISSUED), CreditCardStatement.
- **Frontend**: `CashFlowTable` acepta prop `futureMaturities` y renderiza una
  tabla debajo del resumen con colores verde (entradas) / rojo (salidas).

### F5.4 — Calendario unificado de vencimientos + notificaciones

- Task Celery `unified_maturity_alerts` (beat diario): consolida cuotas de
  préstamo, cheques recibidos, cheques propios y estados de cuenta de tarjeta.
  Emite notificación por cada ítem a vencer dentro del horizonte configurable
  (default 7 días).
- Deduplicación por `(notification_type, object_id, target_date)` — mismo
  patrón que F2.10 y F4.6.
- Notification types: `UNIFIED_MATURITY_LOAN`, `UNIFIED_MATURITY_CHECK`,
  `UNIFIED_MATURITY_CHECK_ISSUED`, `UNIFIED_MATURITY_CARD`.

## Consecuencias

- **AccountingSettings** crece en 3 campos FK (nullable, backward-compatible).
- Migración `accounting/0021` reversable.
- `LoanService` y `CardService` ahora resuelven cuentas desde settings,
  eliminando la dependencia de pasarlas como parámetro en cada llamada.
- `tasks.py` crece en 1 task consolidado; los tasks individuales (F2.10, F4.6)
  se mantienen por retrocompatibilidad.
- `CashFlowTable` ahora acepta datos de vencimientos futuros (opcional).
- Ruta `/treasury/banks/[id]` es nueva; el header la maneja correctamente.
- **Dominio bancario**: CERRADO. Todos los procesos del pedido original están
  cubiertos (banco, cuentas, movimientos, cheques, tarjetas, créditos,
  conciliación). Fuera de alcance: entregables de conciliación Sprint 6.
