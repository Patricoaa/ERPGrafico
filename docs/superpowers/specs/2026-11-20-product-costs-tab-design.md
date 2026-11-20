# Tab «Costos» del análisis de producto

Estado: aprobado. Fecha: 2026-11-20.
Tercer tab rediseñado del plan `2026-11-20-product-analytics-tab-planning-design.md`. Reemplaza el contenido legado `cost` y la sección «Fabricar vs comprar» dentro de `TabContent.costs`.

## Intención

Quien decide sobre un producto necesita saber cuánto le cuesta, hacia dónde va ese costo y qué lo explica, para renegociar, cambiar la receta o ajustar el precio. El costo significa cosas distintas según cómo entra el producto, así que el tab se compone por **modo de costo**, no con una vista única.

## Hechos del modelo

- **Comprado:** `cost_price` es el costo ponderado de las recepciones de compra (`inventory/services.py`), con el ajuste de impuestos de la facturación (`billing/services.py`). Cada `PurchaseReceiptLine` guarda su `unit_cost`.
- **Fabricable con stock:** al terminar cada orden de trabajo, el costo ponderado se recalcula solo con los materiales consumidos (`production/services.py`).
- **Fabricable sin stock** (express o bajo pedido): no tiene costo propio útil; su costo es el de la BOM activa, `Product.get_bom_cost()` = cantidad × costo ponderado de cada componente (o precio fijo de la línea si es tercerizada). Las entregas lo toman en ese momento.
- **Orden de trabajo:** cada `WorkOrderMaterial` guarda `unit_cost_snapshot` del componente al crear la orden: hay historia real del costo por orden.
- **BOM:** `BillOfMaterials` no tiene historial; solo hay una activa por producto. Los componentes sí tienen historial de `cost_price` (`Product.history`).
- **Fabricable y compra:** el formulario lo impide (`ProductBasicInfo.tsx`), pero el backend no; hay datos con `can_be_purchased = True` en fabricables. Se corrige en las tareas previas.

## Tareas previas (regla de dominio)

1. `Product.save()` fuerza `can_be_purchased = False` cuando `product_type == MANUFACTURABLE`, igual que ya hace con `track_inventory` (tests de modelo: crear y cambiar de tipo).
2. Migración de datos en `inventory`: pone `can_be_purchased = False` en los fabricables existentes. Reverso: `noop` (no se puede saber el valor previo; se documenta).
3. Consecuencia: para un fabricable `buys` es falso, así que no ve el tab Abastecimiento ni la sección «Fabricar vs comprar». `TabContent.costs` deja de montar `SourcingBlock section="make_vs_buy"`. El cálculo `make_vs_buy` del endpoint `sourcing` queda sin consumidor y se retira con el resto del legado.

## Modos de costo y composición

El modo lo decide el servidor (`mode` en la respuesta):

| Modo | Cuándo | Protagonista | Secciones |
|---|---|---|---|
| `purchased` | compra y no fabrica | Costo ponderado actual | Última compra contra ponderado; costo de cada compra en el tiempo (mínimo, máximo, promedio, último); capital inmovilizado si tiene stock |
| `manufactured_stock` | fabrica, con stock y BOM activa | Costo ponderado actual, con el costo de BOM hoy al lado | Evolución del costo de BOM; composición por componente; costo real por orden contra BOM; capital inmovilizado |
| `manufactured_on_demand` | fabrica, sin stock y con BOM activa | Costo de BOM hoy | Evolución del costo de BOM; composición por componente y qué componente explica cada alza; costo real por orden contra BOM |
| `manufactured_no_bom` | fabrica sin BOM activa | Costo real promedio por orden | Costo real por orden; hallazgo «sin BOM: no hay costo estándar» |
| `stock_only` | ni compra ni fabrica, pero tiene stock | Costo ponderado actual | Evolución del ponderado; capital inmovilizado |

Sin datos en el período, cada sección se omite y queda el protagonista con su valor actual.

## Datos: endpoint `GET /inventory/products/{id}/costs/`

Parámetros: `date_from`, `date_to` (opcionales), `granularity` (`day|week|month|year`). Respuesta:

- `mode`.
- `today`: `weighted_cost`, `bom_cost` (`null` sin BOM), `last_purchase` (`{date, unit_cost, supplier}` o `null`), `stock_qty` y `stock_value` (solo con stock).
- `kpis`: `cost_change_pct` (costo protagonista al cierre contra al inicio del rango; `null` sin `date_from`), `replacement_gap_pct` (costo de reposición contra ponderado: última compra en `purchased`, BOM hoy en `manufactured_stock`; `null` en los demás).
- `series`: por período `{period, weighted_cost, bom_cost, purchase_avg, real_avg}` (cada campo `null` si no aplica o no hay dato).
  - `weighted_cost`: último `cost_price` del historial vigente al cierre del período.
  - `bom_cost`: receta **actual** valorada con el `cost_price` histórico de cada componente al cierre del período (línea teórica).
  - `purchase_avg`: costo unitario promedio ponderado de las recepciones del período.
  - `real_avg`: costo real unitario promedio de las órdenes terminadas en el período.
- `purchases` (solo `purchased`): `{min, max, avg, count}` del rango.
- `bom` (solo con BOM activa): `lines: [{component_id, name, qty_per_unit, unit_cost, cost, share_pct, change_pct, is_outsourced}]` (`change_pct`: costo del componente al cierre contra al inicio del rango) y `drivers`: los componentes que más explican la variación del costo de BOM en el rango, con su aporte en pesos.
- `work_orders` (solo fabricables): `[{id, number, date, units, unit_real_cost, unit_bom_cost, deviation_pct}]` de las órdenes terminadas en el rango (costo real desde `WorkOrderMaterial.unit_cost_snapshot × quantity_consumed`).

Servidor: `inventory/costs_selector.py`, serializer de parámetros, vista ≤ 20 líneas, sin N+1. El historial de costo de los componentes se lee en una sola consulta.

## Frontend

- Bloque `CostsBlock` con hook `useProductCosts`, tipos propios y función pura `composeCosts(data)` (protagonista, hallazgos y secciones según `mode`), como en `pricing` y `sales`.
- Gráfico principal (`LineChart`): las series que aplican al modo (ponderado, BOM teórica, compras, real por orden).
- Tablas con `defineEntity`: composición de la BOM y órdenes de trabajo.
- `TabContent.costs` pasa a `<CostsBlock />` (sin legado ni `SourcingBlock`); `tabHasLegacyContent("costs")` pasa a falso.
- Sin control en la zona Vista en esta versión.

## Hallazgos (umbrales míos)

- **Reposición por encima del ponderado:** `replacement_gap_pct ≥ 5`.
- **Costo en alza:** `cost_change_pct ≥ 10`.
- **Desvío de fabricación:** desvío promedio del costo real contra BOM ≥ 10 % (con al menos 3 órdenes).
- **Componente dominante en el alza:** un componente explica ≥ 50 % del aumento del costo de BOM.
- **Sin BOM:** en `manufactured_no_bom`.

## Decisiones del usuario

- El análisis se divide por modo: comprado (costos históricos y ponderado actual) contra fabricable (con o sin stock, con o sin BOM, evolución de los componentes de la BOM).
- La evolución de la BOM se reconstruye con la receta actual y el costo histórico de cada componente, junto a los puntos de costo real por orden.
- «Fabricable y compra» no existe: se fuerza en el backend como tareas previas.

## No objetivos

- Historial de cambios de receta (la BOM no tiene historial).
- Costos de mano de obra o indirectos (el costo de fabricación actual solo incluye materiales).
- Precio y margen (tab `pricing`) y proveedores (tab `procurement`).

## Llamadas mías (a revisar)

- Umbrales de hallazgos (5 %, 10 %, 10 % con 3 órdenes, 50 %).
- Los cinco modos y que los decida el servidor.
- El reverso de la migración es `noop`.
- Sin control en la zona Vista.

## Queda al implementador

- Conversión de unidades de las líneas de BOM (reutilizar la de `get_bom_cost`).
- Cómo tratar componentes sin historial antes de cierta fecha (usar el primer valor conocido).
- Nombres de tipos, hooks y entidades, y orden fino de las secciones.
