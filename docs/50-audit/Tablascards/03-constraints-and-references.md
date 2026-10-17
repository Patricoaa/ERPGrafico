# 03 · Restricciones no funcionales y referencias (Fase 3)

> Fecha: 2026-10-17 · Sin cambios de código. Rutas relativas a `frontend/`.
> Evidencia: **V** = Verificado · **P** = Probable · **Pd** = Pendiente · **DP** = Decisión propuesta · **Pd-backend**.
> Herramientas: `web-design-guidelines` (reglas de Vercel Web Interface Guidelines obtenidas el 2026-10-17), lectura del núcleo, consultas a la BD de desarrollo y a la BD legacy real (`ordenes_dump`).

## 1. Accesibilidad

### 1.1 Revisión del núcleo (formato `web-design-guidelines`)

```text
## components/shared/DataTable.tsx
DataTable.tsx:869-896 - cabecera y cuerpo en dos <table> distintas (técnica de cabecera fija); el <table> del cuerpo no tiene <th> → el lector de pantalla no asocia celdas con columnas
DataTable.tsx:790-812 - ídem en la variante embedded
DataTable.tsx:603 - role="grid" sin modelo de teclado (sin roving tabindex ni flechas) → debería ser role="table"
DataTable.tsx:604 - aria-rowcount = filas de la página + 1; con paginación en servidor debería ser rowCount + 1
DataTable.tsx:629,675 - fila clicable con onClick sin tabIndex ni onKeyDown → la acción por defecto no es accesible por teclado
DataTable.tsx:859-866 - barra de refetch solo visual; sin aria-busy ni aria-live
DataTable.tsx:240-248 - detección de modal leyendo el DOM en un efecto (lectura de layout; frágil)

## components/shared/DataTableColumnHeader.tsx
DataTableColumnHeader.tsx:22-49 - sin aria-sort en el <th>; el estado del orden solo se comunica con un icono
DataTableColumnHeader.tsx:42-48 - iconos de orden sin aria-hidden y sin texto accesible del estado ("orden ascendente")

## components/shared/EntityCard.tsx
EntityCard.tsx:64-82 - role="button" en el contenedor con controles interactivos dentro (acciones, hub trigger) → interactivos anidados
EntityCard.tsx:78 - `e as unknown as React.MouseEvent` (cast para reutilizar defaultAction con teclado)

## components/shared/DataTableCells.tsx
✓ cifras con tabular-nums (DataTableCells.tsx:199-262)
✓ flujos con icono y signo por defecto (showIcon = true, showSign = true; DataTableCells.tsx:240, :273) → el estado no depende solo del color
✓ StatusBadge con punto + texto (StatusBadge.tsx:7-16)

## Colecciones editables de wizard/modal (02 §4)
DeliveryDrawer.tsx:508-516 (y patrón en las 11) - input sin label ni aria-label que lo asocie a su producto
P1 (7) - el error de tope no se muestra junto a la celda ni se enfoca al enviar
```

Comandos: `grep -nE "aria-|role=|onKeyDown|tabIndex|tabular-nums|aria-sort|aria-busy|aria-live" components/shared/{DataTable,DataTableColumnHeader,EntityCard,DataTableCells}.tsx` → sin coincidencias de `aria-sort`, `aria-busy` ni `aria-live`; en `DataTable.tsx`, `onKeyDown`/`tabIndex` no aparecen.

### 1.2 Decisión de semántica: tabla frente a grid

| Opción | Cuándo corresponde (WAI-ARIA APG) | Situación actual | DP |
|---|---|---|---|
| `<table>` semántica | Datos tabulares de lectura; navegación con Tab sobre los controles internos | variantes `standalone`/`embedded`/`minimal`, pero partidas en dos tablas | **Por defecto en todas las colecciones de lectura**, con **una sola** `<table>` y `thead` fijo por CSS (`position: sticky` en `th`) |
| `role="grid"` | Widget interactivo con navegación por flechas entre celdas (hoja de cálculo) | `compact` declara `grid` sin implementarlo | Solo si una colección **editable** (P1/P2) adopta navegación por flechas. Si no, `<table>` con inputs etiquetados |
| Card grid | Lista de entidades | `div` con card `role="button"` | `ul/li` (o `role="list"`) con el **título como enlace o botón**; las acciones quedan como hermanos, no anidadas |

**Herencia del track B:** se conserva la prop `ariaLabel` y su cableado desde `entityLabel` (`track-b-resolution-decisions.md` §4). Cambiar `role="grid"` a `role="table"` en `compact` corrige una semántica incorrecta y no toca ninguna decisión visual. **Se somete a la Puerta A** porque modifica un detalle de la decisión D1.

### 1.3 Requisitos de accesibilidad (AX)

| ID | Requisito | Origen |
|---|---|---|
| AX-1 | Una única `<table>` por colección, con `<th scope="col">`; cabecera fija por CSS | §1.1 |
| AX-2 | `aria-sort` en la columna ordenada; texto accesible del estado; iconos `aria-hidden` | §1.1 |
| AX-3 | **La acción por defecto también es un enlace o botón real** (título/código de la fila o card → `openEntity` o URL canónica `/d/{label}/{id}`, ADR-0086); el clic en la fila es solo una mejora para ratón | §1.1; `02` §5.3 ("clic → ficha", ~70) |
| AX-4 | Sin interactivos anidados en cards; acciones fuera del área clicable | `EntityCard.tsx:64-82` |
| AX-5 | `aria-busy` durante la carga y el refetch; anunciar el resultado de filtros y paginación con `aria-live="polite"` ("23 resultados") | §1.1 |
| AX-6 | Celdas editables con nombre accesible derivado de la fila ("Cantidad a despachar — {producto}"), error junto a la celda (`aria-invalid` + `aria-describedby`) y foco en el primer error al enviar | `02` §4 (ED-1, ED-2); TC-022 |
| AX-7 | El estado nunca solo por color: icono o texto obligatorio en estado, flujo, varianza y avisos (vencido, exceso, diferencia) | ✓ hoy en `StatusBadge` y flujos; **falta** en varianza de presupuesto, diferencia de P2 y bordes rojos de P2 |
| AX-8 | `aria-rowcount` y `aria-rowindex` reflejan el total del servidor cuando hay paginación en servidor | `DataTable.tsx:604` |
| AX-9 | Filas expandibles con botón `aria-expanded` + `aria-controls`; árboles con nivel indicado | `02` §5.3 (expansión, árbol) — Pd verificar `createExpanderColumn` |
| AX-10 | Teclado táctil (POS) y modo táctil sin perder la etiqueta ni el tope | `02` §4 (Step3) |

## 2. Rendimiento

### 2.1 Volúmenes reales

| Fuente | Dato | Comando |
|---|---|---|
| BD legacy real (`ordenes_dump`, 10 años) | **7 980 OV** (máx. **1 829 al año**, máx. **205 al mes**, media 74 al mes); **2 843 clientes**; **8 556 pagos** | `psql … -d ordenes_dump -Atc "select … from ordenes …"` |
| BD de desarrollo (demo) | máx. ~2 000 filas por tabla (`accounting_journalitem` 2 090, `workflow_task` 914, `sales_saleorder` 178) | `select relname, n_live_tup from pg_stat_user_tables order by 2 desc` |
| Proyección (P) | Cada OV genera despacho, factura, pago, varios asientos (≈ 4–8 apuntes) y movimientos de stock → **apuntes contables y movimientos de stock del orden de 10⁴ al año** y documentos de 10³ al año | Inferido de la relación OV → documentos derivados |

### 2.2 Estado actual

| Aspecto | Medición | Estado |
|---|---|---|
| Tamaño de página por defecto | 10 ×8, **20 ×17**, 50 ×6, 100 ×1, **500 ×2** (`ProductClientView.tsx:633`, `AccountsClientView.tsx:155`) | V |
| Virtualización | `react-virtuoso` instalado; solo se usa en `components/selectors/ProductGridPicker/ProductGrid.tsx`. Ninguna colección virtualiza | V |
| Agrupación | Desactiva la paginación en servidor; tope de 200 filas (TC-019) | V |
| Estabilidad de columnas | 20 de 60 vistas con `toColumns()` no lo envuelven en `useMemo` cercano (heurística: `useMemo` en las 40 líneas previas); algunas pueden ser constantes de módulo | P |
| Memoización de celdas y cards | 0 `memo` en `DataTableCells`, `DataTable` y `AutoEntityCard`; cada card recalcula `toCardFields` + `buildSubtitleOrder` (dos veces) por render | V |
| Cifras de render | No medidas (sin perfilado en esta fase) | Pd (Fase 5) |

### 2.3 Requisitos de rendimiento (PF)

| ID | Requisito | Justificación |
|---|---|---|
| PF-1 | Paginación en servidor **por defecto** para documentos, movimientos, contabilidad y crédito; paginación en cliente permitida solo para maestros pequeños (< ~1 000 filas) | §2.1 |
| PF-2 | Sin virtualización en el núcleo para páginas ≤ 100 filas. **Virtualización opcional** (react-virtuoso ya instalado) cuando la colección muestra > 100 filas: tamaño 500, agrupación en cliente, árbol de cuentas | La guía sugiere virtualizar desde 50 elementos; con páginas de 20 no compensa |
| PF-3 | Definiciones de entidad **estáticas a nivel de módulo**; nada de reconstruir columnas en cada render | §2.2 |
| PF-4 | Resolución de layout de card memoizable por definición (no por fila) y celdas puras | §2.2 |
| PF-5 | Agrupación en servidor (o paginación por grupo) | TC-019, **Pd-backend** |
| PF-6 | Presupuesto medible en la Fase 5: render de 100 filas × 12 columnas y de 50 cards sin regresión frente al sistema actual | Línea base pendiente |

## 3. Tipado

### 3.1 Garantías actuales

| Garantía | Hoy | Evidencia |
|---|---|---|
| Opciones válidas por tipo de campo | ✓ | Unión discriminada (ADR-0066), `entity-fields.tsx:188-253` |
| Claves de campo válidas | ✗ | `key: (keyof T & string) \| (string & {})` (`:139`) |
| `exclude` / `only` / `column(key)` / `render(key)` con claves existentes | ✗ | `string`/`string[]`; bug TC-012 y no-op en `ContactDrawer.tsx:629` |
| Valor compatible con el renderer | ✗ | `value as number`, `value as string \| Date` (`:420-546`) |
| Mezclar entidades o modos sin casts | ✗ | `as unknown as` en `ContactDrawer.tsx:625-629` y `SalesOrdersView.tsx:380` |
| `ColumnMeta` tipado | ✗ | `meta: { title }` sin aumentar `ColumnMeta` de TanStack (`grep "declare module"` → 0) |
| Tests de tipos | ✗ | 0 archivos con `expectTypeOf` o `@ts-expect-error` |
| `strict` | ✓ | `tsconfig.json`. No hay `noUncheckedIndexedAccess` ni `exactOptionalPropertyTypes` |

Versiones relevantes: TypeScript ^5 · `@tanstack/react-table` ^8.21 · React 19.2 · Next 16.1 · zod ^4.2 · react-hook-form ^7.69 · Storybook ^10.3 · vitest ^4.1 (`package.json`).

### 3.2 Requisitos de tipado (TY)

| ID | Requisito | Previene |
|---|---|---|
| TY-1 | Las claves de campo se restringen a `keyof T`; un campo virtual exige un accesor (`get`) y declara el tipo de su valor | RC8 (claves libres) |
| TY-2 | El tipo de valor que produce el accesor debe ser compatible con el tipo semántico (dinero → `number \| DecimalString`; referencia → `DocumentRef`; fecha → `ISODate`) | casts `value as …` |
| TY-3 | Los identificadores de campo forman una unión literal inferida; `exclude`, `only`, `column()` y los layouts de superficie solo aceptan esa unión | TC-012 |
| TY-4 | Registro de tipos de valor y renderers **abierto por aumentación de módulos** (declaration merging): una feature declara su tipo y sus opciones sin tocar shared, y el compilador valida las opciones | RC1 sin `computed` opaco |
| TY-5 | Modos y colecciones heterogéneas modelados como uniones discriminadas, sin `as unknown as` | TC-018, `ContactDrawer` |
| TY-6 | Tests de tipos en CI (`expectTypeOf` y `@ts-expect-error` en vitest) para configuraciones inválidas | Métrica "configuraciones inválidas detectadas en compilación" (§6 del prompt) |
| TY-7 | **Riesgo:** el coste de inferencia de TS con uniones grandes y genéricos anidados. La inferencia debe quedarse local a cada entidad y medirse el tiempo de `type-check` antes y después | Rendimiento del editor y de CI |

## 4. Referencias de diseño de API (aplicadas a este proyecto)

> Referencias conocidas por el autor; **no se descargaron ni copiaron librerías** en esta fase. Sirven para nombrar patrones en la Fase 4, no para adoptarlos tal cual.

| Referencia | Idea | Qué resuelve aquí | Encaje |
|---|---|---|---|
| **TanStack Table** (ya instalado, v8) | Núcleo *headless*: modelo de filas, orden, filtros, selección, expansión y agrupación sin UI; `ColumnMeta`/`TableMeta` aumentables por módulo | RC6: separar el estado de colección (que hoy ya usa TanStack) del render, para que tabla, card, kanban y editable compartan el mismo modelo | Alto: ya es la base. Hoy `DataTable` lo encierra detrás de 57 props |
| **Compound components y slots** | Raíz pequeña + subcomponentes (`Collection.Toolbar`, `.Table`, `.Footer`, `.Empty`); los slots reciben render props tipadas | RC6 (props de un solo consumidor), RC4 (card por composición) | Alto: `EntityCard` ya es compound (F8) |
| **Registro abierto por aumentación de módulos** | `interface ValueKinds {}` en shared; cada feature añade `declare module '@/components/…' { interface ValueKinds { stage: StageOptions } }` y registra su renderer | RC1 sin modificar el núcleo; TY-4 | Alto; patrón nativo de TS (TanStack lo usa para `ColumnMeta`) |
| **Formatters puros + renderers** | Separar `format(value, opts) → string/parts` (puro, testeable) del componente visual | RC8 (formato disperso, `Intl` en línea); coherencia card ↔ tabla ↔ subtítulo | Alto; las reglas de `web-design-guidelines` piden `Intl.*` |
| **Odoo — vistas declarativas por modelo** | `list`/`kanban`/`form` por modelo; **registro abierto de widgets de campo**; en listas, `decoration-*` (estilo por predicado), `optional="show/hide"` (columnas opcionales), `sum="Total"` (pie de totales), `editable="bottom"` (edición de líneas); kanban con plantilla propia por modelo | RC1-C (variantes por predicado), pie de totales, columnas opcionales, edición de líneas (P1/P2), card por entidad (RC4), RC3 (vistas separadas por superficie) | Alto como modelo conceptual: **la semántica del campo vive en el modelo y cada vista declara su propio layout** |
| **ERPNext / Frappe** | `in_list_view`, configuración de lista por DocType, `formatters` por tipo de campo, `get_indicator` por DocType (estado con color y etiqueta derivados por documento) | Estado hub derivado por entidad (G), formatters por tipo | Medio |
| **WAI-ARIA APG** (Table, Grid, Disclosure, Treegrid) | Tabla semántica para lectura; grid solo con navegación por flechas; `aria-expanded` en filas expandibles; treegrid para árboles editables | §1 | Alto |

**Lectura común (DP para la Fase 4):** las cuatro referencias principales coinciden en **compartir la semántica del campo y declarar el layout por superficie**, en **registros abiertos** para tipos y widgets, y en **núcleos headless pequeños** con composición. Es la dirección de las hipótesis del §4 del prompt, ahora con evidencia de requisitos (`02`) detrás.

## 5. Resumen de restricciones para la Fase 4

| Grupo | IDs | Impacto en el diseño |
|---|---|---|
| Accesibilidad | AX-1 … AX-10 | Una sola `<table>`; acción por defecto como enlace real; sin interactivos anidados; celdas editables etiquetadas |
| Rendimiento | PF-1 … PF-6 | Paginación en servidor por defecto; virtualización opcional; definiciones estáticas |
| Tipado | TY-1 … TY-7 | Claves e identificadores literales; registro abierto por aumentación; tests de tipos |
| Edición (de `02` §4.3) | ED-1 … ED-9 | Superficie editable de primera clase para wizard/modal |
| Heredado (no se discute) | track B, `DESIGN.md`, `globals.css` | Tokens `--table-*`, cabecera canónica, hover único, `ariaLabel` |

## 6. Verificación

| Afirmación | Cómo |
|---|---|
| Reglas de la guía | `WebFetch` de `vercel-labs/web-interface-guidelines/main/command.md` (2026-10-17) |
| Hallazgos de accesibilidad | Lectura de `DataTable.tsx:596-675`, `:796-905`, `DataTableColumnHeader.tsx` completo, `EntityCard.tsx:55-95`; `grep` del §1.1 |
| Volúmenes | `psql` contra `ordenes_dump` (host) y `pg_stat_user_tables` en la BD de desarrollo (servidor remoto, Mutagen conectado) |
| Tamaños de página, virtualización, memoización | Comandos del §2.2 |
| Tipado | `package.json`, `tsconfig.json`, `grep "declare module\|ColumnMeta"`, `grep expectTypeOf` |
| No se ejecutaron tests ni perfilado | Explícito en el §2.2 (Pd para la Fase 5) |
