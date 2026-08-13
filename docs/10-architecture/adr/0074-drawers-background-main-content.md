---
id: 0074
title: Drawers con fondo del color del main content (bg-card) en todo boundary
status: Accepted
date: 2026-08-13
author: core-team
---

# 0074 — Paneles de borde con fondo del color del main content (bg-card)

## Context

Tras [ADR-0073](0073-drawers-zero-border-radius.md), los paneles de borde (`Drawer` y `CollapsibleSheet`) son cuadrados y se leen como **paneles contiguos al contenedor/screen**. Sin embargo, su fondo no seguía esa misma dirección de contigüidad:

- El `SheetContent` del `Drawer` con `boundary="embedded"` usaba `bg-background` (`--background-raw` ≈ `0.96` de claridad, un gris azulado muy claro).
- El `SheetContent` del `Drawer` con `boundary="screen"` usaba `bg-muted/35 backdrop-blur-sm` (panel traslúcido "frosted").
- El `SheetContent` del `CollapsibleSheet` (Hub, Inbox, Profile, OrderActionPanel, Intelligence/Reconciliation) usaba `bg-muted/35 backdrop-blur-sm` (mismo "frosted" traslúcido).
- El `<main>` shell (contenido principal, `#main-content` con la utility `flush-panel`) usa `bg-card` (`--card-raw` ≈ `1.0`, blanco puro).

Resultado: un drawer o panel lateral embebido (p. ej. el `LedgerDrawer`, los drawers de entidad del registro `ENTITY_DRAWERS`, `GenericWizard` `surface="drawer"`, `AnalyticsPanel`) se percibe como una superficie con un tinte distinto al contenido principal que tiene al lado, rompiendo la lectura de "panel de borde contiguo". Un panel de borde contiguo debe compartir el fondo del contenedor al que está anclado.

## Decisión

1. **El fondo de los paneles de borde es siempre `bg-card`**, el mismo color del fondo del main content (`#main-content` → `flush-panel` → `bg-card`), en **todo contexto**: `Drawer` en ambos boundaries (`embedded` y `screen`), todos los lados, todos los modos, resizable o no; y `CollapsibleSheet` (Hub, Inbox, Profile, OrderActionPanel, Intelligence/Reconciliation). El color se aplica a nivel de componente compartido (`frontend/components/shared/Drawer.tsx` y `frontend/components/shared/CollapsibleSheet.tsx`), en el `SheetContent` (superficie), el `SheetHeader` y el footer.
2. **Los paneles dejan de ser traslúcidos.** Se elimina `bg-muted/35 backdrop-blur-sm` tanto en `boundary="screen"` del `Drawer` como en `CollapsibleSheet`; un panel de borde es un panel opaco `bg-card` (con su scrim `bg-overlay` cuando `showOverlay`). El blur traslúcido queda reservado a superficies que flotan sobre el frame (ver §Alternativas).
3. **El header hereda el fondo del panel.** La regla existente `[data-slot="sheet-content"] [data-slot="sheet-header"] { background-color: inherit !important; }` se mantiene: el header del drawer toma el `bg-card` del `SheetContent` automáticamente.
4. **Los elementos internos conservan sus superficies.** Cards, `StatCard`, secciones de formulario, `DataTable`, `PanelHeader` y demás mantienen sus propios tokens (`bg-card`, `bg-muted/N`, `bg-{intent}/N`). El tinte de modo `view` (`bg-muted/30` en el cuerpo del drawer) se conserva como affordance sutil.
5. **Documentar como contrato.** `component-drawer.md` (§Surface treatment) y `component-contracts.md` (§CollapsibleSheet) declaran el fondo del panel = fondo del main content (`bg-card`); `design-system.md` y `DESIGN.md` referencian el token.

## Consecuencias

- **Positivo:** un drawer o panel lateral abierto se percibe como una extensión del contenido principal (mismo fondo, mismo radio cero), reforzando la dirección de "paneles de borde contiguos" de ADR-0073; el `boundary="screen"` (p. ej. `SalesOrdersDrawer` en POS) y los paneles globales (Hub, Inbox, Profile) pasan a un panel sólido limpio en lugar de "frosted".
- **Neutral:** dentro de un panel, los cards con `bg-card`/`bg-card/50` sobre la superficie `bg-card` se distinguen por borde/sombra, igual que en el main content (la jerarquía de contenedor ya depende de `card-base`/`card-flat`, no del contraste de fondo).
- **Riesgo:** los elementos internos que usaban `bg-background` explícito (p. ej. `EntityHeader`, `DataTableToolbar`) quedan como banda sutilmente más gris sobre la superficie `bg-card`; si alguno se percibe fuera de tono, se migrará a `bg-card`/transparente en una pasada de pulido posterior.

## Alternativas consideradas

- **Mantener `bg-background` en embedded y solo igualar el shell.** Rechazado: el mismatch visual persiste; la diferencia `0.96` vs `1.0` es justo la que se percibía como "el panel es de otro color".
- **Hacer el panel transparente** (sin fondo propio) para que muestre el `bg-card` del contenedor. Rechazado: el `SheetContent` vive en un portal propio y necesita un fondo sólido para cubrir el contenido detrás (por eso se usa `bg-card` explícito).
- **Conservar el "frosted" en `boundary="screen"` y en `CollapsibleSheet`.** Rechazado: contradice la decisión de superficie unificada; un panel de borde opaco `bg-card` es la lectura coherente con ADR-0073 y con esta ADR.

## References

- Related: [ADR-0073](0073-drawers-zero-border-radius.md) (radio cero en drawers y CollapsibleSheets)
- Contract: [component-drawer.md](../../20-contracts/component-drawer.md) (§Surface treatment)
- Contract: [component-contracts.md](../../20-contracts/component-contracts.md) (§CollapsibleSheet)
- [design-system.md](../design-system.md) (Surface Treatment)
- [DESIGN.md](../../../DESIGN.md) (invariante 6)
- Implementation: `frontend/components/shared/Drawer.tsx`, `frontend/components/shared/CollapsibleSheet.tsx`
- Tokens: `--color-card` / `--color-background` en `frontend/app/globals.css`
