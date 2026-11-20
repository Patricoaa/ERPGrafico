---
id: 0148
title: Rotación, cobertura y suscripciones por producto; endpoint `operations`
status: Superseded by 0150
date: 2026-11-19
author: frontend-team + backend-team
---

# 0148 — Rotación, cobertura y suscripciones por producto

> **Reemplazada por [ADR-0150](0150-analisis-de-producto-por-bloque-y-periodo.md) (2026-11-20):** el endpoint `operations` y `OperationsBlock` se retiraron; la rotación y la cobertura (`OperationsSelector._rotation`, `coverage`) se conservan y las usan `stock-analysis` y `procurement`; las suscripciones pasaron a `subscription-analysis`.

**Relacionado:** `docs/superpowers/specs/2026-11-19-product-operations-design.md`, ADR-0144 (capacidades), ADR-0147 (abastecimiento), `zero-n-plus-one-policy.md` (ADR-0118).

## Contexto

Un producto con stock mostraba el kardex pero no si rota, cuántos días cubre su stock ni si está inmóvil; una suscripción no mostraba su costo anualizado, los pagos próximos ni cuánto subió lo pagado.

## Decisión

- **Endpoint `GET /inventory/products/{id}/operations/`** (`date_from`, `date_to`, `idle_days` entero 1–365 con default 90; 400 si son inválidos). La lógica está en `inventory/operations_selector.py` y devuelve `rotation` (si `capabilities.tracks_stock`) y `subscriptions` (si `capabilities.recurring`), cada uno `null` cuando no aplica.
- **Rotación.** Usa la misma clasificación de flujo que `ProductSelector._stock_flow` (extraída a `_flow_case`): traspasos y ajustes no cuentan como entrada/salida, pero el stock sí varía con ellos. `avg_stock` es el promedio ponderado por días de la serie acumulada en la ventana; `turnover = salidas / avg_stock` y `days_of_inventory = días de la ventana / turnover`, ambos `null` si no hay stock promedio o salidas. `coverage_days = stock actual / (salidas de los últimos 90 días / 90)`, `null` sin salidas recientes. Un producto es **inmóvil** si tiene stock y su última salida supera `idle_days` (o nunca salió). Se miden desde `date_to`. Las fechas de suscripciones (`days_to_payment`, próximos 90 días) se miden desde hoy, porque `next_payment_date` es estado actual.
- **Suscripciones.** Costo anualizado = monto × (semanal 52, mensual 12, trimestral 4, semestral 2, anual 1); los totales y los pagos de los próximos 90 días cuentan solo las suscripciones activas. Los pagos son líneas de compra del producto en órdenes no borrador ni anuladas (últimas 24), con la variación respecto al pago anterior **del mismo proveedor**; la variación de primero a último solo se informa si todos los pagos son de un proveedor.
- Frontend: tab «Operación», visible si `tracks_stock || recurring`; el hook conserva los datos previos mientras carga una nueva ventana (`keepPreviousData`).

## Consecuencias

- La cobertura usa los últimos 90 días fijos; el umbral de inmovilidad es configurable en pantalla.
- Los pagos de suscripción se leen de las órdenes de compra, no de un registro propio de pagos.
- Con una suscripción pagada sin orden de compra, la lista de pagos queda vacía.
- Los pagos son líneas de compra del producto: las órdenes generadas para suscripciones de monto fijo copian el monto configurado y llevan la fecha de generación, así que la variación refleja cambios del monto configurado más que importes facturados; también cuentan otras compras del mismo producto.

## Alternativas descartadas

- Dos endpoints y dos tabs: duplica carga y controles de ventana.
- Proyectar pagos futuros más allá del próximo vencimiento: sin calendario de pagos no hay base confiable.
