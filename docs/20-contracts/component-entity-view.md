---
layer: 20-contracts
doc: component-entity-view
status: active
owner: frontend-team
created: 2026-10-17
last_review: 2026-10-18
stability: stable
adr: 0087
supersedes_for_new_code:
  - component-fields.md
  - component-datatable-views.md (authoring API; visual tokens §10 still apply)
  - component-contracts.md#datacell-primitives (as an authoring surface; DataCell stays the renderer primitive)
depends_on:
  - component-contracts.md
  - component-skeleton.md
  - entity-identity.md
  - document-relations.md
  - export-formats.md
  - pagination-contract.md
---

# Contrato: entity-view — presentación de colecciones de una entidad

> **Código:** `frontend/components/entity-view/` (barrel `@/components/entity-view`) · **ADR:** [0087](../10-architecture/adr/0087-entity-view-system.md) · **Especificación completa y justificación:** [`docs/50-audit/Tablascards/06-spec.md`](../50-audit/Tablascards/06-spec.md) · **Guía rápida:** `frontend/components/entity-view/README.md`

Este contrato rige **todo código nuevo o migrado** que presenta una colección de una entidad: tabla, cards, listas embebidas en drawers o fichas y tablas editables de wizards y modales. El sistema anterior (`createEntityFields` + `toColumns()` + `AutoEntityCard` + `DataTable`/`DataTableView`) está **congelado** (§10): sigue funcionando para las pantallas no migradas, pero no admite consumidores, props ni `FieldType` nuevos.

## 1. Las cinco capas

| Capa | Qué decide | API | Dónde vive |
|---|---|---|---|
| 1 · Tipo de valor | Qué **es** el dato (dinero, fecha, referencia…) y cómo se formatea, ordena y pinta | `interface ValueKinds`, `registerValueKind`, `ValueKindSpec` | núcleo: `core/value-kinds.ts` + `kinds/core-kinds.tsx`; extensiones: la feature dueña |
| 2 · Formato | Texto del valor: único para celda, card, subtítulo, orden, nombre accesible y exportación | `format*` puros, `EMPTY = "—"` | `core/formatters.ts` |
| 3 · Definición de entidad | Campos semánticos de la entidad, una sola vez | `defineEntity<T>()`, `f.<kind>()`, `views()`, `.without()` | `features/<f>/entity-view/<entidad>.entity.ts(x)` |
| 4 · Estado de colección | Orden, paginación, selección y estado (headless, TanStack Table) | `useEntityCollection` | `core/use-entity-collection.ts` |
| 5 · Superficie | Layout de tabla, card, modos y edición por lote | `Collection.*`, `EditableCollection`, `CollectionModes`, `EntityViewProvider` | `surfaces/` |

**Regla P5:** la semántica (capas 1–3) se comparte entre superficies; el **layout no**. El orden de columnas y la composición de la card se declaran por separado en `views()`.

## 2. Tipos de valor del núcleo

| Kind | Valor | Opciones (constante o `(row) => …`) | Alineación | Orden |
|---|---|---|---|---|
| `text` | `string \| null` | `tone: "default" \| "secondary"`, `truncate` | start | texto |
| `code` | `string \| number \| null` | `prefix` | start | texto |
| `number` | `number \| DecimalString \| null` | `decimals`, `suffix` | end | numérico |
| `quantity` | `number \| DecimalString \| null` | `uom`, `decimals` | end | numérico |
| `money` | `number \| DecimalString \| null` | `currency` (CLP), `sign: "auto" \| "always" \| "never"` | end | numérico |
| `flow` | `number \| DecimalString \| null` | **`direction`** (`inflow` \| `outflow` \| `neutral`), `currency` | end | con signo |
| `date` | `ISODate \| null` | `time` | start | ISO |
| `dateRange` | `{ from, to } \| null` | — | start | `from` |
| `status` | `StatusValue \| null` (StatusBadge) | — | center | `status` |
| `hubStatus` | fila del documento | **`entity`**, **`caption: StatusValue`** (obligatoria) | start | texto de `caption` |
| `contact` | `{ id, name } \| null` | — | start | `name` |
| `tags` | `readonly string[] \| null` | `domain` | start | texto |
| `progress` | `{ done, total } \| null` | `format: "percent" \| "ratio"` | start | `done/total` |

**Gobierno (Puerta B):** un kind entra al núcleo **solo** cuando lo usan ≥3 entidades de ≥2 features. Si no, es una **extensión de la feature** (§3). El conjunto del núcleo lo fija `lib/__tests__/entity-view.contract.test.ts` (`CORE_KINDS`).

## 3. Extensiones por feature (sin tocar el núcleo)

Una extensión tiene tres partes y vive en `features/<dueña>/entity-view/<kind>.kind.tsx`:

1. **Aumentación del módulo** `@/components/entity-view/core/value-kinds` con `interface ValueKinds { miKind: { value; options } }`. Es la única referencia permitida a una ruta interna del sistema, y no es un import.
2. **Registro idempotente** con `registerValueKind("miKind", { format, sortValue?, align?, render, inline? })`. `inline` es un renderer que solo usa contenido de frase (`span`); se usa cuando el valor va dentro de un enlace o botón, como la celda principal. Sin él, ahí se muestra el texto formateado. En el núcleo lo tienen `text` y `code`.
3. **Constructor de campo** `miKind<T>(f, accessor, input)` que llama al registro y devuelve `f.value("miKind", …)`. **Es la única forma pública de declarar el campo**: un campo no puede existir sin su kind registrado (A1).

El constructor se exporta por el **barrel de la feature dueña**. Otra feature lo importa de `@/features/<dueña>`, nunca de `@/features/<dueña>/entity-view/*` (invariante #3; lo bloquea ESLint).

**Si otra feature declara entidades con el kind** (como `docRef`), el constructor va en un módulo **sin imports en tiempo de ejecución** (`<kind>.ts`, solo tipos y `f.value(…)`). Es la **primera** exportación del barrel. El registro (`<kind>.kind.tsx`) se importa como efecto del mismo barrel y se ejecuta al evaluarse. Así, una definición que se evalúa dentro de un ciclo de imports que pasa por el barrel encuentra el constructor inicializado (lote 3a). Llegar al constructor implica evaluar el barrel, y por tanto el registro: se mantiene la garantía A1.

Extensiones vigentes: `docRef` (`@/features/documents`, referencia a documento o entidad con `DocumentRefLink`) y `productPrice` (`features/inventory`, local a productos).

## 4. Definición de entidad

```ts
export const uomEntity = defineEntity<UoM>()((f) => ({
    label: "inventory.uom",                          // etiqueta del ENTITY_REGISTRY: icono, drawer, URL
    fields: {
        name: f.text("name", { label: "Nombre" }),
        ratio: f.number("ratio", { label: "Ratio", decimals: (u) => (Number(u.ratio) % 1 === 0 ? 0 : 3) }),
    },
    facets?: { … },                                  // dimensiones de filtro, independientes de las columnas
    export?: { useExport, formats },                 // hook de la feature (export-formats.md)
    rowId?: (row) => …,                              // por defecto row.id
}))
export const uomViews = uomEntity.views({ table: { … }, card: { … } })
```

Reglas:

- **Archivo:** `features/<feature>/entity-view/<entidad>.entity.ts` (`.tsx` solo si declara JSX: icono por fila, sección `custom`, extensión local). `defineEntity<…>` fuera de esa ruta rompe el test de contrato.
- **Estático a nivel de módulo** (PF-3): la entidad y sus `views` se crean una vez, nunca dentro de un componente.
- **Accesor:** una clave de `T` cuyo tipo es compatible con el valor del kind, o una función `(row) => valor`. Una clave inexistente o de tipo incompatible no compila (TY-1/TY-2).
- **Ids de campo:** unión literal inferida. `columns`, `primary`, `defaultSort`, `footer.sum`, `title`, `subtitle`, `meta`, `trailing`, las secciones del cuerpo, `.without()` y `context` de `defineEditable` solo aceptan esos ids (TY-3). TC-012 no puede repetirse.
- **`label`:** etiqueta del tipo `EntityLabel` (unión de las claves de `ENTITY_REGISTRY`, R8): una etiqueta no registrada no compila. La identidad (nombre, icono, URL canónica, drawer) se queda en el registro; la presentación (`viewPolicy`, `cardConfig`, `workflow`, `partnerField`) se muda a la definición conforme migra cada entidad.
- **Colecciones embebidas sin ficha propia** (p. ej. líneas de documento, que no están en el registro): en lugar de `label` se declara `title` (la identidad es una unión discriminada `label` | `title`: una de las dos, nunca ambas) (nombre accesible, p. ej. "Líneas"). Sin `label` no hay acción por defecto (solo `onOpen` explícito) ni icono del registro.
- **Sin escapes opacos:** no hay `computed`. Lo específico es un kind de la feature (§3) o una sección `custom` de card (§6.3). `as any`, `as unknown as` y `: any` están prohibidos en entidades (test de contrato, con una deuda permitida hasta R5).

## 5. Estado de colección — `useEntityCollection(entity, source, options?)`

| `source` (`CollectionSource<T>`) | Tipo | Notas |
|---|---|---|
| `rows` | `readonly T[] \| undefined` | **obligatorio**; viene de un hook de feature (invariante #5) |
| `isLoading` / `isRefetching` | `boolean` | carga inicial / refetch con datos visibles |
| `error` | `unknown` | cualquier valor no nulo activa el estado de error **si no hay filas** (con filas en caché se siguen mostrando) |
| `rowCount` | `number` | total del servidor; **obligatorio** con paginación en servidor, y también al agrupar una página acotada (activa el aviso de truncado) |
| `refetch` | `() => void` | habilita "Reintentar" en el estado de error |
| `isFiltered` | `boolean` | cambia el copy del vacío ("Ningún resultado para el filtro") |

| `options` | Valores |
|---|---|
| `pagination` | `{ mode: "client", pageSize? }` (defecto, 20) · `{ mode: "server", state, onChange }` · `{ mode: "none" }` |
| `sorting` | `{ mode: "local" }` (defecto con paginación cliente o sin paginar: ordena las filas cargadas con la clave semántica del kind) · `{ mode: "server", state: SortSpec \| null, onChange }`. Con paginación en servidor y sin `sorting`, **ninguna cabecera se puede ordenar** |
| `defaultSort` | `"id"` o `"-id"` (ids tipados; solo en orden local) |
| `groupBy` | id de campo o `null`: agrupa las filas cargadas por el texto formateado del campo |

PF-1: documentos, movimientos, contabilidad y crédito paginan **en servidor**. La paginación en cliente se admite solo en maestros pequeños (< ~1 000 filas).

**Orden en servidor** (Puerta D lote 2). Una lista paginada en servidor **también ordena en servidor**: si ordenara solo la página visible, mentiría.
- El campo declara su clave del backend con `orderBy` (por ejemplo `f.quantity(…, { orderBy: "annotated_current_stock" })`). En modo servidor, solo los campos con `orderBy` se pueden ordenar.
- La página guarda el `SortSpec` y lo traduce con `orderingParam(entity, spec)` (`"-stock"` → `"-annotated_current_stock,-id"`, con desempate estable por `id`) para el hook de la feature.
- El viewset expone `filters.OrderingFilter` con `ordering_fields` como lista blanca, y documenta el parámetro en `api-contracts.md`.
- Sin `ordering` se conserva el orden del servidor, y ninguna cabecera afirma un orden.
- Si la página tiene datos renderizados en servidor (`initialData`), solo valen para la consulta por defecto: TanStack Query usaría `initialData` para cualquier clave nueva y nunca haría la petición.

**Página por forma de consulta:** `useServerPage(shape, initial)` devuelve `[page, setPage]` y vuelve a `initial` cuando cambia la forma (filtros, orden, agrupación).

**Agrupación.** Usa `groupItems` (`lib/group-utils`), igual que las vistas agrupadas actuales: claves ordenadas y valores vacíos en un último grupo "Sin {campo}". Agrupar desactiva la paginación: la página carga una sola página acotada a `GROUP_ROW_LIMIT` (200) con `pagination: { mode: "none" }` y pasa `rowCount`. Si el total supera lo cargado, `Collection.View` muestra el aviso "Agrupando los primeros N de M resultados". La agrupación en servidor queda como Pd-backend (PF-5). Las claves de agrupación de `UnifiedSearchBar` se traducen a ids de campo en la página.

## 6. Superficies

Todo componente del núcleo tiene **≤ 12 props** (test de contrato). Lo que no cabe se **compone** (slots, hijos, superficie propia de la feature), nunca se añade como prop.

### 6.1 `Collection.Root` / `Toolbar` / `View` / `Table` / `Grid`

| Componente | Props |
|---|---|
| `Collection.Root` | `collection`, `children`, `actions?: (row, surface: "table" \| "card") => ReactNode`, `onOpen?: (row) => void`, `selection?: "none" \| "bulk" \| "panel"`, `selectedId?`, `defaultView?`, `view?` + `onViewChange?` (vista controlada), `label?` |
| `Collection.Toolbar` | `children?` (búsqueda `UnifiedSearchBar`), `action?` (acción primaria, p. ej. crear; en pantallas angostas baja bajo la búsqueda en vez de taparla — lote 2c), `views?`, `exportFilters?` |
| `Collection.View` | `table?`, `card?`, `emptyTitle?`, `emptyDescription?`, `emptyAction?` (p. ej. crear), `onResetFilters?` ("Limpiar filtros" en el vacío filtrado): elige la superficie activa |
| `Collection.Table` / `Collection.Grid` | la superficie concreta, para pantallas con una sola vista. Con `groupBy` pintan un `<tbody>` por grupo con su cabecera `th scope="rowgroup"` (tabla) o una sección con encabezado (cards) |
| `Collection.BulkBar` | `actions: BulkAction<T>[]`: el mismo tipo y la misma barra (`SelectionDock`) que el sistema antiguo; aparece con la selección (`selection="bulk"`) |
| `Collection.Analytics` | `children`: añade la vista "Analítica" al selector de la barra (modo `analytics`, `?view=analytics`). Mientras está activa, su contenido reemplaza la tabla o las cards. El contenido es de la feature (p. ej. `AnalyticsPanelContent`) |

**Ancho de columnas (sin scroll horizontal):** un kind declara `shrink: true` si su valor puede encogerse con elipsis (`text`, `contact`; el renderer trunca y deja el texto completo en `title`). En la tabla, esas columnas encogen (`max-w-0`) y las demás se ajustan a su contenido (`w-px`, `nowrap`). La columna principal conserva un mínimo (`min-w-28`), así encogen antes las otras. Solo hay scroll horizontal si las columnas fijas no caben.

**Acciones de fila por superficie:** `actions={xActions.forCollection(ctx)}` (`createEntityActions`). En la tabla, si hay una sola acción visible se muestra `ActionSingle`; si hay varias, el menú kebab (lo mismo que `.auto()`). En la card se usa `.render`. La barra de `BulkBar` es el `SelectionDock` compartido (`components/shared/ActionDock.tsx`), el mismo que usa `DataTable`.

### 6.2 `TableLayout`

`columns` (orden explícito) · `primary?` (columna que abre la fila; por defecto la primera) · `defaultSort?` · `footer?: { sum? }`. `.without(...ids)` produce variantes (líneas de OV con OT, líneas de OC sin ella).

### 6.3 `CardLayout` (slots, sin inferencia)

`title` (1 campo; enlace a la ficha) · `subtitle?` (unidos con " · ") · `meta?` (pares etiqueta/valor bajo la cabecera) · `trailing?` (estado o KPI a la derecha) · `media?` (`icon`, `iconFor(row)`, `tone` (`CardTone` o función por fila), `image(row)`, `avatar`) · `body?`:

| Sección | Para |
|---|---|
| `{ kind: "workflow", total, pending?, date?, lines? }` | documentos (líneas / total / pendiente) |
| `{ kind: "metrics", fields }` | KPIs de la fila |
| `{ kind: "progress", field }` | avance |
| `{ kind: "custom", component }` | visual de dominio, **tipado** (`ComponentType<{ row: T }>`) y dentro de la feature |

`CardTone`: `"default" | "primary" | "info" | "success" | "warning" | "destructive" | "muted"`.

### 6.4 `EditableCollection` + `defineEditable`

Cubre los patrones P1 (cantidad a procesar por línea) y P2 (reparto contra un tope) de wizards y modales.

- **Definición** (`defineEditable(entity, spec)`, en `core/define-editable.ts`): `rowKey`, `context` (ids de campo de solo lectura), `inputs` (`kind: "quantity" | "money"`, `header`, `label(row)` (nombre accesible), `min?`, `max?(row)`, `step?(row)`, `initial?(row)`, `unit?(row)`, `check?(row, value)`), `eligible?(row)`, `processed?`, `rowStatus?(row, values)`, `footer.sum?`, `bulk?: ["fillToMax", "clear"]`, `bulkLabels?`.
  - `processed`: los inputs que procesan la fila (la cantidad, no su costo unitario). Cuentan para "al menos una", para el tope "sin pendiente" y para las ayudas masivas: "Limpiar" no borra el costo. Por defecto, todos.
  - `check`: regla de dominio de la celda además del tope (p. ej. "Stock insuficiente (3 disponibles)"). Corre dentro del schema de zod, así que el resolver sigue siendo la única validación.
  - `rowStatus`: estado de la fila derivado de lo ingresado (Completo, Parcial, Excede pendiente). Se pinta con `StatusBadge` en una columna "Estado".
  - Una definición que se usa en otra feature se declara junto a su entidad y se lee al llamarla (schema, render), nunca a nivel de módulo: así no lee una entidad que un ciclo de imports todavía está evaluando (lote 3a).
- **Props del componente:** `definition`, `rows`, `value`, `onChange`, `errors?`, `label`, `disabled?`.
- **Formulario:** react-hook-form + `zodResolver(editableSchema(def, rows))` (invariante #9). El resolver es la **única** validación. Los errores llegan con `editableErrorsFromForm(form.formState.errors.<campo>, value)`.
- **Foco:** `form.handleSubmit(onValid, () => focusFirstEditableError())` lleva el foco a la primera celda inválida (AX-6). La primera columna queda fija al desplazar en horizontal.
- **Prohibido:** `min`/`max` nativos en el `<input>`. La validación del navegador bloquea el submit antes de que corra el resolver. El tope se muestra como pista "Máx. N".
- Una fila con tope 0 o no elegible queda deshabilitada y con su motivo. El pie agrupa los totales por unidad o moneda y excluye las celdas inválidas.

### 6.5 `CollectionModes` y `EntityViewProvider`

- **`CollectionModes`** (`modes`, `value`, `onChange`, `label`): pantallas que cambian de entidad (órdenes ↔ notas). Cada modo monta su propio `Collection.Root` con su propia entidad: así no hace falta ningún cast (TY-5, TC-018).
- **`EntityViewProvider`** (`opener: { open(label, id, row), labelOf(label) }`): montado **una vez** por `GlobalModalProvider` (vía `components/providers/EntityViewBridge.tsx`) alrededor de la página **y** del host de drawers, de modo que las colecciones dentro de un drawer también abren sus filas. El contexto vive en `components/providers/EntityOpenerContext.tsx`, que solo depende de React; así se evita el ciclo con `@/components/shared` y el barrel no entra en el bundle raíz. `@/components/entity-view` lo reexporta. Conecta la acción por defecto con `openEntity` y el registro de drawers (ADR-0028/0086), y el nombre accesible con `titlePlural` del registro. Sin provider y sin `onOpen`, la celda principal no se muestra como enlace.
- **`useCollectionViewMode(label, defaultView?)`** → `{ view, onViewChange }` para `Collection.Root`. Da paridad con el sistema actual: el mismo parámetro `?view=` (`list` ↔ `table`, `card` ↔ `card`) y la misma preferencia guardada que `useViewMode`. Los filtros siguen en `UnifiedSearchBar` (hijo de `Toolbar`) y la selección en `?selected=` vía `selectedId`.

## 7. Reglas de resolución (deterministas)

Para un campo `def`, una fila `row` y una superficie `s`:

1. `value = typeof accessor === "function" ? accessor(row) : row[accessor]`.
2. `options` = cada opción evaluada contra `row` si es una función, o tomada tal cual si es constante.
3. `spec = getValueKind(def.kind)`. Si el kind no está registrado, se lanza un error. No hay renderer de respaldo.
4. **Texto** = `spec.format(value, options)`. Es el mismo texto para el subtítulo, el nombre accesible, la exportación y, si no hay `sortValue`, el orden.
5. **Orden** = `spec.sortValue?.(value, options) ?? texto`. Los nulos van siempre al final.
6. **Alineación** = `def.align ?? spec.align ?? "start"`. Cabecera y celda comparten la misma alineación.
7. **Render** = `<spec.render value options surface={s} align label={def.label} />`. Un valor ausente se pinta como `EMPTY` ("—") en tono secundario, igual en todos los kinds.
8. **Cabecera** = `def.header ?? def.label`. **Ordenable** = `def.sortable ?? true`.
9. **Pie** (`footer.sum`): se suman los valores numéricos **agrupados por las opciones resueltas** (unidad, moneda). Nunca se suman unidades distintas ("600 Hoja · 5 Millar").
10. **Celda principal** = `layout.primary ?? columns[0]`. Es un botón o enlace real que abre la fila (`onOpen` o, si no hay, `opener.open` cuando la entidad tiene `label`). Dentro va `spec.inline` si el kind lo declara; si no, el texto formateado. Su altura es la natural: la tabla lleva `data-density="compact"`, que con puntero fino exime a sus botones de la regla Fitts. Con puntero táctil se mantienen los 40 px (GOVERNANCE #17).

No existe inferencia por rol, por regex de nombre de clave ni por capacidad de zona: lo que no se declara no se muestra.

## 8. Estados y accesibilidad

**Precedencia de estados:** `loading` → `ready` (hay filas) → `error` → `empty`. Un refresco en segundo plano que falla con datos en caché **no** tapa la lista: el estado de error solo aparece sin filas (paridad con `DataTableView`; enmienda de ADR-0087, 2026-10-18). `isRefetching` no cambia el estado: mantiene los datos visibles con `aria-busy`.

**Paginación en cliente:** la página no se reinicia sola cuando llega un array de filas nuevo (`autoResetPageIndex: false`, como el `DataTable` antiguo); si un filtro acorta la lista, se muestra la última página existente. Así una vista puede filtrar en el render sin entrar en bucle.

| Estado | Comportamiento |
|---|---|
| loading | skeleton por columna con la altura real de la fila (sin salto de layout); en cards, skeleton de card |
| error | dentro del marco, con copy operativo y "Reintentar" si hay `refetch` |
| empty | `EmptyState`; copy distinto si `isFiltered` |
| ready | la superficie elegida |

**Accesibilidad por construcción:**

- **AX-1:** una única `<table>` con `<th scope="col">` y cabecera fija.
- **AX-2:** `aria-sort` en la columna ordenada; iconos con `aria-hidden`.
- **AX-3:** la acción por defecto es un botón o enlace real. El clic en la fila es un atajo, no la única vía.
- **AX-4:** sin interactivos anidados en cards; el checkbox de selección es el de `EntityCard` con `selectionLabel` ("Seleccionar {título}").
- **AX-5:** `aria-busy` durante la carga y el refetch.
- **AX-6:** inputs editables con nombre derivado de la fila, `aria-invalid` y `aria-describedby` (error, pista o motivo).
- **AX-7:** `progress` expone `role="progressbar"`, y el estado nunca se comunica solo por color.
- `role="table"` (no `grid`) también en densidad compact.

## 9. Guardas mecánicas

| Guarda | Qué impide | Dónde |
|---|---|---|
| `entity-view/no-legacy-presentation` | Que el código construido con entity-view importe `createEntityFields`, `AutoEntityCard`, `DataTable`, `DataTableView` o las factories de card | `frontend/eslint-rules/entity-view-guards.mjs` |
| `entity-view/no-adhoc-format` | `Intl.*` y `toLocale*String` en código de entity-view fuera de `core/formatters.ts` | ídem |
| `entity-view/no-adhoc-table` | `<table>` o `@/components/ui/table` en código de entity-view fuera del núcleo | ídem |
| `entity-view/no-deep-import` | Importar `@/components/entity-view/<ruta>` fuera del sistema (invariante #6). Las stories pueden usar `…/stories/*` | ídem |
| Patrón `@/features/*/entity-view/*` | Importar la extensión de otra feature sin pasar por su barrel | `eslint.config.mjs`, bloques de importación entre features |
| Techo de 12 props | Monolito por props | `lib/__tests__/entity-view.contract.test.ts` |
| `CORE_KINDS` | Kinds del núcleo añadidos sin evidencia de gobierno | ídem |
| Ubicación de entidades y prohibición de casts | `defineEntity` fuera de `features/*/entity-view/*.entity.ts(x)`; `as any` y `as unknown as` | ídem |
| Congelación del sistema antiguo | Que crezcan `DataTableProps` (57), `DataTableViewProps` (12), `AutoEntityCardProps` (22) o `FieldType` (15) | ídem |
| Ratchet de tablas ad hoc | Tablas crudas nuevas en `features/` o `app/` (23 archivos en la lista, que solo puede encoger) | ídem |
| Ratchet de consumidores antiguos | Un archivo nuevo que use `createEntityFields`, `toColumns()`, `AutoEntityCard`, `DataTable` o `DataTableView`; o una entrada de `LEGACY_CONSUMERS` que ya migró | ídem + `lib/__tests__/entity-view.legacy-consumers.ts` |
| Tests de tipos | 16 configuraciones inválidas rechazadas en compilación | `components/entity-view/__tests__/define-entity.types.test.ts` |

"Código construido con entity-view" = un archivo bajo `components/entity-view/` o `features/*/entity-view/`, o que importa `@/components/entity-view`.

## 10. Coexistencia con el sistema antiguo

- **Congelado:** `createEntityFields`/`*Fields.ts`/`toColumns()`, `AutoEntityCard`, `DataTable`/`DataTableView` y `renderCard`/`renderCustomView`. No admiten props, `FieldType` ni consumidores nuevos. Siguen rigiéndose por [component-fields.md](./component-fields.md) y [component-datatable-views.md](./component-datatable-views.md) mientras tengan consumidores.
- **Se heredan sin cambios:** los tokens de densidad `--table-*`, la cabecera canónica, el hover único y los bordes, sombras y radios (`component-datatable-views.md` §10); `StatusBadge` como único renderer de estado; `ROW_ACTIONS` para las acciones de fila y de card (`component-row-actions.md`); y `EntityCard` como shell visual.
- **Migración:** por oleadas (Fase 7 replanificada, `docs/50-audit/Tablascards/07-migration-matrix.md` §6) con la receta de §10.2. No hay adaptador en tiempo de ejecución: `fromLegacyFields()` se descartó (2026-10-18) porque perdía el tipado de los ids. El ratchet `LEGACY_CONSUMERS` (§9) solo puede encoger, y el sistema antiguo se retira cuando queda vacío (precedente: ADR-0072).

### 10.1 Capacidades aún no disponibles en entity-view

Mientras falte una capacidad, la pantalla que la necesita **se queda en el sistema antiguo sin ampliarlo**, o la capacidad se añade **aquí** dentro de un lote de la Fase 7.

| Capacidad | Estado | Lote |
|---|---|---|
| Paridad de URL con el sistema actual: `?view=` (`useCollectionViewMode`), filtros de `UnifiedSearchBar` (nuqs) y `?selected=` (ADR-0020) | **hecho** | lote 1 |
| Orden y página en la URL (hoy son estado local también en el sistema antiguo) | mejora opcional (`06-spec.md` §5.3) | — |
| Agrupación, panel de analítica, acciones masivas, orden en servidor | **hecho** | lote 2a |
| Foco del hub: con `selection="panel"` y `selectedId`, las cards no seleccionadas se atenúan | **hecho** | lote 2b |
| Filas expandibles, kanban/timeline | especificado como composición (`06-spec.md` §6.6) | por demanda |
| Exportación real | el hook existe; falta el endpoint (Pd-backend) | — |
| `label` tipado (R8), contexto y registro con un único puente cada uno (R7), provider en el shell | **hecho** | lote 1 |

### 10.2 Receta de migración (una pantalla del sistema antiguo → entity-view)

Se migra **con el comportamiento de hoy** (paridad). Las mejoras se registran y se hacen aparte.

**1. Campos: `*Fields.ts` → `features/<feature>/entity-view/<entidad>.entity.ts`.** Se reescribe a mano; las claves pasan a ser accesores tipados.

| `type` antiguo | Builder | Notas |
|---|---|---|
| `text` / `secondary` | `f.text` (`tone: "secondary"`) | |
| `code` | `f.code` | |
| `date` / `dateTime` | `f.date` (`time: true`) | |
| `currency` | `f.money` | `currency` por fila si hacía falta |
| `currencyFlow` | `f.flow` | `direction` como opción por fila |
| `number` / `numericFlow` | `f.number` / `f.quantity` | `suffix`/`unit` → `uom` |
| `status` (+ `getLabel`) | `f.status((r) => ({ status, label }))` | siempre `StatusBadge` |
| `contact` (+ `getDisplay`) | `f.contact((r) => ({ id, name }))` | |
| `chip` / `chip-category` | `f.tags` (`domain`) | |
| `sourceDest`, referencia a documento | `docRef(f, …)` de `@/features/documents` | |
| `computed` | kind existente con accesor, o kind de la feature (§3) | nunca JSX en la definición |
| `placement` / `fieldRole` / `meta.title` | `views()`: `title`/`subtitle`/`trailing` de la card; `columns` en el orden de hoy | |
| `tableOptions.enableSorting: false` | `sortable: false` | |
| columna en línea de la vista | un campo más de la entidad | |

**2. Pantalla.** Dos patrones de referencia; se copia el que corresponda:

| Patrón | Referencia | Piezas |
|---|---|---|
| Maestro con datos en cliente | `features/inventory/components/UoMClientView.tsx` | `useEntityCollection(entity, { rows, isLoading, error, refetch, isFiltered })` · `Collection.Root selection="bulk" onOpen actions={xActions.forCollection(ctx)}` · `Collection.Toolbar action` + `UnifiedSearchBar {...bindUnifiedSearch(search)}` · `Collection.View table card empty*` · `Collection.BulkBar` |
| Documento con servidor | `features/purchasing/components/PurchaseOrdersView.tsx` | lo anterior + `useServerPage`, `sorting: { mode: "server" }` con `orderingParam`, `selection="panel"` con `useDocumentSheetRoute`, `groupBy` con `GROUP_ROW_LIMIT` |

Reglas de la pantalla:

- **Selección:** la columna `select` a mano, `renderCard` y `AutoEntityCard` desaparecen; las da `selection`.
- **Agrupación:** un mapa a nivel de módulo `const X_GROUPS: Record<string, FieldId<typeof xEntity.fields>>` traduce la clave de la búsqueda al campo.
- **Analítica:**
  - el armado vive en `components/<entidad>AnalyticsScreen.ts`, sin JSX: `buildXAnalyticsScreen(data, ui): AnalyticsPanelContentProps`;
  - las consultas se piden solo con la vista abierta (`enabled: view === "analytics"`);
  - se monta en `Collection.Analytics`.
- **Extensiones:** un kind usado por una sola entidad vive en su `.entity.tsx` (p. ej. `productPrice`). Uno usado desde otras features exporta un builder sin imports en tiempo de ejecución como primera exportación del barrel de la feature (p. ej. `docRef`).
- **Drawers, modales y confirmaciones** de la pantalla no cambian.

**3. Cierre.** Se borra el `*Fields.ts` (si no le quedan consumidores), se quita la pantalla de `LEGACY_CONSUMERS` (y de `ADHOC_TABLE_ALLOWLIST` si estaba), y se reporta `bash frontend/scripts/entity-view-progress.sh`.
