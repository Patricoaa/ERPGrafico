---
id: 0126
title: Informe X/Z de la sesión POS en tiempo real vía Entity Bus
status: Accepted
date: 2026-11-10
author: backend-team
---

# 0126 — Informe X/Z de la sesión POS en tiempo real vía Entity Bus

**Relacionado:** ADR-0026 (Entity Bus), ADR-0109 (efectivo esperado calculado en el backend), `docs/20-contracts/realtime-channels.md`.

## Contexto

Los datos del informe X/Z (efectivo esperado, cobros por método, movimientos) se desfasaban de la realidad: el backend cacheaba `POSSelector.get_summary` 60 s en sesiones abiertas, el modal de cierre leía el resumen una sola vez al abrirse y `POSSession` / `TreasuryMovement` no emitían eventos al Entity Bus.

## Decisión

1. `treasury.possession` entra a `ALLOWLIST` del Entity Bus. Tópicos: `treasury.possession` y `treasury.possession.<id>`.
2. `PARENT_BROADCASTS` suma `treasury.treasurymovement` y `sales.saleorder` (ambos por `pos_session_id`): cualquier movimiento o venta ligada a la sesión emite `updated` sobre la sesión. Un modelo con tópico propio y también hijo ahora emite ambos (antes el `return` temprano lo impedía).
3. `POSSelector.get_summary` deja de usar caché: siempre se calcula fresco.
4. Frontend: la ficha de sesión y el modal de cierre se suscriben a `treasury.possession.<id>` (`useEntitySubscription`) e invalidan resumen, overview y actividad. El modal de cierre lee el resumen con TanStack Query (ya no `useState`) y avisa si el efectivo esperado cambió mientras se contaba.

## Consecuencias

- El payload del bus sigue sin datos de la entidad: los clientes refetchean.
- Cada venta o movimiento de una sesión suma un evento extra al grupo de esa sesión (volumen bajo, un solo nodo).
- Sin caché, cada lectura del X/Z recalcula; aceptable por volumen de una PYME.
