# Importación RCV (SII vía SimpleAPI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar el Registro de Compras y Ventas del SII (SimpleAPI, clave SII) a la app `accounting`, guardando
documentos, importaciones y resúmenes, con rotación de API keys gratuitas, importación automática/manual y pantallas en
Contabilidad > RCV y Contabilidad > Configuración > RCV / SII.

**Architecture:** Mismo patrón que la sincronización TUU (`backend/treasury/terminal_sync_service.py`,
`treasury/integrations/tuu_client.py`, `TerminalSyncRun`, `TerminalSalesClientView`): cliente HTTP aislado +
normalizador puro + servicio con upsert bajo `@transaction.atomic` + tarea Celery despachadora horaria + ViewSets
delgados + entidades `defineEntity` y ClientViews en `features/accounting`.

**Tech Stack:** Django 5 + DRF, Celery, `requests`, `core/crypto.py` (Fernet); Next.js 16, TanStack Query, Zod,
react-hook-form, `@/components/entity-view`.

**Spec:** `docs/superpowers/specs/2026-11-14-rcv-importacion-simpleapi-design.md` (leer completo antes de cada tarea).

## Global Constraints

- Endpoint `https://servicios.simpleapi.cl/api/rcv-clavesii/{ventas|compras}/{mes}/{anio}`, POST `multipart/form-data`,
  campo `input` = JSON `{"RutEmpresa","RutUsuario","PasswordSII","Ambiente":1,"Detallado":false,"ProcesaBoletas":true}`,
  header `Authorization: <key>` sin prefijo. Nunca usar `/api/rcvempresas/` (caduca 01-01-2027). Mes con dos dígitos.
- Timeout HTTP ≥ 180 s. Pausa ≥ 15 s entre dos consultas consecutivas.
- Clave SII y API keys cifradas con `core.crypto.encrypt_secret`/`decrypt_secret`; nunca en logs, respuestas de API,
  `raw_response`, `error_message` ni request guardado. Tests y fixtures usan solo valores ficticios
  (p. ej. key `TEST-KEY-0000-0000-4472`, clave `clave-de-prueba`, RUT empresa `11111111-1`).
- `monthly_limit` por key default **10**. Período automático = mes/año de (fecha local de ejecución − **3** días).
- Programación default: `enabled=False`, `interval_days=7`, `run_hour=6`, `include_purchases=True`, `include_sales=True`.
- Montos `DecimalField(max_digits=14, decimal_places=0)`, nunca float. Fechas sin zona → `America/Santiago`.
- Vacíos del SII: `null`, `""` y `"-"` → `""`/`None`. Aceptar `tipoDte` (ventas) y `tipoDTE` (compras).
- Permisos: `view_*` → `accounting.read` (regla mecánica); escritura de `rcvsettings`, `rcvapikey` y `add_rcvimport`
  → `accounting.manage` vía `OVERRIDES`.
- Invariantes de `CLAUDE.md`: zero `any`, tokens semánticos, barrels, hooks en `features/*/hooks`, vistas ≤ 20 líneas,
  zero N+1, RHF + Zod con schema en archivo propio, `StatusBadge` para estados. Textos de UI en español de Chile.
- Tests backend: `cd backend && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q`.
  Tests frontend: Node 24 vía nvm, `cd frontend && npm run test -- <ruta>`.

## Review Focus

1. **Clave SII errónea con varias keys**: corta en el primer intento sin tocar las demás keys (test en Task 4).
2. **Detalle truncado** (detalle ≠ resumen en un tipo con detalle): `SUCCESS` + advertencia, sin marcar faltantes (Task 4).
3. **Dos importaciones simultáneas del mismo período/dirección**: la segunda se rechaza (Task 4 y Task 6).
4. **Key agotada al cambiar de mes**: `exhausted_until` vencido la vuelve elegible el día 1 (Task 4).
5. **Documento faltante que reaparece**: se limpia `missing_since_import` (Task 4).

---

### Task 1: Modelos, migración, permisos y caché

**Files:**
- Modify: `backend/accounting/models.py` (al final, sección `# ── RCV (SII vía SimpleAPI) ──`)
- Create: migración generada `backend/accounting/migrations/00XX_rcv_import.py`
- Modify: `backend/core/cache.py` (`CACHE_KEY_RCV_SETTINGS = "settings:rcv"` junto a `CACHE_KEY_TERMINAL_SYNC_SETTINGS`)
- Modify: `backend/core/rbac/bundles.py` (`OVERRIDES`)
- Modify: `docs/20-contracts/permission-config-entities.md` (`RCVSettings` en Clase A, `RCVApiKey` en Clase B)
- Test: `backend/accounting/tests/test_rcv_models.py`

**Interfaces:**
- Produces (en `accounting.models`, heredando `TimeStampedModel` como `TerminalSyncRun`):
  - `RCVSettings`: `company_rut: CharField(12)`, `user_rut: CharField(12)`, `sii_password_encrypted: TextField(blank)`,
    `enabled`, `interval_days (1–60)`, `run_hour (0–23)`, `include_purchases`, `include_sales`; `save()` fuerza `pk=1`
    e invalida caché; `get_settings()` (como `TerminalSyncSettings`); `set_sii_password(plain: str) -> None`;
    `get_sii_password() -> str`; `has_sii_password: bool` (property). `FormMeta.exclude_fields = ["sii_password_encrypted"]`.
  - `RCVApiKey`: `label: CharField(60, blank)`, `key_encrypted: TextField`, `key_last4: CharField(4)`, `is_active=True`,
    `monthly_limit: PositiveSmallIntegerField(default=10, 1–1000)`, `exhausted_until: DateField(null)`,
    `last_used_at: DateTimeField(null)`, `last_error: TextField(blank)`; `set_key(plain) -> None` (cifra y fija
    `key_last4`), `get_key() -> str`, `masked_key: str` (property, `"••••-" + key_last4`).
    `FormMeta.exclude_fields = ["key_encrypted"]`.
  - `RCVImport`: `Direction` (`PURCHASES` "Compras", `SALES` "Ventas"), `Trigger` (`SCHEDULED` "Automática",
    `MANUAL` "Manual"), `Status` (`QUEUED` "En cola", `RUNNING` "En curso", `SUCCESS` "Exitosa", `FAILED` "Fallida");
    campos `direction`, `year`, `month`, `trigger`, `status` (default QUEUED), `triggered_by` (FK user SET_NULL),
    `started_at`/`finished_at` (null), `error_code: CharField(20, blank)`, `error_message`, `warnings` (JSON list),
    `received_count`, `created_count`, `updated_count`, `missing_count`, `api_key` (FK `RCVApiKey` SET_NULL null,
    related `+`), `raw_response` (JSON dict). `ordering = ["-created_at"]`; índice `(direction, year, month, status)`.
    `period: str` (property, `"202610"`).
  - `RCVImportAttempt`: `Outcome` (`OK`, `QUOTA_EXHAUSTED`, `RATE_LIMITED`, `AUTH_KEY`, `AUTH_SII`, `TRANSIENT`, `OTHER`);
    `rcv_import` (FK CASCADE, related `attempts`), `api_key` (FK SET_NULL null, related `attempts`), `http_status`,
    `outcome`, `duration_ms`, `error_message`, `rate_limit_remaining (null)`. `ordering = ["id"]`.
  - `RCVImportSummary`: `rcv_import` (FK CASCADE, related `summaries`), `dte_type`, `dte_type_label`, `document_count`,
    `exempt_amount`, `net_amount`, `vat_recoverable`, `vat_common_use`, `vat_non_recoverable`, `total_amount`,
    `status: CharField(30, blank)`, `has_detail`, `detail_count`, `detail_total`. `ordering = ["dte_type"]`.
  - `RCVDocument`: campos de "Modelos" del spec — `direction`, `company_rut`, `period: CharField(6)`, `dte_type`,
    `dte_type_label`, `folio: BigIntegerField`, `counterparty_rut`, `counterparty_name`, `issue_date`, `received_at`,
    `acknowledged_at`, `operation_type`, `status`, `acknowledgement`, `service_indicator (null)`, `exempt_amount`,
    `net_amount`, `vat_amount`, `vat_recoverable`, `vat_non_recoverable`, `total_amount`, `other_taxes_total`,
    `reference_dte_type (null)`, `reference_folio`, `raw` (JSON), `first_import`/`last_import` (FK `RCVImport` PROTECT,
    related `+`), `missing_since_import` (FK SET_NULL null, related `+`).
    `UniqueConstraint(fields=["company_rut","direction","dte_type","folio","counterparty_rut"], name="rcvdocument_natural_key_uniq")`;
    índices `(direction, period)` y `(direction, issue_date)`; `ordering = ["-issue_date", "-folio"]`.

- [ ] **Step 1: Write the failing tests** in `test_rcv_models.py`:
  - `test_settings_singleton_and_password_roundtrip`: `set_sii_password("clave-de-prueba")` + `save()` → 1 fila,
    `get_settings().get_sii_password() == "clave-de-prueba"`, el texto no aparece en `sii_password_encrypted`,
    `has_sii_password is True`.
  - `test_api_key_masked`: `set_key("TEST-KEY-0000-0000-4472")` → `masked_key == "••••-4472"`, `get_key()` devuelve el
    original, `monthly_limit == 10`.
  - `test_document_natural_key_unique`: misma clave natural → `IntegrityError`; mismo folio con otro `dte_type` → OK.
  - `test_import_period`: `RCVImport(year=2026, month=3).period == "202603"`.
  - `test_rcv_permissions_bundles` (con `core.rbac.bundles.expand`): `"accounting.view_rcvdocument"` ∈ `expand(["accounting.read"])`;
    `"accounting.add_rcvimport"` ∉ `expand(["accounting.operate"])` y ∈ `expand(["accounting.manage"])`; ídem
    `change_rcvsettings`, `add_rcvapikey`, `change_rcvapikey`, `delete_rcvapikey`.
- [ ] **Step 2: Run** `... pytest accounting/tests/test_rcv_models.py -q` → FAIL (ImportError).
- [ ] **Step 3: Implement** modelos (cifrado como `PaymentTerminalProvider.get_api_key/set_api_key`), caché, y en
  `OVERRIDES`: `accounting.add_rcvsettings`, `accounting.change_rcvsettings`, `accounting.add_rcvapikey`,
  `accounting.change_rcvapikey`, `accounting.delete_rcvapikey`, `accounting.add_rcvimport` → `["accounting.manage"]`.
  Migración: `DEBUG=1 venv/bin/python manage.py makemigrations accounting -n rcv_import`. Actualizar el contrato.
- [ ] **Step 4: Run** Step 2 → PASS; `... pytest core/tests -q -k "rbac or bundle or permission"` → PASS.
- [ ] **Step 5: Commit** `feat(accounting): modelos de importación RCV (SimpleAPI)`.

---

### Task 2: Normalizador de respuestas y RUT

**Files:**
- Create: `backend/accounting/integrations/__init__.py`, `backend/accounting/integrations/rcv_normalizer.py`
- Create: `backend/accounting/tests/fixtures/rcv_ventas_202610.json`, `backend/accounting/tests/fixtures/rcv_compras_202610.json`
- Test: `backend/accounting/tests/test_rcv_normalizer.py`

**Interfaces:**
- Produces (`accounting.integrations.rcv_normalizer`):
  - `normalize_rut(value: str | None) -> str` — sin puntos/espacios, DV mayúscula, `"8973356-1"`; `""` si vacío.
  - `is_valid_rut(value: str) -> bool` — módulo 11.
  - `NormalizedSummary` (dataclass frozen): `dte_type: int, dte_type_label: str, document_count: int, exempt_amount,
    net_amount, vat_recoverable, vat_common_use, vat_non_recoverable, total_amount: Decimal, status: str`.
  - `NormalizedDocument` (dataclass frozen): un atributo por campo de datos de `RCVDocument` (sin FKs, `period`,
    `company_rut`, `direction`) + `raw: dict`.
  - `NormalizedReport` (dataclass frozen): `period: str, company_rut: str, summaries: list[NormalizedSummary],
    documents: list[NormalizedDocument]`.
  - `normalize_report(direction: str, body: dict) -> NormalizedReport` — `"PURCHASES"` lee `body["compras"]`
    (`detalleCompras`), `"SALES"` lee `body["ventas"]` (`detalleVentas`); `period` de `caratula.periodo`.
  - `class RCVFormatError(ValueError)` — sin `caratula` o sin la sección esperada.

**Fixtures** (ficticias, con la forma exacta de las respuestas reales del 2026-11-14 y los nombres de campo del spec):
- Ventas: carátula `{"rutEmpresa":"11111111-1","nombreMes":"Octubre","mes":10,"anio":2026,"dia":null,"periodo":"202610"}`;
  resúmenes 33 (2 docs, neto 62185, iva 11815, total 74000), 39 (2 docs, neto 8319, iva 1581, total 9900),
  48 (401 docs, neto 1730850, iva 328860, total 2059710); detalle: facturas 6446 (`77195849-4`, "CLIENTE UNO SPA",
  42017/7983/50000, `fechaRecepcion` `"2026-10-01T10:20:34"`, `rutEmisorLiqFactura` `"-"`, `folioDocReferencia` `""`)
  y 6447 (`76354051-0`, "CLIENTE DOS LTDA", 20168/3832/24000); boletas 72012 (7647/1453/9100) y 72013 (672/128/800)
  con `rutCliente` `66666666-6`, `razonSocial` null, `fechaRecepcion` null, `indicadorServicio` 3, opcionales `null`.
- Compras: resumen 33 (2 docs, neto 63455, iva 12056, total 75511, estado "Confirmada"); detalle 1204055
  (`78950040-1`, "PROVEEDOR UNO SPA", 43042/8178/51220, "No reclamado en plazo", `fechaAcuse` null) y 1205605
  (mismo proveedor, 20413/3878/24291, "Recibo otorgado por el receptor", `fechaAcuse` `"2026-10-13T08:39:00"`),
  usando la clave **`tipoDTE`**.

- [ ] **Step 1: Write the failing tests**:
  - `test_normalize_rut`: `"8.973.356-1" → "8973356-1"`, `"77448566-k" → "77448566-K"`, `None → ""`;
    `is_valid_rut("8973356-1")` y `is_valid_rut("89733561-1")` True, `is_valid_rut("8973356-2")` False.
  - `test_sales_report`: `period == "202610"`, 3 resúmenes (el 48 con `document_count == 401`), 4 documentos;
    6446: `counterparty_name == "CLIENTE UNO SPA"`, `issue_date == date(2026,10,1)`, `received_at` aware 10:20:34
    Chile, `vat_amount == Decimal("7983")`, `operation_type == "Del Giro"`; 72012: `counterparty_name == ""`,
    `received_at is None`, `service_indicator == 3`, `reference_dte_type is None`.
  - `test_purchases_report`: `dte_type == 33` (desde `tipoDTE`), `acknowledgement == "No reclamado en plazo"`,
    `acknowledged_at` aware en 1205605 y `None` en 1204055, `vat_recoverable == Decimal("8178")`.
  - `test_dash_and_empty_become_blank`: en 6446, `raw["rutEmisorLiqFactura"] == "-"` y `reference_folio == ""`.
  - `test_missing_section_raises`: `normalize_report("SALES", {"caratula": {...}})` → `RCVFormatError`.
- [ ] **Step 2: Run** `... pytest accounting/tests/test_rcv_normalizer.py -q` → FAIL.
- [ ] **Step 3: Implement** funciones puras, sin ORM; fechas con `ZoneInfo("America/Santiago")`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(accounting): normalizador de respuestas RCV`.

---

### Task 3: Cliente HTTP de SimpleAPI

**Files:**
- Create: `backend/accounting/integrations/simpleapi_client.py`
- Test: `backend/accounting/tests/test_simpleapi_client.py`

**Interfaces:**
- Produces (`accounting.integrations.simpleapi_client`):
  - `BASE_URL = "https://servicios.simpleapi.cl"`, `TIMEOUT_SECONDS = 180`.
  - `SimpleApiResponse` (dataclass frozen): `http_status: int, body: dict, duration_ms: int,
    rate_limit_remaining: int | None, rate_limit_reset: datetime | None`.
  - `SimpleApiError(Exception)`: `__init__(self, outcome: str, message: str, http_status: int = 0, duration_ms: int = 0,
    rate_limit_remaining: int | None = None, rate_limit_reset: datetime | None = None)`; `outcome` ∈ `RCVImportAttempt.Outcome`.
  - `classify_error(http_status: int, body_text: str) -> str` (pura).
  - `SimpleApiRcvClient(api_key: str, session: requests.Session | None = None).fetch(direction: str, year: int,
    month: int, company_rut: str, user_rut: str, password: str) -> SimpleApiResponse` (lanza `SimpleApiError`).

Clasificación conservadora (texto en minúsculas sin acentos; ver "Lo que queda al builder" del spec):
`429` → `RATE_LIMITED`; `401/402/403` con "limite", "cupo", "plan", "consultas" o "quota" → `QUOTA_EXHAUSTED`;
cualquier status con ("clave" | "contrasena" | "password" | "autentic") y "sii" → `AUTH_SII`; `401/403` restante →
`AUTH_KEY`; `5xx`, timeout, conexión → `TRANSIENT`; resto (incluido 200 no-JSON) → `OTHER`. El `message` trunca el
cuerpo a 300 caracteres y reemplaza la key y la clave por `"***"`.

- [ ] **Step 1: Write the failing tests** (mock de `requests.Session.post`, como `treasury/tests/test_tuu_client.py`):
  - `test_fetch_builds_request`: URL `.../api/rcv-clavesii/ventas/03/2026`, header `{"Authorization": key}`,
    multipart con `input` cuyo JSON tiene `RutEmpresa`, `RutUsuario`, `PasswordSII`, `Ambiente == 1`,
    `Detallado is False`, `ProcesaBoletas is True`, `timeout=180`; `direction="PURCHASES"` → `/compras/`.
  - `test_fetch_parses_rate_limit_headers`: `x-rate-limit-remaining: 99`, `x-rate-limit-reset: 2026-11-14T05:25:12.3869456Z`
    → `99` y datetime aware.
  - `test_classify_error`: parametrizado con cada fila de la clasificación.
  - `test_error_message_hides_secrets`: cuerpo 500 que contiene key y clave → ninguna aparece en `str(err)`.
  - `test_timeout_is_transient` y `test_non_json_200_is_other`.
- [ ] **Step 2: Run** `... pytest accounting/tests/test_simpleapi_client.py -q` → FAIL.
- [ ] **Step 3: Implement**; `input` como campo multipart: `files={"input": (None, json.dumps(payload))}`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(accounting): cliente HTTP de SimpleAPI RCV`.

---

### Task 4: Servicio de importación (keys, ejecución, upsert, faltantes)

**Files:**
- Create: `backend/accounting/rcv_service.py`
- Modify: `backend/accounting/selectors.py` (`rcv_key_usage(month_start: date) -> dict[int, int]`)
- Create: `backend/accounting/tests/rcv_helpers.py`
- Test: `backend/accounting/tests/test_rcv_service.py`

**Interfaces:**
- Consumes: Task 1 (modelos), Task 2 (`normalize_report`, `NormalizedReport`, `RCVFormatError`), Task 3 (`SimpleApiRcvClient`, `SimpleApiError`, `SimpleApiResponse`).
- Produces (`accounting.rcv_service`):
  - `month_start(d: date) -> date`, `next_month_start(d: date) -> date`.
  - `create_imports(year: int, month: int, directions: list[str], trigger: str, user=None) -> list[RCVImport]` —
    `ValidationError` si existe `QUEUED`/`RUNNING` del mismo `(direction, year, month)` o si el período es futuro.
  - `select_api_key(today: date) -> RCVApiKey | None` — en transacción con `select_for_update()`; elegibles:
    `is_active`, `exhausted_until` nulo o `<= today`, uso del mes `< monthly_limit`; orden por uso ascendente e `id`.
  - `execute_import(rcv_import: RCVImport, client_factory: Callable[[str], SimpleApiRcvClient] = SimpleApiRcvClient,
    sleep: Callable[[float], None] = time.sleep) -> RCVImport`.
  - `apply_report(rcv_import: RCVImport, report: NormalizedReport) -> None` (`@transaction.atomic`).
  - Mensajes: `MISSING_CONFIG_MESSAGE`, `NO_KEYS_MESSAGE = "No hay API keys activas configuradas."`,
    `QUOTA_MESSAGE = "Sin cupo en las API keys hasta el {date:%d-%m-%Y}."`,
    `AUTH_SII_MESSAGE = "El SII rechazó la clave del usuario {rut}."`,
    `TRANSIENT_MESSAGE = "SimpleAPI o el SII no respondieron; se reintentará en la próxima ejecución."`.

Reglas de `execute_import` (spec, "Ejecución de una importación"): `RUNNING` + `started_at`; config incompleta →
`FAILED`, `error_code="CONFIG"`; bucle: sin key elegible → `FAILED` `"NO_QUOTA"` con `QUOTA_MESSAGE`
(`next_month_start(today)`) o `NO_KEYS_MESSAGE` si no hay activas; cada llamada registra un `RCVImportAttempt` y
actualiza `key.last_used_at`/`last_error`; `QUOTA_EXHAUSTED`/`AUTH_KEY` → `key.exhausted_until = next_month_start(today)`
y siguiente key; `RATE_LIMITED` → `sleep(min(segundos hasta reset, 60) o 60)` y reintenta la misma key hasta 2 veces,
luego `FAILED` `"RATE_LIMITED"`; `AUTH_SII` → `FAILED` `"AUTH_SII"` sin rotar; `TRANSIENT`/`OTHER` → `FAILED` con ese
código, sin reintentar; `OK` → `raw_response = body`, `apply_report` (`RCVFormatError` → `FAILED` `"FORMAT"`), `SUCCESS`.
Otra excepción → `FAILED` `"INTERNAL"` y relanzar. `finished_at` siempre.

Reglas de `apply_report`: recrear los `RCVImportSummary`; upsert por clave natural (`company_rut` normalizado de
`RCVSettings`, `period` de la carátula); nuevos → `first_import`; todos → `last_import`, `missing_since_import=None`;
contadores; por tipo del resumen con documentos en el detalle: `has_detail`, `detail_count`, `detail_total`. Si algún
tipo con detalle no cuadra en cantidad o total → advertencia `"El detalle del tipo {n} no cuadra con el resumen del SII
({detail_count}/{document_count} documentos)."` y **no** marcar faltantes; si todo cuadra → documentos del
`(company_rut, direction, period)` no recibidos y sin marca → `missing_since_import = rcv_import`, `missing_count`.
Sin N+1: existentes del período en un dict (una query) + `bulk_create`/`bulk_update`.

- [ ] **Step 1: Write the failing tests** (`rcv_helpers.py`: `make_rcv_settings()`, `make_api_key(key="TEST-KEY-1", **kw)`,
  `load_fixture(name) -> dict`, `FakeClient` con una secuencia de respuestas/errores por key; fecha fija 2026-11-14):
  - `test_import_sales_creates_documents_and_summaries`: `SUCCESS`, `received_count == created_count == 4`,
    3 resúmenes; 48 con `has_detail False`, `document_count 401`; 33 con `detail_count 2`, `detail_total == Decimal("74000")`;
    1 intento `OK`; `api_key` = la usada.
  - `test_reimport_updates_without_duplicates`: 6446 con total 51000 (resumen ajustado) → 4 documentos,
    `updated_count == 4`, `created_count == 0`, total 51000, `first_import` = la primera.
  - `test_missing_documents_are_flagged_and_cleared`: sin 72013 (resumen 39 = 1 doc) → marcado, `missing_count == 1`;
    tercera importación con 72013 → marca limpia.
  - `test_truncated_detail_warns_and_skips_missing`: resumen 39 = 2 docs, detalle 1 → `SUCCESS`, 1 advertencia,
    `missing_count == 0`, nada marcado.
  - `test_quota_exhausted_rotates_key`: K1 `QUOTA_EXHAUSTED`, K2 OK → `SUCCESS`, 2 intentos,
    `K1.exhausted_until == date(2026,12,1)`, `api_key == K2`.
  - `test_all_keys_exhausted_fails_with_date`: → `FAILED`, `"NO_QUOTA"`, mensaje con `"01-12-2026"`.
  - `test_sii_auth_error_does_not_rotate`: K1 `AUTH_SII` con K2 disponible → `FAILED` `"AUTH_SII"`, 1 intento, K2 sin uso.
  - `test_rate_limit_retries_same_key`: K1 `RATE_LIMITED` y luego OK → `SUCCESS`, `sleep` 1 vez, 2 intentos con K1,
    K1 sin `exhausted_until`.
  - `test_transient_fails_without_retry`: `FAILED`, 1 intento.
  - `test_select_api_key_prefers_least_used_and_skips_full`: K1 con 10 intentos este mes → no; K2 (3) y K3 (1) → K3;
    K4 con `exhausted_until=date(2026,11,1)` → elegible.
  - `test_create_imports_rejects_running_duplicate`: `RUNNING` de `(SALES,2026,10)` → `ValidationError`;
    `(PURCHASES,2026,10)` se crea.
  - `test_missing_config_fails`: sin clave SII → `FAILED`, `"CONFIG"`, 0 intentos.
  - `test_secrets_never_persisted`: tras una exitosa y una fallida, ni key ni clave en `str(raw_response)`,
    `error_message`, `warnings` ni `RCVImportAttempt.error_message`.
  - `test_apply_report_query_count_constant`: `django_assert_max_num_queries` con 4 y con 40 documentos → igual.
- [ ] **Step 2: Run** `... pytest accounting/tests/test_rcv_service.py -q` → FAIL.
- [ ] **Step 3: Implement** `rcv_service.py` y `rcv_key_usage` (un `Count` agrupado por `api_key_id` con `created_at >= month_start`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(accounting): servicio de importación RCV con rotación de API keys`.

---

### Task 5: Programación y tareas Celery

**Files:**
- Modify: `backend/accounting/rcv_service.py`
- Create: `backend/accounting/tasks.py`
- Modify: `backend/config/settings.py` (`CELERY_BEAT_SCHEDULE`, junto a `dispatch_terminal_sales_sync_hourly`)
- Test: `backend/accounting/tests/test_rcv_scheduling.py`

**Interfaces:**
- Consumes: Task 4 (`create_imports`, `execute_import`, `next_month_start`).
- Produces:
  - `rcv_service.period_for(run_date: date) -> tuple[int, int]` — mes/año de `run_date - timedelta(days=3)`.
  - `rcv_service.is_scheduled_run_due(settings: RCVSettings, now_local: datetime, last_scheduled: date | None) -> bool`
    — `enabled` y `now_local.hour >= run_hour` y (`last_scheduled is None` o `(now_local.date() - last_scheduled).days >= interval_days`).
  - `rcv_service.scheduled_targets(today: date, directions: list[str]) -> list[tuple[int, int, str]]` — período de
    `period_for(today)` y, por dirección, el mes anterior a ese período si no hay `RCVImport` `SUCCESS` (cualquier
    origen) de esa dirección/mes con `started_at` local `>= next_month_start(mes anterior)`.
  - `rcv_service.estimated_monthly_queries(settings: RCVSettings) -> int` — `ceil(30 / interval_days) * n + n`.
  - `rcv_service.enqueue_imports(imports: list[RCVImport], delay) -> None` — una llamada `delay([ids])`; si el broker
    falla, todas `FAILED` con `error_code="ENQUEUE"`.
  - `accounting.tasks.dispatch_rcv_imports() -> int` — `@shared_task(name="accounting.tasks.dispatch_rcv_imports")`;
    si corresponde, crea importaciones `SCHEDULED` para `scheduled_targets` (omite las rechazadas por duplicado) y encola.
  - `accounting.tasks.run_rcv_imports(import_ids: list[int]) -> list[str]` —
    `@shared_task(name="accounting.tasks.run_rcv_imports")`; ejecuta en orden, `time.sleep(15)` entre una y otra.
  - Beat: `"dispatch_rcv_imports_hourly": {"task": "accounting.tasks.dispatch_rcv_imports", "schedule": crontab(minute=20)}`.

- [ ] **Step 1: Write the failing tests**:
  - `test_period_for`: `2026-11-02 → (2026,10)`, `2026-11-03 → (2026,10)`, `2026-11-04 → (2026,11)`,
    `2026-11-20 → (2026,11)`, `2027-01-02 → (2026,12)`.
  - `test_is_scheduled_run_due`: deshabilitado → False; hora 5 con `run_hour=6` → False; última hace 6 días con
    intervalo 7 → False; hace 7 → True; nunca → True.
  - `test_scheduled_targets_adds_previous_month_when_not_closed`: `today=2026-11-20` sin importaciones de octubre
    posteriores al 01-11 → octubre y noviembre por dirección; con `SUCCESS` de octubre `SALES` iniciada 2026-11-02 →
    `SALES` solo noviembre, `PURCHASES` ambos.
  - `test_estimated_monthly_queries`: intervalo 7 ambas → 12; intervalo 30 solo ventas → 2.
  - `test_dispatch_creates_and_enqueues`: sin historial → retorna 4 y una sola llamada a `delay` con 4 ids; segunda
    llamada el mismo día → 0.
  - `test_run_rcv_imports_sequential`: dos ids, `sleep` llamado una vez con 15.
  - `test_beat_entry_matches_registered_task` (como `treasury/tests/test_terminal_sync_tasks.py:197`).
- [ ] **Step 2: Run** `... pytest accounting/tests/test_rcv_scheduling.py -q` → FAIL.
- [ ] **Step 3: Implement** (hora local con `timezone.localtime()`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(accounting): programación y tareas Celery de importación RCV`.

---

### Task 6: API REST

**Files:**
- Create: `backend/accounting/rcv_serializers.py`, `backend/accounting/rcv_views.py`
- Modify: `backend/accounting/selectors.py`, `backend/accounting/urls.py`
- Test: `backend/accounting/tests/test_rcv_api.py`

**Interfaces:**
- Consumes: Tasks 1, 2 (`is_valid_rut`, `normalize_rut`), 4, 5.
- Produces (bajo `/api/accounting/`; patrón de `TerminalSyncSettingsViewSet`, `TerminalSaleViewSet` y
  `TerminalSyncRunViewSet` en `backend/treasury/views.py:1806-1900`):
  - `GET rcv-documents/` (paginado `StandardResultsSetPagination`) con filtros `direction`, `year`, `month`, `dte_type`,
    `status`, `acknowledgement`, `missing`, `issue_date_from`, `issue_date_to`, `search` (RUT, razón social, folio);
    `GET rcv-documents/{id}/` con `raw`, `first_import`, `last_import`, `missing_since_import` (id + período).
  - `GET rcv-imports/` (filtros `direction`, `status`, `trigger`, `year`, `month`; sin `raw_response`);
    `GET rcv-imports/{id}/` con `summaries[]`, `attempts[]` (con `masked_key`) y `raw_response`.
  - `POST rcv-imports/start/` body `{"year": 2026, "month": 10, "directions": ["PURCHASES","SALES"]}` → 202 con las
    importaciones; `@idempotent_endpoint(scope="accounting.rcv_import.manual")`;
    `action_permissions = {"start": "accounting.add_rcvimport"}`; 400 con `detail` ante `ValidationError`; encola con
    `enqueue_imports(..., run_rcv_imports.delay)`.
  - `GET|PATCH rcv-settings/current/`: `company_rut`, `user_rut`, `sii_password` (write-only; vacío/omitido conserva),
    `has_sii_password`, `enabled`, `interval_days`, `run_hour`, `include_purchases`, `include_sales`; solo lectura
    `next_period: {"year","month"}`, `estimated_monthly_queries`, `total_monthly_quota` (suma de `monthly_limit` de keys
    activas). RUTs validados y guardados normalizados. Permisos `view_/change_rcvsettings` con `require_perms` como TUU.
  - `rcv-api-keys/` CRUD: `id`, `label`, `key` (write-only, requerido al crear), `masked_key`, `is_active`,
    `monthly_limit`, `used_this_month` (anotación), `exhausted_until`, `last_used_at`, `last_error`. Key duplicada
    (comparando descifrado) → `{"key": "Esta API key ya está registrada."}`.
  - Selectores: `rcv_documents_queryset(filters: dict)`, `rcv_imports_queryset(filters: dict)` (`select_related("api_key")`,
    `defer("raw_response")`), `rcv_import_detail_queryset()` (`prefetch_related("summaries", "attempts__api_key")`),
    `rcv_api_keys_queryset(month_start: date)`.
  - Rutas: `rcv-documents` (basename `rcvdocument`), `rcv-imports` (`rcvimport`), `rcv-settings` (`rcvsettings`),
    `rcv-api-keys` (`rcvapikey`).

- [ ] **Step 1: Write the failing tests** (usuarios con `expand(["accounting.read"])` y `expand(["accounting.manage"])`, como
  `treasury/tests/test_terminal_sales_api.py`):
  - `test_documents_list_filters`: `?direction=SALES&year=2026&month=10&dte_type=33` → solo facturas de venta;
    `?search=CLIENTE UNO` → 1; `?missing=true` → solo marcados.
  - `test_document_detail_includes_raw`.
  - `test_import_detail_has_summaries_attempts_and_masked_key`: el texto de la key no aparece en `resp.content`.
  - `test_start_import_enqueues`: manage → 202, 2 importaciones, `delay` llamado una vez; read → 403.
  - `test_start_import_duplicate_400`.
  - `test_settings_password_write_only`: PATCH `sii_password` → GET `has_sii_password: true` y sin la clave en la
    respuesta; PATCH sin `sii_password` conserva; `company_rut: "8.973.356-1"` → `"8973356-1"`; `"8973356-2"` → 400.
  - `test_settings_derived_fields`: `estimated_monthly_queries == 12` (default), `total_monthly_quota == 20` con 2 keys.
  - `test_api_keys_crud_masked_and_unique`: respuesta sin `key`, con `masked_key`; duplicada → 400; read → 403 al crear.
  - `test_list_endpoints_query_count`: `rcv-documents`, `rcv-imports`, `rcv-api-keys` con 3 y 30 filas → igual.
- [ ] **Step 2: Run** `... pytest accounting/tests/test_rcv_api.py -q` → FAIL.
- [ ] **Step 3: Implement** serializers (sin ORM en `SerializerMethodField`), selectores, viewsets (≤ 20 líneas por acción), rutas.
- [ ] **Step 4: Run** → PASS; `... pytest accounting core/tests/test_pagination_contract.py -q` → PASS; `venv/bin/ruff check accounting` limpio.
- [ ] **Step 5: Commit** `feat(accounting): API REST de importación RCV`.

---

### Task 7: Frontend — tipos, API, hooks, navegación y registro de entidades

**Files:**
- Create: `frontend/features/accounting/types/rcv.ts` (re-export en `types/index.ts`)
- Create: `frontend/features/accounting/api/rcvApi.ts` (re-export en `api/index.ts`)
- Create: `frontend/features/accounting/hooks/useRcvDocuments.ts`, `useRcvImports.ts`, `useRcvSettings.ts`
- Modify: `frontend/features/accounting/hooks/queryKeys.ts`, `frontend/features/accounting/navigation.ts`, `frontend/features/accounting/index.ts`
- Modify: `frontend/lib/entity-registry.ts`
- Test: `frontend/features/accounting/hooks/__tests__/useRcvImports.test.tsx`, `frontend/features/accounting/__tests__/rcvNavigation.test.ts`

**Interfaces:**
- Consumes: contrato de Task 6.
- Produces:
  - Tipos: `RcvDirection = "PURCHASES" | "SALES"`, `RcvImportStatus`, `RcvImportTrigger`, `RcvAttemptOutcome`,
    `RcvDocument`, `RcvDocumentDetail` (`raw: Record<string, unknown>`), `RcvImport`, `RcvImportSummary`,
    `RcvImportAttempt`, `RcvImportDetail`, `RcvSettings`, `RcvSettingsPatch`, `RcvApiKey`, `RcvApiKeyPayload`,
    `RcvDocumentFilters`, `RcvImportFilters`, `StartRcvImportPayload = { year: number; month: number; directions: RcvDirection[] }`.
    Montos como `string` (Decimal DRF), como en los tipos de TUU.
  - `rcvApi`: `getDocuments(filters, signal)`, `getDocument(id)`, `getImports(filters)`, `getImport(id)`,
    `startImport(payload, idempotencyKey)`, `getSettings()`, `updateSettings(patch)`, `getApiKeys()`,
    `createApiKey(payload)`, `updateApiKey(id, payload)`, `deleteApiKey(id)`.
  - `RCV_KEYS`: `all`, `documents()`, `document(id)`, `imports()`, `import(id)`, `settings()`, `apiKeys()`.
  - Hooks: `useRcvDocuments(filters)`, `useRcvDocument(id)`, `useRcvImports(filters)`, `useRcvImport(id)`
    (`refetchInterval` 5 s mientras `QUEUED`/`RUNNING`), `useStartRcvImport()` (patrón `useStartTerminalSync`:
    `useIdempotencyKey`, invalida `RCV_KEYS.all`, toast "Importación en curso"), `useRcvSettings()`,
    `useUpdateRcvSettings()`, `useRcvApiKeys()`, `useRcvApiKeyMutations()` (`create`, `update`, `remove`).
  - Navegación: `RCV_SUB_TABS` (`purchases` "Compras" `/accounting/rcv/purchases`, `sales` "Ventas"
    `/accounting/rcv/sales`, `imports` "Importaciones" `/accounting/rcv/imports`); tab `rcv` "Registro de Compras y
    Ventas" en `ACCOUNTING_TABS` tras `closures` (`href: "/accounting/rcv"`); `getRcvSubTab(value)`; sub-tab `rcv`
    "RCV / SII" en `ACCOUNTING_CONFIG_SUB_TABS` (`/accounting/settings/rcv`); actualizar `headerDescription` de Configuración.
  - Registro: `accounting.rcvdocument` ("Documento RCV", `listUrl` `/accounting/rcv/purchases`, `detailUrlPattern`
    `/accounting/rcv/purchases?selected={id}`), `accounting.rcvimport` ("Importación RCV", `/accounting/rcv/imports?selected={id}`).

- [ ] **Step 1: Write the failing tests**: `useStartRcvImport` envía `Idempotency-Key` y la reutiliza en un reintento con
  el mismo payload (mock de `rcvApi`); `getRcvSubTab("sales")?.href === "/accounting/rcv/sales"` y
  `getAccountingConfigSubTab("rcv")` definido.
- [ ] **Step 2: Run** `npm run test -- features/accounting` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS; `npm run type-check` limpio.
- [ ] **Step 5: Commit** `feat(accounting): capa de datos y navegación RCV en frontend`.

---

### Task 8: Frontend — listados Compras/Ventas y drawer del documento

**Files:**
- Create: `frontend/features/accounting/entity-view/rcvDocument.entity.ts`
- Modify: `frontend/features/accounting/unifiedSearchDef.ts`
- Create: `frontend/features/accounting/components/rcv/RcvDocumentsClientView.tsx`, `RcvDocumentDrawer.tsx`
- Modify: `frontend/features/accounting/components/index.ts`, `frontend/features/accounting/index.ts`, `frontend/lib/entity-drawers.tsx`
- Create: `frontend/app/(dashboard)/accounting/rcv/page.tsx` (redirect a `/accounting/rcv/purchases`), `rcv/loading.tsx`, `rcv/purchases/page.tsx`, `rcv/sales/page.tsx`
- Test: `frontend/features/accounting/components/__tests__/RcvDocumentsClientView.test.tsx`, `RcvDocumentDrawer.test.tsx`

**Interfaces:**
- Consumes: Task 7.
- Produces:
  - `rcvDocumentEntity`, `rcvPurchaseViews`, `rcvSaleViews`. Compras: `issueDate`, `dteType` ("33 · Factura
    Electrónica"), `folio`, `counterpartyRut`, `counterpartyName` ("Proveedor"), `net`, `vat` (`vat_recoverable`),
    `total`, `acknowledgement`, `receivedAt`, `missing` (badge "No vino en la última importación"). Ventas: igual con
    "Cliente", `vat` = `vat_amount`, sin `acknowledgement`. Montos `f.money`; acuse/faltante `f.status`.
  - `rcvDocumentUnifiedSearchDef`: búsqueda `search`; filtros `year`, `month`, `dte_type` (33, 34, 39, 41, 46, 52,
    56, 61, etiquetas como `terminalSaleUnifiedSearchDef`), `acknowledgement` (solo compras), `missing`.
  - `RcvDocumentsClientView({ direction }: { direction: RcvDirection })` — patrón `TerminalSalesClientView`
    (paginación de servidor, `EntityPanelTab label="accounting.rcvdocument"`, sin período por defecto). Vacío:
    "Aún no hay documentos importados" / "Configura el RCV en Contabilidad → Configuración → RCV / SII o importa desde
    la pestaña Importaciones." con acción a `/accounting/rcv/imports`.
  - `RcvDocumentDrawer({ id, open, onOpenChange, mode? })` — patrón `TerminalSaleDrawer`, solo lectura, sin pestaña
    de relaciones. Secciones: Identificación, Fechas (emisión, recepción SII, acuse), Montos (exento, neto, IVA, IVA no
    recuperable, otros impuestos, total), Estado (estado, acuse, indicador de servicio, referencia), Importación
    (primera/última con `openEntity("accounting.rcvimport", id)`, aviso si faltante), "Datos originales" plegable.

- [ ] **Step 1: Write the failing tests**: compras muestra la columna de acuse y ventas no; estado vacío con el texto
  indicado; drawer muestra "Recibo otorgado por el receptor" y el enlace a la importación; drawer en error muestra
  "No se pudo cargar el documento".
- [ ] **Step 2: Run** `npm run test -- features/accounting/components` → FAIL.
- [ ] **Step 3: Implement** (páginas con metadata vía `getRcvSubTab`, como `treasury/terminal-cobro/sales/page.tsx`).
- [ ] **Step 4: Run** → PASS; `npm run type-check && npm run lint` limpios.
- [ ] **Step 5: Commit** `feat(accounting): listados RCV de compras y ventas con ficha`.

---

### Task 9: Frontend — importaciones (listado, drawer, modal "Importar ahora")

**Files:**
- Create: `frontend/features/accounting/entity-view/rcvImport.entity.ts`
- Create: `frontend/features/accounting/components/rcv/RcvImportsClientView.tsx`, `RcvImportDrawer.tsx`, `RcvImportModal.tsx`, `RcvImportModal.schema.ts`
- Modify: `frontend/features/accounting/unifiedSearchDef.ts`, barrels, `frontend/lib/entity-drawers.tsx`
- Create: `frontend/app/(dashboard)/accounting/rcv/imports/page.tsx`
- Test: `frontend/features/accounting/components/__tests__/RcvImportModal.schema.test.ts`, `RcvImportDrawer.test.tsx`, `RcvImportsClientView.test.tsx`

**Interfaces:**
- Consumes: Task 7.
- Produces:
  - `rcvImportEntity`/`rcvImportViews`: `createdAt`, `period` ("Octubre 2026"), `direction`, `trigger`, `status`
    (QUEUED neutral, RUNNING info, SUCCESS success, FAILED destructive; SUCCESS con `warnings` → warning "Exitosa con
    avisos"), `received`, `created`, `updated`, `missing`, `apiKey` (enmascarada), `duration`, `detail` (error/avisos,
    truncado). Exporta `rcvImportStatus(imp)`.
  - `rcvImportSummaryEntity`: `dteType`, `documentCount`, `exempt`, `net`, `vatRecoverable`, `total`, `detail`
    ("Solo resumen" si `!has_detail`; si no "{detail_count} docs · cuadra" o "no cuadra" en warning).
  - `rcvImportAttemptEntity`: `createdAt`, `apiKey`, `httpStatus`, `outcome` (OK "Exitoso", QUOTA_EXHAUSTED
    "Sin cupo", RATE_LIMITED "Límite por minuto/hora", AUTH_KEY "API key rechazada", AUTH_SII "Clave SII rechazada",
    TRANSIENT "Sin respuesta", OTHER "Error"), `duration`, `error`.
  - `rcvImportSchema`: `year` 2017–año actual, `month` 1–12, `directions` no vacío; período no futuro ("No se puede
    importar un período futuro"). Defaults: mes/año de hoy − 3 días, ambas direcciones.
  - `RcvImportModal({ open, onOpenChange })` (patrón `TerminalSyncModal`); ayuda "Cada dirección consume una consulta
    de las API keys."
  - `RcvImportsClientView` con "Importar ahora" (`ToolbarCreateButton`, icono `Download`) solo con permiso
    `accounting.add_rcvimport` (usar el helper de permisos del frontend que ya usa Contabilidad).
  - `RcvImportDrawer({ id, open, onOpenChange, mode? })`: estado, período, dirección, origen, usuario, inicio/fin;
    error/avisos en `Banner`; "Resumen del SII"; "Conteos"; "Intentos"; "Respuesta original" plegable.

- [ ] **Step 1: Write the failing tests**: schema rechaza `directions: []` y período futuro, acepta
  `{year: 2026, month: 10, directions: ["SALES"]}`; drawer muestra la fila 48 con "Solo resumen" y un intento
  "Sin cupo" con la key enmascarada; ClientView oculta "Importar ahora" sin permiso.
- [ ] **Step 2: Run** `npm run test -- features/accounting/components` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS; `npm run type-check && npm run lint` limpios.
- [ ] **Step 5: Commit** `feat(accounting): historial de importaciones RCV e importación manual`.

---

### Task 10: Frontend — Configuración RCV / SII

**Files:**
- Create: `frontend/features/settings/components/RcvSettingsView.tsx`, `RcvSettingsView.schema.ts`, `RcvApiKeyDrawer.tsx`, `rcvApiKeyDrawer.schema.ts`
- Create: `frontend/features/accounting/entity-view/rcvApiKey.entity.ts`
- Modify: `frontend/features/settings/index.ts`
- Create: `frontend/app/(dashboard)/accounting/settings/rcv/page.tsx`
- Test: `frontend/features/settings/components/__tests__/RcvSettingsView.test.tsx`, `RcvSettingsView.schema.test.ts`

**Interfaces:**
- Consumes: Task 7 hooks; `validateRUT`/`formatRUT` de `@/lib/utils/format`.
- Produces:
  - `rcvSettingsSchema`: RUTs vacíos o válidos ("RUT inválido"), `enabled`, `interval_days` 1–60, `run_hour` 0–23,
    `include_purchases`, `include_sales` (al menos una si `enabled`: "Selecciona compras, ventas o ambas");
    `validateRcvSettings(values): true | string` (como `validateTerminalSyncSettings`).
  - `RcvSettingsView` (patrón `TreasurySettingsView`: `useAutoSaveForm`, `AutoSaveStatusBadge`, `useUnsavedChangesGuard`):
    1. **Credenciales SII**: RUT empresa y RUT usuario (autosave); la clave aparte, sin autosave: con
       `has_sii_password` muestra "Configurada" + "Cambiar"; al cambiar, input `type="password"` + "Guardar clave"
       → `updateSettings({ sii_password })` y limpia el input.
    2. **Importación automática**: activar, cada N días, hora (`HOUR_OPTIONS` como TUU), compras/ventas;
       "Si corriera hoy consultaría {Mes Año}" y "Consumo estimado: {estimated_monthly_queries} consultas/mes · cupo
       disponible {total_monthly_quota}", con `Banner tone="warning"` si el consumo supera el cupo.
    3. **API keys de SimpleAPI**: `Collection` embebida con `rcvApiKeyEntity` (etiqueta, `masked_key`, activa,
       "{used}/{limit} este mes", "Sin cupo hasta {fecha}" si `exhausted_until` futuro, último uso, último error)
       + "Agregar API key"; fila → `RcvApiKeyDrawer`.
  - `rcvApiKeySchema`: `label` ≤ 60 opcional, `key` requerido al crear (vacío al editar conserva), `is_active`,
    `monthly_limit` 1–1000.
  - `RcvApiKeyDrawer({ apiKey, open, onOpenChange })` — RHF + Zod; crear/editar; eliminar con confirmación
    (configuración: eliminación física permitida; los intentos quedan con `api_key` nulo).

- [ ] **Step 1: Write the failing tests**: schema rechaza `"8973356-2"`, acepta `"8.973.356-1"`; con
  `has_sii_password: true` muestra "Configurada" y ningún input con valor de clave; con consumo 12 y cupo 10 muestra
  el aviso; la lista muestra "3/10 este mes" y "••••-4472".
- [ ] **Step 2: Run** `npm run test -- features/settings` → FAIL.
- [ ] **Step 3: Implement** (página con metadata vía `getAccountingConfigSubTab("rcv")`).
- [ ] **Step 4: Run** → PASS; `npm run type-check && npm run lint` limpios.
- [ ] **Step 5: Commit** `feat(accounting): configuración RCV / SII con API keys`.

---

### Task 11: Verificación integral y prueba real

**Files:**
- Modify: `docs/superpowers/specs/2026-11-14-rcv-importacion-simpleapi-design.md` (estado → implementado; forma real de los errores si se conoció)

- [ ] **Step 1: Backend** `... pytest accounting core -q` → PASS; `venv/bin/ruff check accounting core` limpio.
- [ ] **Step 2: Frontend** `npm run test -- features/accounting features/settings && npm run type-check && npm run lint` → PASS.
- [ ] **Step 3: Servidor de desarrollo**: `mutagen sync list` debe mostrar `erpgrafico-sync … Connected: Yes` (si no,
  detenerse y avisar); en `~/ERPGrafico`: `docker compose exec backend python manage.py migrate` y reiniciar worker/beat.
- [ ] **Step 4: Prueba real (gasta 1 consulta; pedir confirmación al usuario antes)**: el usuario carga RUTs, clave y
  una key en `http://192.168.1.86/accounting/settings/rcv`; "Importar ahora" octubre 2026 solo Compras → `SUCCESS`
  con 24 documentos, resumen 33 de 24 docs / $5.502.286 "cuadra"; listado Compras con 24 filas; drawer de 1205605
  con acuse del 13-10.
- [ ] **Step 5: Commit** `docs(accounting): cierre de la importación RCV`.
