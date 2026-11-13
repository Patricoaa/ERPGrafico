# Sincronización de ventas TUU — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traer a diario las ventas de cada proveedor TUU (3 reportes), guardar los crudos y una venta unificada por transacción, y mostrarlas en `/treasury/terminal-cobro/sales` con configuración en una nueva pestaña de Tesorería.

**Architecture:** Cliente HTTP aislado (`tuu_client.py`) → normalizador puro (`tuu_normalizer.py`) que une los 3 reportes → servicio (`terminal_sync_service.py`) que crea ejecuciones, guarda crudos y hace upsert atómico → tareas Celery (despachador horario + sync por proveedor con reintentos) → API DRF de solo lectura + settings singleton + acción `sync` → feature `treasury` en el frontend (entidad, ClientView, drawer, modal de sincronización) y panel de settings con autosave en `features/settings`.

**Tech Stack:** Django 5 + DRF, Celery (`PersistentScheduler`, `CELERY_BEAT_SCHEDULE`), `requests`, PostgreSQL; Next.js 16, TanStack Query, react-hook-form + zod, `@/components/entity-view`.

**Spec:** `docs/superpowers/specs/2026-11-13-tuu-sincronizacion-ventas-terminal-design.md` (leer completo antes de cada etapa; contiene el detalle de las 3 APIs y las particularidades de los datos).

## Global Constraints

- Invariantes de `CLAUDE.md`: zero `any`, sin colores Tailwind crudos, imports por barrel, sin `@/lib/api` ni `useQuery` en componentes, `StatusBadge` para estados, formularios con `react-hook-form` + `zodResolver` + `schema.ts`, vistas ≤ 20 líneas, lógica en `services.py`/servicios, zero N+1, colecciones con `defineEntity` + `@/components/entity-view`, sufijos `Drawer`/`Modal`/`View`.
- Base URL `https://integrations.payment.haulmer.com`; header `X-API-Key`; `pageSize` = 20; tramos de **máximo 30 días** inclusive.
- Llamadas por tramo: A = `POST /BranchReport/branch-report` sin `typeTransaction`; B = mismo con `typeTransaction: "CASH"`; C = `POST /Report/get-report` con `{"Filters": {"StartDate", "EndDate"}, "page", "pageSize"}`.
- Clave natural: `cash:<saleId>` para efectivo, `card:<sequenceNumber>` para tarjeta; única por `(provider, natural_key)`.
- Defaults de settings: `enabled=False`, `run_hour=3`, `lookback_days=7`, `history_start_date=None`, `max_retries=3`, `retry_delay_minutes=10`.
- Zona horaria de `transactionDateTime` y de `run_hour`: `America/Santiago`.
- La API key nunca aparece en logs, `error_message`, crudos guardados ni respuestas de la API.
- Los nombres de tareas en `@shared_task(name=...)` deben ser idénticos al `"task"` de `CELERY_BEAT_SCHEDULE` (ver issue #261).
- Tests backend local: `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta>` desde `backend/`. Frontend: `npm run type-check`, `npm run lint`, `npm run test -- <ruta>` desde `frontend/` (Node 24).
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Re-sincronizar un rango ya traído** no debe duplicar ventas y debe actualizar `settlement_id` de `"0"` a un id real → test `test_resync_updates_settlement_without_duplicates` (Task 4).
2. **Una venta presente en A/B pero ausente en C (o al revés)** se guarda igual con `sources` parcial → test `test_build_sales_keeps_orphans_from_each_side` (Task 3).
3. **Credencial inválida (401 / `KEY-003`)** termina en `FAILED` sin reintentar y sin filtrar la key en `error_message` → test `test_auth_error_fails_without_retry_and_hides_key` (Task 5).
4. **Rango manual mayor a 30 días** se parte en tramos y una falla en el tramo 2 no revierte las ventas del tramo 1 → test `test_chunk_failure_keeps_previous_chunks` (Task 4).
5. **El despachador horario corre varias veces el mismo día** y no crea más de una ejecución automática por proveedor, aunque la anterior haya fallado → test `test_dispatcher_runs_once_per_provider_per_day` (Task 5).

---

## Etapa 1 — Backend: datos e integración

### Task 1: Modelos y migración

**Files:**
- Modify: `backend/treasury/models.py` (agregar al final, después de `TerminalBatch`/relacionados)
- Create: `backend/treasury/migrations/0106_terminal_sales_sync.py` (vía `makemigrations`)
- Modify: `backend/core/cache.py` (agregar `CACHE_KEY_TERMINAL_SYNC_SETTINGS = "settings:terminal_sync"`)
- Test: `backend/treasury/tests/test_terminal_sync_models.py`

**Interfaces:**
- Produces:
  - `TerminalSyncSettings(TimeStampedModel)`: `enabled: bool=False`, `run_hour: PositiveSmallInteger=3 (0–23)`, `lookback_days: PositiveSmallInteger=7 (1–60)`, `history_start_date: Date|None`, `max_retries: PositiveSmallInteger=3 (0–10)`, `retry_delay_minutes: PositiveSmallInteger=10 (1–120)`; `@classmethod get_settings() -> TerminalSyncSettings` con `cached_singleton(cls, CACHE_KEY_TERMINAL_SYNC_SETTINGS)`; `save()` invalida esa clave.
  - `TerminalSyncRun(TimeStampedModel)`: `provider FK PaymentTerminalProvider (PROTECT, related_name="sync_runs")`, `trigger` choices `SCHEDULED|MANUAL`, `status` choices `RUNNING|SUCCESS|PARTIAL|FAILED`, `start_date`, `end_date`, `attempts: int=0`, `started_at`, `finished_at|None`, `error_message: Text blank`, `warnings: JSON list`, `fetched_count`, `created_count`, `updated_count` (int=0), `triggered_by FK User|None (SET_NULL)`. Ordering `-started_at`. Índice `(provider, trigger, started_at)`.
  - `TerminalSyncPayload(TimeStampedModel)`: `run FK (CASCADE, related_name="payloads")`, `report` choices `BRANCH_CARD|BRANCH_CASH|GENERAL`, `chunk_start`, `chunk_end`, `page: int`, `http_status: int`, `request_body: JSON`, `response_body: JSON`.
  - `TerminalSale(TimeStampedModel)`: `provider FK (PROTECT, related_name="sales")`, `device FK PaymentTerminalDevice|None (SET_NULL)`, `natural_key: Char(64)`, `serial_number`, `sale_id`, `sequence_number`, `location_id` (Char, blank), `transaction_at: DateTime (index)`, `status` choices `COMPLETED|REVERSED|OTHER`, `raw_status: Char`, `payment_type` choices `CASH|DEBIT|CREDIT|PREPAID|UNKNOWN`, `document_type: PositiveSmallInteger|None (index)`, `instance: SmallInteger|None`, `card_brand`, `card_bin`, `card_issuer`, `card_origin`, `installment_type` (Char|None), `installment_count: SmallInteger|None`, `acquirer_id|None`, `currency: Char(3)="CLP"`, `sale_amount`, `tip_amount`, `cashback_amount`, `total_amount`, `commission_amount|None`, `net_amount|None` (`Decimal(14,0)`), `settlement_date|None`, `settlement_id: Char|None`, `settlement_amount: Decimal|None`, `reconciliations: JSON list`, `items: JSON list`, `raw: JSON dict` (claves `branch`, `general`), `sources: JSON list` (`"BRANCH"`, `"GENERAL"`), `first_seen_run FK|None`, `last_seen_run FK|None` (SET_NULL). `UniqueConstraint(fields=["provider", "natural_key"], name="uniq_terminal_sale_provider_key")`. Ordering `-transaction_at`. Propiedad `document_type_label -> str` con `{33: "Factura afecta", 34: "Factura exenta", 39: "Boleta", 41: "Boleta exenta", 48: "Comprobante de pago"}` y `f"DTE {n}"` para otros, `""` si nulo.

- [ ] **Step 1: Write the failing tests** — `test_settings_singleton_defaults` (get_settings() dos veces devuelve el mismo pk y los defaults de Global Constraints), `test_sale_unique_per_provider_and_key` (segundo create con mismo provider+natural_key → `IntegrityError`; mismo key con otro provider → OK), `test_document_type_label` (33 → "Factura afecta", 48 → "Comprobante de pago", 99 → "DTE 99", None → "").
- [ ] **Step 2: Run** `... pytest treasury/tests/test_terminal_sync_models.py -v` → FAIL (ImportError).
- [ ] **Step 3: Implement** los 4 modelos y la clave de cache; `venv/bin/python manage.py makemigrations treasury -n terminal_sales_sync`.
- [ ] **Step 4: Run** los tests del Step 2 → PASS. Run también `... pytest core/tests/test_model_base_invariants.py core/tests/test_deletion_policy_consistency.py -v` → PASS (si el de deletion-policy exige clasificar los modelos nuevos, registrar `TerminalSale`/`TerminalSyncRun`/`TerminalSyncPayload` como hard delete y agregar la fila en `docs/20-contracts/deletion-policy.md`: espejo de solo lectura, sin borrado desde UI).
- [ ] **Step 5: Commit** `feat(treasury): modelos de sincronización de ventas TUU`.

### Task 2: Cliente HTTP TUU

**Files:**
- Create: `backend/treasury/integrations/__init__.py`, `backend/treasury/integrations/tuu_client.py`
- Create: `backend/treasury/tests/fixtures/tuu/branch_card_p1.json`, `branch_card_p2.json`, `branch_cash_p1.json`, `branch_cash_p2.json`, `general_p1.json`, `general_p2.json`, `general_p3.json`
- Test: `backend/treasury/tests/test_tuu_client.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class TuuPage: report: str; page: int; total_pages: int; http_status: int; request_body: dict; response_body: dict; rows: list[dict]` (`report` ∈ `"BRANCH_CARD"|"BRANCH_CASH"|"GENERAL"`).
  - Excepciones: `class TuuError(Exception)`, `class TuuTransientError(TuuError)`, `class TuuAuthError(TuuError)`, `class TuuPlanError(TuuError)`, cada una con `.http_status: int` y `.code: str|None`; el mensaje nunca incluye la key.
  - `class TuuClient: def __init__(self, api_key: str, timeout: int = 60)`; `fetch_branch(self, start: date, end: date, cash: bool) -> list[TuuPage]`; `fetch_general(self, start: date, end: date) -> list[TuuPage]`. Ambos recorren todas las páginas (`pageSize=20`) y devuelven todas las páginas, incluidas las vacías.
  - Clasificación: 200 + `BR-00` → ok; `BR-27` o HTTP 404 en C → ok con `rows=[]`; 401 o `KEY-003` → `TuuAuthError`; `BR-25`, `BR-30` → `TuuPlanError`; timeout, `ConnectionError`, 5xx, `BR-01`, `BR-13`, `BR-18`, `BR-19` → `TuuTransientError`; cualquier otro código → `TuuError`.
  - Filas: A/B → `response["data"]["transactions"]`; C → `response["content"]["reports"]`.

- [ ] **Step 1: Crear fixtures** a partir de las respuestas reales en `/tmp/claude-1000/-home-pato-Nextcloud-Pato-Aplicaciones-ERPGrafico/550a23ad-abac-4d9d-b6d2-bb5ae1f3f34f/scratchpad/tuu_raw_2026-10-26.json` (claves `branch_card`, `branch_cash`, `general`, cada una lista de páginas), reemplazando `commerceName` → `"COMERCIO DEMO"`, `taxId` → `"11111111"`, `partnerId` → `"1"`, y cada `cardBin` → `"00000000"`. Si el archivo ya no existe, escribir a mano 1 página por reporte con la forma documentada en el spec (≥2 ventas en efectivo, ≥2 con tarjeta incluyendo una `PREPAID` con `documentType` 33, con `sequenceNumber`/`saleId` que cruzan entre reportes).
- [ ] **Step 2: Write the failing tests** (mockear `requests.post` con `monkeypatch`): `test_branch_paginates_all_pages` (devuelve 2 `TuuPage` para B con `total_pages=2` y el segundo request con `page=2`), `test_branch_cash_sends_type_filter` (body de B incluye `"typeTransaction": "CASH"`; A no lo incluye), `test_general_body_shape` (body == `{"Filters": {"StartDate": "2026-10-26", "EndDate": "2026-10-26"}, "page": 1, "pageSize": 20}`), `test_no_data_is_empty_ok` (`BR-27` → una página con `rows == []`; C con 404 → idem), `test_error_classification` (parametrizado: 401 `KEY-003` → `TuuAuthError`; `BR-25` → `TuuPlanError`; 503 → `TuuTransientError`; `requests.Timeout` → `TuuTransientError`), `test_header_and_no_key_in_messages` (header `X-API-Key` presente; `str(exc)` de cada error no contiene la key).
- [ ] **Step 3: Run** `... pytest treasury/tests/test_tuu_client.py -v` → FAIL.
- [ ] **Step 4: Implement** `tuu_client.py` con `requests.post(url, json=body, headers=..., timeout=...)`.
- [ ] **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `feat(treasury): cliente HTTP para reportes TUU`.

### Task 3: Normalizador (unión de los 3 reportes)

**Files:**
- Create: `backend/treasury/integrations/tuu_normalizer.py`
- Test: `backend/treasury/tests/test_tuu_normalizer.py`

**Interfaces:**
- Consumes: filas (`TuuPage.rows`) de Task 2.
- Produces:
  - `@dataclass class NormalizedSale` con los campos de `TerminalSale` (Task 1) excepto `provider`, `device`, FKs de run y timestamps; incluye `natural_key`, `serial_number`, `raw: dict`, `sources: list[str]`.
  - `def build_sales(branch_card: list[dict], branch_cash: list[dict], general: list[dict]) -> list[NormalizedSale]`.
  - Reglas (fijadas por el spec):
    - Clave: fila de B o fila de C con `typeTransaction` en mayúsculas `== "CASH"` → `cash:<saleId>`; fila de A o el resto de C → `card:<sequenceNumber>`.
    - Valores nulos: `None`, `""`, `"N/A"` → `None` (y `""` en campos `Char` no nulos).
    - `status`: minúsculas `completed` → `COMPLETED`, `reversed` → `REVERSED`, otro → `OTHER`; `raw_status` conserva el original.
    - `payment_type`: de A/B (`transactionType` en mayúsculas: `CASH|DEBIT|CREDIT|PREPAID`); si vacío o desconocido, de C (`typeTransaction`); si tampoco, `UNKNOWN`.
    - Montos `Decimal(str(v))`; `total_amount` de A/B, con `amount` de C como respaldo; `commission_amount = extraData.amountCommission`, `net_amount = extraData.amountWithoutCommission` (de C).
    - Abono: primera entrada de `reconciliations` de C; `settlement_id = None` si `"0"`, `"No reconciliation"` o vacío; `settlement_date = None` si vacío; lista completa en `reconciliations`.
    - `transaction_at`: `transactionDateTime` (A/B) o `paymentDataTime` (C), naive → aware en `America/Santiago`.
    - Ítems: de A/B (`items`) o C (`extraData.items`); `name` sin caracteres de control (`\x00`–`\x1f`), `code` `""` → `None`.
    - `serial_number`: `serialNumber` (A/B) o `posSerialNumber` (C) si no vacío.
    - `raw = {"branch": <fila A/B>|None, "general": <fila C>|None}`; `sources` ⊆ `["BRANCH", "GENERAL"]`.

- [ ] **Step 1: Write the failing tests** usando las fixtures de Task 2: `test_build_sales_joins_all_three` (fixture 2026-10-26: 47 ventas, todas con `sources == ["BRANCH", "GENERAL"]`), `test_card_sale_fields` (la venta `card:900084836119` tiene `payment_type == "PREPAID"`, `document_type == 33`, `card_issuer == "MERCADO_PAGO"`, `total_amount == Decimal("20000")`, `commission_amount` no nulo), `test_cash_sale_fields` (una venta de B: `payment_type == "CASH"`, `document_type == 39`, `sequence_number is None`, `settlement_id is None`), `test_settlement_zero_is_null` (fila C con `reconciliationId: "0"` → `settlement_id is None`, `settlement_date` presente), `test_item_name_strips_control_chars` (`"\u0002Nombre ítem 1"` → `"Nombre ítem 1"`), `test_status_and_type_case_normalized` (`"debit"` → `DEBIT`, `"Completed"` → `COMPLETED`), `test_build_sales_keeps_orphans_from_each_side` (fila solo en A → `sources == ["BRANCH"]`, `commission_amount is None`; fila solo en C → `sources == ["GENERAL"]`, `document_type is None`), `test_transaction_at_is_santiago_aware`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `build_sales` (función pura, sin ORM).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(treasury): normalizador que une los reportes TUU por venta`.

### Task 4: Servicio de sincronización

**Files:**
- Create: `backend/treasury/terminal_sync_service.py`
- Test: `backend/treasury/tests/test_terminal_sync_service.py`

**Interfaces:**
- Consumes: modelos (Task 1), `TuuClient` y errores (Task 2), `build_sales` (Task 3).
- Produces:
  - `def split_range(start: date, end: date, max_days: int = 30) -> list[tuple[date, date]]` (tramos inclusivos de ≤ `max_days` días).
  - `def eligible_providers() -> QuerySet[PaymentTerminalProvider]` (`provider_type=TUU`, `is_active=True`, con `gateway_config__has_key="api_key_encrypted"`).
  - `def daily_range(settings: TerminalSyncSettings, today: date) -> tuple[date, date] | None` → `(max(history_start_date, today - lookback_days), today - 1 day)`, `None` si start > end.
  - `def manual_range(settings, today: date, start: date | None, end: date | None) -> tuple[date, date]` → por defecto `(history_start_date or today - lookback_days, today)`; `ValidationError` si start > end o end > today.
  - `def create_run(provider, start: date, end: date, trigger: str, user=None) -> TerminalSyncRun` (status `RUNNING`).
  - `def execute_run(run: TerminalSyncRun, client: TuuClient | None = None) -> TerminalSyncRun`: por cada tramo de `split_range`, llama A, B y C; guarda cada `TuuPage` como `TerminalSyncPayload` (fuera de la transacción del tramo, para que los crudos queden aunque falle); luego, en `@transaction.atomic`, `build_sales` + upsert por `(provider, natural_key)`, asignando `device` por `PaymentTerminalDevice(provider=run.provider, serial_number=...)` y `first_seen_run`/`last_seen_run`. Si una venta existente trae `serial_number` distinto al guardado, no se actualiza y se agrega un aviso a `run.warnings`. Acumula `fetched/created/updated`. Estados finales: todos los tramos ok → `SUCCESS` (o `PARTIAL` si hay `warnings`); algún tramo falló después de ≥1 ok → `PARTIAL`; ninguno ok → `FAILED`. Errores `TuuTransientError` se relanzan **después** de guardar el progreso (la tarea decide reintentar); `TuuAuthError`/`TuuPlanError` → `FAILED` con mensaje legible en español, sin relanzar. Siempre setea `finished_at` en estados finales.

- [ ] **Step 1: Write the failing tests** (cliente falso que devuelve fixtures o lanza errores por tramo): `test_split_range` (`2026-01-01..2026-03-01` → `[(01-01, 01-30), (01-31, 03-01)]`; un día → 1 tramo), `test_daily_range_respects_history_floor` (today 2026-11-13, lookback 7, history 2026-11-10 → `(11-10, 11-12)`; history None → `(11-06, 11-12)`), `test_manual_range_defaults_and_validation`, `test_execute_run_creates_sales_and_payloads` (fixture 26-10 → 47 `TerminalSale`, 7 payloads, run `SUCCESS`, `created_count == 47`), `test_device_linked_by_serial` (con `PaymentTerminalDevice(serial_number="6010B232530402079")` del mismo provider → `device` asignado; sin él → `device is None` y `serial_number` guardado), `test_resync_updates_settlement_without_duplicates` (1ª corrida con C `reconciliationId "0"`, 2ª con `"19720426"` → mismo conteo de ventas, `settlement_id == "19720426"`, `updated_count > 0`), `test_chunk_failure_keeps_previous_chunks` (rango de 2 tramos, el 2º lanza `TuuError` → ventas del 1º persisten, run `PARTIAL`), `test_auth_error_marks_failed` (`TuuAuthError` → `FAILED`, sin excepción, `error_message` sin la key), `test_transient_error_reraises_after_saving_progress`, `test_serial_conflict_adds_warning`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** el módulo.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(treasury): servicio de sincronización de ventas TUU`.

### Task 5: Tareas Celery y programación

**Files:**
- Modify: `backend/treasury/tasks.py`
- Modify: `backend/config/settings.py` (`CELERY_BEAT_SCHEDULE`)
- Test: `backend/treasury/tests/test_terminal_sync_tasks.py`

**Interfaces:**
- Consumes: Task 4.
- Produces:
  - `@shared_task(name="treasury.tasks.dispatch_terminal_sales_sync") def dispatch_terminal_sales_sync() -> int` (cantidad de runs encolados). Sale con 0 si `not settings.enabled` o `localtime().hour < run_hour`. Por cada `eligible_providers()`: omitir si existe `TerminalSyncRun(provider, trigger=SCHEDULED)` con `started_at` en el día local de hoy (cualquier estado); si `daily_range` es `None`, omitir; si no, `create_run(..., SCHEDULED)` y `sync_terminal_run.delay(run.id)`.
  - `@shared_task(bind=True, name="treasury.tasks.sync_terminal_run") def sync_terminal_run(self, run_id: int) -> str` (estado final). Incrementa `run.attempts`; llama `execute_run`; ante `TuuTransientError`: si `self.request.retries < settings.max_retries` → `raise self.retry(countdown=settings.retry_delay_minutes * 60)`; si no → run `FAILED` con mensaje "TUU no respondió tras N intentos".
  - Entrada beat: `"dispatch_terminal_sales_sync_hourly": {"task": "treasury.tasks.dispatch_terminal_sales_sync", "schedule": crontab(minute=10)}` con comentario de sección como las demás.

- [ ] **Step 1: Write the failing tests**: `test_dispatcher_disabled_does_nothing`, `test_dispatcher_before_run_hour_does_nothing` (freeze 02:10 Santiago con `run_hour=3`), `test_dispatcher_runs_once_per_provider_per_day` (dos llamadas a las 03:10 y 04:10 → 1 run por provider; con la primera en `FAILED` igual 1), `test_dispatcher_skips_inactive_and_keyless_providers`, `test_auth_error_fails_without_retry_and_hides_key` (cliente que lanza `TuuAuthError` → run `FAILED`, `attempts == 1`), `test_transient_error_retries_then_fails` (con `max_retries=2` y `CELERY_TASK_ALWAYS_EAGER`: 3 intentos, run `FAILED`), `test_beat_entry_matches_registered_task` (`settings.CELERY_BEAT_SCHEDULE["dispatch_terminal_sales_sync_hourly"]["task"] in celery_app.tasks`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** las tareas y la entrada beat (mockear la hora con `django.utils.timezone.localtime` vía `monkeypatch` o `freezegun` si ya está instalado; no agregar dependencias).
- [ ] **Step 4: Run** → PASS; correr también `... pytest treasury/tests -q` para detectar regresiones.
- [ ] **Step 5: Commit** `feat(treasury): tareas Celery de sincronización TUU (despachador horario)`.

## Etapa 2 — Backend: API y permisos

### Task 6: Endpoints, selectores y permisos

**Files:**
- Modify: `backend/treasury/selectors.py`, `backend/treasury/serializers.py`, `backend/treasury/views.py`, `backend/treasury/urls.py`
- Modify: `backend/core/rbac/bundles.py` (junto a las líneas `treasury.*paymentterminal*`)
- Modify: `backend/core/tests/test_pagination_contract.py` (whitelist `TerminalSyncSettingsViewSet`)
- Modify: `backend/core/tests/test_zero_n_plus_one.py` (caso `terminal-sales` en la clase de Treasury)
- Test: `backend/treasury/tests/test_terminal_sales_api.py`

**Interfaces:**
- Consumes: Tasks 1, 4, 5.
- Produces (rutas bajo `/api/treasury/`):
  - `GET|PATCH terminal-sync-settings/current/` — patrón exacto de `WorkflowSettingsViewSet.current` (`backend/workflow/views.py:156`); permisos `treasury.view_terminalsyncsettings` / `treasury.change_terminalsyncsettings`. Respuesta incluye además `last_run: {id, provider_name, status, started_at, finished_at, error_message} | null` (solo lectura).
  - `GET terminal-sales/` — `ReadOnlyModelViewSet`, `StandardResultsSetPagination`; filtros `date_from`, `date_to` (sobre fecha local de `transaction_at`), `provider`, `device`, `payment_type`, `document_type`, `status`, `settled` (`true` → `settlement_id` no nulo). List serializer sin `raw`/`items`/`reconciliations`; incluye `provider_name`, `device_name`, `document_type_label`. `GET terminal-sales/{id}/` con todo.
  - `GET terminal-sales/summary/` (mismos filtros) → `{"count": int, "gross": str, "commission": str, "net": str, "by_payment_type": [{"payment_type", "count", "gross"}], "non_completed": {"count", "total"}}`; `gross/commission/net/by_payment_type` solo con `status=COMPLETED`.
  - `GET terminal-sync-runs/` — paginado, filtro `provider`, `status`; sin `payloads`.
  - `POST terminal-sync-runs/sync/` con `@idempotent_endpoint(scope="treasury.terminal_sync.manual")`, body `{"start_date"?: "YYYY-MM-DD", "end_date"?: "YYYY-MM-DD"}` → 202 con la lista de runs creados (uno por `eligible_providers()`); 400 si no hay proveedores elegibles o el rango es inválido. `action_permissions = {"sync": "treasury.add_terminalsyncrun"}`.
  - Selectores: `terminal_sales_queryset(filters: dict) -> QuerySet[TerminalSale]` (`select_related("provider", "device")`), `terminal_sales_summary(qs) -> dict`, `terminal_sync_runs_queryset(filters) -> QuerySet` (`select_related("provider", "triggered_by")`).
  - Bundles: `treasury.change_terminalsyncsettings`, `treasury.add_terminalsyncsettings`, `treasury.add_terminalsyncrun` → `["treasury.manage"]`.

- [ ] **Step 1: Write the failing tests**: `test_sales_list_filters` (payment_type, document_type, date_from/date_to, settled), `test_sales_list_excludes_raw_detail_includes_it`, `test_summary_excludes_non_completed` (una venta `REVERSED` no suma a `gross` y aparece en `non_completed`), `test_settings_get_patch_permissions` (usuario con `treasury.read` puede GET y no PATCH; con `treasury.manage` puede PATCH), `test_manual_sync_enqueues_runs` (mock de `sync_terminal_run.delay`; 202, 1 run `MANUAL` por provider elegible, `triggered_by` = usuario), `test_manual_sync_rejects_future_end_date`, `test_api_never_exposes_api_key` (ninguna respuesta de estos endpoints contiene la key en claro ni `api_key_encrypted`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** selectores, serializers, viewsets (acciones ≤ 20 líneas, lógica en selectores/servicio), rutas y bundles.
- [ ] **Step 4: Run** el test nuevo + `... pytest core/tests/test_pagination_contract.py core/tests/test_zero_n_plus_one.py core/tests/test_rbac_action_coverage.py core/tests/test_rbac_bundles.py -v` → PASS.
- [ ] **Step 5: Commit** `feat(treasury): API de ventas y sincronización TUU`.

### Task 7: Validación de API key duplicada en proveedores TUU

**Files:**
- Modify: `backend/treasury/serializers.py` (serializer de `PaymentTerminalProvider`, donde hoy se llama `set_api_key`)
- Test: `backend/treasury/tests/test_terminal_provider_api_key.py`

**Interfaces:**
- Produces: al crear/editar un proveedor `TUU` activo con `api_key`, `ValidationError({"api_key": "Esta API key ya está asignada al proveedor <nombre>."})` si otro proveedor TUU activo devuelve la misma key en `get_api_key()`.

- [ ] **Step 1: Write the failing tests**: `test_duplicate_tuu_key_rejected`, `test_same_key_allowed_when_other_inactive`, `test_editing_own_key_allowed`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(treasury): impedir API key TUU duplicada entre proveedores activos`.

## Etapa 3 — Frontend

### Task 8: Tipos, API, query keys y hooks

**Files:**
- Modify: `frontend/features/treasury/types/` (archivo donde viven `PaymentTerminalProvider`/`TerminalBatch`): agregar `TerminalSale`, `TerminalSaleDetail`, `TerminalSalesSummary`, `TerminalSyncRun`, `TerminalSyncSettings`, `TerminalSaleFilters`, `ManualSyncPayload` con los campos de Task 6 (montos como `string`, fechas ISO `string`, uniones literales para `status`/`payment_type`/`trigger`).
- Modify: `frontend/features/treasury/api/treasuryApi.ts` — `getTerminalSales(params)`, `getTerminalSale(id)`, `getTerminalSalesSummary(params)`, `getTerminalSyncRuns(params)`, `startTerminalSync(payload, idempotencyKey)`, `getTerminalSyncSettings()`, `updateTerminalSyncSettings(patch)`.
- Modify: `frontend/features/treasury/hooks/queryKeys.ts` — `TERMINAL_SALES_KEYS` y `TERMINAL_SYNC_KEYS` con el patrón `all/list/detail` existente.
- Create: `frontend/features/treasury/hooks/useTerminalSales.ts` (`useTerminalSales(filters)`, `useTerminalSalesSummary(filters)`, `useTerminalSale(id)`), `frontend/features/treasury/hooks/useTerminalSync.ts` (`useTerminalSyncRuns()`, `useStartTerminalSync()` que invalida ventas+runs y muestra toast "Sincronización en curso", `useTerminalSyncSettings()`, `useUpdateTerminalSyncSettings()`).
- Modify: `frontend/features/treasury/index.ts` (exportar hooks y tipos nuevos).
- Test: `frontend/features/treasury/hooks/__tests__/useTerminalSales.test.ts`

- [ ] **Step 1: Write the failing test**: `useTerminalSales` arma params (`payment_type`, `document_type`, `date_from`, `date_to`) y devuelve `sales: []` por defecto; `useStartTerminalSync` envía header `Idempotency-Key` (mock de `treasuryApi`).
- [ ] **Step 2: Run** `npm run test -- features/treasury/hooks/__tests__/useTerminalSales.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Seguir `useTerminalBatches.ts` (staleTime, `showApiError`, `invalidateCrossFeature`) y el patrón de idempotencia de `docs/20-contracts/idempotency.md`.
- [ ] **Step 4: Run** test + `npm run type-check` → PASS.
- [ ] **Step 5: Commit** `feat(treasury): hooks y API de ventas TUU (frontend)`.

### Task 9: Pestaña Ventas (entidad, ClientView, drawer, modal de sincronización)

**Files:**
- Create: `frontend/features/treasury/entity-view/terminalSale.entity.ts`
- Create: `frontend/features/treasury/components/TerminalSalesClientView.tsx`, `TerminalSaleDrawer.tsx`, `TerminalSyncModal.tsx`, `TerminalSyncModal.schema.ts`
- Create: `frontend/app/(dashboard)/treasury/terminal-cobro/sales/page.tsx` (+ `loading.tsx` según `component-skeleton.md`)
- Modify: `frontend/features/treasury/navigation.ts` (`TERMINAL_COBRO_SUB_TABS`: agregar `{ value: "sales", label: "Ventas", href: "/treasury/terminal-cobro/sales", iconName: "receipt", headerTitle: "Ventas del terminal de cobro", headerDescription: "Ventas sincronizadas desde los proveedores TUU.", metadataTitle: "Ventas del terminal de cobro | ERPGrafico" }` como **último** sub-tab; actualizar `headerDescription` del tab padre para mencionar ventas), `frontend/features/treasury/index.ts`
- Test: `frontend/features/treasury/components/__tests__/TerminalSalesClientView.test.tsx`, `TerminalSyncModal.schema.test.ts`

**Interfaces:**
- Consumes: hooks de Task 8.
- Produces:
  - `terminalSaleEntity` (`label: "treasury.terminalsale"`) con campos: `transactionAt` (fecha+hora), `saleId` (code), `sequenceNumber` (code), `provider`, `device`, `paymentType` (status chip), `documentType` (`document_type_label`), `cardBrand`, `cardIssuer`, `totalAmount` (money), `commissionAmount` (money negativo como en `terminalBatch.entity.tsx`), `netAmount` (money), `settlementDate`, `status` (status). Tabla por defecto: `transactionAt, saleId, paymentType, documentType, cardIssuer, totalAmount, commissionAmount, netAmount, settlementDate, status`.
  - `TerminalSyncModal` (react-hook-form + zod): campos `start_date`, `end_date` opcionales; schema rechaza `end_date` futura y `start_date > end_date` con mensajes "La fecha final no puede ser futura" y "La fecha inicial debe ser anterior a la final".
  - ClientView: filtros (rango de fechas por defecto = últimos 7 días, proveedor, tipo de pago, tipo de documento, estado), tarjeta de resumen del período (`count`, `gross`, `commission`, `net`, y `non_completed` si > 0), botón "Sincronizar ahora" que abre el modal, fila → `TerminalSaleDrawer` (todos los campos, ítems, reconciliaciones, bloque plegable "Datos originales" con `raw` en `<pre>`). Paginación server-side.
  - Estado vacío sin sincronizaciones: texto "Aún no hay ventas sincronizadas. Activa la sincronización en Tesorería → Configuración o usa «Sincronizar ahora»."

- [ ] **Step 1: Write the failing tests**: schema del modal (fecha futura y orden invertido rechazados; ambos vacíos válidos); ClientView renderiza el resumen con montos del hook mockeado y muestra el estado vacío con el texto exacto.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** consultando `component-entity-view.md`, `component-entity-drawers.md`, `component-decision-tree.md` y `TerminalBatchesClientView.tsx` como referencia. **Step 4: Run** tests + `npm run type-check` + `npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat(treasury): pestaña Ventas del terminal de cobro`.

### Task 10: Pestaña Configuración de Tesorería

**Files:**
- Modify: `frontend/features/treasury/navigation.ts` — `TREASURY_CONFIG_SUB_TABS = [{ value: "terminal-cobro", label: "Terminal de cobro", href: "/treasury/settings/terminal-cobro", iconName: "credit-card", headerTitle: "Configuración del terminal de cobro", headerDescription: "Sincronización automática de ventas con TUU.", metadataTitle: "Configuración del terminal de cobro | ERPGrafico" }]`; nuevo tab al final de `TREASURY_TABS`: `{ value: "config", label: "Configuración", href: "/treasury/settings", iconName: "settings", headerTitle: "Configuración", headerDescription: "Parámetros del módulo de Tesorería.", metadataTitle: "Configuración | ERPGrafico", subTabs: TREASURY_CONFIG_SUB_TABS }`; `getTreasuryConfigSubTab(value)` como `getHRConfigSubTab`.
- Create: `frontend/app/(dashboard)/treasury/settings/page.tsx` (redirect a `/treasury/settings/terminal-cobro`), `frontend/app/(dashboard)/treasury/settings/terminal-cobro/page.tsx`, `loading.tsx`
- Create: `frontend/features/settings/components/TreasurySettingsView.tsx`, `TreasurySettingsView.schema.ts`; export en `frontend/features/settings/index.ts`
- Test: `frontend/features/settings/components/TreasurySettingsView.schema.test.ts`

**Interfaces:**
- Consumes: `useTerminalSyncSettings`, `useUpdateTerminalSyncSettings`, `useTerminalSyncRuns` (Task 8) vía `@/features/treasury`.
- Produces: panel con `useAutoSaveForm` + `AutoSaveStatusBadge` (playbook `add-settings-panel.md`), campos `enabled` (switch "Sincronización automática"), `run_hour` (0–23, "Hora de ejecución"), `lookback_days` (1–60, "Días hacia atrás a revisar"), `history_start_date` ("Fecha de inicio del historial"), `max_retries` (0–10), `retry_delay_minutes` (1–120); bloque "Última ejecución" y lista de las últimas 10 ejecuciones (proveedor, origen, rango, estado con `StatusBadge`, contadores, error). Si no hay proveedores TUU con API key, aviso con enlace a `/treasury/terminal-cobro/providers`.

- [ ] **Step 1: Write the failing test**: schema acepta defaults, rechaza `run_hour` 24, `lookback_days` 0 y 61, `retry_delay_minutes` 0.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** test + `npm run type-check` + `npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat(treasury): pestaña Configuración con sincronización TUU`.

## Etapa 4 — Verificación integral

### Task 11: Prueba end-to-end en el servidor de desarrollo y documentación

**Files:**
- Modify: `docs/20-contracts/` que corresponda si se agregaron filas (deletion-policy en Task 1) y la sección de navegación de Tesorería en `docs/20-contracts/module-layout-navigation.md` si enumera tabs.

- [ ] **Step 1:** Confirmar `mutagen sync list` → `erpgrafico-sync … Connected: Yes` (si no, `mutagen project start`; si sigue caído, avisar al usuario y parar).
- [ ] **Step 2:** En el servidor: `docker compose exec backend python manage.py migrate` y reiniciar `celery-worker` y `celery-beat`; verificar `celery -A config inspect registered` lista `treasury.tasks.dispatch_terminal_sales_sync` y `treasury.tasks.sync_terminal_run`.
- [ ] **Step 3:** Pedir al usuario que cargue una API key **nueva** en su proveedor TUU (Tesorería → Terminal de cobro → Proveedores). No usar las keys de la conversación.
- [ ] **Step 4:** Desde la UI, "Sincronizar ahora" con rango 2026-10-26..2026-10-26 → 47 ventas, 3 con "Factura afecta", resumen bruto 244.860 y comisión 3.663 (valores observados el 2026-11-13; si TUU cambió datos, documentar la diferencia). Repetir la sincronización → sigue en 47 (sin duplicados).
- [ ] **Step 5:** Activar la sincronización con `run_hour` = hora actual, esperar el siguiente `:10` y confirmar en la pestaña Configuración una ejecución `SCHEDULED` en `SUCCESS`.
- [ ] **Step 6:** Correr `npm run type-check`, `npm run lint`, `npm run test -- features/treasury features/settings` y `... pytest treasury/tests core/tests -q`; todo en verde.
- [ ] **Step 7: Commit** `docs(treasury): contratos actualizados para sincronización TUU`.
