# Analítica por producto: esqueleto por capacidades (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los tabs y KPIs del análisis de producto dependen de las capacidades del producto; los KPIs de movimientos de stock dejan de depender de una lista truncada.

**Architecture:** `ProductSelector.get_capabilities` y un agregado `stock_flow` en el payload de `insights` (reemplaza `kardex`). El frontend usa un registro puro `productAnalyticsRegistry` para decidir tabs y KPIs; `ProductAnalyticsModal` lo consume.

**Tech Stack:** Django 5/DRF, pytest, Next.js 16, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-product-analytics-capabilities-design.md`

## Global Constraints

- Playbook `docs/30-playbooks/add-endpoint.md` y `add-selector.md` (leer antes de la Task 1); cero N+1; sin `any`; tokens semánticos.
- Tests backend: `cd backend && env DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -q -p no:cacheprovider`. Tests frontend: `source ~/.nvm/nvm.sh && nvm use 24 && cd frontend && npm run test -- <ruta>`.
- Base: esta rama parte de `feat/analytics-rail-nav` (RailNav) con la Fase 1 mergeada.
- ADR-0144 obligatorio (cambia el contrato del payload de insights).

## Review Focus

- Producto `can_be_sold=False` + comprable + `track_inventory`: segmento `INPUT`, sin tabs de ventas/clientes/precio.
- Fabricable express no muestra el tab de movimientos de stock; fabricable con stock sí.
- Insumo (`used_in_production`) no vendible ve el tab de Producción aunque no fabrique.
- Producto con variantes: `stock_flow` suma movimientos de las variantes.
- Producto sin movimientos: `stock_flow` con ceros y `monthly` vacío; el modal no rompe.
- Cambiar de producto en el selector con un tab que deja de ser visible: vuelve a Resumen.
- `capabilities` ausente en la respuesta (caché antigua): el modal muestra todos los tabs en lugar de fallar.

---

### Task 1: Capacidades en el backend

**Files:**
- Modify: `backend/inventory/selectors.py` (`ProductSelector.get_insights`, ~línea 403; nuevo `get_capabilities`)
- Test: `backend/inventory/tests/test_product_capabilities.py`

**Interfaces:**
- Produces: `ProductSelector.get_capabilities(product: Product) -> dict` con claves `sells, buys, tracks_stock, manufactures, express, recurring, used_in_production, has_variants` (bool) y `segment: str` (valores de la sección "Capacidades" del spec). `get_insights(...)["capabilities"]` es ese dict.

- [ ] **Step 1: Write failing tests:** `test_manufacturable_express_segment`, `test_manufacturable_stocked_segment`, `test_manufacturable_on_demand_segment`, `test_storable_not_sellable_is_input`, `test_storable_sellable_segment`, `test_service_and_subscription_segments`, `test_used_in_production_true_with_active_bom_line`, `test_used_in_production_false_with_inactive_bom`, `test_insights_payload_includes_capabilities` (assert `get_insights(product)["capabilities"]["segment"]`).
- [ ] **Step 2: Run** el archivo; Expected: FAIL (`get_capabilities` no existe).
- [ ] **Step 3: Implement** `get_capabilities` con una sola consulta `exists()` para `used_in_production` (import diferido de `production.models.BillOfMaterialsLine`) y agregarlo al dict de retorno de `get_insights`.
- [ ] **Step 4: Run** el archivo y `pytest inventory/tests -q`; Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): capacidades del producto en insights`.

### Task 2: `stock_flow` reemplaza `kardex`

**Files:**
- Modify: `backend/inventory/selectors.py` (bloque que construye `kardex`, líneas ~426-510; retorno de `get_insights`)
- Test: `backend/inventory/tests/test_product_stock_flow.py`

**Interfaces:**
- Produces: `get_insights(...)["stock_flow"] = {"totals": {"in_qty": float, "in_cost": float, "out_qty": float, "out_cost": float}, "monthly": [{"month": "YYYY-MM", "in": float, "out": float}]}`. La clave `kardex` desaparece del payload.

- [ ] **Step 1: Write failing tests:** `test_stock_flow_totals_by_direction` (entradas y salidas con `unit_cost`; costo = cantidad × `unit_cost`), `test_stock_flow_monthly_groups_by_month`, `test_stock_flow_includes_variants`, `test_stock_flow_empty_product`, `test_transfers_and_adjustments_excluded`, `test_insights_has_no_kardex_key`, `test_stock_flow_query_count_is_constant` (con 1 y con 20 movimientos, mismo número de queries del bloque).
- [ ] **Step 2: Run**; Expected: FAIL.
- [ ] **Step 3: Implement** el agregado en la BD: anotar la dirección con `Case/When` replicando `StockMove.direction` (TRANSFER si ambas ubicaciones INTERNAL; ADJUSTMENT si alguna está en `ADJUSTMENT_VIRTUAL_NAMES`; IN si destino INTERNAL; OUT si origen INTERNAL) y agregar con `Sum`/`TruncMonth`. Eliminar el armado de la lista `kardex` (y su `select_related/prefetch` ya sin uso).
- [ ] **Step 4: Run** el archivo y `pytest inventory/tests/test_product_analytics.py -q`; Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): stock_flow agregado en insights (reemplaza kardex)`.

### Task 3: Registro de tabs y KPIs (frontend, puro)

**Files:**
- Create: `frontend/features/inventory/analytics/productAnalyticsRegistry.ts`, `frontend/features/inventory/analytics/__tests__/productAnalyticsRegistry.test.ts`

**Interfaces:**
- Produces:
  - `type ProductSegment = "MANUFACTURABLE_EXPRESS" | "MANUFACTURABLE_STOCKED" | "MANUFACTURABLE_ON_DEMAND" | "SERVICE" | "SUBSCRIPTION" | "INPUT" | "STORABLE" | "CONSUMABLE"`
  - `interface ProductCapabilities { sells: boolean; buys: boolean; tracks_stock: boolean; manufactures: boolean; express: boolean; recurring: boolean; used_in_production: boolean; has_variants: boolean; segment: ProductSegment }`
  - `type ProductAnalyticsTabId = "overview" | "sales" | "purchases" | "price" | "cost" | "kardex" | "production" | "customers" | "suppliers"`
  - `visibleTabIds(c: ProductCapabilities | null | undefined): ProductAnalyticsTabId[]` (orden del spec; `null/undefined` devuelve todos)
  - `SEGMENT_LABELS: Record<ProductSegment, string>`
  - `type OverviewKpiId = "units_sold" | "valuation" | "stock" | "units_purchased" | "production_usage"`
  - `overviewKpiIds(c: ProductCapabilities | null | undefined): OverviewKpiId[]`

- [ ] **Step 1: Write failing tests:** un caso por fila de la tabla del spec (insumo no vendible, fabricable express, fabricable con stock, servicio, suscripción, producto vendible+comprable con stock), `visibleTabIds(undefined)` devuelve los 9, `overviewKpiIds` por segmento, y `SEGMENT_LABELS` cubre todos los segmentos.
- [ ] **Step 2: Run** `npm run test -- features/inventory/analytics`; Expected: FAIL.
- [ ] **Step 3: Implement** el módulo (sin dependencias de React).
- [ ] **Step 4: Run**; Expected: PASS; `npx tsc --noEmit` limpio.
- [ ] **Step 5: Commit** `feat(inventory): registro de tabs y KPIs por capacidades`.

### Task 4: `ProductAnalyticsModal` usa el registro

**Files:**
- Modify: `frontend/features/inventory/components/ProductAnalyticsModal.tsx` (interfaz `ProductInsights`, `TABS`, `kardexFlowData`/`kardexStats`, Resumen)
- Test: `frontend/features/inventory/components/__tests__/ProductAnalyticsModal.test.tsx`

**Interfaces:**
- Consumes: `visibleTabIds`, `overviewKpiIds`, `SEGMENT_LABELS`, `ProductCapabilities` (Task 3); `capabilities` y `stock_flow` del payload (Tasks 1-2).

- [ ] **Step 1: Write failing tests** (ampliando el archivo existente; el mock de `useProductInsights` gana `capabilities` y `stock_flow`): `hides sales tabs for an input-only product`, `shows stock tab only when tracks_stock`, `shows the segment label in the rail`, `falls back to overview when the active tab is no longer visible` (rerender con otro `productId`), `renders when capabilities is missing` (todos los tabs).
- [ ] **Step 2: Run** `npm run test -- features/inventory/components/__tests__/ProductAnalyticsModal.test.tsx`; Expected: FAIL.
- [ ] **Step 3: Implement:** tipar `capabilities` y `stock_flow` en `ProductInsights` y quitar `kardex`; construir `sections` del `RailNav` filtrando `TABS` con `visibleTabIds`; mostrar `SEGMENT_LABELS[segment]` en el slot `top` bajo el selector/nombre; renderizar solo los KPIs de `overviewKpiIds`; `kardexStats` y `kardexFlowData` salen de `stock_flow` (`totals`, `monthly`); `useEffect` que vuelve a `"overview"` si el tab activo ya no es visible. El contenido de cada tab no cambia.
- [ ] **Step 4: Run** los tests del archivo, `npm run test -- features/inventory`, `npx tsc --noEmit` y `npx eslint` de los archivos tocados; Expected: PASS y sin errores nuevos.
- [ ] **Step 5: Commit** `feat(inventory): análisis de producto adaptado a las capacidades`.

### Task 5: ADR-0144 y documentación

**Files:**
- Create: `docs/10-architecture/adr/0144-product-insights-capabilities-and-stock-flow.md`
- Modify: `docs/10-architecture/adr/README.md` (índice), la doc de contrato del endpoint de insights si existe (buscar con `grep -rn "insights" docs/20-contracts`)

- [ ] **Step 1:** Redactar el ADR (contexto, decisión: `capabilities` + `stock_flow` reemplaza `kardex`, valoración a costo, registro de tabs en el frontend; consecuencias y alternativas descartadas: endpoint aparte de capacidades, perfil por tipo).
- [ ] **Step 2:** Agregarlo al índice del README de ADRs y actualizar el contrato del payload.
- [ ] **Step 3: Run** `pytest backend/inventory -q` y `npm run test -- features/inventory` finales; Expected: PASS.
- [ ] **Step 4: Commit** `docs(adr): ADR-0144 capacidades y stock_flow en insights de producto`.
