# Precio y margen por producto (Fase 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Margen real neto de descuentos y analítica de reglas de precio con gráficos segmentables, en un tab nuevo del análisis de producto.

**Architecture:** Un selector agrega `SaleDeliveryLine` en la BD (segmentos por regla, canal, cliente, variante, unidad), un endpoint `sales-impact` lo expone y un bloque de frontend con controles lo grafica. `insights` pasa a ingreso neto de descuentos con la misma expresión.

**Tech Stack:** Django 5/DRF, pytest, Next.js 16, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-product-sales-impact-design.md`

## Global Constraints

- Playbooks `add-endpoint.md`, `add-selector.md`, `add-feature.md`, `component-entity-view.md` (tabla con `defineEntity` + `Collection`); leer antes de las Tasks 3 y 5.
- Tests backend: `cd backend && env DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q -p no:cacheprovider`. Frontend: `source ~/.nvm/nvm.sh && nvm use 24 && cd frontend && npm run test -- <ruta>`.
- Base: rama partida de `feat/product-analytics-capabilities` (registro de tabs, `RailNav`, Fase 1 con campos de procedencia).
- Fórmulas del spec, copiadas exactamente. Cero N+1. Lógica en el selector, la vista ≤ 20 líneas.

## Review Focus

- Línea con descuento: `net_revenue` descuenta el descuento; sin `unit_price_gross` no descuenta (igual que `calculate_subtotal`).
- Despacho parcial de una línea con descuento: el descuento se prorratea por unidad (ratio), no se duplica ni se pierde.
- Línea con `discount_amount` mayor que el bruto: ratio acotado a 1, ingreso nunca negativo.
- Ventas anteriores a la Fase 1 (sin procedencia): segmento "Sin registro", `foregone_revenue` 0, y la cobertura lo refleja.
- Producto con variantes: segmentos por variante suman el total.
- Rango sin ventas: series y tabla vacías, totales en cero, sin división por cero.
- Parámetros inválidos (`metric`, `group_by`, fechas invertidas): 400, no 500.
- Los KPIs del tab Ventas y los totales del tab nuevo coinciden para el mismo producto y periodo.

---

### Task 1: Selector de impacto de ventas

**Files:**
- Create: `backend/inventory/sales_impact_selector.py`, `backend/inventory/tests/test_sales_impact_selector.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class SalesImpactParams: metric: str = "net_revenue"; group_by: str = "rule"; granularity: str = "month"; date_from: date | None = None; date_to: date | None = None; channel: str | None = None; customer_id: int | None = None; variant_id: int | None = None; uom_id: int | None = None; rule_id: int | None = None`
  - `net_revenue_expression() -> Expression` (reutilizable por `insights`; ver Task 2), sobre el queryset de `SaleDeliveryLine`.
  - `SalesImpactSelector.get_sales_impact(product: Product, params: SalesImpactParams) -> dict` con la forma de respuesta del spec.

- [ ] **Step 1: Write failing tests** (fixtures: producto, cliente, pedido, línea de venta con `discount_amount`/procedencia, despacho confirmado con línea; crear `SaleDeliveryLine` con `unit_price`, `unit_cost`, `quantity`): `test_net_revenue_applies_line_discount`, `test_no_unit_price_gross_means_no_discount`, `test_discount_ratio_is_clamped_to_one`, `test_partial_delivery_prorates_discount`, `test_margin_uses_frozen_unit_cost`, `test_group_by_rule_segments` (regla, MANUAL, precio de lista, Sin registro), `test_foregone_revenue_only_with_list_price`, `test_group_by_channel_customer_variant_uom`, `test_variants_included_and_sum_to_total`, `test_granularity_month_and_day`, `test_filters_by_rule_and_channel`, `test_empty_range_returns_zeroed_totals`, `test_coverage_reports_share_with_provenance`, `test_rule_windows_include_product_category_and_parent_rules`, `test_returns_reported_separately`, `test_query_count_constant_with_more_rows`.
- [ ] **Step 2: Run** el archivo; Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** con anotaciones/`Case`/`Sum` sobre `SaleDeliveryLine.objects.filter(product_id__in=…, delivery__status="CONFIRMED", delivery__delivery_date__range=…)`; periodos con `TruncMonth/TruncDate/TruncYear`; etiquetas de segmento resueltas con consultas acotadas por IDs (sin consultas por fila); `coverage.since` = fecha de la primera línea con procedencia.
- [ ] **Step 4: Run** el archivo; Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): selector de impacto de ventas por producto`.

### Task 2: KPIs de `insights` netos de descuentos

**Files:**
- Modify: `backend/inventory/selectors.py` (bloque `delivery_stats`, `top_customers` y `sales_history` de `get_insights`)
- Test: `backend/inventory/tests/test_product_insights_net_revenue.py`

**Interfaces:**
- Consumes: `net_revenue_expression()` (Task 1).

- [ ] **Step 1: Write failing tests:** `test_sales_analysis_revenue_is_net_of_discount`, `test_top_customers_revenue_is_net_of_discount`, `test_sales_history_revenue_is_net_of_discount`, `test_insights_revenue_matches_sales_impact_totals` (mismo producto y periodo: `insights.sales_analysis.total_revenue` − devoluciones = `sales_impact.totals.net_revenue` − `returns.revenue`).
- [ ] **Step 2: Run**; Expected: FAIL.
- [ ] **Step 3: Implement:** reemplazar `Sum(F("quantity") * F("unit_price"))` de ingresos por `Sum(net_revenue_expression())` en las tres consultas; sin cambiar claves del payload.
- [ ] **Step 4: Run** el archivo y `pytest inventory/tests -q`; Expected: PASS.
- [ ] **Step 5: Commit** `fix(inventory): ingresos de insights netos de descuentos`.

### Task 3: Endpoint `sales-impact`

**Files:**
- Modify: `backend/inventory/views.py` (acción en `ProductViewSet`), `backend/inventory/serializers.py` (serializer de parámetros; **ojo:** el archivo tiene cambios sin commitear ajenos: agregar solo la clase nueva, o ponerla en un módulo nuevo `inventory/sales_impact_params.py` y evitar tocar `serializers.py`)
- Test: `backend/inventory/tests/test_sales_impact_endpoint.py`

**Interfaces:**
- Consumes: `SalesImpactSelector.get_sales_impact`, `SalesImpactParams`.
- Produces: `GET /api/inventory/products/{id}/sales-impact/` con los parámetros y la respuesta del spec; `SalesImpactParamsSerializer.to_params() -> SalesImpactParams`.

- [ ] **Step 1: Write failing tests:** `test_returns_series_table_totals_coverage`, `test_defaults_applied`, `test_invalid_metric_returns_400`, `test_invalid_group_by_returns_400`, `test_inverted_dates_return_400`, `test_requires_authentication`, `test_unknown_product_returns_404`.
- [ ] **Step 2: Run**; Expected: FAIL (404 de la ruta).
- [ ] **Step 3: Implement** la acción `sales_impact` (`detail=True`, `url_path="sales-impact"`, ≤ 20 líneas) que valida con el serializer y delega en el selector.
- [ ] **Step 4: Run** el archivo y `pytest inventory sales -q`; Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): endpoint sales-impact del producto`.

### Task 4: API y hook de frontend

**Files:**
- Modify: `frontend/features/inventory/api/inventoryApi.ts`, `frontend/features/inventory/hooks/useProducts.ts` (o archivo de hooks nuevo `useProductSalesImpact.ts` exportado por el barrel de hooks existente)
- Create: tipos Zod/TS en `frontend/features/inventory/analytics/salesImpact.types.ts`
- Test: `frontend/features/inventory/hooks/__tests__/useProductSalesImpact.test.tsx`

**Interfaces:**
- Produces:
  - `interface SalesImpactParams { metric; group_by; granularity; date_from?; date_to?; channel?; customer?; variant?; uom?; rule? }` y `interface SalesImpact` con la forma de respuesta del spec (`series`, `segments`, `table`, `totals`, `returns`, `coverage`, `rule_windows`).
  - `inventoryApi.getProductSalesImpact(id: number, params: SalesImpactParams): Promise<SalesImpact>`
  - `useProductSalesImpact(productId: number | null | undefined, params: SalesImpactParams): { data: SalesImpact | null; isLoading: boolean; isError: boolean }` (clave de query con los parámetros; `enabled` solo con id).

- [ ] **Step 1: Write failing tests:** `passes params as query string`, `is disabled without product id`, `refetches when params change`.
- [ ] **Step 2: Run**; Expected: FAIL.
- [ ] **Step 3: Implement** API y hook (validar la respuesta con Zod si el repo ya lo hace para respuestas de analítica; si no, tipado explícito).
- [ ] **Step 4: Run** tests + `npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): hook de impacto de ventas`.

### Task 5: Tab "Precio y margen"

**Files:**
- Create: `frontend/features/inventory/analytics/SalesImpactBlock.tsx`, `frontend/features/inventory/entity-view/salesImpact.entity.ts` (tabla), tests en `frontend/features/inventory/analytics/__tests__/SalesImpactBlock.test.tsx`
- Modify: `frontend/features/inventory/analytics/productAnalyticsRegistry.ts` (+ test), `frontend/features/inventory/components/ProductAnalyticsModal.tsx` (tab `pricing`)

**Interfaces:**
- Consumes: `useProductSalesImpact`, `SalesImpact`, `AnalyticsChart` (`bar-chart`, `keys` = segmentos), `Collection`.
- Produces: `ProductAnalyticsTabId` gana `"pricing"` (visible si `sells`, orden: después de `sales`), `SalesImpactBlock({ productId: number })`.

- [ ] **Step 1: Write failing tests:** registro: `pricing visible only when sells` y orden; bloque: `renders chart segments from series`, `changing group-by refetches with the new group_by`, `changing metric refetches`, `shows coverage warning when below 100%`, `shows empty state when no sales`, `shows returns line`, `shows rule windows chips`.
- [ ] **Step 2: Run**; Expected: FAIL.
- [ ] **Step 3: Implement** el bloque con controles (`Select` del design system), gráfico, aviso de cobertura (texto: "El N % del ingreso del periodo tiene regla registrada (desde DD-MM-AAAA)"), línea de devoluciones, tabla con `Collection` y chips de vigencia; rotular "asociación, no causalidad". Cablear el tab en el modal; `loading`/`empty`/`error` manejados.
- [ ] **Step 4: Run** `npm run test -- features/inventory`, `npx tsc --noEmit`, `npx eslint` de los archivos tocados; Expected: PASS y sin errores nuevos.
- [ ] **Step 5: Commit** `feat(inventory): tab Precio y margen en el análisis de producto`.

### Task 6: ADR-0145 y documentación

**Files:**
- Create: `docs/10-architecture/adr/0145-precio-y-margen-por-producto.md`
- Modify: `docs/10-architecture/adr/README.md`, `docs/10-architecture/data-flow.md` (fórmula de ingreso neto)

- [ ] **Step 1:** Redactar ADR (contexto: margen ignoraba descuentos y no había analítica de reglas; decisión: endpoint de agregación + KPIs netos + cobertura explícita; alternativas descartadas: agregar en el cliente, inferir reglas históricas).
- [ ] **Step 2:** Indexarlo en el README y documentar la fórmula en `data-flow.md`.
- [ ] **Step 3: Run** `pytest backend/inventory backend/sales -q` y `npm run test -- features/inventory`; Expected: PASS.
- [ ] **Step 4: Commit** `docs(adr): ADR-0145 precio y margen por producto`.
