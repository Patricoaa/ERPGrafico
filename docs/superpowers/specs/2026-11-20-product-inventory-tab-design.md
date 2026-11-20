# Tab «Inventario» del análisis de producto

Estado: aprobado. Fecha: 2026-11-20.
Quinto tab rediseñado del plan `2026-11-20-product-analytics-tab-planning-design.md`. Reemplaza el contenido legado `kardex` y `OperationsBlock` dentro de `TabContent.inventory`.

## Intención

Quien administra el stock de un producto necesita saber cuánto tiene, dónde, cuánto está comprometido, si se mueve o está quieto y si pierde stock, para liquidar o retirar inmóvil, controlar mermas o mover stock entre bodegas. La cobertura y la reposición viven en «Abastecimiento»; este tab no las repite.

## Hechos del modelo

- `Stock` guarda la existencia por bodega.
- `Product.get_qty_reserved()` calcula lo comprometido: ventas confirmadas no entregadas (`quantity − quantity_delivered`), carritos abiertos del POS y materiales pendientes de órdenes en borrador o en proceso. Disponible = existencia − comprometido.
- Los ajustes van a ubicaciones virtuales con nombre fijo (`ADJUSTMENT_VIRTUAL_NAMES`): «Ajuste por Merma/Pérdida», «Ajuste por Sobrante/Ganancia», «Revalorización».
- Cada movimiento se clasifica como entrada, salida, transferencia o ajuste (`ProductSelector._flow_case`); el tipo de la ubicación de origen o destino dice si es compra (proveedor), venta o devolución (cliente) o producción (virtual).

## Composición

| Sección | Cuándo |
|---|---|
| Hallazgos | si aplican |
| Hoy: existencia, valor, comprometido, disponible | siempre |
| Rotación: rotación y días de inventario del período | siempre |
| Evolución: stock al cierre por período y entradas/salidas | con movimientos en el rango |
| Salidas por destino (venta, producción, devolución a proveedor) y entradas por origen (compra, producción, devolución de cliente) | con movimientos en el rango |
| Ajustes: merma, sobrante y revalorización (cantidad y valor) | con ajustes en el rango |
| Stock por bodega | con más de una bodega con existencia o movimientos |
| Stock por variante | con variantes |

Control «Stock inmóvil desde» (30, 90, 180 días) en la zona Vista, como hoy. **Sin tabla de movimientos** (decisión del usuario: ya existe en la pantalla de movimientos de stock).

## Datos: endpoint `GET /inventory/products/{id}/stock-analysis/`

Parámetros: `date_from`, `date_to` (opcionales), `granularity` (`day|week|month|year`), `idle_days` (30, 90 o 180; por defecto 90). Respuesta:

- `today`: `on_hand`, `value` (existencia × costo ponderado), `reserved`, `available` (mismo cálculo que `get_qty_reserved`, en consultas agregadas para la plantilla y sus variantes).
- `rotation`: `in_qty`, `out_qty`, `avg_stock`, `turnover`, `days_of_inventory`, `last_in_date`, `last_out_date`, `idle`, `idle_days` (mismo cálculo que `operations`).
- `series`: `[{period, stock_end, in_qty, out_qty}]` por período del rango.
- `flows`: `outflows: [{key, label, qty}]` (`sale`, `production`, `supplier_return`, `other`) e `inflows: [{key, label, qty}]` (`purchase`, `production`, `customer_return`, `other`), del rango.
- `adjustments`: `[{key, label, qty, value}]` (`loss`, `gain`, `revaluation`) del rango y `loss_pct` (merma ÷ salidas × 100; `null` sin salidas).
- `warehouses`: `[{id, name, on_hand, last_move_date, idle}]`.
- `variants`: `[{id, name, on_hand, reserved, available}]` (solo con variantes).

Servidor: `inventory/stock_analysis_selector.py`, serializer de parámetros, vista ≤ 20 líneas, sin N+1 (la reserva se calcula agregada, no con `get_qty_reserved` por variante). La rotación reutiliza `OperationsSelector._rotation` o su lógica extraída.

## Frontend

- Bloque `StockBlock` con hook `useProductStockAnalysis`, función pura `composeStock(data)` (hallazgos y secciones).
- Gráfico: stock al cierre (línea) y entradas/salidas (barras) alineados.
- Tablas con `defineEntity`: bodegas y variantes; flujos y ajustes como tablas pequeñas o `MetricStrip`.
- `TabContent.inventory` pasa a `<StockBlock />` (sin legado ni `OperationsBlock`); `tabHasLegacyContent("inventory")` pasa a falso. `OperationsBlock` queda solo en `subscription`.

## Hallazgos (umbrales míos)

- **Stock inmóvil:** `rotation.idle`.
- **Merma:** `loss_pct ≥ 2`.
- **Comprometido mayor que la existencia:** `available < 0`.
- **Bodega inmóvil:** una bodega con existencia y sin movimientos en `idle_days`, cuando hay más de una bodega.

## Decisiones del usuario

- Composición propuesta (existencia, comprometido, rotación, bodegas, flujos, ajustes, variantes, hallazgos).
- Sin la tabla de movimientos (kardex).

## No objetivos

- Cobertura y reposición (tab `procurement`).
- Costo unitario (tab `costs`).
- Detalle de movimientos.

## Queda al implementador

- Etiquetas exactas de los flujos y orden fino de las secciones.
- Si la rotación se extrae de `OperationsSelector` a una función o se llama al selector.
