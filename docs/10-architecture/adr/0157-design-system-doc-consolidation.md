---
id: 0157
title: Consolidación del design system — un solo punto de entrada, contratos alineados al código y ratchets cerrados
status: Accepted
date: 2026-11-24
author: frontend-team
---

# 0157 — Consolidación del design system

**Relacionado:** ADR-0070 (primary K100), ADR-0075 (movimiento), ADR-0079 (shell ERPNext v16), ADR-0097 (familia de cards), ADR-0137 (`Section`), ADR-0142 (escala fluida y dial de densidad), ADR-0149 (Metric y tokens `*-text`).

## Contexto

Una auditoría DOC→APP (2026-11-24) encontró que el design system tenía **dos puertas de entrada** (`DESIGN.md` y `docs/10-architecture/design-system.md`) y que la segunda, sin revisar desde mayo, describía un sistema que ya no existe: alturas `h-10` por defecto (hoy son roles `h-control-*`, ADR-0142), `panel-surface` y `dot-grid-surface` (retirados en agosto con el shell ERPNext, ADR-0079), `card-focus-spin-cmyk` (nunca llegó a `globals.css`), una cinta CMYK de 2 px y tres colores (hoy 4 px y cuatro bandas), y `FadedSeparator`/`LabeledSeparator` (no existen).

Varios contratos de la capa 20 también habían quedado atrás de decisiones posteriores:

- `DESIGN.md` decía que cyan era el color de énfasis del sidebar y del ring; ambos derivan de primary (K100) desde ADR-0070.
- `typography-scale.md` describía `accent` como "golden amber" (es una superficie neutra), recomendaba `text-success`/`text-warning` como texto (ADR-0149 los prohíbe por contraste), daba valores de tracking que no son los de Tailwind 4, headings con `uppercase` que la base no aplica y alturas de badge en px (`h-[18px]`) en lugar de la escala.
- `color-system.md` documentaba el tinte de badges como `text-{intent}` (el código usa `text-{intent}-text`).
- `component-drawer.md` describía un drawer redondeado con `panel-surface`; el código es plano.
- `density-system.md` tenía las secciones desordenadas y una exclusión "transitoria" ya cerrada.

En el código, siete tests de contrato estaban en rojo en `master`:

1. Dos cambios tipográficos deliberados (commit `0dbbd7cc3`): el legend N2 (`FieldLegend`) pasó a `text-3xs` y el encabezado de `<Section>` a `font-semibold`, sin actualizar contrato ni test.
2. Cinco superficies de card hechas a mano (POS, `SummaryPanel`, `ChartSection`, `DualAxisChart`, `CostCalculatorDrawer`).
3. Una animación inline nueva (`POSIdleScreen`) y una entrada caducada en la allowlist.
4. Una aserción de densidad que buscaba en `Cart.tsx` clases eliminadas por el rediseño del panel de resumen (#277).
5. Una entrada caducada en el baseline `no-unsafe`.

## Decisión

1. **`DESIGN.md` es la única puerta de entrada.** Se retira `docs/10-architecture/design-system.md`. Lo que seguía vigente (escala de radio remapeada, jerarquía de esquinas, utilidades de superficie, sombras, acentos, primitivas shadcn) pasa a un contrato nuevo de la capa 20, **[geometry-surfaces.md](../../20-contracts/geometry-surfaces.md)**. El lenguaje de selección de cards se completa en `component-card-family.md`.
2. **Los contratos describen el código vigente.** Se alinean `DESIGN.md`, `typography-scale.md`, `color-system.md`, `density-system.md`, `component-chip.md`, `component-drawer.md`, `component-card-family.md` y `component-animation.md`.
3. **Tipografía: gana el código.** N2 (`FieldLegend` y `fieldLegendClasses`) = `text-3xs font-bold uppercase tracking-widest`. El encabezado de `<Section>` (`Section/SectionHeader`) = `text-2xs font-semibold uppercase tracking-[0.25em]`; `SectionHeader` conserva `font-bold`.
4. **Paneles con superficie de la familia.** Los paneles del POS, `SummaryPanel`, `ChartSection` y `CostCalculatorDrawer` usan `surface-panel` (12 px). El tooltip de `DualAxisChart` usa la superficie de popover (`bg-popover`, `shadow-floating`).
5. **Movimiento: receta `fadeInClass()`.** `FadeIn` sigue siendo el único primitivo; se le añade su receta de clases en `components/shared/fade-in-class.ts` (sin `"use client"`, apta para Server Components) para elementos que no admiten wrapper. Las 104 animaciones inline restantes (73 archivos) migran a ella. El ratchet `animate-in` pasa a **cero sin allowlist**.
6. **Placa K legible en oscuro.** El intent categórico `black` de `Badge` y el acento K de `TabBar` se pintan con `foreground`, igual que la banda K de `ribbon-cmyk`. Process Black fijo era invisible sobre superficies oscuras.
7. **Los cuatro `EXEMPT_CONSUMERS` de `DataTable` no se migran.** La matriz de migración (§6.9) los declara exentos por bloqueos arquitectónicos (locks por WebSocket, controles por celda, columnas dinámicas), y la regla M2 impide añadir esas capacidades a entity-view sin demanda suficiente. No son deuda.

## Consecuencias

- Una sola fuente de verdad para agentes y personas; las rutas de `CLAUDE.md` y `docs/README.md` apuntan a `geometry-surfaces.md` para radios y superficies.
- `lib/__tests__/` queda en verde (38 archivos, 304 tests).
- **Cambio visual a revisar:** los paneles del POS, `SummaryPanel` y la calculadora de costos pasan de 8 px a 12 px de radio. `ChartSection` pierde su `shadow-xs`. Las entradas con `zoom-in` (escala desde 0) se normalizan a `zoom-in-95`, y las que usaban `fade-in-50` pasan a desvanecer desde 0.
- Queda pendiente, fuera de este ADR: el intent categórico `yellow` (texto `text-yellow` sobre fondo claro) tampoco alcanza contraste de texto; y `MoneyDisplay` usa `text-income` (alias de `success`, ~3:1), que el guard de contraste no detecta porque no es `text-success` literal.
