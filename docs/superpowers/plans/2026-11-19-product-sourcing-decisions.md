# Decisiones de abastecimiento por producto (Fase 3c-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fabricar vs comprar y uso como insumo con sensibilidad de costo, en un tab «Abastecimiento».

**Architecture:** Un selector compone `ProductionPerformanceSelector` (lado fabricar), agregados de recepciones de compra y líneas de BOM; un endpoint lo expone; un bloque de frontend lo muestra.

**Tech Stack:** Django 5/DRF, pytest, Next.js 16, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-product-sourcing-decisions-design.md`

## Global Constraints

- Playbooks `add-endpoint.md`, `add-selector.md`, `component-entity-view.md`. Tests backend: `cd backend && env DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q -p no:cacheprovider`; frontend: `source ~/.nvm/nvm.sh && nvm use 24 && cd frontend && npm run test -- <ruta>`.
- Cero N+1, vista ≤ 20 líneas, no tocar `serializers.py`, sin formateo ad hoc en entity-view (usar `formatNumber`/value kinds). SQLite castea decimales enteros a entero: dividir con `Cast(FloatField)` o en Python.

## Review Focus

- Sin recepciones o sin OT con costo: ahorro `null`, no 0.
- Recepción en otra UoM que la base: se convierte; costo por unidad base coherente.
- Recepciones no confirmadas o fuera de ventana: excluidas.
- Producto fabricable pero no comprable (o al revés): `make_vs_buy` null.
- Insumo en varias BOM activas / mismo insumo dos veces en una BOM: suma por BOM, sin duplicar padres.
- BOM de costo 0 o padre sin precio: sin división por cero (`null`).
- Variantes del insumo cuentan.
- `increase_pct` fuera de rango o no numérico: 400.

---

### Task 1: Selector de abastecimiento
**Files:** Create `backend/inventory/sourcing_selector.py`, `backend/inventory/tests/test_sourcing_selector.py`
**Interfaces:** Produces `SourcingSelector.get_sourcing(product, date_from=None, date_to=None, increase_pct=10) -> {"make_vs_buy": dict | None, "used_in": dict | None}`; consume `ProductionPerformanceSelector.get_performance` y `ProductSelector.get_capabilities`.
- [ ] Step 1: tests (RED): `test_make_vs_buy_only_when_manufactures_and_buys`, `test_buy_avg_and_last_cost`, `test_receipt_uom_converted_to_base`, `test_unconfirmed_and_out_of_window_receipts_ignored`, `test_saving_positive_when_making_is_cheaper`, `test_saving_null_without_receipts_or_orders`, `test_cheaper_flag`, `test_used_in_only_when_used_in_production`, `test_parent_share_and_sensitivity`, `test_margin_after_increase`, `test_zero_bom_cost_and_zero_price_are_null`, `test_same_component_twice_in_a_bom_sums`, `test_variants_of_component_count`, `test_query_count_constant`.
- [ ] Step 2: run → FAIL. Step 3: implementar. Step 4: run → PASS. Step 5: commit `feat(inventory): selector de abastecimiento`.

### Task 2: Endpoint `sourcing`
**Files:** Modify `backend/inventory/views.py`; create `backend/inventory/sourcing_params.py`; test `backend/inventory/tests/test_sourcing_endpoint.py`
- [ ] Tests (RED): shape, defaults, `increase_pct` 0/101/abc → 400, inverted dates 400, auth, 404. Implement. Run `pytest inventory sales -q`. Commit `feat(inventory): endpoint sourcing`.

### Task 3: API, hook y tipos
**Files:** `frontend/features/inventory/analytics/sourcing.types.ts`, `api/inventoryApi.ts`, `hooks/useProductSourcing.ts`, test en `hooks/__tests__/`.
- [ ] Tests (RED primero, luego implementación): params passed, disabled without id, refetch on change. tsc + eslint. Commit `feat(inventory): hook de abastecimiento`.

### Task 4: Tab «Abastecimiento»
**Files:** `analytics/SourcingBlock.tsx`, `entity-view/sourcingParent.entity.ts`, registro (+test), modal (+test).
- [ ] Tests (RED): registro (`sourcing` visible si `(manufactures && buys) || used_in_production`, tras `manufacturing`), bloque (comparativo, aviso por lado faltante, tabla de padres, cambio de % refetch, vacío/loading/error), modal (tab y montaje bajo demanda). Implement. Suites, tsc, eslint. Commit `feat(inventory): tab Abastecimiento en el análisis de producto`.

### Task 5: ADR-0147 y documentación
**Files:** `docs/10-architecture/adr/0147-decisiones-de-abastecimiento-por-producto.md`, índice, `docs/10-architecture/data-flow.md`.
- [ ] Redactar, indexar, correr suites, commit `docs(adr): ADR-0147 decisiones de abastecimiento`.
