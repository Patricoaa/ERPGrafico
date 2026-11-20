# Tab «Producción» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el contenido transitorio del tab `production` por un análisis por rol (fabricado / insumo) sin tiempos ni costos.

**Architecture:** Endpoint `GET /inventory/products/{id}/production-analysis/` (`production_analysis_selector.py`): rol fabricado desde `ProductionPerformanceSelector` (órdenes, materiales), rol insumo desde `ProductionConsumption` y `SourcingSelector._used_in`. Cliente: `useProductProductionAnalysis`, `composeProduction`, `ProductionBlock`.

**Tech Stack:** Django 5 + DRF, pytest; Next.js 16, TypeScript, TanStack Query, Nivo, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-product-production-tab-design.md` (aprobado).

## Global Constraints

- Zero `any`; tokens semánticos; `AnalyticsBlockFrame`/`SkeletonShell`; hooks en `features/inventory/hooks/`.
- Vista ≤ 20 líneas; zero N+1 (pasar a `ProductionPerformanceSelector` el producto con la BOM precargada, como en `costs`).
- Hallazgos: rectificación ≥ 10 % con ≥ 3 órdenes; insumo con desvío ≥ 10 %; margen negativo tras la subida.
- Sin tiempos, etapas, plazos ni costos.

## Review Focus

1. Producto fabricado e insumo a la vez: ambas secciones con sus datos.
2. Período `all`: `ProductionPerformanceSelector` no debe aplicar su año por defecto (pasar `date(1900, 1, 1)`).
3. Orden terminada sin consumo registrado: cuenta en órdenes y unidades; no aparece en materiales consumidos.
4. Consumo de una variante del insumo: suma al insumo.
5. `increase_pct` distinto: cambia el margen después de la subida, no el consumo.

---

### Task 1: Endpoint — rol fabricado

**Files:** Modify `backend/inventory/production_performance_selector.py` (agrega `rectified` a cada orden); Create `backend/inventory/production_analysis_params.py` (`increase_pct` ChoiceField 5/10/20, default 10), `backend/inventory/production_analysis_selector.py`; Modify `backend/inventory/views.py` (acción `production_analysis`, `url_path="production-analysis"`); Tests `backend/inventory/tests/test_production_analysis_selector.py`, `test_production_analysis_endpoint.py`.

- Produces `ProductionAnalysisParams(date_from, date_to, granularity="month", increase_pct=10)`, `ProductionAnalysisSelector.get_analysis(product, params) -> {"made": dict | None, "input": None}`.
- [ ] Tests (RED): `test_made_only_for_manufactured`; `test_made_kpis_orders_units_rectification`; `test_made_previous_and_aligned_points`; `test_made_materials_quantity_deviation`; `test_made_orders_list_with_rectified`; `test_made_history_without_date_from` (orden de hace dos años); `test_order_without_consumption_counts`; `test_made_query_count_constant`; endpoint: claves, 400 granularidad, 400 `increase_pct=15`, 404. Los tests de `production_performance` siguen pasando.
- [ ] FAIL → implementa → PASS + ruff → commit `feat(inventory): endpoint production-analysis con el rol fabricado`.

### Task 2: Rol insumo

**Files:** Modify `production_analysis_selector.py`; Test `test_production_analysis_selector.py`.

- Produces `input = {kpis: {consumed, orders, previous}, series: {points, previous_points}, by_product: [...], used_in: <igual que sourcing.used_in>}` o `None` sin `used_in_production`.
- [ ] Tests (RED): `test_input_only_when_used_in_production`; `test_input_consumption_and_orders`; `test_input_previous_and_aligned_points`; `test_input_by_product_share`; `test_input_includes_variant_consumption`; `test_used_in_matches_sourcing`; `test_increase_pct_changes_margin_after`; `test_input_query_count_constant`.
- [ ] FAIL → implementa → PASS + `pytest inventory -q` → commit `feat(inventory): rol insumo en production-analysis`.

### Task 3: Contrato, API y hook

Create `analytics/productionAnalysis.types.ts`, `hooks/useProductProductionAnalysis.ts` + test (copia de `useProductStockAnalysis`, conservando datos si solo cambia `increase_pct`); Modify `api/inventoryApi.ts`, `index.ts`. RED → PASS + `tsc` → commit `feat(inventory): hook useProductProductionAnalysis y contrato del endpoint production-analysis`.

### Task 4: `composeProduction`

Create `analytics/composeProduction.ts` + test. Produces `composeProduction(data): { findings: ProductionFinding[]; sections: Array<"made_chart" | "materials" | "orders" | "input_chart" | "by_product" | "used_in"> }` con `ProductionFindingId = "rectification" | "overconsumption" | "negative_margin"` y umbrales exportados (`RECTIFICATION_THRESHOLD = 10`, `RECTIFICATION_MIN_ORDERS = 3`, `OVERCONSUMPTION_THRESHOLD = 10`). Tests por umbral y por sección. RED → PASS → commit `feat(inventory): composición y hallazgos del tab producción`.

### Task 5: `ProductionBlock` y reemplazo en `TabContent`

Create `analytics/ProductionBlock.tsx`, `entity-view/productionAnalysis.entity.ts` (materiales, órdenes con «Rectificada» como texto, consumo por producto, productos que lo usan); Modify `analytics/TabContent.tsx` (caso `production` → `<ProductionBlock productId period />`; agrega `production` a los tabs migrados); tests `ProductionBlock.test.tsx`, `TabContent.test.tsx`, `ProductAnalyticsModal.test.tsx` (los tests de producción del modal ya no esperan los bloques anteriores).

- [ ] Tests (RED) con hook y gráfico mockeados: rol fabricado (cifras con variación, rectificación, gráfico con período anterior, materiales, órdenes); rol insumo (consumo, gráfico, por producto, productos que lo usan con el margen después); ambos roles; el control de subida solo aparece con rol insumo y cambia `increase_pct`; hallazgos; sin datos; skeleton; parámetros; sin textos de tiempo ni costo («Lead time», «Costo real»). → implementa → `vitest features/inventory`, `tsc`, `lint` → commit `feat(inventory): tab producción por rol fabricado e insumo`.

### Task 6: Documentación y verificación final

ADR-0150 (tab `production` migrado; sin tiempos), `api-contracts.md`, spec (desvíos). Verificación completa; commit `docs: tab producción en ADR-0150 y contratos`; push al PR #275 y actualización de su descripción.
