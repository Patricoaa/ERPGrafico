---
id: 0119
title: Protecciones del pago de dividendos
status: Accepted
date: 2026-11-06
author: core-team
---

# ADR-0119 — Protecciones del pago de dividendos

**Relacionado:** [idempotency.md](../../20-contracts/idempotency.md), [ADR-0115](0115-materialized-account-posted-totals.md).

## Contexto

Al reparar el pago masivo de dividendos (`POST /api/contacts/profit-distributions/{id}/mass_payment/`, PR #215) quedaron tres riesgos en una operación que saca dinero: un doble envío de un pago parcial se aplicaba dos veces, un pago podía dejar la cuenta en negativo y no se revisaba si el período estaba cerrado. `PartnerService.record_dividend_payment`, el pago individual, compartía los dos últimos.

## Decisión

1. **Idempotencia:** el pago masivo entra en la lista cerrada con el scope `contacts.dividend.mass_payment`, y el header pasa a ser obligatorio.
2. **Fondos:** ambos pagos rechazan un monto mayor al saldo guardado de la cuenta de tesorería (`fresh_balance`). Se bloquea la fila de la cuenta durante la operación para que dos pagos simultáneos no gasten el mismo saldo.
3. **Período:** ambos rechazan una fecha en período tributario o contable cerrado (`validate_period_open`).

## Consecuencias

- **La línea de crédito no cuenta como fondos.** Estos pagos crean el movimiento directamente, sin el giro automático de `TreasuryService.create_movement`. Si se quiere pagar con línea, hay que pasar primero por ese servicio.
- El pago individual sin cuenta de tesorería no valida fondos, porque no mueve dinero de una cuenta.
- El bloqueo de período también aplica a los retiros provisorios, que comparten `record_dividend_payment`.
- El pago individual sigue sin `Idempotency-Key`: entra por el endpoint general de transacciones de socios, que queda fuera de esta decisión.

## Alternativas consideradas

- **Contar la línea de crédito como liquidez.** Dejaría la cuenta en negativo sin registrar el giro de la línea.
- **Solo validar en el frontend.** No protege frente a saldos que cambian ni a otros clientes de la API.
