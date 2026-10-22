---
layer: 20-contracts
doc: component-card-family
status: active
owner: frontend-team
last_review: 2026-10-22
stability: beta
---

# Familia de cards — roles, superficies y tokens

Contrato único de las cards del sistema (ADR-0097). Sustituye el criterio disperso de ADR-0092…0096. El detalle de cada componente vive en su contrato: [component-choice-card.md](./component-choice-card.md), [component-card.md](./component-card.md) (`Card` de panel), [component-entity-view.md](./component-entity-view.md), [component-statcard.md](./component-statcard.md).

Import: `import { CardSurface, CardLead, CardRail, cardAnatomy } from '@/components/shared'`

## 1. Elige el rol, no el aspecto

| Rol | Interacción | Superficie | Componentes |
|---|---|---|---|
| `choice` | elegir uno (radiogroup) | `selectableCardClass()` · `kind="choice"` | `ChoiceCard`, `ProductCard`, `ContactCard` |
| `item` | abrir / navegar; selección masiva opcional | `CardSurface kind="item"`; en entity-view la card se abre por enlace extendido del título | `EntityCard` (entity-view), `TaskInbox`, tarjeta del Kanban de órdenes de trabajo |
| `nav` | enlace | `card-flat` + `CardLead` + chevron | `ModuleGrid` (fila), `ModuleLauncher` (loseta centrada) |
| `metric` | informativa o enlace | `surface-panel` + tipografía `kpi-value` | `StatCard` |
| `panel` | ninguna | `Card` shadcn / `surface-panel` | secciones de Settings, filas de configuración, paneles de edición, Cart, errores |

**Regla del ribbon CMYK:** se previsualiza al hover y queda fijo cuando la card está elegida (`choice`, y las cards de entity-view, que comparten el lenguaje del product grid: ribbon + anillo + marca CMYK en el checkbox). En `item` de otras superficies (bandeja, kanban) y en `nav` solo aparece seleccionada. Nunca en `panel`/`metric`.

**Selección por lote en entity-view:** con `selection="bulk"`, la acción primaria de la card es seleccionarla (clic en cualquier parte, solo puntero; el checkbox es el control accesible) y el título abre el registro. Sin lote, el título es el enlace extendido que abre.

## 2. Superficies (CSS)

| Utilidad | Radio | Uso |
|---|---|---|
| `surface-item` | 8px (`rounded-sm`) | items interactivos. `card-flat` = `surface-item` + hover de fondo. |
| `surface-panel` | 12px (`rounded-md`) | contenedores. **No recorta** (`overflow-hidden`/`overflow-auto` los pone quien lo necesita). `card-base` = `surface-panel` + `overflow-hidden` + hover con elevación. |

Elevación: no sumar `shadow-*` a un `surface-item`. Las utilidades de Tailwind (`border-primary/20`, `bg-card/10`, `shadow-card`, `overflow-auto`) se emiten después de `surface-*`, así que lo sobrescriben sin conflicto.

## 3. Semántica de selección y teclado

`CardSurface` solo emite `aria-pressed` / `aria-checked` cuando se le pasa `selected` (`true` o `false`). Una card de acción o enlace **no** pasa `selected`; así no se anuncia como alternancia. Con `role="radio"` usa `aria-checked`. Enter/Space activan la card **solo** cuando el foco está en la card misma: un botón anidado (acciones de fila, aprobar/rechazar) conserva su propio comportamiento.

## 4. Piezas compartidas

| Pieza | Qué es |
|---|---|
| `CardLead` | Slot inicial (icono / foto / avatar). `size` `md` 40px · `sm` 32px; `stretch` para headers de entidad; tono por `className`. Siempre `rounded-sm`, recortado. |
| `CardRail` | Columna lateral completa. `tone` `warning\|success\|neutral\|primary`, `size` `md` (w-14, estado con icono) · `sm` (w-9, marcador de selección), `decorative` (default `true`, `aria-hidden`). El color nunca es el único portador del estado: acompáñalo con icono y con `StatusBadge`/texto. |
| `InfoBlock` | Aviso o banner de estado con acciones ("Autorización requerida", "Crédito aprobado"). **No es una card**: nada se abre desde él ni se selecciona. `tone` `info\|success\|warning\|destructive\|neutral` tiñe solo el icono (`CardLead`); el texto va en tokens neutros. `live` `status` (default) / `alert` / `none` define cómo se anuncia. |
| `cardAnatomy` | Tokens de clase: `body/code/title/description/footer/caption/amount/glyph`, `lead*`, `entityTitle/entitySubtitle`, `eyebrow` (etiqueta de un par etiqueta/valor), `fieldValue`, `rail/railSize`. Cambiar el diseño = editar este archivo. |

## 5. Prohibido

- `<div className="border rounded-… ">` con forma de card: usa el rol que corresponda. Los avisos y grupos de campos no son cards (usan `InfoBlock`).
- Duplicar el bloque lead/avatar o las clases de etiqueta (`uppercase tracking-… text-4xs`) dentro de una feature: usa `CardLead` y `cardAnatomy.eyebrow`.
- Estado solo por color de rail. `StatusBadge` sigue siendo el único renderer de estado (invariante 7).

## 6. Ratchet

`frontend/lib/__tests__/card-family.contract.test.ts` falla si un archivo introduce una superficie de card hecha a mano: un literal de clases con `border`, un `rounded-(sm|md|lg|xl)` y `bg-card` (se ignoran inputs con `h-N` y superficies `bg-background`).

- El baseline `lib/__tests__/card-family.baseline.json` está **vacío** (2026-10-22): no hay deuda; cualquier literal nuevo falla. Si aparece deuda legítima, entra al baseline y solo puede encoger (`CARD_FAMILY_BASELINE=1 npx vitest run lib/__tests__/card-family.contract.test.ts`).
- Una excepción legítima (un recibo impreso, la pantalla de login) se marca con un comentario `card-family-allow: <motivo>` en la misma línea o en la de encima.
- Segunda regla: `<Card className="card-base|card-flat">` está prohibido. El `Card` de shadcn arrastra `py-6 gap-6 shadow-card` que las utilidades propias no pueden sobrescribir; usa `CardSurface` o `<Card variant="flat">`.
