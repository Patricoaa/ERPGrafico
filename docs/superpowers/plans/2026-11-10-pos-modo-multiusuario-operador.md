# POS modo multiusuario y operador identificado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada sesión de caja tiene un modo (`SINGLE` / `MULTI`); en `MULTI` toda transacción inicializadora exige un pase de operador de un solo uso, y la orden de venta conserva quién modificó cada paso.

**Architecture:** Un modelo `POSOperatorPass` (app `treasury`) es a la vez credencial y registro de cada identificación. Un único servicio (`POSOperatorService.resolve_actor`) entrega a los servicios existentes el actor (operador + cuenta del dispositivo); en `SINGLE` devuelve `request.user` sin tocar nada. Una tabla `SaleTrackingEvent` (app `sales`) guarda el último operador por paso del borrador y se traspasa a la orden al cobrar. El frontend usa un único mecanismo de "pedir operador" con un selector táctil y un reintento automático ante el rechazo del backend.

**Tech Stack:** Django 5 + DRF + simplejwt, pytest; Next.js 16, TanStack Query, react-hook-form + Zod, vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-pos-modo-multiusuario-operador-design.md`

## Global Constraints

- `SINGLE` no cambia en nada visible ni en atribución: ningún modal, clic o request extra.
- La exigencia del pase vive en el backend; el frontend solo la anticipa.
- Primera edición sin secreto: el campo `credential` se acepta y se ignora. Ningún texto de UI dice "verificado" ni "autenticado"; se usa "Operador".
- La traza de una orden vendida no depende del borrador ni de la sesión (los borradores se borran en cascada).
- El modo es inmutable tras abrir; se expone solo lectura.
- Invariantes del repo: vistas ≤ 20 líneas por acción y lógica en `services.py`; cero `any`; sin `useQuery`/`useMutation` en componentes; `@/lib/api` solo desde `features/*/api`, `features/*/hooks`, `/hooks`; tokens de color semánticos; formularios con `react-hook-form` + `zodResolver` y schema en `schema.ts`; cero N+1.
- Nombres fijos: encabezados `X-POS-Operator-Pass` y `X-POS-Document-Context`; código de rechazo `pos_operator_required` (HTTP 403).
- Backend tests locales: `cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -v`.
- Frontend tests: Node 24 (`nvm use 24`), `cd frontend && npm run test -- <ruta>`.
- Commits en la rama `feat/pos-modo-multiusuario-operador`, uno por tarea.

## Review Focus

1. **Bloqueo del borrador vencido** (pestaña dormida > 15 s) y luego se guarda: se espera `pos_operator_required`, nunca atribución silenciosa a la cuenta del dispositivo. → Task 5.
2. **Operador desactivado** después de emitido el pase: la operación se rechaza con `pos_operator_required`. → Task 2.
3. **Sesión cerrada con pase vigente**: se obtiene el error actual de sesión cerrada, no un 500, y el pase queda terminado. → Task 4.
4. **Dos pestañas en la misma sesión**: emitir un pase en la pestaña B no invalida el de la pestaña A. → Task 2.
5. **Reintento idempotente del cobro** con el pase ya consumido: devuelve la misma orden, no un rechazo. → Task 6.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/treasury/models.py` | `POSSession.mode`; modelo `POSOperatorPass` |
| `backend/treasury/pos_operator_service.py` (nuevo) | Emitir, validar, consumir y soltar pases; resolver el actor |
| `backend/treasury/selectors.py` | `POSSelector.list_operators()` |
| `backend/treasury/views.py`, `serializers.py` | Acciones `operators`, `identify_operator`, `release_operator`; `mode` solo lectura |
| `backend/treasury/pos_service.py` | Apertura con modo; cierre y movimientos con actor |
| `backend/sales/models.py` | `SaleTrackingEvent` |
| `backend/sales/tracking_service.py` (nuevo) | Registrar pasos del borrador, traspasar a la orden, registrar ediciones |
| `backend/sales/draft_cart_service.py`, `draft_cart_views.py` | Borradores con actor |
| `backend/sales/services.py`, `views.py` | Cobro con actor; acción `tracking` |
| `backend/core/pos_document_context.py` (nuevo) | Autenticador y middleware para ediciones de documentos desde el panel POS |
| `frontend/lib/posOperator.ts` (nuevo) | Registro neutral de encabezados y del manejador de desafío |
| `frontend/features/pos/operator/*` (nuevo) | Estado del pase, hook `useOperatorGate`, `OperatorPickerModal`, `OperatorChip` |
| `frontend/features/pos/components/*` | Modo en apertura; uso del gate en borradores, movimientos, cierre y panel |

---

### Task 1: Modo de sesión (backend)

**Files:**
- Modify: `backend/treasury/models.py` (clase `POSSession`), `backend/treasury/pos_service.py` (`open_session`, `open_session_from_request`), `backend/treasury/serializers.py` (`POSSessionSerializer`)
- Create: `backend/treasury/migrations/0102_possession_mode.py`
- Test: `backend/treasury/tests/test_pos_session_mode.py`

**Interfaces:**
- Produces: `POSSession.Mode.SINGLE = "SINGLE"`, `POSSession.Mode.MULTI = "MULTI"`; campo `POSSession.mode` (default `SINGLE`); `POSService.open_session(..., mode: str = "SINGLE")`; propiedad `POSSession.is_multi_user -> bool`.

- [ ] **Step 1: Tests que fallan** (reutiliza los fixtures `terminal` y `cash_account_fixture` copiándolos de `test_pos_sessions.py`)

```python
def test_open_session_defaults_to_single(user, terminal):
    s = POSService.open_session(user=user, terminal_id=terminal.id, opening_balance=Decimal("0"))
    assert s.mode == "SINGLE" and s.is_multi_user is False

def test_open_session_multi(user, terminal):
    s = POSService.open_session(user=user, terminal_id=terminal.id, opening_balance=Decimal("0"), mode="MULTI")
    assert s.mode == "MULTI" and s.is_multi_user is True

def test_open_session_rejects_unknown_mode(user, terminal):
    with pytest.raises(ValidationError):
        POSService.open_session(user=user, terminal_id=terminal.id, opening_balance=Decimal("0"), mode="X")

def test_mode_is_read_only_in_serializer(session):
    ser = POSSessionSerializer(session, data={"mode": "MULTI"}, partial=True)
    ser.is_valid(raise_exception=True); ser.save()
    session.refresh_from_db()
    assert session.mode == "SINGLE"
```

- [ ] **Step 2:** Ejecutar y confirmar que fallan.
- [ ] **Step 3:** Agregar `Mode`, el campo `mode = CharField(max_length=10, choices=Mode.choices, default=Mode.SINGLE)` y `is_multi_user`; generar la migración con `makemigrations treasury -n possession_mode`; `open_session` valida y guarda `mode`; `open_session_from_request` lee `request.data.get("mode", "SINGLE")`; el serializer declara `mode` en `read_only_fields`.
- [ ] **Step 4:** Ejecutar `treasury/tests/test_pos_session_mode.py` y `treasury/tests/test_pos_sessions.py`: PASS.
- [ ] **Step 5:** Commit `feat(pos): modo de sesión SINGLE/MULTI`.

---

### Task 2: Pase de operador (modelo y servicio)

**Files:**
- Modify: `backend/treasury/models.py`
- Create: `backend/treasury/pos_operator_service.py`, `backend/treasury/migrations/0103_posoperatorpass.py`
- Test: `backend/treasury/tests/test_pos_operator_pass.py`

**Interfaces:**
- Consumes: `POSSession.is_multi_user`.
- Produces:

```python
class POSOperatorPass(models.Model):
    class Purpose(TextChoices): DRAFT, CASH_MOVEMENT, SESSION_CLOSE, DOCUMENT_EDIT
    class EndReason(TextChoices): CONSUMED, SUPERSEDED, RELEASED, EXPIRED
    session       # FK POSSession, PROTECT, related_name="operator_passes"
    operator      # FK User, PROTECT
    device_user   # FK User, PROTECT
    tab_key       # CharField(64)
    purpose       # CharField(20)
    target_type   # CharField(100, blank)  p. ej. "sales.draftcart", "sales.saleorder"
    target_id     # PositiveIntegerField(null)
    token_hash    # CharField(64, unique)  sha256 hex del token
    issued_at     # auto_now_add
    expires_at    # DateTimeField(null)
    ended_at      # DateTimeField(null)
    end_reason    # CharField(12, blank)

@dataclass(frozen=True)
class Actor:
    operator: User          # quien hace la acción
    device_user: User       # request.user
    operator_pass: POSOperatorPass | None   # None en SINGLE

class POSOperatorRequired(APIException):   # status 403, default_code "pos_operator_required"
    def __init__(self, purpose: str): ...   # detail = {"code": "pos_operator_required", "purpose": purpose}

ONE_SHOT_TTL = timedelta(minutes=5)
UNBOUND_DRAFT_TTL = timedelta(minutes=30)
PASS_HEADER = "X-POS-Operator-Pass"

class POSOperatorService:
    @staticmethod
    def verify_identity(operator, credential: dict | None) -> None   # v1: no hace nada; punto de extensión PIN/tarjeta
    @staticmethod
    def identify(*, session, device_user, operator_id: int, tab_key: str, purpose: str,
                 target_type: str = "", target_id: int | None = None,
                 credential: dict | None = None) -> tuple[POSOperatorPass, str]   # (pase, token en claro)
    @staticmethod
    def resolve_actor(*, session, device_user, raw_token: str | None, purpose: str,
                      target_id: int | None = None) -> Actor
    @staticmethod
    def actor_from_request(request, session, purpose: str, target_id: int | None = None) -> Actor
    @staticmethod
    def bind_target(operator_pass, target_type: str, target_id: int) -> None
    @staticmethod
    def end(operator_pass, reason: str) -> None    # idempotente
```

Reglas que el código debe cumplir:
- `identify`: exige sesión `OPEN` y `MULTI` (si no, `ValidationError`); el operador debe estar en `POSSelector.list_operators()` (Task 3 lo entrega; aquí basta `is_active`); termina con `SUPERSEDED` todo pase vigente de la misma `session` + `tab_key`; token `secrets.token_urlsafe(32)`; `expires_at` = `now + ONE_SHOT_TTL` para `CASH_MOVEMENT` y `SESSION_CLOSE`, `now + UNBOUND_DRAFT_TTL` para `DRAFT` sin `target_id`, `None` para `DRAFT` con destino y para `DOCUMENT_EDIT`.
- `resolve_actor`: en `SINGLE` devuelve `Actor(device_user, device_user, None)` sin mirar el token. En `MULTI` lanza `POSOperatorRequired(purpose)` si falta el token, no existe, es de otra sesión, de otro `device_user`, de otro propósito, está terminado, venció (lo marca `EXPIRED`), su operador está inactivo, o `target_id` no coincide con un pase ya ligado.
- `actor_from_request` lee `request.headers.get(PASS_HEADER)` y delega.

- [ ] **Step 1: Tests que fallan**

```python
def test_single_mode_returns_device_user_without_token(single_session, cashier):
    a = POSOperatorService.resolve_actor(session=single_session, device_user=cashier, raw_token=None, purpose="CASH_MOVEMENT")
    assert a.operator == cashier and a.operator_pass is None

def test_multi_requires_pass(multi_session, cashier):
    with pytest.raises(POSOperatorRequired):
        POSOperatorService.resolve_actor(session=multi_session, device_user=cashier, raw_token=None, purpose="CASH_MOVEMENT")

def test_identify_then_resolve(multi_session, cashier, ana):
    p, token = POSOperatorService.identify(session=multi_session, device_user=cashier, operator_id=ana.id, tab_key="t1", purpose="CASH_MOVEMENT")
    a = POSOperatorService.resolve_actor(session=multi_session, device_user=cashier, raw_token=token, purpose="CASH_MOVEMENT")
    assert a.operator == ana and a.device_user == cashier and a.operator_pass == p
    assert p.token_hash != token and len(p.token_hash) == 64

def test_new_pass_supersedes_previous_same_tab(multi_session, cashier, ana, beto):
    _, t1 = POSOperatorService.identify(session=multi_session, device_user=cashier, operator_id=ana.id, tab_key="t1", purpose="CASH_MOVEMENT")
    POSOperatorService.identify(session=multi_session, device_user=cashier, operator_id=beto.id, tab_key="t1", purpose="SESSION_CLOSE")
    with pytest.raises(POSOperatorRequired):
        POSOperatorService.resolve_actor(session=multi_session, device_user=cashier, raw_token=t1, purpose="CASH_MOVEMENT")

def test_other_tab_is_not_superseded(multi_session, cashier, ana, beto):          # Review Focus 4
    _, t1 = POSOperatorService.identify(session=multi_session, device_user=cashier, operator_id=ana.id, tab_key="t1", purpose="CASH_MOVEMENT")
    POSOperatorService.identify(session=multi_session, device_user=cashier, operator_id=beto.id, tab_key="t2", purpose="CASH_MOVEMENT")
    assert POSOperatorService.resolve_actor(session=multi_session, device_user=cashier, raw_token=t1, purpose="CASH_MOVEMENT").operator == ana

@pytest.mark.parametrize("case", ["wrong_purpose", "other_session", "other_device_user", "ended", "expired"])
def test_pass_rejections(case, ...):   # cada caso -> POSOperatorRequired; "expired" deja end_reason == "EXPIRED"

def test_deactivated_operator_is_rejected(multi_session, cashier, ana):           # Review Focus 2
    _, t = POSOperatorService.identify(session=multi_session, device_user=cashier, operator_id=ana.id, tab_key="t1", purpose="CASH_MOVEMENT")
    ana.is_active = False; ana.save()
    with pytest.raises(POSOperatorRequired):
        POSOperatorService.resolve_actor(session=multi_session, device_user=cashier, raw_token=t, purpose="CASH_MOVEMENT")

def test_identify_rejected_on_single_session(single_session, cashier, ana):
    with pytest.raises(ValidationError):
        POSOperatorService.identify(session=single_session, device_user=cashier, operator_id=ana.id, tab_key="t1", purpose="CASH_MOVEMENT")

def test_credential_is_accepted_and_ignored(multi_session, cashier, ana):
    POSOperatorService.identify(session=multi_session, device_user=cashier, operator_id=ana.id, tab_key="t1", purpose="CASH_MOVEMENT", credential={"pin": "1234"})
```

- [ ] **Step 2:** Ejecutar y confirmar que fallan.
- [ ] **Step 3:** Implementar modelo, migración y servicio según Interfaces.
- [ ] **Step 4:** Ejecutar `treasury/tests/test_pos_operator_pass.py`: PASS.
- [ ] **Step 5:** Commit `feat(pos): pase de operador y resolución del actor`.

---

### Task 3: Endpoints de operador

**Files:**
- Modify: `backend/treasury/selectors.py` (`POSSelector`), `backend/treasury/views.py` (`POSSessionViewSet`), `backend/treasury/serializers.py`
- Test: `backend/treasury/tests/test_pos_operator_api.py`

**Interfaces:**
- Consumes: `POSOperatorService.identify`, `.end`.
- Produces:
  - `POSSelector.list_operators() -> QuerySet[User]`: usuarios activos que son superusuario o tienen `sales.add_saleorder` (directo o por grupo), ordenados por nombre, en un número constante de consultas.
  - `GET /api/treasury/pos-sessions/{id}/operators/` → `[{"id": int, "full_name": str, "initials": str}]` (solo autenticación, como `current`).
  - `POST /api/treasury/pos-sessions/{id}/identify_operator/` cuerpo `{operator_id, tab_key, purpose, target_type?, target_id?, credential?}` → `201 {"token": str, "pass_id": int, "operator": {"id", "full_name"}, "purpose": str, "expires_at": str|null}`.
  - `POST /api/treasury/pos-sessions/{id}/release_operator/` (lee `X-POS-Operator-Pass`) → `204`; termina el pase con `RELEASED`; sin pase o ya terminado también `204`.
  - `identify` rechaza con `ValidationError` a un `operator_id` que no esté en `list_operators()`.

- [ ] **Step 1: Tests que fallan**

```python
def test_operators_lists_only_active_sellers(api, multi_session, seller, inactive_seller, no_perm_user):
    r = api.get(f"/api/treasury/pos-sessions/{multi_session.id}/operators/")
    assert [o["id"] for o in r.json()] == [seller.id]

def test_operators_query_count_is_constant(api, multi_session, django_assert_max_num_queries):
    # crear 3 vendedores, medir; crear 30 más, medir de nuevo con el mismo tope
    ...

def test_identify_returns_token_once(api, multi_session, seller):
    r = api.post(f"/api/treasury/pos-sessions/{multi_session.id}/identify_operator/",
                 {"operator_id": seller.id, "tab_key": "t1", "purpose": "CASH_MOVEMENT"}, format="json")
    assert r.status_code == 201 and r.json()["token"] and r.json()["operator"]["id"] == seller.id

def test_identify_rejects_non_operator(api, multi_session, no_perm_user):   # 400
def test_identify_rejects_single_session(api, single_session, seller):       # 400
def test_release_ends_pass(api, multi_session, seller):                      # 204 y end_reason == "RELEASED"
def test_release_without_pass_is_204(api, multi_session):
```

- [ ] **Step 2:** Ejecutar y confirmar que fallan.
- [ ] **Step 3:** Implementar selector, serializers de entrada/salida y las tres acciones (cada una ≤ 20 líneas, delegando en el servicio). Las acciones usan `permission_classes=[IsAuthenticated]`, igual que `current` y `open_session`.
- [ ] **Step 4:** Ejecutar el archivo de tests y `treasury/tests/test_pos_terminal_list_permissions.py`: PASS.
- [ ] **Step 5:** Commit `feat(pos): endpoints para listar e identificar operadores`.

---

### Task 4: Movimientos de caja y cierre con actor

**Files:**
- Modify: `backend/treasury/pos_service.py` (`close_session_from_request`, `register_manual_movement_from_request`)
- Test: `backend/treasury/tests/test_pos_operator_cash_and_close.py`

**Interfaces:**
- Consumes: `POSOperatorService.actor_from_request(request, session, purpose)`, `.end(pass, "CONSUMED")`.
- Produces: en `MULTI`, `TreasuryMovement.created_by` y `POSSession.closed_by` = operador. `close_session` y `register_manual_movement` no cambian de firma: reciben `user=actor.operator`.

Reglas:
- `register_manual_movement_from_request` (cubre retiros de socios y todo movimiento manual) usa propósito `CASH_MOVEMENT`; `close_session_from_request` usa `SESSION_CLOSE`.
- El pase se consume solo si la operación terminó bien; si falla, sigue vigente para reintentar.
- La regla "solo quien abrió o superusuario" se evalúa contra `actor.operator`.
- Si la sesión ya está cerrada se devuelve el error actual de sesión cerrada (la comprobación de estado va antes que la del pase).
- Al cerrar una sesión `MULTI`, todos sus pases vigentes terminan con `EXPIRED`.

- [ ] **Step 1: Tests que fallan** (por API, sesión `MULTI` abierta por `cashier`)

```python
def test_movement_without_pass_is_403_with_code(api, multi_session):
    r = api.post(f"/api/treasury/pos-sessions/{multi_session.id}/register_manual_movement/", {...}, format="json")
    assert r.status_code == 403 and r.json()["code"] == "pos_operator_required" and r.json()["purpose"] == "CASH_MOVEMENT"

def test_movement_attributed_to_operator_and_pass_consumed(api, multi_session, ana):
    # identify -> POST con encabezado -> movimiento.created_by == ana; pase.end_reason == "CONSUMED"
def test_consumed_pass_cannot_be_reused(...)                       # segundo POST -> 403
def test_failed_movement_keeps_pass_alive(...)                      # monto inválido -> pase sin ended_at
def test_close_requires_session_close_pass(...)                     # pase CASH_MOVEMENT -> 403
def test_close_by_opener_operator_sets_closed_by(...)               # operador == quien abrió -> closed_by == operador
def test_close_by_other_operator_is_denied(...)                     # 403 con el mensaje de la regla #233
def test_close_ends_all_live_passes(...)
def test_closed_session_returns_closed_error_not_500(...)           # Review Focus 3
def test_single_mode_unchanged(api, single_session, cashier)        # sin encabezado: 200, created_by == cashier, closed_by == cashier
```

Nota: la vista `register_manual_movement` hoy convierte toda excepción en 500; debe dejar pasar `APIException` (re-lanzarla) para que el 403 llegue al cliente, igual que `close_session` hace con `PermissionDenied`.

- [ ] **Step 2:** Ejecutar y confirmar que fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Ejecutar el archivo nuevo más `treasury/tests/test_pos_sessions.py` y `treasury/tests/test_pos_cash_ledger.py`: PASS.
- [ ] **Step 5:** Commit `feat(pos): cierre y movimientos de caja atribuidos al operador`.

---

### Task 5: Seguimiento y borradores con actor

**Files:**
- Modify: `backend/sales/models.py`, `backend/sales/draft_cart_service.py`, `backend/sales/draft_cart_views.py`
- Create: `backend/sales/tracking_service.py`, `backend/sales/migrations/0021_saletrackingevent.py`
- Test: `backend/sales/tests/test_sale_tracking.py`, `backend/sales/tests/test_draft_cart_operator.py`

**Interfaces:**
- Consumes: `Actor`, `POSOperatorService.actor_from_request`, `.bind_target`, `.end`.
- Produces:

```python
class SaleTrackingEvent(models.Model):
    class Step(TextChoices): CART, CUSTOMER, DTE, MANUFACTURING, PAYMENT, DELIVERY, CHECKOUT, DOCUMENT_EDIT
    draft_ref     # PositiveIntegerField(null, db_index)  id del borrador, sin FK
    sale_order    # FK SaleOrder, CASCADE, null, related_name="tracking_events"
    pos_session   # FK treasury.POSSession, SET_NULL, null
    step          # CharField(20)
    operator      # FK User, PROTECT
    device_user   # FK User, PROTECT
    operator_pass # FK treasury.POSOperatorPass, SET_NULL, null
    entity_type   # CharField(100, blank)   solo DOCUMENT_EDIT
    entity_id     # PositiveIntegerField(null)
    detail        # CharField(255, blank)
    occurred_at   # DateTimeField
    # UniqueConstraint(draft_ref, step) condition sale_order IS NULL

class SaleTrackingService:
    @staticmethod
    def changed_steps(old: DraftCart | None, *, items, customer_id, wizard_state) -> set[str]
    @staticmethod
    def record_draft_steps(*, draft, steps: set[str], actor: Actor) -> None     # upsert por (draft_ref, step)
    @staticmethod
    def transfer_to_order(*, draft_id: int, order, actor: Actor) -> None        # liga filas a la orden y agrega CHECKOUT
    @staticmethod
    def record_document_edit(*, actor: Actor, pos_session, entity_type: str, entity_id: int | None,
                             detail: str, sale_order=None) -> None               # siempre inserta
```

Mapa de pasos en `changed_steps` (comparación de lo guardado contra lo recibido): `customer_id` → `CUSTOMER`; `wizard_state["dteData"]` → `DTE`; `wizard_state["paymentData"]` → `PAYMENT`; `wizard_state["deliveryData"]` → `DELIVERY`; cambios en `items` → `CART`, salvo que el único cambio esté en los campos que escribe `frontend/features/sales/components/checkout/Step2_ManufacturingDetails.tsx` sobre cada ítem, que cuenta como `MANUFACTURING` (leer ese archivo para fijar la lista de campos en una constante `MANUFACTURING_ITEM_FIELDS`). Las demás claves de `wizard_state` (`step`, `isLoading`, banderas de espera) no generan pasos. Un borrador nuevo registra `CART` y, si viene cliente, `CUSTOMER`.

Reglas de borradores en `MULTI` (propósito `DRAFT`):
- Exigen pase: `create`, `update`, `destroy`, `lock`, `withdraw`. No exigen: `list`, `retrieve`, `restore`, `sync`, `unlock`, `heartbeat`.
- `create` con pase sin destino: tras guardar, `bind_target(pass, "sales.draftcart", draft.id)` y `expires_at = None`.
- `lock` de un borrador existente exige un pase `DRAFT` ligado a ese borrador (el frontend lo pide con `target_id`); `locked_by = actor.operator`.
- `update` exige que el pase esté ligado a ese borrador **y** que el bloqueo siga vigente a nombre del operador y de la misma `session_key`; si el bloqueo venció, el pase termina con `EXPIRED` y se lanza `POSOperatorRequired("DRAFT")`.
- `unlock` termina con `RELEASED` el pase ligado a ese borrador si viene en el encabezado.
- `created_by`, `last_modified_by`, `locked_by` reciben `actor.operator`.
- Las vistas pasan `request` al wrapper `*_from_request`; el wrapper resuelve el actor. `save_draft` gana el parámetro `actor: Actor` y llama a `record_draft_steps` dentro de su transacción. En `SINGLE` también se registra el seguimiento, con `operator == device_user`.

- [ ] **Step 1: Tests que fallan — seguimiento**

```python
def test_new_draft_records_cart_and_customer(...)
def test_step_row_is_upserted_not_appended(...):        # dos guardados de PAYMENT por operadores distintos -> 1 fila, operador = el último
def test_untouched_steps_keep_their_operator(...):      # ana toca CART, beto toca PAYMENT -> CART sigue con ana
def test_wizard_noise_keys_record_nothing(...):         # solo cambia wizard_state["step"] -> sin filas nuevas ni cambios
def test_transfer_links_rows_and_adds_checkout(...):    # filas quedan con sale_order y draft_ref; existe CHECKOUT con el actor
def test_tracking_survives_draft_deletion(...):         # borrar el DraftCart no borra las filas ya traspasadas
def test_document_edit_always_inserts(...)
```

- [ ] **Step 2: Tests que fallan — borradores**

```python
def test_multi_create_draft_without_pass_403(...)                      # code == "pos_operator_required", purpose == "DRAFT"
def test_multi_create_binds_pass_to_draft(...)                         # pass.target_id == draft.id, expires_at is None
def test_multi_update_with_other_drafts_pass_403(...)
def test_multi_update_after_lock_expired_403_and_pass_expired(...)     # Review Focus 1: locked_at retrasado 16 s
def test_multi_lock_sets_locked_by_operator(...)
def test_multi_unlock_releases_pass(...)
def test_multi_sync_and_heartbeat_need_no_pass(...)
def test_two_operators_same_draft_tracked_per_step(...)                # ana crea; suelta; beto identifica, bloquea y cambia pago
def test_single_mode_draft_flow_unchanged(...)                         # sin encabezado; created_by == cashier; seguimiento con operator == cashier
```

- [ ] **Step 3:** Ejecutar y confirmar que fallan.
- [ ] **Step 4:** Implementar modelo, migración, `tracking_service.py` y los cambios de borradores.
- [ ] **Step 5:** Ejecutar los dos archivos nuevos y todos los `sales/tests/test_draft_cart_*.py`: PASS.
- [ ] **Step 6:** Commit `feat(pos): seguimiento por paso y borradores atribuidos al operador`.

---

### Task 6: Cobro con actor y traspaso del seguimiento

**Files:**
- Modify: `backend/sales/services.py` (`create_sale_order_from_pos`), `backend/sales/views.py` (`SaleOrderViewSet.create`, nueva acción `tracking`), `backend/sales/selectors.py`, `backend/sales/serializers.py`
- Test: `backend/sales/tests/test_create_order_from_pos_operator.py`; ajustar `backend/sales/tests/test_create_order_from_pos.py`

**Interfaces:**
- Consumes: `Actor`, `SaleTrackingService.transfer_to_order`, `POSOperatorService`.
- Produces:
  - `SalesService.create_sale_order_from_pos(actor: Actor, data, files, serializer)` (el primer parámetro deja de ser `user`). `salesperson = actor.operator`. La búsqueda de sesión sin `pos_session_id` usa `actor.device_user`.
  - El payload acepta `draft_id` opcional. Con sesión `MULTI`, `draft_id` es obligatorio y el pase `DRAFT` debe estar ligado a él.
  - Tras confirmar: `transfer_to_order(draft_id, order, actor)` si hay `draft_id`; el pase termina con `CONSUMED`.
  - `GET /api/sales/orders/{id}/tracking/` → `[{"step", "step_display", "operator_name", "device_user_name", "entity_type", "entity_id", "detail", "occurred_at"}]`, ordenado por `occurred_at`; permiso `sales.view_saleorder`; consultas constantes (`select_related("operator", "device_user")`).
  - Ventas sin sesión POS (`pos_session` nulo) no cambian.

La vista resuelve la sesión y el actor antes de llamar al servicio; el decorador `@idempotent_endpoint` queda por fuera, de modo que un reintento con la misma clave devuelve la respuesta guardada sin volver a validar el pase.

- [ ] **Step 1: Tests que fallan**

```python
def test_multi_sale_salesperson_is_operator(...)                 # order.salesperson == ana; device_user queda en el evento CHECKOUT
def test_multi_sale_without_pass_403(...)
def test_multi_sale_requires_draft_id(...)                        # 400
def test_multi_sale_transfers_tracking_and_consumes_pass(...)     # filas con sale_order; pass.end_reason == "CONSUMED"
def test_sale_seller_is_who_charges_not_who_created(...)          # ana crea borrador, beto cobra -> salesperson == beto; CART sigue con ana
def test_idempotent_replay_with_consumed_pass_returns_same_order(...)   # Review Focus 5
def test_single_sale_unchanged(...)                               # salesperson == request.user, sin encabezado
def test_tracking_endpoint_shape_and_query_count(...)
```

- [ ] **Step 2:** Ejecutar y confirmar que fallan.
- [ ] **Step 3:** Implementar; actualizar las llamadas existentes de `test_create_order_from_pos.py` a `Actor(user, user, None)`.
- [ ] **Step 4:** Ejecutar `sales/tests/test_create_order_from_pos*.py` y `sales/tests/test_order_list_queries.py`: PASS.
- [ ] **Step 5:** Commit `feat(pos): venta atribuida al operador y seguimiento heredado a la orden`.

---

### Task 7: Ediciones de documentos desde el panel POS

**Files:**
- Create: `backend/core/pos_document_context.py`
- Modify: `backend/config/settings.py` (`DEFAULT_AUTHENTICATION_CLASSES`, `MIDDLEWARE`)
- Test: `backend/core/tests/test_pos_document_context.py`

**Interfaces:**
- Consumes: `POSOperatorService.resolve_actor`, `SaleTrackingService.record_document_edit`.
- Produces:
  - Encabezado `X-POS-Document-Context: <pos_session_id>`, que el frontend envía solo mientras hay un documento abierto en el panel de ventas del POS.
  - `class POSAwareJWTAuthentication(JWTAuthentication)`: tras autenticar, si el método no es seguro, el encabezado está presente y la ruta no empieza por `/api/sales/pos-drafts/`, `/api/treasury/pos-sessions/` ni es el `POST /api/sales/orders/` de cobro, resuelve el actor con propósito `DOCUMENT_EDIT` y lo deja en `request._request.pos_document_actor` junto con la sesión. Sesión inexistente o cerrada → se ignora el encabezado. Sesión `SINGLE` → actor = usuario autenticado, sin exigir pase.
  - `class POSDocumentTrackingMiddleware`: en la respuesta, si hay `pos_document_actor` y el estado es 2xx, llama a `record_document_edit` con `entity_type` = `"{app_label}.{model_name}"` del queryset del viewset resuelto, `entity_id` = `pk` de la URL, `detail` = `"{método} {nombre de la acción}"`, y `sale_order` = la orden cuando el destino del pase (o el propio recurso) es `sales.saleorder`. Va después de `AuthenticationMiddleware`.
  - El pase `DOCUMENT_EDIT` no se consume por request; lo termina el frontend con `release_operator` al salir del documento, o el siguiente `identify` de la pestaña.

- [ ] **Step 1: Tests que fallan** (usar un endpoint real de edición de una orden, p. ej. el `PATCH` de notas de `sales/orders/{id}/`)

```python
def test_write_without_context_header_is_untouched(...)             # sesión MULTI abierta; sin encabezado -> 200, sin evento
def test_multi_write_with_context_and_no_pass_403(...)              # code == "pos_operator_required", purpose == "DOCUMENT_EDIT"
def test_multi_write_with_pass_records_event(...)                   # 200; evento DOCUMENT_EDIT con operator, device_user, entity y sale_order
def test_failed_write_records_nothing(...)                          # 400 -> sin evento
def test_single_write_with_context_records_event_as_user(...)
def test_get_with_context_needs_no_pass(...)
def test_pass_survives_multiple_edits(...)                          # dos PATCH con el mismo pase -> dos eventos
def test_draft_and_session_routes_are_exempt(...)                   # heartbeat de borrador con el encabezado y sin pase -> no 403
def test_closed_or_unknown_session_header_is_ignored(...)
```

- [ ] **Step 2:** Ejecutar y confirmar que fallan.
- [ ] **Step 3:** Implementar y registrar en settings.
- [ ] **Step 4:** Ejecutar el archivo nuevo y la suite `sales/tests` + `treasury/tests/test_pos_*.py`: PASS.
- [ ] **Step 5:** Commit `feat(pos): ediciones de documentos desde el panel POS exigen y registran operador`.

---

### Task 8: Frontend — modo en la apertura

**Files:**
- Modify: `frontend/features/pos/components/SessionOpenModal.tsx`, `frontend/features/pos/hooks/usePOSSessions.ts` (interfaz `POSSession`), `frontend/features/pos/types/index.ts`, `frontend/features/pos/components/SessionControl.tsx`, `frontend/features/sales/components/POSSessionsClientView.tsx` (y su definición de entidad si la columna vive ahí)
- Create (si no existe): `frontend/features/pos/schema.ts`
- Test: `frontend/features/pos/components/__tests__/SessionOpenModal.mode.test.tsx`

**Interfaces:**
- Produces: `type POSSessionMode = 'SINGLE' | 'MULTI'`; `POSSession.mode: POSSessionMode`; el payload de apertura incluye `mode`.

Copia exacta: título del campo "Modo de caja"; opciones "Un solo usuario" ("Opera quien inició sesión, sin pasos adicionales.") y "Multiusuario" ("Pide elegir al operador en cada transacción."). Valor inicial `SINGLE`. Usar el componente de elección que indique `docs/20-contracts/component-decision-tree.md` (familia de tarjetas `choice`).

- [ ] **Step 1: Tests que fallan**: el modal muestra las dos opciones con `SINGLE` marcada; al elegir "Multiusuario" y confirmar, la mutación de apertura recibe `mode: 'MULTI'`; sin tocar nada, recibe `mode: 'SINGLE'`.
- [ ] **Step 2:** Ejecutar y confirmar que fallan.
- [ ] **Step 3:** Implementar; mostrar el modo como chip en `SessionControl` y como columna en la lista de sesiones (solo cuando es `MULTI` en el encabezado del POS).
- [ ] **Step 4:** `npm run test -- features/pos`, `npm run type-check`, `npm run lint`: sin errores.
- [ ] **Step 5:** Commit `feat(pos): elegir modo de caja al abrir la sesión`.

---

### Task 9: Frontend — mecanismo de operador

**Files:**
- Create: `frontend/lib/posOperator.ts`, `frontend/features/pos/operator/operatorStore.ts`, `frontend/features/pos/operator/useOperatorGate.ts`, `frontend/features/pos/operator/useOperators.ts`, `frontend/features/pos/operator/OperatorPickerModal.tsx`, `frontend/features/pos/operator/OperatorChip.tsx`, `frontend/features/pos/operator/OperatorGateProvider.tsx`, `frontend/features/pos/operator/index.ts`
- Modify: `frontend/lib/api.ts` (interceptores), `frontend/features/pos/api/posApi.ts`, `frontend/features/pos/index.ts`, `frontend/features/pos/components/POSShell.tsx` (montar el provider)
- Test: `frontend/lib/__tests__/posOperator.test.ts`, `frontend/features/pos/operator/__tests__/useOperatorGate.test.tsx`, `frontend/features/pos/operator/__tests__/OperatorPickerModal.test.tsx`

**Interfaces:**
- Produces:

```ts
// lib/posOperator.ts — sin dependencias de features
export type OperatorPurpose = 'DRAFT' | 'CASH_MOVEMENT' | 'SESSION_CLOSE' | 'DOCUMENT_EDIT'
export function setPosOperatorHeaders(h: { pass?: string; documentContext?: number } | null): void
export function getPosOperatorHeaders(): Record<string, string>      // {'X-POS-Operator-Pass', 'X-POS-Document-Context'}
export function setPosOperatorChallengeHandler(fn: ((purpose: OperatorPurpose) => Promise<boolean>) | null): void
export function runPosOperatorChallenge(purpose: OperatorPurpose): Promise<boolean>   // false si no hay manejador

// posApi
listOperators(sessionId: number): Promise<PosOperator[]>              // {id, full_name, initials}
identifyOperator(sessionId: number, payload: IdentifyOperatorPayload): Promise<OperatorPassResponse>
releaseOperator(sessionId: number): Promise<void>

// features/pos/operator
export interface ActiveOperatorPass { token: string; operator: { id: number; full_name: string }; purpose: OperatorPurpose; targetId: number | null }
export function useOperatorGate(): {
  isMultiUser: boolean
  activePass: ActiveOperatorPass | null
  ensureOperator(purpose: OperatorPurpose, target?: { type: string; id: number }): Promise<boolean>  // SINGLE: true sin UI
  release(): Promise<void>
}
```

Comportamiento:
- `lib/api.ts`: el interceptor de request mezcla `getPosOperatorHeaders()`. El de respuesta, ante 403 con `data.code === 'pos_operator_required'` y si el request aún no fue reintentado, llama a `runPosOperatorChallenge(data.purpose)`; si devuelve `true` reenvía el request una vez con los encabezados nuevos; si no, rechaza con el error original.
- `ensureOperator`: en `SINGLE` resuelve `true` sin efectos. En `MULTI`, si ya hay un pase vigente del mismo propósito y destino, resuelve `true`; si no, abre `OperatorPickerModal`, llama a `identifyOperator` con el `tab_key` de `pos_browser_session_key`, guarda el pase y actualiza `setPosOperatorHeaders`. Cancelar el modal resuelve `false`.
- `OperatorGateProvider` registra el manejador de desafío mientras el POS está montado (lo quita al desmontar) y limpia el pase si cambia la sesión actual.
- `OperatorPickerModal`: cuadrícula táctil de operadores (iniciales + nombre), buscador cuando hay más de 12, estados `loading` / `empty` / `error`. Título "¿Quién opera?"; vacío: "No hay operadores habilitados para esta caja."; botón "Cancelar". Deja un punto de extensión comentado para un segundo paso de credencial; no lo implementa.
- `OperatorChip`: muestra "Operador: {nombre}" mientras hay pase; no se renderiza en `SINGLE`.

- [ ] **Step 1: Tests que fallan**

```ts
// posOperator.test.ts
it('devuelve encabezados solo para los valores definidos')
it('runPosOperatorChallenge devuelve false sin manejador')
// useOperatorGate.test.tsx
it('en SINGLE resuelve true sin abrir el modal ni llamar a la API')
it('en MULTI abre el modal, identifica y deja el pase en los encabezados')
it('reutiliza el pase vigente del mismo propósito y destino')
it('pide uno nuevo si cambia el propósito o el destino')
it('cancelar resuelve false y no deja encabezados')
it('release llama a releaseOperator y limpia el estado')
// OperatorPickerModal.test.tsx
it('lista operadores y devuelve el elegido')
it('muestra estados de carga, vacío y error')
```

Agregar un test del interceptor: una respuesta 403 con `pos_operator_required` dispara el desafío y reintenta una sola vez.

- [ ] **Step 2:** Ejecutar y confirmar que fallan.
- [ ] **Step 3:** Implementar. `useOperators` envuelve la consulta (invariante 5).
- [ ] **Step 4:** `npm run test -- features/pos lib`, `npm run type-check`, `npm run lint`: sin errores.
- [ ] **Step 5:** Commit `feat(pos): selector de operador y pase en el cliente`.

---

### Task 10: Frontend — conectar las transacciones

**Files:**
- Modify: `frontend/features/pos/hooks/useDrafts.ts`, `frontend/features/pos/hooks/useDraftSync.ts`, `frontend/features/pos/components/POSClientView.tsx`, `frontend/features/pos/components/DraftCartsClientView.tsx`, `frontend/features/pos/components/SessionCloseModal.tsx`, `frontend/features/pos/components/SessionControl.tsx` (o donde se abra el formulario de movimiento manual), `frontend/features/pos/components/SalesOrdersDrawer.tsx`, `frontend/features/pos/hooks/usePosDocumentStack.ts`, `frontend/features/pos/components/POSCheckoutHeader.tsx`, `frontend/features/sales/components/checkout/checkoutPayload.ts`
- Create: `frontend/features/sales/hooks/useSaleOrderTracking.ts`, `frontend/features/sales/api` (función `getOrderTracking`), componente `SaleOrderTrackingPanel` en `frontend/features/sales/components/`
- Test: `frontend/features/pos/hooks/__tests__/useDrafts.operator.test.tsx`, `frontend/features/sales/components/__tests__/SaleOrderTrackingPanel.test.tsx`, `frontend/features/sales/components/checkout/__tests__/checkoutPayload.test.ts` (ampliar)

**Interfaces:**
- Consumes: `useOperatorGate`, `setPosOperatorHeaders`, endpoint `orders/{id}/tracking/`.
- Produces: `checkoutPayload` incluye `draft_id` cuando hay borrador actual.

Puntos de conexión (en `SINGLE` todos son no-op porque `ensureOperator` resuelve `true`):

| Momento | Llamada |
|---|---|
| Primer ítem agregado a un carrito sin borrador, o "nuevo borrador" | `ensureOperator('DRAFT')`; si `false`, no se agrega |
| Cargar un borrador de la lista | `ensureOperator('DRAFT', {type: 'sales.draftcart', id})` antes de pedir el bloqueo |
| Soltar el borrador, cobrar con éxito, o perder el bloqueo | `release()` (tras cobrar basta limpiar el estado: el backend ya consumió el pase) |
| Abrir el formulario de movimiento / retiro | `ensureOperator('CASH_MOVEMENT')` antes de mostrarlo |
| Iniciar el cierre de sesión | `ensureOperator('SESSION_CLOSE')` antes de abrir `SessionCloseModal` |
| Documento abierto en el panel de ventas | `setPosOperatorHeaders({documentContext: sessionId})`; el primer guardado recibe 403 y el manejador de desafío pide `DOCUMENT_EDIT` con el documento abierto como destino |
| "Volver a la lista", abrir otro documento o cerrar el panel | `release()` si el pase es `DOCUMENT_EDIT`, y quitar `documentContext` |

- `OperatorChip` va en el encabezado del POS y en `POSCheckoutHeader`.
- Identificarse para editar un documento invalida el pase del borrador en curso (regla del spec); al volver al carrito, la siguiente modificación vuelve a pedir operador. El carrito en pantalla no se pierde.
- `SaleOrderTrackingPanel`: lista cronológica (paso, operador, cuenta del dispositivo si difiere, fecha) con estados `loading` / `empty` / `error`; se muestra como sección en la ficha de la orden de venta. Seguir `docs/20-contracts/component-document-sheet.md` para ubicarla y `component-entity-view.md` para renderizar la lista.

- [ ] **Step 1: Tests que fallan**

```ts
it('en MULTI no crea el borrador si se cancela el selector')
it('en MULTI pide operador con el id del borrador antes de bloquearlo')
it('en SINGLE crea y carga borradores sin llamar a identifyOperator')
it('checkoutPayload incluye draft_id cuando hay borrador')
it('SaleOrderTrackingPanel muestra pasos, operador y fecha; y sus estados')
```

- [ ] **Step 2:** Ejecutar y confirmar que fallan.
- [ ] **Step 3:** Implementar los puntos de conexión.
- [ ] **Step 4:** `npm run test -- features/pos features/sales`, `npm run type-check`, `npm run lint`: sin errores.
- [ ] **Step 5: Verificación en el servidor de desarrollo.** Confirmar `mutagen sync list` → `erpgrafico-sync … Connected: Yes`; aplicar migraciones con `docker compose exec` en `~/ERPGrafico`; en `http://192.168.1.86`: (a) sesión `SINGLE`: vender, registrar un movimiento y cerrar sin ningún modal nuevo; (b) sesión `MULTI`: crear un borrador como operador A, soltarlo, retomarlo como B y cobrar; registrar un retiro; editar una nota de venta desde el panel; cerrar. Comprobar en la ficha de la orden que el seguimiento muestra A en carrito y B en pago y cobro.
- [ ] **Step 6:** Commit `feat(pos): transacciones del POS conectadas al operador y seguimiento en la orden`.

---

### Task 11: Documentación

**Files:**
- Create: `docs/10-architecture/adr/0125-pos-session-mode-identified-operator.md`
- Modify: `docs/10-architecture/adr/README.md` (índice), `docs/20-contracts/state-map.md` (§POSSession: `mode`, inmutable), `docs/20-contracts/api-contracts.md` (tres endpoints, `orders/{id}/tracking/`, encabezados, rechazo `pos_operator_required`, `mode` y `draft_id` en payloads)

- [ ] **Step 1:** Escribir el ADR con el formato de los ADR 0122–0124 (frontmatter `id`, `title`, `status: Accepted`, `date`, `author`; Contexto, Decisión, Consecuencias, Alternativas). Debe decir: convive con el ADR-0122 y lo reemplazará la edición que traiga PIN/tarjeta; la primera edición es un registro de buena fe; `simple_history` sigue registrando la cuenta del dispositivo; identificarse para una acción invalida el pase anterior de la pestaña.
- [ ] **Step 2:** Actualizar los contratos.
- [ ] **Step 3:** Commit `docs(pos): ADR-0125 y contratos del modo multiusuario`.
