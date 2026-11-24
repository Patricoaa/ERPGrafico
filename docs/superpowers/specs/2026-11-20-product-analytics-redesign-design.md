# Rediseño del análisis de producto (ProductAnalyticsModal)

Estado: borrador para aprobación. Fecha: 2026-11-20.
Extiende ADR-0144 (capacidades), 0145–0148 (bloques de análisis) y 0149 (Metric). Requiere ADR nuevo (cambia contrato de un modal público y el contrato de endpoints de insights).

## Intención

El modal presenta hoy los mismos bloques (KPIs arriba, gráfico y tabla 50/50) para todo producto y todo tab. Eso es monótono y no destaca lo que importa a quien decide. El usuario decide sobre un producto: abastecer, retirar, evaluar desempeño, medir costos, comparar precios. Cada tab debe responder la pregunta de decisión que corresponde al producto, con la visualización más adecuada y un layout que cambia según el producto y sus datos.

## Objetivos

1. El segmento (`SEGMENT_LABELS`) deja de mostrarse. Sigue existiendo como dato interno para elegir composiciones.
2. Control de período único en el pie del riel (slot `bottom` de `RailNav`, como `GranularityControl` en `AnalyticsPanel`). Opciones: 1 m, 3 m, 6 m, 12 m, 24 m, Histórico. En móvil se replica sobre el contenido (patrón de `AnalyticsPanel`).
3. Cada tab es un bloque propio en `features/inventory/analytics/*Block.tsx`, con su hook y su endpoint, carga lazy al activarse.
4. `SkeletonShell` en la carga de datos de todos los tabs (el bloque con datos placeholder es el skeleton; sin textos "Cargando…").
5. Layout dinámico: la composición de cada bloque depende de capacidades/segmento y de los datos (hallazgos que suben al tope).
6. Revisar el contenido de cada tab por segmento según la decisión que apoya (ver "Contenido por tab").

## No objetivos

- Cambiar las reglas de visibilidad de tabs (`TAB_RULES`) salvo que el contenido nuevo lo exija. Fusionar o eliminar tabs queda fuera; si el rediseño por segmento muestra solapamiento (Precio vs Precio y margen; Ventas vs Clientes), se propone en revisión, no se decide aquí.
- Motor genérico de layouts declarativos (enfoque B descartado).
- Nuevas métricas que requieran datos que el sistema no captura.
- Cambios a los drawers que abren las acciones (movimientos, OT).

## Anti-objetivos

- Que dos productos de segmentos distintos vean el mismo layout en un mismo tab.
- Que el período del riel no afecte a algún tab sin avisarlo (cada KPI/gráfico dice si es "del período" o "a hoy").
- Texto de carga o skeleton que no coincida con el layout real (layout shift).

## Restricciones (invariantes del repo)

Cero `any`; tokens semánticos; hooks de feature para `useQuery`; entidades con `defineEntity` y `Collection`; barrels; componentes compartidos con loading/empty/error; vistas Django ≤ 20 líneas con lógica en selectors/services; cero N+1. Ver CLAUDE.md. Playbooks: add-endpoint, add-selector, add-feature, component-skeleton, component-metric, component-entity-view.

## Enfoques considerados

- A. Variantes de JSX escritas a mano por bloque y segmento: simple, pero duplica código y dispersa la lógica de énfasis.
- B. Registro declarativo + motor de grilla: flexible, caro y sobredimensionado para 13 tabs.
- **C (elegido). Híbrido:** bloques propios que componen piezas compartidas con una función de composición por bloque, que recibe capacidades y datos.

Persistencia de datos: se eligió un **endpoint por bloque** (no un `insights` único con `date_from`). Razón: carga lazy con skeleton propio y sin cargar datos de tabs no visitados.

## Diseño

### Estado y flujo

- `ProductAnalyticsModal` guarda el período (`PeriodKey = "1m" | "3m" | "6m" | "12m" | "24m" | "all"`) y lo pasa a cada bloque. `all` omite `date_from`.
- Un único helper (reemplaza `monthsAgoIso`) convierte `PeriodKey` en `date_from`.
- Las capacidades dejan de venir del `insights` monolítico. Se necesita una fuente barata (endpoint `capabilities` o campo en el detalle del producto) para decidir tabs y composición antes de cargar los bloques. El `insights` monolítico se retira cuando todos los bloques migren.
- Cada bloque: hook (`useProduct<Tab>`) → `SkeletonShell` con el bloque real sobre datos placeholder → composición.
- Valores "a hoy" (stock actual, valoración, precio vigente, costo ponderado vigente) no se filtran por período y se rotulan "Hoy".
- Comparación con período anterior: solo cuando el período no es `all`. El backend la devuelve como `previous` en los KPIs que la usen.

### Piezas compartidas (nuevas, en `@/components/shared` o `features/inventory/analytics/parts`, según el contrato del repo)

- KPI protagonista (Metric grande con tendencia y comparación).
- Tarjeta de tendencia (`ChartCard` + `AnalyticsChart`, con rango y marcas de eventos).
- Ranking (barras horizontales con valor y proporción).
- Alerta/hallazgo (aviso con severidad y acción).
- Tabla (`Collection`).

Las piezas se componen con una función `compose(capabilities, data)` por bloque que devuelve el orden y tamaño de las secciones. Reglas de ejemplo: hallazgos con severidad alta suben al tope; secciones sin datos se omiten (no se rellenan con vacíos); el KPI protagonista cambia según el segmento.

### Contenido por tab

La decisión de cada segmento es la acordada:
- Fabricable: costear y fijar precio (margen real vs BOM, fabricar vs comprar).
- Insumo: abastecer (cobertura, precio de compra, proveedores).
- Almacenable/consumible: retirar o reponer (rotación, stock inmóvil, margen).
- Servicio/suscripción: medir desempeño (ingreso recurrente, clientes, variación de precio).

Primera propuesta (a refinar en el plan, tab por tab; son mis llamadas, no decisiones del usuario):

| Tab | Pregunta | Fabricable | Insumo | Almacenable / consumible | Servicio / suscripción |
|---|---|---|---|---|---|
| Resumen | ¿Cómo está el producto? | Margen del período + costo real vs BOM + hallazgos | Cobertura + último costo + proveedor principal | Stock, rotación y valor inmóvil + margen | Ingreso del período + clientes activos |
| Ventas | ¿Cuánto y a qué margen se vende? | Margen % protagonista; ingreso vs costo | (no aplica si no vende) | Unidades y margen; estacionalidad | Ingreso y variación vs período previo |
| Precio y margen | ¿Qué reglas mueven la venta? | Igual que hoy, reorganizado con KPI | — | Igual | Igual |
| Compras | ¿Compro bien? | Compras si también compra | Costo unitario y volumen; tendencia | Costo y volumen | Costo (si compra) |
| Precio | ¿Cómo evoluciona mi precio? | Línea de precio con costo superpuesto | — | Línea de precio | Línea de precio y variaciones |
| Costos | ¿Cuánto cuesta? | Costo vs BOM | Evolución del costo | Evolución del costo | Costo (si compra) |
| Mov. Stock | ¿Qué entra y sale? | Entradas/salidas con origen (OT, venta) | Entradas por proveedor | Flujo + saldo | — |
| Producción | ¿Cómo se consume/fabrica? | Producidos | Consumo por OT y producto padre | Consumo si es componente | — |
| Fabricación | ¿Cuánto se desvía lo real del BOM? | Tal como hoy, con costo real como KPI | — | — | — |
| Abastecimiento | ¿Fabrico o compro? ¿Qué pasa si sube el insumo? | Fabricar vs comprar | Sensibilidad por padre | — | — |
| Operación | ¿Se mueve el stock? ¿Cuánto cuestan las suscripciones? | Rotación | Rotación y cobertura | Rotación e inmóvil protagonista | Suscripciones |
| Clientes | ¿Quién compra? | Ranking + concentración | — | Ranking + concentración | Ranking + recurrencia |
| Proveedores | ¿A quién compro? | Ranking | Ranking + precio por proveedor | Ranking | — |

### Backend

Un endpoint por tab nuevo (`url_path`), con parámetros `date_from`/`date_to` validados con serializer de parámetros (patrón de `operations_params`/`sourcing_params`), selectors sin N+1 y vistas ≤ 20 líneas. Los endpoints existentes (`sales-impact`, `production-performance`, `operations`, `sourcing`) mantienen su contrato salvo el rango, que pasa a aceptar los seis valores (incluido sin `date_from` = histórico).

### Pruebas

Vitest por bloque (composición según segmento, estados loading/empty/error), registro de período, y pytest por selector (con período y sin período, y conteo de queries).

## Decisiones del usuario

- Segmento solo interno.
- Selector de período (1, 3, 6, 12, 24 m, histórico) en el pie del riel.
- `SkeletonShell` en todos los tabs.
- Cada tab es su propio bloque.
- Enfoque C, endpoint por bloque.
- Layout dinámico por producto y datos; contenido repensado por segmento y decisión.

## Llamadas mías (a revisar)

- Fuente de capacidades separada del `insights`.
- Valores "a hoy" no filtrados por período y rotulados.
- Comparación con período anterior solo si el período no es histórico.
- La tabla "Contenido por tab" es una propuesta inicial; el plan la detalla por tab.
- No fusionar tabs en esta iteración.
- Se omiten secciones sin datos en vez de mostrar vacíos.

## Queda al implementador

- Nombres exactos de endpoints, hooks y tipos.
- Ubicación de las piezas compartidas según `component-decision-tree.md`.
- Forma exacta de los hallazgos y umbrales de severidad.
- Orden de migración tab por tab y retiro del `insights` monolítico.
- Mockups visuales finos de cada composición.
