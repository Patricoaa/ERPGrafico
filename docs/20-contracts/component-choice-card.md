---
layer: 20-contracts
doc: component-choice-card
status: active
owner: frontend-team
last_review: 2026-10-21
stability: beta
---

# ChoiceCard · ChoiceGroup · SelectableCard

Cartas para **elegir una opción** en los pasos del checkout (POS y compras): documento tributario, tipo de entrega, método de pago, contacto. Misma anatomía y mismo lenguaje de selección que `ProductCard` ([component-selectors.md](./component-selectors.md#productgridpicker-)).

Import: `import { ChoiceCard, ChoiceGroup, SelectableCard… } from '@/components/shared'`

## Anatomía

```
┌─────────────────────────┐ ← cinta CMYK: fija si está elegida, en hover/foco si no
│ [Badge]                 │   franja de media: ícono (o `media`: Blobatar, imagen…)
│          ⬚              │
│                     (✓) │   check al elegir
├─────────────────────────┤
│ meta (mono)             │   código / RUT / número
│ Título                  │   font-semibold
│ descripción             │   text-2xs muted
│ footer                  │   anclado abajo: montos, hechos secundarios
└─────────────────────────┘
```

## Lenguaje de selección (`SelectableCard`)

| Estado | Superficie |
|--------|-----------|
| elegida | cinta CMYK + anillo K100 (`border-primary ring-1`) + check |
| hover / foco | la cinta se previsualiza (nunca el anillo) |
| no disponible | tarjeta lavada (`bg-muted/40`, 50 % opacidad), texto gris, `cursor-not-allowed`, sin cinta ni hover; el motivo va en `description` |

La cinta (`ribbon-cmyk`, `ribbon-cmyk-hover` en `globals.css`) **reemplaza a `CmykRing` como marca de selección en tarjetas**. `CmykRing` sigue en `Checkbox`/`RadioGroup`/`SelectionRing` (selección múltiple en tablas).

`selectableCardClass({ selected, unavailable })` y `<SelectionCheck />` son el único origen de esta apariencia: `ProductCard`, `ChoiceCard` y cualquier tarjeta pulsable futura los usan.

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
| Método de pago (`PaymentMethodSelector`) | `ChoiceCard size="compact"`, monto en el `footer`; asignaciones y crédito asignado usan la superficie "elegida" con controles propios |
| Cliente / proveedor (`ContactCardGrid` → `ContactCard`) | `ChoiceCard` con `media={<Blobatar/>}`, RUT en `meta`, crédito en `footer` |
| Fabricación (`Step2_ManufacturingDetails`) | tarjetas de `entity-view` con `media.placement: "top"` |

## Estados

`loading` → `CardSkeleton variant="product" | "contact-card"` replica la misma franja y filas (sin CLS). `empty`/`error` los resuelve el contenedor (`ContactCardGrid` usa `EmptyState`).
