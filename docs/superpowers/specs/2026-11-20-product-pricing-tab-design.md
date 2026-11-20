# Tab «Precio y margen» del análisis de producto

Estado: aprobado. Fecha: 2026-11-20.
Primer tab rediseñado del plan `2026-11-20-product-analytics-tab-planning-design.md`. Reemplaza `SalesImpactBlock` y el contenido legado `price` (historial de precio) dentro de `TabContent.pricing`.

## Intención

Quien fija precios necesita responder: ¿cobro bien y gano lo que debo?, ¿cómo evolucionó mi precio frente al costo?, y sobre todo ¿qué efecto tuvo cada cambio de precio o regla en las ventas? Hoy el tab muestra un análisis de reglas y un historial de precios sueltos, sin relacionar precio con ventas.

## Objetivos

1. Protagonista: **margen realizado** del período (con descuentos), comparado con el período anterior; el margen de lista (precio de lista menos costo) es la referencia.
2. Gráficos **«precio contra ventas»** alineados: arriba líneas de precio, abajo barras de unidades, con marcadores en cada cambio de precio de lista y bandas con la vigencia de cada regla.
3. Tabla **«Antes vs después»** por cada cambio de precio de lista o de regla.
4. Hallazgos al tope cuando aplican (costo subió y el precio no, ventas bajo el costo, ingreso no percibido alto).
5. Desglose existente por segmento (métrica y agrupar por, ahora en la zona Vista del riel).
6. Composición que cambia según el producto y sus datos.

## No objetivos

- Precios de la competencia (no existen datos).
- Elasticidad estadística ni causalidad: se muestra asociación, con la nota existente.
- Doble eje en un solo gráfico (descartado: Nivo no lo soporta y puede sugerir relaciones falsas).
- Editar precios desde el tab.

## Visibilidad y casos

El tab sigue visible si `sells`. Composición:

| Caso | Composición |
|---|---|
| Producto con costo (almacenable, consumible, fabricable) | Hallazgos → margen realizado protagonista y «Hoy» (precio de lista c/IVA y neto, costo, margen de lista, descuento promedio, no percibido) → gráficos precio/ventas → antes vs después → desglose |
| Sin costo (servicio, suscripción, o costo 0 sin base de costo en las entregas) | Sin margen ni hallazgos de margen. Protagonista: precio realizado y su evolución; «Hoy»: precio de lista y descuento promedio |
| Con variantes | El desglose abre agrupado por variante (en lugar de regla) |
| Sin ventas en el período | Se muestra «Hoy» y los cambios de precio del período; gráficos y efectos con estado vacío «Sin ventas en el periodo» |
| Período `all` | Sin comparación con período anterior |

## Datos: endpoint `GET /inventory/products/{id}/pricing/`

Parámetros: `date_from`, `date_to` (opcionales, validados con serializer; `date_from` ausente = histórico), `granularity` (`day|week|month|year`, el cliente la envía según el período). Respuesta:

- `today`: `list_price_net`, `list_price_gross`, `cost`, `list_margin_pct` (`null` si no hay costo).
- `kpis`: `margin_pct` (`null` sin costo), `net_revenue`, `units`, `avg_price`, `avg_discount_pct`, `foregone_revenue`, y `previous` con los mismos campos para el período anterior de igual duración (`null` si no hay `date_from`).
- `series`: por período `{period, units, net_revenue, avg_price, avg_list_price, avg_cost, margin_pct}` y `by_rule` con `{period, key, units, avg_price}`.
- `list_price_changes`: `[{date, from, to}]` dentro del rango, más `baseline` (precio de lista vigente al inicio del rango).
- `rule_windows`: como hoy en `sales-impact`.
- `effects`: `[{kind: "list_price"|"rule", label, date, before, after, reliable}]` donde `before`/`after` = `{days, units, units_per_day, revenue_per_day, margin_per_unit}`.
- `has_cost`: booleano que decide la composición «con/sin costo».

Reglas del cálculo:
- Fuente: líneas de entrega confirmadas (`SaleDeliveryLine`), como `sales-impact`; el precio de lista aplicado sale de la línea de venta y los cambios de lista, del historial del producto.
- Efecto: ventana de **28 días** a cada lado de la fecha del cambio, truncada en el cambio siguiente o en los límites del rango. `reliable` solo si cada lado tiene al menos **7 días** y **5 unidades**; si no, la tabla lo marca como «Pocos datos».
- Los eventos de regla son el inicio y el fin de cada ventana de vigencia.
- Servidor: selector nuevo `inventory/pricing_selector.py`, serializer de parámetros, vista ≤ 20 líneas, sin N+1; el desglose sigue usando `sales-impact` (sin cambios de contrato).

## Frontend

- Bloque `PricingBlock` (reemplaza `SalesImpactBlock` y el contenido legado `price` en `TabContent.pricing`), con hook `useProductPricing` y tipos propios.
- Función pura `composePricing(data, capabilities)` decide secciones y orden (hallazgos, protagonista, gráficos, efectos, desglose) y es la unidad de prueba principal.
- Hallazgos calculados en el cliente desde el payload. Umbrales iniciales (mis llamadas): costo promedio del período +5 % o más con precio de lista sin cambios; margen realizado negativo en algún período; ingreso no percibido ≥ 5 % del ingreso neto.
- Gráficos con `AnalyticsChart` (líneas y barras); marcadores con la propiedad `markers` de Nivo; bandas de reglas como marcadores de rango.
- Controles Métrica y Agrupar por del desglose, vía `RailControls` (solo afectan al desglose).
- Estados con `AnalyticsBlockFrame`/`SkeletonShell`; cada sección sin datos se omite.
- Se mantiene la nota «asociación, no causalidad» y la cobertura de reglas existente.

## Decisiones del usuario

- Protagonista: margen realizado (con el de lista como referencia).
- Análisis de impacto del precio y de las reglas en las ventas con gráficos de línea comparando precio contra ventas.
- Enfoque: dos gráficos alineados con marcadores y bandas, más la tabla «Antes vs después».

## Llamadas mías (a revisar)

- Ventana 28 días; confiabilidad 7 días y 5 unidades por lado.
- Umbrales de hallazgos (+5 % de costo, 5 % de no percibido).
- El historial de precios en tabla se elimina: queda como marcadores y tabla de efectos.
- Desglose agrupado por variante por defecto cuando el producto tiene variantes.
- Hallazgos calculados en el cliente.
- Endpoint nuevo separado de `sales-impact`.

## Queda al implementador

- Nombres de tipos y hooks, orden fino de las secciones y diseño visual de tarjetas y marcadores.
- Cómo resolver el precio de lista aplicado cuando la línea no lo registra (usar el precio neto menos descuento).
- Detalle de la consulta para evitar N+1 en `by_rule` y `effects`.

## Desvíos de la implementación

- Las «bandas» de reglas se dibujan como marcadores de inicio y de fin (Nivo no soporta rangos), más los chips de vigencia del desglose. El «fin» de una regla se fecha el primer día sin la regla.
- Los dos gráficos comparten márgenes pero Nivo usa escalas distintas (puntos vs bandas): el alineamiento es aproximado.
- Con cero ventas no se muestra el desglose (evita un segundo mensaje vacío).
