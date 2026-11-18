# Cuadre unificado (FiscalMatch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los vínculos por pares del cuadre (TUU↔ERP, RCV↔ERP, TUU↔RCV) por un registro `FiscalMatch` por grupo, resuelto por una tarea Celery cada 10 minutos sin meses, con una página «Cuadre» filtrable y unión manual de los 3 registros desde una ficha.

**Architecture:** Nuevo paquete `backend/tax/fiscal_match/` (modelo en `tax.models`, motor por pasos, servicios de unión manual, selectores, API `/api/tax/fiscal-matches/`). Las funciones de cruce existentes de `tax/reconciliation/` se mueven y adaptan; los campos de vínculo viejos se migran a grupos y se eliminan al final. Frontend: `features/tax` gana `FiscalMatchClientView` + `FiscalMatchDrawer`; las fichas de venta TUU y documento RCV solo enlazan al grupo.

**Tech Stack:** Django 5 + DRF, Celery Beat, PostgreSQL; Next.js 16, TanStack Query, Zod, `@/components/entity-view`.

**Spec:** `docs/superpowers/specs/2026-11-17-cuadre-unificado-design.md` (leer completo, incluida la sección «Supuestos tras la revisión»).

## Global Constraints

- Término único en UI: **«Cuadre»** (verbo *cuadrar*). Nunca «conciliación», «reconciliación» ni «cuadre fiscal» en textos del cuadre. En código: `fiscal_match` / `FiscalMatch`.
- Etiquetas exactas de `PartState`: `MATCHED` «Cuadrado», `PENDING` «Pendiente», `MISSING` «Falta», `DIFF` «Diferencia», `AMBIGUOUS` «Ambiguo», `NOT_APPLICABLE` «No aplica», `SUMMARY_ONLY` «Solo resumen».
- Etiquetas exactas de `FiscalMatchStatus`: `MATCHED` «Cuadrado», `PENDING` «Pendiente», `DIFF` «Con diferencia», `AMBIGUOUS` «Ambiguo», `MISSING_ERP` «Falta en el ERP», `MISSING_EXTERNAL` «Falta en SII/TUU», `EXCLUDED` «Excluido».
- Solo se evalúa desde `RCVSettings.fiscal_match_start_date`; sin fecha, el motor no hace nada. Ventana TUU = `terminal_match_window_minutes` (15).
- Fechas de negocio con `timezone.localdate` (America/Santiago).
- Tolerancia de monto 0 (CLP enteros). Notas de crédito por valor absoluto.
- Permisos: lectura `tax.view_taxperiod`; toda acción `tax.change_taxperiod`. POST de unión con `@idempotent_endpoint`.
- Zero N+1 (ADR-0118): lista y motor con consultas fijas; tests con `django_assert_max_num_queries`.
- Views ≤ 20 líneas; lógica en servicios `@transaction.atomic`.
- Frontend: zero `any`, sin colores Tailwind crudos, hooks de feature para `useQuery`/`useMutation`, `StatusBadge` para estados, colecciones con `defineEntity` + `Collection`.
- Tarea Beat `tax.tasks.run_fiscal_match` cada 10 min, candado `tax:fiscal_match:lock` 540 s, `soft_time_limit` 520.

**Comandos:**
- Backend: `cd backend && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q`
- Frontend tests: `cd frontend && export PATH=/home/pato/.nvm/versions/node/v24.18.0/bin:$PATH && npx vitest run --project '!storybook' <ruta>`
- Frontend DoD: `npm run type-check && npm run lint`
- Ruff: `cd backend && venv/bin/ruff check tax treasury accounting core`

## Review Focus

1. **Venta TUU rival que llega tarde a un grupo ya cuadrado** → el grupo pasa a `AMBIGUOUS`; si ya se emitió un 48 con ese id TUU, el vínculo se conserva y se marca `closed_period_alert`. (Test en Task 9.)
2. **Quitar un vínculo automático y esperar la siguiente corrida** → el par no se recrea. (Test en Task 11.)
3. **Factura pagada con dos tarjetas o tarjeta + efectivo** → ambas ventas TUU quedan en el grupo, cada una con su `matched_movement`, y el grupo queda `MATCHED`. (Test en Task 4.)
4. **Documento POS sin venta TUU cuando la sincronización es diaria** → `tuu_state=PENDING` hasta que una `TerminalSyncRun` exitosa cubra el día y termine después de pago+ventana. (Test en Task 7.)
5. **Factura anulada con grupo cuadrado** → el grupo se reevalúa, sus registros externos quedan huérfanos con `MISSING_ERP` y el vínculo manual deja de protegerse. (Test en Task 9.)

---

## Fase 1 — Modelo

### Task 1: Estados y derivación pura

**Files:**
- Modify: `backend/core/fiscal_match.py`
- Test: `backend/core/tests/test_fiscal_match_states.py`

**Interfaces:**
- Produces: `PartState(models.TextChoices)`, `FiscalMatchStatus(models.TextChoices)` con valores/etiquetas de Global Constraints; `derive_group_status(erp: str, tuu: str, rcv: str, *, has_invoice: bool, excluded: bool) -> str`. `MatchStatus` se conserva hasta Task 19.

- [ ] **Step 1: Tests de la prioridad del spec §5.2**

```python
@pytest.mark.parametrize("erp,tuu,rcv,has_invoice,excluded,expected", [
    ("MATCHED", "MATCHED", "MATCHED", True, False, "MATCHED"),
    ("MATCHED", "NOT_APPLICABLE", "SUMMARY_ONLY", True, False, "MATCHED"),
    ("MATCHED", "AMBIGUOUS", "DIFF", True, False, "AMBIGUOUS"),
    ("MATCHED", "DIFF", "PENDING", True, False, "DIFF"),
    ("MISSING", "MATCHED", "MATCHED", False, False, "MISSING_ERP"),
    ("MATCHED", "MISSING", "PENDING", True, False, "MISSING_EXTERNAL"),
    ("PENDING", "MATCHED", "PENDING", True, False, "PENDING"),
    ("MATCHED", "DIFF", "MATCHED", True, True, "EXCLUDED"),
])
def test_derive_group_status(erp, tuu, rcv, has_invoice, excluded, expected):
    assert derive_group_status(erp, tuu, rcv, has_invoice=has_invoice, excluded=excluded) == expected
```

- [ ] **Step 2: Correr y ver fallar** — `pytest core/tests/test_fiscal_match_states.py -q` → ImportError.
- [ ] **Step 3: Implementar** `PartState`, `FiscalMatchStatus`, `derive_group_status` (prioridad exacta: EXCLUDED > AMBIGUOUS > DIFF > MISSING_ERP (sin invoice y erp ∈ {MISSING}) > MISSING_EXTERNAL > PENDING > MATCHED).
- [ ] **Step 4: Correr y ver pasar.**
- [ ] **Step 5: Commit** `feat(tax): estados de parte y de grupo del cuadre`

### Task 2: Modelo `FiscalMatch`, `FiscalMatchRun` y FKs nuevos (aditivo)

**Files:**
- Create: `backend/tax/fiscal_match/__init__.py`
- Modify: `backend/tax/models.py`, `backend/treasury/models.py` (TerminalSale), `backend/accounting/models.py` (RCVDocument)
- Create: migraciones `tax/0009_fiscalmatch.py`, `treasury/0112_terminalsale_fiscal_match.py`, `accounting/0050_rcvdocument_fiscal_match.py` (`makemigrations`)
- Test: `backend/tax/tests/test_fiscal_match_model.py`

**Interfaces:**
- Produces:
  - `tax.models.FiscalMatch`: `direction` (`Direction.PURCHASE="purchase"`, `SALE="sale"`), `invoice` FK `billing.Invoice` `SET_NULL` null, `related_name="fiscal_match_set"`, UniqueConstraint condicional `fiscalmatch_invoice_uniq`; `rcv_linked_manually` bool; `status` (FiscalMatchStatus, db_index), `erp_state`/`tuu_state`/`rcv_state` (PartState, default `PENDING`); `dte_type` PositiveSmallInteger null; `issue_date` Date null; `fiscal_period` Char(6) blank; `counterparty_rut` Char(20) blank; `erp_amount`/`tuu_amount`/`rcv_amount` Decimal(14,0) null; `issue_attempted_at` DateTime null; `issue_error` Char(255) blank; `notice` Char(255) blank (avisos como «varios folios en el SII»); `closed_period_alert` bool; `evaluated_at` DateTime null; `created_at`/`updated_at` auto. Índices `(direction, status)`, `(status, issue_date)`, `fiscal_period`.
  - `tax.models.FiscalMatchRun`: `started_at`, `finished_at` null, `counts` JSON, `error` Text blank. `FiscalMatchRun.latest_finished() -> FiscalMatchRun | None`.
  - `TerminalSale.fiscal_match` FK `tax.FiscalMatch` `SET_NULL` null `related_name="terminal_sales"`; `TerminalSale.matched_movement` FK `treasury.TreasuryMovement` `SET_NULL` null `related_name="+"`, UniqueConstraint condicional `terminalsale_matched_movement_uniq`; `TerminalSale.linked_manually` bool default False.
  - `RCVDocument.fiscal_match` FK `tax.FiscalMatch` `SET_NULL` null `related_name="rcv_documents"` (0..N, spec supuestos).
  - Campos viejos intactos.

- [ ] **Step 1: Tests**: `test_invoice_unique_per_group` (dos grupos con el mismo invoice → `IntegrityError`), `test_movement_unique_per_sale`, `test_group_accepts_many_sales_and_rcv_documents`.
- [ ] **Step 2: Ver fallar.**
- [ ] **Step 3: Implementar modelos + `makemigrations tax treasury accounting`** (revisar que la dependencia circular tax↔treasury/accounting quede resuelta en las migraciones: los FK hacia `tax.FiscalMatch` en treasury/accounting dependen de `tax/0009`).
- [ ] **Step 4: Ver pasar** + `python manage.py makemigrations --check`.
- [ ] **Step 5: Commit** `feat(tax): modelo FiscalMatch (grupo de cuadre)`

## Fase 2 — Motor (`backend/tax/fiscal_match/`)

Cada paso recibe y devuelve estructuras en memoria; `engine.py` (Task 9) los encadena y persiste en lote. Tests nuevos en `backend/tax/tests/fiscal_match/` reutilizando `tax/tests/reconciliation_helpers.py` (se renombra a `fiscal_match_helpers.py` en Task 19).

### Task 3: Asegurar grupos

**Files:**
- Create: `backend/tax/fiscal_match/groups.py`
- Test: `backend/tax/tests/fiscal_match/test_groups.py`

**Interfaces:**
- Consumes: `FiscalMatch` (Task 2); `fiscal_direction_expression`, `sii_code_expression` de `billing/fiscal_key.py`; `sale_document_status_q` (mover desde `tax/reconciliation/terminal.py` a `tax/fiscal_match/candidates.py`, reexportado desde el módulo viejo hasta Task 19).
- Produces: `ensure_groups(since: date) -> int` (cantidad creada). Crea con `bulk_create`:
  - un grupo por `Invoice` evaluable sin grupo: ventas `POSTED` de OV/sueltas de tipos 33/34/39/41/48/56/61 y borradores 39/41/48 sin número con `sale_order`; compras `POSTED` (fiscal_direction `purchase`); `date >= since`;
  - un grupo huérfano por `RCVDocument` (`issue_date >= since`) sin `fiscal_match`, y por `TerminalSale` `COMPLETED` (`transaction_at >= since` local) sin `fiscal_match`, asignando el FK con `bulk_update`.
  - Rellena `direction`, `dte_type`, `issue_date`, `counterparty_rut` (normalizado con `normalize_rut`), `erp_amount`/`rcv_amount`/`tuu_amount`, `fiscal_period`.

- [ ] **Step 1: Tests**: `test_creates_group_per_posted_invoice_once` (llamar dos veces → 1 grupo), `test_orphan_groups_for_unlinked_rcv_and_terminal_sales`, `test_ignores_before_start_date`, `test_query_count_constant` (`django_assert_max_num_queries(8)` con 3 y con 30 documentos).
- [ ] **Step 2: Ver fallar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Ver pasar.**
- [ ] **Step 5: Commit** `feat(tax): el cuadre crea un grupo por documento y por registro huérfano`

### Task 4: ERP ↔ TUU por pago

**Files:**
- Create: `backend/tax/fiscal_match/terminal.py`, `backend/tax/fiscal_match/candidates.py`
- Test: `backend/tax/tests/fiscal_match/test_terminal.py`

**Interfaces:**
- Consumes: mover sin cambios desde `tax/reconciliation/terminal.py` a `candidates.py`: `SALE_DTE_TYPES`, `sale_document_status_q`, `_local_midnight`→`local_midnight`, `_border_competitors`→`border_competitors`, `_candidate_movements`→`candidate_movements`, `_terminals_by_device`→`terminals_by_device`, `_payment_compatible`→`payment_compatible`. El módulo viejo las importa de aquí.
- Produces: `@dataclass LinkResult(linked: int, ambiguous_group_ids: set[int])` en `candidates.py`; `link_terminal_sales(lo: datetime, hi: datetime, *, rematch_ids: set[int]) -> LinkResult`.
  - Selección: ventas `COMPLETED` del rango sin `linked_manually` (o manuales cuyo grupo tiene invoice `CANCELLED`/nulo), más las de grupos en `rematch_ids`.
  - **Candidato = movimiento**, comparando `m.amount == s.sale_amount` (corrige el bug de comparar `m.invoice.total`, hoy `reconciliation/terminal.py:145-150`), misma ventana y compatibilidad; excluye movimientos ya tomados por otra venta (`matched_movement`).
  - Un movimiento candidato único y sin rivales (incluidos competidores de borde) → la venta se mueve al grupo del `invoice` del movimiento (`fiscal_match`), `matched_movement=m`; el grupo huérfano de la venta se borra si queda vacío.
  - Varios candidatos o rival → la venta queda en su grupo huérfano y su grupo va a `LinkResult.ambiguous_group_ids`.
  - Venta cuyo movimiento ya está tomado de forma manual → no compite.

- [ ] **Step 1: Tests** (mismo escenario que `test_reconcile_terminal.py`, adaptados):
  - `test_single_payment_links_sale_to_invoice_group`
  - `test_factura_two_card_payments_links_both_sales` (factura 80.000 con movimientos 50.000 y 30.000 por tarjeta, dos ventas TUU 50.000/30.000 → ambas en el grupo, cada una con su movimiento) — Review Focus 3
  - `test_factura_card_plus_cash_links_card_sale_only`
  - `test_two_movements_same_amount_in_window_is_ambiguous`
  - `test_border_competitor_makes_ambiguous`
  - `test_manual_link_not_touched`
  - `test_query_count_constant`
- [ ] **Step 2: Ver fallar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Ver pasar** + `pytest tax/tests/test_reconcile_terminal.py` sigue verde (las funciones movidas).
- [ ] **Step 5: Commit** `feat(tax): el cuadre une cada venta TUU con su pago, no con el total`

### Task 5: TUU ↔ RCV boletas

**Files:**
- Create: `backend/tax/fiscal_match/boletas.py`
- Test: `backend/tax/tests/fiscal_match/test_boletas.py`

**Interfaces:**
- Consumes: mover `_pair` y `months_in_range` de `tax/reconciliation/boletas.py` (el viejo importa de aquí); `BOLETA_SII_CODES = frozenset({39, 41})`.
- Produces: `pair_rcv_boletas(lo: datetime, hi: datetime) -> LinkResult`: boletas RCV 39/41 de ventas sin `missing_since_import` y cuyo grupo no tiene `rcv_linked_manually`, emparejadas 1 a 1 en orden con ventas TUU 39/41 del mismo día local, monto y tipo (ADR-0139 D1). El `RCVDocument` se mueve al grupo de la venta (`fiscal_match`), borrando el huérfano vacío. Una boleta RCV cuyo folio ya es el `number` de un `Invoice` emitido 39/41 se une por folio directo antes del emparejamiento (spec §5.3).

- [ ] **Step 1: Tests**: `test_pairs_in_order_same_day_amount`, `test_rcv_boleta_follows_sale_into_invoice_group`, `test_issued_boleta_matches_by_folio_directly`, `test_missing_since_import_not_paired`, `test_manual_rcv_link_untouched`.
- [ ] **Step 2: Ver fallar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Ver pasar.**
- [ ] **Step 5: Commit** `feat(tax): boletas RCV entran al grupo vía la venta TUU o el folio`

### Task 6: ERP ↔ RCV por clave fiscal (facturas, notas, compras)

**Files:**
- Create: `backend/tax/fiscal_match/rcv.py`
- Test: `backend/tax/tests/fiscal_match/test_rcv.py`

**Interfaces:**
- Consumes: mover de `tax/reconciliation/rcv.py`: `DOCUMENT_SII_CODES`, `CANDIDATE_WINDOW`, `RCV_TO_FISCAL_DIRECTION`, `_candidates_by_key`→`candidates_by_key` (el «taken» pasa a ser «invoice cuyo grupo ya tiene un RCVDocument de su mismo tipo»), `rut_body`, `_rcv_family`, `rcv_document_candidates` (filtro de «sin otro vínculo» vía `fiscal_match__rcv_documents`).
- Produces: `link_rcv_documents(since: date) -> LinkResult`: cada `RCVDocument` 33/34/56/61 (compras y ventas) con grupo huérfano y sin `rcv_linked_manually`, con `issue_date >= since`, se une por `FiscalKey` exacta; un solo invoice → se mueve al grupo del invoice; varios o clave repetida → queda huérfano y su grupo va a `ambiguous_group_ids` (parte RCV ambigua).

- [ ] **Step 1: Tests** (port de `test_reconcile_rcv.py`): `test_same_key_moves_rcv_into_invoice_group`, `test_duplicate_key_ambiguous`, `test_purchase_and_sale_directions`, `test_unsupported_types_stay_orphan` (43/46 → se excluyen en Task 7), `test_query_count_constant`.
- [ ] **Step 2–4:** fallar, implementar, pasar.
- [ ] **Step 5: Commit** `feat(tax): facturas y notas del RCV entran al grupo por clave fiscal`

### Task 7: Derivación de estados de partes

**Files:**
- Create: `backend/tax/fiscal_match/states.py`
- Test: `backend/tax/tests/fiscal_match/test_states.py`

**Interfaces:**
- Consumes: `PartState`, `derive_group_status` (Task 1).
- Produces: `evaluate(groups: list[FiscalMatch], ctx: EvalContext) -> None` (muta en memoria) y `build_context(groups, *, tuu_ambiguous: set[int] = frozenset(), rcv_ambiguous: set[int] = frozenset()) -> EvalContext` (carga en lote: ventas por grupo, movimientos por invoice, RCV por grupo, `TerminalSyncRun` exitosas por proveedor, importaciones RCV exitosas por dirección/período, períodos tributarios cerrados). `EvalContext` es un `@dataclass(frozen=True)`.
- Reglas (spec §5.3 y supuestos), una función privada por parte:
  - `erp_state`: con invoice `POSTED` → `MATCHED`; borrador 39/41/48 sin número → `PENDING`; sin invoice → `MISSING` si alguna parte externa ya no está `PENDING`, si no `PENDING`.
  - `tuu_state`: compras, 33/34/56/61 sin pagos TUU esperados, 39/41 fuera de POS → `NOT_APPLICABLE`. Pagos esperados = movimientos `INBOUND` del invoice con `payment_method_new.linked_terminal_device` o efectivo en `pos_session` cuyo terminal tiene dispositivo TUU. Todos con venta → `MATCHED` (o `DIFF` si `document_type` ≠ `sii_code`; 33 en TUU para factura 33 no es diferencia); grupo en `ctx.tuu_ambiguous` → `AMBIGUOUS`; falta alguno → `PENDING` hasta que exista `TerminalSyncRun` `SUCCESS` del proveedor del dispositivo con `start_date ≤ día del pago ≤ end_date` y `finished_at > pago + ventana`, después `MISSING`. Huérfano con venta → `MATCHED` para la parte TUU.
  - `rcv_state`: grupo en `ctx.rcv_ambiguous` → `AMBIGUOUS`; 48 → `SUMMARY_ONLY`; boleta de compra → `NOT_APPLICABLE`; tipos 43/46/110–112/914 o `missing_since_import` → grupo `excluded=True`; con RCV: boletas → `MATCHED` si `sum(abs(rcv))` == `erp_amount` **o** == `tuu_amount`, si no `DIFF`; facturas/notas → `MATCHED` si `abs(rcv.total_amount) == invoice.total`, si no `DIFF`; sin RCV → `PENDING` mientras no haya `RCVImport` `SUCCESS` de la dirección para `fiscal_period` (compras: para el mes de `issue_date` y los dos siguientes), después `MISSING`.
  - Más de un `RCVDocument` en una boleta → `notice = "Varios folios en el SII"`.
  - `status = derive_group_status(...)`; `closed_period_alert = True` si `status` deja de ser `MATCHED` y `TaxPeriodService.is_period_closed(first_day(fiscal_period))`; `evaluated_at = now()`; montos y `fiscal_period` recalculados (`period` del RCV si hay registro RCV).

- [ ] **Step 1: Tests** — uno por fila de la tabla §5.3 del spec, más:
  - `test_pos_document_pending_until_sync_covers_payment` (sync diaria: antes `PENDING`, tras `TerminalSyncRun` SUCCESS que cubre → `MISSING`) — Review Focus 4
  - `test_factura_card_tuu_33_is_matched_not_type_diff`
  - `test_boleta_41_with_card_tuu_48_is_diff`
  - `test_boleta_rcv_amount_equals_tuu_sum_is_matched` (39 de 10.000 con 6.000 efectivo por TUU + 4.000 transferencia; RCV 6.000 → `MATCHED`)
  - `test_purchase_without_rcv_missing_only_after_three_months_imported`
  - `test_closed_period_alert_when_matched_becomes_diff`
  - `test_build_context_query_count_constant`
- [ ] **Step 2–4:** fallar, implementar, pasar.
- [ ] **Step 5: Commit** `feat(tax): estados de cada parte del grupo de cuadre`

### Task 8: Emisión automática desde el grupo

**Files:**
- Create: `backend/tax/fiscal_match/issuing.py`
- Test: `backend/tax/tests/fiscal_match/test_issuing.py`

**Interfaces:**
- Consumes: mover de `tax/reconciliation/issuing.py`: `ISSUE_RETRY_MINUTES = 60`, `_error_text`, `_issue`, `_tuu_number`.
- Produces:
  - `issue_fiscal_drafts(*, group_ids: list[int] | None = None, retry_failed: bool = False) -> dict[str, int]` → `{"issued": n, "failed": n}`. Toma grupos con invoice borrador 39/41/48 sin número, `tuu_state=MATCHED`. 48: número `_tuu_number(sale)` de su única venta, fecha local de la transacción. 39/41: solo con **exactamente un** `RCVDocument` → `folio`, `issue_date`; con varios no emite. Error → `issue_attempted_at`/`issue_error` en el grupo; éxito los limpia.
  - `fiscal_number_and_date(group: FiscalMatch) -> tuple[str, date] | None`.

- [ ] **Step 1: Tests** (port de `test_issue_fiscal_drafts.py`): `test_issues_48_with_tuu_id`, `test_issues_39_with_single_rcv_folio`, `test_does_not_issue_39_with_two_rcv_folios`, `test_failure_recorded_on_group_and_retried_after_60_min`, `test_retry_failed_ignores_wait`.
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** `feat(tax): la emisión automática lee el grupo de cuadre`

### Task 9: Motor, tarea y ganchos

**Files:**
- Create: `backend/tax/fiscal_match/engine.py`
- Modify: `backend/tax/tasks.py`, `backend/config/settings.py` (beat), `backend/treasury/tasks.py:953` (`_reconcile_after_sync`), `backend/accounting/tasks.py:77` (`_reconcile_imported_period`)
- Test: `backend/tax/tests/fiscal_match/test_engine.py`, `backend/tax/tests/test_fiscal_match_task.py`

**Interfaces:**
- Consumes: Tasks 3–8.
- Produces:
  - `run_fiscal_match() -> dict` (`@transaction.atomic` por paso salvo la emisión): sin `fiscal_match_start_date` → `{"skipped": True}`. Orden: `ensure_groups` → `link_terminal_sales` → `pair_rcv_boletas` → `link_rcv_documents` → `evaluate` → `issue_fiscal_drafts` → `link_rcv_documents` + `evaluate` de los emitidos → `bulk_update`. Registra un `FiscalMatchRun`.
  - **Alcance** (spec §5.4): grupos no `MATCHED`/`EXCLUDED`; grupos con `updated_at` o registros con `updated_at` > `FiscalMatchRun.latest_finished().started_at`; grupos `MATCHED` con ventas automáticas cuyo pago cae en `[min(start_date), max(end_date)]` de las `TerminalSyncRun` terminadas desde la última corrida ± ventana (`rematch_ids`). Si el grupo ya emitió un 48 con el id TUU de la venta (invoice `POSTED`, `number == _tuu_number(sale)`), el vínculo no se mueve: con rival → `tuu_state=AMBIGUOUS` y `closed_period_alert=True`.
  - Invoice `CANCELLED` → sus ventas/RCV automáticos y manuales vuelven a grupos huérfanos (y el grupo del invoice queda `EXCLUDED`).
  - `tax.tasks.run_fiscal_match` (shared_task, candado `tax:fiscal_match:lock` 540 s, `soft_time_limit=520`, reutiliza `_step`). Beat `run_fiscal_match_10min` → `crontab(minute="*/10")`; se elimina `run_fiscal_reconciliation_10min`.
  - `_reconcile_after_sync` y `_reconcile_imported_period` → `run_fiscal_match.delay()` (con `transaction.on_commit`).

- [ ] **Step 1: Tests**:
  - `test_full_chain_boleta_pos_to_rcv_and_issue` (port de `test_checkout_to_terminal_match.py`)
  - `test_late_rival_sale_reopens_matched_group_as_ambiguous` — Review Focus 1
  - `test_issued_48_link_frozen_with_alert_on_rival` — Review Focus 1
  - `test_cancelled_invoice_releases_external_records` — Review Focus 5
  - `test_second_run_is_idempotent` (mismos estados, 0 grupos nuevos)
  - `test_engine_query_count_constant` (10 vs 50 documentos, `django_assert_max_num_queries`)
  - tarea: `test_lock_prevents_overlap`, `test_skipped_without_start_date`, `test_hooks_enqueue_task` (mock `.delay`).
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** `feat(tax): motor único del cuadre cada 10 minutos, sin meses`

### Task 10: Migración de datos

**Files:**
- Create: `backend/tax/migrations/0010_fiscalmatch_backfill.py` (`RunPython` con `reverse_code=noop` que borra los grupos)
- Test: `backend/tax/tests/test_fiscal_match_backfill.py` (llama a la función `backfill(apps)` exportada por la migración con `apps` real)

**Interfaces:**
- Produces: spec §7 pasos 1–5 con los modelos históricos: grupo por invoice con `TerminalSale.matched_invoice`/`RCVDocument.matched_invoice`; `matched_manually` → `linked_manually`/`rcv_linked_manually`; `matched_movement` cuando hay exactamente un movimiento del invoice con `amount == sale_amount`; `PENDING_ERP` (venta + `rcv_document` sin invoice) → grupo huérfano con ambos; copia `issue_*`. Estados quedan `PENDING`: la primera corrida los deriva.

- [ ] **Step 1: Tests**: `test_backfill_preserves_manual_flags`, `test_backfill_pending_erp_becomes_orphan_group_with_both`, `test_backfill_sets_movement_when_unique`.
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** `feat(tax): migra los vínculos de cuadre existentes a grupos`

## Fase 3 — API

### Task 11: Selectores, lista, conteos, detalle y unión manual

**Files:**
- Create: `backend/tax/fiscal_match/selectors.py`, `backend/tax/fiscal_match/services.py`, `backend/tax/fiscal_match/serializers.py`, `backend/tax/fiscal_match/views.py`
- Modify: `backend/tax/urls.py` (registrar `fiscal-matches`, basename `fiscal-match`)
- Test: `backend/tax/tests/fiscal_match/test_api.py`, `backend/tax/tests/fiscal_match/test_services.py`

**Interfaces:**
- Produces:
  - `fiscal_matches_queryset(filters: dict) -> QuerySet[FiscalMatch]` — filtros `direction`, `status` (lista; valor especial `attention` = todo menos `MATCHED`/`EXCLUDED`), `dte_type`, `date_from`, `date_to` (sobre `issue_date`), `search` (folio RCV, `invoice.number`, RUT, monto exacto); `select_related("invoice")`, `prefetch_related("terminal_sales", "rcv_documents")` con `Prefetch` y `.only(...)`; orden `-issue_date, -id`.
  - `fiscal_match_counts(filters: dict) -> dict` → `{"by_status": {status: n}, "last_run_at": iso|None}` (filtros salvo `status`).
  - Servicios `@transaction.atomic`, re-derivan el grupo al final (`evaluate([group], build_context([group]))`):
    - `link_invoice(group, invoice) -> FiscalMatch` (grupo huérfano → mueve sus registros al grupo del invoice, `linked_manually`/`rcv_linked_manually=True`).
    - `link_terminal_sale(group, sale, movement) -> FiscalMatch` (valida movimiento del invoice del grupo, monto igual, no tomado).
    - `link_rcv_document(group, doc) -> FiscalMatch` (misma dirección; mismo tipo y RUT que el invoice).
    - `unlink(group, part: Literal["tuu", "rcv"], record_id: int) -> FiscalMatch` (el registro va a un grupo huérfano nuevo con la marca manual en True — Review Focus 2).
    - `release(group) -> FiscalMatch` (huérfano: borra las marcas manuales).
    - `retry_issue(group) -> dict` (`issue_fiscal_drafts(group_ids=[group.pk], retry_failed=True)`).
    - `group_candidates(group, part: Literal["erp", "tuu", "rcv"]) -> QuerySet` (reutiliza `terminal_sale_candidates`/`rcv_document_candidates` adaptados; máx. 20).
  - `FiscalMatchViewSet` (`ReadOnlyModelViewSet` + actions, `StandardResultsSetPagination`): `list`, `retrieve`, `counts` (GET), `candidates` (GET `?part=`), `link` (POST `{part, id, movement?}`), `unlink` (POST `{part, id}`), `release`, `retry_issue` (`url_path="retry-issue"`). Cada acción ≤ 20 líneas. Serializer de lista: `id, direction, status, status_display, erp_state, tuu_state, rcv_state, dte_type, issue_date, erp_amount, tuu_amount, rcv_amount, invoice {id, display_id}, terminal_sales [{id, transaction_at, sale_amount}], rcv_documents [{id, folio}], notice, closed_period_alert, issue_error`.

- [ ] **Step 1: Tests**: lista filtrada por `attention`, conteos, detalle; `test_list_query_count_constant` (5 vs 40 grupos); `test_link_terminal_sale_requires_matching_movement`; `test_unlink_then_engine_does_not_relink` (unlink + `run_fiscal_match()` → la venta sigue huérfana) — Review Focus 2; `test_release_allows_relink`; `test_permissions` (view vs change); `test_link_idempotent` (misma `Idempotency-Key` → misma respuesta).
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** `feat(tax): API del cuadre por grupo con unión manual`

### Task 12: Alimentación de compras sobre el grupo

**Files:**
- Modify: `backend/tax/reconciliation/feeding.py` → mover a `backend/tax/fiscal_match/feeding.py`
- Modify: `backend/tax/fiscal_match/views.py`
- Test: port de `backend/tax/tests/test_rcv_feeding.py` → `backend/tax/tests/fiscal_match/test_feeding.py`

**Interfaces:**
- Produces: mismas funciones (`draft_suggestions`, `supplier_purchase_orders`, `confirm_draft_from_rcv`, `create_draft_from_rcv`) recibiendo el `RCVDocument` del grupo huérfano; `match_rcv_document(..., allow_draft=True)` se reemplaza por `link_invoice(group, invoice)` con borrador permitido. Actions `draft-suggestions`, `purchase-orders` (GET), `confirm-draft`, `create-draft` (POST, `@idempotent_endpoint` con scopes `tax.fiscal_match.confirm_draft` / `tax.fiscal_match.create_draft`).

- [ ] **Step 1–4:** port de tests, fallar, mover, pasar.
- [ ] **Step 5: Commit** `refactor(tax): la alimentación desde el RCV trabaja sobre el grupo`

### Task 13: Resumen mensual, pendientes de folio y compuerta F29

**Files:**
- Create: `backend/tax/fiscal_match/summary.py`
- Modify: `backend/tax/services.py:184,214,1219,1228`, `backend/tax/fiscal_match/views.py`
- Test: `backend/tax/tests/fiscal_match/test_summary.py`

**Interfaces:**
- Consumes: mover de `report.py`: `SUMMARY_SII_CODES = (39, 41, 48)`, `_totals`, `_summary_status_q`, `_rcv_totals`, `_summary_row`, `PENDING_ISSUE_CAP = 50`.
- Produces:
  - `monthly_summary(year: int, month: int) -> list[dict]` — filas `dte_type, erp_count, erp_total, tuu_count, tuu_total, rcv_count, rcv_total, difference`; en la fila 48, `expected_total` = ERP 48 + suma de `sale_amount` de ventas TUU `payment_type=CARD` cuyo grupo tiene invoice 33/34 del mes, y `difference = expected_total - rcv_total`.
  - `pending_issue(year: int | None = None, month: int | None = None) -> dict` → `{count, items}` leyendo `FiscalMatch` (razones `NO_TUU`, `ERROR`, `WAITING_RCV`, `MANY_FOLIOS`, `READY`).
  - `fiscal_mismatch_counts(year, month) -> {"count": n, "by_status": {"DIFF", "AMBIGUOUS", "MISSING_ERP", "MISSING_EXTERNAL"}}` sobre `fiscal_period`; `tax/services.py` lo importa desde aquí. Sigue en «Sugeridos».
  - Actions `summary` (GET `?year&month`) y `pending-issue` (GET).

- [ ] **Step 1: Tests**: `test_48_expected_includes_card_payments_of_facturas`, `test_mismatch_counts_keys_and_period`, `test_pending_issue_reasons`, `test_summary_query_count_constant`.
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** `feat(tax): resumen mensual con el 48 esperado de facturas con tarjeta`

### Task 14: Listas RCV y TUU leen el estado del grupo

**Files:**
- Modify: `backend/accounting/selectors.py:193-245`, `backend/accounting/rcv_serializers.py:31-123`, `backend/treasury/selectors.py:1338`, `backend/treasury/serializers.py:1934-1980`
- Test: actualizar `backend/accounting/tests/` de RCV documents y `backend/treasury/tests/test_terminal_sales_api.py`

**Interfaces:**
- Produces: serializers de `RCVDocument` y `TerminalSale` exponen `fiscal_match: {id, status, status_display} | null` (reemplaza `match_status`, `match_status_display`, `matched_invoice`, `matched_invoice_display`, `rcv_document`, `rcv_folio`); filtro `match_status` → `fiscal_match_status` sobre `fiscal_match__status`; `select_related("fiscal_match")`; `with_terminal_sale` se elimina.

- [ ] **Step 1–4:** tests de filtro y de conteo de consultas, fallar, implementar, pasar.
- [ ] **Step 5: Commit** `refactor: listas RCV y TUU muestran el estado del grupo de cuadre`

## Fase 4 — Frontend

### Task 15: Tipos, API y hooks

**Files:**
- Modify: `frontend/lib/fiscal-match.ts` (+ `frontend/lib/__tests__/fiscal-match.test.ts`)
- Create: `frontend/features/tax/types/fiscalMatch.ts`, `frontend/features/tax/api/fiscalMatchApi.ts`, `frontend/features/tax/hooks/useFiscalMatches.ts`, `frontend/features/tax/hooks/fiscalMatchKeys.ts`
- Modify: `frontend/features/tax/hooks/useRcvFeeding.ts`, barrels `features/tax/{api,hooks,index}.ts`
- Test: `frontend/features/tax/hooks/__tests__/useFiscalMatches.test.tsx`

**Interfaces:**
- Produces:
  - `lib/fiscal-match.ts`: `PartState`, `FiscalMatchStatus` (uniones literales), `PART_STATE_LABELS`, `FISCAL_MATCH_STATUS_LABELS` (exactos de Global Constraints), intents (`MATCHED`→success, `PENDING`→neutral, `DIFF`/`AMBIGUOUS`→warning, `MISSING*`→destructive, `NOT_APPLICABLE`/`SUMMARY_ONLY`/`EXCLUDED`→neutral), `fiscalMatchStatusValue(status)`, `partStateValue(state)`, `FISCAL_MATCH_KEY = ["fiscal-match"] as const`.
  - Zod schemas + tipos: `FiscalMatchListItem`, `FiscalMatchDetail`, `FiscalMatchCounts`, `FiscalMatchFilters`, `MonthlySummaryRow`, `PendingIssue`.
  - `fiscalMatchApi`: `list(filters, page)`, `counts(filters)`, `get(id)`, `candidates(id, part)`, `link(id, body, key)`, `unlink(id, body, key)`, `release(id)`, `retryIssue(id)`, `summary(year, month)`, `pendingIssue()`, feeding (`draftSuggestions`, `purchaseOrders`, `confirmDraft`, `createDraft`).
  - Hooks: `useFiscalMatches(filters, page)`, `useFiscalMatchCounts(filters)` (`refetchInterval: 60_000`), `useFiscalMatch(id)`, `useFiscalMatchCandidates(id, part)`, `useLinkFiscalMatch()`, `useUnlinkFiscalMatch()`, `useReleaseFiscalMatch()`, `useRetryFiscalIssue()`, `useFiscalMatchSummary(year, month)`, `usePendingIssue()`. Mutaciones invalidan `FISCAL_MATCH_KEY`, `RCV_DOCUMENTS_KEY`, `TERMINAL_SALES_KEY` y llaman `markLocalMutation()`.

- [ ] **Step 1–4:** tests de hooks (invalidación y Zod parse), fallar, implementar, pasar.
- [ ] **Step 5: Commit** `feat(tax): cliente del cuadre por grupo`

### Task 16: Página Cuadre

**Files:**
- Create: `frontend/features/tax/entity-view/fiscalMatch.entity.ts` (value kind de parte: `fiscalMatchPart` con módulo de augmentation en `frontend/features/tax/entity-view/fiscalMatchPart.kind.tsx`), `frontend/features/tax/components/FiscalMatchClientView.tsx`, `frontend/features/tax/unifiedSearchDef.ts` (filtros dirección/estado/tipo/fechas/búsqueda)
- Modify: `frontend/features/tax/entity-view/fiscalReconciliation.entity.ts` → renombrar a `fiscalMatchSummary.entity.ts` (conserva `reconciliationSummaryEntity` → `monthlySummaryEntity` con columna «48 esperado», y `pendingIssueDocumentEntity`; elimina `onlyErpDocumentEntity`)
- Create: `frontend/app/(dashboard)/accounting/rcv/cuadre/page.tsx`; Modify: `frontend/app/(dashboard)/accounting/rcv/reconciliation/page.tsx` → `redirect("/accounting/rcv/cuadre")`
- Modify: `frontend/features/accounting/navigation.ts:68-74` (`value: "cuadre"`, label «Cuadre», href `/accounting/rcv/cuadre`, headerTitle «Cuadre», metadataTitle «Cuadre | ERPGrafico»)
- Test: `frontend/features/tax/components/__tests__/FiscalMatchClientView.test.tsx`

**Interfaces:**
- Consumes: hooks de Task 15.
- Produces: `FiscalMatchClientView` (exportado por el barrel): conteos como filtros rápidos (`StatusBadge` + número) y «Última revisión: hace N min» (desde `last_run_at`); filtros vía `useUnifiedSearch`; por defecto `status=attention`, `direction=sale`; `Collection` paginada en servidor (`useServerPage`, 50); fila → `openEntity("tax.fiscalmatch", id)`; debajo «Boletas pendientes de folio» y «Resumen mensual de boletas y comprobantes» (con su propio `LabeledSelect` de año/mes); banner de fecha de inicio. **Sin** botones de recálculo.

- [ ] **Step 1: Tests**: `renders counts and opens in attention filter`, `has no recalculate buttons` (`queryByRole('button', {name: /recalcular/i})` null), `shows 48 expected column`, `start date banner`, `loading/empty/error states`.
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** `feat(tax): página Cuadre por grupos sin meses`

### Task 17: Ficha del grupo

**Files:**
- Create: `frontend/features/tax/components/FiscalMatchDrawer.tsx`, `frontend/features/tax/components/FiscalMatchRegisterSection.tsx` (mueve `RcvRegisterSection` de `RcvDocumentDrawer.tsx`)
- Modify: `frontend/lib/entity-drawers.tsx` (`"tax.fiscalmatch"`), `frontend/lib/entity-registry.ts` (entrada `tax.fiscalmatch`, label «Cuadre»)
- Test: `frontend/features/tax/components/__tests__/FiscalMatchDrawer.test.tsx`

**Interfaces:**
- Produces: drawer con tres bloques (ERP / Pagos TUU / RCV), cada uno con `StatusBadge` de su parte, montos y enlaces (`openEntity` a `billing.invoice`, `treasury.terminalsale`, `accounting.rcvdocument`); acciones según `<Can permission="tax.change_taxperiod">`: «Vincular documento ERP», «Agregar pago TUU» (elige venta y pago), «Vincular registro RCV», «Quitar», «Devolver al cruce automático», «Reintentar emisión»; avisos `notice`, `closed_period_alert`, `issue_error` como `Banner`.

- [ ] **Step 1: Tests**: render de los 3 bloques con «No aplica»/«Solo resumen», `link TUU sends movement`, `unlink`, `release only on orphan with manual mark`, `retry issue only with issue_error`, permisos.
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** `feat(tax): ficha del grupo de cuadre con unión manual de los 3 registros`

### Task 18: Fichas, listas y enlaces existentes

**Files:**
- Modify: `frontend/features/treasury/components/TerminalSaleDrawer.tsx:172-245`, `frontend/features/accounting/components/rcv/RcvDocumentDrawer.tsx:134-230`, `frontend/features/treasury/entity-view/terminalSale.entity.ts`, `frontend/features/accounting/entity-view/rcvDocument.entity.ts`, `frontend/features/accounting/components/rcv/RcvDocumentsClientView.tsx`, `frontend/features/accounting/unifiedSearchDef.ts`, `frontend/features/accounting/types/rcv.ts`, `frontend/features/treasury/types/index.ts`, `frontend/features/tax/components/DeclarationWizard.tsx:270-300`, `frontend/features/accounting/components/closures/AccountingPeriodCloseChecklist.tsx:44-100`
- Delete: `frontend/features/treasury/hooks/useTerminalSaleMatch.ts`, `frontend/features/tax/hooks/useRcvMatch.ts`
- Test: actualizar `TerminalSaleDrawer.test`, `RcvDocumentDrawer.test`, `TerminalSalesClientView.test`, `RcvDocumentsClientView.test`, `rcvUnifiedSearchDef.test`, `terminalSale.entity.test`, `DeclarationWizard.test`, `AccountingPeriodCloseChecklist.test`

**Interfaces:**
- Produces: en ambas fichas, una fila «Cuadre» con `StatusBadge` del grupo y botón «Ver cuadre» → `openEntity("tax.fiscalmatch", fiscal_match.id)`; columna/filtro «Cuadre» con `fiscal_match_status`; enlaces «Ir al cuadre» → `/accounting/rcv/cuadre?status=attention&date_from=<primer día>&date_to=<último día>`; textos de `by_status` con las claves nuevas.

- [ ] **Step 1–4.**
- [ ] **Step 5: Commit** `refactor: fichas y listas enlazan al grupo de cuadre`

## Fase 5 — Limpieza y documentación

### Task 19: Eliminar el esquema viejo

**Files:**
- Delete: `backend/tax/reconciliation/` (todo), `backend/tax/reconciliation_views.py`, `backend/tax/reconciliation_serializers.py`, `backend/scripts/debug_match.py` (leerlo antes: si solo depura el cruce viejo, borrar), tests viejos `backend/tax/tests/test_reconcile_*.py`, `test_reconciliation_*.py`, `test_fiscal_reconciliation_task.py`, `test_issue_fiscal_drafts.py`, `test_rcv_feeding.py`, `test_checkout_to_terminal_match.py`, `backend/treasury/tests/test_terminal_sale_match_fields.py`; rename `reconciliation_helpers.py` → `fiscal_match_helpers.py`
- Modify: `backend/core/fiscal_match.py` (eliminar `MatchStatus`)
- Create: migraciones que eliminan `TerminalSale.matched_invoice`, `match_status`, `matched_manually`, `rcv_document`, `issue_attempted_at`, `issue_error` (+ constraints) y `RCVDocument.matched_invoice`, `match_status`, `matched_manually` (+ constraint)
- Delete frontend: `FiscalReconciliationClientView.tsx` (+ test), `api/reconciliationApi.ts`, `types/reconciliation.ts`, `hooks/useFiscalReconciliation.ts`, `hooks/reconciliationKeys.ts`; quitar exports de barrels
- Modify: textos de la UI fiscal y docstrings de backend fiscal que digan «cuadre fiscal» / «reconciliación» → «cuadre»

- [ ] **Step 1:** `grep -rnE "matched_invoice|match_status|MatchStatus|PENDING_ERP|tax\.reconciliation|reconciliationApi|FiscalReconciliation|useRunReconciliation|Cuadre fiscal|cuadre fiscal" backend frontend --include=*.py --include=*.ts --include=*.tsx | grep -v migrations` → debe quedar vacío (salvo conciliación bancaria, que no usa estos nombres).
- [ ] **Step 2:** `makemigrations --check` limpio; suite backend: `pytest tax treasury accounting billing core -q` verde.
- [ ] **Step 3:** frontend `npm run type-check && npm run lint` y vitest de `features/tax features/accounting features/treasury lib/__tests__/fiscal-match.test.ts` verdes.
- [ ] **Step 4: Commit** `refactor: elimina los vínculos de cuadre por pares`

### Task 20: ADR, contratos y verificación en el servidor

**Files:**
- Create: `docs/10-architecture/adr/0141-cuadre-unificado-por-grupo.md` (enmienda 0138 D4–D6, 0139 D1–D3, 0140 D4–D5; decisiones y supuestos del spec); Modify: `docs/10-architecture/adr/README.md`, encabezados «Enmendado por ADR-0141» en 0138/0139/0140
- Modify: `docs/20-contracts/api-contracts.md` (rutas `/api/tax/fiscal-matches/`), glosario en `docs/00-context/` («Cuadre», «Grupo de cuadre», estados)

- [ ] **Step 1:** escribir ADR y docs.
- [ ] **Step 2:** servidor dev: `mutagen sync list` muestra `erpgrafico-sync … Connected: Yes`; `ssh pato@192.168.1.86 'cd ERPGrafico && docker compose exec backend python manage.py migrate && docker compose exec backend python manage.py shell -c "from tax.fiscal_match.engine import run_fiscal_match; print(run_fiscal_match())"'` → conteos sin `error`.
- [ ] **Step 3:** abrir `http://192.168.1.86:3000/accounting/rcv/cuadre`: conteos visibles, sin botones de recálculo, la ficha de un grupo abre y muestra sus 3 partes.
- [ ] **Step 4: Commit** `docs: ADR-0141 cuadre unificado por grupo`
