---
id: 0147
title: Decisiones de abastecimiento por producto; endpoint `sourcing` (fabricar vs comprar y uso como insumo con sensibilidad)
status: Accepted
date: 2026-11-19
author: frontend-team + backend-team
---

# 0147 — Decisiones de abastecimiento por producto

**Relacionado:** `docs/superpowers/specs/2026-11-19-product-sourcing-decisions-design.md`, ADR-0144 (capacidades), ADR-0146 (rendimiento de fabricación), `zero-n-plus-one-policy.md` (ADR-0118).

## Contexto

Un producto que se fabrica y también se compra no tenía una comparación de costo, y un insumo no mostraba en qué productos se usa ni cuánto afecta una subida de su precio al costo y al margen de cada padre.

## Decisión

- **Endpoint `GET /inventory/products/{id}/sourcing/`** (`date_from`, `date_to`, `increase_pct` 1–100, default 10; 400 si son inválidos). La lógica está en `inventory/sourcing_selector.py` y devuelve `make_vs_buy` (solo si `capabilities.manufactures` y `buys`) y `used_in` (solo si `capabilities.used_in_production`), cada uno `null` cuando no aplica.
- **Fabricar vs comprar.** Lado fabricar: costo real por unidad, costo BOM y unidades de ADR-0146 en la ventana. Lado comprar: recepciones confirmadas de la ventana, convertidas a la unidad base; promedio ponderado (Σ cantidad × costo / Σ cantidad base), último costo y fecha. `saving_per_unit = promedio de compra − costo real fabricado` (positivo: fabricar es más barato) y `saving_total` sobre las unidades fabricadas; son `null` si falta alguno de los dos lados, y no se emite recomendación sin datos.
- **Uso como insumo.** Por cada producto padre con BOM activa que contiene al insumo (o a sus variantes): cantidad por unidad base, costo del insumo, costo de la BOM con la misma regla que la pantalla de BOM (`BillOfMaterialsSerializer.get_total_cost`: líneas tercerizadas a `quantity × unit_price`, el resto a la cantidad convertida × `cost_price`, todo dividido por `yield_quantity`), peso en la BOM y, con la subida `increase_pct`, aumento de costo y margen antes y después (`null` con divisor 0). El modelo permite una sola BOM activa por producto.
- Frontend: tab «Abastecimiento», visible si `(manufactures && buys) || used_in_production`.

## Consecuencias

- El costo del insumo es el ponderado actual (`cost_price`), no el último de compra.
- Rotación, cobertura y suscripciones quedan para la 3c-2.

## Alternativas descartadas

- Dos endpoints/tabs: duplica la carga y los controles de ventana.
- Recomendar automáticamente fabricar o comprar: oculta la falta de datos y el efecto de volumen.
