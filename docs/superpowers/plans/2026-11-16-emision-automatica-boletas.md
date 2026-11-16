# Emisión automática de boletas desde TUU y el RCV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Toda boleta 39/41 y todo comprobante 48 sin folio nace en borrador.
- El cuadre ERP ↔ TUU ↔ RCV, que corre cada 10 minutos, los emite con el folio del RCV (39/41) o con el id TUU (48).
- La sincronización TUU pasa a tener un intervalo configurable en minutos, horas o días.

**Architecture:**
- `create_sale_invoice` deja de emitir sin folio.
- El paso 1 del cuadre acepta borradores.
- Un servicio nuevo, `issue_fiscal_drafts`, confirma los borradores que tienen evidencia externa.
- Una tarea periódica encadena terminal → boletas → emisión → boletas.
- `TerminalSyncSettings` agrega un intervalo con unidad, y su despachador corre cada minuto.

**Tech Stack:** Django 5 + DRF, Celery Beat (`CELERY_BEAT_SCHEDULE` en `config/settings.py`), Next.js 16.

**Spec:** `docs/10-architecture/adr/0140-emision-automatica-de-boletas-desde-tuu-y-rcv.md` (enmienda ADR-0138 D3 y amplía ADR-0139).

## Global Constraints

- Rigen las 14 invariantes de `CLAUDE.md`: vistas ≤ 20 líneas, zero N+1 con test de query count, zero `any`, imports por barrel, hooks en `features/*/hooks`, formularios con react-hook-form + zod.
- `FOLIO_EXEMPT_DTE_TYPES = ("BOLETA", "BOLETA_EXENTA", "COMPROBANTE_PAGO")` se mantiene como el conjunto de «tipos que emite el proveedor».
- Número del 48: `sale_id` si no está vacío y no es `"N/A"` (sin distinguir mayúsculas); si no, `sequence_number`. Si ambos están vacíos, no se emite.
- Fecha al emitir: 39/41 → `rcv_document.issue_date`; 48 → `timezone.localdate(terminal_sale.transaction_at)`.
- Nunca se modifica un documento `POSTED` (ADR-0091). La emisión usa `BillingService.confirm_invoice(invoice, number, date=...)`.
- Valor nuevo de `MatchStatus`: `PENDING_ERP`, con la etiqueta «Sin documento ERP».
- Comando backend (desde `backend/`): `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q -p no:cacheprovider`. Frontend con Node 24: `npx vitest run --project '!storybook' <ruta>`, `npm run type-check`, `eslint` sobre lo tocado.
- Commits en español con formato `tipo(app): ...` y el trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Rama `feat/emision-automatica-boletas`.

## Review Focus

1. **Una boleta del POS en efectivo:** queda en borrador; la venta TUU la vincula; el RCV llega con el folio 72762 y la boleta se emite con número 72762 y la fecha del SII. Test end-to-end en la tarea 3.
2. **Un 48 de una venta TUU con `sale_id="N/A"`:** se emite con el `sequence_number`. Test en la tarea 3.
3. **La emisión falla porque el período tributario está cerrado:** el documento queda en borrador, se registra en el log y los demás se emiten igual. Test en la tarea 3.
4. **Dos ejecuciones simultáneas de la tarea periódica:** la segunda se salta por el candado. Test en la tarea 4.
5. **Intervalo TUU de 30 minutos:** a los 29 minutos de la última sincronización programada no lanza; a los 30 sí. Con la unidad `DAYS` se respeta `run_hour`. Test en la tarea 5.

---

### Task 1: Boletas y comprobantes sin folio nacen en borrador

**Files:**
- Modify: `backend/billing/services.py:491+` (`create_sale_invoice`: se elimina el parámetro `folio_exempt` y la rama que dejaba `POSTED` sin número; un `POSTED` sin número siempre baja a `DRAFT`)
- Modify: `backend/billing/pos_checkout_documents.py`, `backend/billing/services.py:1303-1321` (se quita `folio_exempt` del checkout), `backend/core/management/commands/setup_demo_data.py:2878`
- Modify: `backend/billing/sale_documents.py` (se elimina `folio_exempt_for_session` si queda sin uso; se mantiene `FOLIO_EXEMPT_DTE_TYPES`)
- Modify: `backend/billing/models.py` (`display_id`: se elimina la rama `-#pk` para `POSTED` sin número, que ya no existe)
- Test: actualizar `backend/billing/tests/test_sale_invoice_share.py`, `test_pos_checkout_documents.py`, `test_sale_documents.py` y `backend/tax/tests/test_checkout_to_terminal_match.py` (ahora esperan `DRAFT`)

**Interfaces:**
- Produces: `create_sale_invoice(..., *, amount, line_shares, net_tax_discount, link_advances)` sin `folio_exempt`. Boletas y 48 del POS quedan `DRAFT` con `number == ""`.

- [ ] **Step 1:** Actualizar los tests para que esperen `DRAFT`:
  - `test_boleta_paid_with_integrated_terminal_is_48` → `DRAFT`;
  - `test_boleta_cash_is_39_without_invented_folio` → `DRAFT`;
  - un test nuevo, `test_pos_boleta_never_posted_without_folio`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest billing tax core -q`. Expected: PASS, salvo las fallas preexistentes de core. Si `audit_document_integrity` tiene una exención para 39/41/48 sin folio, sigue siendo válida y se mantiene.
- [ ] **Step 5: Commit** `feat(billing): boletas y comprobantes sin folio nacen en borrador (ADR-0140 D1)`.

### Task 2: El cuadre considera borradores y estado PENDING_ERP

**Files:**
- Modify: `backend/core/fiscal_match.py` (agregar `PENDING_ERP = "PENDING_ERP", _("Sin documento ERP")`). Revisar si `match_status` tiene `max_length=20`; el valor cabe. Generar las migraciones de `choices` si Django las detecta, en `treasury` y `accounting`.
- Modify: `backend/tax/reconciliation/terminal.py` (`_candidates` en ~99 y `_sale_documents` en ~179: `Q(status=POSTED) | Q(status=DRAFT, dte_type__in=FOLIO_EXEMPT_DTE_TYPES, number="")`)
- Modify: `backend/tax/reconciliation/boletas.py` (`_assign`: `MATCHED` si `sale.matched_invoice_id` es verdadero después del guard de factura tomada; `PENDING_ERP` si la venta no tiene documento ERP o su factura está tomada en otra parte)
- Modify: `backend/tax/reconciliation/report.py` (`fiscal_mismatch_counts` suma `PENDING_ERP` a `by_status` y a `count`) y `frontend/lib/fiscal-match.ts` (etiqueta y tono de `PENDING_ERP`), más el tipo de TS
- Test: `backend/tax/tests/test_reconcile_terminal.py` (`test_draft_pos_boleta_is_candidate`; un `DRAFT` con número **no** es candidato), `test_reconcile_boletas.py` (`test_boleta_without_erp_is_pending_erp`), `test_reconciliation_report.py`, `frontend/lib/__tests__/fiscal-match.test.ts`

- [ ] **Step 1: Write the failing tests.**
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest tax treasury accounting -q`, el vitest del archivo de lib y `type-check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): el cuadre incluye borradores sin folio y marca boletas sin documento ERP (ADR-0140 D2, D5)`.

### Task 3: Emisión automática de borradores

**Files:**
- Create: `backend/tax/reconciliation/issuing.py`
- Test: `backend/tax/tests/test_issue_fiscal_drafts.py`

**Interfaces:**
- Produces: `issue_fiscal_drafts(year: int, month: int) -> dict[str, int]`, que devuelve `{"issued": n, "failed": m}`.
  - **Selección:** borradores de venta 39/41/48 con `number=""` que tienen una `TerminalSale` vinculada (`terminal_sales`), con `select_related` de la venta TUU y de su `rcv_document`, y cuya fecha de venta cae en el mes. Una sola consulta de selección.
  - **Número y fecha:** según Global Constraints.
  - **Emisión:** cada `confirm_invoice` va dentro de su propio `transaction.atomic()`. Un error se registra con `logger.warning`, que incluye el id y el mensaje, y la emisión sigue con el siguiente.
  - **Exclusiones:** los 39/41 sin `rcv_document` no se emiten; un 48 sin `sale_id` ni `sequence_number` tampoco.

- [ ] **Step 1: Write the failing tests:**
  - `test_cash_boleta_issued_with_rcv_folio_and_date` (Review Focus 1, de punta a punta: checkout POS en efectivo, venta TUU, boleta RCV, `reconcile_terminal_sales`, `reconcile_rcv_boletas`, `issue_fiscal_drafts` → `POSTED`, `number == "72762"`, `date == issue_date` y asiento publicado).
  - `test_48_uses_sale_id_or_sequence` (Review Focus 2).
  - `test_boleta_without_rcv_stays_draft`.
  - `test_failure_is_isolated` (Review Focus 3, con `TaxPeriodService.is_period_closed` en patch para uno de dos documentos).
  - `test_duplicate_folio_fails_cleanly`.
  - `test_query_count_bounded`: la selección es una sola consulta. Lo demás escala con los documentos emitidos, y es aceptable porque cada emisión es una transacción contable.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest tax billing -q`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): emisión automática de boletas y comprobantes con folio RCV o id TUU (ADR-0140 D3)`.

### Task 4: Tarea periódica de cuadre cada 10 minutos

**Files:**
- Create: `backend/tax/tasks.py` (si no existe), con `@shared_task(name="tax.tasks.run_fiscal_reconciliation")`
- Modify: `backend/config/settings.py` `CELERY_BEAT_SCHEDULE` (`"run_fiscal_reconciliation_10min": {"task": "tax.tasks.run_fiscal_reconciliation", "schedule": crontab(minute="*/10")}`)
- Modify: `backend/tax/reconciliation_views.py` (`terminal/run` y `rcv/run` también llaman a `issue_fiscal_drafts` del mes; la respuesta agrega `"issued"`)
- Test: `backend/tax/tests/test_fiscal_reconciliation_task.py`

**Interfaces:**
- Produces: `run_fiscal_reconciliation() -> dict`. Toma el candado de caché `"tax:fiscal_reconciliation:lock"` con un timeout de 9 minutos (`cache.add`). Si no lo obtiene, devuelve `{"skipped": True}`.
  - Sin `fiscal_match_start_date`, devuelve `{"skipped": True}`.
  - Meses que procesa: el actual y, si el día local es ≤ 10, también el anterior.
  - Por cada mes, en orden: `reconcile_terminal_sales(primer día, último día)`, `reconcile_rcv_boletas`, `issue_fiscal_drafts`, `reconcile_rcv_boletas`. Cada paso va en su propio `try/except` con `logger.exception`.
  - Libera el candado en un `finally`.

- [ ] **Step 1: Write the failing tests:**
  - `test_runs_chain_in_order` (con patch, verificando el orden de llamada);
  - `test_includes_previous_month_first_days`;
  - `test_lock_skips_concurrent_run` (Review Focus 4);
  - `test_no_start_date_skips`;
  - `test_step_failure_does_not_stop_others`;
  - `test_beat_schedule_registered` (la clave existe en `CELERY_BEAT_SCHEDULE`).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest tax -q`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): cuadre fiscal automático cada 10 minutos (ADR-0140 D4)`.

### Task 5: Intervalo configurable de sincronización TUU

**Files:**
- Modify: `backend/treasury/models.py` (`TerminalSyncSettings`: agregar `interval_value = PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1)])` e `interval_unit = CharField(choices=MINUTES/HOURS/DAYS, default="DAYS", max_length=10)`; mínimo efectivo de 5 minutos, validado en el serializer)
- Create: la migración `treasury/0109_terminalsyncsettings_interval.py`
- Modify: `backend/treasury/terminal_sync_service.py`:
  - `daily_range` → `scheduled_range(settings, today)`, que termina **hoy**;
  - nuevo `is_sync_due(settings, now_local, last_scheduled_at: datetime | None) -> bool`: con la unidad `DAYS` exige `now_local.hour >= run_hour`; para todas las unidades exige `now - last >= intervalo`.
- Modify: `backend/treasury/tasks.py` `dispatch_terminal_sales_sync` (usa `is_sync_due` con el último `TerminalSyncRun` de origen programado, por su `started_at`)
- Modify: `backend/config/settings.py` (la entrada de beat de la sincronización TUU pasa a `crontab(minute="*")`)
- Modify: el serializer de `TerminalSyncSettings` y el formulario de Tesorería → Configuración en el frontend (buscar dónde se edita `run_hour` y `lookback_days`) con los campos «Cada» (número) y «Unidad» (Minutos / Horas / Días). `run_hour` solo se muestra si la unidad es Días. Zod: valor ≥ 1, y en minutos ≥ 5.
- Test: `backend/treasury/tests/test_terminal_sync_service.py` y `test_terminal_sync_tasks.py` (Review Focus 5), más el test del schema o formulario del frontend

- [ ] **Step 1: Write the failing tests.**
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** (`makemigrations treasury --name terminalsyncsettings_interval`).
- [ ] **Step 4: Run** `…pytest treasury -q`, los vitest tocados, `type-check` y `eslint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(treasury): sincronización TUU con intervalo en minutos, horas o días (ADR-0140 D6)`.

### Task 6: Documentación

**Files:**
- Modify: ADR-0138 D3 (nota «Enmendado por ADR-0140: las boletas y comprobantes sin folio nacen en borrador») y ADR-0139 D2 (`PENDING_ERP`)
- Modify: `docs/20-contracts/api-contracts.md` (`PENDING_ERP`, la clave `issued` en las respuestas de run, y los campos `interval_value` / `interval_unit`)
- Modify: `docs/10-architecture/adr/README.md` (fila de 0140, si no está)

- [ ] **Step 1: Edit.**
- [ ] **Step 2: Verify** con `grep -n 0140` en ADR-0138 (una coincidencia) y en el README.
- [ ] **Step 3: Commit** `docs: ADR-0140 enmienda la emisión de boletas de ADR-0138`.
