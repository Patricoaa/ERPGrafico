# Frontend Design Review — Familia DataTable / DataTableView / Card Views

- **Tipo de review:** Design System Compliance Audit + Accessibility Audit (estático, sin navegador)
- **Alcance:** `components/shared/DataTable*`, `DataTableView`, `EntityCard`, `AutoEntityCard`, `entity-fields`, `entity-actions`, `view-helpers`, `search-styles`, `ui/table`, `ui/card` + consumidores muestra (ProductClientView, UsersSettings, WorkOrdersPage, TreasuryMovements, SalesOrdersView, BankMovements, PurchasingOrders, InventoryCount, ReconciliationPanel, CashFlowTable, BudgetEditor, AccountingEquationCard)
- **Método:** lectura de código + conteos de evidencia (`grep`). Las afirmaciones de jerarquía/legibilidad se marcan como "a validar en render"; no hubo verificación visual.
- **Fecha:** 2026-10-09 · Estado: **Needs Work** (Track A aplicado; Track B pendiente de decisión)
- **Punto de partida (importante):** los documentos de `docs/20-contracts/` **no se tratan como autoridad ni como spec**. Son *decisiones de diseño que también pueden estar mal diseñadas*; por eso este review los coloca en una sección propia de hipótesis a validar (§4) y juzga el código con criterios independientes: consistencia interna (con conteos), accesibilidad (WCAG/ARIA), ergonomía/performance y juicio de diseño propio.

---

## 1. Context de los hallazgos

La familia DataTable es el surface más usado del ERP. Este review evalúa si la superficie es **coherente consigo misma**, **accesible** y **mantenible**, y —por separado— si los contratos que pretenden gobernarla son válidos.

Tres hechos estructurales guían la lectura:

1. El repo **ya vive en tokens**: `text-3xs` (549 usos), `text-4xs` (134), `tracking-widest` (218), `shadow-card` (147), `shadow-floating` (32), `shadow-elevated` (20), `shadow-overlay` (11). Cero literales de color. La infraestructura de tokens existe y se consume.
2. Sin embargo, para el **mismo rol semántico** (encabezado de tabla/label de celda) conviven **tres pesos** (`font-medium`, `font-semibold`, `font-bold`, además de `font-black` en títulos) y **cuatro tamaños** (`text-4xs` 9px, `text-3xs` 10px, `text-2xs` 11px, `text-xs` 12px) — sin un nivel canónico. Eso es un defecto de consistencia *independiente de cualquier contrato*.
3. Dos mecanismos de estilo compiten en paralelo: clases de token (`.table-header`, `.table-cell`, `.table-row-hover`, `.table-*-modes`) y utilidades crudas (`hover:bg-muted/40`, `px-3 py-2.5`, `h-9`), a veces dentro del mismo componente.

---

## 2. Patrones dominantes observados (evidencia con conteos)

| Patrón | Hecho | Conteo | Evidencia |
|---|---|---|---|
| Peso de texto por rol | `font-bold` domina labels/cells/headers; `font-black` domina títulos/valores display; `font-semibold`/`font-medium` aparecen en cabeceras DataTable | bold **895** · black **187** | `grep -rEo 'font-bold'` / `'font-black'` en `*.tsx` |
| Escala tipográfica | Token-driven; nadie usa el literal `10px` | `text-3xs` **549** · `text-4xs` **134** · `text-[10px]` **0** | `grep -rEo` |
| Tracking | `tracking-widest` es el estándar de labels uppercase; `tracking-looser` residual; `tracking-[0.25em]` solo 4 | widest **218** · looser **15** · `[0.25em]` **4** | `grep -rEo` |
| Cabeceras de tabla reales | Mismo rol con 4 tamaños × 3 pesos | — | §2.1 |
| Hover de fila | Tres mecanismos distintos | `.table-row-hover` **5** (todos en `DataTable.tsx`) · `hover:bg-muted/40\|50` **24** · base `ui/table` `bg-muted/50` default | `DataTable:520,659,680,906,926`, `ui/table.tsx:70`, `DataTable:614`, `DataTableView:221` |
| Sombras | Tokens dominan; raw `sm/md/lg` residual; arbitrarios mayormente semánticos | tokens **210** · `sm`4/`md`5/`lg`4 · arbitrarios ~25 (glows por `var(--*raw)`, insets) | §2.2 |
| Motion de contenido | Entrada de listas/skeletons/secciones/tooltips/alertas normalizada; guard `motion-reduce:` explícito solo en 2 sitios | `animate-in` **41** en shared | `CollapsibleSheet:196`, `FadeIn:24` |

### 2.1. Cabeceras de tabla: cuatro tamaños × tres pesos

| Componente | Cabecera real | Tamaño | Peso |
|---|---|---|---|
| `DataTableColumnHeader` (tablas clásicas) | `text-xs font-medium text-muted-foreground` | 12px | medium |
| `DataTable` modo compact (`DataTable.tsx:599`) | `text-3xs font-semibold uppercase tracking-wider` | 10px | semibold |
| `DataTableView` group header (`:224`) | `text-xs font-semibold` | 12px | semibold |
| `CashFlowTable` (`:157-160,257-258`) | `text-3xs font-bold uppercase` | 10px | bold |
| `BudgetEditor` (`:302`) | `text-2xs font-bold uppercase tracking-wider` | 11px | bold |
| `AccountingEquationCard` (`:56,61,66`) | `text-4xs font-bold uppercase tracking-widest` | 9px | bold |
| `BOMManager` (`:118,205`) / `OtTypeChooser` (`:34,53`) | `font-black text-xs/sm uppercase tracking-widest` | 12/14px | black |

El peso dominante en cabeceras de features es **`font-bold`** con `uppercase`; la familia DataTable es la que diverge (medium/semibold). El tamaño no tiene norma: cada contexto elige su escalón de token.

### 2.2. Sombras: artesanía mayormente token-driven

- Tokens: `shadow-card` 147, `shadow-floating` 32, `shadow-elevated` 20, `shadow-overlay` 11.
- Raw `shadow-sm|md|lg`: 13 (incl. `EntityCard.tsx:87`, POS `Cart.tsx:104,214`, `POSClientView.tsx:574` `shadow-lg shadow-black/10`, `CartItem.tsx:333`).
- Arbitrarios (~25): son **en su mayoría semánticos e intencionales** — glows de estado por variables (`shadow-[0_0_8px_oklch(var(--success-raw)/0.5)]`, destr/info/warning) e insets de campo. Tres usan `var(--shadow-overlay)` directamente. No son "slop": revelan que falta un *token de glow de estado*, no que se ignore el sistema.

---

## 3. Defectos objetivos

Defectos que existen **con o sin contratos**: son hechos de consistencia, accesibilidad y performance del propio código.

### D1 — ARIA: grid con roles huérfanos y sin caption [Accesibilidad] — ✅ Track A
`DataTable.tsx:599-606`: el modo compact renderiza divs con `role="row"` y `role="columnheader"` **sin ancestro** `role="grid"` ni `role="table"`, y sin `<caption>`. Además, `ui/table.tsx:13` declara `caption-bottom` (preparado para caption) pero ninguna tabla de la familia usa `TableCaption`. Impacto: los lectores de pantalla no reconstruyen la estructura fila/columna de la vista compact (WCAG 4.1.2). Fix barato: `role="grid"` + `aria-rowcount`/`aria-colcount` + caption descriptivo (o `aria-label`).

### D2 — La misma superficie con N niveles de header [Consistencia]
Evidencia §2.1: un usuario que alterna clásico ↔ compact ↔ features ve programáticamente 4 tamaños y 3 pesos para "encabezado". No hace falta spec: es incoherencia interna verificable. La normalización debe elegir **un** nivel de token (tamaño+peso+tracking) y aplicarlo a `DataTableColumnHeader`, compact, group header y a la convención de features.

### D3 — Los modos de densidad no propagan a toda la familia [Mantenibilidad + consistencia]
Los tokens `.table-cell`/`.table-header`/`.table-comfortable`/`.table-row-hover` se aplican **solo** en el camino clásico/embedded de `DataTable` (`.table-header` en `:445,505,781`; `.table-cell` en `:463,527,669,690`; `table-row-hover` en `:520,659,680,906,926`) y al scope `.table-comfortable` (container `:827`). En cambio quedan fuera:
- modo compact (grid): padding raw `DataTable.tsx:599,614`;
- modo minimal: `DataTable.tsx:875,913,933` sin clases de token;
- primitiva base: `ui/table.tsx:86,102` `h-9 px-3` / `py-1.5 px-3`.

Consecuencia objetiva: **cambiar un token de densidad no altera minimal ni compact**; la familia se martilla en dos registros (token y raw) dentro del mismo componente.

### D4 — Tres familias de hover de fila [Consistencia]
- `var(--table-row-hover)` vía `.table-row-hover` (clásico), 5 usos confinados a `DataTable.tsx`.
- `hover:bg-muted/40` (compact, `DataTable.tsx:614`) y `bg-muted/30 hover:bg-muted/40` (group header, `DataTableView.tsx:221`).
- `hover:bg-muted/50` por defecto en la primitiva `ui/table.tsx:70` y en 24 sitios del repo (PayrollCard, BudgetVarianceTable, BudgetEditor, selectors…).
Un mismo estado ("fila bajo el cursor") con tres intensidades y tres mecanismos; foco visual diferente de pantalla a pantalla.

### D5 — Motion por fila y `transition-all` en grids [Performance/ergonomía] — ✅ Track A
- `DataTable.tsx:614`: cada fila del grid compact monta con `animate-in fade-in duration-300` + `transition-all` sobre toda la fila. En listas grandes es trabajo CSS extra por fila y ruido visual en re-render (los `key` de TanStack limitan al montaje, pero siguen siendo animaciones masivas por recurso).
- `DataTable.tsx:698,943`: filas expandidas `animate-in fade-in slide-in-from-top-2`.
- `EntityCard.tsx:335,352,525`: skeletons con `animate-in fade-in` que re-corren en cada re-render del estado de carga.
- Contraste: solo 2 sitios usan guard explícito `motion-reduce:` (`CollapsibleSheet:196`, `FadeIn:24`); el resto depende del floor global de `globals.css:1346` (que mitiga a11y pero no el coste de render). Marcar "a validar en render con profiling" si se quiere priorizar.

### D6 — Residuos menores — ✅ Track A
- `DataTable.tsx:764,862`: magic value `max-h-[calc(100vh-260px)]` fuera del patrón `65vh`.
- `SalesOrdersView.tsx:397`: `grayscale-[0.2] blur-[0.2px]` para dimming.
- `CashFlowTable.tsx:13,15,18`: imports con punto y coma sueltos (cosmético).
- `TreasuryMovementsClientView.tsx:396-397`: chip prefix `font-mono` + peso propio (pendiente, Track B); mismatch de `entityLabel` **confirmado y corregido** en Track A — ver §3.1.

### 3.1. Resolución — Track A (aplicada 2026-10-09)

Fixes objetivos, sin dependencia de decisiones de diseño. Verificado con `tsc --noEmit` limpio, `eslint` (0 errores; 2 warnings preexistentes de `exhaustive-deps`) y `vitest` (6/6 en `DataTableExpandHeader` + `AutoEntityCard`).

| Defecto | Cambio | Archivo |
|---|---|---|
| D1 | `role="grid"` + `aria-rowcount` + `aria-colcount` en el grid compact (los `role="row/columnheader/cell"` ya existían, pero huérfanos) | `DataTable.tsx:599-604` |
| D5 | removidos `animate-in fade-in duration-300` + `transition-all` de filas compact; `animate-in` de filas expandidas; `animate-in` de skeletons | `DataTable.tsx:614,698,943`, `EntityCard.tsx:337,354,527` |
| D6 | magic value centralizado en `NON_MODAL_TABLE_MAX_HEIGHT`; semicolons sueltos eliminados; mismatch `entityLabel` corregido | `DataTable.tsx:35,771,869`, `CashFlowTable.tsx`, `TreasuryMovementsClientView.tsx:447` |

Notas de la resolución:
- El mismatch de `entityLabel` era real: el mismo dataset (`movements`) se rotulaba "Movimiento de Tesorería" (tabla, `:372`) y "Movimiento de Caja" (cards, `:447`). Se alineó a `treasury.treasurymovement`. `treasury.cashmovement` queda como entrada huérfana en `entity-registry.ts:984` (su único consumidor era este call-site) — candidata a eliminar en una limpieza posterior.
- `transition-all` en filas embedded (`DataTable.tsx:659,680` con `.table-row-hover`) se dejó fuera de Track A por estar atado a la unificación de hover (D4/Track B).
- D1 queda cubierto en estructura ARIA, pero **sin `aria-label`/caption**: el modo compact no tiene hoy una fuente de nombre accesible, y derivarlo requiere decidir de qué prop (parte de Track B).
- El impacto de quitar el motion por fila (D5) **no se midió** en render: review estático. Verificar con profiling si se quiere cuantificar.

---

## 4. Hipótesis de contract-drift — los contratos como candidatos a estar mal diseñados

Aquí no se juzga al código: se señala dónde los contratos (decisiones de diseño) no se sostienen contra el comportamiento real del producto. Son **hipótesis a validar/editar por el equipo**, no defectos a "arreglar" en código.

### H1 — `typography-scale.md` N2: spec con adopción cero en su literal
N2 prescribe `text-[10px] font-black uppercase tracking-widest` para headers. **`text-[10px]` aparece 0 veces en todo el repo** — nadie hardcodea 10px; el repo vive en `text-3xs` (549) / `text-4xs` (134). Además el *peso* `font-black` solo se usa en títulos/display (187), mientras los headers reales son `font-bold` (895). Conclusión: la spec no definió un **nivel canónico operativo** (token + peso + tracking); los headers son 4 tamaños × 3 pesos. El contrato está **desconectado de la escala real**. Acción sugerida: redefinir N2 sobre tokens existentes y fijar un único nivel.

### H2 — `component-animation`: prohibición absoluta irreal
El contrato prohíbe `animate-in` en contenido. El producto lo usa de forma deliberada y sistemática (41 sitios): entrada de listas/cards (`CardSkeleton`, `EntityCard`, `LayoutSkeletons`), transiciones de secciones (`GenericWizard`, `ManufacturingSpecsEditor`, `WizardStepsSidebar`), respuestas de error (`LabeledInput:178`, `MultiTagInput:183`), tooltips. Prohibirlo por decreto empujaría el producto contra su propia convención. Lo defendible del contrato es el *motion masivo por recurso* (D5) y la ausencia de guard explícito, no la entrada de componentes. Acción sugerida: separar "entrada única de interacción" (permitida, con guard) de "motion masivo/recurrente en contenido".

### H3 — `density-system`: dos mecanismos co-existentes sin precedencia
El contrato marca el padding raw en tablas como PR-Reject, pero la primitiva `ui/table.tsx` trae `h-9`/`py-1.5` hardcodeados y la familia mezcla `.table-*` tokens con raw. Hasta que el contrato no defina **un único mecanismo** (token) y la primitiva base lo consuma, la regla es inaplicable y ambigua. Acción sugerida: la primitiva debe consumir `.table-*`; el contrato debe validar los valores de `--table-*` contra render real antes de exigirlos.

### H4 — `color-system` / hover: el token y la primitiva compiten
`--table-row-hover` existe y se usa (5) pero la primitiva `ui/table.tsx:70` impone su propio `hover:bg-muted/50`, y 24 sitios usan opacidades de `muted`. El sistema no tiene una sola fuente para "hover de fila". Acción sugerida: eliminar el hover de la primitiva base y centralizarlo en el token.

### H5 — `search-styles.ts` (`SEG_*`): un tercer sistema
Los `SEG_*`/`TOOLBAR_*` son intentos de normalizar el toolbar de búsqueda sin pasar por `globals.css`, y conviven con `text-xs font-semibold` propios de `DataTableColumnHeader`. Es un síntoma de que la escala de tokens no cubre el toolbar. Acción sugerida: absorber en tokens de toolbar o eliminar; el contrato de búsqueda debería existir (hoy la normalización vive solo en el código).

---

## 5. Pillar Assessment

Criterios evaluados contra la evidencia de §§2-3 (consistencia verificable), no contra contratos.

### Pilar 1 — Frictionless Insight-to-Action 🟢 8/10
| Criterio | Evidencia |
|---|---|
| Estados completos (empty/loading/error/null) | `EmptyState`, skeletons con `aria-live`, dash de celda (`DataTableCells.tsx:199`) |
| Variantes cubren contextos (modales, drawers, paneles) | 4 variantes + callback de densidad |
| Acciones y registries | `ROW_ACTIONS` / `createActionsColumn` tipados |
| Fricción visual | Media: el usuario ve headers distintos según variante (D2) |
| Costo de cambio | Bajo para el usuario, alto para el mantenedor (D3, D4) |

### Pilar 2 — Quality Craft 🟠 6/10
| Criterio | Evidencia |
|---|---|
| Consistencia de roles visuales | No: N niveles de header (D2), N hover (D4) |
| Densidad y alineación | Dos registros (token vs raw) en el mismo componente (D3) |
| Motion craft | Motion masivo por fila + `transition-all` (D5); guard escaso |
| Artesanía de color/sombra | Alta: 210 sombras token, 0 hex, arbitrarios semánticos (§2.2) |

### Pilar 3 — Trustworthy Building 🟢 8/10
| Criterio | Evidencia |
|---|---|
| Higiene de huesos | 0 hex hardcodeados, 0 `cardMode` residual, `text-[10px]` 0 |
| Convenciones de datos | `manualPagination`+`rowCount` cableado en todos los consumidores muestreados |
| Semántica accesible | Rota en grid compact (D1) |
| Controles anti-regresión | `entity-fields.test.ts` pin pesos de celda (pero no cubre D1-D5) |

---

## 6. Verdict

**Needs Work**, por **defectos objetivos** que persisten independientemente de la validez de los contratos: cabeceras multi-estándar (D2) y densidad y hover con tres mecanismos (D3, D4). Track A (2026-10-09) ya resolvió los defectos *contract-independent*: ARIA del grid compact (D1), motion por fila (D5) y residuos (D6). Lo que queda (D2–D4) no es puramente técnico: exige decidir qué registro gana (token vs raw) y cómo se reescriben H1–H5. La superficie es funcionalmente rica y con una higiene de color/sombras notable (todo en tokens, cero literales); el problema no es "qué tan bien se sigue la spec" sino la **coexistencia de registros**: token-driven vs raw dentro del mismo componente.

### Mantenibilidad
- **Fuerzas:** infraestructura de tokens completa y consumida; factories de columnas (entity-fields, `DataCell`) y registry de acciones centralizan el 90% del render; deprecaciones se cumplen (0 `cardMode`); las pruebas de pesos de celda existen.
- **Debilidades:** la familia se martilla en dos registros (token y raw) → un cambio de densidad/hover requiere tocar varios caminos; `SEG_*` es un tercer sistema; los tests no cubren las invariantes del surface (cabecera unívoca, ausencia de motion masivo, ARIA del grid compact).
- **Acción recomendada — T8/ADR-0078 debe resolver las dos cosas a la vez:** (1) unificar cabecera en un único nivel de token (tamaño+peso+tracking) para clásico, compact, group y features; (2) hacer que compact y minimal consuman `.table-*` y que `ui/table` deje de hardcodear padding/hover; (3) ~~quitar `animate-in`/`transition-all` por fila~~ **hecho (Track A, D5)**; (4) ~~arreglar ARIA del grid (`role="grid"` + caption)~~ **parcialmente hecho (Track A, D1: falta `aria-label`/caption)**; (5) **antes de ejecutar**, validar H1–H5 en equipo: varios contratos hoy contradicen el producto (H2) o tienen adopción cero en su literal (H1), y ejecutar el refactor "hacia la spec" consolidaría decisiones potencialmente erróneas.

---

## 7. Apéndice de evidencia

Conteos `grep` (reproducibles) sobre `frontend/`, solo `*.tsx`:

| Query | Conteo | Lectura |
|---|---|---|
| `font-bold` | 895 | Vocabulario de labels/cells/headers |
| `font-black` | 187 | Vocabulario de títulos/display |
| `font-semibold` | (no contado) | Cabeceras DataTable + `SEG_*` |
| `text-3xs` | 549 | Escalón 10px token, dominante |
| `text-4xs` | 134 | Escalón 9px token |
| `text-[10px]` | 0 | El literal de la spec N2 nunca se usó |
| `tracking-widest` | 218 | Estándar labels uppercase |
| `tracking-looser` | 15 | Residual |
| `tracking-[0.25em]` | 4 | `FormSection`, `SectionHeader`, `ActivitySidebar`, `PayrollCard` |
| `shadow-card` / `-floating` / `-elevated` / `-overlay` | 147 / 32 / 20 / 11 | Tokens dominantes |
| `shadow-{sm,md,lg}` | 4 / 5 / 4 | Raw residual |
| arbitrarios `shadow-[...]` | ~25 | Mayoría glows semánticos por `var(--*raw)` |
| `animate-in` (shared) | 41 | Motion de contenido establecido |
| `motion-reduce:` (shared) | 2 | `CollapsibleSheet:196`, `FadeIn:24` |
| `.table-row-hover` | 5 | Todos en `DataTable.tsx` |
| `hover:bg-muted/40` / `hover:bg-muted/50` | 24 | Repo completo + base `ui/table:70` |
| hex literales en shared/features | 0 | Solo defaults de branding en `CompanySettings` |
| `cardMode` | 0 | Prop deprecada eliminada |