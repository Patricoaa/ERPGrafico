---
layer: 50-audit
doc: bancos/fase-4-cheques
status: active
owner: core-team
last_review: 2026-06-02
kind: roadmap
---

# Fase 4 — Cheques: completar el módulo

Ya está entregado el flujo de **cheques recibidos de terceros** (cartera con cuenta puente
`CHECK_PORTFOLIO`, `Check`, `CheckService`, UI — ADR-0032). Esta fase completa el resto.
Esfuerzo: L.

**Reutiliza:** todo el andamiaje de `Check`/`CheckService`. La mayoría de tareas EXTIENDEN
el modelo y servicio existentes (no se crea uno nuevo).

---

### F4.1 · Cheques propios girados (`direction = ISSUED`)
- **Objetivo:** registrar cheques que la empresa emite para pagar proveedores, con el
  concepto contable de "cheques girados pendientes de cobro".
- **Dificultad:** L
- **Archivos clave:** `backend/treasury/models.py` (reusar `Check`, `direction=ISSUED`),
  `check_service.py` (`issue()`, `mark_cashed()`), `AccountingSettings` (cuenta puente
  "Cheques Girados por Pagar" **LIABILITY**, o un `TreasuryAccount` tipo nuevo
  `ISSUED_CHECKS` system-managed LIABILITY — análogo a `CHECK_PORTFOLIO` pero pasivo).
- **Cambios esperados:**
  - `issue(...)`: pagar una compra con cheque → el OUTBOUND no toca el banco; **acredita**
    la cuenta puente "Cheques Girados" (LIABILITY) y salda al proveedor. Estado `ISSUED`.
  - `mark_cashed(check)`: cuando el proveedor cobra → TRANSFER "Cheques Girados" → banco
    (debita el pasivo, acredita banco). Estado `CLEARED`.
  - `void`/`bounce` análogos con reversa.
  - Reusar el enum `Status`; agregar lo que falte para el sentido ISSUED.
- **DoD:** test: girar cheque deja la deuda en "Cheques Girados" sin tocar banco; al cobrarlo
  el proveedor, el banco baja y el pasivo se cancela.

### F4.2 · Endoso de cheques recibidos
- **Objetivo:** endosar un cheque en cartera a un proveedor (pagar con un cheque de tercero).
- **Dificultad:** M
- **Archivos clave:** `check_service.py` (`endorse(check, supplier, ...)`), `Check`
  (campos `endorsed_to`, estado `ENDORSED`).
- **Cambios esperados:** `endorse` saca el cheque de la cartera (TRANSFER/OUTBOUND desde
  `CHECK_PORTFOLIO`) y salda la cuenta del proveedor; estado `ENDORSED`. Transición válida
  desde `IN_PORTFOLIO`.
- **DoD:** test: endosar un cheque baja la cartera y salda al proveedor; estado `ENDORSED`.

### F4.3 · Chequera con folios/correlativos
- **Objetivo:** controlar talonarios y números de cheque propios.
- **Dificultad:** M
- **Archivos clave:** `backend/treasury/models.py` (`Checkbook(treasury_account CHECKING,
  start_folio, end_folio, next_folio, status)`), validación de folio en `issue()`.
- **Cambios esperados:** al girar un cheque propio, tomar el siguiente folio disponible y
  validar que no esté usado/anulado. Reporte de folios usados/disponibles.
- **DoD:** test: girar consume el folio correlativo; folio duplicado rechazado.

### F4.4 · Integración con método de pago `CHECK` en venta/compra
- **Objetivo:** que pagar/cobrar con el método `CHECK` cree automáticamente el `Check`
  (hoy el método `CHECK` cae a `Method.OTHER` sin entidad).
- **Dificultad:** M
- **Archivos clave:** `backend/treasury/orchestrator.py` / el flujo de pago de ventas y
  compras, `check_service.py`.
- **Cambios esperados:** cuando el `PaymentMethod.method_type == 'CHECK'`, derivar al
  `CheckService.receive` (venta) o `issue` (compra) en vez de un movimiento genérico.
- **DoD:** test: registrar un pago de venta con método CHECK crea un `Check` `IN_PORTFOLIO`
  vinculado a la factura.

### F4.5 · Reportería UI de cartera y tránsito
- **Objetivo:** exponer en la UI los endpoints ya existentes (`/checks/portfolio/`,
  `/checks/in_transit/`).
- **Dificultad:** S
- **Archivos clave:** `frontend/features/treasury/checks/ChecksView.tsx` (KPIs), hooks.
- **Cambios esperados:** KPIs "En cartera" (total + count) y "Depósitos en tránsito";
  filtro "por vencer (N días)". Drilldown desde KPI a la tabla filtrada.
- **DoD:** los KPIs muestran los totales de los endpoints; el filtro reduce la tabla.

### F4.6 · Alertas Celery de cheques
- **Objetivo:** avisar cheques por vencer (en cartera) y depósitos en tránsito añejos.
- **Dificultad:** S
- **Archivos clave:** `backend/treasury/tasks.py`, beat schedule, notificaciones in-app.
- **Cambios esperados:** task diario: marca vencidos en cartera y notifica cheques con
  `due_date` próxima y `DEPOSITED` > N días sin cobrar.
- **DoD:** simular cheque por vencer → notificación generada.

### F4.7 · Docs + tests + ADR
- **Dificultad:** S
- **Cambios esperados:** extender `test_checks.py` (issue, endorse, folios, integración);
  ADR-0035 "Cheques propios girados y endoso". Actualizar este archivo a ✅.
- **DoD:** suite de cheques verde en Postgres real.

---

## Verificación de la fase
- Tests verdes (local `--no-migrations` + Postgres real, con rollback).
- `makemigrations --check` limpio; `npm run type-check`/ESLint sin errores.
- Manual: girar cheque propio (folio + deuda) → proveedor cobra (banco baja); endosar un
  cheque recibido.
