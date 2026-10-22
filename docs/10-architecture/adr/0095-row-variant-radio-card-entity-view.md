---
id: 0095
title: CardRow variant + RadioCard removal + entity-view migration to CardSurface
status: Accepted
date: 2026-10-22
author: frontend-team
---

# 0095 — CardRow variant, RadioCard removal, and entity-view migration

**Related:** ADR-0092 (ProductCard anatomy), ADR-0093 (ChoiceCard & media-top cards), ADR-0094 (Card anatomy kit + radius), ADR-0087 (entity-view), `docs/20-contracts/component-choice-card.md`, `docs/20-contracts/component-selectors.md`, `docs/20-contracts/component-card.md`, `docs/10-architecture/design-system.md`

---

## Context

Tras ADR-0094 (kit de anatomía + radio 8px + CardSurface + CardRail), quedaban tres frentes abiertos:

1. **Variante fila (inline)**: `MfgLineCard` demostró que la familia necesita un layout horizontal sin media strip. `VariantSelectorModal`, `SaleOrderProductStep` (líneas), y `OriginSelectionStep` usaban botones a mano.
2. **RadioCard**: 14 instancias con lenguaje propio (`RadioGroupItem` + CmykRing) divergente de `ChoiceCard` (ribbon CMYK + SelectionCheck). El binding de formulario nativo **no se usaba** (todos controlan con `value`/`onValueChange` en estado React).
3. **entity-view Collection**: 22 vistas + 8 usos directos de `EntityCard` + 1 `AutoEntityCard` usaban `card-flat` + `accent-visible` (lenguaje distinto). `AutoEntityCard` y `DataTableView` tenían 0 consumidores.

---

## Decision

### 1. Variante fila — `CardRow` (`components/shared/CardRow.tsx`)

- Layout inline: `lead` opcional (40×40) | `code` + `title` + `description` + `footer` | `rail` opcional.
- Tokens inline: `lead`, `inlineBody`, `inlineCode`, `inlineTitle`, `inlineFooter`, `inlineAmount`.
- `CardRowWithRail` + `GlyphConfigure/Add/Chevron` presets.
- Usado por: `MfgLineCard`, `VariantSelectorModal`, `SaleOrderProductStep` (líneas), `OriginSelectionStep`.

### 2. Eliminación de `RadioCard` (86 líneas, 14 instancias)

**Hallazgo clave**: los 14 usos controlan con `value`/`onValueChange` en estado React — **el binding nativo no se usa**. `RadioGroupItem` + `CmykRing` eran andamiaje innecesario.

**Migración**: 14 instancias → `ChoiceCard` (converge a 37 usos totales). Diferencia visual aceptada: `ChoiceCard` usa media strip con icono; los 3 verticales de `ProductManufacturingTab` pierden el centrado vertical pero ganan consistencia.

`CmykRing` queda restringido a: `Checkbox`, `SelectionRing` (bulk selection en tablas). **Principio**: *"El medio determina el marcador"* — Card: ribbon CMYK + SelectionCheck; Control/Tabla: CmykRing.

### 3. entity-view Collection → CardSurface

- `EntityCardRoot` → `CardSurface layout="stacked"` (usa `selectableCardClass`).
- `isSelected` (hub focus) → `selected` → ribbon CMYK + ring.
- `checked` (bulk) → conserva `SelectionRing` + `border-primary/40 bg-primary/5`.
- `EntityCardMedia` ya tenía `rounded-t-sm` (fix Fase 2a.3).
- `card-flat` deja de usarse en `EntityCard`; `Card variant="flat"` queda solo para `TaskInbox`.

### 4. Limpieza de código muerto

- `RadioCard.tsx` (86 líneas) **eliminado**.
- `AutoEntityCard.tsx` (470 líneas) + test **eliminados** — 0 consumidores (`LEGACY_CONSUMERS` ya vacío).
- `DataTableView.tsx` **eliminado** — 0 consumidores (solo export + contract test).
- `card-flat` deja de usarse en `EntityCard`; `Card variant="flat"` queda para `TaskInbox`.

---

## Consequences

- **Un solo lenguaje de selección** en todas las cards interactivas: ribbon CMYK (hover preview) + SelectionCheck (elegido) + ring (elegido).
- **Un solo shell** (`CardSurface`) para stacked e inline layouts.
- **Un solo token set** (`cardAnatomy`) para stacked e inline.
- **Blast radius controlado**: entity-view migración atómica (2 archivos → 22 vistas) al final de la fase.
- **RadioCard/CmykRing** reducido a su dominio natural (controles, no cards).

---

## Governance

- **ADR-0094** actualizado (este commit).
- **ADR-0093** §4 ya enmendado (commit previo).
- **`design-system.md` §2**: excepción extendida a `EntityCard` + nuevos selectores.
- **`component-choice-card.md`**: `RadioCard` eliminado → migración a `ChoiceCard`; `CardRow` documentado.
- **`component-selectors.md`**: `VariantSelectorModal` → `CardRow`; `SaleOrderProductStep` → `CardSurface` + `CardRow`.
- **`component-card.md`**: `EntityCard` usa `CardSurface` stacked; `Card variant="flat"` solo `TaskInbox`.
- **`component-entity-view.md`** (nuevo/actualizado): `EntityCard` usa `CardSurface`; `accent-visible` solo para bulk `checked`.