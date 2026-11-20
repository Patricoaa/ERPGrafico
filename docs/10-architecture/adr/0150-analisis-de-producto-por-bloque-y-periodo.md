---
id: 0150
title: Análisis de producto por bloque, con período único y capacidades separadas
status: Accepted
date: 2026-11-20
author: frontend-team + backend-team
---

# 0150 — Análisis de producto por bloque, con período único y capacidades separadas

**Relacionado:** `docs/superpowers/specs/2026-11-20-product-analytics-redesign-design.md`, `docs/superpowers/plans/2026-11-20-product-analytics-foundation.md`, ADR-0144 (capacidades), ADR-0145 a ADR-0148 (bloques de análisis), ADR-0149 (Metric).

## Contexto

El modal «Análisis de producto» cargaba un endpoint monolítico (`insights`) con todo el histórico y mostraba los mismos bloques (KPIs, gráfico y tabla 50/50) para cualquier producto. Los cuatro bloques posteriores (ADR-0145 a 0148) tenían cada uno su propio selector de rango y un texto «Cargando…», y las capacidades solo estaban disponibles dentro de `insights`. No se podía comparar períodos entre tabs ni presentar a cada producto los datos que apoyan su decisión (abastecer, retirar, evaluar desempeño, medir costos, comparar precios).

## Decisión

- **Cada tab es un bloque propio** en `features/inventory/analytics/`, con su hook y su endpoint, que se monta y consulta solo al activarse. Los nueve tabs que aún dependen de `insights` viven aislados en `LegacyInsightsPanel` y se migran uno a uno.
- **Período único** (`PeriodKey`: `1m`, `3m`, `6m`, `12m`, `24m`, `all`) en el slot `bottom` de `RailNav` (copia sobre el contenido en móvil). `all` omite `date_from`; los endpoints ya lo aceptan opcional. Los bloques reciben `period` y dejan de tener selector de rango propio. Un cambio de `date_from` muestra el skeleton (no datos de otro período); los filtros finos de un bloque sí conservan los datos previos.
- **Capacidades separadas:** `GET /inventory/products/{id}/capabilities/` devuelve el mismo payload que `capabilities` de `insights`. El modal no muestra tabs ni consulta bloques hasta tenerlas.
- **Segmento interno:** el segmento deja de mostrarse en la UI (`SEGMENT_LABELS` se elimina); sigue en `capabilities.segment` para elegir composiciones.
- **Carga con `SkeletonShell`** en todos los bloques mediante `AnalyticsBlockFrame` (carga, error, vacío).
- **8 tabs por decisión** (reemplazan a los 13 por origen de dato): Resumen (siempre), Ventas y Precio y margen (`sells`), Costos (`buys` o `manufactures` o `tracks_stock`), Abastecimiento (`buys`), Inventario (`tracks_stock`), Producción (`manufactures` o `used_in_production`) y Suscripción (`recurring`). Absorben Clientes, Precio, Compras, Proveedores, Mov. Stock, Operación, Fabricación y el antiguo Abastecimiento (fabricar vs comprar pasa a Costos; «uso como insumo» a Producción). Mientras se migra cada tab, `TabContent` apila el contenido actual que absorbe.
- **Zona Vista del riel:** bajo «Período», cada bloque entrega sus controles contextuales (métrica, agrupar por, stock inmóvil, subida de precio del insumo) mediante `RailControls` (portal; copia móvil sobre el contenido). Se elimina el selector manual de granularidad.
- **Granularidad automática** según el período: 1 m día; 3 y 6 m semana ISO; 12 y 24 m mes; Histórico año. `sales-impact` acepta `granularity=week` (etiqueta `AAAA-Www`, año ISO).
- **Layout dinámico por composición:** cada bloque compone piezas compartidas según capacidades y datos; la definición de cada tab por segmento se hace en un plan por tab.

- **Primer tab migrado: Precio y margen** (`pricing`). Bloque propio `PricingBlock` con endpoint `GET /inventory/products/{id}/pricing/` (margen realizado vs período anterior, precio de lista contra precio realizado y unidades, y «Antes vs después» de cada cambio de precio o regla con ventanas de 28 días). Ya no usa `insights`, por lo que no muestra el aviso de histórico.

## Consecuencias

- Mientras existan tabs legados, el período no los afecta; el modal avisa «Este tab muestra todo el histórico» cuando el período no es Histórico. El aviso se retira tab por tab.
- `insights` se mantiene hasta migrar el último tab legado; después se retira.
- Cada tab nuevo agrega un endpoint con parámetros `date_from`/`date_to` validados por serializer, lógica en selector y vistas ≤ 20 líneas.
- `useProductOperations` deja de usar `keepPreviousData` incondicional (ADR-0148): conserva datos solo si no cambia `date_from`.
