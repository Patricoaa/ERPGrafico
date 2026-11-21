# Retiro del legado del análisis de producto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Borrar el código del análisis de producto que quedó sin consumidores tras migrar los 8 tabs (ADR-0150), conservando los selectores que usan los bloques nuevos.

**Decisión del usuario:** borrar ya, sin período de deprecación (excepción al playbook `deprecate-feature`): no existe producción y los únicos consumidores eran componentes del propio frontend que ya no se montan. La excepción queda registrada en ADR-0150.

## Global Constraints

- Se conservan: `OperationsSelector._rotation`, `coverage`, `_coverage_days`, `_StockCurve`, `_FREQUENCY_FACTOR`; `ProductionPerformanceSelector.get_performance`; `SourcingSelector._used_in`; `ProductSelector._stock_flow`/`_flow_case`/`get_capabilities`; endpoint `capabilities`; `SalesImpactBlock` (desglose de Precio y margen) y su endpoint `sales-impact`. El `insights` de `contacts` no se toca.
- Ninguna referencia muerta (`grep` vacío) al final.

### Task 1: Backend

- Borrar las acciones `insights`, `operations`, `production-performance`, `sourcing` de `inventory/views.py`; `operations_params.py`, `production_performance_params.py`, `sourcing_params.py`; `ProductSelector.get_insights`; `OperationsSelector.get_operations`/`_subscriptions` (y `_PAYMENTS_SHOWN`); `SourcingSelector.get_sourcing`/`_make_vs_buy`.
- Tests: borrar `test_operations_endpoint.py`, `test_production_performance_endpoint.py`, `test_sourcing_endpoint.py`, los tests de `make_vs_buy` y de suscripciones de `operations`, los de `get_insights` (los de `sales-impact` en ese archivo se conservan); reescribir sobre las funciones que quedan: `test_product_stock_flow.py` (usa `_stock_flow`), `test_operations_selector.py` (usa `_rotation`), `test_sourcing_selector.py` (usa `_used_in`), y las comparaciones de `test_stock_analysis_selector.py`, `test_procurement_selector.py`, `test_production_analysis_selector.py`, `test_subscription_analysis_selector.py`, `test_product_capabilities.py`.
- Verificación: `pytest inventory production purchasing sales -q`, `ruff check`. Commit `refactor(inventory): retira los endpoints legado del análisis de producto`.

### Task 2: Frontend

- Borrar `LegacyInsightsPanel`, `legacyTabs`, `OperationsBlock`, `ProductionPerformanceBlock`, `SourcingBlock`, sus tipos (`operations.types`, `productionPerformance.types`, `sourcing.types` → mover `SubscriptionFrequency`/`SubscriptionStatus` a `subscriptionAnalysis.types` y `UsedIn`/`SourcingParent` a `productionAnalysis.types`), sus hooks (`useProductOperations`, `useProductProductionPerformance`, `useProductSourcing`, `useProductInsights`) y métodos de API, sus entidades y las del panel legado (historial de precio y costo, mejores clientes y proveedores, uso en producción, suscripciones y pagos de operations, desempeño de producción, padres de sourcing), `overviewKpiIds`, y sus tests y stories. Actualizar el barrel.
- Verificación: `vitest features/inventory`, `tsc`, `lint`, `grep` sin referencias. Commit `refactor(inventory): retira el panel y los bloques legado del análisis de producto`.

### Task 3: Documentación

- ADR-0150: excepción al playbook y lista de lo retirado. ADR-0145 a 0148: nota de que sus endpoints o bloques fueron reemplazados (ADR-0150). `api-contracts.md`: quitar `insights` (producto), `operations`, `production-performance`, `sourcing`. Contratos de componentes que los mencionen.
- Commit `docs: retiro del legado del análisis de producto`; push al PR #275 y actualización de su descripción.
