---
id: 0122
title: Eliminación del PIN de POS
status: Accepted
date: 2026-11-10
author: backend-team
---

# 0122 — Eliminación del PIN de POS

**Relacionado:** ADR-0121 (panel de ventas del POS), ADR-0104 (RBAC, vistas `IsAuthenticated`-only), contrato `api-contracts.md` (Auth propio).

## Contexto

Cada usuario podía definir un PIN numérico de hasta 4 dígitos en su perfil (`User.pos_pin`, hasheado). Al cobrar en el POS, si el usuario autenticado era el dueño de la sesión de caja, el checkout abría `PINPadModal` y enviaba `pos_pin`. El backend (`PINService.validate_pin`) recorría todos los usuarios activos comparando hashes y usaba al dueño del PIN como vendedor. Sin PIN, el dueño de la sesión no podía confirmar la venta.

El mecanismo agregaba un paso a cada venta, la validación costaba O(usuarios) en hashes, y la atribución del vendedor ya la da la sesión autenticada.

## Decisión

1. Se elimina el campo `User.pos_pin` (y su copia histórica) con la migración `core.0018_remove_user_pos_pin`.
2. Se eliminan `PINService`, `UserService.change_pin`, `UserServiceExt.change_pin_from_request`, `ChangePinView` y el endpoint `POST /api/core/auth/change-pin/`.
3. `SalesService.create_sale_order_from_pos` ignora `pos_pin`: el vendedor es siempre el usuario autenticado y el dueño de la sesión puede vender sin autorización adicional.
4. Frontend: se eliminan `PINPadModal`, la sección «PIN de seguridad POS» del perfil, `pinSchema`, `changePin`, `ChangePinPayload` y la prop `isSessionHost` del checkout.

## Consecuencias

- El checkout del POS confirma la venta sin modal intermedio.
- Ya no se puede registrar una venta a nombre de otro usuario desde una caja ajena; el vendedor es quien inició sesión.
- Clientes que envíen `pos_pin` no fallan: el campo se ignora.
- Los hashes de PIN existentes se borran con la migración (irreversible en datos).
