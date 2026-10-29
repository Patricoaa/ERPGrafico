---
id: 0096
title: Wizard step rail redesign — numbered nodes, connector, a11y, detail on active
status: Accepted
date: 2026-10-22
author: frontend-team
---

# 0096 — Wizard step rail redesign

**Related:** `docs/20-contracts/component-modal.md` (Sidebar primitives), ADR-0070 (Primary = K100), ADR-0075 (FadeIn-only), `docs/20-contracts/color-system.md`
**Extended by:** ADR-0099 (work order rail as a status board)

---

## Context

El riel de pasos compartido (`WizardStepsSidebar` en `components/shared`) tenía 7 problemas:

1. **Sin numeración ni línea conectora** — no se lee como riel; el operador no puede referenciar "la etapa 7".
2. **`detail` solo en `past`** — en ventas/notas/compras el resumen del paso **activo desaparece** justo cuando se necesita.
3. **Filas ~48px (`p-3` + icono `h-5`)** — workorder tiene 13 etapas → scroll, título no sticky, paso activo fuera de vista.
4. **Filas clicables = `<div onClick>`** — sin teclado, sin `role`, sin `aria-current`.
5. **Paleta por `className` ("CSS soup")** — `WizardProcessSidebar` peleaba con clases base (`bg-success/10` vs `/5`, `bg-accent` vs `bg-primary`).
6. **Etapa real marcada como `future` (atenuada)** — confundía: la etapa donde está la OT parecía no alcanzable.
7. **`animate-in` inline (allowlist) + prop `footer` sin uso** — deuda técnica.

---

## Decision

### 1. Nueva anatomía del riel

```
┌─ ETAPAS ────────────────── 03 / 13 ┐   ← header sticky + contador mono
│                                     │
│  ✓  01  Origen de Fabricación        │   past  → nodo success + check
│  │     Manual                        │
│  ⦿  02  Selección de OV y Producto   │   active→ nodo K100 (negro)
│  │                                    │
│  ◌  03  Configurar Fabricación       │   current → nodo primary/10 + ring
│  │                                    │
│  ○  04  Asignación de Materiales     │   future → nodo hueco, muted
│                                     │
│  ○  05  Aprobación de Materiales     │
└─────────────────────────────────────┘
```

- **3 columnas por fila**: nodo 20px │ número mono 01..N │ label + detail.
- **Línea conectora vertical** entre nodos (gradiente success→border).
- **Compact por defecto**: `py-1.5 px-2`, icono 20px, label `text-xs`, detail `text-3xs` → 13 etapas ≈ 400px.

### 2. Estados y paleta canónica (sin overrides del consumidor)

| Estado | Nodo | Label | Fila |
|--------|------|-------|------|
| `past` | `bg-success/15 text-success-foreground border-success/25` + ✓ | `text-foreground/80` | `hover:bg-success/5` |
| `active` | `bg-primary text-primary-foreground` (K100) | `text-foreground font-semibold` | `bg-accent/40` |
| `current` *(nuevo)* | `bg-primary/10 text-primary border-primary/30` | `text-foreground` | `bg-accent/20` |
| `future` | `border border-border text-muted-foreground/50` | `text-muted-foreground` | — |

> **Regla**: `accent` **no** es color de énfasis (color-system.md §3.1). `active` usa K100 (ADR-0070). El riel expresa *estado*, no *fase*. Se elimina la paleta especial de "etapas de creación" (`bg-accent`/`bg-success/5`).

### 3. Accesibilidad (stretched-link pattern)

- Cada fila es un `<button>` con `after:absolute after:inset-0` (stretched link).
- `aria-current="step"` en el activo.
- `aria-disabled` + `disabled` en futuros/deshabilitados (un `disabled: false` explícito habilita un paso futuro).
- El contenido de la fila (`z-10`) es `pointer-events-none`: el clic llega al botón estirado.
- Acciones de governance (ver/editar/retroceder) en columna separada `z-10` → **nunca botones anidados**.
- Navegación por teclado nativa (Tab/Enter/Space).

### 4. Auto-scroll + header sticky

- El rail hace `scrollIntoView({block: 'nearest'})` al paso activo al cambiar `currentStep`.
- Header con contador `03 / 13` es `flex-shrink-0` (sticky visual).

### 5. `detail` visible en `active` y `past` (default `both`)

Arregla el bug #2 en ventas/notas/compras. Controlable por prop `detailVisibility: 'both'|'active'|'past'|'none'`.

### 6. API aditiva (compatibilidad hacia atrás)

```ts
type WizardStepStatus = 'active' | 'past' | 'future' | 'current'

WizardStepsSidebar (props nuevas, todas con default)
  showNumbers?: boolean              = true
  detailVisibility?: 'both'|'active'|'past'|'none' = 'both'
  showCounter?: boolean              = true
  density?: 'compact'|'comfortable'  = 'compact'
```

- `WizardSidebarStep` gana `badge?: ReactNode` (chip opcional, ej. "actual").
- **Se elimina** `footer` (0 consumidores).
- `title`, `currentStep`, `steps`, `width`, `onStepClick`, `renderStepActions`, `className` **sin cambios**.

### 7. Migración de los 4 adaptadores

| Adaptador | Cambios |
|-----------|---------|
| `WizardProcessSidebar` (production) | Borrar CSS soup; mapear `current` (etapa real ≠ etapa vista); mantener governance + dot de modo; `width: w-52→w-60` |
| `ProcessSummarySidebar` (sales) | `detail` → `text-3xs`; `showNumbers={true}`; `detailVisibility="both"` |
| `NoteProcessSidebar` (notes) | Ídem |
| `PurchaseProcessSummarySidebar` (purchasing) | Ídem |

### 8. Limpieza

- `WizardStepsSidebar.tsx` sale de `ANIMATE_ALLOWLIST` (ratchet ADR-0075).
- Tests actualizados + nuevo `WizardStepsSidebar.test.tsx` (12 casos).
- Storybook: `WizardStepsSidebar.stories.tsx` (8 variantes).
- Contrato actualizado en `component-modal.md` §"Sidebar primitives".

---

## Consequences

### Positivas

- Un solo riel consistente en **workorder, ventas, notas, compras**.
- Operador ve numeración, línea, contador → referencia verbal inequívoca ("voy a la 7").
- Detail en paso activo → ventas/notas/compras muestran resumen cuando se necesita.
- Compacto: 13 etapas sin scroll en 900px de alto.
- A11y nativa, sin debt de `<div onClick>`.
- Paleta única, sin "CSS soup" en adaptadores.
- ADR-0075 ratchet: un archivo menos en allowlist.

### Negativas / Riesgos

- Cambio visual en checkout de ventas/notas/compras (detail ahora visible en activo).
- Eliminación de paleta "creación" (`bg-accent` en active) — era incorrecta semánticamente.
- `footer` prop eliminada (era dead code, 0 consumidores).

---

## Alternatives considered

1. **Solo fixes puntuales (numeración + a11y)**: descartado — seguía sin línea, sin compact, sin detail en activo, paleta sucia.
2. **Mover riel a la derecha en workorder**: fuera de scope; el layout 3-columnas del wizard ya define izquierda=proceso, derecha=resumen.
3. **Mantener paleta creación**: contradice ADR-0070 y color-system.md.

---

## References

- `docs/20-contracts/component-modal.md` (sección "Sidebar primitives" actualizada)
- `docs/20-contracts/color-system.md` §3.1 (`accent` = interaction surface, no emphasis)
- ADR-0070 (Primary = Process Black K100)
- ADR-0075 (FadeIn-only motion primitive)
- `frontend/components/shared/WizardStepsSidebar.tsx`
- `frontend/components/shared/WizardStepsSidebar.test.tsx`
- `frontend/components/shared/WizardStepsSidebar.stories.tsx`