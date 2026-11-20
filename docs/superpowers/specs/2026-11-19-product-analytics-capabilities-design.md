# Hub de analítica por producto — Fase 2: esqueleto por capacidades

## Intención y por qué
Parte del diseño general `2026-11-19-product-analytics-hub-design.md`. Hoy `ProductAnalyticsModal` muestra los mismos 9 tabs para cualquier producto, aunque no apliquen (un insumo no vendible ve tabs de ventas vacíos). La Fase 2 hace que los tabs y los KPIs dependan de las capacidades del producto, sin crear todavía bloques financieros nuevos (Fase 3).

## Goals
- El backend calcula las capacidades del producto y las incluye en el payload de `insights`.
- El frontend decide qué tabs y qué KPIs del Resumen se muestran a partir de un registro único y puro (testeable).
- El riel muestra la etiqueta del segmento del producto.
- Los KPIs y el gráfico de movimientos de stock dejan de depender de una lista truncada a 100 movimientos.

## Non-goals
- No agregar bloques financieros nuevos (margen real, impacto de reglas, BOM vs costo real, fabricar vs comprar): Fase 3.
- No cambiar el endpoint de movimientos de stock (`/inventory/stock-moves/`, ya paginado); la tabla del tab "Mov. Stock" ya lo usa.
- No tocar Fase 1 (captura de reglas).

## Hallazgo que ajusta el alcance
El diseño original decía "kardex paginado en un endpoint propio". La tabla del tab ya está paginada vía `useStockMoves` (`StockMoveViewSet`, `StandardResultsSetPagination`). Lo único que depende de la lista truncada (`insights.kardex`, 100 movimientos) son los KPIs de entradas/salidas y el gráfico de flujo. Se reemplaza `kardex` por un agregado calculado en el servidor (`stock_flow`) y se elimina la lista del payload.

## Capacidades (backend)
`ProductSelector.get_capabilities(product) -> dict`, incluido en `get_insights` como `capabilities`:

| Clave | Fuente |
|---|---|
| `sells` | `can_be_sold` |
| `buys` | `can_be_purchased` |
| `tracks_stock` | `track_inventory` |
| `manufactures` | `product_type == MANUFACTURABLE` |
| `express` | `product.is_express` |
| `recurring` | `product_type == SUBSCRIPTION` |
| `used_in_production` | existe `BillOfMaterialsLine` con `component=product` y `bom.active` |
| `has_variants` | `has_variants` |
| `segment` | ver abajo |

`segment`: `MANUFACTURABLE_EXPRESS` (fabricable express) · `MANUFACTURABLE_STOCKED` (fabricable con `track_inventory`) · `MANUFACTURABLE_ON_DEMAND` (fabricable sin stock, no express) · `SERVICE` · `SUBSCRIPTION` · `INPUT` (almacenable o consumible no vendible) · `STORABLE` · `CONSUMABLE`.

## Stock flow (backend)
`stock_flow = {"totals": {"in_qty","in_cost","out_qty","out_cost"}, "monthly": [{"month":"YYYY-MM","in":x,"out":y}]}` agregado en la BD sobre los `StockMove` del producto y sus variantes. `direction` es una propiedad del modelo, así que se deriva con `Case/When` sobre los tipos de ubicación y `ADJUSTMENT_VIRTUAL_NAMES`. La valoración es a costo (`quantity × unit_cost`).

## Registro de tabs (frontend)
Módulo puro `features/inventory/analytics/productAnalyticsRegistry.ts`:

| Tab | Visible si |
|---|---|
| overview | siempre |
| sales, price, customers | `sells` |
| purchases, suppliers | `buys` |
| cost | `buys` o `manufactures` o `tracks_stock` |
| kardex | `tracks_stock` |
| production | `manufactures` o `used_in_production` |

Más: `SEGMENT_LABELS`, `overviewKpiIds(capabilities)` (ventas si vende; valoración y stock si controla stock; compras si compra; consumo en OT si es insumo de producción). Si el tab activo deja de ser visible (cambio de producto), se vuelve a "overview".

## Constraints
- Invariantes del repo: zero `any`, tokens semánticos, shared por barrel, selectors sin N+1 (`get_capabilities` hace una consulta `exists()`), views ≤ 20 líneas.
- Cambiar el payload de `insights` (contrato) requiere ADR: ADR-0144.

## Decisiones del usuario
Capacidades dentro de `insights` (sin endpoint aparte); registro de bloques en el frontend; etiqueta del segmento en el riel; ADR corto.

## Mis decisiones (marcadas)
- La valoración de entradas/salidas pasa a ser a costo (`unit_cost`); antes las salidas se valoraban a precio de venta, lo que mezclaba criterios.
- `used_in_production` mira solo BOMs activas del propio producto, no de sus variantes.
- `kardex` se elimina del payload (único consumidor: `ProductAnalyticsModal`).

## Pendiente del builder
Redacción de las etiquetas en español, orden de los KPIs del Resumen, estado vacío cuando un KPI no aplica, ubicación exacta de los tipos TypeScript.
