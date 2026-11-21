# Tab «Producción» del análisis de producto

Estado: aprobado. Fecha: 2026-11-20.
Sexto tab rediseñado del plan `2026-11-20-product-analytics-tab-planning-design.md`. Reemplaza el contenido legado `production`, `ProductionPerformanceBlock` y `SourcingBlock section="used_in"` dentro de `TabContent.production`.

## Intención

El tab tiene dos roles según el producto (visible si `manufactures` o `used_in_production`):

- **Fabricado:** ¿cuánto produzco, cuánto rehago y cuánto insumo consumo frente a lo planificado?
- **Insumo:** ¿cuánto se consume en órdenes de trabajo, para qué productos, y qué pasa con sus márgenes si sube de precio?

El costo real contra la BOM vive en «Costos»; este tab no lo repite.

## Decisiones del usuario

- Sin tiempos (lead time, tiempo por etapa) ni cumplimiento de plazos.
- Composición por rol según la propuesta.

## Composición

| Rol | Contenido |
|---|---|
| Fabricado | Hallazgos → OT terminadas, unidades producidas (con período anterior) y tasa de rectificación → gráfico de unidades por período con período anterior → consumo real contra planificado por insumo (cantidad, sin costo) → órdenes terminadas del período |
| Insumo | Hallazgos → consumo en OT y número de OT (con período anterior) → gráfico de consumo por período con período anterior → consumo por producto fabricado → productos que lo usan en su BOM con su cantidad por unidad y el margen tras una subida de precio |
| Ambos | Las dos secciones, fabricado primero |

Control «Subida de precio del insumo» (5, 10, 20 %) en la zona Vista, solo con el rol insumo. Sin datos en el rango, cada sección se omite y se dice «Sin producción en el periodo» o «Sin consumo en el periodo».

## Datos: endpoint `GET /inventory/products/{id}/production-analysis/`

Parámetros: `date_from`, `date_to` (opcionales), `granularity` (`day|week|month|year`), `increase_pct` (5, 10 o 20; por defecto 10). Respuesta:

- `made` (solo con `manufactures`; `null` si no):
  - `kpis`: `orders`, `units`, `rectified`, `rectification_rate` (rectificadas ÷ órdenes × 100), `previous` (`orders`, `units`; `null` sin `date_from`).
  - `series`: `points: [{period, orders, units}]` y `previous_points` alineados (por fecha de término).
  - `materials`: `[{component_id, name, planned_qty, consumed_qty, deviation_qty, deviation_pct}]` ordenados por desvío absoluto.
  - `orders`: `[{id, number, date, units, rectified}]`.
  - Fuente: `ProductionPerformanceSelector` (mismas órdenes terminadas, cantidades en unidad base); se le agrega `rectified` a cada orden sin cambiar el resto de su contrato.
- `input` (solo con `used_in_production`; `null` si no):
  - `kpis`: `consumed`, `orders`, `previous` (`consumed`, `orders`).
  - `series`: `points: [{period, consumed}]` y `previous_points` alineados (por fecha del consumo).
  - `by_product`: `[{product_id, name, qty, share_pct}]` (producto de la OT donde se consumió).
  - `used_in`: el mismo contenido que `sourcing.used_in` (padres, cantidad por unidad, participación en la BOM, margen antes y después de la subida).
  - Fuente: `ProductionConsumption` del producto y sus variantes, fecha del consumo.

Servidor: `inventory/production_analysis_selector.py`, serializer de parámetros, vista ≤ 20 líneas, sin N+1.

## Frontend

- Bloque `ProductionBlock`, hook `useProductProductionAnalysis`, función pura `composeProduction(data)`.
- `TabContent.production` pasa a `<ProductionBlock />` (sin legado, `ProductionPerformanceBlock` ni `SourcingBlock`); `tabHasLegacyContent("production")` pasa a falso.

## Hallazgos (umbrales míos)

- **Rectificación alta:** `rectification_rate ≥ 10` con al menos 3 órdenes.
- **Sobreconsumo de insumo:** un insumo con `deviation_pct ≥ 10`.
- **Margen negativo tras la subida:** algún producto que lo usa queda con margen negativo tras `increase_pct`.

## No objetivos

- Tiempos, etapas, plazos.
- Costo real contra BOM (tab `costs`).

## Queda al implementador

- Nombres, orden fino de las secciones y etiquetas.

## Desvíos de la implementación

- `production-performance` agrega `rectified` a cada orden (cambio aditivo) para no duplicar la consulta de órdenes.
- El rol insumo reutiliza `SourcingSelector._used_in` tal cual; su resultado es idéntico al de `sourcing`.
