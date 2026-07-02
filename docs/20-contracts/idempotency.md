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

| Método | Endpoint | Por qué |
|--------|----------|---------|
| `POST` | `/api/billing/invoices/` | Emitir factura asigna folio fiscal — no reversible |
| `POST` | `/api/billing/invoices/pos_checkout/` | Checkout POS — crea orden + factura + pago en una transacción |
| `POST` | `/api/billing/invoices/{id}/issue/` | Envío a SII — el provider no acepta retries naive |
| `POST` | `/api/billing/credit-notes/` | Idem invoice |
| `POST` | `/api/accounting/entries/` | Asiento manual — descuadra libros si duplica |
| `POST` | `/api/treasury/payment-requests/` | Cobro al provider (idempotency_key reenviado al provider) |
| `POST` | `/api/treasury/movements/` | Movimiento bancario manual |
| `POST` | `/api/treasury/payments/register_movement/` | Registro rápido de pago/cobro desde formularios de órdenes y tesorería |
| `POST` | `/api/treasury/reconciliations/{id}/run/` | Ejecución de matching automático — costosa, evita reruns |
| `POST` | `/api/purchasing/orders/purchase_checkout/` | Checkout de compra — crea/confirma orden + factura + pago + recepción en una transacción |
| `POST` | `/api/{module}/import/commit/` | Importación bulk — ver [import-csv-xlsx.md](import-csv-xlsx.md) |

**Convención del header:** el cliente genera **UUIDv4** al crear la intención de acción (click del botón). Reenvío del header con el mismo valor en retries. Una nueva acción del usuario genera nuevo UUID.

**TTL del registro:** 24 horas. Después se purga (un mismo key reused después de 24h se trata como nuevo).

---

## Patrón canónico — HTTP

### Frontend (genera el key)

```ts
// features/billing/hooks/useCreateInvoice.ts
import { v4 as uuid } from "uuid";

export function useCreateInvoice() {
  return useMutation({
    mutationFn: async (payload: CreateInvoicePayload) => {
      const idempotencyKey = uuid();
      return apiPost("/api/billing/invoices/", payload, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
    },
    // axios retry plugin debe reenviar el mismo key
  });
}
```

**Reglas frontend:**
- El UUID se genera en el handler que origina la acción (click), **no** dentro del mutation function de TanStack (que puede ser invocado N veces).
- Si la mutation se retry con el mismo `variables`, el `Idempotency-Key` debe ser el mismo. Esto se logra anteponiendo el UUID a `variables`.
- Para formularios largos: el UUID se persiste en el form state hasta éxito; al re-submit del mismo form genera nuevo UUID solo si el usuario navegó y volvió.

### Backend (decorador + tabla)

```python
# backend/core/idempotency.py
from functools import wraps
from rest_framework.response import Response
from django.db import transaction
from .models import IdempotencyRecord

def idempotent_endpoint(scope: str):
    """
    Wraps a DRF view method. Requires Idempotency-Key header.
    Same key + same scope returns the cached response within 24h.
    Different body for same key returns 409 Conflict.
    """
    def deco(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            key = request.headers.get("Idempotency-Key")
            if not key:
                return Response({"detail": "Idempotency-Key header required"}, status=400)
            body_hash = sha256(request.body).hexdigest()

            with transaction.atomic():
                record, created = IdempotencyRecord.objects.select_for_update().get_or_create(
                    key=key, scope=scope,
                    defaults={"body_hash": body_hash, "user": request.user, "status": "pending"},
                )
                if not created:
                    if record.body_hash != body_hash:
                        return Response({"detail": "Idempotency-Key reused with different body"}, status=409)
                    if record.status == "done":
                        return Response(record.response_payload, status=record.response_status)
                    if record.status == "pending":
                        return Response({"detail": "In progress, retry shortly"}, status=425)  # Too Early

                response = view_func(self, request, *args, **kwargs)
                record.response_status = response.status_code
                record.response_payload = response.data
                record.status = "done"
                record.save(update_fields=["response_status", "response_payload", "status"])
                return response
        return wrapper
    return deco
```

```python
# backend/sales/views.py (uso)
class InvoiceViewSet(ModelViewSet):
    @idempotent_endpoint(scope="billing.invoice.create")
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
```

### Modelo IdempotencyRecord

```python
class IdempotencyRecord(models.Model):
    key          = models.CharField(max_length=64)
    scope        = models.CharField(max_length=128)
    user         = models.ForeignKey("core.User", on_delete=models.PROTECT)
    body_hash    = models.CharField(max_length=64)
    response_status   = models.IntegerField(null=True)
    response_payload  = models.JSONField(null=True)
    status       = models.CharField(max_length=16, choices=[("pending","pending"),("done","done"),("error","error")])
    created_at   = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = [("key", "scope")]
        indexes = [models.Index(fields=["created_at"])]  # para purge diario
```

Cleanup vía Celery beat diario: borra registros >24h.

---

## Patrón canónico — DB

Modelos que persisten resultados de operaciones externas deben tener `idempotency_key`:

```python
class PaymentRequest(models.Model):
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

## Scopes registrados

| Scope | Endpoint |
|-------|----------|
| `billing.invoice.create` | `POST /api/billing/invoices/` |
| `billing.invoice.pos_checkout` | `POST /api/billing/invoices/pos_checkout/` |
| `billing.invoice.issue` | `POST /api/billing/invoices/{id}/issue/` |
| `billing.creditnote.create` | `POST /api/billing/credit-notes/` |
| `accounting.entry.create` | `POST /api/accounting/entries/` |
| `treasury.paymentrequest.create` | `POST /api/treasury/payment-requests/` |
| `treasury.movement.create` | `POST /api/treasury/movements/` |
| `treasury.payment.register_movement` | `POST /api/treasury/payments/register_movement/` |
| `treasury.reconciliation.run` | `POST /api/treasury/reconciliations/{id}/run/` |
| `purchasing.order.checkout` | `POST /api/purchasing/orders/purchase_checkout/` |
| `{module}.import.commit` | `POST /api/{module}/import/commit/` |

## Referencias

- Patrón usado en imports: [import-csv-xlsx.md](import-csv-xlsx.md)
- Background tasks: [../30-playbooks/add-background-task.md](../30-playbooks/add-background-task.md)

> **Nota de estado:** al 2026-05-21 ningún modelo del codebase tiene aún el campo `idempotency_key`. La migración inicial estuvo en `treasury/PaymentRequest` (migration `0010`), pero el modelo fue eliminado en `0017_remove_paymentrequest.py`. Cuando se agregue el primer modelo bajo este contrato (candidatos: `Invoice`, `TreasuryMovement`, `JournalEntry`), crear primero `backend/core/models.py::IdempotencyRecord` + `backend/core/idempotency.py` (decorador) y luego conectar.
