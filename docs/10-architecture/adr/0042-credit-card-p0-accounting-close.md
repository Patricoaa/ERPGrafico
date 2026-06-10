---
id: 0042
title: Cierre P0 contable de tarjeta de crédito propia — cargos reales, idempotencia, reversa transaccional
status: Accepted
date: 2026-06-05
author: core-team
supersedes: []
related: [0034-credit-card-statement-and-payment.md]
---

# 0042 — Cierre P0 contable de tarjeta de crédito propia

## Context

El ciclo de vida de la tarjeta de crédito propia (ADR-0034) está
implementado y funcional, pero un análisis forense del flujo
contable detectó **17 gaps (A–Q)** en la integridad P0:

1. **Cargos financieros sin cuenta de gasto real**: `apply_charges`
   imputaba el interés y las comisiones a la **misma cuenta de
   pasivo** de la tarjeta, contabilizando el gasto financiero
   como aumento de deuda. El asiento quedaba D=`liability`
   (Haber pasivo) sin contrapartida real de gasto. Esto rompía
   la lectura del Estado de Resultados (los gastos financieros
   no se registraban como tales).
2. **Idempotencia por `reference` (string) en lugar de FK**: el
   campo `reference` es editable y mutable; un cambio de
   string rompía la deduplicación de cargos aplicados. Reaplicar
   cargos era propenso a duplicar JE.
3. **`recalculate_billed_amount` recalculaba el ciclo, no la
   cuenta**: calculaba `billed_amount` desde los `OUTBOUND` del
   período, pero **no incluía los ADJUSTMENTs del propio
   statement** (interés/comisiones ya aplicados), por lo que el
   total facturado no reflejaba el total real a pagar.
4. **`pay_statement` aceptaba cualquier cuenta**: un `payment_account`
   de tipo `CREDIT_CARD` (otra tarjeta) o un `BRIDGE_ACCOUNT`
   (puente de cheques) pasaba la validación previa. Faltaba el
   check de tipo de cuenta (CHECKING / CASH) y de fondos
   suficientes.
5. **Cancelación sin reversa contable**: `cancel_statement`
   cambiaba el estado a `CANCELED` sin tocar los movimientos
   contables asociados. Si un statement ya tenía cargos y/o
   pagos, quedaban "huérfanos" contables — la tarjeta seguía
   con deuda y el banco sin recuperar el pago.
6. **`overdue` se calculaba en runtime por consulta, no por
   cache**: el flag `is_overdue` se computaba on-read en cada
   vista, sin tarea programada que marcara los statements
   vencidos de forma estable y consultable.

## Decision

Se cierra el set P0 contable con **siete gaps resueltos en un
solo PR (Onda 1)**. Las decisiones concretas son:

### D-1. Cuentas de gasto financiero en `AccountingSettings` (Gaps 1.5a, 1.5b)

- `AccountingSettings.interest_expense_account` y
  `bank_commission_account` ya existían a nivel modelo (migration
  `0021_accountingsettings_financial_expense_accounts.py`).
- `apply_charges` **ya NO usa el workaround del pasivo**. Si
  `interest > 0` y no se pasó `interest_expense_account`
  explícito, resuelve de settings; si no hay cuenta configurada,
  levanta `ValidationError` con instrucción de configurar
  settings o pasar la cuenta explícita. Idem para `fees`.
- El asiento queda correctamente:
  - **D** `interest_expense_account` (gasto)
  - **D** `fees_expense_account` (gasto)
  - **C** `card_ta.account` (pasivo)
- Las cuentas de gasto se exponen como `read_only_fields` con
  nombre humano en `AccountingSettingsSerializer`
  (`interest_expense_account_name`, `bank_commission_account_name`)
  para que el panel de settings muestre la cuenta seleccionada.

### D-2. Idempotencia por FK + reversa del cargo (Gap 1.4)

- Nueva `OneToOneField` `charges_movement` en
  `CreditCardStatement` apuntando a `TreasuryMovement`. Migración
  `0068` con schema + backfill RunPython.
- `apply_charges` chequea `charges_movement_id` antes de crear
  movimiento: si ya hay, retorna statement sin duplicar JE.
- Nuevo método `CardService.reapply_charges(statement, *, created_by=None)`:
  reversa el cargo actual vía `JournalEntryService.reverse_entry`
  (genera `JournalEntry` REVERSAL) y vuelve a imputar
  con los montos actualizados. Idempotente por FK.
- Fix colateral: `Account.debit_total` / `credit_total` ahora
  incluyen `REVERSAL` (vía `balance_affecting_statuses()`). Sin
  este fix, `reapply_charges` no actualizaba el saldo de la
  cuenta de pasivo correctamente.

### D-3. Recalcular `billed_amount` desde movimientos reales (Gap 1.2)

- `CardService.recalculate_billed_amount(statement, *, commit=True)`
  agrega:
  - Suma de `OUTBOUND` del período (compras) vinculados a la
    tarjeta.
  - Suma de `ADJUSTMENT` del propio statement (interés +
    comisiones ya aplicados), vía `charges_movement`.
- Nueva REST action `POST /card-statements/{id}/recalculate/`
  para uso operacional y/o batch.

### D-4. Validación de `payment_account` y fondos (Gap 1.3)

- `pay_statement` rechaza `payment_account` que no sea
  `CHECKING` o `CASH` (no aceptar otra `CREDIT_CARD` ni un
  `BRIDGE_ACCOUNT`).
- Si `total > 0`, chequea `payment_account.current_balance >= total`
  y levanta `ValidationError` claro si los fondos son
  insuficientes.
- Si `total == 0`, marca `PAID` sin crear movimiento
  (preserva la idempotencia de pagar un statement vacío).
- Nueva fixture `funded_checking` en `test_card_statements_api.py`
  crea la cuenta con $1.000.000 vía un `INBOUND` con factura
  para tests que necesitan fondos.

### D-5. Tarea `mark_overdue_credit_card_statements` (Gap 1.1)

- Nueva task Celery + entrada en `CELERY_BEAT_SCHEDULE` con
  `crontab(hour=8, minute=5)` (antes de la apertura del día).
- Marca como `OVERDUE` los statements `OPEN` cuya `due_date`
  sea estrictamente anterior a hoy. Idempotente y batch.
- Se loggea el conteo de statements actualizados.

### D-6. Reversa contable transaccional (Gap 1.6)

- Nuevo método `CardService.reverse_statement(statement, *, notes='')`:
  en **una sola operación atómica**:
  1. Reversa el JE del cargo (si existe) vía
     `JournalEntryService.reverse_entry`.
  2. Borra el `charges_movement` con FK desligada.
  3. Reversa el JE del pago (si existe).
  4. Borra el `payment_movement` con FK desligada, limpia
     `payment_account` y `paid_at`.
  5. Marca el statement como `CANCELED` con log de audit en
     `notes` (timestamp + IDs revertidos).
- Idempotente: si ya está `CANCELED`, no-op.
- Rechaza con `ValidationError` si el cargo o el pago está
  reconciliado contra el banco (no se puede reversar sin
  des-reconciliar).
- Deja la tarjeta y el banco en el mismo balance que antes de
  aplicar cargos o pagar.
- Nueva REST action `POST /card-statements/{id}/reverse/`
  (alternativa a `cancel/` con limpieza contable).
- `cancel_statement` se conserva para anulación sin limpieza
  (caso de borde en el que el operador prefiere dejar los
  movimientos como referencia histórica).

## Consequences

### Positivas

- El Estado de Resultados ahora muestra correctamente los
  gastos financieros por intereses y comisiones.
- El pasivo de la tarjeta refleja exactamente lo que la
  empresa debe (cargo + interés + comisión, no doblemente).
- La idempotencia por FK es robusta a renombres del campo
  `reference` o cambios de string.
- `reverse_statement` permite corregir errores de carga del
  estado de cuenta sin dejar "huérfanos" contables.
- La validación de fondos en `pay_statement` evita descubrir
  el problema al conciliar contra el banco (feedback temprano).
- `OVERDUE` queda estable en BD (no recomputado en cada vista).

### Negativas

- `reverse_statement` borra los `TreasuryMovement` originales
  tras generar el reverso contable. Si el operador necesita
  conservar el movimiento original por motivos regulatorios,
  debe usar `cancel_statement` (que no toca movimientos) o
  copiar el `display_id` antes de reversar.
- La validación de fondos en `pay_statement` rechaza pagos
  parciales vía "descubierto" en cuenta corriente (no es un
  caso soportado en este modelo).
- El fix colateral en `Account.debit_total`/`credit_total` para
  incluir `REVERSAL` es transversal a toda la app. Tests que
  asumían que `REVERSAL` no afectaba el saldo necesitarán
  ajuste (verificado que no rompe ninguna suite existente).

### Neutrales

- `cancel_statement` se mantiene para casos donde se prefiere
  dejar el rastro contable sin reversión.
- La reversa y reapply usan `JournalEntryService.reverse_entry`
  (patrón ya establecido para otras JE), no introducen un
  servicio nuevo.

## Alternatives considered

- **Workaround del pasivo en cargos (estado anterior)**:
  rechazado, rompía lectura del Estado de Resultados.
- **Idempotencia por `reference` con constraint unique**:
  rechazado, `reference` es un campo libre, no natural key.
  La FK OneToOne es la solución correcta.
- **`cancel_statement` con reversa automática**:
  rechazado, algunos operadores prefieren dejar el rastro
  contable sin tocar. `reverse_statement` explícito es más
  claro y trazable.
- **`reverse_entry` per-movimiento en lugar de un servicio
  batch transaccional**:
  rechazado, riesgo de inconsistencia parcial si falla un paso.
  El nuevo `reverse_statement` es atómico.

## References

- ADR-0034: Estado de cuenta y pago de tarjeta de crédito
  corporativa (modelo base).
- [docs/50-audit/bancos/fase-3-tarjeta-credito.md](../../../50-audit/bancos/fase-3-tarjeta-credito.md) — Roadmap de Fase 3.
- Playbook: [docs/30-playbooks/add-migration.md](../../../30-playbooks/add-migration.md).
- Tests: `test_card_statements_tasks.py`, `test_card_recalculate.py`,
  `test_card_pay_validations.py`, `test_card_reapply.py`,
  `test_card_reverse.py`, `test_card_statements_api.py`,
  `test_card_service.py` (Gap 1.5b).
- Migration: `0068_creditcardstatement_charges_movement.py`.
- Source: `backend/treasury/card_service.py`,
  `backend/treasury/tasks.py`,
  `backend/treasury/views.py`,
  `backend/treasury/serializers.py`,
  `backend/accounting/serializers.py`.
