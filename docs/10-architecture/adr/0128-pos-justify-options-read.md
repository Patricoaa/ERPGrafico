---
id: 0128
title: Motivos y cuentas de justificación de efectivo legibles por el cajero
status: Accepted
date: 2026-11-11
author: backend-team
---

# 0128 — Motivos y cuentas de justificación de efectivo legibles por el cajero

**Relacionado:** ADR-0123, ADR-0124 (lecturas del POS para usuarios autenticados), ADR-0127 (apertura/cierre a pantalla completa).

## Contexto

La apertura y el cierre de caja leían `GET /accounting/settings/current/` (para ocultar motivos sin cuenta contable) y `GET /treasury/accounts/` + `/treasury/accounts/{id}/` (destino/origen de un traspaso y su saldo). El rol `ventas` no tiene `accounting.view_accountingsettings` ni lectura de tesorería: la apertura mostraba "No tienes permiso para realizar esta acción" y el traspaso no listaba cuentas. ADR-0124 dejó `accounting/settings/current/` como pendiente.

Abrir esos endpoints expondría toda la configuración contable y todas las cuentas con sus datos bancarios.

## Decisión

`GET /treasury/pos-sessions/justify_options/` (solo autenticación, sin sesión activa) devuelve exactamente lo que el flujo necesita, vía `POSSelector.get_justify_options()`:

```json
{
  "reasons": { "PARTNER_WITHDRAWAL": true, "THEFT": true, "ROUNDING": true, "OTHER_OUT": true },
  "accounts": [{ "id": 2, "name": "Caja Fuerte", "account_type": "CASH", "current_balance": 0 }]
}
```

- `reasons`: `true` si la cuenta contable del motivo está configurada (`ROUNDING` acepta la cuenta POS o la general, igual que `_get_reason_account`). `OTHER_OUT` habilita el retiro "Otro egreso" al cerrar (ADR-0129).
- `accounts`: cuentas de tesorería activas de tipo `CASH` y `CHECKING`. `current_balance` solo para `CASH`; en bancos va `null`.
- Consultas constantes (`select_related("account")`, sin N+1).

El frontend (`usePOSJustifyOptions`) deja de llamar a `accounting/settings/current/` y `treasury/accounts/` desde el POS.

## Consecuencias

- La apertura y el cierre funcionan con el rol `ventas` sin ampliar sus permisos ni correr `sync_permissions`.
- Cualquier usuario autenticado ve nombres de cajas y bancos activos y el saldo de las cajas físicas.
- `accounting/settings/current/` y `treasury/accounts/` conservan su RBAC.
