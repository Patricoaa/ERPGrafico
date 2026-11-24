---
layer: 20-contracts
doc: density-system
status: active
owner: frontend-team
last_review: 2026-11-24
stability: stable
---

# Contrato de Arquitectura: Sistema de Espaciado y Densidad

Este contrato define los tokens de densidad de tabla (`--table-cell-*`, `--table-header-*`) y los modos de densidad (`compact` / `comfortable`) que todo el frontend debe consumir. No inventa componentes nuevos: formaliza lo que `globals.css` ya implementa para que la densidad no dependa de valores mágicos ad-hoc.

**Regla de oro:** ERPGrafico es una herramienta para operadores que la usan todo el día. **`compact` es el default** de todas las superficies de datos (ADR-0070, mantra del operador: "cada píxel debe hacer su trabajo más rápido"). `comfortable` es un opt-out explícito, nunca el default.

---

## 1. El dial de densidad (`--k`) — ADR-0142

El espaciado es la **escala de Tailwind** (`--spacing`), hecha dinámica: `--spacing = 0.25rem × --k`. Toda utilidad de espaciado (`p-*`, `gap-*`, `h-*`, `w-*`, `size-*`…) y los iconos `size-4` responden al dial sin editar clases. `--spacing-r-*` y `--space-fluid-*` fueron retirados.

| Eje | Atributo | Valores | `--k-*` |
|-----|----------|---------|---------|
| Densidad | `data-density` | `compact` (default) · `comfortable` | 1 · 1.125 |
| Puntero | `data-input` | sin atributo / `auto` (sigue el dispositivo) · `touch` · `mouse` | 1 o 1.125 · 1.125 · 1 |

`--k = max(--k-density, --k-input)`. Es **discreto, nunca continuo** (evita alturas fraccionarias y bordes borrosos). Con `--k = 1` (estado por defecto) el resultado es idéntico a la escala estándar.

```tsx
import { DensityScope } from '@/components/shared'

<DensityScope density="comfortable" input="auto">…</DensityScope>
```

- Los atributos se pueden poner en cualquier ancestro; `DensityScope` (sin caja propia, `display: contents`) es la forma recomendada en React.
- El valor se resuelve **por elemento**: `--spacing` está en `@theme inline`, así que cada utilidad emite `calc(0.25rem * var(--k, 1))`. En CSS propio, usar `var(--u)` (la unidad `0.25rem × k` declarada en cada ámbito); **no** `var(--spacing)` en un bloque `:root`, que se congelaría con el `--k` de la raíz.
- **Táctil por dispositivo (global):** sin atributo, o con `data-input="auto"`, el eje de puntero vale 1.125 en un dispositivo táctil de clase tablet (`pointer: coarse` **y** ancho ≥ 64rem, la misma prueba que el antiguo `isTouchPOS`). Los teléfonos conservan la escala compacta. `data-input="mouse"` lo fuerza a 1 en un subárbol; `data-input="touch"` lo fuerza a 1.125 con cualquier ancho.
- Valores fuera de la escala: `calc(var(--u) * n)` con comentario de contexto; no valores en bruto (`p-2.5`) para un ritmo que la escala ya cubre.

---

## 2. Tokens de densidad de tabla

Definidos en `:root` de `globals.css`. Son la única fuente de verdad para el padding/altura de las filas y cabeceras de tabla — ninguna variante de tabla puede usar padding ad-hoc. Desde ADR-0142 se **derivan de `--u`** (ver §1) y se re-declaran en cada ámbito del dial, de modo que siguen a `data-density`/`data-input`.

| Token | Default (compact) | Descripción |
|-------|-------------------|-------------|
| `--table-cell-py` | `0.5rem` (py-2) | Padding vertical de celda |
| `--table-cell-px` | `0.75rem` (px-3) | Padding horizontal de celda |
| `--table-header-py` | `0.25rem` (py-1) | Padding vertical de cabecera |
| `--table-header-px` | `0.5rem` (px-2) | Padding horizontal de cabecera |
| `--table-header-h` | `2.25rem` (~h-9) | Altura de cabecera |
| `--table-row-hover` | `oklch(var(--muted-raw) / 0.5)` | Fondo hover de fila |
| `--table-header-bg` | `transparent` | Fondo de cabecera |
| `--table-footer-bg` | `oklch(var(--muted-raw) / 0.5)` | Fondo de footer |
| `--table-expanded-bg` | `oklch(var(--muted-raw) / 0.3)` | Fondo de fila expandida |
| `--table-row-border` | `oklch(var(--border-raw) / 0.4)` | Borde entre filas |

### Clases de utilidad

| Clase | Efecto |
|-------|--------|
| `.table-cell` | Aplica `padding: var(--table-cell-py) var(--table-cell-px)` |
| `.table-header` | Aplica `height: var(--table-header-h)` + padding de cabecera |
| `.table-row-hover` | Transición + hover con `--table-row-hover` |
| `.table-footer` | Fondo con `--table-footer-bg` |
| `.table-header-compact` | Cabecera extra-densa (`--table-header-h: 2rem`) para vistas de lista |
| `.table-comfortable` | Scope que afloja: `--table-cell-py: 0.75rem`, `--table-header-h: 2.75rem` |

**Regla invariante (PR Reject):** toda variante de tabla (DataTable, FormLineItemsTable, ReportTable, `variant="minimal"`) debe consumir `.table-cell`/`.table-header` en vez de clases de padding sueltas.

---

## 3. Modos de densidad

### 3.1 Default: `compact`

- Es la configuración por defecto de `:root` (los tokens base ya son compact).
- `DataTable` acepta `density?: 'compact' | 'comfortable'` con **default `'compact'`**.
- Justificación: operadores de imprenta con alta densidad de datos — ver ADR-0070 y `DESIGN.md`.

### 3.2 Opt-out: `comfortable`

- Se activa explícitamente con `density="comfortable"` en DataTable (aplica el scope `.table-comfortable`).
- Uso previsto: contextos de "audiencia mixta" (reportes leídos de forma esporádica, settings, onboarding) donde la densidad máxima dificulta la lectura.
- **Nunca** es el default.

```tsx
// Default es compact — no hace falta nada
<DataTable columns={columns} data={data} />

// Opt-out explícito para audiencia mixta
<DataTable columns={columns} data={data} density="comfortable" />
```

---

## 4. Alturas de control por rol (ADR-0142 D4)

| Token | Valor (`--k = 1`) | Utilidad | Uso |
|-------|------------------|----------|-----|
| `--control-h-xs` | 28 px | `h-control-xs` / `size-control-xs` | toolbar muy denso |
| `--control-h-sm` | 32 px | `h-control-sm` | nav del shell, toolbar estándar |
| `--control-h-md` | 36 px | `h-control-md` | acción ERP por defecto (`Button size="sm"`, botones de acción, tabs) |
| `--control-h-lg` | 40 px | `h-control-lg` | `Button`/`Input` por defecto, controles de formulario |
| `--control-h-touch` | 48 px | `h-control-touch` | objetivos táctiles (`Button size="lg"`) |

Los roles se derivan de `--u`, así que escalan con `--k` (comfortable: ×1.125). Cada utilidad fija además `min-height: var(--hit-role-min)` — `0` por defecto, `3rem` con `data-input="touch"` — de modo que en táctil todo control con rol llega a 48 px sin tocar el componente.

**Guarda de Fitts (GOVERNANCE #17).** Los controles *sin* rol reciben `min-height: var(--hit-min)` (40 px; `0` en `[data-density="compact"]` con puntero fino; 48 px en táctil). Los controles *con* rol quedan exentos por cascada (la utilidad vive en una capa superior a la guarda), sin listar nombres de clase. Desde la Fase 6 (inventario de alturas literales en 0) no quedan exclusiones transitorias. Los `input`/`select` nativos tienen su propio piso: `max(2.5rem, var(--hit-role-min))`.

`cn()` (`lib/utils.ts`) extiende `tailwind-merge` para que `h-control-*`/`size-control-*` entren en los grupos `h`/`size`: un `className="h-7"` sigue reemplazando al rol por defecto y viceversa.

**Fuera de la Fase 3** (decisión explícita): `ui/select` (el `SelectTrigger` es un `<button>` que hoy recibe el piso de 40 px por la guarda y se sobreescribe con `h-9` en `LabeledSelect`; migrarlo cambiaría alturas efectivas) y `Chip`/`Badge`/`StatusBadge` (no son controles interactivos; sus alturas `h-4.5`/`h-5.5` no son roles). Se tratan en la Fase 5.

---

## 5. Eje de puntero: variante `touch:` y modo táctil (ADR-0142 D5)

**Estilos.** Se escriben con la variante Tailwind `touch:`, sin ramas JS:

```tsx
<Button className="h-11 text-base touch:h-14 touch:text-xl" />   // 44px normal, 56px en táctil
```

`touch:` aplica bajo `data-input="touch"` o en un dispositivo táctil de clase tablet (coarse + ≥ 64rem) salvo `data-input="mouse"`, en el elemento o en un ancestro. Es la misma condición que sube el dial, de modo que no hace falta ningún atributo para que un iPad reciba los tamaños táctiles en cualquier pantalla. **Regla de doble escala:** el eje táctil ya sube `--k` a 1.125, así que toda utilidad de espaciado crece 12,5 % por sí sola; un `touch:` solo se añade para lo que deba crecer *más* que eso (alturas de botones, tamaño de texto). Los valores `touch:` del POS se calcularon dividiendo el tamaño táctil deseado entre 1,125 (p. ej. 64 px → `touch:h-14`).

**Qué sigue en JS (a propósito).** Lo que no es tamaño: abrir el teclado numérico al tocar, `readOnly` en inputs, ocultar flechas de scroll, `snap`, número de columnas del grid y la elección de layout (`useDeviceContext`/`useTouchMode`). Y `SearchBar`, cuyo alto depende de `isTouch` en cualquier ancho (también teléfonos), distinto de la condición de la variante.

**Estado.** `useTouchMode()` (`hooks/useTouchMode.ts`) expone el modo resuelto (`isTouchMode`) **solo para comportamiento** (teclado numérico al tocar, decimales…), nunca para tamaños. El modo es `auto | touch | mouse`: por defecto `auto` (sigue el puntero; ya no arranca en `touch` en escritorio) y el operador puede forzarlo con el conmutador del POS (se guarda en `sessionStorage`, clave `pos_input_mode`).

**Publicación.** `useApplyInputMode()` escribe el modo en `<html data-input>` mientras la superficie está montada (el POS lo hace en `POSShell`). Va en `<html>` y no en un `DensityScope` porque los diálogos y sheets de Radix se renderizan en un portal fuera del árbol del POS.

---

## 6. Preferencia de usuario y lint

- **Preferencia:** `useDensityPreference()` (`hooks/useDensityPreference.ts`) guarda `compact | comfortable` en `localStorage` (`ui_density`, por dispositivo) y `Providers` la publica en `<html data-density>`. Se cambia en Perfil → Preferencias. `comfortable` sube `--k` a 1.125 en todo el chrome; las tablas conservan su `data-density`.
- **Lint:** `controls/token-height` (error) reporta alturas literales `h-7…h-12` en controles; usa `h-control-*`/`size-control-*`. Es **error** desde la Fase 6 (inventario 0; `h-11` fuera de la regla).
- **Select/Badge:** el trigger de `ui/select` usa `--control-h-md/sm`; `Badge` xs/sm usan `h-4.5`/`h-5.5` (escalan con `--k`).

## 7. Referencias

- [ADR-0070 — Primary = Process Black K100](../10-architecture/adr/0070-primary-process-black.md) (criterio de densidad operativa)
- [ADR-0030 — DataTable compact variant](../10-architecture/adr/0030-datatable-compact-variant.md)
- [component-datatable-views.md](component-datatable-views.md) — contratos de las variantes de DataTable
- [component-skeleton.md](component-skeleton.md) — estados de carga con densidad consistente
- Implementation: `frontend/app/globals.css` (`:root`, sección "RHYTHM & SPACING" / "TABLE SYSTEM" / "DENSITY MODES") y `frontend/components/shared/DataTable.tsx` (prop `density`)
