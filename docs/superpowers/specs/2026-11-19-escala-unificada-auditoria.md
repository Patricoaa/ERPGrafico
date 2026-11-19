# Auditoría previa al modelo de escala unificada (Utopia)

Fecha: 2026-11-19 · Alcance: todo `frontend/` + contratos `docs/20-contracts`, `docs/90-governance`, `DESIGN.md` · Solo lectura, sin cambios de código.

Objetivo: decidir si conviene un modelo único (tipografía + espaciado + altura de controles + densidad + táctil) generado con Utopia, y qué contratos habría que cambiar antes.

## 1. Estado real (medido)

### Tipografía
| Token | Usos en `.tsx` | Naturaleza |
|---|---|---|
| `text-xs` | 735 | fluido (12→14) |
| `text-sm` | 539 | fluido (14→16) |
| `text-3xs` (10px) | 516 (220 con `uppercase`) | **fijo** |
| `text-2xs` (11px) | 173 | **fijo** |
| `text-lg` | 109 | fluido |
| `text-4xs` (9px) | 100 | **fijo** |
| `text-base` | 52 | fluido |
| `text-2xl / xl / 3xl` | 40 / 34 / 17 | fluido |

- Los tres micro tokens suman ~790 usos (más que xs). Concentración: `components/shared` 137, `finance` 93, `treasury` 81, `production` 56, `workflow` 48.
- Cada token fluido tiene su propia ventana de interpolación (ver tabla en el chat: sm termina en 1440px, 3xl en ~1760px). Por debajo de ~1000px todo queda en el mínimo.
- No hay `font-size` en `html`: no existe un eje de zoom global (todo `rem` es 16px fijo).

### Altura de controles
- `ui/button`: default `h-10`, `sm` `h-9`, `lg` `h-12`, icon 40/36/48. `ui/input`: `h-10`, `text-base` (md:`text-sm`). `ui/select`: `h-9` / `h-8`. `ui/tabs`: lista `h-10`, trigger `h-9`.
- Contrato de botones de acción: `h-9 text-3xs font-black`. Nav del shell: `h-8 text-xs`. Toolbars: `h-7`/`h-8`. Touch POS: `h-12`/`h-16`.
- Frecuencia de clases de altura (todo `.tsx`): `h-4` 437 (iconos), `h-5` 164, `h-8` 137, `h-10` 108, `h-6` 105, `h-9` 82, `h-7` 66, `h-12` 41, `h-16` 22.
- Hay 3 alturas "estándar" simultáneas (h-8/h-9/h-10) sin un token que las nombre.

### Espaciado
- `--spacing-r-xs…xl` (ritmo, `density-system.md` §1) **tiene 0 consumidores** (los hits de grep eran `rounded-r-*`). El contrato dice que es regla invariante y no se cumple en la práctica: el espaciado real es Tailwind (`p-4`, `gap-3`).
- `--space-fluid-*`: 0 consumidores. `--page-gap-*`: solo `globals.css`.
- Los tokens de tabla (`--table-cell-*`, `--table-header-*`) **sí** se usan y funcionan: es el único sistema de densidad vivo.
- 253 valores arbitrarios `[Npx]` / `[Nrem]` en clases (mayoría anchos de popovers/columnas: `w-[200px]` 21, `w-[150px]` 11, `w-[300px]` 10…). Fuera del alcance de la escala tipográfica, pero relevantes para "layout".

### Táctil y densidad
- Tres mecanismos independientes:
  1. `useTouchMode` (toggle manual en `sessionStorage`, **default `true`**) usado en POS, ProductGridPicker, checkout.
  2. `useDeviceContext` (detecta `pointer: coarse` + ancho 768/1024) con **dos copias divergentes** (`hooks/useDeviceContext.ts` y `features/pos/hooks/useDeviceContext.ts`).
  3. CSS: `[data-density="compact"]` + `@media (pointer: fine)` (guarda de Fitts) y una sola utilidad `pointer-coarse:` en `WizardStepsSidebar`.
- Los tamaños táctiles se aplican con ramas JS (`isTouchPOS ? "h-16 text-xl" : "h-11 text-base"`), repetidas en `Cart.tsx` ~10 veces.

## 2. Contradicciones y acoplamientos que bloquean un modelo único

| # | Dónde | Qué dice | Conflicto con un modelo unificado |
|---|---|---|---|
| C1 | `globals.css` "Interaction Guards" + GOVERNANCE #17 | El mínimo 40px se aplica con selectores `:not(.h-9):not(.h-8):not(.h-7)` sobre **nombres de clase literales** | Cualquier token de altura de control rompe el selector. Hay que reescribir la guarda sobre atributos/variables, no clases. Cambia una regla de gobernanza (ADR) |
| C2 | `lib/__tests__/typography.contract.test.ts` | Asserts literales: `text-3xs = 0.625rem`, `h-9 px-5 text-3xs font-black…`, `h-8 rounded-sm px-2 text-xs`, `text-2xs font-bold uppercase tracking-[0.25em]`, etc. | Hacer fluido el micro o tokenizar alturas obliga a reescribir estos tests (son deliberadamente frágiles). Documentar como cambio de contrato |
| C3 | `typography-scale.md` | "El rango micro es **fijo**, no fluido, y exclusivo para chrome denso" + equivalencias `text-[10px]→text-3xs` | Decisión de diseño explícita. Cambiarla requiere ADR (invariante 12) y supersede parcial de ADR-0082 |
| C4 | `typography-scale.md` y `component-button.md` | Botón de acción `h-9 text-3xs`; botón táctil `h-12 text-xs` (override por `className`) | Alturas y tamaños viven en `className` por contrato, no en tokens/variantes. Un modelo único debe pasar a variantes/tokens y reescribir los patrones de `component-button.md` |
| C5 | `component-input.md` (líneas ~350-390) | Ejemplos con `h-7 text-[10px]` y `h-7/h-8` toolbar | Contradice la propia regla `typography/token-first` (px crudos prohibidos). Doc desactualizada, corregir sea cual sea el modelo |
| C6 | `density-system.md` §1 | `--spacing-r-*` "regla invariante (PR Reject)" | Nadie la consume. O se adopta (y se reemplaza por la escala Utopia) o se retira del contrato; hoy es una regla incumplida |
| C7 | `density-system.md` §3 + DESIGN.md #3 | `compact` default, `comfortable` opt-out **solo para tablas** | El modelo único debe generalizar la densidad a controles/espaciado, no solo `--table-*` |
| C8 | `component-modal.md` (`touchMode`), ADR-0127 (`ChoiceCard size="touch"`, barra 64px) | El táctil es una prop/variante por componente | Conviene que sea un eje global (token/atributo), no prop por componente |
| C9 | `module-layout-navigation.md` / ADR-0079 | Tamaños del chrome del shell fijados por rol (`text-xs`, `h-8`, `text-3xs`) | Entra en el modelo como rol; sus tests (C2) lo amarran |
| C10 | `component-chip.md` / StatusBadge | `xs h-[18px]`, `sm h-[22px]` en px literales con `text-xs` fluido | Alturas fijas con texto fluido: es el desajuste que impide ampliar la rampa |

## 3. Qué se concluye

1. **El mayor palanca no es la rampa tipográfica**, sino que ~790 usos de texto micro y 3 alturas de control conviven fuera de la curva. Mientras eso siga fijo, la rampa fluida tiene que ser mínima (±2px).
2. **El espaciado Utopia solo vale si se adopta de verdad.** Hoy hay dos escalas (rhythm, fluid) sin uso y la práctica es Tailwind. Antes de generar una tercera hay que decidir cuál sobrevive.
3. **Táctil/densidad son ejes propios**, hoy implementados en JS con tres mecanismos solapados. Pasarlos a CSS (atributo en un ancestro + `pointer: coarse`) elimina ~las ramas `isTouchPOS` y permite que la escala los use.
4. **Hay deuda de contrato independiente del modelo** (C5, C6, hooks duplicados) que conviene resolver igual.

## 4. Riesgos del cambio
- Tests de contrato de tipografía (C2) y guarda de Fitts (C1) fallarán por diseño y deben reescribirse en el mismo PR.
- Cambiar micro a fluido altera ~790 usos: requiere revisión visual en tablas densas (finance/treasury) y POS.
- La guarda 40px (GOVERNANCE #17) es una regla de accesibilidad/ergonomía; el nuevo modelo debe preservar su intención (target mínimo), no solo su selector.

## 5. Decisiones que el modelo debe responder (input para diseño)
1. ¿Micro fijo (excepción documentada) o micro dentro de la curva con piso de legibilidad?
2. ¿Tokens de altura de control (`--control-h-sm/md/lg`) y quién los consume: variantes de `Button`/`Input` o clases utilitarias?
3. ¿Una sola escala de espaciado (cuál) y cómo se expresa en Tailwind v4 (`--spacing-*` en `@theme`)?
4. ¿Eje densidad (`compact|comfortable`) y eje puntero (`fine|coarse`) como atributos CSS globales?
5. ¿Ventana de viewport única y parámetros Utopia (min/max, razón)?

## 6. Siguiente paso propuesto
Definir el modelo (secciones 5.1-5.5) con una skill de diseño, validarlo contigo, y redactar el ADR que supersede las partes de C1-C10. La migración de código viene después y se divide por capas: tokens → controles → tablas → POS/táctil → limpieza de contratos/tests.
