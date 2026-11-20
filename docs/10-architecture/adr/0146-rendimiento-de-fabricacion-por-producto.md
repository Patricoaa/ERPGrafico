---
id: 0146
title: Rendimiento de fabricación por producto; endpoint `production-performance` (costo real vs BOM, desviación de insumos, etapas, margen por OT)
status: Accepted
date: 2026-11-19
author: frontend-team + backend-team
---

# 0146 — Rendimiento de fabricación por producto

**Relacionado:** `docs/superpowers/specs/2026-11-19-product-production-performance-design.md`, ADR-0144 (capacidades), ADR-0145 (precio y margen), `zero-n-plus-one-policy.md` (ADR-0118).

## Contexto

Para un producto fabricable el análisis solo mostraba el consumo de insumos: no se sabía cuánto costó realmente fabricarlo frente al costo de su BOM, qué insumos se desvían, cuánto tarda cada etapa ni el margen por OT.

## Decisión

- **Endpoint `GET /inventory/products/{id}/production-performance/`** (`date_from`, `date_to`; 400 si son inválidos). La lógica está en `inventory/production_performance_selector.py`; devuelve `kpis`, `orders`, `materials` y `stages`, con número de consultas constante.
- **Solo OT `FINISHED`** del producto o de sus variantes. El producto de una OT es `sale_line.product` o, en OT manuales, `product`.
- **Costo real** = Σ `ProductionConsumption.quantity × stock_move.unit_cost`; un consumo sin movimiento de stock se valora al costo actual del insumo y la OT se marca `estimated`. **Costo planificado** = Σ `quantity_planned × unit_cost_snapshot` convertido a la unidad base del componente. **Desviación** = real − planificado.
- **Costo real por unidad** promedia solo OT con consumos y cantidad > 0 (cantidad real producida si existe, si no la planificada). Se compara con `Product.get_bom_cost()`.
- **Margen por OT** = subtotal de la línea de venta (neto de descuento) − costo real; las OT manuales no tienen ingreso (null).
- **Etapas**: duración entre entradas consecutivas de `WorkOrderHistory`; lead time desde el primer evento hasta la etapa `FINISHED`. Los productos express no tienen etapas ni lead time.
- Frontend: tab «Fabricación», visible si `capabilities.manufactures`.

## Consecuencias

- OT sin consumos aparecen en la tabla pero no entran en promedios; OT terminadas sin evento `FINISHED` en el historial se incluyen siempre (no hay fecha para filtrarlas).
- El costo estimado es una aproximación declarada en la UI.
- Los servicios (tercerizados o propios) no generan consumo de stock: su costo real es `quantity × unit_price` (tercerizado) o `quantity × cost_price` del componente, igual que `finalize_production`, y entran al costo real y a la tabla de insumos. Una OT sin ningún costo registrado informa costo real, desviación y margen como `null`.
- Los ingresos son netos de IVA y de descuento de línea (misma base que el bloque de precio y margen). La cantidad se convierte a la unidad base del producto.
- Límite conocido: `rectify_production` sobrescribe `quantity_planned` con las cantidades reales (el original queda en `stage_data["rectification_snapshot"]`), por lo que en OT rectificadas la desviación por insumo refleja solo la variación de precio, no la de cantidad.
- Fuera de alcance (3c): fabricar vs comprar, sensibilidad al costo de insumos, rotación.

## Alternativas descartadas

- Ampliar el tab «Producción»: mezcla consumo de insumos con rendimiento de producto.
- Calcular en el cliente: obliga a traer todas las OT y consumos.
