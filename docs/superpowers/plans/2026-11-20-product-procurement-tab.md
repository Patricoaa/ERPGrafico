# Tab «Abastecimiento» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el contenido transitorio del tab `procurement` (legado Compras + Proveedores) por una vista de hechos registrados: cobertura, compras con período anterior, proveedores y pendiente de recibir.

**Architecture:** Endpoint `GET /inventory/products/{id}/procurement/` (`procurement_selector.py`) sobre recepciones confirmadas (reutiliza `_receipts` de `costs_selector`), cobertura compartida con `operations`, pendientes desde `PurchaseLine`. Cliente: `useProductProcurement`, `composeProcurement`, `ProcurementBlock`, igual que `sales`.

**Tech Stack:** Django 5 + DRF, pytest; Next.js 16, TypeScript, TanStack Query, Nivo, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-product-procurement-tab-design.md` (aprobado).

## Global Constraints

- Zero `any`; tokens semánticos; `AnalyticsBlockFrame`/`SkeletonShell`; hooks en `features/inventory/hooks/`.
- Vista ≤ 20 líneas; zero N+1 (test de conteo constante).
- Hallazgos: `coverage_days ≤ 15`; preferido ausente con compras en el rango; un proveedor ≥ 80 % del gasto con ≥ 2 proveedores; `returned_units > 0`.
- Sin tiempo de entrega, puntualidad ni punto de pedido.
- Comandos: los mismos de los planes `pricing`, `sales` y `costs`.

## Review Focus

1. Producto sin compras en el rango con compras antiguas: `days_since_last_purchase` sobre todo el histórico.
2. Recepción en otra unidad (caja): unidades y precio promedio en unidad base.
3. Orden confirmada parcialmente recibida de una variante: aparece en `pending` con su pendiente.
4. Producto sin stock: `coverage` es `null` y el bloque no muestra la sección.
5. Período `all`: sin `previous` ni `previous_points`.

---

### Task 1: Cobertura compartida y endpoint `procurement` (cifras, serie, cobertura)

**Files:** Modify `backend/inventory/operations_selector.py` (extrae `coverage(product_ids: list[int], date_to: date) -> dict` con `stock_now`, `daily_out`, `coverage_days`; `_rotation` la usa), `backend/inventory/costs_selector.py` (`_receipts` agrega `order_id`, `supplier_id`); Create `backend/inventory/procurement_params.py`, `backend/inventory/procurement_selector.py`; Modify `backend/inventory/views.py` (acción `procurement`); Tests `backend/inventory/tests/test_procurement_selector.py`, `test_procurement_endpoint.py`.

- Produces: `ProcurementParams(date_from, date_to, granularity="month")`, `ProcurementParamsSerializer`, `ProcurementSelector.get_procurement(product, params) -> dict` con `coverage`, `kpis`, `series`, `suppliers` (`[]`), `preferred_supplier`, `pending` (`[]`).
- [ ] **Step 1: Tests (RED).** `test_coverage_matches_operations` (mismo `coverage_days` que `OperationsSelector` para el mismo producto); `test_coverage_none_without_stock_tracking`; `test_kpis_units_spend_orders_suppliers` (dos órdenes, dos proveedores, una con dos recepciones); `test_units_in_base_uom` (recepción en caja); `test_previous_and_previous_points_aligned`; `test_previous_none_without_date_from`; `test_last_purchase_uses_whole_history`; `test_returned_units_in_range`; `test_includes_variant_receipts`; `test_query_count_constant_with_more_rows`; endpoint: claves, 400, 400, 404. Tests existentes de `operations` siguen pasando.
- [ ] **Step 2:** FAIL. **Step 3:** Implementa. **Step 4:** `pytest inventory/tests/test_procurement_* inventory/tests/test_operations_* inventory/tests/test_costs_* -q` PASS, ruff limpio. **Step 5:** Commit `feat(inventory): endpoint procurement con cobertura, compras y período anterior`.

### Task 2: Proveedores y pendiente de recibir

**Files:** Modify `backend/inventory/procurement_selector.py`; Test `test_procurement_selector.py`.

- Produces: `suppliers: [{id, name, units, spend, share_pct, avg_unit_cost, receipts, last_date, returned_units, preferred}]` y `preferred_supplier: {id, name} | None`; `pending: [{order_id, number, supplier, date, ordered, received, pending}]` (cantidades en unidad base; órdenes `CONFIRMED` con `quantity > quantity_received`, orden por fecha).
- [ ] **Step 1: Tests (RED).** `test_suppliers_share_avg_and_receipts`; `test_preferred_supplier_flagged`; `test_preferred_supplier_without_purchases_listed_only_in_preferred_supplier`; `test_supplier_returned_units`; `test_pending_partial_order`; `test_pending_ignores_draft_and_fully_received`; `test_query_count_constant_with_more_suppliers`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementa (una consulta para devoluciones agrupadas por proveedor, una para pendientes). **Step 4:** PASS + `pytest inventory -q`. **Step 5:** Commit `feat(inventory): proveedores y pendiente de recibir en procurement`.

### Task 3: Contrato, API y hook

Create `analytics/procurement.types.ts`, `hooks/useProductProcurement.ts` + test (copia estructural de `useProductSales`); Modify `api/inventoryApi.ts`, `index.ts`. RED → implementa → PASS + `tsc` → commit `feat(inventory): hook useProductProcurement y contrato del endpoint procurement`.

### Task 4: `composeProcurement`

Create `analytics/composeProcurement.ts` + test. Produces `composeProcurement(data): { findings: ProcurementFinding[]; sections: Array<"coverage" | "chart" | "suppliers" | "pending"> }` con `ProcurementFindingId = "low_coverage" | "preferred_absent" | "supplier_concentration" | "returns"` y umbrales exportados (`LOW_COVERAGE_DAYS = 15`, `SUPPLIER_CONCENTRATION = 80`). Tests: cada hallazgo en su umbral y bajo él (cobertura 15 sí / 16 no / `null` no; concentración 80 con 2 proveedores sí, con 1 no); secciones (`coverage` solo con `coverage`; `chart` y `suppliers` solo con compras; `pending` si hay filas). RED → PASS → commit `feat(inventory): composición y hallazgos del tab abastecimiento`.

### Task 5: `ProcurementBlock` y reemplazo en `TabContent`

Create `analytics/ProcurementBlock.tsx`, `entity-view/procurement.entity.ts` (proveedores con columna «Preferido» como texto, pendientes); Modify `analytics/TabContent.tsx` (caso `procurement` → `<ProcurementBlock productId period />`; agrega `procurement` a los tabs migrados); tests `ProcurementBlock.test.tsx`, `TabContent.test.tsx`, `ProductAnalyticsModal.test.tsx` (el aviso de histórico se prueba ahora en `Inventario`; el producto de prueba de seis tabs ya tiene stock).

- [ ] Tests (RED): cobertura con días y consumo diario, y ausente sin stock; cifras con variación; control «Métrica» cambia la serie; período anterior como serie aparte; tabla de proveedores con el preferido marcado; pendientes; hallazgos; sin compras muestra «Sin compras en el periodo» y «Última compra hace N días»; skeleton; parámetros del período; sin textos de tiempo de entrega ni punto de pedido. → implementa → `vitest features/inventory`, `tsc`, `lint` → commit `feat(inventory): tab abastecimiento con cobertura, proveedores y pendientes`.

### Task 6: Documentación y verificación final

ADR-0150 (tab `procurement` migrado; sin plazos por falta de datos), `api-contracts.md` (`GET /api/inventory/products/{id}/procurement/`), spec (desvíos). Verificación completa; commit `docs: tab abastecimiento en ADR-0150 y contratos`; push a la rama del PR #275.
