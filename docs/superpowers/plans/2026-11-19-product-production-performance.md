# Rendimiento de fabricación por producto (Fase 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costo real contra BOM, desviación por insumo, tiempos por etapa y margen por OT en un tab "Fabricación".

**Architecture:** Un selector agrega OT terminadas, consumos, materiales e historial en la BD; un endpoint lo expone; un bloque de frontend lo muestra.

**Tech Stack:** Django 5/DRF, pytest, Next.js 16, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-product-production-performance-design.md`

## Global Constraints

- Playbooks `add-endpoint.md`, `add-selector.md`, `component-entity-view.md`. Tests backend: `cd backend && env DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q -p no:cacheprovider`; frontend: `source ~/.nvm/nvm.sh && nvm use 24 && cd frontend && npm run test -- <ruta>`.
- Base: rama de `feat/product-sales-impact`. Lógica en el selector; vista ≤ 20 líneas; cero N+1. SQLite castea decimales enteros a entero: usar `Cast(FloatField)` en divisiones.
- No tocar `serializers.py` (cambios ajenos sin commitear).

## Review Focus

- OT sin consumos: no rompe ni entra en promedios; consumo sin `stock_move` marca `estimated`.
- OT en curso o anulada: excluida.
- `planned_cost = 0`: `deviation_pct` 0, sin división por cero.
- Producto sin BOM activa: `bom_cost = 0` y `bom_gap_pct = 0`.
- Cantidad del material en otra UoM que la base del componente: se convierte.
- Producto express: sin etapas ni lead time.
- Variantes: OT de variantes cuentan para la plantilla.
- Rango sin OT: KPIs en cero, listas vacías, 400 en parámetros inválidos.

---

### Task 1: Selector de rendimiento de fabricación
**Files:** Create `backend/inventory/production_performance_selector.py`, `backend/inventory/tests/test_production_performance_selector.py`
**Interfaces:** Produces `ProductionPerformanceSelector.get_performance(product, date_from=None, date_to=None) -> dict` con la forma del spec.
- [ ] Step 1: tests (RED): `test_real_cost_from_consumption_moves`, `test_missing_stock_move_marks_estimated`, `test_planned_cost_from_snapshot`, `test_deviation_and_pct`, `test_zero_planned_has_zero_pct`, `test_unfinished_orders_excluded`, `test_order_without_consumption_listed_but_not_averaged`, `test_unit_real_cost_vs_bom`, `test_no_bom_gap_zero`, `test_margin_from_sale_line`, `test_manual_order_uses_stage_quantity`, `test_actual_quantity_wins`, `test_material_uom_converted`, `test_stage_durations_and_lead_time`, `test_express_has_no_stages`, `test_rectification_rate`, `test_variant_orders_included`, `test_empty_range_zeroed`, `test_query_count_constant`.
- [ ] Step 2: run → FAIL. Step 3: implementar. Step 4: run → PASS. Step 5: commit `feat(inventory): selector de rendimiento de fabricación`.

### Task 2: Endpoint `production-performance`
**Files:** Modify `backend/inventory/views.py`; create `backend/inventory/production_performance_params.py`; test `backend/inventory/tests/test_production_performance_endpoint.py`
**Interfaces:** Consumes selector; produces `GET /api/inventory/products/{id}/production-performance/` (`date_from`, `date_to`).
- [ ] Tests (RED): shape, defaults, invalid dates 400, inverted dates 400, auth, 404. Implement. Run `pytest inventory sales production -q`. Commit `feat(inventory): endpoint production-performance`.

### Task 3: API, hook y tipos
**Files:** `frontend/features/inventory/analytics/productionPerformance.types.ts`, `api/inventoryApi.ts`, `hooks/useProductProductionPerformance.ts`, test en `hooks/__tests__/`.
- [ ] Tests (RED): params passed, disabled without id, refetch on param change. Implement. tsc + eslint. Commit `feat(inventory): hook de rendimiento de fabricación`.

### Task 4: Tab "Fabricación"
**Files:** `analytics/ProductionPerformanceBlock.tsx`, `entity-view/productionOrderPerformance.entity.ts`, `entity-view/productionMaterialPerformance.entity.ts`, registro (+test), modal (+test).
- [ ] Tests (RED): registro (`manufacturing` visible solo si `manufactures`, tras `production`), bloque (KPIs, tabla por OT, tabla por insumo, etapas ocultas si express, vacío, loading, error, aviso de costo estimado), modal (tab y montaje bajo demanda). Implement. Suites, tsc, eslint. Commit `feat(inventory): tab Fabricación en el análisis de producto`.

### Task 5: ADR-0146 y documentación
**Files:** `docs/10-architecture/adr/0146-rendimiento-de-fabricacion-por-producto.md`, índice, `docs/10-architecture/data-flow.md` (definiciones de costo real y desviación).
- [ ] Redactar, indexar, correr suites, commit `docs(adr): ADR-0146 rendimiento de fabricación`.
