# Product Analytics: Infraestructura de los 8 tabs — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasar el modal de análisis de producto de 13 a 8 tabs con sus reglas de visibilidad, mover los controles contextuales a una zona "Vista" en el pie del riel y reemplazar la granularidad manual por una automática derivada del período.

**Architecture:** Un registro de tabs con ids nuevos decide qué tabs aplican. Cada tab nuevo muestra, de forma transitoria y apilada, el contenido existente que absorbe (bloques actuales y `LegacyInsightsPanel`); los planes por tab lo reemplazan uno a uno. Los bloques entregan sus controles a la zona Vista del riel mediante un portal.

**Tech Stack:** Next.js 16 / React / Vitest (frontend); Django 5 + DRF / pytest (backend).

**Spec:** `docs/superpowers/specs/2026-11-20-product-analytics-tab-planning-design.md` (y `2026-11-20-product-analytics-redesign-design.md`).

**Antes de la Tarea 1:** commitear este plan y el spec de planificación (están sin commitear).

## Global Constraints

- Tabs y condiciones: `overview` siempre; `sales` y `pricing` si `sells`; `costs` si `buys` o `manufactures` o `tracks_stock`; `procurement` si `buys`; `inventory` si `tracks_stock`; `production` si `manufactures` o `used_in_production`; `subscription` si `recurring`. Orden fijo: overview, sales, pricing, costs, procurement, inventory, production, subscription.
- Etiquetas: Resumen, Ventas, Precio y margen, Costos, Abastecimiento, Inventario, Producción, Suscripción.
- Granularidad automática: `1m` → `day`; `3m` y `6m` → `week`; `12m` y `24m` → `month`; `all` → `year`. La granularidad manual se elimina.
- El segmento sigue siendo interno; el período sigue en el pie del riel.
- Cero `any`; tokens semánticos; barrels; vistas Django ≤ 20 líneas; hooks de feature para `useQuery`.
- Frontend: `npm run type-check` y `npm run lint` sin errores; tests con Node 24 (nvm). Backend desde `backend/`: `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest`.
- Commits con el pie `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Semana ISO en el cambio de año: el 29 de diciembre de 2025 pertenece a la semana ISO 2026-W01 y debe etiquetarse con el año ISO (`%G`), no con el calendario.
2. Producto que no vende, no compra y no controla stock: solo Resumen.
3. La zona Vista existe dos veces (riel y copia móvil): cambiar un control en una se refleja en la otra y no se duplican las consultas.
4. Al cambiar de tab desaparecen los controles del tab anterior del riel (sin controles huérfanos).
5. Producto fabricable que además compra y es componente de otra BOM: "Fabricar vs comprar" aparece solo en Costos y "Uso como insumo" solo en Producción, sin duplicarse.

---

### Task 1: Granularidad `week` en `sales-impact` (backend)

**Files:**
- Modify: `backend/inventory/sales_impact_selector.py` (`GRANULARITIES` línea 31, `_period_expression` línea 79, `_period_label` línea 87)
- Test: `backend/inventory/tests/test_sales_impact_selector.py`

**Interfaces:**
- Consumes: `GRANULARITIES` ya valida el parámetro en `SalesImpactParamsSerializer` (se actualiza solo).
- Produces: `granularity="week"` agrupa por semana ISO (lunes a domingo); la etiqueta del período es `"<año ISO>-W<semana ISO con dos dígitos>"`, por ejemplo `"2026-W11"`.

- [ ] **Step 1: Write the failing tests** `test_granularity_week` (ventas el 2026-03-10 y el 2026-03-12 caen en `["2026-W11"]`; el 2026-03-20 en `"2026-W12"`; la serie es `["2026-W11", "2026-W12"]`) y `test_granularity_week_uses_iso_year` (una venta el 2025-12-29 produce el período `"2026-W01"`). En el test del endpoint (`test_sales_impact_endpoint.py`) agregar que `{"granularity": "week"}` responde 200.
- [ ] **Step 2: Run** `pytest backend/inventory/tests/test_sales_impact_selector.py backend/inventory/tests/test_sales_impact_endpoint.py -k week -v`. Expected: FAIL (granularidad inválida).
- [ ] **Step 3: Implement** agregando `"week"` a `GRANULARITIES`, `TruncWeek("delivery__delivery_date")` en `_period_expression` y la etiqueta ISO en `_period_label`.
- [ ] **Step 4: Run** los mismos tests más el resto de `test_sales_impact_*`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): granularidad semanal en sales-impact`.

### Task 2: Granularidad derivada del período (frontend)

**Files:**
- Modify: `frontend/features/inventory/analytics/period.ts`, `frontend/features/inventory/analytics/salesImpact.types.ts` (`SalesImpactGranularity` suma `"week"`)
- Test: `frontend/features/inventory/analytics/__tests__/period.test.ts`

**Interfaces:**
- Consumes: `PeriodKey` (de `period.ts`), `SalesImpactGranularity`.
- Produces: `function periodToGranularity(period: PeriodKey): SalesImpactGranularity` según la tabla de Global Constraints.

- [ ] **Step 1: Write the failing test:** `periodToGranularity` devuelve `day` para `1m`; `week` para `3m` y `6m`; `month` para `12m` y `24m`; `year` para `all`.
- [ ] **Step 2: Run** `npm run test -- features/inventory/analytics/__tests__/period.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `periodToGranularity` y ampliar el tipo.
- [ ] **Step 4: Run** el test y `npm run type-check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): granularidad automática según el período`.

### Task 3: Registro de tabs de 8 ids

**Files:**
- Modify: `frontend/features/inventory/analytics/productAnalyticsRegistry.ts` (`ProductAnalyticsTabId`, `TAB_ORDER`, `TAB_RULES`)
- Test: `frontend/features/inventory/analytics/__tests__/productAnalyticsRegistry.test.ts` (reescribir las pruebas de `visibleTabIds`; las de `overviewKpiIds` quedan)

**Interfaces:**
- Produces: `type ProductAnalyticsTabId = "overview" | "sales" | "pricing" | "costs" | "procurement" | "inventory" | "production" | "subscription"`; `visibleTabIds(capabilities: ProductCapabilities | null | undefined): ProductAnalyticsTabId[]` con las reglas de Global Constraints. Con capacidades `null` o `undefined` devuelve los 8 ids en orden (comportamiento actual de "respuesta antigua").

- [ ] **Step 1: Write the failing tests** una por fila de la tabla "Resultado por caso" del spec de planificación: almacenable con stock que vende y compra → `["overview","sales","pricing","costs","procurement","inventory"]`; almacenable con stock solo vende → `["overview","sales","pricing","costs","inventory"]`; insumo con stock y componente → `["overview","costs","procurement","inventory","production"]`; reventa sin stock → `["overview","sales","pricing","costs","procurement"]`; consumible que solo compra → `["overview","costs","procurement"]`; fabricable express que vende → `["overview","sales","pricing","costs","production"]`; fabricable con stock → suma `inventory` antes de `production`; servicio que vende → `["overview","sales","pricing"]`; servicio que compra y vende → suma `costs` y `procurement`; suscripción que no vende → `["overview","subscription"]`; producto sin flags → `["overview"]`; sin capacidades → los 8.
- [ ] **Step 2: Run** `npm run test -- features/inventory/analytics/__tests__/productAnalyticsRegistry.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** los ids nuevos, el orden y las reglas.
- [ ] **Step 4: Run** el test. Expected: PASS (el type-check del modal fallará hasta la Tarea 6; esperado).
- [ ] **Step 5: Commit** `refactor(inventory): registro de tabs de análisis con 8 tabs por decisión`.

### Task 4: Zona Vista del riel (portal de controles)

**Files:**
- Create: `frontend/features/inventory/analytics/RailControls.tsx` (contexto, `RailControlsProvider`, `ViewControlsSlot`, `RailControls`) y `frontend/features/inventory/analytics/ViewControl.tsx`
- Test: `frontend/features/inventory/analytics/__tests__/RailControls.test.tsx`, `ViewControl.test.tsx`

**Interfaces:**
- Produces: `RailControlsProvider({ children })`; `ViewControlsSlot()` (se registra en el contexto, muestra el título "Vista" solo si tiene contenido); `RailControls({ children })` renderiza sus hijos con `createPortal` en cada slot registrado y, si no hay proveedor o no hay slots, los renderiza en línea; `ViewControl<T extends string | number>(props: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (value: T) => void }): JSX.Element` (el control de grupo de opciones `ToggleGroup` que hoy está duplicado en los bloques, ignorando el valor vacío de Radix).

- [ ] **Step 1: Write the failing tests:** con proveedor y un slot, los hijos de `RailControls` aparecen dentro del slot y no en línea; con dos slots aparecen en ambos; sin proveedor aparecen en línea; al desmontar `RailControls` desaparecen del slot; el título "Vista" no se muestra con el slot vacío; `ViewControl` marca la opción activa, llama `onChange` con el valor tipado y no llama al pulsar la opción activa.
- [ ] **Step 2: Run** `npm run test -- features/inventory/analytics/__tests__/RailControls.test.tsx features/inventory/analytics/__tests__/ViewControl.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** según las firmas. Registro de slots con estado (`useState<HTMLElement[]>` y callback ref); `ViewControl` toma el formato visual de los `Control` actuales (título `text-3xs` uppercase, `ToggleGroup` `size="sm"`, `data-[state=on]:bg-primary`).
- [ ] **Step 4: Run** los tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): zona Vista del riel para controles contextuales`.

### Task 5: Bloques usan la zona Vista y granularidad automática

**Files:**
- Modify: `analytics/SalesImpactBlock.tsx`, `analytics/OperationsBlock.tsx`, `analytics/SourcingBlock.tsx` y sus tests en `analytics/__tests__/`
- Modify (solo `SourcingBlock`): nueva prop `section`

**Interfaces:**
- Consumes: `RailControls`, `ViewControl` (Tarea 4); `periodToGranularity` (Tarea 2).
- Produces: `SalesImpactBlock({ productId, period })` sin el control "Por" ni estado de granularidad: envía `granularity: periodToGranularity(period)`; sus controles Métrica y Agrupar por van dentro de `<RailControls>`. `OperationsBlock`: el control "Stock inmóvil desde" va en `<RailControls>`. `SourcingBlock({ productId, period, section?: "make_vs_buy" | "used_in" })`: con `section` renderiza solo esa parte, y el control "Subida de precio del insumo" va en `<RailControls>` solo cuando se renderiza `used_in`; el vacío con `section` solo cuenta esa parte.

- [ ] **Step 1: Write/adjust failing tests:** `SalesImpactBlock` no renderiza el grupo "Por" y llama al hook con `granularity: "week"` para `3m`, `"year"` para `all`; los controles Métrica y Agrupar por siguen operativos (los tests existentes que los accionan deben seguir pasando); `SourcingBlock` con `section="make_vs_buy"` no muestra "Uso como insumo" ni el control de subida y con `section="used_in"` no muestra "Fabricar vs comprar"; con `section` y datos de la otra parte solamente muestra el estado vacío.
- [ ] **Step 2: Run** `npm run test -- features/inventory/analytics`. Expected: FAIL.
- [ ] **Step 3: Implement** el cambio; reemplazar los `ControlGroup`/`Control` locales por `ViewControl` y eliminar `GRANULARITIES` del bloque de ventas.
- [ ] **Step 4: Run** `npm run test -- features/inventory/analytics`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor(inventory): controles de bloques en la zona Vista y granularidad automática`.

### Task 6: Modal con 8 tabs y contenido transitorio apilado

**Files:**
- Create: `frontend/features/inventory/analytics/TabContent.tsx`
- Modify: `frontend/features/inventory/components/ProductAnalyticsModal.tsx`
- Test: `frontend/features/inventory/analytics/__tests__/TabContent.test.tsx`; actualizar `frontend/features/inventory/components/__tests__/ProductAnalyticsModal.test.tsx`

**Interfaces:**
- Consumes: `ProductAnalyticsTabId`, `visibleTabIds` (Tarea 3); `RailControlsProvider`, `ViewControlsSlot` (Tarea 4); `LegacyInsightsPanel`, `LegacyTabId`; los cuatro bloques (Tarea 5).
- Produces: `TabContent(props: { tab: ProductAnalyticsTabId; productId: number; period: PeriodKey; capabilities: ProductCapabilities; onOpenTransaction: (id: number | string, type: string) => void; onOpenWorkOrder: (id: number) => void }): JSX.Element` que apila, por tab: `overview` → panel legado `overview`; `sales` → legado `sales` y `customers`; `pricing` → `SalesImpactBlock` y legado `price`; `costs` → legado `cost` y `SourcingBlock section="make_vs_buy"` si `manufactures && buys`; `procurement` → legado `purchases` y `suppliers`; `inventory` → legado `kardex` y `OperationsBlock`; `production` → legado `production`, `ProductionPerformanceBlock` si `manufactures` y `SourcingBlock section="used_in"` si `used_in_production`; `subscription` → `OperationsBlock`. Función auxiliar `tabHasLegacyContent(tab: ProductAnalyticsTabId): boolean` (verdadero salvo en `subscription`, que solo usa bloques nuevos). El modal usa `TABS` con las etiquetas e íconos nuevos (`Repeat` para Suscripción, `Package` para Inventario), envuelve el contenido en `RailControlsProvider`, pone `<ViewControlsSlot />` bajo `<PeriodControl />` en el slot `bottom` del riel (y en la copia móvil) y muestra el aviso "Este tab muestra todo el histórico" cuando `tabHasLegacyContent(activeTab)` y el período no es `all`.

- [ ] **Step 1: Write the failing tests** (`TabContent.test.tsx`, con los bloques y el panel legado mockeados): cada tab renderiza exactamente los componentes listados; `costs` sin `buys` no renderiza `SourcingBlock`; un producto fabricable que compra y es componente muestra `make_vs_buy` en `costs` y `used_in` en `production`, y no al revés (Review Focus 5). En el modal: los tabs visibles de un almacenable con stock que vende y compra son los seis esperados; un producto sin flags muestra solo Resumen; cambiar de Precio y margen a Ventas retira del riel los controles de Métrica y Agrupar por (Review Focus 4); el aviso aparece en `sales` con período `3m` y no en `subscription`.
- [ ] **Step 2: Run** `npm run test -- features/inventory/analytics/__tests__/TabContent.test.tsx features/inventory/components/__tests__/ProductAnalyticsModal.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `TabContent`, `tabHasLegacyContent` y los cambios del modal.
- [ ] **Step 4: Run** `npm run test -- features/inventory`, `npm run type-check` y `npm run lint`. Expected: PASS, sin errores.
- [ ] **Step 5: Commit** `feat(inventory): análisis de producto con 8 tabs por decisión`.

### Task 7: ADR y verificación final

**Files:**
- Modify: `docs/10-architecture/adr/0150-analisis-de-producto-por-bloque-y-periodo.md` (sección Decisión y Consecuencias: tabs, zona Vista, granularidad automática, `week`)
- Modify: `docs/20-contracts/api-contracts.md` si documenta los valores de `granularity` de `sales-impact`

- [ ] **Step 1: Update** el ADR y el contrato (buscar con `grep -rn "granularity" docs/20-contracts`).
- [ ] **Step 2: Run** `npm run type-check`, `npm run lint`, `npm run test -- features/inventory` y `pytest backend/inventory`. Expected: sin errores y todo en verde.
- [ ] **Step 3: Verificación visual** en el servidor de desarrollo con un producto almacenable, uno fabricable y una suscripción: 8 tabs según el caso, controles en el pie del riel y cambio de granularidad con el período. Si no hay navegador disponible, decirlo en el reporte.
- [ ] **Step 4: Commit** `docs(adr): 0150 actualizado con los 8 tabs y la zona Vista`.

## Self-review

- **Cobertura del spec:** 8 tabs y reglas (T3, T6), absorbidos como contenido transitorio (T6), controles a la zona Vista (T4, T5), granularidad automática (T1, T2, T5), ADR (T7). Contenido definitivo de cada tab queda en los planes por tab, por diseño.
- **Consistencia de tipos:** `ProductAnalyticsTabId`, `periodToGranularity`, `RailControls`, `ViewControl` y la prop `section` se usan con las mismas firmas en T3 a T6.
- **Riesgo conocido:** hasta migrar cada tab, el contenido apilado puede verse repetitivo; es transitorio y cada plan por tab lo reemplaza.
