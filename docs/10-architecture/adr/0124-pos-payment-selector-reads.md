---
id: 0124
title: Lecturas del selector de cobro POS para usuarios autenticados
status: Accepted
date: 2026-11-10
author: backend-team
---

# 0124 — Lecturas del selector de cobro POS para usuarios autenticados

**Relacionado:** ADR-0123 (listado de cajas POS), ADR-0104 (RBAC), ADR-0116 (datos maestros `{app}.read`).

## Contexto

Tras ADR-0123 el rol `ventas` abre sesión, pero el cobro sigue fallando con 403. `PaymentMethodSelector` (checkout de ventas y POS) lee:

- `GET /treasury/pos-terminals/{id}/allowed_payment_methods/` — los métodos de la caja.
- `GET /treasury/banks/` — el desplegable «banco del cheque».

Ambos exigen permisos de lectura de tesorería que `ventas` no tiene (solo recibe `treasury.payments`). `treasury.read` expondría cuentas y movimientos completos.

La lista de bancos incluye `account_executives_details` con `tax_id`, `email` y `phone` de cada ejecutivo; abrirla tal cual filtraría datos personales.

## Decisión

1. `allowed_payment_methods` en `POSTerminalViewSet` requiere solo autenticación (se suma a `list`, ADR-0123).
2. `GET /treasury/banks/` (acción `list`) requiere solo autenticación. Quien no tenga `treasury.view_bank` recibe `BankOptionSerializer`: `id`, `name`, `code`, `is_active`, sin precargar ejecutivos. Quien lo tenga recibe `BankSerializer` completo.
3. Detalle, `overview`, escrituras y el resto de acciones conservan el RBAC estándar.

## Consecuencias

- El cobro del POS funciona con el rol `ventas` sin ampliar sus bundles.
- Cualquier usuario autenticado ve nombres y códigos de bancos y los métodos de pago de una caja.
- Sin cambios en el rol: no hace falta `sync_permissions`.
- Pendiente: `GET /treasury/payment-methods/` (checkout sin caja), `accounting/settings/current/` y `production/boms/` siguen en 403 para `ventas`.
