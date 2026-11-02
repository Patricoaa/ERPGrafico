# POS Credit Approval — Opción Barata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una aprobación de crédito POS sobreviva al cierre de sesión/borrador, sin crear un modelo nuevo.

**Architecture:** Se añade un campo `has_pending_approval` a `DraftCart`; los tres caminos de eliminación de borradores (cierre de sesión, limpieza periódica, borrado manual) lo respetan; el checkout limpia el flag antes de borrar; el rechazo de la tarea también lo limpia. Un hash del carrito en `task.data` detecta modificaciones post-aprobación. La creación de la tarea se vuelve idempotente por `draft_id`. El anti-replay en el checkout añade `select_for_update()`.

**Tech Stack:** Django 5, DRF, Celery, PostgreSQL, Next.js/TypeScript

**Spec:** Este plan implementa la "opción barata" descrita en `/home/pato/.claude/plans/podr-as-juzgar-este-plan-cozy-wadler.md` (revisión de 2026-11-02).

## Global Constraints

- Cero `any` en TypeScript — usar tipos Zod o `unknown` + type guard
- No raw Tailwind colors — semantic tokens only
- Views ≤ 20 líneas — lógica de negocio en `services.py`
- No `useQuery`/`useMutation` directo en componentes — wrappear en feature hook
- Tests locales: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest` desde `backend/`

## Review Focus

1. **Draft con `has_pending_approval=True` y sesión cerrada:** el draft debe sobrevivir incluso si se llama `cleanup_on_session_close`; el test lo verifica.
2. **Load cross-sesión:** `load_draft(draft_id, other_session_id)` debe retornar el draft si `has_pending_approval=True`; fallar si `False`.
3. **Checkout concurrente:** dos checkouts simultáneos con el mismo `credit_approval_task_id`; solo uno debe completarse (el segundo debe recibir ValidationError de "ya utilizada").
4. **Hash mismatch:** si el usuario modifica el draft después de la aprobación, el checkout debe rechazarlo con el error de snapshot.
5. **Doble clic en "Solicitar Crédito":** dos llamadas rápidas con el mismo `draft_id` deben retornar el mismo `task_id` (idempotencia).

---

## Archivos

| Archivo | Acción |
|---------|--------|
| `backend/sales/models.py` | Modificar — añadir campo `has_pending_approval` a `DraftCart` |
| `backend/sales/migrations/0020_draftcart_has_pending_approval.py` | Crear — migración |
| `backend/sales/draft_cart_service.py` | Modificar — `load_draft`, `delete_draft`, `cleanup_on_session_close`, `cleanup_old_drafts`, `save_draft` |
| `backend/billing/services.py` | Modificar — `request_credit_approval` (idempotencia, marcar draft, hash, dedup), `_pos_checkout_internal` (select_for_update, verificar hash, limpiar flag) |
| `backend/workflow/services.py` | Modificar — `handle_task_update` (limpiar flag al rechazar) |
| `backend/sales/tests/test_draft_cart_pending_approval.py` | Crear — tests Tarea 1 |
| `backend/billing/tests/test_credit_approval_durable.py` | Crear — tests Tareas 2 y 3 |

---

### Task 1: Campo `has_pending_approval` y protección de servicio

**Files:**
- Modify: `backend/sales/models.py` (DraftCart, ~línea 920)
- Create: `backend/sales/migrations/0020_draftcart_has_pending_approval.py`
- Modify: `backend/sales/draft_cart_service.py:375-422`
- Test: `backend/sales/tests/test_draft_cart_pending_approval.py`

**Interfaces:**
- Produce: `DraftCart.has_pending_approval: bool` (default `False`)
- Produce: `DraftCartService.load_draft(draft_id, pos_session_id)` → retorna draft aunque sea de otra sesión si `has_pending_approval=True`
- Produce: `DraftCartService.delete_draft` → retorna `False` sin eliminar si `has_pending_approval=True`
- Produce: `DraftCartService.cleanup_on_session_close` → omite drafts con `has_pending_approval=True`
- Produce: `DraftCartService.cleanup_old_drafts` → omite drafts con `has_pending_approval=True`
- Produce: `DraftCartService.save_draft` → lanza `ValidationError("Borrador con aprobación pendiente no puede ser modificado.")` si `has_pending_approval=True`

- [ ] **Step 1: Escribir tests que fallan**

```python
# backend/sales/tests/test_draft_cart_pending_approval.py
import pytest
from sales.models import DraftCart
from sales.draft_cart_service import DraftCartService
from rest_framework.exceptions import ValidationError

@pytest.fixture
def draft_with_pending(pos_session, user):
    return DraftCart.objects.create(
        pos_session=pos_session, created_by=user,
        items=[], has_pending_approval=True,
    )

@pytest.fixture
def draft_normal(pos_session, user):
    return DraftCart.objects.create(
        pos_session=pos_session, created_by=user,
        items=[], has_pending_approval=False,
    )

def test_cleanup_on_session_close_skips_pending(draft_with_pending, draft_normal, pos_session):
    deleted = DraftCartService.cleanup_on_session_close(pos_session.id)
    assert deleted == 1
    assert DraftCart.objects.filter(id=draft_with_pending.id).exists()
    assert not DraftCart.objects.filter(id=draft_normal.id).exists()

def test_cleanup_old_drafts_skips_pending(draft_with_pending, draft_normal, db, freezer):
    freezer.move_to("2 days later")
    deleted = DraftCartService.cleanup_old_drafts(days=1)
    assert deleted == 1
    assert DraftCart.objects.filter(id=draft_with_pending.id).exists()

def test_delete_draft_refuses_pending(draft_with_pending, pos_session):
    result = DraftCartService.delete_draft(draft_with_pending.id, pos_session.id)
    assert result is False
    assert DraftCart.objects.filter(id=draft_with_pending.id).exists()

def test_load_draft_cross_session(draft_with_pending):
    loaded = DraftCartService.load_draft(draft_with_pending.id, pos_session_id=9999)
    assert loaded is not None
    assert loaded.id == draft_with_pending.id

def test_load_draft_normal_requires_session(draft_normal, pos_session):
    assert DraftCartService.load_draft(draft_normal.id, pos_session_id=9999) is None
    assert DraftCartService.load_draft(draft_normal.id, pos_session_id=pos_session.id) is not None

def test_save_draft_refuses_modification_when_pending(draft_with_pending, pos_session, user):
    with pytest.raises(ValidationError, match="aprobación pendiente"):
        DraftCartService.save_draft(
            pos_session_id=pos_session.id, user=user,
            items=[{"product": 1, "qty": 2}], customer_id=None,
            name="", notes="", wizard_state=None,
            total_discount_amount=0, draft_id=draft_with_pending.id, session_key="",
        )
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest sales/tests/test_draft_cart_pending_approval.py -v 2>&1 | head -30
```
Resultado esperado: `AttributeError: type object 'DraftCart' has no attribute 'has_pending_approval'`

- [ ] **Step 3: Añadir campo `has_pending_approval` a `DraftCart` en `backend/sales/models.py`**

Añadir después del campo `session_local_id` (~línea 930):
```python
has_pending_approval = models.BooleanField(
    _("Tiene Aprobación Pendiente"),
    default=False,
    help_text="Protege el borrador de ser eliminado mientras una aprobación esté en curso.",
)
```

- [ ] **Step 4: Crear migración**

```bash
cd backend && python manage.py makemigrations sales --name draftcart_has_pending_approval
```
Verificar que crea `0020_draftcart_has_pending_approval.py`.

- [ ] **Step 5: Modificar `DraftCartService.load_draft` en `backend/sales/draft_cart_service.py:375`**

Nueva implementación:
```python
@staticmethod
def load_draft(draft_id: int, pos_session_id: int) -> Optional[DraftCart]:
    try:
        draft = DraftCart.objects.get(id=draft_id)
    except DraftCart.DoesNotExist:
        return None
    if draft.has_pending_approval or draft.pos_session_id == pos_session_id:
        return draft
    return None
```

- [ ] **Step 6: Modificar `delete_draft` en `backend/sales/draft_cart_service.py:396`**

```python
@staticmethod
def delete_draft(draft_id: int, pos_session_id: int) -> bool:
    try:
        draft = DraftCart.objects.get(id=draft_id, pos_session_id=pos_session_id)
    except DraftCart.DoesNotExist:
        return False
    if draft.has_pending_approval:
        return False
    draft.delete()
    return True
```

- [ ] **Step 7: Modificar `cleanup_on_session_close` en `backend/sales/draft_cart_service.py:408`**

```python
@staticmethod
def cleanup_on_session_close(session_id: int) -> int:
    deleted_count, _ = DraftCart.objects.filter(
        pos_session_id=session_id, has_pending_approval=False
    ).delete()
    return deleted_count
```

- [ ] **Step 8: Modificar `cleanup_old_drafts` en `backend/sales/draft_cart_service.py:416`**

```python
@staticmethod
def cleanup_old_drafts(days: int = 1) -> int:
    cutoff_date = timezone.now() - timedelta(days=days)
    deleted_count, _ = DraftCart.objects.filter(
        updated_at__lt=cutoff_date, has_pending_approval=False
    ).delete()
    return deleted_count
```

- [ ] **Step 9: Modificar `save_draft` en `backend/sales/draft_cart_service.py`**

Al inicio del método, antes de cualquier escritura, añadir:
```python
if draft_id:
    try:
        existing = DraftCart.objects.get(id=draft_id)
        if existing.has_pending_approval:
            raise ValidationError("Borrador con aprobación pendiente no puede ser modificado.")
    except DraftCart.DoesNotExist:
        pass
```

- [ ] **Step 10: Ejecutar tests y verificar que pasan**

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest sales/tests/test_draft_cart_pending_approval.py -v
```
Resultado esperado: todos PASSED.

- [ ] **Step 11: Verificar que los tests existentes de drafts siguen pasando**

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest sales/tests/ -v -x 2>&1 | tail -20
```

- [ ] **Step 12: Commit**

```bash
git add backend/sales/models.py backend/sales/migrations/0020_draftcart_has_pending_approval.py backend/sales/draft_cart_service.py backend/sales/tests/test_draft_cart_pending_approval.py
git commit -m "feat(pos): protect DraftCart from deletion when has_pending_approval

- Add has_pending_approval BooleanField to DraftCart (default=False)
- cleanup_on_session_close/cleanup_old_drafts/delete_draft skip protected drafts
- load_draft allows cross-session access for pending-approval drafts
- save_draft raises ValidationError if draft has pending approval

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Idempotencia + marcar draft + hash en `request_credit_approval`

**Files:**
- Modify: `backend/billing/services.py:237-345` (`request_credit_approval`)
- Test: `backend/billing/tests/test_credit_approval_durable.py`

**Interfaces:**
- Consume: `DraftCart.has_pending_approval` (Task 1)
- Produce: `request_credit_approval` devuelve tarea existente si ya existe una PENDING para el mismo `draft_id`
- Produce: `task.data["cart_snapshot_hash"]` — sha256 del carrito canónico
- Produce: `task.data["draft_id"]` — int (o None) extraído de `full_request_data`

- [ ] **Step 1: Añadir helper `_compute_cart_snapshot_hash` en `backend/billing/services.py`**

Añadir como función de módulo (fuera de la clase), cerca del inicio de `billing/services.py`:
```python
import hashlib, json as _json

def _compute_cart_snapshot_hash(customer_id, lines) -> str:
    """Hash determinista del carrito para detectar modificaciones post-aprobación."""
    canonical = sorted(
        [
            {
                "product_id": l.get("product") or l.get("product_id"),
                "qty": str(Decimal(str(l.get("quantity", l.get("qty", 0))))),
                "price": str(Decimal(str(l.get("unit_price_gross", l.get("unit_price", 0))))),
            }
            for l in lines
        ],
        key=lambda x: (str(x["product_id"]), x["qty"], x["price"]),
    )
    payload = _json.dumps({"customer_id": customer_id, "lines": canonical}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()
```

- [ ] **Step 2: Escribir tests que fallan**

```python
# backend/billing/tests/test_credit_approval_durable.py
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from billing.services import BillingService, _compute_cart_snapshot_hash
from sales.models import DraftCart
from workflow.models import Task

User = get_user_model()

ORDER_DATA = {
    "customer": 1,
    "lines": [{"product": 10, "quantity": 2, "unit_price_gross": "500.00"}],
}

def test_idempotency_returns_existing_task(pos_session, user, customer, draft):
    """Doble clic: segunda llamada con el mismo draft_id devuelve la misma tarea."""
    req_data = {"draft_id": draft.id, "order_data": ORDER_DATA}
    task1 = BillingService.request_credit_approval(
        order_data=ORDER_DATA, amount=0, payment_method="CREDIT",
        full_request_data=req_data, requesting_user=user,
    )
    task2 = BillingService.request_credit_approval(
        order_data=ORDER_DATA, amount=0, payment_method="CREDIT",
        full_request_data=req_data, requesting_user=user,
    )
    assert task1.id == task2.id
    assert Task.objects.filter(task_type="CREDIT_POS_REQUEST", status=Task.Status.PENDING).count() == 1

def test_marks_draft_has_pending_approval(pos_session, user, customer, draft):
    req_data = {"draft_id": draft.id, "order_data": ORDER_DATA}
    BillingService.request_credit_approval(
        order_data=ORDER_DATA, amount=0, payment_method="CREDIT",
        full_request_data=req_data, requesting_user=user,
    )
    draft.refresh_from_db()
    assert draft.has_pending_approval is True

def test_stores_cart_snapshot_hash(pos_session, user, customer, draft):
    req_data = {"draft_id": draft.id, "order_data": ORDER_DATA}
    task = BillingService.request_credit_approval(
        order_data=ORDER_DATA, amount=0, payment_method="CREDIT",
        full_request_data=req_data, requesting_user=user,
    )
    assert "cart_snapshot_hash" in task.data
    expected = _compute_cart_snapshot_hash(
        customer_id=1, lines=ORDER_DATA["lines"]
    )
    assert task.data["cart_snapshot_hash"] == expected

def test_stores_draft_id_in_task_data(pos_session, user, customer, draft):
    req_data = {"draft_id": draft.id, "order_data": ORDER_DATA}
    task = BillingService.request_credit_approval(
        order_data=ORDER_DATA, amount=0, payment_method="CREDIT",
        full_request_data=req_data, requesting_user=user,
    )
    assert task.data["draft_id"] == draft.id
```

- [ ] **Step 3: Ejecutar tests para verificar que fallan**

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest billing/tests/test_credit_approval_durable.py -v 2>&1 | head -30
```

- [ ] **Step 4: Refactorizar `request_credit_approval` en `backend/billing/services.py:237`**

Los cambios son:
1. **Eliminar el bloque duplicado** de `pos_credit` (líneas ~314-321, el segundo cálculo idéntico al de ~287-296).
2. **Idempotencia por `draft_id`**: antes de crear la tarea, buscar si existe una PENDING con `data__draft_id == draft_id`.
3. **Marcar draft**: si `draft_id` está en `full_request_data` y el draft existe, hacer `has_pending_approval = True`.
4. **Almacenar hash**: añadir `cart_snapshot_hash` y `draft_id` al `data` del task.

Lógica (no el código completo, solo los bloques que cambian):

```python
# 1. Extraer draft_id de la request
draft_id = full_request_data.get("draft_id")
if isinstance(draft_id, str):
    try:
        draft_id = int(draft_id)
    except (ValueError, TypeError):
        draft_id = None

# 2. Idempotencia: retornar tarea existente si mismo draft_id
if draft_id:
    from workflow.models import Task as _Task
    existing = _Task.objects.filter(
        task_type="CREDIT_POS_REQUEST",
        status__in=[_Task.Status.PENDING, _Task.Status.IN_PROGRESS],
        data__draft_id=draft_id,
    ).first()
    if existing:
        return existing

# 3. Calcular hash del carrito (usar lines de order_data)
lines_for_hash = order_data.get("lines", []) if isinstance(order_data, dict) else []
cart_snapshot_hash = _compute_cart_snapshot_hash(
    customer_id=customer.id, lines=lines_for_hash
)

# 4. Marcar el draft como protegido
if draft_id:
    from sales.models import DraftCart as _DraftCart
    _DraftCart.objects.filter(id=draft_id).update(has_pending_approval=True)

# 5. Crear tarea incluyendo hash y draft_id en data
task = WorkflowService.create_task(
    ...,
    data={
        ...,  # campos actuales
        "cart_snapshot_hash": cart_snapshot_hash,
        "draft_id": draft_id,
    },
)
```

> El bloque duplicado de `acc_settings`/`pos_credit` (líneas ~314-321) se elimina completamente; el primero (~287-296) se conserva.

- [ ] **Step 5: Ejecutar tests y verificar que pasan**

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest billing/tests/test_credit_approval_durable.py -v
```

- [ ] **Step 6: Verificar tests de billing existentes**

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest billing/tests/ -v -x 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add backend/billing/services.py backend/billing/tests/test_credit_approval_durable.py
git commit -m "feat(billing): idempotency + draft protection + snapshot hash in request_credit_approval

- Return existing PENDING task if same draft_id already in flight (idempotency)
- Set DraftCart.has_pending_approval=True when request is created
- Store cart_snapshot_hash and draft_id in task.data
- Remove duplicate pos_credit block (was computed twice, lines ~314-321)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Anti-replay atómico + verificación de hash + limpiar flag al completar/rechazar

**Files:**
- Modify: `backend/billing/services.py` (sección checkout, ~línea 932-975 y ~línea 1412-1440)
- Modify: `backend/workflow/services.py:132-154` (`handle_task_update`)
- Test: `backend/billing/tests/test_credit_approval_durable.py` (añadir tests)

**Interfaces:**
- Consume: `DraftCart.has_pending_approval` (Task 1)
- Consume: `task.data["cart_snapshot_hash"]` y `task.data["draft_id"]` (Task 2)

- [ ] **Step 1: Añadir tests al archivo existente**

```python
# Añadir a backend/billing/tests/test_credit_approval_durable.py

def test_checkout_select_for_update_prevents_double_use(pos_session, user, customer, draft, approved_task):
    """Dos checkouts concurrentes no pueden consumir la misma aprobación."""
    # Este test verifica que el lock EXISTS en el query — no podemos simular concurrencia
    # real en pytest, pero sí verificamos que consumed_by_invoice_id bloquea el segundo
    from billing.services import BillingService
    from rest_framework.exceptions import ValidationError

    # Primer checkout marca consumed
    approved_task.data["consumed_by_invoice_id"] = 999
    approved_task.save(update_fields=["data"])

    with pytest.raises(ValidationError, match="ya fue utilizada"):
        BillingService._pos_checkout_internal(
            order_data=...,
            credit_approval_task_id=approved_task.id,
            ...
        )

def test_checkout_rejects_modified_cart(pos_session, user, customer, draft, approved_task):
    """Si el carrito fue modificado post-aprobación, el checkout debe fallar."""
    from billing.services import BillingService
    from rest_framework.exceptions import ValidationError

    # Simular carrito diferente al aprobado
    modified_order_data = {
        "id": draft.id,
        "lines": [{"product": 10, "quantity": 99, "unit_price_gross": "500.00"}],  # qty diferente
        ...
    }
    with pytest.raises(ValidationError, match="carrito ha cambiado"):
        BillingService._pos_checkout_internal(
            order_data=modified_order_data,
            credit_approval_task_id=approved_task.id,
            ...
        )

def test_rejected_task_clears_draft_flag(draft_with_pending_approval, credit_task):
    """Al rechazar la tarea, el draft queda sin protección."""
    from workflow.services import WorkflowService
    from workflow.models import Task

    old_status = Task.Status.PENDING
    credit_task.status = Task.Status.REJECTED
    credit_task.save()
    WorkflowService.handle_task_update(credit_task, old_status)

    draft_with_pending_approval.refresh_from_db()
    assert draft_with_pending_approval.has_pending_approval is False
```

- [ ] **Step 2: Ejecutar para confirmar que fallan**

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest billing/tests/test_credit_approval_durable.py::test_checkout_rejects_modified_cart billing/tests/test_credit_approval_durable.py::test_rejected_task_clears_draft_flag -v 2>&1 | head -20
```

- [ ] **Step 3: Añadir `select_for_update()` al checkout en `backend/billing/services.py:939`**

Cambiar:
```python
task = Task.objects.get(id=credit_approval_task_id, task_type="CREDIT_POS_REQUEST")
```
Por:
```python
task = Task.objects.select_for_update().get(id=credit_approval_task_id, task_type="CREDIT_POS_REQUEST")
```

- [ ] **Step 4: Añadir verificación del hash del carrito en el checkout, después del check de cliente (línea ~959)**

Insertar después de la verificación de `required_credit > approved_credit`:
```python
# 3. Verificar snapshot del carrito (anti-modificación post-aprobación)
approved_hash = task_data.get("cart_snapshot_hash")
if approved_hash:
    current_lines = order_data.get("lines", []) if isinstance(order_data, dict) else []
    if "id" not in order_data:  # carrito sin SaleOrder previo
        current_hash = _compute_cart_snapshot_hash(
            customer_id=order.customer_id, lines=current_lines
        )
        if current_hash != approved_hash:
            raise ValidationError(
                "El carrito ha cambiado desde que se solicitó la aprobación. "
                "Solicite una nueva aprobación de crédito."
            )
```

- [ ] **Step 5: Limpiar `has_pending_approval` antes de borrar el draft en el checkout (~línea 1412)**

En la sección "Atomic Draft Removal", antes del `DraftCart.objects.filter(id=draft_id).delete()`:
```python
if draft_id:
    DraftCart.objects.filter(id=draft_id).update(has_pending_approval=False)
```
(La línea de `delete()` existente permanece igual después.)

- [ ] **Step 6: Modificar `handle_task_update` en `backend/workflow/services.py:132`**

En la rama `elif task.status == Task.Status.REJECTED ...` (y al inicio también para `CANCELLED`), añadir limpieza del flag:

```python
elif task.status in [Task.Status.REJECTED, Task.Status.CANCELLED] and task.task_type == "CREDIT_POS_REQUEST":
    # Limpiar protección del borrador para que sea elegible a eliminación
    draft_id = task.data.get("draft_id") if task.data else None
    if draft_id:
        try:
            from sales.models import DraftCart
            DraftCart.objects.filter(id=draft_id).update(has_pending_approval=False)
        except Exception:
            pass  # No crítico — el borrador quedará protegido hasta limpieza manual
    # Notificación existente (conservar)
    if task.category == Task.Category.APPROVAL and task.created_by:
        WorkflowService.send_notification(...)
```

> Nota: el bloque de notificación de rechazo existente se conserva; solo se antepone la limpieza del flag.

- [ ] **Step 7: Ejecutar todos los tests de la tarea**

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest billing/tests/test_credit_approval_durable.py workflow/tests/ -v 2>&1 | tail -30
```

- [ ] **Step 8: Ejecutar suite completa de billing y workflow**

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest billing/ workflow/ sales/ -x 2>&1 | tail -20
```

- [ ] **Step 9: Commit**

```bash
git add backend/billing/services.py backend/workflow/services.py backend/billing/tests/test_credit_approval_durable.py
git commit -m "fix(billing): atomic anti-replay, snapshot hash check, clear pending flag on done/reject

- select_for_update() on Task in checkout prevents concurrent double-use
- Verify cart_snapshot_hash on checkout; reject if cart modified post-approval
- Clear DraftCart.has_pending_approval before draft deletion on checkout
- Clear DraftCart.has_pending_approval when task is rejected or cancelled

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Verificación E2E (manual en dev server)

Una vez los tres commits estén en el servidor:

1. Abrir POS → crear carrito con cliente de crédito → llevar al límite → pulsar "Solicitar Crédito"
2. Verificar en BD: `DraftCart.has_pending_approval=True` para ese draft
3. Cerrar sesión POS → verificar que el draft **no** desaparece: `DraftCart.objects.filter(id=X).exists()` → True
4. Aprobar la tarea en TaskInbox
5. Abrir POS en nueva sesión → pulsar el link de la notificación (`?draftId=X`)
6. Verificar que el draft se carga aunque sea de otra sesión
7. Completar checkout → verificar que `DraftCart.has_pending_approval` se limpia y el draft se borra
8. Intentar reusar el mismo `credit_approval_task_id` → debe fallar con "ya fue utilizada"

### Regresión mínima

```bash
cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest billing/ workflow/ sales/ -x
```
```bash
cd frontend && npm run type-check && npm run lint
```

---

## Limitación conocida

El FK `DraftCart.pos_session` es `CASCADE` (línea 865 de `sales/models.py`). Si el `POSSession` se **elimina** de la BD (no solo se cierra), el draft se borraría a nivel DB independientemente de `has_pending_approval`. En el flujo actual las sesiones se cierran (cambio de estado) pero no se eliminan, por lo que esto no es un problema inmediato. Si en el futuro se añade eliminación de sesiones, se deberá cambiar a `SET_NULL` y actualizar la lógica de `load_draft` para sesión nula.
