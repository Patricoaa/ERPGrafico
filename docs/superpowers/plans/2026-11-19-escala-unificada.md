# Plan — Escala unificada (ADR-0142)

Cada fase es un PR independiente, termina con `npm run type-check`, `npm run lint` y los tests del alcance en verde. **Compact (`--k: 1`) debe ser visualmente idéntico al estado actual hasta la Fase 5.** Estimación total: ~1 semana.

## Fase 0 — Preparación (0.5 d)
- [ ] Capturas de referencia (Storybook/Playwright) a 1024, 1280, 1440 y 1920 px de: POS (venta y cierre), una `Collection` densa (finance/treasury), `ProductDrawer`, `ContactDrawer`, wizard de checkout, shell.
- [ ] Unificar `useDeviceContext` (`hooks/` vs `features/pos/hooks/`): una sola copia; verificar consumidores.
- [ ] Corregir `component-input.md` (ejemplos `text-[10px]`) y marcar `--spacing-r-*` como deprecado en `density-system.md`.
- **Criterio de salida:** capturas guardadas; un solo `useDeviceContext`; tests verdes.

## Fase 1 — Tokens y tipografía (0.5 d)
- [x] `globals.css`: reemplazar `--text-3xs/2xs/xs…3xl` por los `clamp` del ADR (D2); `--text-4xs` fijo.
- [x] Eliminar `--space-fluid-*` y `--spacing-r-*` (0 consumidores; confirmar con grep antes).
- [x] Reescribir `typography.contract.test.ts` (tokens del ADR, sin asertar `3xs = 0.625rem`).
- [x] Actualizar `typography-scale.md` (micro fluido, ventana 1024→1440) y `DESIGN.md`.
- **Salida:** a 1024 px las capturas coinciden con la referencia; a ≥1280 solo difieren micro/`2xl`/`3xl`.
- Nota: el único consumidor real de `--spacing-r-lg` era un `margin` de `hr` en `globals.css` (la auditoría solo había mirado TSX); pasó a `calc(var(--spacing) * 6)`. Las capturas de verificación visual se omitieron por decisión del usuario.

## Fase 2 — Dial `--k` y ejes (1 d)
- [x] `--spacing: calc(0.25rem * var(--k, 1))` en `@theme inline`, `--k = max(--k-density, --k-input)`; `[data-density="comfortable"]` y `[data-input="touch"]` → `1.125`; `pointer: coarse` solo bajo `data-input="auto"` (activación global en Fases 4/5, para no alterar teléfonos/tablets antes de revisar layouts).
- [x] Derivar `--table-*` de `--u` (re-declarados por ámbito); `.table-compact/.table-comfortable` se mantienen.
- [x] `DensityScope` (ámbito por superficie, `display: contents`). La preferencia de usuario persistida en `<html>` pasa a la Fase 5.
- [x] Actualizar `density-system.md` (§1 reescrita sobre `--spacing`, §3 densidad global).
- **Salida:** con `--k: 1` capturas idénticas; en `comfortable` revisar drawers/paneles (`w-NN`) y anotar ajustes.

## Fase 3 — Tokens de altura y guarda de Fitts (1.5 d)
- [x] `--control-h-*`, `--hit-min`/`--hit-role-min` en `globals.css`; `@utility h-control-*` y `size-control-*`; `cn()` extiende tailwind-merge.
- [x] Guarda de Fitts sobre `--hit-min`; los roles quedan exentos por cascada (sin nombres de clase). Residuo transitorio: `.h-7/.h-8/.h-9` hasta la Fase 6. GOVERNANCE #17 actualizado.
- [x] Migrados `ui/button`, `ui/input`, `ui/tabs` y los wrappers (`SubmitButton`, `CancelButton`, `ToolbarCreateButton` vía `size="sm"`, `IconButton`). **Movidos a la Fase 5:** `ui/select` y `Chip`/`Badge`/`StatusBadge` (ver enmienda del ADR).
- [x] Actualizados `component-button.md`, `component-input.md`, `typography-scale.md`, `density-system.md` (§5), `typography.contract.test.ts` y nuevo `density-controls.contract.test.ts`. (`component-chip.md` sin cambios: los chips no migran en esta fase.)
- **Salida:** capturas idénticas en compact; test de contrato nuevo verde; grep de `.h-9` en la guarda = 0.

## Fase 4 — POS y modo táctil (1.5 d)
- [x] `@custom-variant touch`; `Cart.tsx` y `CartItem.tsx` pasan a la variante (sin ramas `isTouchPOS`); `POSShell` publica `data-input` en `<html>`. **No** se declara `comfortable` en el POS (ver enmienda del ADR).
- [x] Resto de consumidores migrado (ver enmienda 4b del ADR): `ProductCard`, `CategoryFilter`, `ContactCardGrid`, `ApprovalRequestBanner`. Lo demás es comportamiento/layout y se queda en JS. `GenericWizard.touchMode` eliminado en la Fase 5.
- [x] `useTouchMode` redefinido (`auto|touch|mouse`, solo comportamiento) + `useApplyInputMode`; sin default `true`.
- [x] `density-system.md` §6 y `component-modal.md` actualizados. [ ] Nota de enmienda en ADR-0127 y patrón táctil en `component-button.md` (con la migración del resto de consumidores).
- **Salida:** POS en tablet (coarse) y escritorio (fine) sin ramas JS de tamaño; pruebas de POS verdes.

## Fase 5 — Activación y limpieza (1 d)
- [x] `ui/select` (vía `--control-h-*`) y `Badge` xs/sm migrados; `LabeledSelect` queda con su `h-9` explícito. `Chip`/`StatusBadge` heredan de `Badge`.
- [ ] Revisión visual de `comfortable` en settings/reportes y ajuste de `w-NN` afectados (pendiente: sin capturas).
- [x] Activación del eje táctil por dispositivo (tablets), adelantada a la Fase 4b.
- [x] `comfortable` ofrecido en Perfil → Preferencias (`useDensityPreference`, por dispositivo).
- [x] Lint `controls/token-height` en aviso; inventario inicial 232 avisos / 116 archivos.
- [ ] Actualizar índice del ADR (README), `DESIGN.md` y `docs/README.md`.

## Fase 6 — Endurecimiento (posterior, opcional)
- [x] Lint `controls/token-height` como error (inventario 0).
- [x] Retiradas las exclusiones `:not(.h-N)` de la guarda de Fitts.
- [x] `.table-compact` retirado; `.table-comfortable` se mantiene (lo usa `DataTable`).

## Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| `--spacing` dinámico altera `w-NN`/`h-NN` | `--k: 1` por defecto; solo `comfortable`/táctil cambian; revisión por superficie en Fase 5 |
| Tests de contrato literales fallan | Reescritura planificada en Fases 1 y 3, mismo PR |
| Micro fluido cambia densidad en finance/treasury | Rango corto (+1 px); comparar capturas a 1440/1920 |
| Regresión de ergonomía (40 px) | `--hit-min` conserva la regla; test de contrato sobre el token |

## Orden de merge y rollback
Fases 0→5 en orden. Cada PR es revertible por separado; Fase 2 y 3 comparten el invariante `--k: 1 ≡ estado actual`, que sirve de criterio de rollback.
