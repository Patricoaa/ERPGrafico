# Tab «Ventas» del análisis de producto

Estado: aprobado. Fecha: 2026-11-20.
Segundo tab rediseñado del plan `2026-11-20-product-analytics-tab-planning-design.md`. Reemplaza el contenido legado `sales` y `customers` dentro de `TabContent.sales`.

## Intención

Quien decide sobre un producto necesita saber cuánto vende, a quién y por qué canal, y si la tendencia sube o baja, para decidir reponer, empujar o retirar. El precio y el margen ya los cubre «Precio y margen»: este tab habla de **volumen, mezcla y clientes**.

Hoy hay dos tabs (Ventas y Clientes) que ignoran el período del riel, no comparan con el período anterior, repiten el gráfico de ingreso contra costo (que ya vive en Precio y margen), y «Clientes únicos» cuenta como máximo 10 porque cuenta el top 10 y no los clientes reales.

## Objetivos

1. Protagonista: **unidades vendidas** y su variación contra el período anterior; junto a ella, ingreso neto, clientes distintos reales, tasa de devoluciones y días desde la última venta.
2. Gráfico principal de unidades o ingreso por período, con el período anterior superpuesto.
3. «Quién y por dónde»: clientes con su porcentaje del total y concentración de los 3 mejores; reparto por canal; ranking de variantes si hay variantes; reparto por unidad de medida si hay más de una.
4. Hallazgos al tope cuando aplican.
5. Control «Métrica» (Unidades o Ingreso neto) en la zona Vista del riel.
6. Sin gráficos ni cifras de precio o margen (viven en «Precio y margen»).

## No objetivos

- Margen, costo y precio (tab `pricing`).
- Pronóstico de demanda ni estacionalidad.
- Detalle de cada documento de venta (se abre desde otras vistas).

## Visibilidad y casos

El tab sigue visible si `sells`. Composición:

| Caso | Composición |
|---|---|
| Producto con ventas en el rango | Hallazgos → cifras → gráfico con período anterior → clientes y canal → variantes / unidades de medida |
| Sin ventas en el rango | Cifras en cero, «Última venta hace N días» (sobre todo el histórico), mensaje «Sin ventas en el periodo»; sin gráficos ni reparto |
| Un único canal | Se omite el reparto por canal |
| Un único cliente o ninguno | Se omite la concentración |
| Con variantes | Se agrega el ranking de variantes |
| Más de una unidad de medida vendida | Se agrega el reparto por unidad |
| Período `all` | Sin período anterior ni variación |

## Datos: endpoint `GET /inventory/products/{id}/sales/`

Parámetros: `date_from`, `date_to` (opcionales), `granularity` (`day|week|month|year`, como en `pricing`). Fuente: entregas confirmadas (`SaleDeliveryLine`) del producto y sus variantes, ingreso neto con `net_revenue_expression`. Respuesta:

- `kpis`: `units`, `net_revenue`, `customers` (distintos reales), `return_units`, `return_rate_pct`, `last_sale_date` y `days_since_last_sale` (sobre todo el histórico, no solo el rango), y `previous` con `units`, `net_revenue` y `customers` del período anterior de igual duración (`null` sin `date_from`).
- `series`: `points: [{period, units, net_revenue}]` y `previous_points: [{period, units, net_revenue}]` con las etiquetas **alineadas a los períodos actuales** (las fechas del período anterior se desplazan hacia adelante la duración del rango antes de agrupar).
- `customers`: `total`, `top3_share_pct` y `top: [{id, name, units, net_revenue, share_pct}]` (10 como máximo).
- `channels`: `[{key, label, units, net_revenue, share_pct}]`.
- `variants`: lo mismo, solo si el producto tiene variantes.
- `uoms`: lo mismo, solo si se vendió en más de una unidad de medida.

Servidor: `inventory/sales_overview_selector.py` (nombre a criterio del implementador), serializer de parámetros, vista ≤ 20 líneas, sin N+1 (el conteo de consultas no crece con las filas).

## Frontend

- Bloque `SalesBlock` con hook `useProductSales`, tipos propios y función pura `composeSales(data, capabilities)` (hallazgos y secciones), como en `pricing`.
- Control «Métrica» (Unidades, Ingreso neto) en la zona Vista; afecta al gráfico y a los repartos.
- Gráfico con `AnalyticsChart`/`LineChart` y barras; el período anterior como serie punteada de color atenuado.
- Tablas con `defineEntity` (clientes, canales, variantes, unidades).
- `TabContent.sales` pasa a `<SalesBlock />`; `tabHasLegacyContent("sales")` pasa a falso (el aviso de histórico se retira para este tab).
- Carga con `AnalyticsBlockFrame`/`SkeletonShell`; cada sección sin datos se omite.

## Hallazgos (umbrales míos)

- **Caída de ventas:** unidades ≥ 20 % menos que el período anterior, con al menos 5 unidades en el anterior.
- **Concentración:** los 3 mejores clientes suman ≥ 70 % y hay más de 3 clientes.
- **Sin ventas recientes:** 60 días o más desde la última venta.
- **Devoluciones altas:** tasa de devoluciones ≥ 10 %.

## Decisiones del usuario

- Protagonista: volumen (unidades y tendencia), con el ingreso como segunda cifra.
- Se mantiene la propuesta de composición (cifras, gráfico con período anterior, clientes, canal, variantes, hallazgos).

## Llamadas mías (a revisar)

- Umbrales de hallazgos (20 %, 70 %, 60 días, 10 %).
- El período anterior se superpone como serie alineada por desplazamiento de fechas.
- Un solo control «Métrica» para todo el tab.
- Se elimina el gráfico de ingreso contra costo unitario de este tab (queda en Precio y margen).
- Un endpoint nuevo, separado de `sales-impact` y de `insights`.

## Queda al implementador

- Cómo tratar al cliente genérico del POS: el cliente del pedido es obligatorio (el POS usa un contacto genérico). El implementador revisa cómo lo asigna el POS; si hay una marca reconocible, se agrupa como «Mostrador (POS)» y no cuenta como cliente distinto ni en la concentración; si no la hay, cuenta como un cliente más.
- Nombres de tipos, hooks y entidades, y orden fino de las secciones.
- Cómo normalizar unidades entre unidades de medida distintas en el reparto por unidad (por defecto, sumar la cantidad vendida en cada unidad sin convertir).
