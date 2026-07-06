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
| `font-mono` | `--font-mono` | System monospace stack | Datos tabulares, códigos, IDs |

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

Esta escala es **hardcoded con valores `text-[Npx]`** deliberadamente — el diseño industrial denso requiere precisión sub-Tailwind. No reemplazar con clases semánticas (`text-xs`, `text-sm`).

| Contexto | Dónde | Tipografía | Tracking | Transform | Ejemplos |
|----------|-------|------------|----------|-----------|----------|
| **N0 — Brand/Hero** | Login, 404, landing | `text-3xl font-black` | `tracking-tighter` | `uppercase` | "ERPGrafico" |
| **N0 — KPI/Metric** | StatCard value, PieChart center | `text-2xl/3xl font-black` | `tracking-tighter` | normal | "1.234" |
| **N0 — Empty state** | EmptyState title | `text-lg font-black` | `tracking-tighter` | `uppercase` | "Sin resultados" |
| **N0 — Error page** | ErrorBoundary, app/error | `text-2xl font-black` | `tracking-tighter` | `uppercase` | "Algo salió mal" |
| **N1 — Sección** | FormSection, SectionHeader, sidebar título | `text-[11px] font-black` | `tracking-[0.25em]` | `uppercase` | "Roles", "Identidad del Contacto" |
| **N2 — Etiqueta de campo** | LabeledInput legend | `text-[10px] font-black` | `tracking-[0.15em]` | `uppercase` | "Nombre / Razón Social" |
| **N2 — Botón acción** | SubmitButton, CancelButton | `text-[10px] font-black h-9` | `tracking-widest` | `uppercase` | "Guardar", "Cancelar" |
| **N2 — Header de tabla** | DataTableColumnHeader, `<th>` | `text-[10px] font-black` | `tracking-widest` | `uppercase` | "Fecha", "Total", "Estado" |
| **N2 — Badge/Chip** | Chip, StatusBadge, EntityBadge | `text-[9-12px] font-black font-mono` | `tracking-widest` | `uppercase` | "Pagado", "Pendiente" |
| **N2 — Drawer/Modal title** | SheetTitle, DialogTitle | `text-xl font-black` | `tracking-tight` | normal | "Nuevo Contacto" |
| **N2 — Drawer subtitle** | description prop | `text-[10px] font-black` | `tracking-widest` | `uppercase` | "Ficha Maestra • CRM" |
| **N2 — Wizard step** | GenericWizard step indicator | `text-[10px] font-black` | `tracking-wider` | `uppercase` | "PASO 1 DE 3" |
| **N2 — Paginación** | DataTablePagination | `text-[10px] font-black` | `tracking-widest` | `uppercase` | "Registros por página" |
| **N3 — Valor de input** | LabeledInput input | `text-sm` | normal | normal | "Juan Pérez" |
| **N3 — Dato primario** | DataCell.Text, DataCell.Date | `text-sm font-medium` | normal | normal | "15/03/2026" |
| **N3 — Dato secundario** | DataCell.Secondary, helper hints | `text-xs text-muted-foreground` | normal | normal | "3 documentos" |
| **N3 — Código/ID** | DataCell.Code, DataCell.Entity | `text-xs font-mono font-medium` | normal | `uppercase` | "NV-000123" |
| **N3 — Valor financiero** | DataCell.Currency, StatCard number | `text-xs font-medium tabular-nums` | normal | normal | "$1.234.567" |
| **N3 — Fecha** | DataCell.Date | `text-sm font-medium` | normal | normal | "15/03/2026" |
| **N3 — Descripción** | EmptyState description, notes | `text-sm text-muted-foreground` | normal | normal | "Defina la lista de materiales..." |
| **N4 — Tab label** | PageTabs, TabBar trigger | `text-[10px] sm:text-[11px] font-black uppercase` | `tracking-wider` (PageTabs) / `tracking-widest` (TabBar) | `uppercase` | "Perfil", "Cliente" |
| **N4 — Tooltip** | TooltipTrigger content | `text-[9px] font-black` | `tracking-widest` | `uppercase` | "Editar" |
| **N4 — Timestamp** | ActivitySidebar time | `text-[9px] font-medium text-muted-foreground/60` | normal | normal | "hace 2 horas" |
| **N4 — Badge count** | TabBar badge number | `text-[9px] font-black` | normal | normal | 3, 15 |

---

## Escala de botones de acción

Todos los botones de acción del sistema usan un patrón unificado:

```
h-9  text-[10px]  font-black  uppercase  tracking-widest
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
| **Estándar** | `text-[10px] font-black uppercase tracking-widest` | Badge/chip genérico de UI chrome | `<Chip size="sm">` |
| **Compacto** | `text-[9px] font-black uppercase tracking-widest` | Tabla, inline, overlaid counters | `<Chip size="xs">` |
| **Énfasis** | `text-[11px] font-black uppercase tracking-widest` | Detail views, modal sections | `<Chip size="md">` |
| **Header de tabla** | `text-[10px] font-black uppercase tracking-widest` | `<TableHead>` columnas | `data-table-column-header.tsx` |
| **Fine print excepción** | `text-[9px] font-medium` | Timestamps, conteos mínimos sin pill | Inline `<span>` |

> **PROHIBIDO:** `text-[8px]` en features. Excepciones documentadas: `PrintableReceipt.tsx` (papel físico), POS `CartItem`/`POSCheckoutHeader` (espacio táctil crítico), `AvatarFallback` (imagen).

### Chip — matriz de tamaños

| Prop `size` | Altura | Font | Uso |
|-------------|--------|------|-----|
| `xs` | `h-[18px]` | `text-[9px]` | Table cells, dense lists, overlaid counters |
| `sm` (default) | `h-[22px]` | `text-[10px]` | General UI chrome, wizard steps |
| `md` | `h-[26px]` | `text-[11px]` | Detail panels, modal sub-headers |

### StatusBadge — matriz de tamaños

El componente `<StatusBadge>` tiene su propio sistema de tamaños intencional:

| Prop `size` | Altura | Font | Uso |
|-------------|--------|------|-----|
| `sm` (default) | `h-6` | `text-[12px]` | Tablas, listas densas |
| `md` | `h-8` | `text-[14px]` | Modales, panels de detalle |
| `lg` | `h-10` | `text-base` | Pantallas de detalle full |

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
text-[10px] font-bold uppercase tracking-widest text-muted-foreground
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
| `text-primary` | Process Cyan | Acciones primarias, énfasis de marca |
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

## Anti-patrones prohibidos

```tsx
// ❌ font-heading — ya no existe como concepto
<span className="font-heading">

// ❌ Colores raw
<span className="text-blue-500">
<span className="text-red-400">

// ❌ Reemplazar sistema de capas con clases semánticas
<legend className="text-xs">  // Usar text-[10px] para N2

// ❌ font-bold en botones de acción
<Button className="font-bold">  // Usar font-black

// ❌ Mezcla de pesos en el mismo patrón semántico
// (Label+Value con semibold/bold/medium mezclados)
```
