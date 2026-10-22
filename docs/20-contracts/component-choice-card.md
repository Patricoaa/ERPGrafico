---
layer: 20-contracts
doc: component-choice-card
status: active
owner: frontend-team
last_review: 2026-10-22
stability: beta
---

# ChoiceCard · ChoiceGroup · SelectableCard · CardSurface · CardRail · cardAnatomy

Cartas para **elegir una opción** en los pasos del checkout (POS y compras): documento tributario, tipo de entrega, método de pago, contacto. Misma anatomía y mismo lenguaje de selección que `ProductCard` ([component-selectors.md](./component-selectors.md#productgridpicker-)).

Import: `import { ChoiceCard, ChoiceGroup, SelectableCard, CardSurface, CardRail, cardAnatomy } from '@/components/shared'`

## Anatomía (tokens `cardAnatomy`)

```
┌─────────────────────────┐ ← cinta CMYK: fija si está elegida, en hover/foco si no
│ [Badge]                 │   franja de media: ícono (o `media`: Blobatar, imagen…)
│          ⬚              │
│                     (✓) │   check al elegir
├─────────────────────────┤
│ meta (mono)             │   código / RUT / número          → cardAnatomy.code
│ Título                  │   font-semibold                  → cardAnatomy.title
│ descripción             │   text-2xs muted                 → cardAnatomy.description
│ footer                  │   anclado abajo: montos, hechos  → cardAnatomy.footer + cardAnatomy.caption + cardAnatomy.amount
└─────────────────────────┘   radio: rounded-sm (8px)
```

**Radio**: la familia interactiva/seleccionable (ProductCard, ChoiceCard, ContactCard, MfgLineCard, PaymentMethodSelector) usa `rounded-sm` (8px) — excepción documentada en ADR-0094 y `design-system.md` §2. `selectableCardClass()` ya emite `rounded-sm`.

## Lenguaje de selección (`SelectableCard`)

| Estado | Superficie |
|--------|-----------|
| elegida | cinta CMYK + anillo K100 (`border-primary ring-1`) + check |
| hover / foco | la cinta se previsualiza (nunca el anillo) |
| no disponible | tarjeta lavada (`bg-muted/40`, 50 % opacidad), texto gris, `cursor-not-allowed`, sin cinta ni hover; el motivo va en `description` |

La cinta (`ribbon-cmyk`, `ribbon-cmyk-hover` en `globals.css`) **reemplaza a `CmykRing` como marca de selección en tarjetas**. `CmykRing` sigue en `Checkbox`/`RadioGroup`/`SelectionRing` (selección múltiple en tablas).

`selectableCardClass({ selected, unavailable })` y `<SelectionCheck />` son el único origen de esta apariencia: `ProductCard`, `ChoiceCard` y cualquier tarjeta pulsable futura los usan.

## `CardSurface` (nuevo)

Shell contratado para toda la familia: `CardSurface` = `Card` + `selectableCardClass()` + neutralización determinista de `gap-6/py-6/shadow-card/rounded-md` (vía `gap-0 p-0 shadow-none`). Props: `selected`, `unavailable`, `role="radio"|"button"`, `onClick`, `onKeyDown`, `children`, `className`. Elimina los overrides manuales que antes hacían `ProductCard`/`MfgLineCard`.

## `CardRail` (nuevo)

Riel lateral `w-14` que codifica estado mediante color (único indicador, sin chip). Props: `tone="warning"|"success"|"neutral"`, `children` (icono centrado, `aria-hidden`). Clases: `border-l border-{tone}/20 bg-{tone}/10 text-{tone}`. Usado por `MfgLineCard` (ámbar=pendiente, verde=configurado).

## `cardAnatomy` tokens

```
cardAnatomy.body        "flex min-w-0 flex-1 flex-col gap-1 px-3 pb-3 pt-2.5"
cardAnatomy.code        "truncate font-mono text-3xs text-muted-foreground"
cardAnatomy.title       "line-clamp-2 text-left text-sm font-semibold leading-snug"
cardAnatomy.description "text-2xs leading-snug text-muted-foreground"
cardAnatomy.footer      "mt-auto pt-2"
cardAnatomy.caption     "text-3xs text-muted-foreground"
cardAnatomy.amount      "font-semibold tabular-nums text-lg"
cardAnatomy.glyph       "h-4 w-4 shrink-0 transition-colors text-muted-foreground group-hover:text-foreground"
```

## `ChoiceCard`

| prop | tipo | req | notas |
|------|------|-----|-------|
| `selected` | `boolean` | ✅ | `aria-checked` |
| `onSelect` | `() => void` | ✅ | no se llama si `disabled` |
| `title` | `string` | ✅ | |
| `description` | `string` | ❌ | si `disabled`, explica por qué |
| `meta` | `string` | ❌ | línea mono sobre el título |
| `icon` | `ComponentType<{className?}>` | ❌ | ignorado si hay `media` |
| `iconClassName` | `string` | ❌ | token semántico de texto (`text-success`); se apaga si `disabled` |
| `media` | `ReactNode` | ❌ | reemplaza al ícono (p. ej. `Blobatar`) |
| `badge` | `string` | ❌ | chip sobre la esquina sup. izquierda de la franja |
| `tone` | `"default" \| "warning"` | ❌ | `warning` tiñe la franja de ámbar (documentos exentos) |
| `footer` | `ReactNode` | ❌ | anclado al fondo |
| `size` | `"default" \| "compact"` | ❌ | `compact` acorta la franja (métodos de pago) |
| `disabled` | `boolean` | ❌ | `aria-disabled`, fuera del orden de tab |
| `children` | `ReactNode` | ❌ | entre descripción y footer |

Es un `Button` de shadcn con `role="radio"`. Los íconos usan clases `size-*` (el `Button` fuerza `size-4` a los SVG sin ellas).

## `ChoiceGroup`

`role="radiogroup"` con nombre accesible (`label`, obligatorio), grilla (`columns`: clases `grid-cols-*`) y navegación con flechas. `activation="select"` (por defecto) mueve el foco **y elige**; `activation="focus"` solo mueve el foco (usar cuando elegir abre algo, como el diálogo de monto del pago).

## Usos

| Superficie | Componente |
|-----------|------------|
| Documento tributario (`Step2_DTE`) | `ChoiceCard` con `tone="warning"` para exentos |
| Entrega (`Step3_Delivery`) | `ChoiceCard`, "inmediato" deshabilitado si hay fabricación |
| Método de pago (`PaymentMethodSelector`) | `ChoiceCard size="compact"`, monto en el `footer`; asignaciones y crédito asignado usan la superficie "elegida" con controles propios (`chosenCardClass` → `rounded-sm` + tokens) |
| Cliente / proveedor (`ContactCardGrid` → `ContactCard`) | `ChoiceCard` con `media={<Blobatar/>}` (`rounded-sm`), RUT en `meta`, crédito en `footer` |
| Fabricación (`Step2_ManufacturingDetails`) | **`MfgLineCard`** (`CardSurface` + `CardRail` + tokens), `role="button"`, **no** `ChoiceCard`. Riel ámbar→verde = único estado; ribbon solo en hover (preview). |

## Estados

`loading` → `CardSkeleton variant="product" | "contact-card"` replica la misma franja y filas (sin CLS). `empty`/`error` los resuelve el contenedor (`ContactCardGrid` usa `EmptyState`).
