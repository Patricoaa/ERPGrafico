---
layer: 20-contracts
doc: typography-scale
status: active
owner: frontend-team
last_review: 2026-10-14
stability: contract-changes-require-ADR
---

# Typography Scale — ERPGrafico

> Canon definitivo del sistema tipográfico. Toda decisión de tamaño, peso y espaciado debe referenciarse aquí.

---

## Fuentes del sistema

| Token Tailwind | CSS Var | Fuente | Uso |
|----------------|---------|--------|-----|
| `font-sans` | `--font-sans` | Onest (variable 100–900) | **Única fuente del sistema** |
| `font-mono` | `--font-mono` | JetBrains Mono (bundleada vía `next/font`) | Datos tabulares, códigos, IDs |

- Onest es la única fuente del sistema. No existe `font-heading`.
- Toda la jerarquía tipográfica se construye con: weight, size, tracking y text-transform.
- `font-sans` es el default del `body` — no necesita declararse explícitamente en componentes.
- Siempre usar `font-mono` + `tabular-nums` en columnas financieras para evitar layout shifts.

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

Esta escala usa **tokens semánticos** (`text-2xs`, `text-3xs`, `text-4xs`), **nunca px crudos**. Los valores `text-[Npx]` están prohibidos y los bloquea la regla ESLint `typography/token-first`.

Equivalencias canónicas (el rango micro es **fijo**, no fluido, y exclusivo para chrome denso):

| px (legacy) | Token | Valor |
|-------------|-------|-------|
| `text-[9px]` | `text-4xs` | 9px |
| `text-[10px]` | `text-3xs` | 10px |
| `text-[11px]` | `text-2xs` | 11px |
| `text-[13px]` | `text-xs` | 12–14px (fluido) |
| `text-[15px]` | `text-sm` | 14–16px (fluido) |

| Contexto | Dónde | Tipografía | Tracking | Transform | Ejemplos |
|----------|-------|------------|----------|-----------|----------|
| **N0 — Brand/Hero** | Login, 404, landing | `text-3xl font-black` | `tracking-tighter` | `uppercase` | "ERPGrafico" |
| **N0 — KPI/Metric** | StatCard value, PieChart center | `text-2xl/3xl font-black` | `tracking-tighter` | normal | "1.234" |
| **N0 — Empty state** | EmptyState title | `text-lg font-black` | `tracking-tighter` | `uppercase` | "Sin resultados" |
| **N0 — Error page** | ErrorBoundary, app/error | `text-2xl font-black` | `tracking-tighter` | `uppercase` | "Algo salió mal" |
| **N1 — Sección** | FormSection, SectionHeader, ActivitySidebar | `text-2xs font-bold` | `tracking-[0.25em]` | `uppercase` | "Roles", "Identidad del Contacto" |
| **N2 — Etiqueta de campo** | LabeledInput legend | `text-2xs font-bold` | `tracking-widest` | `uppercase` | "Nombre / Razón Social" |
| **N2 — Botón acción** | SubmitButton, CancelButton | `text-3xs font-black h-9` | `tracking-widest` | `uppercase` | "Guardar", "Cancelar" |
| **N2 — Header de tabla** | DataTableColumnHeader, `<th>` | `text-3xs font-bold` | `tracking-widest` | `uppercase` | "Fecha", "Total", "Estado" |
| **N2 — Badge/Chip** | Chip, EntityBadge | `text-xs font-medium font-sans` | `normal` | normal | "Pagado", "Pendiente" |
| **N2 — StatusBadge** | StatusBadge (badge) | `text-xs font-medium font-sans` | `normal` | normal | "En Proceso", "Sin Conciliar" |
| **N2 — Drawer/Modal title** | SheetTitle, DialogTitle | `text-xl font-black` | `tracking-tight` | normal | "Nuevo Contacto" |
| **N2 — Drawer subtitle** | `subtitle` prop (PanelHeader, via `PanelBaseProps`) | `text-xs font-medium text-muted-foreground` | normal | normal | "Ficha Maestra • CRM" |
| **N2 — Wizard step** | GenericWizard step indicator | `text-3xs font-black` | `tracking-wider` | `uppercase` | "PASO 1 DE 3" |
| **N2 — Paginación** | DataTablePagination | `text-xs font-medium` | normal | normal | "Registros por página" |
| **N3 — Valor de input** | LabeledInput input | `text-sm` | normal | normal | "Juan Pérez" |
| **N3 — Valor de selector** | SelectTrigger, SearchablePopover trigger | `text-sm text-foreground` | normal | normal | "Almacenable" |
| **N3 — Placeholder** | LabeledInput, SelectTrigger placeholder | `text-sm text-muted-foreground/60` | normal | normal | "Seleccionar tipo…" |
| **N3 — Dato primario** | DataCell.Text, DataCell.Date | `text-xs font-medium` | normal | normal | "15/03/2026" |
| **N3 — Dato secundario** | DataCell.Secondary, helper hints | `text-xs text-muted-foreground` | normal | normal | "3 documentos" |
| **N3 — Código/ID** | DataCell.Code, DataCell.Entity | `text-xs font-mono font-medium` | normal | `uppercase` | "OV-000123" |
| **N3 — Valor financiero** | DataCell.Currency, StatCard number | `text-xs font-medium tabular-nums` | normal | normal | "$1.234.567" |
| **N3 — Fecha** | DataCell.Date | `text-xs font-medium` | normal | normal | "15/03/2026" |
| **N3 — Fecha-hora** | DataCell.Date `showTime`, FieldType `dateTime` | fecha `text-xs font-medium` + hora `text-xs font-normal` (`light` opcional, ADR-0062) | normal | normal | "15/03/2026 · 14:30" |
| **N3 — Descripción** | EmptyState description, notes | `text-sm text-muted-foreground` | normal | normal | "Defina la lista de materiales..." |
| **N4 — Tab label** | PageTabs, TabBar trigger | `text-3xs sm:text-2xs font-bold` | `tracking-wider` (PageTabs) / `tracking-widest` (TabBar) | `uppercase` | "Perfil", "Cliente" |
| **N4 — Tooltip** | TooltipContent (`ui/tooltip`) | `text-xs font-normal` | normal | normal | "Editar" |
| **N4 — Timestamp** | ActivitySidebar time | `text-3xs font-medium text-muted-foreground/60` | normal | normal | "hace 2 horas" |
| **N4 — Badge count** | TabBar badge number | `text-4xs font-bold` | normal | normal | 3, 15 |

> **Peso de labels micro (N1/N2/N4): `font-bold`.** El sistema reserva `font-black` para valores de display (N0), botones de acción y el indicador de paso del wizard. La versión previa de este contrato declaraba `font-black` en todos los labels; el código enviado estandariza en `font-bold` (headers de tabla, títulos de sección, labels de campo, tabs). Ver [ADR-0082](../10-architecture/adr/0082-typography-scale-token-reconciliation.md).

---

## Escala del chrome del shell (ADR-0079)

Roles tipográficos de los consumidores del shell (`DashboardShell`, `ModuleRail`, `ModuleSidebarPanel`, `SidebarNavItem`, `SidebarUtilityNav`, `PanelHeader`). Referencia de estructura: [module-layout-navigation.md §2.1](./module-layout-navigation.md).

| Rol | Componente (archivo) | Tipografía | Tracking | Transform |
|-----|----------------------|------------|----------|-----------|
| Topbar — título de vista (`<h1>` único) | `DashboardShell.tsx` | `text-base font-semibold` | `tracking-tight` | normal |
| Topbar — breadcrumb | `DashboardShell.tsx` | `text-xs font-medium text-muted-foreground` | normal | normal |
| Topbar — status pill | `DashboardShell.tsx` | `text-2xs font-bold` | `tracking-wider` | `uppercase` |
| Riel — logo/iniciales | `ModuleRail.tsx` | `text-3xs font-bold` | normal | `uppercase` |
| Riel — tooltip de módulo | `ModuleRail.tsx` | `text-xs font-semibold` | normal | normal |
| Panel — título de módulo | `ModuleSidebarPanel.tsx` | `text-sm font-semibold` | `tracking-tight` | normal |
| Panel — fallback "Módulos" | `ModuleSidebarPanel.tsx` | `text-xs font-semibold` | `tracking-wider` | `uppercase` |
| Panel — ítem de navegación (L0/L1/L2) | `SidebarNavItem.tsx` | `text-xs` | normal | normal |
| Panel — atajo `kbd` (Ctrl K) | `SidebarUtilityNav.tsx` | `text-3xs` | normal | normal |
| Panel — badge de conteo | `SidebarUtilityNav.tsx` | `text-4xs font-medium` | normal | normal |
| Panel lateral — título | `PanelHeader.tsx` | `text-sm font-semibold` | `tracking-tight` | normal |
| Panel lateral — subtítulo | `PanelHeader.tsx` | `text-xs font-medium text-muted-foreground` | normal | normal |

> El tamaño micro mínimo del chrome es `text-4xs` (9px) y sólo se usa en glifos y contadores (iniciales del riel, badges de número), nunca en prosa.

---

## Escala de botones de acción

Todos los botones de acción del sistema usan un patrón unificado:

```
h-9  text-3xs  font-black  uppercase  tracking-widest
```

| Componente | Variante | Nota |
|------------|----------|------|
| `<SubmitButton>` | Primary (relleno) | `px-4 h-9 text-3xs font-black`; touch mode vía `className="h-12 px-6 text-xs"` |
| `<CancelButton>` | Outline | `px-5 h-9 text-3xs font-black shadow-card` |
| `<DangerButton>` | Destructive | Extremo izquierdo del footer; icono opcional |
| `<ToolbarCreateButton>` | Primary (toolbar) | Excepción: `h-9 text-xs font-semibold tracking-widest` (superficie toolbar, no footer de formulario) |

**Fuente del contrato:** [component-button.md](component-button.md) + [form-layout-architecture.md](form-layout-architecture.md)

---

## Escala de badges y chips

> Contrato completo del componente `<Chip>` en **[component-chip.md](./component-chip.md)**.

| Tamaño | Clase | Cuándo usar | Componente |
|--------|-------|-------------|------------|
| **Estándar** | `text-xs font-medium font-sans` | Badge/chip genérico de UI chrome | `<Chip size="sm">` |
| **Compacto** | `text-xs font-medium` | Tabla, inline, overlaid counters | `<Chip size="xs">` |
| **Énfasis** | `text-xs font-medium` | Detail views, modal sections | `<Chip size="md">` |
| **Header de tabla** | `text-3xs font-bold uppercase tracking-widest` | `<TableHead>` columnas | `data-table-column-header.tsx` |
| **Fine print excepción** | `text-4xs font-medium` | Timestamps, conteos mínimos sin pill | Inline `<span>` |

Todos los badges son **borderless + `rounded-sm`** (CurrencyFlow aesthetic, ADR-0068).

> **PROHIBIDO:** `text-[8px]` en features. Excepciones documentadas: `PrintableReceipt.tsx` (papel físico), POS `CartItem`/`POSCheckoutHeader` (espacio táctil crítico), `AvatarFallback` (imagen).

### Chip — matriz de tamaños

`Chip` envuelve `Badge`; todos sus tamaños usan `text-xs font-medium` (el tamaño sólo cambia la caja, no la tipografía).

| Prop `size` | Altura | Font | Uso |
|-------------|--------|------|-----|
| `xs` | `h-[18px]` | `text-xs` | Table cells, dense lists, overlaid counters |
| `sm` | `h-[22px]` | `text-xs` | General UI chrome, wizard steps |
| `md` (default) | auto (`px-2 py-0.5`) | `text-xs` | Detail panels, modal sub-headers |

### StatusBadge — matriz de tamaños

`StatusBadge` delega el tamaño en `Badge`:

| Prop `size` | Altura | Font | Uso |
|-------------|--------|------|-----|
| `xs` | `h-[18px]` | `text-xs` | Tablas, listas densas |
| `sm` | `h-[22px]` | `text-xs` | Tablas, listas densas |
| `md` (default) | auto (`px-2 py-0.5`) | `text-xs` | Modales, panels de detalle |
| `lg` | `h-8` | `text-sm` | Headers, énfasis |
| `xl` | `h-10` | `text-base` | Hero, dashboards |

---

## Escala de KPIs y métricas

Para números grandes con alto impacto visual:

```
text-3xl  font-black  tracking-tighter
```

Variante compacta (espacio limitado):

```
text-2xl  font-black  tracking-tighter
```

> Siempre `font-black` + `tracking-tighter`. Nunca `font-bold` ni `tracking-tight` en KPIs.

**StatCard labels** — todas las variantes (`minimal`, `compact`, `chart`) usan `tracking-widest`:

```
text-3xs font-bold uppercase tracking-widest text-muted-foreground
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
| `tracking-wider` | `0.05em` | Wizard steps, PageTabs tabs, elementos secundarios |
| `tracking-widest` | `0.1em` | Botones de acción, badges estándar |
| `tracking-widest` | `0.1em` | N2: LabeledInput / LabeledContainer legend |
| `tracking-[0.25em]` | `0.25em` | N1: FormSection title |

> El valor custom (`[0.25em]`) es parte del sistema de capas N1/N2 — no es ad-hoc.

---

## Iconografía en componentes

Para evitar fatiga visual, los iconos dentro de componentes (selectores, secciones, etc.) siguen estas reglas:

| Tipo | Uso | Color |
|------|-----|-------|
| **Structural** | Secciones de form, search icons | `text-muted-foreground/50` |
| **Semantic** | Warning, Info, errores | color funcional del intent (`destructive`, `warning`…) |
| **Active** | Ítems seleccionados en dropdowns | `text-primary` o `text-foreground` |

---

## Anti-patrones prohibidos

```tsx
// ❌ font-heading — ya no existe como concepto
<span className="font-heading">

// ❌ Colores raw
<span className="text-blue-500">
<span className="text-red-400">

// ❌ Reemplazar el sistema de capas con px crudos o clases semánticas
<legend className="text-[10px]">  // Usar text-2xs (N2)
<legend className="text-xs">       // Usar text-2xs (N2)

// ❌ Tamaños px crudos en el chrome del shell
<nav className="text-[13px]">  // Usar text-xs

// ❌ font-bold en botones de acción del sistema
<Button className="font-bold">  // Usar font-black (escala de acción) o font-medium (Button base)

// ❌ Mezcla de pesos en el mismo patrón semántico
// (Label+Value con semibold/bold/medium mezclados)
```
