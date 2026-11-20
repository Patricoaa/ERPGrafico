---
id: 0145
title: Margen real e impacto de reglas de precio por producto; endpoint `sales-impact` e ingresos de `insights` netos de descuentos
status: Accepted
date: 2026-11-19
author: frontend-team + backend-team
---

# 0145 — Precio y margen por producto

**Relacionado:** `docs/superpowers/specs/2026-11-19-product-sales-impact-design.md`, `docs/superpowers/specs/2026-11-19-product-analytics-hub-design.md`, ADR-0144 (capacidades), `zero-n-plus-one-policy.md` (ADR-0118), `docs/10-architecture/data-flow.md` (procedencia del precio).

## Contexto

El margen del análisis de producto ignoraba los descuentos: `SaleDeliveryLine.unit_price` copia `SaleLine.unit_price` sin descuento, y `insights` sumaba `quantity × unit_price`. Además no había forma de medir el efecto de una regla de precio en las ventas, aunque desde la Fase 1 cada línea nueva registra `pricing_rule`, `list_unit_price_gross` y `price_source`.

## Decisión

1. **Ingreso neto de descuentos.** Por línea de despacho confirmada: `net_revenue = quantity × unit_price × (1 − ratio)`, con `ratio = clamp(discount_amount / (quantity_de_la_línea × unit_price_gross), 0, 1)` y `ratio = 0` si la línea no tiene `unit_price_gross` (igual que `SaleLine.calculate_subtotal`). El descuento se prorratea por unidad despachada. El costo es el `unit_cost` congelado en el despacho. La expresión vive en `inventory/sales_impact_selector.py` (`net_revenue_expression`) y la reutiliza `insights` (`sales_analysis`, historial mensual y `top_customers`), de modo que las pantallas coinciden.
2. **Endpoint `GET /inventory/products/{id}/sales-impact/`**: agrega en la BD (métrica, `group_by` = regla/canal/cliente/variante/unidad, granularidad, rango y filtros) y devuelve serie, segmentos, tabla, totales, devoluciones, cobertura y vigencias de reglas. Parámetros inválidos → 400. Las devoluciones se informan aparte, no restan de la serie.
3. **Cobertura explícita.** Solo las ventas posteriores a la Fase 1 tienen procedencia; el resto es el segmento «Sin registro» y la respuesta informa el porcentaje del ingreso con procedencia. El ingreso no percibido solo se calcula con `list_unit_price_gross`. La comparación entre reglas se presenta como asociación, no como causalidad.
4. **Cálculo en `float`.** Las proporciones se calculan con `Cast(FloatField)`: SQLite devuelve enteros al castear decimales de valor entero a `NUMERIC`, lo que anulaba la división y la comparación en `MIN/MAX`. El error es sub-peso y aceptable para analítica.

## Consecuencias

- Los KPIs de Ventas, el historial y los mejores clientes bajan en productos con descuentos, porque antes los ignoraban.
- Cambia el contrato de `insights` (valores, no forma) y se agrega un endpoint; la UI incorpora el tab «Precio y margen».
- El margen de despachos no incluye descuentos globales de la orden, solo los de línea.

## Alternativas descartadas

- Agregar en el cliente: obliga a traer todas las líneas y repite la fórmula.
- Inferir reglas para ventas anteriores: una cifra inventada es peor que «Sin registro».
- Dejar los KPIs de Ventas sin netear: dos pantallas del mismo producto darían cifras distintas.
