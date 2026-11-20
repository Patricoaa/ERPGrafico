# Análisis de producto: planificación general de tabs

Estado: borrador para aprobación. Fecha: 2026-11-20.
Extiende `2026-11-20-product-analytics-redesign-design.md` (la fundación ya está implementada: período en el riel, capacidades separadas, bloques con `SkeletonShell`, `LegacyInsightsPanel`). Requiere actualizar ADR-0150.

## Intención

Quien decide sobre un producto necesita pocas vistas, cada una ligada a una decisión (vender, fijar precio, medir costos, abastecer, reponer o retirar, producir), y que solo aparezcan las que aplican al producto. Hoy hay 13 tabs organizados por origen del dato, no por decisión, con solapamientos (Precio / Precio y margen; Compras / Proveedores / Costos; Mov. Stock / Operación; Fabricación / Producción).

## Objetivos

1. Pasar de 13 tabs a 8, organizados por decisión.
2. Definir para cada tab su condición de visibilidad y qué contenido absorbe de los tabs actuales.
3. Mover los controles contextuales de cada bloque al pie del riel (zona "Vista", bajo "Período") y eliminar la granularidad manual.
4. Dejar fijado el orden de migración y un plan por tab.

## No objetivos

- Definir aquí el contenido detallado (KPIs, gráficos, tablas, composición por segmento) de cada tab: se hace en el plan de cada tab, uno por vez.
- Cambiar las reglas de capacidades (`get_capabilities`) ni el segmento (sigue interno).

## Hechos del modelo que condicionan el diseño

- `SERVICE`, `SUBSCRIPTION`, `CONSUMABLE` nunca controlan stock; `MANUFACTURABLE` express tampoco (`Product.save`). Solo `STORABLE` y `MANUFACTURABLE` no express pueden tener `tracks_stock`.
- `used_in_production` (componente de una BOM activa o consumido en una OT) es ortogonal al tipo.
- `sells`, `buys` y `tracks_stock` son flags independientes (salvo lo anterior).

## Mapa de tabs

| Id | Etiqueta | Absorbe (tabs actuales) | Visible si |
|---|---|---|---|
| `overview` | Resumen | Resumen | siempre |
| `sales` | Ventas | Ventas + Clientes | `sells` |
| `pricing` | Precio y margen | Precio + Precio y margen | `sells` |
| `costs` | Costos | Costos + costo real de Fabricación + Fabricar vs comprar | `buys` o `manufactures` o `tracks_stock` |
| `procurement` | Abastecimiento | Compras + Proveedores + cobertura de reposición | `buys` |
| `inventory` | Inventario | Mov. Stock + Rotación e inmóvil (de Operación) | `tracks_stock` |
| `production` | Producción | Fabricación (OT, tiempos, rectificación) + Producción (consumo en OT) + "Uso como insumo" (de Abastecimiento) | `manufactures` o `used_in_production` |
| `subscription` | Suscripción | Suscripciones (de Operación) | `recurring` |

Ids que desaparecen: `purchases`, `price`, `cost`, `kardex`, `customers`, `suppliers`, `manufacturing`, `sourcing`, `operations`. "Abastecimiento" cambia de significado: antes era fabricar vs comprar; ahora es compras y proveedores, y esa comparación vive en Costos.

## Resultado por caso

| Caso | Tabs |
|---|---|
| Almacenable con stock, vende y compra | Resumen, Ventas, Precio y margen, Costos, Abastecimiento, Inventario |
| Almacenable con stock, solo vende | Resumen, Ventas, Precio y margen, Costos, Inventario |
| Insumo con stock (solo compra) | Resumen, Costos, Abastecimiento, Inventario (+ Producción si es componente) |
| Almacenable sin stock, vende y compra (reventa) | Resumen, Ventas, Precio y margen, Costos, Abastecimiento |
| Consumible | Resumen, Abastecimiento, Costos (+ Ventas y Precio y margen si vende) |
| Fabricable express o bajo pedido | Resumen, Ventas, Precio y margen, Costos, Producción (+ Abastecimiento si compra) |
| Fabricable con stock | Lo anterior + Inventario |
| Servicio | Resumen, Ventas, Precio y margen (+ Abastecimiento y Costos si compra) |
| Suscripción | Resumen, Suscripción (+ Ventas y Precio y margen si vende) |

La capa `used_in_production` agrega Producción a cualquier caso. Un producto sin `sells`, `buys` ni stock muestra solo Resumen.

## Controles en el pie del riel

El pie del riel tiene dos zonas: **Período** (siempre, ya existe) y **Vista** (controles del tab activo). Cada bloque entrega sus controles a la zona Vista mediante un slot/portal; en móvil se muestran sobre el contenido, como el período.

| Control actual | Destino |
|---|---|
| Métrica (6 opciones) y Agrupar por (5 opciones) de Precio y margen | Vista, en `pricing` |
| Granularidad (día, mes, año) | **Se elimina.** Se deduce del período (ver abajo). |
| Stock inmóvil desde (30, 90, 180 d) | Vista, en `inventory` |
| Subida de precio del insumo (5, 10, 20 %) | Vista, en `production` |

**Granularidad automática:** 1 m → día; 3 m y 6 m → semana; 12 m y 24 m → mes; Histórico → año. El backend de `sales-impact` hoy soporta `day`, `month` y `year`; hay que agregar `week`.

## Decisiones del usuario

- Unificación en 8 tabs según la tabla.
- Eliminar la granularidad manual.

## Llamadas mías (a revisar)

- La granularidad automática exacta (en particular "semana" para 3 y 6 m) y la adición de `week` al backend.
- `costs` sigue visible con `tracks_stock` para productos que solo se venden pero tienen stock valorado.
- Un producto sin vender, comprar ni stock muestra solo Resumen.
- Los controles de Vista se entregan por slot/portal; el mecanismo exacto queda al implementador.
- Orden de migración propuesto (un plan por tab, cada uno crea su endpoint y bloque y retira lo absorbido): 1) `pricing`, 2) `sales`, 3) `costs`, 4) `procurement`, 5) `inventory`, 6) `production`, 7) `subscription`, 8) `overview` al final (necesita los demás para mostrar hallazgos). Antes de ellos, una tarea de infraestructura: nuevo registro de tabs/visibilidad con los ids nuevos, zona Vista del riel y granularidad automática.

## Queda al implementador

- Contenido, composición por segmento y endpoints de cada tab (en cada plan por tab).
- Qué se hace mientras conviven ids nuevos con tabs legados que aún no se migran (un tab nuevo puede mostrar temporalmente el contenido legado correspondiente).
- Detalle visual de la zona Vista.
