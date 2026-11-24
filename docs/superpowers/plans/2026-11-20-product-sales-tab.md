# Tab «Ventas» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el contenido transitorio del tab `sales` (legado Ventas + Clientes) por una vista de decisión de volumen: unidades con variación, gráfico con período anterior superpuesto, clientes, canales, variantes y hallazgos.

**Architecture:** Endpoint nuevo `GET /inventory/products/{id}/sales/` (selector + serializer, vista ≤ 20 líneas) sobre entregas confirmadas; en el cliente, hook `useProductSales`, función pura `composeSales` y bloque `SalesBlock`. Sigue el mismo patrón que el tab `pricing` (`pricing_selector.py`, `PricingBlock`, `composePricing`).

**Tech Stack:** Django 5 + DRF, pytest; Next.js 16, TypeScript, TanStack Query, Nivo (`LineChart`/`BarChart` de `@/components/shared`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-product-sales-tab-design.md` (aprobado). ADR vigente: `docs/10-architecture/adr/0150-analisis-de-producto-por-bloque-y-periodo.md`.

## Global Constraints

- Zero `any`; tokens semánticos; `AnalyticsBlockFrame`/`SkeletonShell` para carga; hooks de datos en `features/inventory/hooks/`; sin `@/lib/api` en componentes.
- Vista Django ≤ 20 líneas; lógica en el selector; **zero N+1** (test de conteo de consultas constante).
- Hallazgos: caída de unidades ≥ 20 % con ≥ 5 unidades en el período anterior; top 3 clientes ≥ 70 % con más de 3 clientes; ≥ 60 días desde la última venta; devoluciones ≥ 10 %.
- Granularidad la decide el cliente con `periodToGranularity(period)`; `date_from` ausente = histórico.
- Textos en español. Sin cifras de precio, costo ni margen en este tab.
- Comandos: backend `cd backend && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <path> -q`; frontend `source ~/.nvm/nvm.sh && nvm use 24`, luego `cd frontend && npm run test -- <path>`, `npx tsc --noEmit`, `npm run lint`.

## Review Focus

1. Producto sin ventas en el rango pero con ventas antiguas: `units == 0` y `days_since_last_sale` calculado sobre todo el histórico (no `null`); producto sin ninguna venta: `last_sale_date` y `days_since_last_sale` en `null`.
2. Período anterior sin ventas: `previous.units == 0` y la variación no divide por cero (el cliente no muestra porcentaje ni hallazgo de caída).
3. Producto con variantes: ventas de la plantilla y de sus variantes suman en cifras y gráfico, y `variants` lista cada una.
4. Un solo canal o un solo cliente: se omiten el reparto por canal y la concentración sin romper la página.
5. Período `all`: `previous` y `previous_points` vacíos/nulos, sin variación ni serie superpuesta.

---

### Task 1: Endpoint `sales` — parámetros, `kpis` y `series`

**Files:**
- Create: `backend/inventory/sales_overview_params.py`, `backend/inventory/sales_overview_selector.py`
- Modify: `backend/inventory/views.py` (acción `sales_overview`, `url_path="sales"`, junto a `pricing`)
- Test: `backend/inventory/tests/test_sales_overview_selector.py`, `backend/inventory/tests/test_sales_overview_endpoint.py`

**Interfaces:**
- Consumes: de `sales_impact_selector`: `GRANULARITIES`, `net_revenue_expression`, `_period_expression`, `_period_label`, `_f`; de `pricing_selector`: `_period_start`. Helpers de test (`env`, `_sale`) de `inventory/tests/test_sales_impact_selector.py`.
- Produces:
  - `SalesOverviewParams(date_from: date | None = None, date_to: date | None = None, granularity: str = "month")` (dataclass frozen) y `SalesOverviewParamsSerializer` (mismos campos y validación que `PricingParamsSerializer`, método `to_params()`).
  - `SalesOverviewSelector.get_overview(product: Product, params: SalesOverviewParams) -> dict` con claves `kpis`, `series`, `customers`, `channels`, `variants`, `uoms` (las tres últimas vacías en esta tarea: `{"total": 0, "top3_share_pct": 0.0, "top": []}`, `[]`, `[]`, `[]`).
  - `kpis`: `{units, net_revenue, customers, return_units, return_rate_pct, last_sale_date, days_since_last_sale, previous}`; `previous`: `{units, net_revenue, customers}` o `null`.
  - `series`: `{points: [{period, units, net_revenue}], previous_points: [{period, units, net_revenue}]}`.

- [ ] **Step 1: Tests (RED).** Selector: `test_kpis_units_revenue_and_distinct_customers` (3 ventas, 2 clientes distintos → `customers == 2`, unidades e ingreso neto con descuento); `test_customers_not_capped_at_ten` (12 clientes distintos → `customers == 12`); `test_series_points_by_month`; `test_previous_is_equal_length_window_before_date_from` y `test_previous_is_none_without_date_from`; `test_previous_points_aligned_to_current_periods` (rango 2026-04-01..2026-06-30, venta de 7 u el 2026-01-15 → `previous_points == [{"period": "2026-04", "units": 7.0, ...}]`, desplazamiento de `(date_to − date_from).days + 1` días); `test_returns_rate` (venta de 10 u y devolución confirmada de 2 u en el rango → `return_units == 2`, `return_rate_pct == 20.0`); `test_last_sale_uses_whole_history` (venta antigua fuera del rango: `units == 0`, `last_sale_date` con esa fecha, `days_since_last_sale` entero); `test_no_sales_at_all` (`last_sale_date is None`, `days_since_last_sale is None`, series vacías); `test_includes_variant_sales`; `test_query_count_constant_with_more_rows`. Endpoint: 200 con las claves `{"kpis","series","customers","channels","variants","uoms"}`, 400 con `granularity=quarter`, 400 con `date_from>date_to`, 404 producto inexistente.
- [ ] **Step 2:** Ejecuta ambos archivos. Expected: FAIL (`ModuleNotFoundError: inventory.sales_overview_selector`).
- [ ] **Step 3:** Implementa serializer, selector y la acción de vista. Una consulta agregada por período (units, net_revenue) sobre `SaleDeliveryLine` confirmadas del producto y sus variantes (misma base que `_lines` de `pricing_selector`; reutilízala importándola); `customers` = `Count("delivery__sale_order__customer_id", distinct=True)` en una consulta agregada; `previous` y `previous_points` con la ventana `[date_from − (date_to − date_from) − 1 día, date_from − 1 día]` y fechas desplazadas hacia adelante `(date_to − date_from).days + 1` días antes de agrupar (usa `_period_start` y `_period_label`; agrupa en Python desde una consulta por día); devoluciones desde `SaleReturnLine` (`return_doc__status="CONFIRMED"`, `return_doc__date` en el rango, mismas ids de producto); `last_sale_date` = `Max("delivery__delivery_date")` sin filtro de rango.
- [ ] **Step 4:** Ejecuta ambos archivos y `ruff check` de los archivos nuevos. Expected: PASS, ruff limpio.
- [ ] **Step 5:** Commit `feat(inventory): endpoint sales con unidades, clientes y serie con período anterior`.

---

### Task 2: Repartos por cliente, canal, variante y unidad

**Files:**
- Modify: `backend/inventory/sales_overview_selector.py`
- Test: `backend/inventory/tests/test_sales_overview_selector.py`

**Interfaces:**
- Consumes: Task 1.
- Produces: `customers: {total: int, top3_share_pct: float, top: [{id, name, units, net_revenue, share_pct}]}` (10 como máximo, ordenado por ingreso neto desc); `channels` y `variants`/`uoms`: `[{key, label, units, net_revenue, share_pct}]` ordenados por ingreso desc; `variants` solo si `product.has_variants`; `uoms` solo si hay más de una unidad de medida vendida (si no, `[]`). `share_pct` es el porcentaje del ingreso neto total del rango (0 si el total es 0).

- [ ] **Step 1: Tests (RED).** `test_customers_top_with_share_and_concentration` (4 clientes con ingresos 50/30/10/10 % → `top3_share_pct == 90.0`, `top[0].share_pct == 50.0`, `total == 4`); `test_customers_top_limited_to_ten`; `test_channels_split_system_and_pos` (labels «Sistema» y «Punto de Venta (POS)»); `test_variants_only_when_product_has_variants` (plantilla con 2 variantes vendidas → 2 filas con `label` = `variant_display_name or name`; producto sin variantes → `[]`); `test_uoms_only_when_more_than_one` (una sola unidad → `[]`; dos → dos filas); `test_shares_sum_to_100`; `test_pos_generic_customer_convention` (revisa en el código del POS cómo se asigna el cliente; si hay una marca reconocible, ese cliente aparece como «Mostrador (POS)» y no cuenta en `customers.total` ni en `top3_share_pct`; si no la hay, el test fija que cuenta como un cliente más); `test_query_count_constant_with_more_rows`.
- [ ] **Step 2:** Ejecuta. Expected: FAIL (repartos vacíos).
- [ ] **Step 3:** Implementa un helper `_breakdown(lines, key_expr, label_fn)` por dimensión (una consulta agrupada cada una, sin consultas por fila): cliente (`delivery__sale_order__customer_id` + nombre), canal (`sale_line__order__channel`, etiquetas con `SaleOrder.Channel.choices`), variante (`product_id`, etiqueta con `variant_display_name or name` en una sola consulta de `Product`) y unidad (`uom_id`, nombre vía `UoM`).
- [ ] **Step 4:** Ejecuta `test_sales_overview_selector.py`, `test_sales_overview_endpoint.py` y `pytest inventory -q`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(inventory): repartos por cliente, canal, variante y unidad en sales`.

---

### Task 3: Contrato, API y hook del cliente

**Files:**
- Create: `frontend/features/inventory/analytics/sales.types.ts`, `frontend/features/inventory/hooks/useProductSales.ts`
- Modify: `frontend/features/inventory/api/inventoryApi.ts` (junto a `getProductPricing`), `frontend/features/inventory/index.ts` (export del hook)
- Test: `frontend/features/inventory/hooks/__tests__/useProductSales.test.tsx`

**Interfaces:**
- Consumes: forma del payload (Task 1-2), `SalesImpactGranularity`.
- Produces: tipos `SalesParams {granularity; date_from?; date_to?}`, `SalesKpis`, `SalesPoint`, `SalesShareRow {key: string; label: string; units: number; net_revenue: number; share_pct: number}`, `SalesCustomerRow {id: number; name: string; units; net_revenue; share_pct}`, `ProductSales`; `inventoryApi.getProductSales(id: number, params: SalesParams): Promise<ProductSales>`; `useProductSales(productId: number | null | undefined, params: SalesParams): { data: ProductSales | null; isLoading: boolean; isError: boolean }` con el mismo `placeholderData` por `date_from` de `useProductPricing`.

- [ ] **Step 1: Test (RED)** `useProductSales.test.tsx`, copia estructural de `useProductPricing.test.tsx`: llama a la API con id y parámetros, no consulta con id nulo, un cambio de `date_from` no entrega datos del período anterior.
- [ ] **Step 2:** Ejecuta. Expected: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementa tipos, método de API (`GET inventory/products/${id}/sales/`) y hook (clave `[...PRODUCTS_KEYS.detail(id), "sales", params]`).
- [ ] **Step 4:** Ejecuta el test y `npx tsc --noEmit`. Expected: PASS, sin errores.
- [ ] **Step 5:** Commit `feat(inventory): hook useProductSales y contrato del endpoint sales`.

---

### Task 4: `composeSales` (hallazgos y secciones)

**Files:**
- Create: `frontend/features/inventory/analytics/composeSales.ts`
- Test: `frontend/features/inventory/analytics/__tests__/composeSales.test.ts`

**Interfaces:**
- Consumes: `ProductSales`.
- Produces:
  ```ts
  export type SalesFindingId = "sales_drop" | "customer_concentration" | "no_recent_sales" | "high_returns"
  export interface SalesFinding { id: SalesFindingId; message: string }
  export interface SalesComposition {
      findings: SalesFinding[]
      sections: Array<"chart" | "customers" | "channels" | "variants" | "uoms">
  }
  export const SALES_DROP_THRESHOLD = 0.2, CONCENTRATION_THRESHOLD = 70, NO_RECENT_SALES_DAYS = 60, RETURNS_THRESHOLD = 10
  export function composeSales(data: ProductSales): SalesComposition
  ```
  Reglas: `chart` si hay puntos; `customers` si `customers.total > 0`; `channels` si hay más de un canal; `variants` si hay filas; `uoms` si hay filas; sin ventas en el rango → `sections: []`. `sales_drop` exige `previous.units ≥ 5` y caída ≥ 20 %; `customer_concentration` exige `total > 3` y `top3_share_pct ≥ 70`; `no_recent_sales` con `days_since_last_sale ≥ 60`; `high_returns` con `return_rate_pct ≥ 10`.

- [ ] **Step 1: Tests (RED)**, uno por regla: caída 20 % sí / 19 % no / previo con 4 u no / previo nulo no; concentración 70 sí / 69 no / 3 clientes no; 60 días sí / 59 no / `null` no (incluye el caso sin ventas en el rango pero con venta antigua); devoluciones 10 sí / 9 no; secciones con un solo canal, un solo cliente, sin ventas y con variantes/unidades.
- [ ] **Step 2:** Ejecuta. Expected: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementa la función pura (sin React) con los umbrales como constantes exportadas.
- [ ] **Step 4:** Ejecuta el test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(inventory): composición y hallazgos del tab ventas`.

---

### Task 5: `SalesBlock` y reemplazo en `TabContent`

**Files:**
- Create: `frontend/features/inventory/analytics/SalesBlock.tsx`, `frontend/features/inventory/entity-view/salesShare.entity.ts` (entidades `salesCustomersEntity` y `salesSharesEntity` con `defineEntity`, modelo `pricingEffects.entity.ts`; sin `computed` ni JSX en columnas)
- Modify: `frontend/features/inventory/analytics/TabContent.tsx` (caso `sales` → `<SalesBlock productId period capabilities />`; `tabHasLegacyContent` también falso para `sales`)
- Test: `frontend/features/inventory/analytics/__tests__/SalesBlock.test.tsx`; ajustes en `TabContent.test.tsx` y `components/__tests__/ProductAnalyticsModal.test.tsx` (mock de `SalesBlock`; el test del aviso de histórico usa ahora el tab `Costos`, y el de «no avisa» incluye `Ventas`)

**Interfaces:**
- Consumes: `useProductSales`, `composeSales`, `AnalyticsBlockFrame`, `periodToDateFrom`, `periodToGranularity`, `RailControls`, `ViewControl`, `LineChart`/`BarChart`/`Metric`/`MetricStrip` de `@/components/shared`, `Collection`/`useEntityCollection`.
- Produces: `SalesBlock({ productId: number; period: PeriodKey })`.

- [ ] **Step 1: Tests (RED)** con el hook mockeado y `LineChart`/`BarChart` mockeados (como en `PricingBlock.test.tsx`): (a) la métrica protagonista «Unidades vendidas» muestra la variación contra el período anterior y no hay variación con `previous: null`; (b) «Clientes» muestra el total real (12, no 10); (c) los hallazgos de `composeSales` aparecen en una lista «Hallazgos»; (d) el control «Métrica» (radio «Unidades» / «Ingreso neto») cambia la serie principal que recibe el gráfico; (e) la serie del período anterior se pasa al gráfico como serie aparte y no aparece con `previous_points` vacío; (f) las secciones omitidas por `composeSales` no se renderizan (un canal → sin «Canales»; sin variantes → sin «Variantes»); (g) sin ventas muestra «Sin ventas en el periodo» y «Última venta hace N días» y ningún gráfico; (h) skeleton de `AnalyticsBlockFrame` mientras carga; (i) parámetros: granularidad del período y `date_from` ausente con `all`; (j) el bloque no muestra ninguna cifra de precio, costo ni margen (no existen los textos «Margen», «Costo», «Precio»).
- [ ] **Step 2:** Ejecuta. Expected: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementa `SalesBlock`: `MetricStrip` «Resultado del periodo» (Unidades vendidas con `delta {current, previous}` si el previo > 0, Ingreso neto, Clientes, Devoluciones con la tasa en `context`) y «Última venta» (fecha y días); gráfico principal con la métrica elegida (`LineChart` con la serie actual y, si hay, «Período anterior» atenuada y punteada vía `lineStyle`/color de token), tablas por sección con `Collection`; control «Métrica» con `<RailControls><ViewControl …/></RailControls>`; cada sección omitida por la composición no se renderiza.
- [ ] **Step 4:** Reemplaza el caso `sales` en `TabContent.tsx`, ajusta `tabHasLegacyContent` y los tests de `TabContent` y del modal.
- [ ] **Step 5:** Ejecuta `npm run test -- features/inventory`, `npx tsc --noEmit`, `npm run lint`. Expected: todo en verde, 0 errores de lint.
- [ ] **Step 6:** Commit `feat(inventory): tab ventas de volumen, clientes y canales`.

---

### Task 6: Documentación y verificación final

**Files:**
- Modify: `docs/10-architecture/adr/0150-analisis-de-producto-por-bloque-y-periodo.md` (el tab `sales` ya es bloque propio con endpoint `sales`, sin aviso de histórico), `docs/20-contracts/api-contracts.md` (documenta `GET /api/inventory/products/{id}/sales/`), `docs/superpowers/specs/2026-11-20-product-sales-tab-design.md` (registra los desvíos de la implementación)

- [ ] **Step 1:** Actualiza los tres documentos.
- [ ] **Step 2:** Verificación completa: `pytest inventory -q`, `ruff check` de los archivos nuevos, `npx tsc --noEmit`, `npm run lint`, `npm run test -- features/inventory`. Expected: todo en verde.
- [ ] **Step 3:** Si hay servidor de desarrollo disponible, abre el modal de un producto con variantes y revisa gráfico, período anterior y zona Vista; si no, dilo en el informe.
- [ ] **Step 4:** Commit `docs: tab ventas en ADR-0150 y contratos`.
