# Hub de analítica por producto (ProductInsight v2)

## Intención y por qué
`ProductAnalyticsModal` muestra los mismos 9 tabs para cualquier producto, a partir de `ProductSelector.get_insights` (kardex truncado a 100 movimientos, historial de precio de lista/costo, ventas/compras agregadas). No distingue qué puede informar cada producto ni mide el efecto de las reglas de precio. El usuario quiere un hub financiero y de negocio, ajustado a los datos que ya recopilamos y al tipo de producto, con comparación de precios que muestre el impacto en ventas y gráficos que se puedan segmentar.

## Goals
- Los bloques de analítica se deciden por **capacidades** del producto, no por un perfil por tipo.
- Impacto exacto de las reglas de precio en las ventas: cada línea de venta nueva registra la regla aplicada.
- Gráficos de impacto segmentables (por regla, canal, cliente, variante, unidad de medida) con métricas intercambiables.
- KPIs financieros reales (margen con costo registrado en la línea, no el de lista).

## Non-goals / anti-goals
- No inferir reglas para ventas anteriores: se muestran como segmento "Sin registro". Una cifra inventada sería un fracaso aunque el gráfico se vea completo.
- No presentar la comparación antes/durante una regla como causalidad: la vista dice "asociación".
- No reescribir el modal existente de una vez: el esqueleto se migra por bloques.

## Capacidades y bloques (fuente: `Product`)
Capacidades: `can_be_sold`, `can_be_purchased`, `track_inventory`, `product_type` (STORABLE, MANUFACTURABLE, SERVICE, SUBSCRIPTION, CONSUMABLE), `is_express`, `has_variants`.

| Capacidad | Bloques |
|---|---|
| Vendible | Ingresos, margen real, precio efectivo vs lista, impacto de reglas y descuentos, clientes, canal |
| Comprable | Compras, costo por proveedor, variación de costo, devoluciones |
| Con stock | Kardex (paginado), rotación y cobertura, valorización, mermas/ajustes |
| Fabricable | Costo BOM vs costo real de OT (`WorkOrderMaterial.unit_cost_snapshot`), desviación de insumos, rectificaciones |
| Fabricable no express | Tiempo por etapa (`WorkOrderHistory`), lead time, margen por OT |
| Fabricable express | Margen por receta, sensibilidad al costo de cada insumo; sin etapas ni stock terminado |
| Fabricable con stock / sin stock | Con stock: costo por lote, rotación del terminado, cobertura vs demanda. Sin stock: lead time y margen por pedido |
| Fabricable y comprable | Comparación fabricar vs comprar |
| Insumo no vendible | Dónde se usa (BOMs) e impacto de su variación de costo |
| Suscripción | Costo anualizado, calendario de pagos, variación de monto |

## Fase 1: registrar la regla aplicada (cambio pequeño y aislado)
Los datos solo se acumulan desde que se despliega, por eso va primero.
- `SaleLine` gana: `pricing_rule` (FK a `PricingRule`, `SET_NULL`, nula), `list_unit_price_gross` (precio bruto antes de la regla, nulo), `price_source` (`LIST` | `RULE` | `UOM_PRICE` | `MANUAL`, nulo para filas anteriores).
- `PricingRule` no se elimina (`NoDestroyModelMixin`), así que la FK no queda colgando.
- Resolución en el backend: refactor de `PricingService` para exponer una función que devuelva precio, regla aplicada y precio de lista (hoy `get_effective_sale_price` devuelve solo precios). El endpoint existente conserva su respuesta.
- `SalesService.create_sale_order` (camino de pedidos y POS, `sales/services.py:42`) resuelve al crear cada línea de producto: si el `unit_price_gross` enviado coincide con el resuelto, guarda regla y origen; si difiere, `price_source=MANUAL` y sin regla.
- Fuera de alcance de Fase 1: líneas adicionales de notas de débito (`billing/note_checkout_service.py`) y despachos suplementarios (`sales/services.py:397`); quedan con campos nulos.
- Migración con campos nulos, sin backfill.

## Fase 2: esqueleto por capacidades
- Backend: `GET /inventory/products/{id}/analytics/` devuelve `capabilities` y la lista de bloques aplicables. Cada bloque tiene su propio endpoint o parámetro `block`, con agregación en el servidor (política zero N+1; selectors, no serializers con ORM).
- Frontend: registro de bloques por capacidad; tabs dinámicos con `RailNav` (ya implementado); Resumen con KPIs según capacidades.
- Se retira el truncado de 100 movimientos del kardex a favor de paginación.

## Fase 3: bloques financieros
Primero margen real y precios/reglas; luego fabricables; luego el resto de la tabla.

### Gráficos segmentables (bloque de impacto de precios)
- Endpoint de agregación: métrica, `group_by`, granularidad (`day|month|year`), filtros (rango, canal, cliente, variante, UoM, regla).
- Métricas: unidades, ingreso, margen, precio medio, descuento total, ingreso dejado de percibir = (lista − aplicado) × cantidad.
- `group_by`: regla (incluye "Sin registro" y "Manual"), canal, cliente, variante, unidad de medida.
- Gráfico: serie de ventas con los periodos de vigencia (`start_date`/`end_date`) de cada regla superpuestos; selector de métrica y de segmentación. Reutiliza `AnalyticsChart`.

## Constraints
- Invariantes del repo: zero `any`, tokens semánticos, shared por barrel, views ≤ 20 líneas, zero N+1, migraciones según `add-migration.md`.
- Cambiar contratos de capa 20 requiere ADR (nuevo endpoint de analítica y contrato de bloques).

## Approaches
A (elegida): captura primero (Fase 1), luego esqueleto (Fase 2), luego bloques (Fase 3); cada fase se prueba y se usa sola. B (descartada): todo en una rama; retrasa el registro de datos y es inrevisable. C (descartada): analítica con datos inferidos; el usuario pidió exactitud.

## Decisiones del usuario
Reglas con referencia exacta en la línea de venta; gráficos de impacto segmentables; segmentar fabricables con stock/sin stock/express; la información depende de `can_be_sold`/`can_be_purchased`.

## Mis decisiones (marcadas)
- `price_source` con valores `LIST|RULE|UOM_PRICE|MANUAL` y `list_unit_price_gross` como snapshot.
- Notas de débito y despachos suplementarios quedan fuera de Fase 1.
- Agregación en el servidor, no en el cliente.
- Comparación de reglas presentada como asociación.

## Pendiente del builder
Firma exacta de la función de resolución, nombres de endpoints, parámetros de paginación del kardex, si el POS usa el mismo `create_sale_order` (verificar), si hay edición de líneas posterior a la creación que deba re-resolver, ADR y contratos, diseño visual detallado de cada bloque.
