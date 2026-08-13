---
id: 0073
title: Drawers y CollapsibleSheets con radio cero (bordes sin redondear) en todo contexto
status: Accepted
date: 2026-08-13
author: core-team
---

# 0073 — Drawers y CollapsibleSheets con radio cero en todo contexto

## Context

Las superficies ancladas al borde — el componente compartido `Drawer` (todos los lados, boundary `screen`/`embedded`, modos `create`/`edit`/`view`, resizables o no, incluyendo la superficie `drawer` de `GenericWizard`, los drawers de entidad del registro `ENTITY_DRAWERS`, `CostCalculatorDrawer` y `AnalyticsPanel`) y `CollapsibleSheet` (paneles globales Hub, Inbox, Profile, OrderActionPanel) — deben leerse como **paneles de borde contiguos al contenedor/screen**, no como superficies flotantes independientes.

El commit `4947f0f18` ("UI: Remove all rounded corners from Drawers (embedded and screen boundaries)") ya aplicó `rounded-none!` en el código de `Drawer` y `CollapsibleSheet`. Sin embargo:

1. **Reglas residuales en `globals.css` seguían forzando radio.** Los selectores `#main-content [data-slot="sheet-content"][data-side="left"|"right"]` aplicaban `border-*-radius: var(--radius-xl) !important` con especificidad mayor que el `rounded-none!` de los componentes, y el header del sheet izquierdo forzaba `border-top-left-radius: var(--radius-xl) !important`. Resultado: los drawers/sheets embebidos **renderizaban esquinas redondeadas** pese al código cuadrado.
2. **Contratos desincronizados.** `component-drawer.md`, `component-contracts.md` (§CollapsibleSheet), `design-system.md`, `shape-consistency-lock.md`, `component-visual-hierarchy.md` y `docs/README.md` documentaban los drawers con `rounded-xl` vía `@utility panel-surface` — utility que ya no existe en `globals.css` (solo quedaba en comentarios).
3. **Sin ADR ni guard automático.** El cambio de `4947f0f18` no tuvo ADR (violación de gobernanza para un cambio de contrato capa 20) y no había protección ESLint contra reintroducción de `rounded-*` en estas superficies.

## Decisión

1. **Radio cero en todo contexto.** `Drawer` y `CollapsibleSheet` tienen **siempre** `border-radius: 0` (`rounded-none`), sin excepciones por lado, boundary, modo, resizable o anidamiento. El componente es la única fuente de verdad visual; `globals.css` no debe reintroducir reglas de radio para `[data-slot="sheet-content"]`.
2. **Eliminar las reglas de radio residuales de `globals.css`.** Se borran los overrides de esquinas para sheets embebidos (izquierdo/derecho) y los overrides de esquinas del header de sheets. Los headers conservan `background-color: inherit`; la regla de `dialog-header` (modales) se mantiene intacta.
3. **Documentar como contrato.** `component-drawer.md` y `component-contracts.md` (§CollapsibleSheet) declaran la superficie cuadrada; `design-system.md`, `shape-consistency-lock.md`, `component-visual-hierarchy.md` y `docs/README.md` dejan de listar drawers como `rounded-xl` y los mueven a la excepción `rounded-none`.
4. **Guard ESLint.** Nueva regla `drawer/no-rounded` prohíbe clases `rounded-*` en `className` de `<Drawer>` y `<CollapsibleSheet>` (incluye `cn(...)`, ternarios y templates), de modo que una regresión de radio bloquea el build.

## Consecuencias

- **Positivo:** los paneles de borde se leen como contiguos y cuadrados en todo el sistema; el radio deja de depender de selectores `!important` de alta especificidad; un guard automático previene regresiones; los contratos vuelven a reflejar la implementación.
- **Neutral:** el `<main>` shell y los modales conservan su jerarquía de radio (shell `rounded-xl`, overlay `rounded-lg`); los elementos internos de un drawer (cards, botones, inputs) mantienen sus radios de nivel atómico/contenedor.
- **Riesgo:** un consumidor que pase `rounded-*` vía `className` verá su PR bloqueado por lint (comportamiento deseado). No hay consumidores actuales que violen la regla.

## Alternativas consideradas

- **Mantener `rounded-xl` vía `panel-surface` en drawers.** Rechazado: contradice la dirección visual ya aplicada en `4947f0f18` y exige reconstruir la utility `panel-surface` que dejó de existir.
- **Conservar solo la esquina del borde visible** (p. ej. `rounded-t-xl` en drawer inferior). Rechazado: un panel de borde debe ser cuadrado en su totalidad; el "parallel framing" con el shell se logra por contigüidad, no por radio.
- **Solo documentar sin guard ESLint.** Rechazado: el repo ya usa invariantes ESLint custom (`no-raw-tailwind-colors`, `typography/token-first`, etc.); sin guard el radio puede reaparecer silenciosamente en un drawer de feature.

## References

- Contract: [component-drawer.md](../../20-contracts/component-drawer.md) (§Surface treatment)
- Contract: [component-contracts.md](../../20-contracts/component-contracts.md) (§CollapsibleSheet)
- [design-system.md](../design-system.md) (Radius Hierarchy)
- [shape-consistency-lock.md](../../20-contracts/shape-consistency-lock.md)
- [DESIGN.md](../../../DESIGN.md) (invariante 6)
- Implementation: `frontend/components/shared/Drawer.tsx`, `frontend/components/shared/CollapsibleSheet.tsx`, `frontend/app/globals.css`
- Guard: `frontend/eslint-rules/drawer-no-rounded.mjs`, `frontend/eslint.config.mjs`
- Commit original del cambio en código: `4947f0f18` ("UI: Remove all rounded corners from Drawers")
