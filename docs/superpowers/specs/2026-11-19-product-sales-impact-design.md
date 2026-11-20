# Hub de analítica por producto — Fase 3a: precio y margen

## Intención y por qué
Parte de `2026-11-19-product-analytics-hub-design.md` (Fase 3). El margen que muestra hoy el tab Ventas ignora los descuentos (la línea de despacho copia `sale_line.unit_price` sin descuento), y no hay forma de ver cuánto impacta una regla de precio en las ventas. La Fase 3a entrega margen real y analítica de reglas de precio con gráficos segmentables. 3b (fabricables) y 3c (fabricar vs comprar, insumos, rotación, suscripciones) tendrán diseño propio.

## Goals
- Margen real: ingreso neto de IVA y de descuentos, contra el costo congelado en cada despacho (`SaleDeliveryLine.unit_cost`).
- Un endpoint de agregación que permite segmentar y cambiar de métrica; un tab "Precio y margen" que lo usa.
- Los KPIs del tab Ventas pasan a neto de descuentos con la misma fórmula, para que ambas pantallas coincidan.
- Honestidad: la respuesta informa qué parte del ingreso tiene regla registrada (Fase 1 solo registra ventas nuevas).

## Non-goals / anti-goals
- No inferir reglas para ventas anteriores; el segmento "Sin registro" se muestra tal cual.
- No presentar el impacto como causalidad (se rotula "asociación").
- No tocar fabricables, abastecimiento ni suscripciones (3b/3c).
- No rediseñar los tabs Precio (historial de lista) ni Clientes.

## Fórmulas (por línea de despacho confirmada, `delivery.status = CONFIRMED`)
Sea `dl` la línea de despacho y `sl = dl.sale_line`.
- `discount_ratio = clamp(sl.discount_amount / (sl.quantity × sl.unit_price_gross), 0, 1)`; 0 si no hay `unit_price_gross` (coincide con `SaleLine.calculate_subtotal`, que solo descuenta con precio bruto).
- `net_revenue = Σ dl.quantity × dl.unit_price × (1 − discount_ratio)`.
- `cost = Σ dl.quantity × dl.unit_cost`; `margin = net_revenue − cost`; `margin_pct = margin / net_revenue`.
- `discount_total = Σ dl.quantity × dl.unit_price − net_revenue`.
- `avg_price = net_revenue / units`.
- `foregone_revenue = Σ dl.quantity × (list_net − dl.unit_price) × (1 − discount_ratio)` solo donde `sl.list_unit_price_gross` no es nulo y `list_net > dl.unit_price`, con `list_net = sl.list_unit_price_gross / (1 + sl.tax_rate/100)`. Es el ingreso que la regla o el precio manual dejó de percibir frente a la lista.
- Devoluciones (`SaleReturnLine` confirmadas) se informan aparte (`returns`), no entran en la serie segmentada.

## Endpoint
`GET /inventory/products/{id}/sales-impact/` (acción del `ProductViewSet`, ≤ 20 líneas; lógica en un selector).

Parámetros (todos validados con un serializer; valores inválidos → 400): `metric` (`units|net_revenue|margin|avg_price|discount_total|foregone_revenue`, default `net_revenue`), `group_by` (`rule|channel|customer|variant|uom`, default `rule`), `granularity` (`day|month|year`, default `month`), `date_from`, `date_to` (default últimos 12 meses), filtros `channel`, `customer`, `variant`, `uom`, `rule`.

Respuesta:
```
{
  "series":   [{"period": "2026-11", "segments": {"<key>": <valor de la métrica>}}],
  "segments": [{"key": "...", "label": "..."}],
  "table":    [{"key","label","units","net_revenue","margin","margin_pct","discount_total","avg_price","foregone_revenue"}],
  "totals":   {"units","net_revenue","margin","margin_pct","discount_total","foregone_revenue"},
  "returns":  {"units","revenue"},
  "coverage": {"revenue_with_provenance_pct": float, "since": "YYYY-MM-DD" | null},
  "rule_windows": [{"rule_id","name","start","end"}]
}
```
Segmentos de `group_by=rule`: la regla (por nombre); `MANUAL` (`price_source = MANUAL`); `Precio de lista` (`LIST`/`UOM_PRICE` sin regla); `Sin registro` (`price_source` nulo). `rule_windows`: reglas del producto, de su categoría y del template padre con `start_date`/`end_date`, para dibujar su vigencia. Producto con variantes: se incluyen sus variantes.

Agregación 100 % en la BD (Case/When, Sum, TruncMonth/TruncDate/TruncYear); número de consultas constante.

## Frontend
- Registro: nuevo tab `pricing` ("Precio y margen") visible si `capabilities.sells`.
- `SalesImpactBlock`: controles Métrica, Agrupar por, Granularidad, Rango; gráfico de barras apiladas por segmento (`AnalyticsChart` `bar-chart`, `keys` = segmentos); aviso de cobertura; fila de devoluciones; tabla con `Collection` y una entidad `defineEntity` (invariante 13). Las vigencias de reglas se muestran como chips bajo el gráfico (si `AnalyticsChart` no admite bandas).
- Hook `useProductSalesImpact(productId, params)` en `features/inventory/hooks` (los componentes no usan `useQuery`).

## Constraints
- Invariantes del repo: zero `any`, tokens semánticos, shared por barrel, zero N+1, `Collection` para tablas, ADR por cambio de contrato (ADR-0145: endpoint nuevo y KPIs netos).
- `sales_analysis` y `top_customers` de `insights` pasan a ingreso neto de descuentos con la misma expresión.

## Decisiones del usuario
Alcance 3a (precio y margen) primero; KPIs de Ventas a neto de descuentos; gráficos segmentables; cobertura visible.

## Mis decisiones (marcadas)
- Devoluciones fuera de la serie y en un bloque aparte.
- Vigencias de reglas como chips si el gráfico no admite bandas.
- El tab "Precio" (historial de lista) se mantiene; el nuevo se llama "Precio y margen".
- Selector en archivo propio (`inventory/sales_impact_selector.py`) porque `selectors.py` ya es muy grande.

## Pendiente del builder
Nombres de entidad y columnas de la tabla, textos en español, estado vacío/error, rango por defecto exacto, redondeos de presentación.
