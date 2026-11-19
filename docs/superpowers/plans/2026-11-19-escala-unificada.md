# Plan — Escala unificada (ADR-0142)

Cada fase es un PR independiente, termina con `npm run type-check`, `npm run lint` y los tests del alcance en verde. **Compact (`--k: 1`) debe ser visualmente idéntico al estado actual hasta la Fase 5.** Estimación total: ~1 semana.

## Fase 0 — Preparación (0.5 d)
- [ ] Capturas de referencia (Storybook/Playwright) a 1024, 1280, 1440 y 1920 px de: POS (venta y cierre), una `Collection` densa (finance/treasury), `ProductDrawer`, `ContactDrawer`, wizard de checkout, shell.
- [ ] Unificar `useDeviceContext` (`hooks/` vs `features/pos/hooks/`): una sola copia; verificar consumidores.
- [ ] Corregir `component-input.md` (ejemplos `text-[10px]`) y marcar `--spacing-r-*` como deprecado en `density-system.md`.
- **Criterio de salida:** capturas guardadas; un solo `useDeviceContext`; tests verdes.

## Fase 1 — Tokens y tipografía (0.5 d)
- [ ] `globals.css`: reemplazar `--text-3xs/2xs/xs…3xl` por los `clamp` del ADR (D2); `--text-4xs` fijo.
- [ ] Eliminar `--space-fluid-*` y `--spacing-r-*` (0 consumidores; confirmar con grep antes).
- [ ] Reescribir `typography.contract.test.ts` (tokens del ADR, sin asertar `3xs = 0.625rem`).
- [ ] Actualizar `typography-scale.md` (micro fluido, ventana 1024→1440) y `DESIGN.md`.
- **Salida:** a 1024 px las capturas coinciden con la referencia; a ≥1280 solo difieren micro/`2xl`/`3xl`.

## Fase 2 — Dial `--k` y ejes (1 d)
- [ ] `--spacing: calc(0.25rem * var(--k))`, `--k: 1` por defecto; `[data-density="comfortable"]` y `@media (pointer: coarse)`/`[data-input="touch"]` → `1.125`.
- [ ] Derivar `--table-*` de `--spacing`; mantener `.table-compact/.table-comfortable` como alias.
- [ ] Proveedor mínimo que fija `data-density`/`data-input` en `<html>` (preferencia persistida) y ámbito por superficie.
- [ ] Actualizar `density-system.md` (§1 reescrita sobre `--spacing`, §3 densidad global).
- **Salida:** con `--k: 1` capturas idénticas; en `comfortable` revisar drawers/paneles (`w-NN`) y anotar ajustes.

## Fase 3 — Tokens de altura y guarda de Fitts (1.5 d)
- [ ] `--control-h-*` y `--hit-min` en `globals.css`; `@utility h-control-*`.
- [ ] Reescribir la guarda de Fitts sobre `[data-slot]` + `--hit-min` (sin `:not(.h-N)`); documentar en GOVERNANCE #17 que la intención se mantiene.
- [ ] Migrar `ui/button`, `ui/input`, `ui/select`, `ui/tabs`, `Chip`/`Badge`/`StatusBadge` y los wrappers (`SubmitButton`, `CancelButton`, `ToolbarCreateButton`, `IconButton`) a las utilidades.
- [ ] Actualizar `component-button.md`, `component-input.md`, `component-chip.md`, `typography.contract.test.ts` (alturas por token).
- **Salida:** capturas idénticas en compact; test de contrato nuevo verde; grep de `.h-9` en la guarda = 0.

## Fase 4 — POS y modo táctil (1.5 d)
- [ ] POS declara `data-density="comfortable"`; `ChoiceCard size="touch"`, `touchMode` de modales y `Cart.tsx` pasan a tokens/atributos (eliminar las ~10 ramas `isTouchPOS`).
- [ ] Retirar o redefinir `useTouchMode` (override manual → `data-input`); eliminar el default `true`.
- [ ] Actualizar `component-modal.md`, ADR-0127 (nota de enmienda) y `component-button.md` (patrón táctil).
- **Salida:** POS en tablet (coarse) y escritorio (fine) sin ramas JS de tamaño; pruebas de POS verdes.

## Fase 5 — Activación y limpieza (1 d)
- [ ] Revisión visual de `comfortable` en settings/reportes y ajuste de `w-NN` afectados.
- [ ] Decidir dónde se ofrece `comfortable` al usuario (preferencia de perfil).
- [ ] Lint `controls/token-height` en modo aviso; inventario de `h-7…h-10` restantes en controles.
- [ ] Actualizar índice del ADR (README), `DESIGN.md` y `docs/README.md`.

## Fase 6 — Endurecimiento (posterior, opcional)
- [ ] Lint `controls/token-height` como error cuando el inventario llegue a 0.
- [ ] Retirar alias `.table-compact/.table-comfortable` si no quedan usos.

## Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| `--spacing` dinámico altera `w-NN`/`h-NN` | `--k: 1` por defecto; solo `comfortable`/táctil cambian; revisión por superficie en Fase 5 |
| Tests de contrato literales fallan | Reescritura planificada en Fases 1 y 3, mismo PR |
| Micro fluido cambia densidad en finance/treasury | Rango corto (+1 px); comparar capturas a 1440/1920 |
| Regresión de ergonomía (40 px) | `--hit-min` conserva la regla; test de contrato sobre el token |

## Orden de merge y rollback
Fases 0→5 en orden. Cada PR es revertible por separado; Fase 2 y 3 comparten el invariante `--k: 1 ≡ estado actual`, que sirve de criterio de rollback.
