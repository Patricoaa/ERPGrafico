# Tab «Inventario» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el contenido transitorio del tab `inventory` (kardex legado + `OperationsBlock`) por una vista de existencia, comprometido, rotación, flujos, ajustes, bodegas y variantes.

**Architecture:** Endpoint `GET /inventory/products/{id}/stock-analysis/` (`stock_analysis_selector.py`) sobre `Stock`, `StockMove` (clasificación de `_flow_case` + tipo de ubicación) y una reserva agregada equivalente a `get_qty_reserved`; rotación reutilizada de `OperationsSelector`. Cliente: `useProductStockAnalysis`, `composeStock`, `StockBlock`.

**Tech Stack:** Django 5 + DRF, pytest; Next.js 16, TypeScript, TanStack Query, Nivo, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-product-inventory-tab-design.md` (aprobado).

## Global Constraints

- Zero `any`; tokens semánticos; `AnalyticsBlockFrame`/`SkeletonShell`; hooks en `features/inventory/hooks/`.
- Vista ≤ 20 líneas; zero N+1 (conteo constante con más movimientos, bodegas y variantes).
- Hallazgos: `rotation.idle`; `loss_pct ≥ 2`; `available < 0`; bodega con existencia sin movimientos en `idle_days` (solo con más de una bodega).
- Sin tabla de movimientos.
- Comandos: los mismos de los planes anteriores.

## Review Focus

1. Reserva: coincide con `Product.get_qty_reserved()` para un producto con venta confirmada parcialmente entregada, carrito POS abierto y material de OT pendiente.
2. Transferencias entre bodegas: no cuentan como entrada ni salida, pero sí cambian el stock por bodega.
3. Ajuste de revalorización sin cantidad: aparece con su valor y no cambia el stock.
4. Producto con variantes: existencia y reserva por variante suman la del total.
5. Período `all`: la rotación usa todo el histórico (sin el año por defecto de `operations`).

---

### Task 1: Endpoint `stock-analysis` — hoy, reserva y rotación

**Files:** Create `backend/inventory/stock_analysis_params.py` (con `idle_days` ChoiceField 30/90/180, default 90), `backend/inventory/stock_analysis_selector.py`; Modify `backend/inventory/views.py` (acción `stock_analysis`, `url_path="stock-analysis"`); Tests `backend/inventory/tests/test_stock_analysis_selector.py`, `test_stock_analysis_endpoint.py`.

- Produces: `StockAnalysisParams(date_from, date_to, granularity="month", idle_days=90)`, `StockAnalysisSelector.get_analysis(product, params) -> dict` con `today`, `rotation`, `series` (`[]`), `flows` (`{"outflows": [], "inflows": []}`), `adjustments` (`[]`), `loss_pct` (`None`), `warehouses` (`[]`), `variants` (`[]`).
- `today.reserved`: consultas agregadas (una por fuente: líneas de venta confirmadas no entregadas, carritos POS abiertos, materiales de OT pendientes) para la plantilla y sus variantes. Los carritos POS guardan ítems en JSON: se leen en una consulta y se filtran en Python.
- `rotation`: misma salida que `OperationsSelector._rotation` sin `series`, `stock_now` ni `stock_value`; sin `date_from` usa todo el histórico (fecha del primer movimiento).
- [ ] **Step 1: Tests (RED).** `test_today_on_hand_value_reserved_available`; `test_reserved_matches_get_qty_reserved` (venta confirmada parcialmente entregada + carrito POS abierto + material de OT en proceso; también excluye carritos de sesiones cerradas y OT terminadas); `test_reserved_includes_variants`; `test_available_negative`; `test_rotation_matches_operations`; `test_rotation_history_without_date_from`; `test_query_count_constant_with_more_rows`; endpoint: claves, 400 granularidad, 400 `idle_days=45`, 404.
- [ ] **Step 2:** FAIL. **Step 3:** Implementa. **Step 4:** PASS + ruff. **Step 5:** Commit `feat(inventory): endpoint stock-analysis con existencia, comprometido y rotación`.

### Task 2: Serie, flujos y ajustes

**Files:** Modify `stock_analysis_selector.py`; Test `test_stock_analysis_selector.py`.

- Produces: `series: [{period, stock_end, in_qty, out_qty}]` (períodos del rango según granularidad, con los que no tienen movimientos incluidos para que la curva sea continua; usa `_period_start`/`_period_label` y la curva de stock de `operations`); `flows.outflows`/`flows.inflows` con las claves y etiquetas del spec (salida a ubicación `CUSTOMER` → `sale`, `VIRTUAL` no de ajuste → `production`, `VENDOR` → `supplier_return`; entradas simétricas); `adjustments: [{key: "loss"|"gain"|"revaluation", label, qty, value}]` por nombre de ubicación de ajuste (`value` = Σ cantidad × costo unitario del movimiento); `loss_pct`.
- [ ] **Step 1: Tests (RED).** `test_series_continuous_by_month` (meses sin movimientos con el stock del cierre anterior); `test_transfers_do_not_count_as_flow`; `test_outflows_by_destination`; `test_inflows_by_origin`; `test_adjustments_loss_gain_and_value`; `test_loss_pct`; `test_revaluation_without_quantity`; `test_query_count_constant_with_more_moves`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementa (una consulta agregada por clasificación). **Step 4:** PASS. **Step 5:** Commit `feat(inventory): serie, flujos y ajustes en stock-analysis`.

### Task 3: Bodegas y variantes

**Files:** Modify `stock_analysis_selector.py`; Test `test_stock_analysis_selector.py`.

- Produces: `warehouses: [{id, name, on_hand, last_move_date, idle}]` desde `Stock` y el último movimiento por bodega (`source_location__warehouse` o `destination_location__warehouse`), `idle` = existencia > 0 y sin movimientos en `idle_days`; `variants: [{id, name, on_hand, reserved, available}]` solo con `has_variants`.
- [ ] **Step 1: Tests (RED).** `test_warehouses_on_hand_and_last_move`; `test_warehouse_idle`; `test_transfer_updates_both_warehouses_last_move`; `test_variants_sum_to_total`; `test_no_variants_for_simple_product`; `test_query_count_constant_with_more_warehouses_and_variants`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementa. **Step 4:** PASS + `pytest inventory -q`. **Step 5:** Commit `feat(inventory): stock por bodega y por variante en stock-analysis`.

### Task 4: Contrato, API y hook

Create `analytics/stockAnalysis.types.ts`, `hooks/useProductStockAnalysis.ts` + test (copia estructural de `useProductProcurement`, con `idle_days` en los parámetros y `placeholderData` que conserva datos si solo cambia `idle_days`); Modify `api/inventoryApi.ts`, `index.ts`. RED → implementa → PASS + `tsc` → commit `feat(inventory): hook useProductStockAnalysis y contrato del endpoint stock-analysis`.

### Task 5: `composeStock`

Create `analytics/composeStock.ts` + test. Produces `composeStock(data): { findings: StockFinding[]; sections: Array<"chart" | "flows" | "adjustments" | "warehouses" | "variants"> }` con `StockFindingId = "idle" | "loss" | "over_reserved" | "idle_warehouse"` y `LOSS_THRESHOLD = 2`. Tests: cada hallazgo en su umbral y bajo él (`loss_pct` 2 sí / 1,9 no / `null` no; `available` −1 sí / 0 no; bodega inmóvil solo con más de una bodega); secciones (`chart` y `flows` con movimientos, `adjustments` con filas, `warehouses` con más de una bodega, `variants` con filas). RED → PASS → commit `feat(inventory): composición y hallazgos del tab inventario`.

### Task 6: `StockBlock` y reemplazo en `TabContent`

Create `analytics/StockBlock.tsx`, `entity-view/stockAnalysis.entity.ts` (bodegas con columna «Estado» como texto «Inmóvil» o vacío; variantes); Modify `analytics/TabContent.tsx` (caso `inventory` → `<StockBlock productId period />`; agrega `inventory` a los tabs migrados); tests `StockBlock.test.tsx`, `TabContent.test.tsx`, `ProductAnalyticsModal.test.tsx` (el aviso de histórico se prueba ahora en `Resumen`; `Inventario` pasa a la lista de tabs sin aviso).

- [ ] Tests (RED) con hook y gráficos mockeados: cifras de hoy (existencia, valor, comprometido, disponible); rotación; el control «Stock inmóvil desde» cambia `idle_days`; gráfico de stock al cierre y barras de entradas/salidas; flujos y ajustes; bodegas solo con más de una; variantes; hallazgos; sin movimientos muestra «Sin movimientos en el periodo» y mantiene «Hoy»; skeleton; parámetros; sin tabla de movimientos (no existe «Movimientos de stock»). → implementa → `vitest features/inventory`, `tsc`, `lint` → commit `feat(inventory): tab inventario con existencia, rotación, flujos y bodegas`.

### Task 7: Documentación y verificación final

ADR-0150 (tab `inventory` migrado; `OperationsBlock` solo en suscripción), `api-contracts.md` (`GET /api/inventory/products/{id}/stock-analysis/`), spec (desvíos). Verificación completa; commit `docs: tab inventario en ADR-0150 y contratos`; push a la rama del PR #275 y actualización de su descripción.
