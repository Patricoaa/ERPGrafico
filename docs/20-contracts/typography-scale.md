---
layer: 20-contracts
doc: typography-scale
status: active
owner: frontend-team
last_review: 2026-07-06
stability: contract-changes-require-ADR
---

# Typography Scale — ERPGrafico

> Canon definitivo del sistema tipográfico. Toda decisión de tamaño, peso y espaciado debe referenciarse aquí.

---

## Fuentes del sistema

| Token Tailwind | CSS Var | Fuente | Uso |
|----------------|---------|--------|-----|
| `font-sans` | `--font-sans` | Onest (variable 100–900) | **Única fuente del sistema** |
| `font-mono` | `--font-mono` | JetBrains Mono (vía `next/font`, `--font-jetbrains-mono`) | Datos tabulares, códigos, IDs |

- Onest es la única fuente del sistema. No existe `font-heading`.
- Toda la jerarquía tipográfica se construye con: weight, size, tracking y text-transform.
- `font-sans` es el default del `body` — no necesita declararse explícitamente en componentes.
- El tamaño mínimo absoluto para cualquier texto body/lectura es `text-xs` (12px). Los tamaños menores (11px, 10px, 9px) están confinados a la capa N5 (Micro) exclusivamente para alta densidad.
- Las columnas numéricas de tablas y cifras financieras se alinean a la derecha (`justify-end` + `text-right`). `tabular-nums` se usa donde se exige tabulación exacta (KPIs, `EntityCard.Metrics`); el default de `DataCell.Currency`/`MoneyDisplay` es cifras proporcionales (ADR-0061).

---

## Escala de headings (h1–h6)

Definidos en `frontend/app/globals.css @layer base`. El estilo base es heredado por todos; los tamaños son defaults que cualquier clase Tailwind puede override.

| Heading | Tamaño base | Tailwind equiv. | Estilo base | Uso típico |
|---------|-------------|-----------------|-------------|------------|
| `h1` | 1.875rem (30px) | `text-3xl` | `font-extrabold tracking-tighter uppercase` | Página de login, hero sections |
| `h2` | 1.5rem (24px) | `text-2xl` | idem | Título principal de vista/sección |
| `h3` | 1.25rem (20px) | `text-xl` | idem | Subtítulo, wizard steps, panel headers |
| `h4` | 1.125rem (18px) | `text-lg` | idem | Card titles con peso visual |
| `h5` | 0.875rem (14px) | `text-sm` | idem | Agrupaciones compactas |
| `h6` | 0.75rem (12px) | `text-xs` | idem | Labels de sección mínima |

> Los componentes que necesiten un tamaño diferente deben override explícitamente con clase Tailwind. El override es correcto y no viola ningún contrato.

---

## Sistema de jerarquía por contexto

Esta matriz es el contrato tipográfico (diseño denso). Note que la escala está ajustada con tokens de Tailwind para garantizar accesibilidad.

| Contexto | Dónde | Tipografía | Tracking | Transform | Ejemplos |
|----------|-------|------------|----------|-----------|----------|
| **N0 — Brand/Hero** | Login, 404, landing | `text-3xl font-black` | `tracking-tighter` | `uppercase` | "ERPGrafico" |
| **N0 — KPI/Metric** | StatCard value, PieChart center | `text-2xl/3xl font-bold tabular-nums` | `tracking-tight` | normal | "1.234" |
| **N0 — Empty state** | EmptyState title | `text-lg font-bold` | `tracking-tight` | normal | "Sin resultados" |
| **N0 — Empty state (compact)** | EmptyState `variant="compact"` title | `text-sm font-bold` | `tracking-tight` | normal | "No tienes aprobaciones" |
| **N0 — Error page** | ErrorBoundary, app/error | `text-2xl font-bold` | `tracking-tight` | normal | "Algo salió mal" |
| **N1 — Sección** | FormSection, SectionHeader, sidebar título | `text-xs font-semibold text-muted-foreground` | `tracking-wider` | `uppercase` | "Roles", "Identidad del Contacto" |
| **N2 — Etiqueta de campo** | LabeledInput legend | `text-xs font-medium text-muted-foreground` | normal | normal | "Nombre / Razón Social" |
| **N2 — Botón acción** | SubmitButton, CancelButton | `text-sm font-medium h-9` | normal | normal | "Guardar", "Cancelar" |
| **N2 — Header de tabla** | DataTableColumnHeader, `<th>` | `text-xs font-medium text-muted-foreground` | normal | normal | "Fecha", "Total", "Estado" |
| **N2 — Badge/Chip** | Chip, EntityBadge | `text-xs font-medium font-sans` | normal | normal | "Pagado", "Pendiente" |
| **N2 — StatusBadge** | StatusBadge (badge) | `text-xs font-medium font-sans` | normal | normal | "En Proceso", "Sin Conciliar" |
| **N2 — Drawer/Modal title** | SheetTitle, DialogTitle | `text-xl font-bold` | `tracking-tight` | normal | "Nuevo Contacto" |
| **N2 — Drawer subtitle** | `subtitle` prop (PanelHeader, via `PanelBaseProps`) | `text-xs font-medium text-muted-foreground` | normal | normal | "Ficha Maestra • CRM" |
| **N2 — Panel title** | PanelHeader default (hub, bandeja de entrada) | `text-sm font-semibold` | `tracking-tight` | normal | "Bandeja de Entrada" |
| **N2 — Wizard step** | GenericWizard step indicator | `text-xs font-semibold` | `tracking-wider` | `uppercase` | "PASO 1 DE 3" |
| **N2 — Paginación** | DataTablePagination | `text-xs font-medium` | normal | normal | "Registros por página" |
| **N3 — Valor de input** | LabeledInput input | `text-sm` | normal | normal | "Juan Pérez" |
| **N3 — Dato primario** | DataCell.Text, DataCell.Date | `text-xs font-medium` | normal | normal | "15/03/2026" |
| **N3 — Dato secundario** | DataCell.Secondary, helper hints | `text-xs font-medium text-muted-foreground` | normal | normal | "3 documentos" |
| **N3 — Código/ID** | DataCell.Code, DataCell.Entity | `text-xs font-medium` | normal | `uppercase` | "OV-000123" |
| **N3 — Valor financiero** | DataCell.Currency, StatCard number | `text-xs font-medium` (right-aligned en tablas) | normal | normal | "$1.234.567" |
| **N3 — Fecha** | DataCell.Date | `text-xs font-medium` | normal | normal | "15/03/2026" |
| **N3 — Fecha-hora** | DataCell.Date `showTime`, FieldType `dateTime` | fecha `text-xs font-medium` + hora `text-xs text-muted-foreground` | normal | normal | "15/03/2026 · 14:30" |
| **N3 — Descripción** | EmptyState description, notes | `text-sm text-muted-foreground` | normal | normal | "Defina la lista de materiales..." |
| **N4 — Tab label** | PageTabs, TabBar trigger | `text-xs sm:text-sm font-medium` | normal | normal | "Perfil", "Cliente" |
| **N4 — Tooltip** | TooltipTrigger content | `text-xs font-medium` | normal | normal | "Editar" |
| **N4 — Timestamp** | ActivitySidebar time | `text-xs font-medium text-muted-foreground/60` | normal | normal | "hace 2 horas" |
| **N4 — Badge count** | TabBar badge number | `text-xs font-bold tabular-nums` | normal | normal | 3, 15 |
| **N5 — Micro density** | Data dense grids, minor statuses | `text-3xs` (10px) | `tracking-looser` | `uppercase` | "PAGADO", "SIN CONCILIAR" |
| **N5 — Ultra micro** | Timeline stamps extreme density | `text-4xs` (9px) | `tracking-looser` | `uppercase` | "08:30" |

> **Nota sobre N5:** N5 (`text-2xs` 11px, `text-3xs` 10px, `text-4xs` 9px) solo debe usarse en layouts extremadamente densos (tablas financieras, timelines, reportes operativos) donde el scroll o el espacio lo exijan. No usar en layouts estándar de marketing o settings generales. En micro no usar `font-black`: máximo `font-bold`.
>
> **Token-first (obligatorio):** los tamaños raw (`text-[9px]`, `text-[13px]`, …) están **prohibidos** en JSX. Usar los tokens de esta tabla o la escala fluid (`text-xs`…`text-3xl`). Regla ESLint `typography/token-first` (error).

---

## Cards — política de tipografía

Las tres superficies del motor de campos (DataTable / EntityCard / Kanban) renderizan los **valores de campo con la misma tipografía**: la que define el `DataCell` resuelto por `renderCell()`. Los contenedores de card **no estampan tamaño ni peso** sobre los valores (DRY: la primitiva es la fuente de verdad; ver ADR-0067 enmienda).

| Pieza | Regla |
|-------|-------|
| **Valores de campo** | Tipografía del `DataCell` resuelto. Zona `header` → `font-semibold` (threading); `title`/`detail`/`subtitle` → `font-medium`. |
| **Título de card** | `text-sm font-medium` (default de la primitiva; `resolveTitle()` no inyecta peso). |
| **Labels de campo en card** | Chrome de card: `text-4xs uppercase`, máx. `font-bold` (N5). |
| **Subtitle** | `text-xs font-medium text-muted-foreground` (paridad con `DataCell.Secondary`; el wrapper no estampa `tracking-tight` para no afectar Badges internos). |
| **`EntityCard.Metrics`** | Contexto N0-KPI: `text-sm font-bold tabular-nums` + label `text-3xs uppercase`. |
| **`EntityCard.ListItem`** | Lista densa: label `text-xs font-medium`, sublabel `text-3xs text-muted-foreground`. |
| **`EntityCard.WorkflowBody`** | Alineado a `DataCell.WorkflowSummary`: labels `text-4xs` (máx. `font-bold`), valores `text-xs font-medium`. |

> Cards/kanban de features que renderizan datos fuera del motor `entity-fields` (`WorkOrderKanban`, `PhaseCard`, `PayrollCard`, …) deben alinear sus tokens a esta escala en un ticket independiente.

---

## Escala de botones de acción

Todos los botones de acción del sistema usan un patrón unificado:

```
h-9  text-sm  font-medium
```

| Componente | Variante | Nota |
|------------|----------|------|
| `<SubmitButton>` | Primary (slide) |  |
| `<CancelButton>` | Outline | `shadow-sm` |
| `<DangerButton>` | Destructive | Extremo izquierdo del footer |
| `<ToolbarCreateButton>` | Primary | `px-4 rounded-md shadow-sm` |
| `<ActionSlideButton>` | Custom | Base de Submit y Cancel |

**Fuente del contrato:** [component-button.md](component-button.md) + [form-layout-architecture.md](form-layout-architecture.md)

---

## Escala de badges y chips

> Contrato completo del componente `<Chip>` en **[component-chip.md](./component-chip.md)**.

| Tamaño | Clase | Cuándo usar | Componente |
|--------|-------|-------------|------------|
| **Estándar** | `text-xs font-medium font-sans` | Badge/chip genérico de UI chrome | `<Chip size="sm">` |
| **Compacto** | `text-xs font-medium` | Tabla, inline, overlaid counters | `<Chip size="xs">` |
| **Énfasis** | `text-xs font-medium` | Detail views, modal sections | `<Chip size="md">` |
| **Header de tabla** | `text-xs font-medium text-muted-foreground` | `<TableHead>` columnas | `data-table-column-header.tsx` |
| **Fine print excepción** | `text-xs font-medium text-muted-foreground` | Timestamps, conteos mínimos sin pill | Inline `<span>` |

Todos los badges son **borderless + `rounded-sm`** (CurrencyFlow aesthetic, ADR-0068).

> **PROHIBIDO:** Fuentes menores a `text-xs` (12px). La accesibilidad y legibilidad son fundamentales.

### Chip — matriz de tamaños

| Prop `size` | Altura | Font | Uso |
|-------------|--------|------|-----|
| `xs` | `h-[18px]` | `text-xs` | Table cells, dense lists, overlaid counters |
| `sm` (default) | `h-[22px]` | `text-xs` | General UI chrome, wizard steps |
| `md` | auto | `text-xs` (`px-2 py-0.5`) | Detail panels, modal sub-headers |

### StatusBadge — matriz de tamaños

El componente `<StatusBadge>` tiene su propio sistema de tamaños intencional:

| Prop `size` | Altura | Font | Uso |
|-------------|--------|------|-----|
| `xs` | `h-[18px]` | `text-xs` | Tablas, listas densas |
| `sm` | `h-[22px]` | `text-xs` | Tablas, listas densas |
| `md` (default) | auto | `text-sm` | Modales, panels de detalle |

---

## Escala de KPIs y métricas

Para números grandes con alto impacto visual, usar las utilidades globales que garantizan consistencia en toda la aplicación:

```tsx
// KPI estándar (ej. Dashboard main stats)
<div className="kpi-value">1.234.567</div> // → text-3xl font-bold tracking-tight tabular-nums

// KPI compacto (ej. Cards en listas densas)
<div className="kpi-value-compact">1.234.567</div> // → text-2xl font-bold tracking-tight tabular-nums
```

> Siempre usan `font-bold` + `tracking-tight` + `tabular-nums`. 

**StatCard labels**:

```
text-xs font-semibold uppercase tracking-wider text-muted-foreground
```

---

## Escala de texto body y descripciones

| Nivel | Clase | Uso |
|-------|-------|-----|
| **Primario** | `text-sm font-medium text-foreground` | Valores en tablas, datos principales |
| **Secundario** | `text-sm text-muted-foreground` | Descripciones, notas de ayuda |
| **Terciario / caption** | `text-xs text-muted-foreground` | `DataCell.Secondary`, timestamps |
| **Label de campo** | `text-sm font-medium` | Formularios con `<label>` (shadcn) |

---

## Escala de modal / dialog headers

Todos los headers de modales, sheets y dialogs:

```
text-xl  font-black  tracking-tight
```

Aplicado a: `<SheetTitle>`, `<AlertDialogTitle>`, `<DialogTitle>`.

> `BaseModal` no inyecta tipografía propia en el header — cada consumidor aplica el patrón canónico.

---

## Tokens de color para tipografía

Solo usar tokens semánticos. Nunca `text-blue-500`, `text-red-400`, etc.

| Token | Color (OKLCH) | Uso |
|-------|---------------|-----|
| `text-foreground` | Casi negro/blanco según modo | Texto principal, valores de datos |
| `text-muted-foreground` | Gris medio | Descripciones, labels de campos |
| `text-primary` | Process Black K100 | Acciones primarias, foco, superficie de alto contraste (ADR-0070) |
| `text-accent` | Golden amber | Acentos cálidos, highlights |
| `text-success` | Verde | Positivo, activo, aprobado |
| `text-warning` | Ámbar | Pendiente, atención requerida |
| `text-destructive` | Rojo | Error, eliminación, peligro |
| `text-info` | Azul | Informativo, neutral-positivo |
| `text-secondary-foreground` | Gris oscuro | Texto sobre fondos secundarios |

### Identificadores de tipo de producto (excepción documentada)

Los colores de tipo de producto en `ProductTypeSelector` son identificadores visuales (no señales de estado), siguiendo el mismo patrón que los tokens financieros (`income → success`, `expense → destructive`):

| Tipo | Token |
|------|-------|
| `STORABLE` (Almacenable) | `text-info` |
| `CONSUMABLE` (Consumible) | `text-warning` |
| `MANUFACTURABLE` (Fabricable) | `text-success` |
| `SERVICE` (Servicio) | `text-primary` |
| `SUBSCRIPTION` (Suscripción) | `text-destructive` |

---

## Letter spacing (tracking) — valores permitidos

| Clase Tailwind | Valor real | Uso |
|----------------|-----------|-----|
| `tracking-tighter` | `-0.04em` | Headings h1-h6, KPIs |
| `tracking-tight` | `-0.02em` | Texto denso, modal titles |
| `tracking-normal` | `0` | Body text (default) |
| `tracking-wide` | `0.025em` | Tabs, nav compacta, texto denso |
| `tracking-wider` | `0.05em` | Wizard steps, PageTabs tabs, elementos secundarios |
| `tracking-widest` | `0.1em` | Botones de acción, badges estándar, N2 legends |
| `tracking-loose` | `0.15em` | Elementos N5, minor hints |
| `tracking-looser` | `0.2em` | N5 badges, ultra-micro dense text |
| `tracking-[0.25em]` | `0.25em` | N1: FormSection title |

> El valor custom (`[0.25em]`) es parte del sistema de capas N1 — no es ad-hoc.
> No utilizar variaciones arbitrarias como `[0.18em]` o `[0.3em]`. Si necesita espaciado amplio, use `tracking-loose` o `tracking-looser`.

---

## Anti-patrones prohibidos

```tsx
// ❌ font-heading — ya no existe como concepto
<span className="font-heading">

// ❌ Colores raw
<span className="text-blue-500">
<span className="text-red-400">

// ❌ Reemplazar sistema de capas con clases semánticas incorrectas
// (Asegurar siempre el uso de tokens como text-xs)

// ❌ Tamaños raw en vez de tokens
<span className="text-[10px]">   // Usar text-3xs
<span className="text-[13px]">   // Usar text-xs (fluid)

// ❌ tracking arbitrario fuera del rango sancionado
<span className="tracking-[0.18em]">  // Usar tracking-loose (0.15em) o tracking-looser (0.2em)
<span className="tracking-[0.3em]">   // Usar tracking-looser o tracking-[0.25em] (máx. sancionado)

// ❌ font-bold en botones de acción
<Button className="font-bold">  // Usar font-medium

// ❌ Mezcla de pesos en el mismo patrón semántico
// (Label+Value con semibold/bold/medium mezclados)
```
