# Hub de analítica por producto — Fase 3b: rendimiento de fabricación

## Intención y por qué
Parte de `2026-11-19-product-analytics-hub-design.md` (Fase 3). Para un producto fabricable hoy solo se ve el consumo de insumos; no se sabe cuánto costó realmente fabricarlo frente al costo de su BOM, qué insumos se desvían, cuánto tarda cada etapa ni cuál fue el margen por OT. 3c (fabricar vs comprar, sensibilidad de insumos, rotación) queda fuera.

## Goals
- Costo real por unidad producida contra el costo actual de la BOM, y su desviación.
- Desviación por insumo (planificado vs consumido, efecto en costo).
- Tiempos por etapa y lead time (solo no express) y tasa de rectificación.
- Margen por OT cuando la OT nace de una línea de venta.

## Non-goals / anti-goals
- No inventar costo para OT sin consumos registrados: se informan sin costo real y quedan fuera de promedios.
- No mezclar costo de OT en curso: solo OT `FINISHED`.
- No fabricar-vs-comprar, sensibilidad ni rotación (3c). No tocar el flujo de producción.

## Definiciones (OT `FINISHED` del producto o de sus variantes)
Producto de la OT: `sale_line.product` o, en OT manuales, `product`.
- `qty`: `actual_quantity_produced` si existe; si no, `sale_line.quantity` o `stage_data["quantity"]` (manual). OT sin `qty > 0` se excluye de promedios por unidad.
- `real_cost`: Σ `ProductionConsumption.quantity × stock_move.unit_cost` (unidad base); consumo sin `stock_move` aporta `quantity × componente.cost_price` y se marca `estimated`.
- `planned_cost`: Σ `WorkOrderMaterial.quantity_planned × unit_cost_snapshot`, con la cantidad convertida a unidad base del componente.
- `deviation = real_cost − planned_cost`; `deviation_pct = deviation / planned_cost × 100` (0 si planned = 0).
- `revenue`: subtotal neto de la `sale_line` (`SaleLine.subtotal`), solo OT con línea; `margin = revenue − real_cost`.
- `unit_real_cost = Σ real_cost / Σ qty` (solo OT con consumos y qty > 0); `bom_cost = product.get_bom_cost()`; `bom_gap_pct = (unit_real_cost − bom_cost) / bom_cost × 100`.
- Duración de etapa: diferencia entre un `WorkOrderHistory` `ENTERED`/`REOPENED` y el siguiente de la misma OT; la última etapa termina al finalizar. `lead_time_days`: `created_at` del primer evento → primer evento de etapa `FINISHED`. Se omite si `capabilities.express`.
- `rectification_rate`: OT con `is_rectified` / OT terminadas.

## Endpoint
`GET /inventory/products/{id}/production-performance/` (acción del `ProductViewSet` ≤ 20 líneas; lógica en `inventory/production_performance_selector.py`). Parámetros: `date_from`, `date_to` (default 12 meses; sobre fecha de la OT = fecha del evento FINISHED), validados (400 si inválidos).
Respuesta: `{kpis: {orders, unit_real_cost, bom_cost, bom_gap_pct, deviation_pct, lead_time_days, rectification_rate}, orders: [{id, number, date, qty, planned_cost, real_cost, deviation, deviation_pct, revenue, margin, estimated}], materials: [{component_id, name, planned_qty, consumed_qty, planned_cost, real_cost, deviation}], stages: [{stage, label, avg_days, orders}]}` (`stages` vacío si express). Agregación en la BD con consultas de número constante (zero N+1).

## Frontend
Tab `manufacturing` ("Fabricación", visible si `capabilities.manufactures`), bloque `ProductionPerformanceBlock` con KPIs, tabla por OT, tabla por insumo (ambas `defineEntity` + `Collection`) y barras de tiempo por etapa (`AnalyticsChart`). Hook `useProductProductionPerformance` en `features/inventory/hooks`. Estados loading/empty/error.

## Constraints
Invariantes del repo (zero any, tokens semánticos, barrels, zero N+1); ADR-0146 (endpoint nuevo).

## Mis decisiones (marcadas)
- OT sin consumos: incluida en la tabla, excluida de promedios. Costo estimado cuando falta `stock_move`.
- Solo OT terminadas. Rango por fecha de término.
- Selector en archivo propio; tab propio en vez de ampliar "Producción".

## Pendiente del builder
Textos, redondeos, rango por defecto exacto, nombres de columnas.
