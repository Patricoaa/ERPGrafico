---
id: 0129
title: Efectivo al cerrar la caja — traspaso o retiro con motivo, dentro de la sesión
status: Accepted
date: 2026-11-11
author: backend-team
---

# 0129 — Efectivo al cerrar la caja: traspaso o retiro con motivo, dentro de la sesión

**Relacionado:** ADR-0109 (efectivo esperado del libro de caja), ADR-0126 (X/Z en vivo), ADR-0127 (cierre a pantalla completa), ADR-0128 (opciones de justificación).

## Contexto

El cierre ofrecía un único "retiro" que en realidad era un traspaso a otra cuenta de tesorería (`justify_reason="RETIREMENT"`). No había forma de registrar al cerrar un retiro que sale de la tesorería (retiro de socio, gasto); eso solo existía en *Movimiento de Fondo*. Además, `close_session` no validaba que el monto fuera ≤ lo contado e ignoraba sin avisar un monto sin cuenta destino.

## Decisión

1. Al cerrar, el cajero elige qué hace con el efectivo contado: **dejarlo** en la caja, **traspasarlo** (a otra caja o a un banco; sigue siendo de la empresa) o **retirarlo** con motivo (`PARTNER_WITHDRAWAL` "Retiro de socio", `OTHER_OUT` "Otro egreso"; sale de la tesorería).
2. `close_session` acepta `withdrawal_kind`: `"TRANSFER"` (por defecto, compatible con clientes anteriores) o uno de `CLOSE_WITHDRAWAL_REASONS`.
   - Traspaso → `TreasuryMovement` `TRANSFER` de la caja a `cash_destination_id` (`justify_reason="RETIREMENT"`).
   - Retiro → `OUTBOUND` desde la caja con `justify_reason=<motivo>` (la cuenta contable sale de `_get_reason_account`, igual que el movimiento manual del POS).
3. **Momento:** en la misma transacción del cierre, después del arqueo y del ajuste por diferencia y antes de marcar la sesión `CLOSED`; el movimiento queda ligado a la sesión, así que el informe Z lo muestra y el saldo que queda en la caja es el contado menos lo que salió.
4. **Validaciones previas a crear el arqueo** (`_validate_close_withdrawal`): monto ≥ 0 y ≤ efectivo contado; traspaso con destino activo distinto de la propia caja; retiro con cuenta contable configurada; tipo válido.
5. `justify_options` (ADR-0128) suma `reasons.OTHER_OUT` para ofrecer el retiro solo si su cuenta está configurada. En la UI, "Retirar" se deshabilita si ningún motivo está disponible.

## Consecuencias

- Un solo movimiento de salida por cierre (dejar, traspasar o retirar). Combinaciones se hacen con *Movimiento de Fondo* antes de cerrar.
- El retiro de socio al cerrar no pide elegir al socio (igual que el movimiento manual del POS): usa la cuenta de retiro de socio del POS.
- Un cierre que antes se aceptaba con monto > contado o sin destino ahora responde 400.
