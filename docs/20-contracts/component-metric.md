---
layer: 20-contracts
doc: component-metric
status: active
owner: frontend-team
last_review: 2026-11-20
stability: contract-changes-require-ADR
---

# Metric, MetricStrip y ChartCard — contrato

Cards del rol `metric` y del panel de gráfico (ADR-0149, sobre ADR-0097). Sustituyen a `StatCard` ([component-statcard.md](./component-statcard.md), deprecado). Toda tarjeta que muestre un dato, un KPI, una estadística o un gráfico con cabecera usa estos componentes; ninguna se arma a mano.

```tsx
import { Metric, MetricStrip, ChartCard } from "@/components/shared"
```

## Qué usar

| Necesidad | Componente |
|---|---|
| Un dato con su etiqueta (con o sin variación, progreso, tendencia o datos secundarios) | `Metric` |
| Una fila de 2 a 4 datos relacionados (cabecera de drawer, modal o página) | `MetricStrip` con `Metric` adentro |
| Un gráfico con título, leyenda y variación | `ChartCard` |
| Lista de totales alineados (subtotal, IVA, total…) | `Section.Row variant="stat"` — no es una `Metric` |
| Estado de una entidad | `StatusBadge` (invariante 7) |

## Anatomía de `Metric`

```
┌────────────────────────────────────┐
│ ETIQUETA ⓘ                  [lead] │  1 etiqueta · 2 información · 3 icono guía
│ $12.480.000 uds        ↗ 12,5 %   │  4 valor (+ unidad) · 5 variación
│ [Saludable]                        │    salud (StatusBadge), opcional
│ vs $11.090.000 · mes anterior      │  6 contexto
│ ▁▂▃▅▇  ━━━━━░░  Capital │ Cuotas   │  7 visual: spark | progress | facts
└────────────────────────────────────┘
```

Solo `label` es obligatoria; `value` en `null`/`undefined` se muestra como `—`.

| Prop | Tipo | Notas |
|---|---|---|
| `label` | `string` | Estilo `cardAnatomy.eyebrow`. |
| `info` | `string` | Definición del dato. Botón ⓘ con tooltip por hover y foco. |
| `lead` | `LucideIcon` | `CardLead` pequeño con fondo neutro; solo el icono toma el tono. |
| `tone` | `neutral` (default) · `success` · `warning` · `destructive` · `info` | Ver "Color". |
| `value` | `ReactNode` | La cifra, ya formateada (`formatCurrency`, `formatQuantity`). |
| `unit` | `string` | Unidad tras la cifra. |
| `delta` | `{ current, previous, inverse?, decimals? }` o `{ text, direction, tone? }` | Calcula el % y la flecha. `inverse`: bajar es bueno (costos). |
| `context` | `ReactNode` | Una línea. Valor previo, período o significado. |
| `health` | `{ status, label?, intent? }` | Etiqueta cualitativa vía `StatusBadge`. |
| `visual` | `{kind:'progress',current,max,noun?}` · `{kind:'spark',data,caption}` · `{kind:'facts',items}` | Uno solo. `spark` exige `caption` (qué es y su rango). |
| `href` | `string` | Modo enlace: la etiqueta es un enlace extendido a toda la tarjeta, con chevron. |
| `onPress` + `pressed` | `() => void`, `boolean` | Modo filtro: la etiqueta es un botón con `aria-pressed`; activa muestra aro y `pressedLabel` ("Filtrando"). |
| `loading` | `boolean` | Esqueleto de la misma altura; `role="status"`. |
| `error` | `{ message?, onRetry? }` | `—` + mensaje (`role="alert"`) y "Reintentar". |
| `className` | `string` | Solo layout (ancho, posición). Nunca tipografía ni color. |

### Valor y tamaño

- El valor usa los tokens `kpi-value` (`text-2xl`) y `kpi-value-compact` (`text-xl`): **JetBrains Mono, peso 700, `tracking-[-0.045em]`, `tabular-nums`**. No hay `valueSize`.
- La tarjeta es un container (`@container`): bajo 230 px de ancho el valor usa `kpi-value-compact`. Los tamaños salen de la escala fluida (ADR-0142); no se escriben px.
- Densidad: compacta por defecto (padding `px-3 py-2.5`). Bajo `data-density="comfortable"` sube a `px-4 py-3`.
- Etiquetas, contexto y unidades siguen en Onest. Los valores de `facts` van en mono.

### Color

- El tono **significa algo**: vencido, déficit, entrada/salida, variación buena o mala. El valor neutro es la norma.
- Aparece solo en el icono del lead, en el texto de la variación y en el relleno de `progress`. **Nunca** como fondo teñido ni borde de color.
- El estado nunca lo lleva solo el color: va con flecha/signo, icono o texto.
- Texto sobre `bg-card`: `text-success-text` y `text-warning-text` (tokens nuevos, ≥ 4,5:1 y se aclaran en `.dark`). `text-success`/`text-warning` solo para rellenos.
- Entradas y salidas de dinero: `success`/`destructive` en el icono del lead.

### Interacción

- **Informativa** (default): sin cursor ni hover.
- **Enlace** (`href`): `Link` en la etiqueta con `after:absolute after:inset-0`. El control de la tarjeta es la etiqueta; el ⓘ y "Reintentar" quedan por encima (`z-10`) para no anidar controles.
- **Filtro** (`onPress`): ídem con `<button aria-pressed>`.
- Nunca el ribbon CMYK (reservado a `choice`).
- Un ⓘ dentro de una tarjeta pulsable sigue siendo un control independiente.

## `MetricStrip`

Una superficie `surface-panel` con celdas `Metric` sin borde ni radio, separadas por divisores de 1 px.

- `label` (obligatorio): nombre accesible del grupo (`role="group"`).
- Soporta **2 a 4** celdas. Las columnas dependen del ancho del propio strip (container queries): 4 celdas → 1 · 2 · 4; 3 celdas → 1 · 3. Nunca queda una fila a medias. Para más de 4 indicadores, usa dos strips.

## `ChartCard`

Panel (rol `panel`) con cabecera compartida con `Metric`.

| Prop | Notas |
|---|---|
| `title`, `subtitle` | Título (`h3`) y línea secundaria. |
| `lead`, `tone` | Igual que `Metric`. |
| `legend` | `{ label, color? }[]` → `ChartLegend`. |
| `delta` | Mismo `MetricDelta`. |
| `actions` | Slot a la derecha (granularidad, exportar). |
| `children` | El gráfico; recibe `size-full`. |
| `loading` / `empty` / `error` | Esqueleto, texto de vacío y error con "Reintentar". |
| `bodyClassName` | Alto del cuerpo (default `h-56`). |

El valor no es el protagonista: si el dato principal es una cifra, ponla en un `Metric` (o `MetricStrip`) sobre el gráfico.

## Reglas

1. Nunca `border rounded bg-card` a mano para un dato ni un gráfico con cabecera; ni `CardTitle`/`CardDescription` como valor.
2. Nunca escribir a mano el valor (`text-(2xl|3xl) font-black tracking-tighter`): usar `Metric` o los tokens `kpi-value*`.
3. Un KPI sin dato muestra `—` y contexto; no se oculta.
4. `Metric` no se envuelve en `Card` ni se anida dentro de otra card de superficie.
5. Tooltips solo vía `info`; no hay wrapper `cursor-help`.

## Migración desde `StatCard`

| Antes | Ahora |
|---|---|
| `variant="default" / "compact" / "minimal" / "fill"` | `Metric` (una sola anatomía) |
| `variant="chart"` / `"metric-chart"` | `ChartCard` (+ `Metric` si hay cifra) |
| `accent="info" …` | `tone` solo si significa algo; si era decoración, se quita |
| `valueSize` | se elimina (container query + densidad) |
| `trend={{ direction, value }}` | `delta={{ current, previous }}` o `{ text, direction }` |
| `children` (barra de progreso, etc.) | `visual` |
| `KPIWrapper tooltip=…` | `info=…` |
| `KPIValue showComparison` | `delta` + `context` con el valor previo |
| `active` / `onClick` | `pressed` / `onPress` |
| `href` | `href` |
| `loading` | `loading` |
