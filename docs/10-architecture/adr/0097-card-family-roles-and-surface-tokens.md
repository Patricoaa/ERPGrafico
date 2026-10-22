---
id: 0097
title: Familia de cards — roles de superficie, layouts, rail único y tokens de superficie
status: Proposed
date: 2026-10-22
author: frontend-team
---

# 0097 — Familia de cards: roles, layouts, rail único y tokens de superficie

**Related:** ADR-0074 (ModuleGrid), ADR-0087 (entity-view), ADR-0092/0093/0094/0095/0096 (kit POS: ProductCard, ChoiceCard, CardSurface, CardRow), `docs/20-contracts/component-card.md`, `docs/20-contracts/component-choice-card.md`, `docs/10-architecture/design-system.md`

---

## Context

El kit de cards nacido en el POS (`card-anatomy`, `CardSurface`, `ChoiceCard`) es la anatomía que queremos para todo el sistema, pero hoy conviven cuatro dialectos (inventario del 2026-10-22, 99 archivos candidatos):

| Aspecto | Kit POS | `EntityCard` | `card-base` (ModuleGrid, Kanban) | `Card` shadcn |
|---|---|---|---|---|
| Radio | 8px | 8px | 12px | 12px |
| Título | semibold | medium | bold | libre |
| Lead | 40px `rounded-sm` `bg-muted` | 40px `rounded-md` `bg-accent` (duplicado en dos ramas) | 32px `rounded-md` | — |
| Hover | borde + ribbon CMYK | fondo + sombra | fondo + elevación | ninguno |
| Etiqueta de dato | mono 3xs | uppercase tracking-widest | 2xs | libre |

Además:

1. `CardSurface` emitía `aria-pressed=false` en **toda** card con `role="button"` porque `selected` tenía default `false`. Cada `EntityCard` navegable se anunciaba como botón de alternancia.
2. Existían **dos rieles** (`CardRail` w-14 decorativo y `SelectionRail` w-9 accesible) construidos por separado.
3. El ribbon CMYK es el lenguaje de "elegir uno"; aplicado a cada card navegable de una grilla de 50 entidades es ruido en un contexto Operate.
4. `design-system.md` §2 (contenedores 12px) contradice ADR-0094 (items interactivos 8px).

---

## Decision

### 1. Rol de la superficie (decide la interacción, no la apariencia)

| Rol | Interacción | Lenguaje | Consumidores |
|---|---|---|---|
| `choice` | elegir uno (radiogroup) | ribbon + ring + check | `ChoiceCard`, `ProductCard`, `ContactCard` |
| `item` | abrir; selección masiva opcional | hover con borde, **sin ribbon en reposo**, checkbox para lote, rail de estado | `EntityCard` (entity-view), `TaskInbox`, Kanban |
| `nav` | enlace | como `item` + chevron como glifo | `ModuleGrid`, `ModuleLauncher` |
| `metric` | informativa o enlace | superficie compartida, tipografía `kpi-value` propia | `StatCard` |
| `panel` | ninguna | `Card` shadcn | secciones de Settings, Cart, errores |

**Regla:** el ribbon CMYK pertenece a `choice`. En `item`/`nav` solo aparece en hover o seleccionado.

### 2. Layouts

`stacked` (media arriba), `row` (hoy `inline`) y `compact` (hoy `light`), más una variante `doc` **propuesta y diferida**: código mono, título, `StatusBadge`, pie con monto tabular y rail de estado con icono. No se implementa hasta tener un caso real con datos (hoy `EntityCard.Metrics`/`workflow` cubre el pie). `StatusBadge` sigue siendo el único renderer de estado (invariante 7); el rail es complementario y nunca el único portador del estado.

### 3. Tokens

- **Rail único** (`CardRail`, `components/shared/CardRail.tsx`): `tone` `warning|success|neutral|primary`, `size` `sm|md`, `decorative` (default `true`). `SelectionRail` es un `CardRail` no decorativo.
- **Selección explícita:** `CardSurface` solo emite `aria-pressed`/`aria-checked` si el llamador pasa `selected`. `undefined` = card de acción/enlace.
- **Superficies en CSS:** `surface-item` (8px) y `surface-panel` (12px); `card-flat` y `card-base` derivan de ellos. Radio de items interactivos = 8px, de paneles contenedores = 12px.
- Un solo `CardLead` (`sm` 32px / `md` 40px, `rounded-sm`) y tokens `eyebrow`/`fieldValue` para los datos clave-valor de `EntityCard`.

> La guía genérica de craft sugiere radios de 12–16px; el mundo visual comprometido del proyecto (ADR-0094, 8px para items) prevalece.

### 4. Alcance de migración

Migrar: `EntityCard` (y con él las 57 `defineEntity`), `ModuleGrid`/`ModuleLauncher`, `TaskInbox`, card de `WorkOrderKanban`, `POSApprovalCard`, `CartItem`.
Alinear sin migrar anatomía: `StatCard` (radio, borde, tono).
Mantener: `Card` de Settings, `Cart`, `PayrollCard` (recibo), `AuditTimeline`, columnas del kanban.
Excluir: los `error.tsx`/`not-found` (usan `ErrorPage`).
Los ~60 bloques `border rounded` sueltos no son cards (avisos y grupos de campos): requieren un `InfoBlock`/callout propio, no esta familia.

---

## Implemented in this ADR's first step

- `CardRail` unificado; `SelectionRail` lo compone; se retiran los tokens sin uso `lightRail`/`lightRailSelected`.
- `CardSurface`: `selected` ya no tiene default; `EntityCard` pasa `selected` solo cuando es `true`; `CardRow` propaga `selected` tal cual.
- Tests: `CardSurface.test.tsx` (semántica ARIA y rail).
- Comentarios de `ChoiceCard` corregidos (el lead light es `w-10`, no 32×32).

**Efecto visual conocido:** el rail `neutral` pasa de `border-border/20 bg-muted/30` a `border-border/60 bg-muted/20` (el de selección), que es el único que se veía de forma consistente.

## Implemented in the second step

- `CardLead` (sm/md, `stretch`) reemplaza las dos ramas duplicadas del lead de `EntityCardHeader`; el tono por defecto pasa de `bg-accent` a `bg-muted` (el del kit).
- Tokens `entityTitle` (semibold), `entitySubtitle`, `eyebrow`, `fieldValue`, `leadBase/leadSize`. `EntityCard.Field/Meta/Metrics/WorkflowBody` los usan; las etiquetas pasan de 9px con `/60` a 10px a contraste completo.
- `selectableCardClass`/`CardSurface` reciben `kind`; `EntityCard` es `kind="item"` (ribbon solo seleccionada).
- `surface-item` / `surface-panel` en `globals.css`; `card-flat` y `card-base` derivan de ellos (sin cambio visual).
- `EntityCard.ListItem` pasa de `card-base` (12px) a `card-flat` (8px).
- Contrato `component-card-family.md`, `design-system.md` §2 y rutas en `CLAUDE.md`/`docs/README.md`.

## Implemented in the third step

- `ModuleGrid` → rol `nav`: `card-flat` en fila con `CardLead`, título/descripción del kit y chevron (8px, sin la altura fija `h-28` de ADR-0074). `ModuleLauncher` pasa de `card-base` a `card-flat`.
- `TaskInbox` y la card del Kanban de órdenes de trabajo → `CardSurface kind="item"`. El Kanban dejaba `py-6 gap-6 shadow-card` del `Card` shadcn bajo `card-base`; ahora usa la superficie contratada.
- `CardSurface`: Enter/Space solo activan cuando el foco está en la card; un botón anidado ya no abre la card.
- `StatCard` (rol `metric`) **no se toca**: ya usa el radio de panel (12px) y su tipografía es propia.
- Story de `ModuleGrid`.

## Implemented in the fourth step

- Ratchet `lib/__tests__/card-family.contract.test.ts` + `card-family.baseline.json` (deuda inicial: 41 archivos / 58 literales; solo puede encoger), con escape `card-family-allow` y la regla "sin `card-base`/`card-flat` sobre `<Card>`".
- `DESIGN.md`: principio 8 (cards por rol), fila en el mapa de referencia y mención del ratchet.

## Implemented in the fifth step

- Migradas 4 entradas del baseline (41→37 archivos, 58→50 literales):
  - `CartItem` → `CardSurface kind="item" interactive={false}` (de 16px a 8px).
  - `WorkflowSettings` (2 filas) y `ProductVariantsTab` (3 bloques) → `surface-panel`; sin `hover:shadow-elevated` en filas que no son interactivas.
  - `POSApprovalCard` → `InfoBlock` (nuevo): un aviso con acciones no es una card. Tono solo en el icono, texto en tokens neutros, `role="status"`.

## Implemented in the sixth step

- Baseline vaciado (37 archivos / 50 literales → 0). `surface-panel` deja de incluir `overflow-hidden` (lo añade `card-base`).
- Hechos a mano → `surface-panel`/`surface-item`: login y not-found, `EditableCollection`, `ActionDock`, `AttachmentList`, skeletons, tablas contenedoras (finanzas, líneas de formulario, F29), paneles del POS, modales de sesión, perfil, historial de suscripciones, formularios de variantes y varios más (43 literales).
- `StatCard` pasa a `surface-panel`. `SelectableCard` y `POSReport` (ticket impreso) quedan con `card-family-allow`.
- `BankCheckSection`: la franja izquierda de 4px (patrón prohibido) pasa a `CardSurface kind="item"` + `CardRail` con icono y texto `sr-only` "Vencido".
- `PaymentMethodSelector`: la superficie "ya elegida" usa `selectableCardClass`. `Step3_Delivery`: el aviso de servicios usa `InfoBlock`.
- Cambios visibles conocidos: radios de 16/20px bajan a 12px (paneles del POS, login, KPIs).

## Implemented in the seventh step (EntityCard on the ProductCard anatomy)

- **Card pulsable por enlace extendido:** el título (`data-card-open`) cubre toda la card; acciones, checkbox y enlaces de `meta` quedan encima como hermanos (AX-4 intacto). Hover con borde y anillo de foco desde el título.
- `CardLayout.code` (mono sobre el título), `CardLayout.footer` (`EntityCard.Foot`: caption + monto + chevron, `h-full` para anclar abajo) y `CardLayout.rail` (`CardRail` con tono desde `resolveStatus` e icono por tono).
- `CardRail` gana los tonos `info` y `destructive`. `Meta` sin sangrado lateral (alineado con código y título). `Media` de 80px.
- Aplicado: productos (media arriba, código, pie con precio), órdenes de venta y de compra (riel de estado). `ProductPriceCell` respeta `align`.
- Decisión: las personas (contactos) mantienen el avatar en línea; la franja de media solo para catálogo.

## Implemented in the eighth step (catalog and document templates)

- **Plantilla catálogo** (`media.placement: "top"`): checkbox de lote en la esquina superior derecha de la franja, kebab de la entidad en el pie (reemplaza el chevron) y grilla de 4–5 columnas por container queries (1/2/3/4/5 según el ancho de la grilla). El pie se dibuja siempre en catálogo, con o sin monto.
- **Plantilla documento** (`rail`): el riel pasa a la izquierda y aloja el icono de la entidad; la fila del título pierde su icono con fondo. `hubStatus` en cards muestra solo los anillos (sin chip; etiqueta `sr-only`).
- Extendido a 22 entidades documentales (órdenes, entregas, devoluciones, facturas y notas, asientos, OT, remuneraciones, movimientos de tesorería, cheques, lotes, períodos de impuestos…) y a 11 catálogos (productos, categorías, almacenes, BOM, medios de pago, bancos, cuentas, terminales, atributos). Facturas y notas añaden `hub` a su `trailing`.
- Corregida la card de estados de cuenta (formato antiguo `sections`). Subtítulos a 2 líneas en lugar de truncar.
- Personas y listas de configuración (contactos, usuarios, empleados, UoM, reglas de precio, grupos, socios) mantienen su layout.

## Implemented in the ninth step (selection language and last entities)

- **Ribbon en entity-view:** `EntityCard` usa `kind="choice"` + `CardSurface pressable` (aspecto pulsable sin rol ni tab stop): ribbon CMYK al hover y fijo al seleccionar por lote, con anillo y marca CMYK en el checkbox. Corrige que el ribbon no aparecía. Esto reemplaza la regla anterior de "ribbon solo seleccionada" para entity-view; bandeja y kanban la conservan.
- **Selección como primera acción:** en `selection="bulk"` el clic en cualquier parte de la card la selecciona (capa solo puntero, `aria-hidden`; el checkbox es el control accesible) y el título abre el registro. Sin lote, el título es el enlace extendido.
- `CardSurface` ya no emite `aria-pressed`/`aria-checked` si no es interactivo.
- `EntityCard.Meta` apila los pares en una columna cuando la card mide menos de 18rem (catálogos de 4–5 columnas).
- **Plantilla catálogo:** contactos (blobatar en la franja, código `CON-n`), grupos, socios (patrimonio en el pie) y órdenes de trabajo (fecha de entrega en el pie; ya no usan riel). **Plantilla documento:** unidades de medida y reglas de precio (riel con estado activo/inactivo).

## Plan (pendiente)

1. Verificar en la app real (Productos, Órdenes de venta, Facturas, Almacenes, Bancos) y decidir si `footer` con monto se extiende a documentos.
2. Verificación visual de `EntityCard` en una entidad con media, otra documental y una de contactos.
3. Aplicar `InfoBlock` a avisos que hoy son `div` con otra forma (el ratchet solo ve literales `border rounded bg-card`).

## Consequences

- Un cambio de anatomía llega a todas las vistas de card vía entity-view.
- El Dashboard y Settings pasan de 12px a 8px en los módulos (cambio visible, decidido).
- Se requiere actualizar los contratos de capa 20 antes de aceptar este ADR.
