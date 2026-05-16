# Typography Scale — ERPGrafico

> Canon definitivo del sistema tipográfico. Toda decisión de tamaño, peso y espaciado debe referenciarse aquí.  
> **Última actualización:** 2026-05-15 (Audit de tipografía)

---

## Fuentes del sistema

| Token Tailwind | CSS Var | Fuente | Uso |
|----------------|---------|--------|-----|
| `font-sans` | `--font-sans` | Onest (Google Fonts) | Body, formularios, descripciones, UI genérica |
| `font-heading` | `--font-heading` | Syne (Google Fonts, 400–800) | Títulos, KPIs, marca, tabs principales |
| `font-mono` | `--font-mono` | System monospace stack | Datos tabulares, códigos, precios, IDs |

**Regla de uso:**
- Nunca usar `font-heading` para texto de más de 2 líneas (perjudica legibilidad a cuerpo).
- Siempre usar `font-mono` + clase `tabular-nums` en columnas financieras para evitar layout shifts.
- `font-sans` es el default del `body` — no necesita declararse explícitamente en componentes.

---

## Escala de headings (h1–h6)

Definidos en `frontend/app/globals.css @layer base`. El estilo base es heredado por todos; los tamaños son defaults que cualquier clase Tailwind puede override.

| Heading | Tamaño base | Tailwind equiv. | Estilo base | Uso típico |
|---------|-------------|-----------------|-------------|------------|
| `h1` | 1.875rem (30px) | `text-3xl` | `font-heading font-extrabold tracking-tighter uppercase` | Página de login, hero sections |
| `h2` | 1.5rem (24px) | `text-2xl` | idem | Título principal de vista/sección |
| `h3` | 1.25rem (20px) | `text-xl` | idem | Subtítulo, wizard steps, panel headers |
| `h4` | 1.125rem (18px) | `text-lg` | idem | Card titles con peso visual |
| `h5` | 0.875rem (14px) | `text-sm` | idem | Agrupaciones compactas |
| `h6` | 0.75rem (12px) | `text-xs` | idem | Labels de sección mínima |

> Los componentes que necesiten un tamaño diferente deben override explícitamente con clase Tailwind. El override es correcto y no viola ningún contrato.

---

## Escala de UI chrome (el sistema de 3 capas)

Esta escala es **hardcoded con valores `text-[Npx]`** deliberadamente — el diseño industrial denso requiere precisión sub-Tailwind. No reemplazar con clases semánticas (`text-xs`, `text-sm`).

| Capa | Contexto | Tipografía | Componente |
|------|----------|------------|------------|
| **L1 — Sección** | Separadores de grupo en formularios | `text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/70` | `<FormSection>` |
| **L2 — Etiqueta** | Legends de campos notched | `text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground` | `<LabeledInput>` legend |
| **L3 — Valor** | Contenido de inputs | `text-sm font-normal text-foreground` | `<LabeledInput>` input |

---

## Escala de botones de acción

Todos los botones de acción del sistema usan un patrón unificado:

```
h-9  text-[10px]  font-black  uppercase  tracking-widest
```

| Componente | Variante | Nota |
|------------|----------|------|
| `<SubmitButton>` | Primary (slide) | `shadow-lg shadow-primary/20` |
| `<CancelButton>` | Outline | `shadow-sm` |
| `<DangerButton>` | Destructive | Extremo izquierdo del footer |
| `<ToolbarCreateButton>` | Primary | `px-4 rounded-md shadow-sm` |
| `<ActionSlideButton>` | Custom | Base de Submit y Cancel |

**Fuente del contrato:** [component-button.md](component-button.md) + [form-layout-architecture.md](form-layout-architecture.md)

---

## Escala de badges y chips

> 📄 Contrato completo del componente `<Chip>` en **[component-chip.md](./component-chip.md)**.

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
text-3xl  font-black  font-heading  tracking-tighter
```

Variante compacta (espacio limitado):

```
text-2xl  font-black  font-heading  tracking-tighter
```

> Siempre `font-heading` (Syne) + `font-black` + `tracking-tighter`. Nunca `font-bold` ni `tracking-tight` en KPIs.

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
| `text-primary` | Electric violet | Acciones primarias, énfasis de marca |
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
| `tracking-wider` | `0.05em` | Sub-tabs, elementos secundarios |
| `tracking-widest` | `0.1em` | Botones de acción, badges estándar |
| `tracking-[0.15em]` | `0.15em` | L2: LabeledInput legend |
| `tracking-[0.25em]` | `0.25em` | L1: FormSection title |

> Los valores custom (`[0.15em]`, `[0.25em]`) son partes del sistema de capas L1/L2 — no son ad-hoc.

---

## Anti-patrones prohibidos

```tsx
// ❌ Colores raw
<span className="text-blue-500">
<span className="text-red-400">

// ❌ Reemplazar sistema de capas con clases semánticas
<legend className="text-xs">  // Usar text-[10px] para L2

// ❌ font-bold en botones de acción
<Button className="font-bold">  // Usar font-black

// ❌ font-heading en body text
<p className="font-heading">  // Solo para headings y KPIs

// ❌ Mezcla de pesos en el mismo patrón semántico
// (Label+Value con semibold/bold/medium mezclados)
```
