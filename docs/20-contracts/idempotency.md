---
layer: 20-contracts
doc: idempotency
status: active
owner: backend-team
last_review: 2026-05-21
stability: contract-changes-require-ADR
---

# Idempotency — Convención multi-capa

Idempotencia en ERPGrafico es **opt-in con lista cerrada**: solo los endpoints/tareas explícitamente en la “lista cerrada” la implementan. El resto puede ser no-idempotente. Esto es deliberado: idempotencia universal es costo operativo que la mayoría de operaciones no necesita.

## Por qué importa

Sin idempotencia explícita en operaciones críticas, un doble-clic del usuario, un retry de cliente HTTP o una re-ejecución de Celery puede producir:

- Dos `PaymentRequest` ejecutadas contra el proveedor → cobro duplicado.
- Dos `JournalEntry` por una misma factura → libros descuadrados.
- Dos `Invoice` emitidas con folios consecutivos → conflicto con SII.

## Las tres capas

| Capa | Mecanismo | Aplica a |
|------|-----------|----------|
| **DB** | Campo `idempotency_key` con `unique=True, db_index=True` | Modelos que persisten resultados externos (pagos, callbacks de provider) |
| **HTTP** | Header `Idempotency-Key: <uuid>` + lookup-then-process | Endpoints de la lista cerrada (abajo) |
| **Celery** | Lookup-then-insert dentro de la tarea | Tareas que crean registros fiscalmente sensibles |

Una operación crítica usa **las tres** — no es alternativa, es defensa en profundidad.

---

## Lista cerrada de endpoints HTTP

Estos endpoints **DEBEN** validar `Idempotency-Key`. Agregar uno requiere ADR.
La tabla refleja los scopes reales decorados con `@idempotent_endpoint` en el código (reconciliado 2026-08-04).

| Scope (`@idempotent_endpoint(scope=...)`) | Endpoint real | Por qué |
|--------|----------|---------|
| `billing.invoice.create` | `POST /api/billing/invoices/` | Emitir factura asigna folio fiscal — no reversible |
| `billing.pos.checkout` | `POST /api/billing/invoices/pos_checkout/` | Checkout POS — crea orden + factura + pago en una transacción |
| `sales.order.create` | `POST /api/sales/orders/` | Creación de orden de venta (desde POS o manual) |
| `sales.order.confirm` | `POST /api/sales/orders/{id}/confirm/` | Confirmación — dispara flujos aguas abajo |
| `sales.order.dispatch` | `POST /api/sales/orders/{id}/dispatch/` | Despacho — genera guía/movimientos |
| `purchasing.order.confirm` | `POST /api/purchasing/orders/{id}/confirm/` | Confirmación de orden de compra |
| `purchasing.order.receive` | `POST /api/purchasing/orders/{id}/partial_receive/` | Recepción parcial — actualiza inventario |
| `purchasing.order.checkout` | `POST /api/purchasing/orders/purchase_checkout/` | Checkout de compra — orden + factura + pago + recepción en una transacción |
| `production.order.create` | `POST /api/production/orders/` | Creación de orden de producción |
| `production.order.bulk_transition` | `POST /api/production/orders/bulk_transition/` | Transición masiva de estados — multi-orden |
| `accounting.entry.create` | `POST /api/accounting/entries/` | Asiento manual — descuadra libros si duplica |
| `hr.payroll.draft` | `POST /api/hr/payrolls/create_draft_payrolls/` | Generación de borradores de nómina masivos |
| `tax.period.close` | `POST /api/tax/periods/{id}/close/` + `POST /api/tax/accounting-periods/{id}/close/` | Cierre de período (ambos viewsets usan el mismo scope) |
| `tax.f29.register` | `POST /api/tax/declarations/{id}/register/` | Registrar declaración F29 — crea registro oficial ante SII, no reversible |
| `treasury.movement.create` | `POST /api/treasury/movements/` (también `/payments/`) | Movimiento bancario manual |
| `treasury.movement.register` | `POST /api/treasury/movements/register_movement/` (también `/payments/register_movement/`) | Registro rápido de pago/cobro desde formularios |
| `treasury.card.purchase` | `POST /api/treasury/movements/card-purchase/` (también `/payments/card-purchase/`) | Compra con tarjeta en cuotas — crea grupo + cuotas |
| `treasury.allocation.create` | `POST /api/treasury/movements/{id}/allocate/` | Asignación de movimiento a cuenta/conciliación |
| `treasury.reconciliation.match` | `POST /api/treasury/statement-lines/match_group/` | Matching automático de un grupo de líneas |
| `treasury.transfer.register` | `POST /api/treasury/dashboard/register_transfer/` | Transferencia entre cuentas — dos asientos |

> Nota: `TreasuryMovementViewSet` está registrado bajo dos rutas (`movements` y `payments`, [treasury/urls.py:26-27](../../backend/treasury/urls.py#L26)) — los decorators de ese viewset aplican a ambas.
>
> **`billing.invoice.issue`, `billing.creditnote.create`, `treasury.paymentrequest.create`, `{module}.import.commit` y `treasury.reconciliation.run` NO existen en el código** (scopes que versiones previas de este contrato listaban). El flujo de importación bulk NO usa `@idempotent_endpoint` — ver [import-csv-xlsx.md](import-csv-xlsx.md).

**Convención del header:** el cliente genera **UUIDv4** al crear la intención de acción (click del botón). Reenvío del header con el mismo valor en retries. Una nueva acción del usuario genera nuevo UUID.

**TTL del registro:** 24 horas. La tarea `core.tasks.purge_idempotency_records(retention_hours=24)` borra registros viejos y está programada a diario en `CELERY_BEAT_SCHEDULE` (`purge_idempotency_records_daily`, 02:30 AM, [settings.py:505-511](../../backend/config/settings.py#L505)).

---

## Patrón canónico — HTTP

### Frontend (genera el key)

Patrón real del codebase: la API method acepta `idempotencyKey?` y el header se setea condicionalmente.

```ts
// features/orders/api/ordersApi.ts
registerPaymentMovement: (data: Record<string, unknown>, idempotencyKey?: string) =>
    api.post('/treasury/payments/register_movement/', data, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }).then(r => r.data),
```

```ts
// features/orders/hooks/useOrdersMutations.ts — el key viaja en las variables de la mutation
mutationFn: ({ data, idempotencyKey }: { data: Record<string, unknown>; idempotencyKey?: string }) =>
    ordersApi.registerPaymentMovement(data, idempotencyKey),
```

```ts
// El componente genera el key UNA vez por intención (ref) y lo reusa en retries
const idempotencyKeyRef = useRef<string | null>(null)
// al montar o al crear la intención:
if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID()
```

**Reglas frontend:**
- El UUID se genera en el handler que origina la acción (normalmente `crypto.randomUUID()` guardado en un `ref`), **no** dentro del mutation function de TanStack (que puede ser invocado N veces).
- Si la mutation se retry con el mismo `variables`, el `Idempotency-Key` debe ser el mismo. Esto se logra anteponiendo el UUID a `variables` (`{ data, idempotencyKey }`).
- Si el backend no soporta el endpoint (sin `@idempotent_endpoint`), el key simplemente se omite (`idempotencyKey ? { … } : undefined`).

### Backend (decorador + tabla)

```python
# backend/core/idempotency.py (implementación real — resumida)
from hashlib import sha256
from django.db import IntegrityError, transaction
from rest_framework import status as http_status
from rest_framework.response import Response
from core.models import IdempotencyRecord

def idempotent_endpoint(scope: str):
    """Múltiples llamadas con el mismo Idempotency-Key + scope devuelven
    el resultado de la primera ejecución, sin re-ejecutar el view.
    - Sin header → 400 · Anónimo → 401 · Mismo key + body distinto → 409
    - Mismo key con ejecución en curso (<60s) → 425 Too Early
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            key = request.headers.get("Idempotency-Key")
            if not key:
                return Response({"detail": "Idempotency-Key header required"},
                                status=http_status.HTTP_400_BAD_REQUEST)
            if not getattr(request.user, "is_authenticated", False):
                return Response({"detail": "Authentication required"},
                                status=http_status.HTTP_401_UNAUTHORIZED)
            body_hash = _compute_body_hash(request)          # sha256(body); multipart hashiza POST+FILES
            record, created = _get_or_create_record(key=key, scope=scope,
                                                    body_hash=body_hash, user=request.user)
            if record.body_hash != body_hash:
                return Response({"detail": "Idempotency-Key reused with different body"},
                                status=http_status.HTTP_409_CONFLICT)
            if record.status == IdempotencyRecord.Status.DONE:
                return Response(record.response_payload,
                                status=record.response_status or http_status.HTTP_200_OK)
            if not created and record.status == IdempotencyRecord.Status.PENDING and _is_concurrent(record):
                return Response({"detail": "In progress, retry shortly"},
                                status=http_status.HTTP_425_TOO_EARLY)
            try:
                with transaction.atomic():
                    response = view_func(self, request, *args, **kwargs)
                    record.response_status = response.status_code
                    record.response_payload = _coerce_payload(response.data)
                    record.status = IdempotencyRecord.Status.DONE
                    record.save(update_fields=["response_status", "response_payload", "status"])
            except Exception:
                record.status = IdempotencyRecord.Status.ERROR
                record.save(update_fields=["status"])
                raise
            return response
        return wrapper
    return decorator
```

Detalles de la implementación real:

- `_get_or_create_record`: `INSERT` bajo `unique_together(key, scope)` — race-safe. Si dos requests entran simultáneamente, una crea y la otra encuentra el registro en el segundo intento (catch `IntegrityError`). NO usa `select_for_update`.
- `_is_concurrent`: heuristic — PENDING creado hace <60s se trata como ejecución en curso (425). Pasado ese margen se asume que la ejecución original murió y se permite reintento (deliberadamente laxo).
- `_compute_body_hash`: para `multipart/form-data` hashiza el POST parseado + metadatos de archivos (el boundary crudo rompería los retries); para el resto, `sha256(request.body)`.
- `_coerce_payload`: aplana `response.data` (Decimal, datetime, UUID…) a JSON-serializable.

```python
# backend/sales/views.py (uso)
class InvoiceViewSet(ModelViewSet):
    @idempotent_endpoint(scope="billing.invoice.create")
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
```

### Modelo IdempotencyRecord

Archivo real: [backend/core/models/idempotency.py](../../backend/core/models/idempotency.py) (no está en `models.py`).

```python
class IdempotencyRecord(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"   # En proceso
        DONE    = "done"      # Completado
        ERROR   = "error"     # Error

    key               = models.CharField(max_length=64)     # UUID del cliente
    scope             = models.CharField(max_length=128)    # e.g. 'billing.invoice.create'
    user              = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                          related_name="idempotency_records")
    body_hash         = models.CharField(max_length=64)     # SHA-256 hex del body
    response_status   = models.IntegerField(null=True, blank=True)
    response_payload  = models.JSONField(null=True, blank=True)
    status            = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    created_at        = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["key", "scope"], name="uniq_idempotency_key_scope"),
        ]
        indexes = [models.Index(fields=["created_at"], name="idx_idempotency_created")]
```

No se registra en `simple_history` (TTL 24h, los registros se purgan a diario).

Cleanup vía Celery beat diario: borra registros >24h.

---

## Patrón canónico — DB

Modelos que persisten resultados de operaciones externas deben tener `idempotency_key`:

```python
class PaymentRequest(models.Model):   # ejemplo de contrato (modelo eliminado — ver Nota de estado)
    idempotency_key = models.CharField(
        max_length=36, unique=True, db_index=True,
        help_text="UUID enviado al proveedor; previene cobros duplicados",
    )
    # ... resto del modelo
```

**Reglas DB:**
- Campo siempre llamado `idempotency_key`. Otro nombre = revisar PR.
- `unique=True` no negociable.
- El valor se pasa al provider externo en su propio campo de idempotencia (Transbank, Webpay, Stripe, etc. todos lo soportan).
- Si el provider rechaza por key duplicado: el endpoint local debe fetch del estado real y devolverlo, no fallar al cliente.

---

## Patrón canónico — Celery

Tareas que crean registros fiscalmente sensibles validan idempotencia al inicio:

```python
# backend/billing/tasks.py
@shared_task(bind=True, max_retries=3)
def generate_invoice_pdf_and_send(self, invoice_id: int, idempotency_key: str):
    # Lookup primero — si ya se procesó este key, abortar
    if IdempotencyRecord.objects.filter(
        key=idempotency_key, scope="billing.invoice.pdf_send", status="done"
    ).exists():
        return {"skipped": True, "reason": "already_processed"}

    # Reservar el record en "pending" — segundo trabajador competing pierde la carrera
    rec, created = IdempotencyRecord.objects.get_or_create(
        key=idempotency_key, scope="billing.invoice.pdf_send",
        defaults={"status": "pending", "user_id": None, "body_hash": ""},
    )
    if not created and rec.status == "pending":
        # Otro worker está procesando; reintento más tarde
        raise self.retry(countdown=10)

    try:
        # ... trabajo real
        rec.status = "done"; rec.save(update_fields=["status"])
    except Exception:
        rec.status = "error"; rec.save(update_fields=["status"])
        raise
```

**Reglas Celery:**
- El `idempotency_key` se pasa **explícitamente** como argumento de la tarea. **Nunca** se genera dentro de la tarea — eso anula su propósito.
- Si el endpoint HTTP que dispara la tarea ya es idempotente, **reusa el mismo key** al enqueuar (`task.delay(invoice_id, idempotency_key=request.headers["Idempotency-Key"])`).
- El reintento de Celery (`max_retries`) es ortogonal: la tarea reintentándose con el mismo key es exactamente el caso que el lookup-then-insert resuelve.

---

## Lo que NO requiere idempotencia (deliberadamente)

- `GET` y `HEAD` — son idempotentes por HTTP spec; no necesitan header.
- `PUT` / `DELETE` REST estándar — el server espera mismo resultado en re-ejecución; el modelo de datos lo garantiza por PK.
- Endpoints de búsqueda, filtros, listado, paginación.
- `POST` que solo crea drafts/borradores (POSDraft, autosave): si se crean dos por error, el cleanup TTL los purga.
- Mutaciones de UI sin efecto fiscal: `archive`, `restore`, `lock`, `unlock`, `like`, `tag`.

Si dudás de si tu endpoint debe estar en la lista cerrada: pregunta “¿una doble ejecución produce un costo monetario, fiscal, legal o externo no reversible?” Si sí → idempotente. Si no → no.

---

## Tests

| Capa | Test mínimo |
|------|-------------|
| HTTP | (a) primera llamada → 201; (b) repetir con mismo key + body → mismo response 201 cacheado; (c) mismo key + body distinto → 409; (d) sin header → 400 |
| Celery | (a) tarea con key nuevo → procesa; (b) re-encolar misma tarea misma key → skip |
| DB | unique constraint violation lanza `IntegrityError` esperado |

---

## Checklist para agregar un endpoint/tarea idempotente

- [ ] Agregar entrada a la “lista cerrada” arriba (vía PR + ADR si es polémico).
- [ ] Frontend: generar UUIDv4 en el handler origen + reenviar en retries.
- [ ] Backend: decorar con `@idempotent_endpoint(scope=...)`.
- [ ] Si dispara Celery: pasar el key como argumento de la tarea.
- [ ] Tests de las 4 condiciones HTTP + (si aplica) re-encolado Celery.
- [ ] Documentar el `scope` único en este doc.

## Scopes registrados (reconciliado 2026-08-04 — source: `grep -rn "idempotent_endpoint(scope=" backend`)

| Scope | Endpoint |
|-------|----------|
| `billing.invoice.create` | `POST /api/billing/invoices/` |
| `billing.pos.checkout` | `POST /api/billing/invoices/pos_checkout/` |
| `sales.order.create` | `POST /api/sales/orders/` |
| `sales.order.confirm` | `POST /api/sales/orders/{id}/confirm/` |
| `sales.order.dispatch` | `POST /api/sales/orders/{id}/dispatch/` |
| `purchasing.order.confirm` | `POST /api/purchasing/orders/{id}/confirm/` |
| `purchasing.order.receive` | `POST /api/purchasing/orders/{id}/partial_receive/` |
| `purchasing.order.checkout` | `POST /api/purchasing/orders/purchase_checkout/` |
| `production.order.create` | `POST /api/production/orders/` |
| `production.order.bulk_transition` | `POST /api/production/orders/bulk_transition/` |
| `accounting.entry.create` | `POST /api/accounting/entries/` |
| `hr.payroll.draft` | `POST /api/hr/payrolls/create_draft_payrolls/` |
| `tax.period.close` (x2) | `POST /api/tax/periods/{id}/close/` + `POST /api/tax/accounting-periods/{id}/close/` |
| `tax.f29.register` | `POST /api/tax/declarations/{id}/register/` |
| `treasury.movement.create` | `POST /api/treasury/movements/` (y `/payments/`) |
| `treasury.movement.register` | `POST /api/treasury/movements/register_movement/` (y `/payments/`) |
| `treasury.card.purchase` | `POST /api/treasury/movements/card-purchase/` (y `/payments/`) |
| `treasury.allocation.create` | `POST /api/treasury/movements/{id}/allocate/` |
| `treasury.reconciliation.match` | `POST /api/treasury/statement-lines/match_group/` |
| `treasury.transfer.register` | `POST /api/treasury/dashboard/register_transfer/` |

## Referencias

- Patrón usado en imports: [import-csv-xlsx.md](import-csv-xlsx.md)
- Background tasks: [../30-playbooks/add-background-task.md](../30-playbooks/add-background-task.md)

> **Nota de estado (reconciliada 2026-08-04):** el mecanismo HTTP completo EXISTE y está en producción — decorador en `backend/core/idempotency.py` + `IdempotencyRecord` en `backend/core/models/idempotency.py` + 20 scopes activos (tabla de arriba) + tests en `backend/core/tests/test_idempotency.py`. Huecos reales:
>
> 1. **Ningún modelo de negocio tiene el campo `idempotency_key`** todavía (capa DB inaplicada). El modelo `PaymentRequest` que la migración `0010` iba a introducir fue eliminado en `0017_remove_paymentrequest.py`. Candidatos cuando se implemente: `Invoice`, `TreasuryMovement`, `JournalEntry`.
> 2. **El patrón Celery del §"Patrón canónico — Celery" es aspiracional**: ninguna tarea Celery usa `IdempotencyRecord` todavía; solo los endpoints HTTP están decorados.
> 3. **El purge task (`core.tasks.purge_idempotency_records`, TTL 24h) está agendado** a diario (02:30 AM) en `CELERY_BEAT_SCHEDULE` desde 2026-08-04 (`purge_idempotency_records_daily`) — hueco operativo cerrado.
