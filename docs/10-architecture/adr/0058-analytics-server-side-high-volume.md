# ADR 0058: Panel analytics con agregación servidor para entidades de alto volumen

## Estado

Aceptado

## Contexto

El `AnalyticsPanelContent` de `DataTableView` (contrato en
`component-datatable-views.md` §12) se alimenta de hooks cliente que
descargan la lista completa de la entidad y agregan en el navegador
(`useSalesAnalyticsData`, `usePurchasingAnalyticsData`,
`usePayrollAnalyticsData`, `usePartnerAnalyticsData`,
`useUnbilledAnalyticsData`).

Ese enfoque funciona cuando el conjunto es pequeño (órdenes de venta,
pagos de nómina), pero es inviable para entidades de **alto volumen**:
`inventory.stockmove` (Kardex), `treasury.treasurymovement` e
`billing.invoice` acumulan cientos de miles de filas. Descaragar todo al
navegador para agregar `Sum(quantity × unit_cost)` en JS degrada la
experiencia, satura la red y paga impuestos de serialización que la DB ya
resolvió.

`treasury.creditcardstatement` ya había resuelto esto con un servicio
backend (`CardAnalyticsService`) expuesto como `GET
/treasury/card-statements/analytics/`.

## Decisión

El **patrón servidor** es el canónico para entidades de alto volumen:
backend agrega en DB, el frontend solo consume shape chart-ready.

1. **Servicio de lectura** en `backend/{app}/analytics.py`
   (`{Entity}AnalyticsService`) con métodos por dimensión y un
   `get_consolidated(...)` que devuelve todo en una respuesta. Sin acceso
   al serializador — respuestas son dicts planos.
2. **`@action(detail=False)` `analytics`** en el `ViewSet` → `GET
   /api/{app}/{resource}/analytics/?granularity=&months=&<filters>`.
   Respeta los filtros del unified search (producto, ubicaciones, rango
   de fechas).
3. **Hook tipado** `features/{app}/hooks/use{Entity}Analytics.ts` —
   `useQuery` con key explícita y `staleTime: 5min`; `useMemo` que
   convierte el response a shapes de chart (`assignChartColors`,
   `formatMonth`). Sin `any`.
4. **Registry**: `ENTITY_REGISTRY[...].viewPolicy.availableViews` incluye
   `'analytics'`.
5. **Vista**: el `*ClientView` pasa `analyticsPanel` (tabs declarativos)
   a `DataTableView`.
6. **Tests**: suite en `backend/{app}/tests/test_analytics.py` (shape del
   endpoint, clasificaciones, granularidades, filtros, auth).

### Clasificación de dirección en DB (stockmove)

Regla replicada de `selectors.py` con `Case/When` en `_direction_annotation`
(prioridad: TRANSFER > ADJUSTMENT > IN > OUT > OTHER):

| Dirección | Condición |
|-----------|-----------|
| TRANSFER | source y destination son `INTERNAL` |
| ADJUSTMENT | source o destination es ubicación virtual de ajuste (`Ajuste por Merma/Pérdida`, `Ajuste por Sobrante/Ganancia`, `Revalorización`) |
| IN | destination es `INTERNAL` |
| OUT | source es `INTERNAL` |
| OTHER | resto |

La valorización agrega `Sum(F("quantity") * F("unit_cost"))` vía
`ExpressionWrapper` y las granularidades usan `TruncDay/Month/Year`
(ventana por defecto `months=12`).

## Consecuencias

### Positivas
- **Payloads pequeños**: el navegador recibe agregados, no filas crudas.
- **Agregación correcta en DB**: joins, filtros y agrupamiento donde viven
  los datos.
- **Filtros compartidos**: el panel responde al unified search del listado
  sin duplicar lógica.

### Negativas
- **Dos implementaciones del panel**: el patrón cliente sigue para
  entidades de bajo volumen; el servidor para alto volumen. El ADR define
  cuándo usar cada uno.
- **Coste de mantenimiento backend**: cada dimensión requiere método +
  test en el servicio.

### Implementación inicial

`inventory.stockmove` (Kardex) — `StockMoveAnalyticsService` en
`backend/inventory/analytics.py`, endpoint `GET /api/inventory/moves/analytics/`,
3 tabs (Flujo, Productos, Bodegas).

### Segunda implementación: treasury.treasurymovement

`TreasuryMovementAnalyticsService` en `backend/treasury/analytics.py`,
endpoint `GET /api/treasury/movements/analytics/`, 4 tabs (Flujo, Cuentas,
Métodos de Pago, Tipos). Decisiones:

- **Dirección** derivada de `movement_type` vía `_direction_annotation`
  (`CREDIT_LINE_REPAY`→Ingresos, `CREDIT_LINE_DRAW`→Egresos, además de
  `INBOUND`/`OUTBOUND`; `TRANSFER` y `ADJUSTMENT` son dimensiones propias).
- **Movimientos `CANCELLED` excluidos** de todos los agregados.
- **Cuenta principal** del movimiento vía `_account_expression`
  (favorece `to_account` en ingresos, `from_account` en egresos,
  `Coalesce` para ajustes).
- **Cantidad = nº de transacciones** (`count`), nunca unidades.
- **Colores de serie** consistentes con Kardex: `chartColor(0)` cyan
  (Ingresos), `chartColor(1)` magenta (Egresos).

### Tercera implementación: inventory.product

`ProductAnalyticsService` en `backend/inventory/product_analytics.py`,
endpoint `GET /api/inventory/products/analytics/`, 3 tabs (Resumen, Ventas,
Compras). Decisiones:

- **Sin granularidad**: los productos no tienen dimensión temporal; el panel
  omite `granularity`/`onGranularityChange` (opcional en el contrato
  `AnalyticsPanelConfig.screen`).
- **Snapshot de stock**: valorización `Sum(Stock.quantity) × cost_price` vía
  `_stock_value_expression`; solo participan productos con
  `track_inventory=True` (servicios excluidos).
- **Catálogo filtra `parent_template__isnull`** (excluye variantes por
  defecto). **Agotados** = stock ≤ 0 (no existe campo `min_stock`).
- **`is_active`**: default `True` (solo activos); `"all"` incluye archivados
  y `"false"` solo archivados.
- **Buckets de precio** en `PRICE_RANGES` (6 rangos) aplicados con
  `Case/When`; `get_consolidated(price_field="sale"|"cost")` elige el campo
  (`sale_price` para el rango de venta, `cost_price` para el de compra).
- **Disponibilidad** = combinaciones `can_be_sold` × `can_be_purchased`
  (4 buckets: Venta y compra / Solo venta / Solo compra / Sin disponibilidad).
- **Tabs Ventas/Compras**: el frontend llama al endpoint con
  `can_be_sold=true` / `can_be_purchased=true` (+ `price_field`), reutilizando
  el mismo servicio; el KPI es `summary.total_products` del conjunto filtrado.
- **Clasificaciones por catálogo (tipos, disponibilidad, categorías, rangos)
  se calculan sin join a stock**.
- **Filtros del listado respetados**: search, categoría, tipo, venta/compra,
  activo/archivado. El tab Stock (valor por categoría/tipo, top productos) fue
  eliminado en favor de Resumen/Ventas/Compras; `get_stock_summary` conserva
  los KPIs de stock usados en Resumen.

Candidato restante: `billing.invoice`.
