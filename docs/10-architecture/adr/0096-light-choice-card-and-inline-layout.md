---
id: 0096
title: ChoiceCard light variant + CardSurface inline layout fix
status: Accepted
date: 2026-10-22
author: frontend-team
---

# 0096 — ChoiceCard light variant and CardSurface inline layout fix

**Related:** ADR-0094 (card anatomy kit + radius), ADR-0095 (CardRow + RadioCard removal + entity-view), `docs/20-contracts/component-choice-card.md`, `docs/20-contracts/component-selectors.md`, `docs/10-architecture/design-system.md`

---

## Context

Tras ADR-0095, tres ajustes pendientes del usuario:

1. **Ajuste 1 — check → CmykRing**: "todo uso de check migrarse a CmykRing". Se **revirtió** tras evaluar: la cinta CMYK + `SelectionCheck` + anillo K100 es el lenguaje coherente de las cards; `CmykRing` queda en `Checkbox`/`SelectionRing` (bulk) / `ActionDock`. **0 cambios de código**.

2. **Ajuste 2 — variante ligera para ex-`RadioCard` en `LabeledContainer`**: 7 archivos / 14 instancias con la misma forma (icono + título + 1 línea descripción, 2–3 por fila, sin media real, sin footer, sin montos). Hoy renderizan con banda gris de 80px que sólo aloja un icono → card ~150px para ~40px de contenido.

3. **Ajuste 3 — cobertura del kit actual**: auditoría entregada en el plan (ver sección "Cobertura del kit" abajo).

**Bug crítico hallado (B2)**: `CardSurface layout="inline"` emitía `p-0` pero **no** `flex-row` ni `gap-0`. El `Card` base hereda `flex flex-col gap-6` → **`CardRow` se renderizaba vertical con huecos de 24px**. Afecta a 3 consumidores de Fases 2a/2b nunca verificados visualmente: `MfgLineCard`, `VariantSelectorModal`, `SaleOrderProductStep` (líneas).

---

## Decision

### 1. Tokens de anatomía ligera (`card-anatomy.ts`)

```ts
lightLead:        "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm"
lightBody:        "flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pl-3 pr-2"
lightTitle:       "line-clamp-1 text-left text-sm font-semibold leading-snug"
lightDescription: "line-clamp-2 text-2xs leading-snug text-muted-foreground"
lightRail:        "flex w-9 shrink-0 items-center justify-center border-l border-border/60 bg-muted/20 transition-colors"
lightRailSelected:"border-primary/30 bg-primary/5"
```

### 2. `SelectableCard` — `SelectionCheck` + `SelectionRail`

- `SelectionCheck` gana `placement?: "overlay" | "inline"` (default `"overlay"` → comportamiento actual intacto en 5 sitios). `"inline"` quita el `absolute bottom-2 right-2`.
- **`SelectionRail({ selected, children })`** — riel **no decorativo** (sin `aria-hidden`, a diferencia de `CardRail`), para que el `sr-only` "Seleccionado" se lea. `CardRail` (tonal, de `MfgLineCard`) **no se toca**.

### 3. `ChoiceCard variant="light"` (discriminated union)

```ts
type StackedProps = { variant?: "stacked"; /* ...props completas... */ }
type LightProps   = { variant: "light"; icon: ComponentType; /* solo icon, title, description, iconClassName, disabled, className */ }
```

Visual:

```
stacked (actual)                      light (nuevo)
┌──────────────────┐                  ┌──────────────────────────┐
│ ▨ franja 80px    │                  │ ◨ Título            │ ◉ │
│              (✓) │                  │    descripción        │   │
├──────────────────┤                  └──────────────────────────┘
│ meta │                    ↑ lead 32px   cuerpo rail w-9
│ Título           │                      (flex-row, gap-0, rounded-sm)
│ descripción      │                   ≈60px alto (vs ≈142px)
│ footer           │
└──────────────────┘
```

Usa el **mismo shell** (`Button` + `selectableCardClass`) con override `flex-row`. El riel aloja el `SelectionCheck` cuando `selected`; vacío y apagado cuando no. La cinta CMYK superior se mantiene.

### 4. `CardSurface` fix (B2)

```ts
layout === "inline" ? "flex-row gap-0 p-0" : "gap-0 p-0"
```

+ `CardRow` blindado con `flex-row items-stretch`.

Repara `MfgLineCard`, `VariantSelectorModal`, `SaleOrderProductStep` de un golpe.

### 5. Migración de los 7 sitios (14 instancias)

| Archivo | Instancias | Grid |
|---|---|---|
| `Step2_PurchaseDTE` | 3 | `1 / md:3` |
| `Step4_Receipt` | 3 | `1 / md:3` |
| `NoteStep_Logistics` | 3 | `1 / md:3` |
| `ContactDrawer` | 2 | `2` |
| `ProductManufacturingTab` | 3 | `3` |
| `PartnerWithdrawalWizard` | 2 | `2` |
| `PartnerContributionWizard` | 2 | `2` |

Cambio mecánico: `variant="light"`. Props idénticas.

### 6. `ProductManufacturingTab` — fix B1

Eliminado `<LabeledContainer label="Modo de Producción">` duplicado (introducido en `d671c4fe9`).

---

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **`OptionCard` nuevo** | Añade componente al barrel + test + docs, duplica contrato radiogroup. `ChoiceCard` con discriminated union da lo mismo con un solo import. |
| **Reusar `CardRow` con `role="radio"`** | `CardRow` semánticamente es una fila de cosa, no una opción; su `lead` es caja 40×40 con fondo. La variante ligera necesita lead 32×32 sin fondo + rail dedicado al marcador. |
| **`CmykRing` como marcador de cards (Ajuste 1 original)** | Doble marca CMYK (cinta + anillo) = ruido visual. `SelectionCheck` + cinta es lenguaje unificado y testeado. |

---

## Cobertura del kit actual (respuesta al Ajuste 3)

**Ya en el kit** (`CardSurface` + `cardAnatomy` + `selectableCardClass`) — 9 archivos:

| Archivo | Estado |
|---|---|
| `EntityCard.tsx` | `CardSurface layout="stacked"` ✅ |
| `ChoiceCard.tsx` | ✅ (stacked + light) |
| `CardRow.tsx` | ✅ |
| `ProductCard.tsx` | ✅ |
| `VariantSelectorModal.tsx` | `CardRow` ✅ |
| `SaleOrderProductStep.tsx` | `CardSurface` + `CardRow` ✅ |
| `OriginSelectionStep.tsx` | `CardSurface` ✅ |
| `MfgLineCard.tsx` | `CardRow` ✅ |
| `PaymentMethodSelector.tsx` | 🟡 Parcial — usa `cardAnatomy` pero superficies a mano |

**Consumidores de `EntityCard`**:
- **Ruta canónica**: `entity-view/Collection.tsx` → **102 archivos** renderizan `<Collection>` (22 vistas Collection + drawers + modales). Todos adoptan la nueva anatomía en grilla.
- **Directos**: 3 archivos de tesorería (`BankCenterDashboard` esqueletos, `BankRecentActivity`, `BankUpcomingMaturities`) → usan `EntityCard.ListItem`, que **no** es el kit (usa `card-base` a mano).

**Fuera del kit** (53 archivos usan `components/ui/card` directo): `UnifiedAccountsView` (115), `ProfileView` (25, con `accent-visible` legacy), `StatementDetailPanel` (20), `TaxDeclarationsClientView` (15), `SalesSettingsView` (14), `WorkflowSettings` (13), `StatCard` (10), `TaskInbox` (`Card variant="flat"`), `ModuleLauncher`.

---

## Consequences

- **Un solo componente de opción** (`ChoiceCard`) con dos variantes tipadas.
- **Layout inline reparado** — 3 consumidores de Fases 2a/2b ahora renderizan horizontal.
- **Coherencia visual** en los 7 sitios ex-`RadioCard`: ~60px vs ~142px de alto.
- **Accesibilidad preservada**: `SelectionCheck` con `sr-only` "Seleccionado" en el riel no decorativo.
- **TypeScript protege** contra props inválidas en cada variante.

---

## Governance

- **ADR-0095** — nota de enmienda con cross-ref a 0096 (sección 2 — `CmykRing` restringido — **se mantiene sin cambios**).
- **`design-system.md` §2** — añadir variante ligera a familia `rounded-sm`; marca de selección de cards = cinta CMYK + `SelectionCheck`; `CmykRing` sólo en `Checkbox`/`SelectionRing`/`ActionDock`.
- **`component-choice-card.md`** — nueva sección "Variante ligera" (ASCII + props + tabla 7 sitios); tabla "Usos" actualizada.
- **`component-selectors.md`** — §Card anatomy: línea de la variante ligera.
- **`component-card.md`** — familia interactiva: añadir `ChoiceCard variant="light"`.
- **`component-entity-view.md`** — cobertura de `EntityCard` (Ajuste 3): ruta canónica `entity-view/Collection` → 102 vistas; directos tesorería fuera del kit; 53 archivos con `Card` directo (fuera de alcance).
- **`component-decision-tree.md:126`** — quitar referencia a `RadioCard` (ya no existe).
