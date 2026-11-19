---
id: 0142
title: Escala unificada — tipografía fluida (Utopia), espaciado y controles dirigidos por un solo dial (densidad × puntero)
status: Accepted
date: 2026-11-19
author: frontend-team
---

# 0142 — Escala unificada fluida, densidad y puntero

**Relacionado:** ADR-0082 (supersede parcialmente: micro fijo), ADR-0087 (R3, guarda de Fitts), ADR-0079 (chrome del shell), ADR-0127 (POS táctil), ADR-0070 (compact por defecto). **Contratos afectados:** `typography-scale.md`, `density-system.md`, `component-button.md`, `component-input.md`, `component-modal.md`, `component-chip.md`, GOVERNANCE #17 y `DESIGN.md`. **Auditoría:** `docs/superpowers/specs/2026-11-19-escala-unificada-auditoria.md`. **Plan:** `docs/superpowers/plans/2026-11-19-escala-unificada.md`.

---

## Contexto

La auditoría de 2026-11-19 encontró que tipografía, espaciado, altura de controles, densidad y modo táctil son sistemas separados que no se hablan:

1. **Texto micro fuera de la curva.** `text-3xs/2xs/4xs` suman ~790 usos (más que `text-xs`), son fijos y dominan el chrome denso. Como el resto del texto crece y el micro no, la rampa fluida debe ser mínima.
2. **Alturas de control sin nombre.** Conviven `h-7`, `h-8`, `h-9`, `h-10`, `h-12`, `h-16` como literales; la guarda de Fitts (GOVERNANCE #17) se implementa con `:not(.h-9):not(.h-8):not(.h-7)`, acoplada a nombres de clase.
3. **Dos escalas de espaciado sin uso.** `--spacing-r-*` (contrato "PR Reject") y `--space-fluid-*` tienen 0 consumidores; el espaciado real es Tailwind. Solo `--table-*` funciona como sistema de densidad.
4. **Táctil resuelto en JS, tres veces.** `useTouchMode` (toggle en `sessionStorage`, default `true`), dos copias divergentes de `useDeviceContext` y ramas `isTouchPOS ? "h-16 text-xl" : "h-11 text-base"` repetidas.
5. **Rampas fluidas desalineadas.** Cada `--text-*` tiene su propia ventana (de ~1000 a ~1760 px).

## Decisión

Un solo modelo con tres capas: **primitivos fluidos → roles semánticos → modificadores de contexto**, controlado por dos ejes (densidad y puntero) expresados como atributos CSS.

### D1. Micro dentro de la curva, con piso de legibilidad
Los tokens micro conservan sus nombres (cero cambios de clase en ~790 usos) y pasan a ser fluidos en rango corto: `3xs` 10→11 px, `2xs` 11→12 px. `4xs` (9 px) queda **fijo** y restringido a glifos y contadores. En 1024 px los valores coinciden con los actuales.

### D2. Tipografía generada con Utopia, ventana única 1024→1440 px
Se usa Utopia como generador con **pares min/max explícitos** (la escala 12/14/16/18/20/24/30 está afinada a mano, no es geométrica):

```css
--text-3xs: clamp(0.625rem, 0.4712rem + 0.2404vw, 0.6875rem);
--text-2xs: clamp(0.6875rem, 0.5337rem + 0.2404vw, 0.75rem);
--text-xs:  clamp(0.75rem, 0.4423rem + 0.4808vw, 0.875rem);
--text-sm:  clamp(0.875rem, 0.5673rem + 0.4808vw, 1rem);
--text-base: clamp(1rem, 0.6923rem + 0.4808vw, 1.125rem);
--text-lg:  clamp(1.125rem, 0.8173rem + 0.4808vw, 1.25rem);
--text-xl:  clamp(1.25rem, 0.6346rem + 0.9615vw, 1.5rem);
--text-2xl: clamp(1.5rem, 0.8846rem + 0.9615vw, 1.75rem);   /* antes 24→30 */
--text-3xl: clamp(1.875rem, 1.2596rem + 0.9615vw, 2.125rem); /* antes 30→36 */
```

Por debajo de 1024 px quedan en el mínimo (igual que hoy en tablet/móvil); por encima de 1440 px, en el máximo. `2xl` y `3xl` pierden 2 px en pantallas grandes (40 y 17 usos). Los valores se regeneran con la calculadora si cambia la ventana.

### D3. Un dial: `--k`, con espaciado en pasos discretos
`--spacing` (base de Tailwind v4, hoy 0.25rem sin sobreescribir) pasa a `calc(0.25rem * var(--k))`. `--k` es **discreto**, nunca continuo (evita alturas fraccionarias y bordes borrosos):

| Contexto | `--k` |
|---|---|
| `compact` + puntero fino (default) | `1` |
| `comfortable` o puntero grueso | `1.125` |

Consecuencia: todo `p-*`, `gap-*`, `h-*`, `w-*`, `size-*` y los iconos `size-4` responden a la densidad sin editar clases. Con `--k: 1` el estado por defecto es **idéntico** al actual. Se retiran `--spacing-r-*` y `--space-fluid-*` (0 consumidores). Los `--table-*` se derivan de `--spacing` y dejan de ser un sistema aparte. `--page-gap-*` se mantiene (continuos, solo márgenes de página).

### D4. Tokens de altura de control por rol, con piso por contexto

| Token | Valor base | Uso |
|---|---|---|
| `--control-h-xs` | 28 px (`7 × spacing`) | toolbar muy denso |
| `--control-h-sm` | 32 px | nav del shell, toolbar estándar |
| `--control-h-md` | 36 px | acción ERP por defecto (botones de acción, select) |
| `--control-h-lg` | 40 px | formularios cómodos, `Input`/`Button` por defecto de `ui/` |
| `--control-h-touch` | 48 px | objetivos táctiles |

Altura efectiva = `max(rol, --hit-min)`, con `--hit-min`: `0` en compact + puntero fino, `2.5rem` (40 px) en el resto, `3rem` (48 px) con puntero grueso. Se consume con utilidades `@utility h-control-{xs,sm,md,lg,touch}` desde las variantes de `Button`, `Input`, `Select`, `Tabs`, `Chip`/`Badge`. **La guarda de Fitts conserva su intención** (objetivo mínimo 40 px salvo compact + fino, ADR-0087 R3) pero se reimplementa sobre `[data-slot]` y `--hit-min`, sin selectores de clases literales. Las clases `h-7…h-10` en controles interactivos pasan a aviso de lint (luego error, Fase 6).

### D5. Dos ejes como atributos CSS, no JS
- **Densidad:** `data-density="compact|comfortable"` en cualquier ancestro (hoy solo tablas). Default `compact` (ADR-0070 intacto). Preferencia de usuario persistida; el POS declara `comfortable` en su superficie.
- **Puntero:** `@media (pointer: coarse)` automático más `data-input="touch|auto"` como override manual.
- Se eliminan las ramas `isTouchPOS ? … : …` de tamaño, el default `true` de `useTouchMode` y la duplicación de `useDeviceContext` (queda una sola copia, solo para comportamiento: scanner, atajos, etc.). `ChoiceCard size="touch"` (ADR-0127) pasa a derivarse del eje de puntero.

### D6. Gobernanza
- Los ADR/contratos de la sección "Contratos afectados" se actualizan en las fases indicadas del plan, no al final.
- `typography.contract.test.ts` se reescribe para asertar tokens y atributos (no cadenas de clases): ventana Utopia, `--k`, `--control-h-*`, ausencia de `.h-N` en la guarda.
- Regla de lint nueva `controls/token-height` (aviso → error) para alturas literales en elementos interactivos.

## Alternativas descartadas
- **A — solo tipografía fluida:** rampa de ±2 px por los micro y controles fijos; poco retorno.
- **B — sin `--spacing` dinámico:** deja el espaciado fuera del modelo y obliga a editar clases para densidad.
- **D — todo continuo:** `--spacing` continuo produce alturas fraccionarias, bordes borrosos y filas de tabla desalineadas.

## Consecuencias
- **Más fácil:** una tabla de parámetros (ventana, pares min/max, `--k`, alturas) en vez de coeficientes `vw` por token; densidad y táctil como CSS; ~10 ramas JS menos en `Cart.tsx`; la guarda de Fitts deja de depender de clases.
- **Más difícil:** `--spacing` dinámico afecta cualquier `w-NN`/`h-NN`; requiere revisión visual en drawers, paneles y POS al activar comfortable. Reescribir tests de contrato es costoso y deliberado.
- **Riesgo controlado:** compact (`--k: 1`) es idéntico al estado actual; el cambio visible aparece solo con `comfortable`/táctil y en los micro/`2xl`/`3xl` de pantallas ≥1024 px.
- **Neutral:** sin cambios de backend ni de API.

## Enmienda — Fase 3 (2026-11-19)

La implementación de D4 ajustó tres puntos respecto del texto original, para que el estado por defecto siga siendo idéntico al actual:

1. **Piso por rol, no `max(rol, --hit-min)`.** Hoy los controles con altura explícita (`h-9`, `h-8`, `h-7`) están exentos del mínimo de 40 px; aplicar `--hit-min` a todos los roles habría subido los botones de acción de 36 a 40 px. Se separaron dos pisos: `--hit-min` (controles *sin* rol: 40 px; `0` en compact + puntero fino; 48 px táctil) y `--hit-role-min` (controles *con* rol: `0` por defecto; 48 px táctil). Resultado: sin cambios en escritorio; en táctil todo rol llega a 48 px.
2. **Exención por cascada, con residuo transitorio.** Los roles quedan exentos porque la utilidad `h-control-*` fija su propio `min-height` en una capa superior a la guarda. Los literales `.h-7/.h-8/.h-9` siguen excluidos por nombre de clase hasta el inventario a 0 (Fase 6); sólo entonces desaparecen las cadenas `:not()`.
3. **Alcance.** `ui/select` y `Chip`/`Badge`/`StatusBadge` pasan a la Fase 5: el `SelectTrigger` es un `<button>` que hoy recibe el piso de 40 px por la guarda (y `LabeledSelect` lo sobreescribe con `h-9`), de modo que migrarlo cambiaría alturas efectivas; los badges no son controles interactivos y sus alturas (18/22 px) no son roles. `cn()` extiende `tailwind-merge` para que los roles reemplacen/sean reemplazados por literales `h-N`/`size-N`.

## Enmienda — Fase 4 (2026-11-19)

1. **El POS publica el eje de puntero, no declara `comfortable`.** `POSShell` llama a `useApplyInputMode()`, que escribe `data-input` en `<html>` (no en un `DensityScope`: los diálogos y sheets de Radix se montan en un portal fuera del árbol). Declarar además `data-density="comfortable"` no añade nada en táctil (`--k` ya es 1.125) y agrandaría el POS de escritorio con mouse, que hoy es compacto; se descarta.
2. **Cambio de comportamiento deliberado:** `useTouchMode` deja de arrancar en `true`. El modo por defecto es `auto` (sigue `pointer: coarse`), así que un POS de escritorio con mouse ya no se ve en modo táctil salvo que el operador lo active con el conmutador. La clave de `sessionStorage` pasó de `pos_touch_mode` a `pos_input_mode` (`auto|touch|mouse`).
3. **Variante `touch:`** (`@custom-variant` en `globals.css`) reemplaza las ramas JS de tamaño. `Cart.tsx` queda sin `isTouchPOS`/`isTouchMode` y `CartItem.tsx` solo conserva `isTouchMode` para comportamiento (teclado numérico, pulsación larga, `input` vs `span`).
4. **Doble escala:** bajo táctil `--k = 1.125` ya agranda todo; los valores `touch:` del POS se calcularon como tamaño deseado ÷ 1,125 para conservar los tamaños efectivos actuales.
5. **(Reemplazado por la enmienda siguiente.)** Pendiente original: `GenericWizard` (prop `touchMode`), `ProductGridPicker` (`ProductCard`, `CategoryFilter`, `SearchBar`, `ProductGrid`), los pasos del checkout, `ContactCardGrid`, `DteRegistrationPanel`/`DteFolioFields`, `ApprovalRequestBanner`, `CashDifferenceJustification`, `flowParts`/`CashModeChoice` (`ChoiceCard size="touch"`) y `OperatorPickerModal` siguen usando `useDeviceContext`/`touchMode`. Funcionan igual que antes; su migración a `touch:` es mecánica.

## Enmienda — Fase 4b: migración del resto de consumidores y activación por dispositivo (2026-11-19)

1. **El eje de puntero sigue al dispositivo sin atributo.** Para que los componentes compartidos fuera del POS (`ProductGridPicker`, `ContactCardGrid`, banners) conserven su comportamiento táctil —antes decidido con `isTouchPOS` = `pointer: coarse` y ancho ≥ 1024— sin depender de que una superficie publique `data-input`, la variante `touch:` y el dial (`--k = 1.125`, pisos de 48 px) se activan con `@media (pointer: coarse) and (min-width: 64rem)` salvo `data-input="mouse"`. Esto adelanta la «activación global» prevista para la Fase 5 **limitada a tablets**: los teléfonos conservan la escala compacta. Es un cambio visible en toda la app en dispositivos táctiles ≥ 1024 px (espaciado ×1.125, controles con rol ≥ 48 px) que no se verificó en navegador; se revierte quitando la regla `@media … :root:not([data-input="mouse"])` de `globals.css`.
2. **Migrado a `touch:`:** `ProductCard` (se elimina la prop `isTouch`; la historia `TouchTablet` fuerza `data-input="touch"` con un decorador), `CategoryFilter`, `ContactCardGrid` (escala al pulsar) y `ApprovalRequestBanner`.
3. **Se queda en JS por ser comportamiento o layout, no tamaño:** teclado numérico y `readOnly` (`DteFolioFields`, `Step3_Delivery`, `Session*View`, `CartItem`), selección de grid/columnas (`ProductGrid`, `ContactCardGrid`), flechas de scroll y `snap` (`CategoryFilter`), `showContactGrid` (`Step1_Customer`) y `autoFocus`/tamaño de fuente anti-zoom (`SearchBar`, cuyo alto usa `isTouch` en cualquier ancho, incluidos teléfonos). `ChoiceCard size="touch"` y `OperatorPickerModal` usan un tamaño fijo, no una rama.
4. **Hallazgo: `GenericWizard.touchMode` es código dormido.** Ningún llamador le pasa `touchMode={true}` (POS lo pasa solo a `SalesCheckoutWizardView` y a los pasos, que lo usan para comportamiento). No se migró para no activar de golpe un footer de 56 px y un título agrandado en todos los wizards en tablets; decisión pendiente: eliminar las ramas muertas o activarlas con `touch:`.
