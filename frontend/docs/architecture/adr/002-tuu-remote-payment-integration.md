# ADR 002: Integración TUU Pago Remoto en POS

## Status
Implementado — 2026-04-16

Fases 1–3 completadas. Fase 4 (go-live con terminal físico) pendiente de activación en producción.

## Context

El POS del ERP cobra con máquinas de terminal (Transbank, TUU) de forma manual: el cajero digita el monto en la máquina física y confirma en pantalla. Esto produce fricción operativa, errores de monto, y desacopla la transacción electrónica de la venta del ERP hasta que llega la liquidación diaria del proveedor (1-2 días después).

TUU/Haulmer publica una API de **Pago Remoto** (`integrations.payment.haulmer.com/RemotePayment/v2/`) que permite enviar la orden de cobro al terminal desde el ERP, eliminando la digitación manual y obteniendo confirmación de la transacción en línea.

### Restricciones del proveedor

- Autenticación por API Key (`X-API-Key`) única por comercio.
- Sin webhooks — estado se obtiene por **polling** de `GET GetPaymentRequest/:idempotencyKey`.
- Rate limits: 5 solicitudes pendientes por terminal, 1 request/minuto.
- Ambiente único: **solo producción con terminal físico**, no hay sandbox.
- Valores de `dteType` soportados por la API de pago remoto: `0, 33, 48, 99`.

### Modelo de emisión DTE del negocio

- Tarjeta (crédito/débito): TUU emite DTE 48 automáticamente al SII.
- Efectivo: TUU emite boleta por canal distinto al pago remoto → fuera de integración, operación manual.
- Factura (33): el terminal no emite DTE → operación manual.

### Payload de respuesta `Completed` (verificado)

```json
{
  "idempotencyKey": "...", "status": "Completed", "sequenceNumber": "000000051934",
  "amount": 1600, "device": "TJ44245N20448", "dteType": 48,
  "transactionReference": "...", "acquirerId": "..."
}
```

**No incluye**: folio DTE, URL del DTE, código de autorización, marca o últimos 4 de tarjeta.

### Estado actual del backend (base)

Existen `treasury.PaymentTerminalProvider` (con `ProviderType.TUU` y `gateway_config: JSONField`), `treasury.PaymentTerminalDevice` (con `serial_number`), `treasury.POSTerminal`, `treasury.POSSession`, `sales.SaleOrder`, `sales.DraftCart`, y `treasury.TerminalBatch` para liquidación. **No existe** modelo de transacción electrónica individual, cliente HTTP a proveedores externos, tareas Celery en `treasury`, ni cifrado de credenciales de gateway.

## Decision

Se aprueba integrar TUU Pago Remoto **exclusivamente para cobros con tarjeta** en el POS, bajo las siguientes decisiones arquitectónicas:

### D1. Alcance

Solo pagos con tarjeta en POS (`dteType=48`). Efectivo y factura permanecen manuales sin cambios.

### D2. TUU como única fuente del DTE 48

El ERP **no persiste folio, URL ni XML del DTE emitido por TUU**. Se confía en que TUU cumple la emisión al SII. El ERP guarda `transactionReference`, `sequenceNumber` y `acquirerId` como evidencia de la transacción. El folio materializa después vía la liquidación diaria (`TerminalBatch`).

### D3. Nuevo modelo `treasury.PaymentRequest`

Entidad que modela la transacción electrónica individual, separada de `TerminalBatch` (liquidación) y de `SaleOrder` (venta del ERP).

Campos mínimos:

- `idempotency_key` (CharField 36, unique, indexed)
- `status` (Choices: `Pending|Sent|Processing|Completed|Failed|Canceled`)
- `amount` (Decimal)
- `device` (FK `PaymentTerminalDevice`)
- `provider` (FK `PaymentTerminalProvider`)
- `dte_type` (IntegerField, por ahora siempre 48)
- `payment_method_code` (Int: 1=crédito, 2=débito)
- `sale_order` (FK `SaleOrder`, nullable)
- `pos_session` (FK `POSSession`, nullable)
- `sequence_number`, `transaction_reference`, `acquirer_id` (CharField nullable, completados en `Completed`)
- `raw_last_response` (JSONField — respuesta cruda completa)
- `failure_reason` (CharField nullable — código MR-xxx / RP-xxx)
- `initiated_at`, `completed_at` (DateTimeField)
- `celery_task_id` (CharField nullable)

Máquina de estados alineada a TUU: `Pending → Sent → Processing → {Completed|Failed|Canceled}`, terminales irrevocables.

### D4. Cifrado de credenciales de gateway

La API Key de TUU se almacena cifrada en `PaymentTerminalProvider.gateway_config` mediante Fernet (clave derivada de `SECRET_KEY` o variable dedicada `TUU_ENCRYPTION_KEY`). Acceso solo vía método de modelo `get_api_key()` que desencripta en runtime. Nunca se expone por serializer ni se loguea.

### D5. Capa de gateway con contrato abstracto y doble implementación

Nueva capa `treasury/gateways/`:

- `base.py` — interfaz `PaymentGateway` (`create`, `fetch_status`).
- `tuu.py` — `TuuGateway` implementación HTTP real contra `integrations.payment.haulmer.com`.
- `fake.py` — `FakeTuuGateway` simula la máquina de estados para dev/test.

Selección controlada por setting `TUU_GATEWAY_MODE ∈ {fake, live}`. Default `fake`. En producción se setea explícitamente a `live` por variable de entorno. Tests siempre usan `fake`.

### D6. Polling asíncrono vía Celery

Tarea `treasury.tasks.poll_payment_request(payment_request_id)` dispara polling a `GetPaymentRequest/:key` con:

- Intervalo: 3 segundos (con backoff si se acerca al rate limit).
- Rate limit aplicado: máx 1 request/minuto **por terminal** (no global).
- Timeout duro: 3 minutos → si sigue `Pending/Sent/Processing`, marca `Failed` con razón `TIMEOUT` y permite al cajero cancelar manualmente.
- Al alcanzar estado terminal, actualiza `PaymentRequest` y dispara signal para transición de `SaleOrder`.

### D7. Integración con `SaleOrder` y flujo POS

- Nuevo estado `SaleOrder.Status.PAYMENT_PENDING` (o campo equivalente en el wizard) para ventas tarjeta-POS con cobro iniciado y no confirmado.
- Transición a `PAID` **solo** al recibir `Completed`.
- `Failed`/`Canceled` → la venta vuelve al paso de pago del wizard; no se bloquea el draft.
- Mientras esté `PAYMENT_PENDING` con tarjeta vía TUU, el ERP **no** emite DTE local (el DTE 48 es de TUU).

### D8. Endpoints API

- `POST /api/treasury/payments/initiate` — crea `PaymentRequest`, llama `gateway.create`, retorna `idempotency_key`.
- `GET /api/treasury/payments/{idempotency_key}` — estado actual (frontend POS hace polling corto a este endpoint local, no a TUU).
- `POST /api/treasury/payments/{idempotency_key}/cancel` — solo válido en `Pending` local antes de `Sent`; no cancela en TUU si ya fue enviada.

### D9. Reconciliación con `TerminalBatch`

`matching_service.py` se extiende para cruzar `PaymentRequest.Completed` del día con el reporte de liquidación por `sequence_number` + `device` + `sales_date`. Los `Completed` huérfanos (sin match en liquidación) y los items de liquidación huérfanos (sin `PaymentRequest`) se listan en el reporte de diferencias.

### D10. Testing y go-live sin sandbox

- Tests unitarios e integración contra `FakeTuuGateway` obligatorios — cobertura mínima de la máquina de estados, idempotencia, timeout, rate limit, errores MR-/RP-.
- Go-live: **terminal físico dedicado** registrado en Workspace TUU para smoke tests en producción con montos mínimos (≥ $100 CLP). Variable `TUU_GATEWAY_MODE=live` solo se activa en el ambiente productivo. Dev y staging permanecen en `fake`.

## Consequences

### Positive

- Elimina digitación manual en cobros con tarjeta → menos errores de monto y reconciliación.
- Estado de la transacción queda ligado a la venta en tiempo real.
- Capa de gateway abstracta permite sumar Transbank u otros proveedores reutilizando `PaymentRequest` y la máquina de estados.
- `FakeTuuGateway` habilita desarrollo y testing sin hardware ni riesgo de cobros reales.
- Cifrado de credenciales cierra un riesgo de seguridad preexistente (`gateway_config` en claro).

### Negative

- El ERP queda **ciego al folio DTE** hasta la liquidación — el operador contable debe consultar el portal Haulmer si necesita el folio inmediato.
- Voucher en pantalla del POS muestra menos información que el ticket impreso por el terminal (sin marca/últimos 4/auth code).
- Sin sandbox → todo testing de integración real implica cobros reales; riesgo operacional mayor, mitigado por el feature flag y terminal de pruebas dedicado.
- Polling aumenta carga en Celery y latencia percibida en el POS (hasta 3 s por ciclo).
- Deuda acumulada: campos `process_via_terminal` / `is_terminal` en `PaymentMethod` siguen marcados DEPRECATED y conviene limpiarlos en un sprint posterior para evitar tercera capa de semántica.

## Implementation Checklist

- [x] Crear app/módulo `treasury/gateways/` con `PaymentGateway` abstracto, `TuuGateway`, `FakeTuuGateway`. _(Fase 1)_
- [x] Migración: modelo `treasury.PaymentRequest` + índices (`idempotency_key` unique, `sequence_number`, `sale_order`). _(Fase 1 — migraciones 0009, 0011)_
- [x] Utility de cifrado Fernet para `gateway_config.api_key` + método `PaymentTerminalProvider.get_api_key()`. _(Fase 1 — `core/crypto.py`, `set_tuu_api_key` management command)_
- [x] Setting `TUU_GATEWAY_MODE` (default `fake`) + fábrica `get_gateway(provider)`. _(Fase 1 — `gateways/factory.py`, `config/settings.py`)_
- [x] Celery task `poll_payment_request` con rate-limit por terminal y timeout. _(Fase 1 — `treasury/tasks.py`, `gateways/ratelimit.py`)_
- [x] Endpoints `POST /initiate`, `GET /{key}`, `POST /{key}/cancel`. _(Fase 1 — `treasury/views.py`)_
- [x] Estado `PAYMENT_PENDING` en `SaleOrder` + transiciones en `sales/services.py`. _(Fase 1)_
- [x] UI wizard POS: paso de espera con cancelación y manejo de `Failed`/`Canceled`. _(Fase 2 — `TerminalPaymentWizard`, `useInitiatePayment`, `usePaymentStatus`)_
- [x] Guard DTE: bloqueo de emisión mientras `PAYMENT_PENDING`. _(Fase 2 — `billing/services.py`)_
- [x] Extender `matching_service.py` para cruce por `sequence_number`. _(Fase 3 — `PaymentRequestBatchReconciler`)_
- [x] Migración FK `PaymentRequest.terminal_batch`. _(Fase 3 — migración 0011)_
- [x] Tests: máquina de estados, idempotencia, timeout, rate limit, errores MR/RP, cifrado, reconciliación. _(38/38 green)_
- [ ] **Fase 4 — Go-live**: Registrar terminal dedicado en Workspace TUU. Obtener API Key. Ejecutar `set_tuu_api_key`. Setear `TUU_GATEWAY_MODE=live` + `TUU_ENCRYPTION_KEY` en env producción. Smoke test con $100 CLP real.
- [ ] **Deuda técnica**: Limpiar `PaymentMethod.process_via_terminal` / `is_terminal` (registrar issue separado).
