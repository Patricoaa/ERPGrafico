# Rotación, cobertura y suscripciones por producto (Fase 3c-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rotación, cobertura, stock inmóvil y calendario/variación de suscripciones en un tab «Operación».

**Architecture:** Un selector agrega movimientos de stock (reusando la clasificación de flujo de `ProductSelector._stock_flow`) y suscripciones/pagos; un endpoint lo expone; un bloque de frontend lo muestra.

**Tech Stack:** Django 5/DRF, pytest, Next.js 16, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-product-operations-design.md`

## Global Constraints

- Playbooks `add-endpoint.md`, `add-selector.md`, `component-entity-view.md`. Tests backend: `cd backend && env DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q -p no:cacheprovider`; frontend: `source ~/.nvm/nvm.sh && nvm use 24 && cd frontend && npm run test -- <ruta>`.
- Cero N+1, vista ≤ 20 líneas, no tocar `serializers.py`, sin formateo ad hoc en entity-view (usar `formatNumber`/`formatDate`/value kinds). Rechazar valores no finitos en parámetros numéricos (`math.isfinite`). `git add` solo con rutas explícitas (el usuario tiene cambios propios sin commitear).
- SQLite castea decimales enteros a entero: dividir en Python o con `Cast(FloatField)`.

## Review Focus

- Sin salidas o sin stock promedio: rotación y cobertura `null`, no 0 ni división por cero.
- Stock inmóvil: `stock_now > 0` y sin salida en `idle_days`; con stock 0 no es inmóvil.
- Traspasos y ajustes no cuentan como entrada/salida pero el stock acumulado sí varía con ajustes.
- Variantes: sus movimientos cuentan para la plantilla.
- Promedio ponderado por días con ventana que empieza antes del primer movimiento (stock 0 antes).
- Suscripción vencida (`days_to_payment` negativo), pausada/cancelada fuera de los totales, frecuencia semanal/anual.
- Pagos: órdenes DRAFT/CANCELLED excluidas; el primer pago sin `change_pct`; `first_to_last_pct` con un solo pago `null`.
- Producto sin `tracks_stock` ni `recurring`: ambas secciones `null`. Parámetros inválidos (`idle_days` 0/501/nan/abc, fechas) → 400.

---

### Task 1: Selector de operación
**Files:** Modify `backend/inventory/selectors.py` (extraer la clasificación de flujo a un helper compartido sin cambiar resultados); create `backend/inventory/operations_selector.py`, `backend/inventory/tests/test_operations_selector.py`
**Interfaces:** Produces `OperationsSelector.get_operations(product, date_from=None, date_to=None, idle_days=90) -> {"rotation": dict | None, "subscriptions": dict | None}`.
- [ ] Step 1: tests (RED), rotación: `test_rotation_only_for_stock_tracking_products`, `test_turnover_and_days_of_inventory`, `test_avg_stock_is_time_weighted`, `test_no_outflow_gives_null_turnover_and_coverage`, `test_zero_avg_stock_gives_null_turnover`, `test_coverage_uses_last_90_days`, `test_transfers_and_adjustments_do_not_count_as_flow`, `test_idle_true_without_recent_outflow`, `test_zero_stock_is_never_idle`, `test_variants_count`, `test_series_has_monthly_out_and_closing_stock`, `test_stock_value`; suscripciones: `test_subscriptions_only_for_recurring_products`, `test_annualized_by_frequency`, `test_totals_only_count_active`, `test_due_90d_total_and_overdue_days`, `test_payments_exclude_draft_and_cancelled`, `test_payment_change_pct_and_first_to_last`, `test_single_payment_has_no_variation`; `test_query_count_constant`.
- [ ] Step 2: run → FAIL. Step 3: implementar. Step 4: run + `pytest inventory -q` → PASS. Step 5: commit `feat(inventory): selector de operación (rotación y suscripciones)`.

### Task 2: Endpoint `operations`
**Files:** Modify `backend/inventory/views.py`; create `backend/inventory/operations_params.py`; test `backend/inventory/tests/test_operations_endpoint.py`
- [ ] Tests (RED): shape, defaults, `idle_days` 0/501/abc/nan/inf → 400, inverted/invalid dates 400, auth, 404. Implement. Run `pytest inventory sales -q`. Commit `feat(inventory): endpoint operations`.

### Task 3: API, hook y tipos
**Files:** `frontend/features/inventory/analytics/operations.types.ts`, `api/inventoryApi.ts`, `hooks/useProductOperations.ts` (con `placeholderData: keepPreviousData`), test en `hooks/__tests__/`, export en `index.ts`.
- [ ] Tests (RED primero): params passed, disabled without id, refetch on change. Implementar. tsc + eslint. Commit `feat(inventory): hook de operación`.

### Task 4: Tab «Operación»
**Files:** `analytics/OperationsBlock.tsx`, `entity-view/operationsSubscription.entity.ts`, `entity-view/operationsPayment.entity.ts`, registro (+test), modal (+test).
- [ ] Tests (RED): registro (`operations` visible si `tracks_stock || recurring`, tras `sourcing`), bloque (tarjetas de rotación con valores nulos como «—», aviso de stock inmóvil, gráfico solo con serie, tabla de suscripciones y pagos, sección oculta si es null, vacío/loading/error, cambio de rango refetch), modal (tab y montaje bajo demanda). Implementar. Suites, tsc, eslint. Commit `feat(inventory): tab Operación en el análisis de producto`.

### Task 5: ADR-0148 y documentación
**Files:** `docs/10-architecture/adr/0148-rotacion-cobertura-y-suscripciones-por-producto.md`, índice, `docs/10-architecture/data-flow.md`.
- [ ] Redactar, indexar, correr suites, commit `docs(adr): ADR-0148 rotación, cobertura y suscripciones`.
