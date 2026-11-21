# Tab «Precio y margen» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el contenido transitorio del tab `pricing` (SalesImpactBlock + historial legado `price`) por una vista de decisión: margen realizado, gráficos precio-contra-ventas con marcadores de cambios, tabla «Antes vs después» y hallazgos.

**Architecture:** Endpoint nuevo `GET /inventory/products/{id}/pricing/` (selector + serializer de parámetros, vista ≤ 20 líneas) que agrega entregas confirmadas y el historial de precio. En el cliente, un hook `useProductPricing`, una función pura `composePricing` (hallazgos y secciones) y un bloque `PricingBlock` que compone gráficos, efectos y el desglose existente (`SalesImpactBlock`).

**Tech Stack:** Django 5 + DRF, pytest; Next.js 16, TypeScript, TanStack Query, Nivo (vía `LineChart`/`AnalyticsChart`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-product-pricing-tab-design.md` (aprobado). ADR vigente: `docs/10-architecture/adr/0150-analisis-de-producto-por-bloque-y-periodo.md`.

## Global Constraints

- Zero `any`; colores solo con tokens semánticos; `AnalyticsBlockFrame`/`SkeletonShell` para carga; hooks de datos en `features/inventory/hooks/`; sin `@/lib/api` en componentes.
- Vista Django ≤ 20 líneas; lógica en selector; **zero N+1**: el conteo de consultas del selector no crece con las filas (test explícito).
- Ventana de efecto: **28 días** a cada lado; `reliable` solo con **≥ 7 días** y **≥ 5 unidades** por lado.
- Hallazgos: costo promedio +5 % o más con precio de lista sin cambios; margen realizado negativo en algún período; no percibido ≥ 5 % del ingreso neto.
- Granularidad la decide el cliente con `periodToGranularity(period)` (`day|week|month|year`); `date_from` ausente = histórico.
- Textos en español; la nota «asociación, no causalidad» se conserva.
- Comandos: backend `cd backend && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <path> -q`; frontend con `source ~/.nvm/nvm.sh && nvm use 24` y `cd frontend && npm run test -- <path>`, `npx tsc --noEmit`, `npm run lint`.

## Review Focus

1. Producto sin ninguna venta en el rango: respuesta con `series=[]`, `effects` solo con eventos y `reliable=false`, `kpis` en cero sin dividir por cero.
2. Producto sin costo (servicio/suscripción): `has_cost=false`, `margin_pct`/`list_margin_pct`/`margin_per_unit` en `null`, nunca `NaN` ni 0 engañoso.
3. Dos cambios de precio a menos de 28 días: las ventanas se truncan en el evento vecino y no se solapan.
4. Cambio de precio en un período sin ventas: el marcador no se dibuja si su período no está en la serie (no rompe el gráfico).
5. Período `all` (sin `date_from`): `kpis.previous = null`, sin comparación; producto con variantes agrega ventas de las variantes.

---

### Task 1: Endpoint `pricing` — parámetros, `today`, `kpis`, `series`

**Files:**
- Create: `backend/inventory/pricing_params.py`, `backend/inventory/pricing_selector.py`
- Modify: `backend/inventory/views.py` (acción `pricing` junto a `sales_impact`, ~línea 223)
- Test: `backend/inventory/tests/test_pricing_selector.py`, `backend/inventory/tests/test_pricing_endpoint.py`

**Interfaces:**
- Consumes: de `sales_impact_selector`: `GRANULARITIES`, `net_revenue_expression`, `_period_expression`, `_period_label`, `_f`. Helpers de test (`env`, `_sale`, `_rule`) de `inventory/tests/test_sales_impact_selector.py` (impórtalos de ahí).
- Produces:
  - `PricingParams(date_from: date | None = None, date_to: date | None = None, granularity: str = "month")` (dataclass frozen).
  - `PricingParamsSerializer(data=...)` con `date_from`, `date_to` (DateField opcionales; `date_from > date_to` → 400), `granularity` ChoiceField(`GRANULARITIES`, default `month`), método `to_params() -> PricingParams`.
  - `PricingSelector.get_pricing(product: Product, params: PricingParams) -> dict` con claves `has_cost`, `today`, `kpis`, `series`, `list_price_changes`, `rule_windows`, `effects` (las tres últimas vacías en esta tarea).
  - `today`: `{list_price_net, list_price_gross, cost, list_margin_pct}`; `kpis`: `{margin_pct, net_revenue, units, avg_price, avg_discount_pct, foregone_revenue, previous}`; `series`: `{points: [{period, units, net_revenue, avg_price, avg_list_price, avg_cost, margin_pct}], by_rule: []}`.

- [ ] **Step 1: Tests (RED).** En `test_pricing_selector.py`: `test_kpis_margin_uses_discounted_revenue` (dos ventas con descuento: `margin_pct == (net−cost)/net*100`, `net_revenue`, `units`, `avg_discount_pct`); `test_series_points_by_month` (dos meses → dos puntos con `avg_cost` y `margin_pct`); `test_previous_period_is_equal_length_window_before_date_from` (venta en la ventana previa aparece en `kpis.previous.units`); `test_previous_is_none_without_date_from`; `test_no_cost_product_has_null_margins` (producto con `cost_price=0` y entregas `unit_cost=0` → `has_cost` False, `margin_pct` y `today.list_margin_pct` None); `test_no_sales_returns_zeroed_kpis` (sin ventas: `units==0`, `margin_pct is None`, `series.points==[]`); `test_includes_variant_sales` (plantilla con variante vendida); `test_query_count_constant_with_more_rows` (patrón de `test_sales_impact_selector.py:235`). En `test_pricing_endpoint.py`: 200 con claves esperadas, 400 con `granularity=quarter`, 400 con `date_from>date_to`, 404 producto inexistente (usa el patrón de `test_sales_impact_endpoint.py`).
- [ ] **Step 2:** Ejecuta ambos archivos. Expected: FAIL (`ModuleNotFoundError: inventory.pricing_selector`).
- [ ] **Step 3:** Implementa `pricing_params.py` y `PricingSelector.get_pricing` en `pricing_selector.py`: una consulta agregada por período sobre `SaleDeliveryLine` confirmadas del producto y sus variantes (mismo filtro que `get_sales_impact`, pero sin el `date_from` por defecto de 365 días: ausente = sin cota inferior), anotando `net_revenue_expression()`, `quantity*unit_cost` y el precio de lista neto (`list_unit_price_gross / (1 + tax_rate/100)`, como `list_net` en `sales_impact_selector`; si es nulo usa `unit_price` por línea). `kpis` se calcula sumando los puntos; `previous` repite el cálculo para `[date_from − (date_to − date_from) − 1 día, date_from − 1 día]` (usa `date.today()` si falta `date_to`). `has_cost` = `product.cost_price > 0` o algún `unit_cost > 0` en el rango; si es falso todos los `*margin*` son `None`. `today` sale de `product.sale_price`, `product.sale_price_gross`, `product.cost_price`.
- [ ] **Step 4:** Añade la acción `pricing` en `views.py` con `url_path="pricing"`, mismo patrón y ≤ 20 líneas que `sales_impact`.
- [ ] **Step 5:** Ejecuta ambos archivos y `ruff check backend/inventory/pricing_params.py backend/inventory/pricing_selector.py`. Expected: PASS, ruff sin errores.
- [ ] **Step 6:** Commit `feat(inventory): endpoint pricing con KPIs y serie de precio y margen`.

---

### Task 2: Cambios de precio de lista, ventanas de reglas y desglose por regla

**Files:**
- Modify: `backend/inventory/pricing_selector.py`
- Test: `backend/inventory/tests/test_pricing_selector.py`

**Interfaces:**
- Consumes: Task 1 (`get_pricing`).
- Produces: `list_price_changes: {baseline: float | None, changes: [{date: str, period: str, from: float, to: float}]}` (`period` = etiqueta del período que contiene la fecha, con `_period_label`); `rule_windows` idéntico al de `sales-impact` (`rule_id`, `name`, `start`, `end`); `series.by_rule: [{period, key, label, units, avg_price}]` donde `key` es el id de regla como texto, `manual` o `list`.

- [ ] **Step 1: Tests (RED).** `test_list_price_changes_from_history` (cambia `product.sale_price` dos veces; `changes` con `from`/`to`, y solo las del rango; `baseline` = precio vigente al inicio); `test_list_price_changes_ignore_cost_only_edits` (editar `cost_price` no genera cambio); `test_rule_windows_match_sales_impact` (misma salida que `SalesImpactSelector` para el mismo producto); `test_by_rule_splits_price_per_rule` (ventas con regla A y con precio de lista → dos claves con su `avg_price`); `test_query_count_constant_with_more_rows` sigue pasando.
- [ ] **Step 2:** Ejecuta. Expected: FAIL (claves vacías).
- [ ] **Step 3:** Implementa leyendo `product.history` (simple_history, solo cambios de `sale_price`, ordenado por fecha) en una consulta; `rule_windows` reutiliza la construcción de `get_sales_impact` (extráela a una función de módulo en `sales_impact_selector.py` y llámala desde ambos selectores sin cambiar el contrato de `sales-impact`); `by_rule` reutiliza `_segment_key_expression("rule")` y `_segment_labels`, en una sola consulta agrupada por período y segmento.
- [ ] **Step 4:** Ejecuta `test_pricing_selector.py`, `test_sales_impact_selector.py` y `test_sales_impact_endpoint.py`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(inventory): cambios de precio de lista y serie por regla en pricing`.

---

### Task 3: Efectos «antes vs después»

**Files:**
- Modify: `backend/inventory/pricing_selector.py`
- Test: `backend/inventory/tests/test_pricing_selector.py`

**Interfaces:**
- Consumes: Task 2 (`list_price_changes`, `rule_windows`).
- Produces: `effects: [{kind: "list_price"|"rule", label: str, date: str, period: str, before: Side, after: Side, reliable: bool}]` ordenado por `date`, con `Side = {days: int, units: float, units_per_day: float, revenue_per_day: float, margin_per_unit: float | None}`. Constantes de módulo `EFFECT_WINDOW_DAYS = 28`, `EFFECT_MIN_DAYS = 7`, `EFFECT_MIN_UNITS = 5`.

- [ ] **Step 1: Tests (RED).** `test_effect_compares_28_day_windows` (ventas 10 u en los 28 días previos y 20 u en los posteriores: `before.units_per_day`, `after.units_per_day`, `reliable` True); `test_effect_windows_truncated_by_neighbor_event` (dos cambios a 10 días: la ventana «después» del primero termina un día antes del segundo y `days == 10`); `test_effect_truncated_by_range` (el rango limita ambos lados); `test_effect_unreliable_with_few_units_or_days` (`reliable` False si un lado tiene < 5 u o < 7 días); `test_effect_margin_per_unit_none_without_cost`; `test_rule_events_use_start_and_end` (una regla con inicio y fin genera dos efectos con etiquetas «Regla X (inicio)» y «Regla X (fin)»); `test_effects_without_sales_are_unreliable`; `test_query_count_constant_with_more_rows` con 15 ventas y 3 eventos.
- [ ] **Step 2:** Ejecuta. Expected: FAIL (`effects == []`).
- [ ] **Step 3:** Implementa `_effects(...)`: una sola consulta agregada por **día** (unidades, ingreso neto, costo) sobre el rango completo, y calcula todas las ventanas en Python. Eventos = cambios de lista + inicio/fin de cada regla dentro del rango, ordenados por fecha; ventana antes `[max(inicio_rango, evento−28d, evento_previo), evento−1d]`, después `[evento, min(fin_rango, evento+27d, evento_siguiente−1d)]`. `days` cuenta días del intervalo (no solo con ventas).
- [ ] **Step 4:** Ejecuta `test_pricing_selector.py` y `test_pricing_endpoint.py`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(inventory): efectos antes vs después de cambios de precio y reglas`.

---

### Task 4: Contrato, API y hook del cliente

**Files:**
- Create: `frontend/features/inventory/analytics/pricing.types.ts`, `frontend/features/inventory/hooks/useProductPricing.ts`
- Modify: `frontend/features/inventory/api/inventoryApi.ts` (junto a `getProductSalesImpact`, ~línea 126), barrel del feature si exporta hooks
- Test: `frontend/features/inventory/hooks/__tests__/useProductPricing.test.tsx`

**Interfaces:**
- Consumes: Task 1-3 (forma del payload), `SalesImpactGranularity` de `salesImpact.types.ts`, `staleTime`, `PRODUCTS_KEYS`.
- Produces: tipos `PricingParams {granularity; date_from?; date_to?}`, `PricingSide`, `PricingEffect`, `PricingPoint`, `PricingKpis`, `ProductPricing` (espejo exacto del payload); `inventoryApi.getProductPricing(id: number, params: PricingParams): Promise<ProductPricing>`; `useProductPricing(productId: number | null | undefined, params: PricingParams): { data: ProductPricing | null; isLoading: boolean; isError: boolean }`, con `placeholderData` que conserva datos solo si cambia `granularity` pero no `date_from` (mismo criterio que `useProductOperations`).

- [ ] **Step 1: Test (RED)** `useProductPricing.test.tsx` siguiendo `useProductOperations.test.tsx`: llama `getProductPricing` con los parámetros, no consulta con `productId` nulo, y un cambio de `date_from` no entrega datos del período anterior.
- [ ] **Step 2:** Ejecuta el test. Expected: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementa tipos, método de API (`GET inventory/products/${id}/pricing/`) y hook (clave `[...PRODUCTS_KEYS.detail(id), "pricing", params]`).
- [ ] **Step 4:** Ejecuta el test y `npx tsc --noEmit`. Expected: PASS, sin errores.
- [ ] **Step 5:** Commit `feat(inventory): hook useProductPricing y contrato del endpoint pricing`.

---

### Task 5: `composePricing` (hallazgos y secciones)

**Files:**
- Create: `frontend/features/inventory/analytics/composePricing.ts`
- Test: `frontend/features/inventory/analytics/__tests__/composePricing.test.ts`

**Interfaces:**
- Consumes: `ProductPricing`, `SalesImpactGroupBy`.
- Produces:
  ```ts
  export type PricingFindingId = "cost_up_price_flat" | "negative_margin" | "high_foregone"
  export interface PricingFinding { id: PricingFindingId; message: string }
  export interface PricingComposition {
      hero: "margin" | "price"
      findings: PricingFinding[]
      sections: Array<"charts" | "effects" | "breakdown">
      defaultGroupBy: SalesImpactGroupBy
  }
  export function composePricing(data: ProductPricing, capabilities: { has_variants: boolean }): PricingComposition
  ```
  Reglas: `hero` es `margin` si `data.has_cost`, si no `price`; `findings` vacío sin costo salvo `high_foregone`; `sections` omite `charts` y `effects` si `series.points` está vacío y omite `effects` si no hay eventos; `breakdown` siempre; `defaultGroupBy` = `variant` si `has_variants`, si no `rule`.

- [ ] **Step 1: Tests (RED)**, uno por regla con fixtures mínimas: `cost_up_price_flat` (costo último punto +6 % vs primero y sin cambios de lista → hallazgo; +4 % → no; con cambio de lista → no); `negative_margin` (un punto con `margin_pct < 0`); `high_foregone` (≥ 5 % sí, 4,9 % no); sin costo no hay hallazgos de margen; `hero`; `sections` con serie vacía y sin eventos; `defaultGroupBy` con variantes.
- [ ] **Step 2:** Ejecuta. Expected: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementa la función pura (sin React) con los umbrales como constantes exportadas (`COST_RISE_THRESHOLD = 0.05`, `FOREGONE_THRESHOLD = 0.05`).
- [ ] **Step 4:** Ejecuta el test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(inventory): composición y hallazgos del tab precio y margen`.

---

### Task 6: `PricingBlock` y reemplazo en `TabContent`

**Files:**
- Create: `frontend/features/inventory/analytics/PricingBlock.tsx`, `frontend/features/inventory/entity-view/pricingEffects.entity.ts` (entidad de la tabla «Antes vs después» con `defineEntity`, ver `salesImpact.entity.ts` como modelo; sin `computed` ni JSX en columnas)
- Modify: `frontend/features/inventory/analytics/SalesImpactBlock.tsx` (prop opcional `defaultGroupBy?: SalesImpactGroupBy`, valor inicial del estado `groupBy`), `frontend/features/inventory/analytics/TabContent.tsx:49-50` (el caso `pricing` pasa a `<PricingBlock productId period capabilities />` sin `legacy("price")`), `tabHasLegacyContent` y su test
- Test: `frontend/features/inventory/analytics/__tests__/PricingBlock.test.tsx`, ajuste de `TabContent.test.tsx` y `ProductAnalyticsModal.test.tsx` (mock de `PricingBlock`; el aviso «Este tab muestra todo el histórico» ya no aparece en `pricing`)

**Interfaces:**
- Consumes: `useProductPricing`, `composePricing`, `SalesImpactBlock`, `AnalyticsBlockFrame`, `periodToDateFrom`, `periodToGranularity`, `LineChart`/`AnalyticsChart` de `@/components/shared`, `Metric`/`MetricStrip`, `Collection`/`useEntityCollection`.
- Produces: `PricingBlock({ productId: number; period: PeriodKey; capabilities: { has_variants: boolean } })`.

- [ ] **Step 1: Tests (RED)** con el hook mockeado: (a) con costo muestra la métrica «Margen realizado» y los hallazgos que devuelve `composePricing`; (b) sin costo muestra «Precio realizado» y no muestra «Margen realizado»; (c) la tabla «Antes vs después» lista un efecto y marca «Pocos datos» si `reliable` es falso; (d) con `series.points` vacío muestra «Sin ventas en el periodo» y mantiene «Hoy»; (e) mientras carga renderiza el skeleton de `AnalyticsBlockFrame`; (f) un marcador cuyo `period` no está en la serie no se pasa al gráfico (mockea `LineChart` y asevera sobre la prop `markers`); (g) con `has_variants` el desglose arranca agrupado por variante; (h) la nota «asociación, no causalidad» está presente.
- [ ] **Step 2:** Ejecuta. Expected: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementa `PricingBlock`: «Hoy» y protagonista con `MetricStrip`/`Metric` (con variación vs `kpis.previous`); gráfico superior `LineChart` (series: precio de lista, precio realizado y una por regla de `by_rule`; `markers` de tipo `x` en el `period` de cada efecto, con etiqueta corta; las ventanas de reglas siguen como chips de `SalesImpactBlock`); gráfico inferior `AnalyticsChart type="bar-chart"` de unidades con **los mismos márgenes izquierdo y derecho** que el superior para alinear el eje; sección «Antes vs después» con la colección; el desglose es `<SalesImpactBlock defaultGroupBy={composition.defaultGroupBy} .../>` (sus controles siguen en la zona Vista). Cada sección que `composePricing` omite no se renderiza.
- [ ] **Step 4:** Reemplaza el caso `pricing` en `TabContent.tsx` y quita `price` de lo que `tabHasLegacyContent` considera legado para `pricing`; ajusta los tests de `TabContent` y del modal.
- [ ] **Step 5:** Ejecuta `npm run test -- features/inventory`, `npx tsc --noEmit`, `npm run lint`. Expected: todo en verde, 0 errores de lint.
- [ ] **Step 6:** Commit `feat(inventory): tab precio y margen con impacto del precio en las ventas`.

---

### Task 7: Documentación y verificación final

**Files:**
- Modify: `docs/10-architecture/adr/0150-analisis-de-producto-por-bloque-y-periodo.md` (nueva línea: el tab `pricing` ya es bloque propio con endpoint `pricing`; el aviso de histórico se retira para ese tab), `docs/20-contracts/api-contracts.md` (documenta `GET /api/inventory/products/{id}/pricing/` con sus parámetros y claves), `docs/superpowers/specs/2026-11-20-product-pricing-tab-design.md` (estado: aprobado; registra los desvíos de este plan)

- [ ] **Step 1:** Actualiza los tres documentos; en el spec anota que las «bandas» de reglas se dibujan como marcadores de inicio/fin (Nivo no soporta rangos) más los chips de vigencia existentes.
- [ ] **Step 2:** Verificación completa: `pytest inventory -q` (backend), `npx tsc --noEmit`, `npm run lint`, `npm run test -- features/inventory` (frontend). Expected: todo en verde.
- [ ] **Step 3:** Si hay servidor de desarrollo disponible, abre el modal de un producto con variantes y otro servicio y comprueba el alineamiento de los dos gráficos y los marcadores; si no se puede, dilo en el informe.
- [ ] **Step 4:** Commit `docs: tab precio y margen en ADR-0150 y contratos`.
