---
id: 0123
title: Listado de cajas POS legible por cualquier usuario autenticado
status: Accepted
date: 2026-11-10
author: backend-team
---

# 0123 — Listado de cajas POS legible por cualquier usuario autenticado

**Relacionado:** ADR-0104 (RBAC, vistas `IsAuthenticated`-only en POS), ADR-0116 (datos maestros `{app}.read`), ADR-0122 (eliminación del PIN de POS).

## Contexto

Un usuario del rol `ventas` no puede abrir una sesión POS: `GET /api/treasury/pos-terminals/` responde 403 porque `POSTerminalViewSet` usa el RBAC estándar y exige `treasury.view_posterminal`, permiso que el rol no tiene. Las acciones de sesión (`pos-sessions/current/`, `open_session/`) ya son `IsAuthenticated`, así que el cajero llega al selector de caja y falla ahí.

Darle al rol `ventas` `treasury.read` exponía todas las cuentas y movimientos de tesorería, mucho más de lo que necesita para vender.

## Decisión

1. `GET /api/treasury/pos-terminals/` (acción `list`) requiere solo autenticación.
2. El resto del viewset conserva el RBAC estándar: `retrieve`, `available_accounts`, `allowed_payment_methods`, creación, edición y el bloqueo de borrado.
3. El listado no recibe campos nuevos; el serializer existente no cambia.

## Consecuencias

- Cualquier usuario autenticado ve el catálogo de cajas (código, nombre, ubicación, cuenta por defecto y métodos de pago permitidos). Se considera dato de operación del POS, no sensible.
- La pantalla de administración de cajas sigue protegida en escritura, y el detalle sigue exigiendo `treasury.view_posterminal`.
- No se modifica el rol `ventas`. El flujo de apertura de sesión deja de depender de esa grant.
- Pendiente fuera de este ADR: `GET /api/accounting/settings/current/` y `GET /api/production/boms/` también responden 403 al rol `ventas`. El primero solo degrada la justificación de apertura; el segundo puede afectar la venta de productos con BOM. Se tratan aparte.
