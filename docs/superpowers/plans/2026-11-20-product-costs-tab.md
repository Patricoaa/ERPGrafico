# Tab «Costos» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forzar en el backend que un fabricable no sea comprable y reemplazar el contenido transitorio del tab `costs` por un análisis por modo de costo (comprado, fabricable con/sin stock, sin BOM, solo stock).

**Architecture:** Regla en `Product.save()` + migración de datos. Endpoint nuevo `GET /inventory/products/{id}/costs/` (`costs_selector.py`) que decide `mode` y arma series de costo ponderado, BOM teórica (receta actual × costo histórico de componentes), compras y costo real por orden (reutiliza `ProductionPerformanceSelector`). Cliente: `useProductCosts`, `composeCosts`, `CostsBlock`.

**Tech Stack:** Django 5 + DRF, simple_history, pytest; Next.js 16, TypeScript, TanStack Query, Nivo, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-product-costs-tab-design.md` (aprobado). ADR: `docs/10-architecture/adr/0150-analisis-de-producto-por-bloque-y-periodo.md`.

## Global Constraints

- Zero `any`; tokens semánticos; `AnalyticsBlockFrame`/`SkeletonShell`; hooks en `features/inventory/hooks/`.
- Vista ≤ 20 líneas; zero N+1 (test de conteo constante, incluido el historial de componentes en una consulta).
- Hallazgos: `replacement_gap_pct ≥ 5`; `cost_change_pct ≥ 10`; desvío real vs BOM ≥ 10 % con ≥ 3 órdenes; un componente explica ≥ 50 % del alza de BOM; `mode == manufactured_no_bom`.
- Migración de datos con reverso `noop` documentado.
- Comandos: backend `cd backend && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <path> -q`; frontend `source ~/.nvm/nvm.sh && nvm use 24` y `cd frontend && npm run test -- <path>`, `npx tsc --noEmit`, `npm run lint`.

## Review Focus

1. Componente sin historial anterior al período: se usa el primer valor conocido, no 0.
2. BOM con rendimiento (`yield_quantity` ≠ 1), líneas en otra unidad y líneas tercerizadas: el costo de BOM coincide con `Product.get_bom_cost()` para hoy.
3. Fabricable con variantes: el modo se decide por la plantilla y las órdenes incluyen las variantes, como en `production-performance`.
4. Producto sin ningún historial ni compras: `series` vacía, `cost_change_pct` y `replacement_gap_pct` nulos, sin división por cero.
5. Cambiar el tipo de un producto a fabricable desde la API con `can_be_purchased=true`: queda en falso.

---

### Task 1: Regla «fabricable no se compra» y migración de datos

**Files:**
- Modify: `backend/inventory/models.py` (`Product.save`, junto a la regla de `track_inventory` ~línea 866)
- Create: `backend/inventory/migrations/<siguiente>_manufacturable_not_purchasable.py`
- Test: `backend/inventory/tests/test_manufacturable_not_purchasable.py`

- [ ] **Step 1: Tests (RED).** `test_new_manufacturable_is_not_purchasable` (crear con `can_be_purchased=True` → `False`); `test_switching_to_manufacturable_clears_purchasable` (almacenable comprable → cambiar tipo → `False`); `test_storable_keeps_purchasable`; `test_migration_clears_existing_manufacturables` (fila fabricable con `can_be_purchased=True` puesta con `.update()`, llamar la función forward de la migración con `django.apps.apps` → `False`; un almacenable no cambia); `test_capabilities_of_manufacturable_do_not_buy`.
- [ ] **Step 2:** Ejecuta. Expected: FAIL.
- [ ] **Step 3:** En `Product.save`, si `product_type == MANUFACTURABLE`, `self.can_be_purchased = False`. Migración `RunPython(forward, migrations.RunPython.noop)` con `Product.objects.filter(product_type="MANUFACTURABLE", can_be_purchased=True).update(can_be_purchased=False)` y un comentario que explica el reverso. Revisa `makemigrations --check --dry-run` sin cambios pendientes.
- [ ] **Step 4:** Ejecuta el test y `pytest inventory production sales purchasing -q`. Expected: PASS (si un test existente crea fabricables comprables a propósito, ajústalo y registra la regla).
- [ ] **Step 5:** Commit `fix(inventory): un fabricable no se puede comprar (regla en backend y migración)`.

### Task 2: Endpoint `costs` — modo, hoy, KPIs, ponderado y compras

**Files:**
- Create: `backend/inventory/costs_params.py`, `backend/inventory/costs_selector.py`
- Modify: `backend/inventory/views.py` (acción `costs`)
- Test: `backend/inventory/tests/test_costs_selector.py`, `backend/inventory/tests/test_costs_endpoint.py`

**Interfaces:**
- Produces: `CostsParams(date_from, date_to, granularity="month")`, `CostsParamsSerializer` (como `PricingParamsSerializer`), `CostsSelector.get_costs(product, params) -> dict` con `mode`, `today`, `kpis`, `series`, `purchases`, `bom` (`None`), `work_orders` (`[]`).
- `mode`: `manufactured_*` si `product_type == MANUFACTURABLE` (`_stock` si `track_inventory` y BOM activa, `_on_demand` si BOM activa sin stock, `_no_bom` sin BOM activa); si no, `purchased` si `can_be_purchased`; si no, `stock_only`.
- `series` por período: `{period, weighted_cost, bom_cost, purchase_avg, real_avg}`; en esta tarea `bom_cost` y `real_avg` son `None`. `weighted_cost` = último `cost_price` del historial con `history_date` ≤ cierre del período (primer valor conocido si no hay anterior). Períodos = los del rango según granularidad que tengan algún dato (cambio de costo o compra), más el período actual.

- [ ] **Step 1: Tests (RED).** Un test por modo (`test_mode_purchased`, `..._manufactured_stock`, `..._on_demand`, `..._no_bom`, `..._stock_only`); `test_today_purchased` (ponderado, última compra con proveedor, `stock_value = stock × costo`); `test_weighted_series_uses_last_value_per_period` (tres cambios de `cost_price` con fechas fijadas en el historial, como `_price_history` de `test_pricing_selector.py`); `test_purchases_avg_min_max` y `purchase_avg` por período ponderado por cantidad; `test_cost_change_pct` (inicio vs cierre; `None` sin `date_from`); `test_replacement_gap_purchased` (última compra vs ponderado); `test_empty_product` (sin historial útil ni compras: KPIs nulos); `test_query_count_constant_with_more_rows`. Endpoint: claves, 400 granularidad inválida, 400 rango invertido, 404.
- [ ] **Step 2:** Ejecuta. Expected: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementa; recepciones de `PurchaseReceiptLine` con `receipt__status="CONFIRMED"` y `receipt__receipt_date` en el rango; proveedor `receipt__purchase_order__supplier__name`; stock con `qty_on_hand`.
- [ ] **Step 4:** Ejecuta ambos archivos y `ruff check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(inventory): endpoint costs con modo, costo ponderado y compras`.

### Task 3: BOM — composición, impulsores y serie teórica

**Files:** Modify `backend/inventory/costs_selector.py`; Test `backend/inventory/tests/test_costs_selector.py`

**Interfaces:**
- Produces: `bom = {lines: [{component_id, name, qty_per_unit, unit_cost, cost, share_pct, change_pct, is_outsourced}], drivers: [{component_id, name, delta}]}` (solo con BOM activa; `drivers` ordenados por `delta` desc, solo positivos); `today.bom_cost`; `series[].bom_cost`; `kpis.replacement_gap_pct` en `manufactured_stock` (BOM hoy vs ponderado).
- Cálculo: cantidad por unidad = `line.quantity` convertida a la unidad del componente (como `get_bom_cost`) dividida por `yield_quantity`; costo unitario = `unit_price` si `is_outsourced`, si no `cost_price` (hoy) o el histórico al cierre de cada período; historial de todos los componentes en **una** consulta al modelo histórico.

- [ ] **Step 1: Tests (RED).** `test_bom_today_matches_get_bom_cost` (incluye una línea en otra unidad y una tercerizada); `test_bom_lines_share_and_change` ; `test_bom_series_uses_component_history` (componente con dos costos en fechas distintas → `bom_cost` sube en el período del cambio); `test_component_without_earlier_history_uses_first_value`; `test_drivers_rank_component_increase`; `test_replacement_gap_manufactured_stock`; `test_bom_query_count_constant_with_more_components`.
- [ ] **Step 2:** Ejecuta. Expected: FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** Ejecuta `test_costs_selector.py`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(inventory): composición y evolución teórica de la BOM en costs`.

### Task 4: Costo real por orden

**Files:** Modify `backend/inventory/costs_selector.py`; Test `backend/inventory/tests/test_costs_selector.py`

**Interfaces:**
- Consumes: `ProductionPerformanceSelector.get_performance(product, date_from, date_to)` (`orders` con `qty`, `planned_cost`, `real_cost`, `date`).
- Produces: `work_orders: [{id, number, date, units, unit_real_cost, unit_bom_cost, deviation_pct}]` (solo modos `manufactured_*`, órdenes con `real_cost` y `qty > 0`); `series[].real_avg` (promedio ponderado por unidades por período). Sin `date_from`, pasa `date(1900, 1, 1)` para no heredar el año por defecto del otro selector.

- [ ] **Step 1: Tests (RED).** `test_work_orders_from_finished_orders` (orden terminada con consumo → costo real unitario y desvío contra el planificado); `test_real_avg_per_period`; `test_no_work_orders_for_purchased`; `test_history_period_includes_old_orders` (orden de hace dos años con `date_from=None`).
- [ ] **Step 2:** Ejecuta. Expected: FAIL. Usa los fixtures/helpers de `test_production_performance_selector.py` si existen.
- [ ] **Step 3:** Implementa reutilizando el selector.
- [ ] **Step 4:** Ejecuta `pytest inventory -q`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(inventory): costo real por orden en costs`.

### Task 5: Contrato, API y hook

**Files:** Create `frontend/features/inventory/analytics/costs.types.ts`, `frontend/features/inventory/hooks/useProductCosts.ts`, test `hooks/__tests__/useProductCosts.test.tsx`; Modify `api/inventoryApi.ts`, `index.ts`.

- Produces: `CostsMode`, `CostsParams`, `ProductCosts` (espejo del payload); `inventoryApi.getProductCosts(id, params)`; `useProductCosts(productId, params)` con el mismo `placeholderData` que `useProductSales`.
- [ ] **Step 1:** Test (RED) copia estructural de `useProductSales.test.tsx`. **Step 2:** FAIL. **Step 3:** Implementa. **Step 4:** PASS + `tsc`. **Step 5:** Commit `feat(inventory): hook useProductCosts y contrato del endpoint costs`.

### Task 6: `composeCosts`

**Files:** Create `frontend/features/inventory/analytics/composeCosts.ts`, test `analytics/__tests__/composeCosts.test.ts`.

- Produces: `composeCosts(data: ProductCosts): { hero: { label: string; value: number | null }; secondary: Array<"bom_today" | "last_purchase" | "stock_value">; findings: CostsFinding[]; sections: Array<"chart" | "bom" | "work_orders" | "purchases"> }` con `CostsFindingId = "replacement_above" | "cost_rising" | "mfg_deviation" | "dominant_component" | "no_bom"` y umbrales exportados.
- Protagonista por modo: `purchased`/`stock_only`/`manufactured_stock` → «Costo ponderado»; `manufactured_on_demand` → «Costo de BOM»; `manufactured_no_bom` → «Costo real promedio».
- [ ] **Step 1:** Tests (RED): protagonista por modo; cada hallazgo en su umbral y bajo él; `mfg_deviation` exige ≥ 3 órdenes; `dominant_component` con aporte ≥ 50 % del alza total; secciones según datos. **Step 2:** FAIL. **Step 3:** Implementa. **Step 4:** PASS. **Step 5:** Commit `feat(inventory): composición y hallazgos del tab costos`.

### Task 7: `CostsBlock` y reemplazo en `TabContent`

**Files:** Create `frontend/features/inventory/analytics/CostsBlock.tsx`, `frontend/features/inventory/entity-view/costs.entity.ts` (BOM y órdenes); Modify `analytics/TabContent.tsx` (caso `costs` → `<CostsBlock productId period />`, sin legado ni `SourcingBlock`; `tabHasLegacyContent("costs")` falso); tests `CostsBlock.test.tsx`, `TabContent.test.tsx`, `ProductAnalyticsModal.test.tsx` (el test del aviso de histórico pasa a `Abastecimiento`).

- [ ] **Step 1:** Tests (RED) con hook y `LineChart` mockeados: protagonista por modo; series del gráfico por modo (comprado: ponderado y compras; fabricable con stock: ponderado, BOM y real; bajo pedido: BOM y real); tabla de BOM con la columna de variación y el aviso «la evolución usa la receta actual»; tabla de órdenes; hallazgos; sin datos en el período queda solo el protagonista; skeleton; parámetros del período; `costs` ya no monta `SourcingBlock`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementa. **Step 4:** `npm run test -- features/inventory`, `tsc`, `lint`. Expected: verde. **Step 5:** Commit `feat(inventory): tab costos por modo de costo`.

### Task 8: Documentación y verificación final

- Modify ADR-0150 (tab `costs` migrado; regla «fabricable no se compra» y su efecto en Abastecimiento y fabricar vs comprar), `api-contracts.md` (`GET /api/inventory/products/{id}/costs/`), spec (desvíos).
- [ ] Verificación completa (pytest inventory + production, ruff, tsc, lint, vitest inventory); revisión visual si hay servidor; commit `docs: tab costos en ADR-0150 y contratos`.
