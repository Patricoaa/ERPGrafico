---
id: 0094
title: Card anatomy kit + 8px radius for interactive cards — shared shell, tokens, and side rail
status: Accepted
date: 2026-10-22
author: frontend-team
---

# 0094 — Card anatomy kit, 8px radius, and side rail primitive

**Related:** ADR-0092 (ProductCard anatomy), ADR-0093 (ChoiceCard & media-top cards), ADR-0087 (entity-view), `docs/20-contracts/component-choice-card.md`, `docs/20-contracts/component-selectors.md`, `docs/10-architecture/design-system.md`

---

## Context

Tras ADR-0093, la familia POS (`ProductCard`, `ChoiceCard`, `ContactCard`) compartía el lenguaje de selección (`selectableCardClass`, `SelectionCheck`, ribbon CMYK). Sin embargo:

1. **Duplicación de anatomía**: `px-3 pb-3 pt-2.5`, `font-mono text-3xs`, `text-sm font-semibold`, `text-3xs caption`, `font-semibold tabular-nums text-lg`, `h-4 w-4 glyph` estaban copiados 3–4 veces.
2. **Shell frágil**: cada card componía `Card` + `selectableCardClass()` + 4 overrides (`gap-0 p-0 shadow-none rounded-sm`) para neutralizar los defaults de `Card` (`py-6 gap-6 shadow-card rounded-md`). Funcionaba por casualidad de twMerge, no por contrato.
3. **Radio contradictorio**: `design-system.md` §2 dice *"Standard Containers (12px): Cards… Use `rounded-md`"*; `selectableCardClass()` usaba `rounded-md`; pero `card-flat` (entity-view) usa `rounded-sm` (8px, el radio base R). La nueva `MfgLineCard` (paso de fabricación) pedía `rounded-sm`, forzando un override manual.
4. **Nuevo primitivo de estado**: la fabricación necesita un **riel lateral** (ámbar → verde) como único indicador de estado, sin chip ni ribbon permanente. No existía primitivo para esto.
5. **ADR-0093 §4 obsoleto**: decía que el paso de fabricación usaba `mfgDetailLineViews` (entity-view con media arriba); el cambio a `MfgLineCard` + riel lateral rompe esa decisión.

---

## Decision

### 1. Kit de anatomía (`components/shared/card-anatomy.ts`)

Tokens exportados como `cardAnatomy.{body,code,title,description,footer,caption,amount,glyph}`. Única fuente para toda la familia interactiva. Cambios de diseño = un archivo.

### 2. Superficie contratada (`components/shared/CardSurface.tsx`)

- `CardSurface` = `Card` + `selectableCardClass()` + **neutralización determinista** de `gap-6/py-6/shadow-card/rounded-md` (vía `gap-0 p-0 shadow-none` y el radio que venga de `selectableCardClass`).
- `CardRail tone="warning|success|neutral"` = riel `w-14` con `border-l border-{tone}/20 bg-{tone}/10 text-{tone}`, icono centrado, `aria-hidden`.
- Exportados desde el barrel `components/shared`.

### 3. Radio 8px (rounded-sm) para **toda** la familia interactiva/seleccionable

- `selectableCardClass()`: `rounded-md` → `rounded-sm`.
- `ProductCard`, `ChoiceCard`, `ContactCard` (Blobatar), `MfgLineCard`, `PaymentMethodSelector.chosenCardClass` migran simultáneamente.
- **Excepción documentada**: `card-flat` / entity-view / `AutoEntityCard` / `RadioCard` / `KPIComponents` / `ProfileView` / `TaskActionCard` / `CartItem` / `ManufacturingSpecsEditor` / `NoteStep_TypeSelector` / `NewFiscalYearDrawer` / `SaleOrderProductStep` **no cambian**. Adopción oportunista.

### 4. Migración del piloto (familia POS)

| Componente | Antes | Después |
|---|---|---|
| `ChoiceCard` | clases a mano | `cardAnatomy` tokens |
| `ProductCard` | `Card` + 4 overrides | `CardSurface` + tokens |
| `ContactCardGrid` | `Blobatar rounded-md` | `Blobatar rounded-sm` |
| `MfgLineCard` | `Card` + overrides + riel a mano | `CardSurface` + tokens + `CardRail`; **sin `selected`** → ribbon solo en hover, riel = único estado |
| `PaymentMethodSelector` | `chosenCardClass` `rounded-md` + clases a mano | `rounded-sm` + tokens |

### 5. MfgLineCard — la señal de estado

**Bug corregido**: `selectableCardClass({ selected: hasConfig })` añadía *tres* señales simultáneas al configurar: ribbon CMYK permanente + `border-primary` + `ring-1 ring-primary`. Ahora `selected` **no se pasa**; el ribbon queda en modo preview (hover/foco) y el estado vive **solo en el riel** (ámbar = pendiente, verde = configurado).

---

## Consequences

- **Single source of truth** para anatomía y shell. El próximo card POS (o `CartItem` si se migra) no puede divergir por accidente.
- **Radio coherente** en toda la familia interactiva: 8px = radio base R. `design-system.md` §2 se enmienda (ver abajo).
- **Contrato público** (`CardSurface`, `CardRail`, `cardAnatomy`) listo para que otras features lo adopten sin forzar.
- **ADR-0093 §4 enmendado** (ya hecho en commit anterior): el paso de fabricación ya no usa `mfgDetailLineViews`.

---

## Governance (mismo commit)

- **`design-system.md` §2 Radius Hierarchy**: se añade nota *"Interactive/selectable cards (ProductCard, ChoiceCard, MfgLineCard, ContactCard) use `rounded-sm` (8px) as an exception to the 'Standard Containers (12px)' rule. The base radius R=8px applies; `rounded-md` (12px) is reserved for section wrappers."*
- **`docs/20-contracts/component-choice-card.md`**: añade `CardSurface`, `CardRail`, tokens, radio 8px, y aclara que `MfgLineCard` usa `role="button"` + `CardRail` (no `ChoiceCard`).
- **`docs/20-contracts/component-selectors.md` §"Card anatomy"**: `ProductCard` ahora vía `CardSurface` + tokens.
- **`docs/20-contracts/component-card.md`**: nota de que la variante `default` de `Card` no cambia (`rounded-md`); la familia interactiva usa `CardSurface` que aplica `rounded-sm`.