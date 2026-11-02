---
id: 0109
title: POS cash ledger — expected cash derived from treasury account movements
status: Proposed
date: 2026-11-01
author: core-team
---

# 0109 — POS cash ledger: expected cash derived from treasury account movements

**Related:** ADR-0063 (terminal source of truth, `treasury_account` snapshot), ADR-0031
(treasury account vs payment method), `state-map.md` §POSSession, `idempotency.md`.

---

## Context

Los informes X (parcial) y Z (cierre) y el arqueo de cierre calculaban el efectivo esperado
con contadores de la sesión:

```
expected_cash = opening_balance + total_cash_sales + total_other_cash_inflow - total_other_cash_outflow
```

Esos contadores solo los actualizaba `TreasuryService._update_pos_session`, y solo para
movimientos creados con `pos_session`. Cualquier otro movimiento sobre la **misma cuenta de
caja** no se veía en el informe. Se reprodujeron estas vías de descuadre:

1. Movimientos fuera del POS sobre la cuenta de la caja (pago de OC, cobro de ventas fuera del
   POS, gastos, nómina, traspasos): la caja física cambia y el X/Z no.
2. Anular o cancelar un movimiento de la sesión no revertía los contadores.
3. Las devoluciones de venta en efectivo dentro del POS no restaban (`OUTBOUND` con documento
   de venta se ignoraba).
4. `total_cash_sales` sumaba por *método* CASH, aunque el dinero fuera a otra cuenta.
5. La apertura solo se cuadraba contra libros si el cliente enviaba `fund_source_id`, y el
   traspaso por excedente usaba la propia caja como origen (traspaso de la caja a sí misma).
6. Nada impedía dos sesiones abiertas sobre la misma cuenta.

En el cierre, la diferencia que produce cualquiera de estas vías se registraba como
"diferencia de arqueo", y así quedaba oculto el motivo real (un riesgo de tesorería).

## Decision

1. **Libro de caja.** Una sesión abierta desde ahora fija `POSSession.ledger_baseline_at`
   (después del ajuste de apertura). Su efectivo esperado es:

   ```
   expected_cash = opening_balance
                 + Σ movimientos de treasury_account creados en la ventana  (+ entra, − sale)
                 − Σ efecto de los movimientos anulados en la ventana (cancelled_at)
   ```

   La ventana va de `[ledger_baseline_at, audit.created_at)`; mientras la sesión está abierta
   no tiene fin. Cuenta todos los movimientos de la cuenta, tengan o no `pos_session`, y excluye los
   `is_pending_registration`. Los movimientos del cierre (diferencia, retiro) quedan fuera
   porque se crean después del arqueo. Implementación: `treasury/pos_cash_ledger.py`.

2. **Cierre congelado.** Una sesión con libro de caja cerrada devuelve
   `audit.expected_amount`; los movimientos posteriores no alteran su Z.

3. **Sin recalcular el pasado.** Las sesiones con `ledger_baseline_at` nulo (todas las previas
   y las que estaban abiertas al desplegar) conservan la fórmula de contadores.

4. **`TreasuryMovement.cancelled_at`** se fija en `cancel_movement` y `annul_movement`.

5. **Informe X/Z.** El resumen agrega `cash_ledger_mode`, `cash_breakdown` (ventas en efectivo,
   devoluciones, ingresos/egresos manuales, ingresos/egresos fuera de la sesión, anulaciones,
   neto) y `out_of_session_movements` (movimientos externos y anulaciones, con documento,
   usuario y motivo). Las sesiones legacy reciben `cash_breakdown: null` y una lista vacía. El
   frontend y el PDF muestran `expected_cash` del backend, sin recalcularlo.

6. **Uso externo: advertir y exigir motivo.** `TreasuryService.create_movement` detecta un
   movimiento que toca una caja con sesión abierta (con libro de caja) y que no pertenece a esa
   sesión. Dentro de una request HTTP exige el header `X-POS-External-Reason`; si falta, lanza
   `POSExternalReasonRequired` y `POSExternalReasonMiddleware` agrega a la respuesta de error
   `X-POS-External-Reason-Required` (JSON URL-encoded con sesión, caja, cajero y terminal). El
   interceptor de `lib/api` pide el motivo con `POSExternalReasonModal` (montado en
   `DashboardShell` y `POSShell`) y reintenta. El motivo queda en
   `TreasuryMovement.pos_external_reason`. Fuera de una request (Celery, comandos) no se
   bloquea; el libro igual cuenta el movimiento como externo.

7. **Apertura.** El fondo declarado se compara siempre contra el saldo contable de la propia
   caja (se elimina `fund_source_id`). En un excedente justificado como `TRANSFER`, el origen es
   la cuenta indicada (`justify_target_id`). Solo puede haber una sesión `OPEN` por cuenta de
   tesorería (bloqueo con `select_for_update`); los demás cajeros se unen a ella.

## Consequences

### Positivas
- El X/Z refleja el saldo real de la caja: lo que salió por una OC aparece como egreso externo,
  con su motivo, en vez de esconderse en la diferencia de arqueo.
- Las anulaciones y las devoluciones en efectivo afectan el esperado.
- En las sesiones nuevas, el saldo contable de la caja y el efectivo esperado coinciden, porque
  la apertura deja los libros en el fondo declarado.

### Negativas / trade-offs
- `expected_cash` de una sesión abierta cuesta una consulta (o la anotación
  `annotate_ledger_cash_net` en el listado, para no violar el invariante 14).
- El reintento con motivo regenera la `Idempotency-Key`. Es seguro porque el intento rechazado
  no tuvo efectos (el guard corre antes de crear el movimiento, dentro de servicios atómicos),
  pero el decorador `@idempotent_endpoint` cachea el 400 bajo la clave original.
- Dos terminales que compartían cuenta de caja ya no pueden abrir sesiones simultáneas.
- Un movimiento con fecha contable antigua pero creado durante la sesión cuenta en ella (la
  ventana usa `created_at`, que corresponde al momento físico del movimiento).

### Archivos
- `backend/treasury/models.py` — `POSSession.ledger_baseline_at`, `uses_cash_ledger`,
  `expected_cash`; `TreasuryMovement.cancelled_at`, `pos_external_reason`
- `backend/treasury/migrations/0097_pos_cash_ledger.py`
- `backend/treasury/pos_cash_ledger.py`, `backend/treasury/pos_external_guard.py` (nuevos)
- `backend/treasury/pos_service.py`, `services.py`, `selectors.py`, `views.py`,
  `pos_report_pdf.py`, `templates/exports/pos_report.html`
- `backend/config/settings.py` — middleware y headers CORS
- `frontend/lib/pos-external-reason.ts`, `frontend/lib/api.ts`
- `frontend/features/treasury/components/POSExternalReasonModal.tsx`
- `frontend/features/pos/components/POSReport.tsx`, `SessionCloseModal.tsx`,
  `SessionOpenModal.tsx`, `POSShell.tsx`; `frontend/components/layout/DashboardShell.tsx`
- `docs/20-contracts/state-map.md` §POSSession

## Alternatives considered

- **Saldo del plan de cuentas (journal items de la cuenta contable).** Rechazado:
  `TreasuryAccount.account` no es único, así que varias cajas pueden compartir cuenta
  contable y sus saldos se mezclarían.
- **Seguir con contadores y engancharlos en cada flujo.** Rechazado: hay más de 15 call sites de
  `create_movement`, además de anulaciones y devoluciones; cualquier flujo nuevo reabriría el
  agujero.
- **Bloquear el uso de cajas POS fuera del POS.** Descartado por decisión de negocio: hay
  usos legítimos (pago a proveedor en efectivo). Se optó por advertir y exigir motivo.
- **Campo de motivo en cada formulario de pago.** Rechazado: son más de 12 diálogos. El desafío
  por header y el interceptor cubren todos los flujos en un solo punto.
- **Recalcular sesiones cerradas.** Rechazado: alteraría informes Z ya emitidos y arqueos
  contabilizados.

## References

- `docs/20-contracts/state-map.md` §POSSession
- `docs/20-contracts/idempotency.md`
- `backend/treasury/tests/test_pos_cash_ledger.py`
