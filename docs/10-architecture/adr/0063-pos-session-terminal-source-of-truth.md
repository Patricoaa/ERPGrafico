---
id: 0063
title: POS session terminal as source of truth (treasury_account snapshot)
status: Proposed
date: 2026-08-02
author: core-team
---

# 0063 — POS session terminal as source of truth (treasury_account snapshot)

**Related:** ADR-0031 (treasury account vs payment method taxonomy), `state-map.md` §POSSession

---

## Context

`POSSession.treasury_account` nació como la referencia directa de "en qué caja se abrió
el turno" y quedó marcado `DEPRECATED: Use terminal.default_treasury_account`. Sin embargo
la migración quedó a medias:

- El frontend ya abre sesiones **solo** con `terminal_id` (`SessionControl.tsx`); nadie
  envía `treasury_account_id` en el flujo POS.
- `POSService.open_session` seguía aceptando un path legacy `treasury_account_id`
  (creaba sesiones con `terminal=None`).
- El serializer leía `treasury_account.name` sin fallback, por lo que la columna "Cuenta"
  de `/sales/sessions` salía vacía para sesiones cuyo snapshot era nulo aunque el terminal
  tuviera cuenta por defecto.
- Los lectores internos (`_get_session_treasury`, `get_summary`, `services.py`) ya resolvían
  con fallback a `terminal.default_treasury_account`.

`treasury_account` en la sesión es, en la práctica, un **snapshot denormalizado** capturado
al abrir. Decidimos formalizarlo en lugar de eliminarlo, porque el snapshot es lo único que
congela "en qué caja se abrió este turno": si el terminal cambia su cuenta por defecto
después, una sesión cerrada no debe migrar retroactivamente de caja.

## Decision

1. **Terminal es la única forma de abrir una sesión.**
   - `POSService.open_session` requiere `terminal_id` (obligatorio) y elimina el path legacy
     `treasury_account_id`. `open_session_from_request` ya no lee ese campo del payload.
   - Si el terminal está inactivo o no existe → `ValidationError`.
   - Si el terminal no tiene `default_treasury_account` → `ValidationError`: una sesión
     siempre necesita una caja.

2. **`POSSession.treasury_account` es un snapshot inmutable.**
   - Se copia de `terminal.default_treasury_account` al abrir (`open_session`).
   - Se actualiza su `verbose_name`/`help_text` para reflejar que es un snapshot, no un
     valor de entrada. No se edita por API: el serializer lo expone `read_only`.

3. **La API resuelve la cuenta con fallback.**
   - `POSSessionSerializer.treasury_account_name` pasa a ser `SerializerMethodField` que
     resuelve `_get_session_treasury(session)` (snapshot → fallback
     `terminal.default_treasury_account`). Corrige la columna "Cuenta" vacía.

4. **Modelo de datos.**
   - `terminal` y `treasury_account` se mantienen nullable en DB para no forzar backfills
     sobre datos legacy; la obligatoriedad se impone a nivel servicio.

## Consequences

### Positivas
- El modelo refleja el flujo real: la sesión pertenece a un terminal; la caja es un
  snapshot de apertura.
- La columna "Cuenta" de `/sales/sessions` siempre muestra la caja efectiva (snapshot o
  default del terminal).
- Se elimina el código muerto del path legacy `treasury_account_id` y el riesgo de crear
  sesiones sin terminal.
- `treasury_account` deja de ser editable por API.

### Negativas
- El snapshot puede diferir del `terminal.default_treasury_account` actual para sesiones
  históricas (comportamiento buscado, pero puede confundir si se compara contra el terminal).
- Se requiere ADR por ser un cambio de API pública (payload de `open_session`).
- Los clientes que enviaran `treasury_account_id` al abrir dejarán de funcionar (ninguno en
  el frontend actual).

### Archivos modificados
- `backend/treasury/models.py` — `POSSession.treasury_account` verbose/help_text (snapshot)
- `backend/treasury/pos_service.py` — `open_session`/`open_session_from_request` sin legacy
- `backend/treasury/serializers.py` — `POSSessionSerializer.treasury_account_name` con fallback; `treasury_account` read-only
- `backend/treasury/migrations/0093_alter_historicalpossession_treasury_account_and_more.py`
- `backend/treasury/tests/test_pos_sessions.py` — tests nuevos
- `frontend/types/pos.ts`, `frontend/features/pos/types/index.ts`,
  `frontend/features/sales/components/POSSessionsClientView.tsx` — tipos nullable
- `docs/20-contracts/state-map.md` — §POSSession

## Alternatives considered

- **Eliminar `treasury_account` y resolver siempre por terminal (A).** Rechazado: se perdería
  el snapshot histórico y una sesión cerrada podría cambiar de caja retroactivamente si el
  terminal cambia su default. Los `TreasuryMovement` conservan la cuenta, pero el resumen/
  reporte de la sesión no.
- **Mantener el path legacy.** Rechazado: código muerto que permite crear sesiones sin
  terminal, en contradicción con el flujo real.
