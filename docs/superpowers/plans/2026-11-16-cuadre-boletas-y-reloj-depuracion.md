# Cuadre de boletas RCV vía TUU y reloj de depuración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Cuadrar una a una las boletas 39/41 del RCV contra las ventas TUU, por mismo día y mismo monto, emparejando en orden. El vínculo con el ERP llega a través de la venta TUU.
- Agregar un reloj de depuración, solo para desarrollo, que mueva `timezone.now()` del backend para probar el cruce con ventas TUU pasadas.

**Architecture:** Un servicio nuevo `tax/reconciliation/boletas.py` corre después del cuadre TUU y después de cada importación del RCV de ventas, y escribe `TerminalSale.rcv_document` más el estado del `RCVDocument`. El reloj vive en `core/debug_clock.py`: un desfase en caché, aplicado con `time-machine` desde un middleware y desde una señal de Celery, controlado por un comando y avisado con un banner en el frontend.

**Tech Stack:** Django 5 + DRF, Celery, Redis, `time-machine`; Next.js 16, TanStack Query.

**Spec:** `docs/10-architecture/adr/0139-cuadre-boletas-rcv-via-tuu-y-reloj-de-depuracion.md` (enmienda ADR-0138 D5).

## Global Constraints

- Rigen las 14 invariantes de `CLAUDE.md`. Las que más se tocan aquí: vistas ≤ 20 líneas, zero N+1 con test de query count, zero `any`, tokens semánticos, imports por barrel, hooks en `features/*/hooks`.
- El cuadre **nunca** modifica una factura del ERP: solo escribe en `TerminalSale` y `RCVDocument`.
- Clave del paso 2: `timezone.localdate(ts.transaction_at) == doc.issue_date` y `ts.sale_amount == abs(doc.total_amount)`, con el tipo `ts.document_type == doc.dte_type` restringido a 39 o 41.
- Emparejamiento: ventas TUU ordenadas por `(transaction_at, id)` y boletas RCV ordenadas por `(folio, id)`, emparejadas 1 a 1 en orden. Lo que sobra queda sin par.
- El reloj de depuración actúa solo si `settings.DEBUG` **y** la variable de entorno `DEBUG_CLOCK_ENABLED == "1"`. En otro caso es un no-op y no importa `time-machine`.
- Comando backend (desde `backend/`): `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q -p no:cacheprovider`. Frontend con Node 24 (`export PATH=/home/pato/.nvm/versions/node/v24.18.0/bin:$PATH`): `npx vitest run --project '!storybook' <ruta>`, `npm run type-check`, `eslint` sobre lo tocado.
- Copia de UI en español: «Reloj de depuración: {fecha y hora}», «Falta en el SII», «Boleta SII», «Venta TUU».
- Commits en español con formato `tipo(app): ...` y el trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Rama `feat/cuadre-boletas-reloj`.

## Review Focus

1. **Montos repetidos con cantidades distintas** (3 ventas TUU de $1.250 y 2 boletas RCV de $1.250 el mismo día): se emparejan las 2 primeras en orden y la tercera venta queda sin boleta. Ninguna boleta se usa dos veces. Test en la tarea 3.
2. **Una venta TUU de las 23:59 hora local** se cruza con la boleta de ese día local, no con la del día siguiente por UTC. Test en la tarea 3.
3. **El paso 1 cambia después del paso 2** (una venta TUU se vincula o desvincula del ERP): al recalcular, `RCVDocument.matched_invoice` sigue a la venta. Test en la tarea 4.
4. **Reloj activo y se cambia la hora sin reiniciar:** la siguiente request ya usa la hora nueva; con `reset`, vuelve la hora real. Test en la tarea 1.
5. **`DEBUG=False` con `DEBUG_CLOCK_ENABLED=1`:** el reloj no se aplica y el comando se niega con un error claro. Test en la tarea 1.

---

### Task 1: Reloj de depuración (backend)

**Files:**
- Create: `backend/core/debug_clock.py`
- Create: `backend/core/management/commands/debug_clock.py`
- Modify: `backend/config/settings.py` (agregar `core.debug_clock.DebugClockMiddleware` **primero** en `MIDDLEWARE`, siempre presente: el middleware se autodesactiva)
- Modify: `backend/config/celery.py` (conectar `task_prerun` a `apply_debug_clock`)
- Modify: `backend/core/views.py:409` (`server_time` agrega `debug_clock: bool`)
- Modify: `backend/requirements.txt` (agregar `time-machine`)
- Test: `backend/core/tests/test_debug_clock.py`

**Interfaces:**
- Produces:
  - `is_enabled() -> bool`: devuelve `settings.DEBUG and os.environ.get("DEBUG_CLOCK_ENABLED") == "1"`.
  - `set_clock(target: datetime) -> None`: guarda en caché, bajo la clave `"debug_clock:offset_seconds"`, el desfase `target - real_now` en segundos (float).
  - `reset_clock() -> None`.
  - `current_offset() -> float | None`.
  - `apply_debug_clock() -> None`: lee el desfase. Si cambió respecto del aplicado en este proceso, detiene el `time_machine.travel` anterior e inicia uno nuevo con `tick=True` hacia `real_now + offset`. Es global al proceso, usa un `threading.Lock` y nunca se detiene por request. Si el desfase es `None`, detiene el viaje activo.
  - `is_active() -> bool`.
  - `DebugClockMiddleware`: llama a `apply_debug_clock()` cuando `is_enabled()`.
  - Comando `debug_clock set "AAAA-MM-DD HH:MM"` (hora local `America/Santiago`) | `reset` | `show`. Si `is_enabled()` es falso, `CommandError("El reloj de depuración solo funciona con DEBUG=True y DEBUG_CLOCK_ENABLED=1.")`.
  - `server_time` responde `debug_clock` = `is_enabled() and is_active()` y `debug_tools` = `is_enabled()`.
  - Endpoint `/api/core/debug/clock/`, en `core/debug_clock_views.py`, registrado en `core/urls.py`:
    - `GET` → `{active, now, offset_seconds}`;
    - `POST {datetime: "AAAA-MM-DDTHH:MM"}` (hora local) → fija y aplica;
    - `DELETE` → restablece.

    Permiso `IsAdminUser`, que exige superusuario: un permiso propio que lanza 404 cuando `not is_enabled()` y que, si está habilitado, exige `request.user.is_superuser`. Cada `POST` o `DELETE` deja un log de auditoría con el mecanismo existente de `core` (buscar `AuditLog`/`log_security_event`). Vistas ≤ 20 líneas.

- [ ] **Step 1: Write the failing tests** (`override_settings(DEBUG=True)` + `monkeypatch.setenv`):
  - `test_set_clock_moves_timezone_now`: tras `set_clock(2026-11-13 17:35 local)` y `apply_debug_clock()`, `timezone.localtime()` queda dentro de ±5 s de esa hora.
  - `test_clock_ticks`: dos lecturas separadas por `sleep(0.05)` son crecientes.
  - `test_change_without_restart_and_reset` (Review Focus 4): tras un segundo `set_clock` y `apply`, la hora es la nueva; tras `reset_clock()` y `apply`, vuelve a ±5 s de la real.
  - `test_disabled_when_not_debug` (Review Focus 5): con `DEBUG=False` y el env en 1, `apply` no mueve la hora y el comando lanza el `CommandError` exacto.
  - `test_server_time_reports_flag`: `GET /api/core/server-time/` devuelve `debug_clock` en `false` y luego en `true`, y `debug_tools` según `is_enabled()`.
  - `test_clock_endpoint_404_when_disabled`, `test_clock_endpoint_requires_superuser` (staff no superusuario → 403), `test_clock_endpoint_set_get_reset` (el `POST` mueve `timezone.now()` en la siguiente request; el `DELETE` la restablece) y `test_clock_endpoint_audits_changes`.
  - Fixture autouse que llama a `reset_clock()` y `apply_debug_clock()` al terminar cada test, para no contaminar la suite.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest core/tests/test_debug_clock.py -q` y luego `…pytest core -q`. Expected: PASS, salvo las 6 fallas preexistentes de core.
- [ ] **Step 5: Commit** `feat(core): reloj de depuración para desarrollo (ADR-0139 D4)`.

### Task 2: Pantalla de depuración, banner del reloj y documentación

**Files:**
- Modify: el tipo y la respuesta que consume `frontend/hooks/useServerDate.ts` (agregar `debug_clock?: boolean` y `debug_tools?: boolean`)
- Create: `frontend/app/(dashboard)/settings/debug/page.tsx` (con el mismo patrón que `settings/jobs/page.tsx`)
- Create: `frontend/features/settings/components/DebugSettingsView.tsx`, `frontend/features/settings/components/DebugClockForm.schema.ts`, `frontend/features/settings/api/debugApi.ts` y `frontend/features/settings/hooks/useDebugClock.ts`. Seguir la estructura real del feature `settings`. El formulario usa react-hook-form + zodResolver, con un campo fecha-hora local y los botones «Fijar hora» y «Volver a la hora real». También muestra la hora actual del servidor y si el reloj está alterado.
- Modify: `frontend/app/(dashboard)/settings/SettingsHeader.tsx` (pestaña «Depuración») y `SettingsPageClient.tsx` (tarjeta), visibles solo con `debug_tools` verdadero **y** usuario superusuario (usar el hook o contexto de usuario actual existente)
- Test: `frontend/features/settings/components/__tests__/DebugSettingsView.test.tsx` (fijar hora llama a la mutación con el valor, restablecer llama a `DELETE`, estados de carga y error) y un test de que la pestaña no aparece sin `debug_tools`
- Create: `frontend/components/shared/DebugClockBanner.tsx` (exportado por el barrel de `@/components/shared`), o el lugar donde ya vivan los banners globales si existe uno
- Modify: el layout del dashboard (`frontend/app/(dashboard)/layout.tsx` o el shell equivalente), donde se monta el banner
- Modify: `docs/30-playbooks/remote-dev-server.md` (sección «Reloj de depuración»: activar con `DEBUG_CLOCK_ENABLED=1` en el `.env` del servidor de desarrollo, reiniciar `backend` y `celery-worker`, usar `docker compose exec backend python manage.py debug_clock set "2026-11-13 17:35"`, `reset`, `show`, y sus límites)
- Test: `frontend/components/shared/__tests__/DebugClockBanner.test.tsx`

**Interfaces:**
- Consumes: el campo `debug_clock` de la tarea 1.
- Produces: `DebugClockBanner`, que se renderiza solo si `debug_clock` es verdadero. Muestra «Reloj de depuración: {dd-mm-aaaa HH:mm}» con la hora del servidor, usa un tono de advertencia con tokens semánticos y queda fijo en la parte superior.

- [ ] **Step 1: Write the failing test:** el banner aparece con `debug_clock: true` y la hora formateada, y no se renderiza con `false` ni sin el campo.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, reusando la query de `useServerDate` sin crear otra. Si `useServerDate` no refresca, que el banner use un `refetchInterval` de 60 s dentro del hook.
- [ ] **Step 4: Run** el test, `type-check` y `eslint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(settings): pantalla de depuración con reloj del servidor, banner y guía de uso`.

### Task 3: Vínculo venta TUU ↔ boleta RCV y servicio de emparejamiento

**Files:**
- Modify: `backend/treasury/models.py` (`TerminalSale.rcv_document`: FK a `accounting.RCVDocument`, `null`, `SET_NULL`, `related_name="terminal_sales"`, `UniqueConstraint(fields=["rcv_document"], condition=Q(rcv_document__isnull=False), name="terminalsale_rcv_document_uniq")`)
- Create: migración `treasury/0108_terminalsale_rcv_document.py`
- Create: `backend/tax/reconciliation/boletas.py`
- Modify: `backend/tax/reconciliation/rcv.py` (`reconcile_rcv_period` deja de seleccionar filas 39/41: no las toca)
- Test: `backend/tax/tests/test_reconcile_boletas.py`

**Interfaces:**
- Produces: `reconcile_rcv_boletas(year: int, month: int) -> dict[str, int]`, con `@transaction.atomic` y conteos por `MatchStatus` de los `RCVDocument` 39/41 evaluados. Algoritmo:
  1. Si no hay `fiscal_match_start_date` o el mes termina antes de esa fecha, devuelve `{}`.
  2. Selección RCV: documentos de `SALES`, período `f"{year}{month:02d}"`, `dte_type` en (39, 41), sin `matched_manually`, más los manuales cuya factura sea nula o esté `CANCELLED` (a esos se les resetea `matched_manually`). Selección TUU: ventas `COMPLETED` con `document_type` en (39, 41) y `transaction_at` en el mes local.
  3. Limpieza: un `UPDATE` deja `rcv_document = NULL` en las ventas TUU seleccionadas cuyo `rcv_document` está en la selección RCV o es nulo. Las vinculadas a boletas manuales válidas se conservan y quedan fuera del emparejamiento.
  4. Las boletas con `missing_since_import` quedan `EXCLUDED` y sin enlaces.
  5. Se agrupa por `(día local, monto, tipo)`, se ordena según Global Constraints y se empareja con `zip` en orden.
  6. Cada boleta con par queda `MATCHED`, con `matched_invoice = venta.matched_invoice_id` (puede ser nulo). Cada boleta sin par queda `ONLY_EXTERNAL` y `matched_invoice = None`.
  7. Un `bulk_update` por modelo (`batch_size=500`).

  Query count constante en el número de filas.

- [ ] **Step 1: Write the failing tests:**
  - `test_pairs_by_day_and_amount`.
  - `test_duplicates_pair_in_order` (Review Focus 1): 3 ventas de $1.250 a las 09:00, 11:00 y 17:00, y 2 boletas con folios 100 y 101 → (09:00 ↔ 100), (11:00 ↔ 101), la venta de las 17:00 queda sin `rcv_document`, y ninguna boleta se repite.
  - `test_local_day_boundary` (Review Focus 2): venta a las 23:59 local del día 13 (que en UTC ya es día 14) ↔ boleta con `issue_date` 13.
  - `test_type_must_match`: una venta 39 no se empareja con una boleta 41.
  - `test_rcv_without_sale_is_only_external`.
  - `test_matched_invoice_follows_sale`: la venta tiene `matched_invoice` → la boleta toma esa factura.
  - `test_manual_rcv_row_respected`.
  - `test_missing_since_import_excluded`.
  - `test_rcv_period_reconcile_leaves_boletas_untouched`: `reconcile_rcv_period` ya no cambia filas 39/41.
  - `test_idempotent`.
  - `test_query_count_constant`: el mismo número de consultas con 5 y con 40 boletas.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** (con `makemigrations treasury --name terminalsale_rcv_document`; verificar que solo contenga este cambio).
- [ ] **Step 4: Run** `…pytest tax treasury -q`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): boletas del RCV emparejadas con la venta TUU por día y monto (ADR-0139 D1-D2)`.

### Task 4: Disparadores y propagación

**Files:**
- Modify: `backend/treasury/tasks.py:943` (`_reconcile_after_sync`: después de `reconcile_terminal_sales`, llamar a `reconcile_rcv_boletas` para cada mes que toca el rango del run)
- Modify: `backend/accounting/tasks.py:80` (después de `reconcile_rcv_period`, si la dirección es `SALES`, llamar a `reconcile_rcv_boletas(year, month)`)
- Modify: `backend/tax/reconciliation_views.py` (`terminal/run` y `rcv/run` también corren `reconcile_rcv_boletas` del mes; la respuesta agrega la clave `boletas` con sus conteos)
- Modify: `backend/tax/reconciliation/terminal.py` (`match_terminal_sale` y `unmatch_terminal_sale`: si la venta tiene `rcv_document`, actualizar `rcv_document.matched_invoice` en la misma transacción)
- Test: `backend/tax/tests/test_reconcile_boletas.py` (agregar casos), `backend/treasury/tests/test_terminal_sync_tasks.py`, `backend/accounting/tests/` (el test de la tarea de importación)

**Interfaces:**
- Consumes: `reconcile_rcv_boletas` (tarea 3).
- Produces: que el paso 2 corra cada vez que cambia el paso 1 o el RCV.

- [ ] **Step 1: Write the failing tests:**
  - `test_terminal_reconcile_propagates_to_rcv` (Review Focus 3): la boleta queda `MATCHED` sin factura; después la venta se vincula al ERP con `match_terminal_sale` → la boleta toma `matched_invoice`; con `unmatch` → vuelve a `None`.
  - `test_sync_task_runs_boletas_for_each_month` (con patch).
  - `test_rcv_sales_import_runs_boletas` (con patch; una importación de `PURCHASES` no lo llama).
  - `test_run_endpoints_include_boletas_counts`.
  - Un error en `reconcile_rcv_boletas` se registra en el log y no hace fallar la tarea.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest tax treasury accounting -q`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): el cuadre de boletas corre tras TUU, RCV y vínculos manuales (ADR-0139 D3)`.

### Task 5: Reporte, pendientes y pantallas

**Files:**
- Modify: `backend/tax/reconciliation/report.py`:
  - `summaries[]` agrega `tuu_without_rcv` (ventas TUU 39/41 del mes sin `rcv_document`) y `rcv_without_tuu` (boletas `ONLY_EXTERNAL`). Para 48 ambos valen `null`.
  - `fiscal_mismatch_counts` suma las boletas 39/41 `ONLY_EXTERNAL`, ya incluidas por el filtro de estado. Verificar que no se cuenten dos veces.
- Modify: `backend/treasury/serializers.py` (`TerminalSale` expone `rcv_document`, `rcv_folio`; `select_related` en el selector) y `backend/accounting/rcv_serializers.py` (`RCVDocument` expone `terminal_sale` (id) y `terminal_sale_display`, sin N+1: `prefetch` o `annotate` en el selector)
- Modify: `frontend/features/tax/components/FiscalReconciliationClientView.tsx` (+ entity, tipos): dos columnas o filas nuevas en «Boletas y comprobantes»: «Venta TUU sin boleta SII» y «Boleta SII sin venta TUU»
- Modify: `frontend/features/treasury/components/TerminalSaleDrawer.tsx` (fila «Boleta SII»: folio y enlace `openEntity('accounting.rcvdocument', id)`) y `frontend/features/accounting/components/rcv/RcvDocumentDrawer.tsx` (fila «Venta TUU» con `openEntity('treasury.terminalsale', id)`)
- Test: `backend/tax/tests/test_reconciliation_report.py`, los tests de serializers o API existentes de TUU y RCV, y los tests de los dos drawers y de la vista

**Interfaces:**
- Consumes: `TerminalSale.rcv_document` (tarea 3).
- Produces: los campos `tuu_without_rcv`, `rcv_without_tuu`, `rcv_document`, `rcv_folio`, `terminal_sale` y `terminal_sale_display`.

- [ ] **Step 1: Write the failing tests**, incluyendo query count constante en los listados de TUU y RCV.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `…pytest tax treasury accounting -q`, los vitest tocados, `type-check` y `eslint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tax): reporte y fichas muestran el cruce boleta SII ↔ venta TUU`.

### Task 6: Documentación de contratos

**Files:**
- Modify: `docs/10-architecture/adr/0138-registro-dte-local-con-control-fiscal-externo.md` (en D5, nota «Enmendado por ADR-0139: las boletas 39/41 se cuadran una a una vía la venta TUU»)
- Modify: `docs/20-contracts/api-contracts.md` (campos nuevos de TUU y RCV, `debug_clock` en server-time, la clave `boletas` en las respuestas de run, y las columnas nuevas del reporte)

- [ ] **Step 1: Edit.**
- [ ] **Step 2: Verify** `grep -n 0139 docs/10-architecture/adr/0138-*.md` (una coincidencia).
- [ ] **Step 3: Commit** `docs: ADR-0139 enmienda el cuadre de boletas de ADR-0138`.
