# Product Analytics: Fundación del rediseño — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar lista la infraestructura compartida del rediseño del modal de análisis de producto (período único en el riel, capacidades sin `insights`, segmento interno, skeleton uniforme, bloques con período), sin rediseñar aún el contenido de cada tab.

**Architecture:** El modal guarda un `PeriodKey` y lo pasa a bloques que cargan lazy con su propio endpoint y `SkeletonShell`. Los nueve tabs que aún dependen del endpoint monolítico `insights` se aíslan en un `LegacyInsightsPanel` que solo carga al activarse; cada plan posterior de tab extrae uno de ahí a su propio bloque. Las capacidades vienen de un endpoint liviano.

**Tech Stack:** Next.js 16 / React / TanStack Query / Vitest (frontend); Django 5 + DRF / pytest (backend).

**Spec:** `docs/superpowers/specs/2026-11-20-product-analytics-redesign-design.md`

## Alcance de este plan

Cubre solo la fundación. **No** cubre el rediseño del contenido de cada tab ni los nueve endpoints por tab nuevos: se acordó afinar cada tab por separado, con un plan por tab. Cada plan por tab (a) crea su endpoint y bloque, (b) lo quita del `LegacyInsightsPanel`, (c) compone según segmento.

## Global Constraints

- Períodos: `1m`, `3m`, `6m`, `12m`, `24m`, `all` (Histórico). `all` omite `date_from`.
- El segmento no se muestra en la UI (`SEGMENT_LABELS` se elimina); `ProductSegment` y `capabilities.segment` siguen existiendo.
- El control de período va en el slot `bottom` de `RailNav`; en móvil (`< sm`) se replica sobre el contenido (patrón de `AnalyticsPanel`).
- Carga de datos con `SkeletonShell`; sin textos "Cargando…".
- Cero `any`; tokens semánticos; hooks de feature para `useQuery`; barrels; vistas Django ≤ 20 líneas; cero N+1; Views con lógica en selectors.
- Frontend: `npm run type-check` y `npm run lint` sin errores. Tests con Node 24 (nvm). Backend: `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest` desde `backend/`.
- El árbol de trabajo tiene cambios ajenos (`ProductDrawer.tsx`, `product/ProductInventoryTab.tsx` y su test): no tocarlos ni incluirlos en commits.

## Review Focus

1. Producto sin ventas ni compras con período `all`: los bloques muestran estado vacío, no error.
2. Cambio de producto con el tab activo inexistente en el nuevo producto: vuelve a Resumen sin parpadeo de datos del producto anterior.
3. Cambio de período mientras un bloque carga: el skeleton aparece y no se mezclan datos de dos períodos (`keepPreviousData` no debe mostrar datos viejos como si fueran del período nuevo).
4. `date_from` en fin de mes (31 de marzo menos 1 mes): se ajusta al último día del mes destino.
5. Producto sin capacidades todavía cargadas: no se muestran tabs ni se dispara ninguna consulta de bloque.

---

### Task 1: Modelo de período

**Files:**
- Create: `frontend/features/inventory/analytics/period.ts`
- Test: `frontend/features/inventory/analytics/__tests__/period.test.ts`

**Interfaces:**
- Consumes: `monthsAgoIso(months: number, today?: Date): string` de `./monthsAgoIso`.
- Produces: `type PeriodKey = "1m" | "3m" | "6m" | "12m" | "24m" | "all"`; `const DEFAULT_PERIOD: PeriodKey` (`"12m"`); `const PERIOD_OPTIONS: ReadonlyArray<{ value: PeriodKey; label: string }>` con etiquetas `1 m`, `3 m`, `6 m`, `12 m`, `24 m`, `Histórico`; `function periodToDateFrom(period: PeriodKey, today?: Date): string | undefined`.

- [ ] **Step 1: Write the failing tests** `period.test.ts`: `periodToDateFrom("all")` es `undefined`; `periodToDateFrom("3m", new Date(2026, 10, 20))` es `"2026-08-20"`; `periodToDateFrom("1m", new Date(2026, 2, 31))` es `"2026-02-28"`; `periodToDateFrom("24m", new Date(2026, 10, 20))` es `"2024-11-20"`; `PERIOD_OPTIONS.map(o => o.value)` es `["1m","3m","6m","12m","24m","all"]` y el último label es `"Histórico"`.
- [ ] **Step 2: Run** `npm run test -- features/inventory/analytics/__tests__/period.test.ts` desde `frontend/`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** `period.ts` con las firmas anteriores; los meses salen de la clave (`parseInt`) y se delega en `monthsAgoIso`.
- [ ] **Step 4: Run** el mismo test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): modelo de período del análisis de producto`.

### Task 2: Control de período

**Files:**
- Create: `frontend/features/inventory/analytics/PeriodControl.tsx`
- Test: `frontend/features/inventory/analytics/__tests__/PeriodControl.test.tsx`

**Interfaces:**
- Consumes: `PeriodKey`, `PERIOD_OPTIONS` (Task 1); `ToggleGroup`/`ToggleGroupItem` de `@/components/ui/toggle-group`.
- Produces: `function PeriodControl(props: { value: PeriodKey; onChange: (value: PeriodKey) => void }): JSX.Element` con el mismo formato visual que `GranularityControl` (título "Período" en `text-3xs` uppercase, `ToggleGroup` `type="single"`, `flex-wrap`, items `size="sm"` con `data-[state=on]:bg-primary`). Ignora el valor vacío que Radix emite al pulsar el item activo.

- [ ] **Step 1: Write the failing tests:** renderiza seis botones con las etiquetas de `PERIOD_OPTIONS`; el activo tiene `data-state="on"`; clic en "6 m" llama `onChange("6m")`; clic en el botón ya activo no llama `onChange`.
- [ ] **Step 2: Run** `npm run test -- features/inventory/analytics/__tests__/PeriodControl.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `PeriodControl` según la firma.
- [ ] **Step 4: Run** el test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): control de período para el análisis de producto`.

### Task 3: Endpoint y hook de capacidades

**Files:**
- Modify: `backend/inventory/views.py` (nueva acción junto a `insights`, ~línea 200)
- Test: `backend/inventory/tests/test_product_capabilities.py` (agregar)
- Modify: `frontend/features/inventory/api/inventoryApi.ts`, `frontend/features/inventory/hooks/useProducts.ts`
- Test: `frontend/features/inventory/hooks/__tests__/useProductCapabilities.test.tsx` (crear)

**Interfaces:**
- Consumes: `ProductSelector.get_capabilities(product) -> dict`; `ProductCapabilities` de `analytics/productAnalyticsRegistry`.
- Produces: `GET /inventory/products/{id}/capabilities/` → mismo dict que `get_capabilities`; `inventoryApi.getProductCapabilities(id: number): Promise<ProductCapabilities>`; `useProductCapabilities(id: number | null | undefined): { capabilities: ProductCapabilities | null; isLoading: boolean; isError: boolean }` (`staleTime.stable`, `enabled: !!id`, clave `[...PRODUCTS_KEYS.detail(id), "capabilities"]`).

- [ ] **Step 1: Write the failing backend test** en el estilo del archivo: `GET .../capabilities/` de un producto almacenable devuelve 200 con `segment == "STORABLE"` y `tracks_stock is True`; con usuario sin permiso de lectura de productos devuelve el mismo código que `insights` (copiar la aserción de permisos de `insights` si existe; si no, 200 solo para autenticado).
- [ ] **Step 2: Run** `pytest backend/inventory/tests/test_product_capabilities.py -v` desde la raíz con el entorno local. Expected: FAIL (404).
- [ ] **Step 3: Implement** `capabilities(self, request, pk=None)` con `@action(detail=True, methods=["get"])`: `return Response(ProductSelector.get_capabilities(self.get_object()))`. Misma clase de permisos que `insights`.
- [ ] **Step 4: Run** el test. Expected: PASS.
- [ ] **Step 5: Write the failing frontend test** del hook: mockea `inventoryApi.getProductCapabilities`; con id `5` devuelve las capacidades; con `null` no llama a la API.
- [ ] **Step 6: Implement** el método de API y el hook; exportar el hook desde el barrel de hooks si los demás lo están.
- [ ] **Step 7: Run** `npm run test -- features/inventory/hooks/__tests__/useProductCapabilities.test.tsx`. Expected: PASS.
- [ ] **Step 8: Commit** `feat(inventory): endpoint y hook de capacidades de producto`.

### Task 4: Marco de bloque con skeleton

**Files:**
- Create: `frontend/features/inventory/analytics/AnalyticsBlockFrame.tsx`
- Test: `frontend/features/inventory/analytics/__tests__/AnalyticsBlockFrame.test.tsx`

**Interfaces:**
- Consumes: `SkeletonShell` de `@/components/shared`.
- Produces: `function AnalyticsBlockFrame(props: { isLoading: boolean; isError: boolean; errorMessage: string; isEmpty: boolean; emptyMessage: string; skeleton: ReactNode; children: ReactNode }): JSX.Element`. Prioridad: `isLoading` → `<SkeletonShell isLoading ariaLabel=...>{skeleton}</SkeletonShell>`; luego `isError` → `<p role="alert" className="text-sm text-destructive">`; luego `isEmpty` → `<p className="text-sm text-muted-foreground italic">`; si no, `children`. `skeleton` es el bloque real con datos placeholder (convención de `SkeletonShell`).

- [ ] **Step 1: Write the failing tests:** loading muestra `[data-skeleton-shell]` y no los children; error muestra el role `alert` con el mensaje; empty muestra el mensaje; datos muestra children; loading tiene prioridad sobre error.
- [ ] **Step 2: Run** el test. Expected: FAIL.
- [ ] **Step 3: Implement** según la firma.
- [ ] **Step 4: Run** el test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): marco de bloque de análisis con skeleton`.

### Task 5: Bloques existentes usan período y marco

Cuatro bloques con el mismo patrón: `SalesImpactBlock`, `ProductionPerformanceBlock`, `SourcingBlock`, `OperationsBlock` (todos en `frontend/features/inventory/analytics/`). Los cuatro endpoints ya aceptan `date_from` opcional (verificado), así que `all` funciona sin cambios de backend.

**Files:**
- Modify: los cuatro `*Block.tsx` y sus tests en `analytics/__tests__/` (existen `SalesImpactBlock`, `ProductionPerformanceBlock`, `OperationsBlock`; crear `SourcingBlock.test.tsx`).
- Modify (si el hook es genérico en `keepPreviousData`): `hooks/useProductSalesImpact.ts`, `useProductProductionPerformance.ts`, `useProductSourcing.ts`, `useProductOperations.ts`.

**Interfaces:**
- Consumes: `PeriodKey`, `periodToDateFrom` (Task 1); `AnalyticsBlockFrame` (Task 4).
- Produces: cada bloque con props `{ productId: number; period: PeriodKey }`. El selector local de rango (`RANGES`, `Control`/`ControlGroup`) se elimina; los otros controles (métrica, agrupar, granularidad, subida de precio, umbral de stock inmóvil) se quedan. `date_from` sale de `periodToDateFrom(period)`; con `all` no se envía la clave.

- [ ] **Step 1: Write/adjust failing tests** por bloque: al renderizar con `period="all"` el hook se llama con params sin `date_from`; con `period="3m"` con la fecha esperada (mock de fecha con `vi.setSystemTime`); estado de carga muestra `[data-skeleton-shell]`; estado de error muestra el mensaje existente; no existe el grupo "Rango".
- [ ] **Step 2: Run** `npm run test -- features/inventory/analytics`. Expected: FAIL.
- [ ] **Step 3: Implement** el cambio de props, quitar el rango local y envolver el cuerpo en `AnalyticsBlockFrame`. El `skeleton` es el mismo layout del bloque con datos vacíos o de ejemplo (sin texto de carga).
- [ ] **Step 4: Fix de caché** (Review Focus 3): en los cuatro hooks, `placeholderData: keepPreviousData` solo conserva datos cuando cambian los parámetros de filtros finos del bloque; cuando cambia el período debe mostrarse el skeleton. Resolver con `placeholderData: (prev, prevQuery) => prevQuery?.queryKey[prevQuery.queryKey.length - 1]?.date_from === params.date_from ? prev : undefined`, con un test del hook que lo ejercita.
- [ ] **Step 5: Run** `npm run test -- features/inventory/analytics features/inventory/hooks`. Expected: PASS.
- [ ] **Step 6: Commit** `refactor(inventory): bloques de análisis reciben período y usan SkeletonShell`.

### Task 6: Aislar los tabs legados en `LegacyInsightsPanel`

**Files:**
- Create: `frontend/features/inventory/analytics/LegacyInsightsPanel.tsx`
- Create: `frontend/features/inventory/analytics/legacyTabs.ts`
- Modify: `frontend/features/inventory/components/ProductAnalyticsModal.tsx` (mover desde ahí)
- Test: `frontend/features/inventory/analytics/__tests__/LegacyInsightsPanel.test.tsx`; mantener `components/__tests__/ProductAnalyticsModal.test.tsx` en verde

**Interfaces:**
- Consumes: `useProductInsights<T>` y `useProduct` (`../hooks/useProducts`); `AnalyticsBlockFrame` (Task 4); `Collection`/`useEntityCollection` y entidades de `../entity-view/*` existentes.
- Produces: `const LEGACY_TAB_IDS = ["overview","sales","purchases","price","cost","kardex","production","customers","suppliers"] as const` y `type LegacyTabId` en `legacyTabs.ts`; `function LegacyInsightsPanel(props: { productId: number; tab: LegacyTabId; capabilities: ProductCapabilities; onOpenTransaction: (id: number | string, type: string) => void; onOpenWorkOrder: (id: number) => void }): JSX.Element`. El panel llama `useProductInsights`/`useProduct` él mismo (solo existe montado mientras su tab está activo) y renderiza únicamente el contenido de `tab`, con el JSX actual de ese tab (movido sin cambiar contenido ni layout). Mover también los `useMemo` derivados, el `SplitTabLayout` y `EmptyChart`.

- [ ] **Step 1: Write the failing test:** renderizar el panel con `tab="sales"` muestra "Total Ingresos" y no "Costo Actual"; con insights en carga muestra `[data-skeleton-shell]`; con `tab="kardex"` pagina `useStockMoves` (mock) y renderiza "Total Entradas".
- [ ] **Step 2: Run** el test. Expected: FAIL.
- [ ] **Step 3: Implement** moviendo el código de `ProductAnalyticsPanelInner` (líneas ~182–392 y los bloques de tab) a `LegacyInsightsPanel`, un `switch (tab)` por contenido. No cambiar textos ni layouts.
- [ ] **Step 4: Run** `npm run test -- features/inventory/analytics/__tests__/LegacyInsightsPanel.test.tsx features/inventory/components/__tests__/ProductAnalyticsModal.test.tsx`. Expected: PASS (ajustar el test del modal solo en lo estructural).
- [ ] **Step 5: Commit** `refactor(inventory): aísla los tabs de insights legado en LegacyInsightsPanel`.

### Task 7: Modal con período, capacidades y segmento interno

**Files:**
- Modify: `frontend/features/inventory/components/ProductAnalyticsModal.tsx`
- Modify: `frontend/features/inventory/analytics/productAnalyticsRegistry.ts` (eliminar `SEGMENT_LABELS`)
- Modify: `analytics/__tests__/productAnalyticsRegistry.test.ts` (quitar la prueba de etiquetas)
- Test: `components/__tests__/ProductAnalyticsModal.test.tsx`

**Interfaces:**
- Consumes: `useProductCapabilities` (Task 3); `PeriodControl`, `PeriodKey`, `DEFAULT_PERIOD` (Tasks 1–2); `LegacyInsightsPanel`, `LEGACY_TAB_IDS` (Task 6); los cuatro bloques con `period` (Task 5); `RailNav` con `bottom`.
- Produces: modal que mantiene `useState<PeriodKey>(DEFAULT_PERIOD)`, lo pasa a los bloques, y renderiza: bloque nuevo si el tab es `pricing | manufacturing | sourcing | operations`; `LegacyInsightsPanel` si el tab está en `LEGACY_TAB_IDS`. No renderiza nada de tab hasta tener capacidades (Review Focus 5). Muestra un aviso discreto "Este tab muestra todo el histórico" (texto en `text-xs text-muted-foreground`, sobre el contenido) en los tabs legados cuando el período ≠ `all`. El aviso se elimina tab por tab en los planes siguientes.

- [ ] **Step 1: Write the failing tests:** no aparece ningún texto de segmento ("Servicio", "Almacenable", etc.) para un producto servicio ni almacenable; el control de período está en el riel (`getByRole("group", { name: "Período" })` dentro de la navegación de secciones) y cambia el `date_from` pasado al bloque activo; sin capacidades cargadas no hay tabs ni consultas de bloque; cambio de `productId` a uno sin el tab activo vuelve a Resumen; el aviso de histórico aparece en un tab legado con período `3m` y no con `all`.
- [ ] **Step 2: Run** `npm run test -- features/inventory/components/__tests__/ProductAnalyticsModal.test.tsx features/inventory/analytics/__tests__/productAnalyticsRegistry.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** los cambios. Slot `top` del riel: solo identidad del producto (selector o nombre). Slot `bottom`: `<PeriodControl>`. Copia móvil sobre el contenido con `sm:hidden`. Quitar `segmentLabel`, `SEGMENT_LABELS` y la carga de `useProductInsights`/`useProduct` del panel externo (ahora viven en el panel legado y en los bloques).
- [ ] **Step 4: Run** los tests anteriores. Expected: PASS.
- [ ] **Step 5: Commit** `feat(inventory): período en el riel y segmento interno en el análisis de producto`.

### Task 8: ADR, contratos y verificación final

**Files:**
- Create: `docs/10-architecture/adr/0150-analisis-de-producto-por-bloque-y-periodo.md`
- Modify: `docs/10-architecture/adr/README.md` (fila 0150 tras la 0149)
- Modify: contratos de `docs/20-contracts/` que mencionen el modal o `insights` (buscar con `grep -rn "ProductAnalytics\|insights" docs/20-contracts`)

**Interfaces:**
- Consumes: spec del rediseño.
- Produces: ADR `Accepted` con contexto, decisión (bloque por tab con endpoint propio, período único con seis opciones, capacidades separadas, segmento interno, layout por composición), consecuencias y la migración por tab pendiente.

- [ ] **Step 1: Write** el ADR con el formato del README de ADRs (front-matter `id`, `title`, `status`, `date`).
- [ ] **Step 2: Update** README de ADRs y contratos afectados.
- [ ] **Step 3: Run** `npm run type-check`, `npm run lint` (frontend) y `ruff check backend`. Expected: sin errores.
- [ ] **Step 4: Run** `npm run test -- features/inventory` y `pytest backend/inventory -v` con el entorno local. Expected: PASS.
- [ ] **Step 5: Verificación visual** en el servidor de desarrollo: abrir el modal para un producto fabricable, uno almacenable y un servicio; confirmar período en el pie del riel, ausencia del segmento, skeleton al cambiar de período. Si no se puede abrir un navegador, decirlo explícitamente al reportar.
- [ ] **Step 6: Commit** `docs(adr): 0150 análisis de producto por bloque y período`.

## Self-review

- **Cobertura del spec:** segmento interno (T7), período con seis opciones en el riel (T1, T2, T7), bloque por tab con endpoint propio (parcial: cuatro existentes en T5, resto en planes por tab; el aislamiento de T6 lo prepara), `SkeletonShell` (T4–T6), capacidades separadas (T3), ADR (T8). Piezas compartidas de layout (KPI protagonista, tendencia, ranking, alerta) y composición por segmento quedan en los planes por tab, que es donde se definen sus datos.
- **Consistencia de tipos:** `PeriodKey`, `periodToDateFrom`, `AnalyticsBlockFrame`, `LegacyTabId` y `ProductCapabilities` se usan con las mismas firmas en T5–T7.
- **Riesgo conocido:** hasta migrar los nueve tabs legados, el período no aplica a ellos; el aviso de T7 lo hace explícito.
