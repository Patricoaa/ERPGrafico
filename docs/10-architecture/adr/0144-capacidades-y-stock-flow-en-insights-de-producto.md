---
id: 0144
title: El análisis de producto se adapta a las capacidades del producto; `stock_flow` reemplaza `kardex` en `insights`
status: Superseded by 0150
date: 2026-11-19
author: frontend-team + backend-team
---

# 0144 — Capacidades y `stock_flow` en el payload de `insights` de producto

> **Reemplazada por [ADR-0150](0150-analisis-de-producto-por-bloque-y-periodo.md) (2026-11-20):** el endpoint `insights` de producto se retiró; las capacidades viven en `GET /inventory/products/{id}/capabilities/` y el flujo de stock en `stock-analysis`.

**Relacionado:** `docs/superpowers/specs/2026-11-19-product-analytics-hub-design.md` (hub de analítica), `docs/superpowers/specs/2026-11-19-product-analytics-capabilities-design.md` (Fase 2), `zero-n-plus-one-policy.md` (ADR-0118), ADR-0016 (`ProductTypeStrategy`).

## Contexto

`GET /inventory/products/{id}/insights/` devolvía lo mismo para cualquier producto y el modal mostraba siempre los mismos 9 tabs, incluso los que no aplican (un insumo no vendible veía tabs de ventas vacíos). Además:

1. `insights.kardex` era una lista truncada a los últimos 100 movimientos, y de ella se derivaban los KPIs de entradas/salidas, el gráfico de flujo y `stock_history`, que quedaban mal para cualquier producto con más movimientos (y el armado de la lista hacía N+1: 17 → 37 consultas al sumar 20 movimientos).
2. Las salidas se valoraban a precio de venta y las entradas a costo, mezclando criterios.
3. `stock_history` acumulaba deltas de la lista truncada y trataba los traspasos como salidas.

## Decisión

- `get_insights` incluye `capabilities` (`ProductSelector.get_capabilities`): `sells`, `buys`, `tracks_stock`, `manufactures`, `express`, `recurring`, `used_in_production`, `has_variants` y `segment` (`MANUFACTURABLE_EXPRESS | MANUFACTURABLE_STOCKED | MANUFACTURABLE_ON_DEMAND | SERVICE | SUBSCRIPTION | INPUT | STORABLE | CONSUMABLE`). Se calculan con los campos del producto y una única consulta `exists()`; no hay endpoint aparte.
- `kardex` desaparece del payload. Lo reemplaza `stock_flow = {totals: {in_qty, in_cost, out_qty, out_cost}, monthly: [{month, in, out}]}`, agregado en la BD sobre todos los movimientos del producto y sus variantes. Entradas y salidas excluyen traspasos y ajustes (replica de `StockMove.direction`) y se valoran a costo (`quantity × unit_cost`).
- `stock_history` se calcula con agregados diarios sobre todos los movimientos: suma lo que entra a ubicaciones internas desde fuera y resta lo que sale; los traspasos entre internas no cuentan; los ajustes sí.
- La tabla de movimientos del tab "Mov. Stock" ya estaba paginada (`/inventory/stock-moves/`, `StandardResultsSetPagination`) y no cambia.
- Frontend: el registro puro `features/inventory/analytics/productAnalyticsRegistry.ts` decide tabs (`visibleTabIds`) y KPIs del Resumen (`overviewKpiIds`) a partir de `capabilities`; sin `capabilities` (respuesta anterior) se muestran todos los tabs. El riel muestra la etiqueta del segmento. Un tab que deja de ser visible vuelve a Resumen.

## Consecuencias

- **Cambio de contrato:** `insights.kardex` ya no existe; único consumidor: `ProductAnalyticsModal`. Aparece `capabilities` y `stock_flow`.
- Los valores de "Total Salidas" y del gráfico de stock cambian: ahora cubren todos los movimientos y las salidas se valoran a costo.
- Nuevos bloques de la Fase 3 se registran en el registro frontend con su regla de capacidades, sin tocar los demás.

## Alternativas descartadas

- **Perfil por tipo de producto:** multiplica perfiles por cada combinación de tipo, `track_inventory`, `can_be_sold` y `can_be_purchased`; las capacidades componen.
- **Endpoint aparte de capacidades:** una llamada más; el frontend ya consulta `insights`.
- **Mantener `kardex` junto a `stock_flow`:** conserva el N+1 y la lista truncada sin consumidores.
