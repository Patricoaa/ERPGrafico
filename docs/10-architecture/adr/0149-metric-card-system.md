---
id: 0149
title: Sistema de cards de métrica — Metric, MetricStrip y ChartCard reemplazan a StatCard
status: Accepted
date: 2026-11-20
author: frontend-team
---

# 0149 — Sistema de cards de métrica: `Metric`, `MetricStrip` y `ChartCard`

**Related:** ADR-0097 (familia de cards, rol `metric`), ADR-0142 (escala fluida y dial de densidad), ADR-0087 (entity-view), `docs/20-contracts/component-statcard.md`, `docs/20-contracts/component-card-family.md`, `docs/20-contracts/typography-scale.md`, `docs/20-contracts/density-system.md`, [DESIGN.md](../../../DESIGN.md)

Boceto visual aprobado (2026-11-20): https://claude.ai/artifact/WX821DtYYzqCzUExYcdfY2

---

## Context

`StatCard` es el componente autorizado para tarjetas de KPI, estadística y gráfico (`component-statcard.md`). Un relevamiento del 2026-11-20 muestra que el sistema se partió en cuatro capas que no se hablan entre sí.

### 1. `StatCard` son cuatro componentes en uno

El contrato dice "3 variantes"; el código tiene 6. Conteo sobre ~138 usos (incluye JSX multilínea; los usos con `variant` dinámico no entran):

| Variante | Usos | Qué es realmente |
|---|---|---|
| `default` | 120 | Métrica |
| `chart` | 11 | Panel de gráfico, no métrica |
| `minimal` | 5 | Métrica sin icono |
| `fill` | 1 | Métrica centrada con icono grande |
| `compact` | 0 | Métrica con fondo teñido |
| `metric-chart` | 0 en JSX (solo en configs `*AnalyticsScreen`) | Panel de gráfico con valor en el encabezado |

`chart` y `metric-chart` rompen el rol `metric` de ADR-0097: son paneles. `StatCardConfig` (AnalyticsPanel) promete además `hero`, `tile` y `progress` y un campo `progress`, que `StatCard` no implementa.

### 2. Incoherencias con el design system

- **Tipografía.** `globals.css` define `kpi-value` y `kpi-value-compact`, pero `StatCard` no los usa: reimplementa `text-3xl font-black tracking-tighter` y le suma un `text-sm` en conflicto. El principio 4 de DESIGN.md pide JetBrains Mono para cifras; los KPI usan Onest negro 900 sin `tabular-nums` garantizado.
- **Etiqueta.** `cardAnatomy.eyebrow` existe y `StatCard` repite sus clases a mano, lo que `component-card-family.md` §5 prohíbe.
- **Color.** `accent` se usa como decoración (info 29, primary 25, warning 18, success 14, muted 8, destructive 8, accent 4). `accentBg` tiñe el fondo sin significar nada, contra el principio 2 de DESIGN.md (K100 acción, cyan énfasis, semánticos con intención).
- **Elevación.** `surface-panel` ya trae borde; `shadow-card` agrega una sombra encima (el patrón "ghost card").
- **Densidad.** `fill` (icono de 24 px, `p-5`, centrado) contradice "compact por defecto" (principio 3). `StatCard` no sigue el dial de ADR-0142: el tamaño lo elige cada llamada con `valueSize`.
- **Contraste.** `text-success` sobre fondo claro queda bajo 4,5:1 (texto de variación y `DeltaBadge`).

### 3. Cards de KPI hechas a mano que escapan al ratchet

`card-family.contract.test.ts` solo detecta `border + rounded + bg-card` en un mismo literal. Siguen vivos: `StatementDetailPanel` (4 `Card` shadcn con `text-xl font-bold font-mono`), `TaxDeclarationsClientView` (usa `CardDescription` como valor), `BankPositionSection` (3 bloques con `text-2xl font-black tracking-tighter` y etiqueta copiados), `SessionCashSummary`, `DocumentTotalsBox`, `ProductionMetricsCard` (`Card` contenedor con `StatCard minimal` adentro).

### 4. Piezas sueltas que cada pantalla combina a mano

`KPIWrapper` (tooltip que pone `cursor-help` a toda la tarjeta, incluso a las clicables), `KPIValue` ("Actual / Anterior" apilado), `DeltaBadge` (no lo usa `StatCard`), `SectionCard`, `ChartLegend` y `getRatioHealth` (salud cualitativa, en `RatiosDashboard`).

### Usos que el sistema debe cubrir

Valor simple; valor con comparación de período; costo que sube (variación invertida); valor con salud cualitativa; flujo de entrada y de salida; filtro (activo/inactivo); enlace; progreso; tendencia; saldo con datos secundarios; sin datos; error de carga; cargando; lista de totales (ledger); panel de gráfico con leyenda.

---

## Decision

### 1. Tres componentes con una sola anatomía

| Componente | Rol (ADR-0097) | Para qué |
|---|---|---|
| `Metric` | `metric` | Un dato: etiqueta, valor, variación, contexto y un espacio visual. |
| `MetricStrip` | `metric` | Varias `Metric` en una sola superficie con divisores finos (filas de KPI en cabeceras, drawers y modales). |
| `ChartCard` | `panel` | Un gráfico con cabecera (icono, título, subtítulo, leyenda, variación). El valor no es el protagonista. |

Import: `import { Metric, MetricStrip, ChartCard } from '@/components/shared'`.

Se eliminan las variantes `default`/`compact`/`minimal`/`fill`/`chart`/`metric-chart` y las props `accent`, `valueSize` y `children`. Las listas de totales alineadas (ledger) **no** son `Metric`: siguen siendo `Section.Row variant="stat"` (se corrige `DocumentTotalsBox`, que arma su superficie a mano).

### 2. Anatomía de `Metric`

Siete piezas; solo etiqueta y valor son obligatorias.

1. **Etiqueta** — `cardAnatomy.eyebrow`.
2. **Información** — botón ⓘ con la definición del dato (reemplaza a `KPIWrapper`). Tooltip por hover y foco de teclado; nunca `cursor-help` sobre la tarjeta.
3. **Icono guía** — `CardLead` pequeño con fondo neutro; solo el icono toma el tono.
4. **Valor** — tokens `kpi-value` / `kpi-value-compact` (ver §3), `tabular-nums`, con `unit` opcional.
5. **Variación** — integra `DeltaBadge` y el apilado "Actual / Anterior": flecha, signo y porcentaje junto al valor. `inverse` marca que bajar es bueno (costos).
6. **Contexto** — una línea (valor previo, período o significado). Siempre texto.
7. **Visual** — un solo espacio discriminado: `{ kind: 'progress' }`, `{ kind: 'spark' }`, `{ kind: 'facts' }` o ninguno. La tendencia lleva el dato escrito (mín/máx y período), nunca un sparkline decorativo.

Más una **salud** opcional (`health`): un `StatusBadge` con la etiqueta cualitativa ("Saludable", "Crítico"), que sustituye al `getRatioHealth` a mano. `StatusBadge` sigue siendo el único renderer de estado (invariante 7).

```tsx
<Metric
  label="Ingresos por ventas"
  info="Monto de ventas confirmadas en el período, sin impuestos."
  lead={Banknote}
  tone="success"
  value={formatCurrency(sales.total)}
  delta={{ current: sales.total, previous: prev.total }}   // calcula % y flecha
  context={<>vs <b>{formatCurrency(prev.total)}</b> · mes anterior</>}
  visual={{ kind: 'progress', current: 412, max: 530, noun: 'órdenes cobradas' }}
/>
```

### 3. Tipografía y densidad

- `kpi-value` y `kpi-value-compact` pasan a **JetBrains Mono** (`font-mono`, peso 700, `tracking-[-0.045em]`, `tabular-nums`) y son la única fuente del tamaño del valor. Etiquetas, contexto y texto siguen en Onest. Aplica también a los valores de `facts`. *(Decisión del usuario, 2026-11-20.)*
- **Compacta por defecto**, coherente con `density-system.md` (`data-density="compact"`). `Metric` no tiene `valueSize`: el tamaño lo dicta el dial de ADR-0142 y el ancho del contenedor. Con container queries, una celda de menos de 230 px usa `kpi-value-compact`. `comfortable` queda como opt-out vía `DensityScope`.
- Los tamaños exactos salen de la escala fluida (`typography-scale.md`), sin valores en px. El boceto usó ~22–27 px; se calibra al implementar contra los tokens `text-xl`/`text-2xl`.

### 4. Color: el tono significa algo

- Prop `tone`: `neutral` (default) | `success` | `warning` | `destructive` | `info`. Se elimina `accent` y todo fondo teñido.
- El tono solo aparece en el icono del `CardLead` y en el texto de la variación. Nunca en el fondo ni en un borde de color.
- El estado nunca lo lleva solo el color: va con icono, signo o texto (invariante 7 y regla de `CardRail`).
- Flujos de dinero usan los tokens `--income`/`--expense` (entrada/salida) en el icono.
- Texto de variación sobre fondo claro: se agrega un token `*-text` más oscuro para `success` y `warning` (el `text-success` actual queda bajo 4,5:1). El nombre exacto y los valores se fijan en `color-system.md` al implementar.

### 5. Superficie e interacción

- Superficie: `CardSurface` en modo informativo, `surface-panel` (12 px) con **borde fino y sin `shadow-card`** (se declara una sola elevación).
- Solo hay tres modos: informativa; **enlace** (`href`, con chevron al final); **filtro** (`onPress` + `pressed`, con `aria-pressed`, aro grueso con separación y el texto "Filtrando"). Nunca ribbon CMYK (queda para `choice`).
- `loading` muestra un esqueleto de la **misma altura** que la tarjeta real (`component-skeleton.md`); `error` y vacío son estados de primera clase (`—` + contexto, y "Reintentar" en el error). Cumple invariante 8.
- Valor largo: nunca se recorta; baja un paso de escala por container query o hace `wrap` en la variación.

### 6. `MetricStrip`

Una superficie `surface-panel` con celdas `Metric` sin borde ni radio, separadas por divisores de 1 px. La grilla es `auto-fit` (4 → 2 → 1 columnas según el ancho del contenedor, no de la ventana). Reemplaza las grillas manuales (`KPI_GRID` de `ProductAnalyticsModal`, `grid-cols-2 xl:grid-cols-4`) y reduce a una la cantidad de bordes de una fila de KPI.

### 7. `ChartCard`

Reutiliza `CardLead`, el título y el bloque de variación de `Metric`. Slots: `title`, `subtitle`, `legend` (`ChartLegend`), `delta` y el gráfico como children. Absorbe `variant="chart"` y `metric-chart` (un valor en el encabezado pasa a ser un `Metric` dentro de un `MetricStrip` arriba del gráfico). `SectionCard` se retira a favor de `ChartCard`.

### 8. AnalyticsPanel

`StatCardConfig` se reemplaza por una unión discriminada `{ type: 'metric', ... } | { type: 'chart-card', ... }`. `AnalyticsLayout/SectionRenderer` solo mapea cada sección a `Metric` o `ChartCard`; el tooltip y la comparación dejan de ser envoltorios externos. Se descartan las variantes prometidas y no implementadas (`hero`, `tile`, `progress` como variante): el progreso es un `visual` de `Metric`.

---

## Alternatives considered

1. **Mantener `StatCard` y limpiar variantes.** Resuelve el conteo de variantes pero deja los cuatro componentes en uno y el `accent` decorativo. Descartada.
2. **Un único `Metric` con `variant="chart"`.** Mezcla roles (`metric` vs `panel`) y repite el problema de hoy. Descartada.
3. **Seguir con Onest negro 900 para los valores.** Contradice el principio 4 de DESIGN.md y no garantiza columnas alineadas. El usuario eligió JetBrains Mono.
4. **Densidad cómoda por defecto.** Contradice el principio 3 y el contrato de densidad. El usuario eligió compacta.
5. **Sparklines en todas las tarjetas.** Cuesta altura y distrae; el espacio `visual` admite tendencia solo cuando hay un dato que mostrar y se describe en texto.

## Consequences

**Positivas**
- Una sola anatomía y un solo contrato para ~138 usos; las 14 formas actuales de resolver un KPI colapsan en tres componentes.
- Cohesión con el design system: tokens de tipografía y color usados, borde sin sombra, dial de densidad, `CardLead`/`cardAnatomy`.
- Mejor densidad: `MetricStrip` elimina cuatro bordes y sombras por fila.
- Accesibilidad: tooltip por teclado, `aria-pressed`, estado nunca solo por color, contraste AA en variación.

**Negativas / riesgos**
- **Cambio visible en ~100 tarjetas:** desaparecen los fondos teñidos por acento y las cifras pasan a mono. Se valida por oleada.
- Migración larga con un adaptador temporal (`StatCard` → `Metric`) que debe tener fecha de retiro.
- El nuevo token `*-text` agrega superficie al sistema de color.
- Los conteos de uso vienen de análisis de texto del JSX; los usos con `variant` dinámico pueden faltar y se descubren al migrar.

## Migration plan

1. **Cimientos (hecho en la rama `feat/metric-card-system`).** `Metric`, `MetricStrip` y `ChartCard` en `components/shared`; `kpi-value*` en mono y tokens `success-text`/`warning-text` en `globals.css`; tests de componente y ratchet de importadores; stories; contrato `component-metric.md`. `StatCard` queda marcado `@deprecated` **sin** adaptador: remapearlo en este paso cambiaría ~138 tarjetas sin revisión visual por módulo, así que cada oleada migra sus consumidores directamente a `Metric`.
2. **Oleada A — analytics.** `AnalyticsLayout`, `ProductAnalyticsModal` (36 usos) y bloques de inventario (`SalesImpactBlock`, `ProductionPerformanceBlock`, `SourcingBlock`, `OperationsBlock`). **Hecha:** además de lo listado se migraron todas las pantallas `*AnalyticsScreen` (el tipo `StatCardConfig` pasó a la unión `metric | chart-card`), `MovementClientView`, `treasuryMovementAnalyticsScreen` y las vistas de estados de tarjeta, que consumían ese tipo (adelantadas desde la oleada C). Enmienda: `ChartCard` gana `figure` (reemplaza `metric-chart`) y `fill`.
3. **Oleada B — finanzas.** `BIAnalyticsDashboard`, `RatiosDashboard`, `BalanceSheetKPIs`, `BudgetVarianceReport`, `BudgetDetailView`. **Hecha:** los cinco archivos migrados; `getRatioHealth` ahora devuelve `MetricHealth` (StatusBadge) y la comparación de período usa `delta` en vez de «Actual/Anterior».
4. **Oleada C — tesorería e inventario.** Estados de tarjeta, préstamos, pestañas de sesión POS, `MovementClientView`, `treasuryMovementAnalyticsScreen`. **Hecha:** también se migraron `ContactDrawer` (modo filtro con `onPress`/`pressed`), `AutoMatchProgressModal`, `SubscriptionHistoryModal`, `SubscriptionsClientView` y `ProductionMetricsCard`, que figuraban en D. Las tiras de 5 celdas (ventas de sesión POS, préstamos) se parten en dos `MetricStrip` 3+2 porque la tira admite hasta 4.
5. **Oleada D — a mano.** `StatementDetailPanel`, `TaxDeclarationsClientView`, `BankPositionSection`, `ProductionMetricsCard`, `ContactDrawer`, `DocumentTotalsBox` (hacia `Section.Row`) y `SessionCashSummary`.
6. **Cierre.** Retirar el adaptador, `KPIWrapper`, `SectionCard` y las variantes de `StatCardConfig`; actualizar contratos. **Hecho (2026-11-20):** se eliminaron `StatCard`, `KPIComponents` (`KPIWrapper`, `KPIValue`, `DeltaBadge`, `SectionCard`), `KpiCardDef`/`kpiCards` de `DataTable` y el baseline; el test de contrato pasó a prohibir su regreso. `SkeletonPresets.StatCard` se renombró `Metric`. Oleada D: `BankPositionSection`, `SessionCashSummary` y `DocumentTotalsBox` solo adoptan los tokens `kpi-value`/`surface-panel` (son tarjetas de cuenta, recibo y totales, no `Metric`).

## Ratchet

`lib/__tests__/metric-family.contract.test.ts` + `metric-family.baseline.json` (fase 1): ningún archivo nuevo puede referenciar `StatCard`; el baseline (28 archivos al 2026-11-20) solo puede encoger, y cuando queda vacío se borran `StatCard`, `KPIWrapper` y `SectionCard`.

Se descartó el detector de "valor KPI escrito a mano" (`text-(2xl|3xl)` con `font-black`/`tracking-tighter`): el 2026-11-20 devolvía 19 archivos, la mayoría titulares y totales que no son KPI (login, buscador, error boundary), así que el ratchet de importadores es el que mide la migración sin falsos positivos. Los KPI hechos a mano (`StatementDetailPanel`, `TaxDeclarationsClientView`, `BankPositionSection`…) se migran en la oleada D y se vigilan en revisión.

## Contract and documentation changes (con esta ADR)

- `docs/20-contracts/component-statcard.md` → se reemplaza por `component-metric.md` (anatomía, props, estados, ejemplos) y se deja un puntero.
- `docs/20-contracts/component-card-family.md` → fila `metric`: `Metric`/`MetricStrip`; fila `panel`: añade `ChartCard`.
- `docs/20-contracts/typography-scale.md` y `color-system.md` → `kpi-value*` en mono y token `*-text`.
- `docs/20-contracts/component-decision-tree.md` → "KPI / métrica / stat" apunta a `Metric`; las menciones de `StatCard` y "3 variantes" se corrigen.
- `DESIGN.md` → principio 8 (cards por rol) menciona `Metric`; mapa de referencia con el contrato nuevo.
- `docs/10-architecture/adr/README.md` → fila de esta ADR.

Estos cambios se hacen en el mismo PR que la fase 1, no antes (hasta entonces los contratos describen lo que existe).

## Open points

- Nombre final del token de texto de variación (`success-text` u otro) y sus valores en ambos temas.
- Tamaños exactos de `kpi-value`/`kpi-value-compact` en mono frente a la escala fluida.
- Fecha de retiro del adaptador `StatCard`.
