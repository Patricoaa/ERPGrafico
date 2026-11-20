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

- **Segundo tab migrado: Ventas** (`sales`, absorbe Clientes). Bloque propio `SalesBlock` con endpoint `GET /inventory/products/{id}/sales/` (unidades con variación contra el período anterior superpuesto, clientes distintos reales sin el cliente genérico del POS, devoluciones, repartos por cliente, canal, variante y unidad, y hallazgos). Ya no usa `insights` ni muestra el aviso de histórico.

- **Tercer tab migrado: Costos** (`costs`). Bloque propio `CostsBlock` con endpoint `GET /inventory/products/{id}/costs/`, compuesto por **modo de costo** que decide el servidor: `purchased`, `manufactured_stock`, `manufactured_on_demand`, `manufactured_no_bom` y `stock_only`. La evolución de la BOM es teórica (receta actual valorada con el costo histórico de cada componente) porque la BOM no tiene historial; el costo real por orden la acompaña. Ya no usa `insights` ni muestra el aviso de histórico.
- **Regla de dominio: un fabricable no se compra.** `Product.save()` fuerza `can_be_purchased = False` en fabricables (antes solo lo hacía el formulario) y la migración `inventory.0038` corrige los existentes (reverso `noop`). Efecto: un fabricable no ve Abastecimiento y la sección «Fabricar vs comprar» desaparece; el cálculo `make_vs_buy` de `sourcing` queda sin consumidor hasta retirarse con el legado.

- **Cuarto tab migrado: Abastecimiento** (`procurement`). Bloque propio `ProcurementBlock` con endpoint `GET /inventory/products/{id}/procurement/`: cobertura (cálculo compartido con `operations`), compras con período anterior, proveedores con el preferido marcado y pendiente de recibir. No muestra tiempo de entrega, puntualidad ni punto de pedido: las recepciones suelen registrarse el mismo día que la orden y la fecha planificada no se usa, así que serían inferencia.

- **Quinto tab migrado: Inventario** (`inventory`). Bloque propio `StockBlock` con endpoint `GET /inventory/products/{id}/stock-analysis/`: existencia, valor, comprometido (mismas fuentes que `get_qty_reserved`, en consultas agregadas) y disponible; rotación; stock al cierre con entradas y salidas; flujos por origen y destino; ajustes (merma, sobrante, revalorización); bodegas y variantes. Sin tabla de movimientos (vive en su pantalla). `OperationsBlock` queda solo en Suscripción.

- **Sexto tab migrado: Producción** (`production`). Bloque propio `ProductionBlock` con endpoint `GET /inventory/products/{id}/production-analysis/`, por rol. Como **fabricado**: OT terminadas, unidades, rectificación, consumo real contra planificado por insumo (en cantidad) y órdenes. Como **insumo**: consumo en OT, consumo por producto fabricado y productos que lo usan con su margen tras una subida de precio. Sin tiempos, etapas ni plazos (decisión del usuario) y sin costo (vive en Costos). `ProductionPerformanceBlock` y `SourcingBlock` dejan de montarse en el modal.

- **Séptimo tab migrado: Suscripción** (`subscription`). Bloque propio `SubscriptionBlock` con endpoint `GET /inventory/products/{id}/subscription-analysis/`: costo anualizado, equivalente mensual, activas y próximos 90 días; pagos del período con período anterior; suscripciones con último pago real y su variación; hallazgos de subida de precio, pago distinto al configurado, pago vencido, término próximo y pausadas. Los pagos se asocian por proveedor (las líneas de compra no apuntan a una suscripción). `OperationsBlock` ya no se monta en el modal.

- **Último tab migrado: Resumen** (`overview`). `OverviewBlock` no tiene endpoint propio: llama a los hooks de los tabs visibles (con los mismos parámetros, para compartir caché) y aplica sus funciones `compose*` para mostrar la cifra protagonista de cada tab y todos los hallazgos agrupados, con acceso directo al tab. Con esto ningún tab usa `insights` ni `LegacyInsightsPanel`; se retira el aviso «Este tab muestra todo el histórico» y el acceso a documentos que solo ofrecían las tablas legado.

## Consecuencias

- Todos los tabs respetan el período; el aviso de histórico de la etapa de transición se retiró.
- `insights`, `LegacyInsightsPanel` y los bloques que ya no se montan (`OperationsBlock`, `ProductionPerformanceBlock`, `SourcingBlock`, `SalesImpactBlock` suelto salvo como desglose) quedan sin consumidores en el modal y se retiran en un plan aparte.
- Cada tab nuevo agrega un endpoint con parámetros `date_from`/`date_to` validados por serializer, lógica en selector y vistas ≤ 20 líneas.
- `useProductOperations` deja de usar `keepPreviousData` incondicional (ADR-0148): conserva datos solo si no cambia `date_from`.
