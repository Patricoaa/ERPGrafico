---
layer: 20-contracts
doc: geometry-surfaces
status: active
owner: frontend-team
last_review: 2026-11-24
stability: contract-changes-require-ADR
---

# Geometría y superficies — radios, bordes, sombras y acentos

Contrato de la geometría del sistema: qué radio, borde y sombra lleva cada nivel de superficie, y qué utilidades de acento existen. Absorbe lo que seguía vigente del antiguo `docs/10-architecture/design-system.md` (retirado en [ADR-0157](../10-architecture/adr/0157-design-system-doc-consolidation.md)). Implementación: `frontend/app/globals.css`.

Las cards (roles, anatomía, lenguaje de selección) tienen su propio contrato: [component-card-family.md](./component-card-family.md). El color, en [color-system.md](./color-system.md).

---

## 1. Escala de radio (remapeada)

`globals.css` **remapea** la escala de Tailwind sobre una base `R = --radius = 0.5rem`:

| Utilidad | Token | Valor |
|---|---|---|
| `rounded-sm` | `--radius-sm = R` | 8 px |
| `rounded-md` | `--radius-md = R + 4px` | 12 px (**no** los 6 px de Tailwind) |
| `rounded-lg` | `--radius-lg = R + 8px` | 16 px |
| `rounded-xl` | `--radius-xl = R + 12px` | 20 px |

Valores fuera de esta escala (`rounded-2xl`, `rounded-[…]`) están prohibidos en superficies.

## 2. Jerarquía de esquinas anidadas

Un contenedor lleva un radio mayor o igual que su contenido.

| Nivel | Radio | Superficies |
|---|---|---|
| Atómico | 8 px `rounded-sm` | botones, inputs, checkboxes, chips y badges, ítems de menú |
| Item interactivo | 8 px `surface-item` | cards `choice`/`item`/`nav` (`ProductCard`, `ChoiceCard`, `ContactCard`, `EntityCard`…). Comparten R con lo atómico porque su lenguaje de selección es atómico (ADR-0094/0097) |
| Contenedor | 12 px `surface-panel` | paneles, `Metric`, `ChartCard`, `Card` de panel |
| Overlay flotante | 16 px `rounded-lg` | `Dialog`/`BaseModal`, `Popover`, raíz de `DropdownMenu`. Sus ítems internos vuelven a `rounded-sm`; `TooltipContent` (micro-overlay) usa `rounded-md` |
| Panel de borde / shell | 0 `flush-panel` | `<main>` de `DashboardShell`, `Drawer`, `CollapsibleSheet`: planos, sin radio ni sombra, borde hairline en el lado que limita con el contenido (shell ERPNext v16, ADR-0079) |
| Píldora | `rounded-full` | botones solo-icono, status pills, handles de arrastre, avatares |

`rounded-xl` queda en la escala pero hoy no tiene superficie asignada; no lo uses como "card grande".

## 3. Utilidades de superficie

| Utilidad | Qué aplica | Uso |
|---|---|---|
| `surface-item` | `rounded-sm` + `border-border` + `bg-card`, sin sombra, recorta | items interactivos |
| `card-flat` | `surface-item` + hover de fondo + foco `ring-primary` | items con hover |
| `surface-panel` | `rounded-md` + `border-border` + `bg-card`; **no** recorta | contenedores |
| `card-base` | `surface-panel` + `overflow-hidden` + hover con `shadow-elevated` | panel clicable |
| `flush-panel` | `bg-card` + `rounded-none` + sin sombra | shell y paneles de borde |

En `Drawer` no se pasan `border`/`shadow`/`rounded-*`/`bg-*` por `className`: el lado y el borde los decide `sideStyles` (`components/shared/Drawer.tsx`).

## 4. Elevación

Sombras como tokens (`--shadow-*` en `@theme`), de menor a mayor: `shadow-card` → `shadow-elevated` → `shadow-floating` → `shadow-overlay` → `shadow-surface`. No sumes sombra a un `surface-item` ni a un `flush-panel`. Sin `shadow-[…]` arbitrarios.

## 5. Acentos

| Utilidad | Efecto | Uso |
|---|---|---|
| `ribbon-cmyk` | franja superior de 4 px en 4 bandas C · M · Y · K (la K usa `foreground` para verse en oscuro); el host debe recortar | card elegida |
| `ribbon-cmyk-hover` | junto a `ribbon-cmyk`: la franja solo aparece en hover/foco (previsualiza la selección) | cards elegibles no elegidas |
| `accent-visible` | fondo `primary/5` + barra interior izquierda de 2 px | fila de tabla, `EntityCard` o lanzador activos |

Cuándo lleva ribbon cada rol de card: [component-card-family.md §1](./component-card-family.md).

## 6. Bordes

Solo tokens: `border-border` (y su opacidad `/40`, `/30`), `border-sidebar-border`, `border-{intent}`. Nunca `border-white/X` ni `border-black/X` ([color-system.md](./color-system.md)).

## 7. Primitivas shadcn

`components/ui/` es código generado (ADR-0004): no se edita para añadir lógica de dominio. Para cambiar comportamiento o estilo fijo de una primitiva se crea un wrapper en `components/shared/`. Avisos y bandas de estado son siempre `Banner`, nunca `Alert` fuera de `ui/` ([component-banner.md](./component-banner.md)).

## 8. Enforcement

- `frontend/lib/__tests__/card-family.contract.test.ts` — impide superficies de card hechas a mano (`border` + `rounded-*` + `bg-card`), incluidos los radios fuera de escala.
- Lint `controls/token-height` — alturas de control por rol ([density-system.md §4](./density-system.md)).
