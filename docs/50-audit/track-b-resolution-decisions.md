# Track B — Brief de decisiones para resolver D2–D4 y H1–H5

- **Fuente:** `docs/50-audit/frontend-design-review-datatable-cards.md` (§§3-4)
- **Estado:** ✅ **aprobado y aplicado** (2026-10-12). Verificado con `tsc --noEmit` limpio, `eslint` (0 errores) y `vitest` (174/174). Resumen de lo adoptado en §6.
- **Principio rector:** elegir **un único registro** (token/CSS var) y que los componentes del surface lo consuman. Hoy conviven token, utilidades raw y clases `.table-*` sueltas en el mismo componente.

---

## 1. D2 — Nivel canónico de cabecera de columna

### Evidencia
- Vocabulario real: `font-bold` **895** (labels/cabeceras) vs `font-black` **187** (títulos/display); `text-3xs` **549** (escalón dominante); `tracking-widest` **218** (estándar labels uppercase).
- La familia diverge: `DataTableColumnHeader` `text-xs font-medium` (sentence-case), compact `DataTable:599` `text-3xs font-semibold uppercase tracking-wider`, features hacen `font-bold uppercase` a tamaños distintos (`CashFlowTable` 10px, `BudgetEditor` 11px, `AccountingEquationCard` 9px, `BOMManager`/`OtTypeChooser` `font-black` 12/14px).
- El **group header** de `DataTableView:224` (`text-xs font-semibold`) es un rol distinto (divisor de grupo), **no** una cabecera de columna.

### Opciones
| Opción | Nivel de cabecera de columna | Cambio visual |
|---|---|---|
| **A (recomendada)** | `text-3xs font-bold uppercase tracking-widest text-muted-foreground` | Clásico: 12px medium sentence → 10px bold uppercase. Máxima consistencia, alinea con features y compact. |
| B (conservadora) | Igual pero `text-2xs` (11px) | Clásico sube a 11px bold uppercase; menos choque de tamaño en tablas anchas con sort. |
| C (mínima) | Normalizar solo peso (bold) y tracking (widest); tamaño queda por contexto | No unifica, deja el defecto a medias. |

**Decisión (adoptada — opción A):** nivel canónico de cabecera de columna = `text-3xs font-bold uppercase tracking-widest` (10px), con el color **por call-site** (ver nota de arquitectura en §6). Los outliers `font-black` (BOMManager/OtTypeChooser) quedan alineados a `font-bold` vía base; `font-black` queda reservado a títulos.

---

## 2. D3 — Densidad: un único mecanismo (CSS vars + scope de densidad)

### Evidencia
- Tokens ya existen y son coherentes excepto un bug: `--table-cell-px: 0.75rem` (**12px**) vs `--table-header-px: 0.5rem` (**8px**) → cabecera y celdas **no alinean** horizontalmente.
- `ui/table.tsx` hardcodea: `TableCell` `py-1.5 px-3`, `TableHead` `h-9 px-3`. `--table-cell-py` es **8px** pero la primitiva usa **6px** (`py-1.5`) → dos valores para el mismo slot.
- Solo el camino embedded/`table-header` en `DataTable.tsx:781` consume el token; classic/minimal y compact usan raw.

### Mecanismo propuesto
1. **Primitivas `ui/table` leen las vars** (Tailwind v4):
   - `TableCell`: `py-(--table-cell-py) px-(--table-cell-px)`
   - `TableHead`: `h-(--table-header-h) px-(--table-header-px) py-(--table-header-py)`
   - así `Density`/`.table-compact` (contenedor) propaga a **toda** la familia, clásico incluido.
2. **Compact grid** deja de hardcodear: fila `px-(--table-cell-px) py-(--table-cell-py)`, header `px-(--table-header-px) py-(--table-header-py)`.
3. **Bug de token:** `--table-header-px` → `0.75rem` (igualar a cell) en `globals.css:372`.
4. **Decisión de valor (adoptada):** mantener `--table-cell-py` en **8px** (token) — las filas base crecen +2px por lado frente al render anterior — y corregir el bug `--table-header-px` → `0.75rem` en `globals.css:372` para que cabecera y celdas alineen. El scope `.table-comfortable` (`py 0.75rem`, `h 2.75rem`) se mantiene como registro de densidad alterna.

---

## 3. D4 — Hover de fila: un solo token

### Evidencia
- `--table-row-hover: oklch(var(--muted-raw)/0.5)` (= `bg-muted/50`). La primitiva `ui/table:70` usa `hover:bg-muted/50` (mismo valor, distinta fuente).
- Desviados: compact `:621` `hover:bg-muted/40`, group header `DataTableView:221` `bg-muted/30 hover:bg-muted/40`.
- De los 24 `hover:bg-muted/50`, **solo 6 son hovers de fila de tabla** (ui/table base, PayrollCard, BudgetVarianceTable, ProductVariantsTab, + los 2 desviados). El resto son clickables no-tabla (cards, dropdowns, botones) — fuera del scope.

### Mecanismo propuesto
- `ui/table TableRow` base: `hover:bg-muted/50` → `hover:bg-(--table-row-hover)` (mismo valor hoy, pero fuente única y override-able).
- Compact y group header: `hover:bg-muted/40` → `hover:bg-(--table-row-hover)`.
- Filas con `.table-row-hover` clásico se mantienen (o se pasan al mismo utility por coherencia).
- Fila completa (para el grupo de features que usan `TableRow`): PayrollCard, BudgetVarianceTable, ProductVariantsTab → quedan cubiertos por el cambio de base.

**Decisión de valor (adoptada):** hover de fila unitario **0.5**. La primitiva base consume `hover:bg-(--table-row-hover)`; compact/group suben de 0.4 a 0.5. Los 3 `TableRow` feature con `hover:bg-muted/50` literal (PayrollCard, BudgetVarianceTable, ProductVariantsTab) pasan al mismo utility para mantener un único registro. Los clickables no-tabla quedan aparte (posible token `--hover-interactive` en otra tarea).

---

## 4. D1 (resto) — Nombre accesible del grid compact

- Hoy `role="grid"`/`aria-rowcount`/`aria-colcount` quedaron en Track A, pero sin `aria-label` (no había fuente de nombre).
- **Decisión (adoptada):** nueva prop opcional `ariaLabel?: string` en `DataTableProps`. Se cablea en el grid compact, en la tabla body embedded y en la classic (`aria-label={ariaLabel}`). React omite el atributo si `ariaLabel` es `undefined`, así que sin valor no se inventa texto. `DataTableView` (que ya recibe `entityLabel`) la cablea con `ariaLabel={entityLabel}`. `TableCaption` permanece disponible para uso explícito.

---

## 5. H1–H5 — Propuesta de redacción para los contratos

| Hipótesis | Contrato actual | Propuesta |
|---|---|---|
| H1 | `typography-scale.md` N2: `text-[10px] font-black uppercase tracking-widest` (adopción literal 0) | Redefinir N2 sobre tokens: cabecera de columna = nivel decidido en §1 (p.ej. `text-3xs font-bold uppercase tracking-widest`); `font-black` fuera de cabeceras. |
| H2 | `component-animation`: prohibe `animate-in` en contenido | Separar "entrada única de interacción/estado" (permitida, con `motion-reduce:`) de "motion masivo por recurso" (prohibido). Track A ya quitó el masivo (D5). |
| H3 | `density-system`: padding raw en tablas = PR-Reject | Mecanismo = CSS vars + scopes `.table-compact`/`.table-comfortable`; la primitiva base consume vars (requiere aprobar §2). PR-Reject aplica solo dentro de la familia. |
| H4 | `color-system` hover | Hover de fila = `--table-row-hover`; la primitiva lo consume; se elimina el `hover:bg-muted/50` del default (requiere aprobar §3). |
| H5 | `search-styles.ts` `SEG_*`/`TOOLBAR_*` (tercer sistema) | Decisión separada: absorber en tokens de toolbar o eliminar. Dimensionar uso antes (no bloquea D2–D4). |

---

## Resumen de decisiones adoptadas (2026-10-12)

1. **D2 nivel:** A — `text-3xs font-bold uppercase tracking-widest` (10px) como nivel canónico de cabecera; **el color NO vive en la base** de `TableHead`, se declara explícito en cada call-site.
   - **Nota de arquitectura (decisión con medición):** se compiló el CSS real (PostCSS + `@tailwindcss/postcss`, node 20.20.2) y se ordenaron los bytes en que las utilities de color se emiten: `.text-expense` (114153) **antes** de `.text-muted-foreground` (116639), mientras `.text-primary` (119151) y `.text-success` (121201) van **después**. Si la base llevara `text-muted-foreground`, las cabeceras `text-expense` de `PayrollCard` se volverían grises por cascada. Con el color fuera de la base no hay ruleta: los call-sites declaran su color y los desnudos reciben `text-muted-foreground` explícito.
2. **D3 densidad:** token `--table-cell-py` **8px** (las filas base crecen +2px) y `--table-header-px` → `0.75rem`. Primitivas `ui/table` y compact/minimal/embedded leen vars (`py-(--table-cell-py)`, `h-(--table-header-h)`, etc.).
3. **D4 hover:** **0.5** único; primitiva y 3 features consumen `hover:bg-(--table-row-hover)`.
4. **D1:** prop `ariaLabel?: string` adoptada y cableada en grid/embedded/classic + `DataTableView`.
5. **Barrido de consistencia:** eliminadas las clases unlayered `.table-cell`/`.table-header` de los call-sites (la base ya aporta lo mismo); `tracking-wider`/`text-xs`/`text-2xs` residuales en cabeceras sustituidos por el nivel canónico; los ~20 sitios con `TableHead` "desnudo" recibieron `text-muted-foreground`; `ReportTable` (`<th>` raw, `text-2xs font-semibold h-10 px-3`) migrado a tokens + `font-bold text-3xs`.
6. **Contrato de prueba:** 3 entradas stale aparecieron en el ratchet de `animate-in` (`DashboardPageClient`, `DataTable`, `ProductionMetricsCard`) — ninguna anima inline ni en HEAD (fallo pre-existente); se quitaron sus entradas del allowlist (cura documentada por el propio test: "migrating a file means deleting its entry here").

**Verificación:** `tsc --noEmit` ✅ · `eslint` 0 errores ✅ · `vitest` 20 ficheros / 174 tests ✅.