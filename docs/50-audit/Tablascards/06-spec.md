# 06 · Especificación y contratos (Fase 6)

> Fecha: 2026-10-17 · Rama `spike/entity-view-system` · ADR-0087 *Accepted* (Puerta C).
> Evidencia: **V** = Verificado (archivo:línea o salida real) · **P** = Probable · **Pd** = Pendiente · **D** = Decisión propuesta.
> Contrato normativo derivado: [`docs/20-contracts/component-entity-view.md`](../../20-contracts/component-entity-view.md). Esta especificación es la versión larga: justificación, tipos completos, piezas aún no implementadas y ejemplos. Si las dos discrepan, manda el contrato, y la discrepancia es un defecto que hay que corregir en este documento.

## 0. Resumen

- Se especifican las **cinco capas** (tipo de valor → formato → definición de entidad → estado de colección → superficie) con su API pública, sus reglas de resolución y lo que todavía falta construir.
- Los ejemplos completos cubren **UoM** (trivial), **OV** (documental, con líneas y despacho editable) y **Compras** (la más rígida, con modos).
- Se crea el contrato de capa 20 **`component-entity-view.md`**. `component-fields.md` y `component-datatable-views.md` pasan a *congelados* para código nuevo. `component-card.md` **no se toca**: describe el `Card` de shadcn, no la card de entidad (corrección a la hipótesis del prompt, §12).
- **Invariantes:**
  - la #13 se reescribe;
  - la #6 se amplía al barrel `@/components/entity-view`;
  - se corrige una desincronía previa: en `docs/README.md` la #13 era "Zero N+1", ahora pasa a #14 en las tres listas (§11).
- **Guardas implementadas y verificadas por mutación:** 4 reglas ESLint, 12 aserciones de contrato (techo de props, kinds del núcleo, ubicación y casts de entidades, congelación del sistema antiguo, ratchet de tablas ad hoc) y el patrón entre features `@/features/*/entity-view/*`.
- **Ajuste A1 llevado a producción:** `docRef` se exporta desde el barrel `@/features/documents`, y `orderLine.entity.ts` ya no hace un import profundo.

---

## 1. Ubicación, dependencias y barrel

| Ruta | Contenido | Puede importar |
|---|---|---|
| `components/entity-view/core/` | tipos, registro, formatters, `defineEntity`, `useEntityCollection` | `@/lib/money`, `@/lib/utils`, `@/lib/badge-resolvers` (tipos), `@tanstack/react-table` |
| `components/entity-view/kinds/` | renderers de los 13 kinds del núcleo | `@/components/shared` (`DataCell`, `StatusBadge`, `DomainHubStatus`) |
| `components/entity-view/surfaces/` | `Collection.*`, `EditableCollection`, `CollectionModes`, `EntityViewProvider` | `@/components/shared`, `@/components/ui/*`, `@/lib/entity-registry` |
| `components/entity-view/index.ts` | barrel único; registra los kinds del núcleo al importarse | — |
| `features/<f>/entity-view/*.entity.ts(x)` | definiciones de entidad | `@/components/entity-view`, tipos de la propia feature y barrels de otras features |
| `features/<f>/entity-view/*.kind.tsx` | extensiones de la feature | ídem + componentes de la propia feature |

**D-1 · Barrel (invariante #6).** `@/components/entity-view` es el **segundo barrel autorizado** junto a `@/components/shared`. Motivos:

- es un sistema con su propio ciclo de vida y su propio registro (el barrel ejecuta `registerCoreValueKinds()`);
- meterlo en `shared` mezclaría el sistema nuevo con el congelado durante la coexistencia;
- su núcleo **depende** de `shared` (`DataCell`, `EntityCard`, `StatusBadge`), así que reexportarlo desde `shared` crearía un ciclo.

La única referencia a una ruta interna es la aumentación de módulo `declare module "@/components/entity-view/core/value-kinds"`, que no es un import. Lo hacen cumplir la regla `entity-view/no-deep-import` (V, §9) y el texto nuevo de la invariante #6 (§11).

---

## 2. Capa 1 · Tipos de valor (registro abierto)

### 2.1 API pública (V: `core/value-kinds.ts`)

```ts
export type DecimalString = string            // DRF Decimal ("1250.00")
export type ISODate = string                  // "YYYY-MM-DD" o datetime ISO
export type FlowDirection = "inflow" | "outflow" | "neutral"
export type Surface = "table" | "card" | "kanban" | "export"
export type Align = "start" | "center" | "end"
export interface StatusValue { status: string; label?: string; intent?: BadgeIntent }

export interface ValueKinds { /* 13 kinds del núcleo, §2.2; abierto por aumentación */ }
export type ValueKind = keyof ValueKinds
export type KindValue<K extends ValueKind> = ValueKinds[K]["value"]
export type KindOptions<K extends ValueKind> = ValueKinds[K]["options"]

export interface ValueRenderProps<K extends ValueKind> {
    value: KindValue<K>; options: KindOptions<K>; surface: Surface; align: Align
    label: string                              // nombre accesible para widgets que lo necesitan
}
export interface ValueKindSpec<K extends ValueKind> {
    format: (value: KindValue<K>, options: KindOptions<K>) => string          // puro
    sortValue?: (value: KindValue<K>, options: KindOptions<K>) => string | number | null
    align?: Align
    render: ComponentType<ValueRenderProps<K>>
}
export function registerValueKind<K extends ValueKind>(kind: K, spec: ValueKindSpec<K>): void
export function getValueKind<K extends ValueKind>(kind: K): ValueKindSpec<K>   // lanza si no está registrado
```

### 2.2 Kinds del núcleo

La tabla completa (valor, opciones, alineación, orden) está en el contrato §2. Por qué cada uno está en el núcleo (evidencia de `02` §5.1, con el umbral ≥3 entidades de ≥2 features):

| Kind | Entidades (`02`) | Sustituye a |
|---|---|---|
| `text`, `code`, `date`, `money`, `status` | ~45–60 cada uno (C) | `text`/`secondary`, `code`, `date`/`dateTime`, `currency`, `status` |
| `number`, `quantity` | ~12 (F) | `number.suffix`, `numericFlow.unit` |
| `flow` | ~12 (F) | `currencyFlow`, flujos inline, NC sin signo |
| `dateRange` | ~6 (F) | dos campos o `computed` |
| `hubStatus` | 6 (F) | 2 `computed` por documento + columnas ocultas |
| `contact` | ~12 (F) | `contact` y contactos como texto |
| `tags` | ~7 (F) | `chip`, `chip-category` |
| `progress` | ~8 (F) | `computed`, texto "n/m" |

**Candidatos que aún no entran** (por debajo del umbral o sin consumidor migrado), a promover cuando cumplan la regla: saldo acumulado (4), cuotas n/m (4), vencido/días de atraso (3), valor compuesto (~14, P: se espera que lo cubran `subtitle`/`meta` de la card y un kind `text` con `secondary`; se medirá en la Fase 7).

### 2.3 Extensiones

Patrón obligatorio (A1, V: `features/documents/entity-view/docRef.kind.tsx`):

```tsx
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds { docRef: { value: DocRefValue | null; options: { fallback?: string } } }
}
let registered = false
export function registerDocumentValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("docRef", { format, sortValue, render: DocRefCell })
}
export function docRef<T>(f: FieldBuilders<T>, accessor: Accessor<T, DocRefValue | null>,
                         input: FieldMeta & { fallback?: string }): FieldDef<T, "docRef"> {
    registerDocumentValueKinds()
    return f.value("docRef", accessor, input)
}
```

Reglas:

- **E-1.** El constructor es la única vía pública. `f.value("docRef", …)` compila, pero se desaconseja fuera del archivo del kind. *Pd:* una regla de lint que lo prohíba si aparece algún uso.
- **E-2.** Se exporta por el barrel de la feature dueña (V: `features/documents/index.ts`, añadido en esta fase).
- **E-3.** El nombre del kind es único en el repositorio: la aumentación de módulo detecta una colisión de tipos al compilar (P: TS fusiona las interfaces y falla si dos declaraciones dan tipos distintos a la misma clave).
- **E-4.** `render` recibe `label` y debe exponerlo si el widget no tiene texto propio (AX-7).

### 2.4 R7 · Registro sin cast correlacionado (especificado; lote 1)

Hoy `getValueKind` usa un `as unknown as` documentado (TS#30581). Especificación del reemplazo:

```ts
type Registry = { [K in ValueKind]?: ValueKindSpec<K> }
function lookup<K extends ValueKind>(r: Registry, k: K): Registry[K] { return r[k] }   // sin cast
```

Si TS sigue sin estrechar `Registry[K]` a `ValueKindSpec<K> | undefined`, el cast **se queda en un único punto** con test de tipos (aceptable: es un puente interno, no un escape de entidad). Criterio de aceptación: 0 casts fuera de `value-kinds.ts` y `define-entity.ts#splitMeta`. El contexto de colección también tiene uno (`Collection.tsx:99`) y se reemplaza por `createCollectionContext<T>()`, un contexto por instancia genérica.

---

## 3. Capa 2 · Formato

### 3.1 API (V: `core/formatters.ts`)

| Función | Firma | Reglas |
|---|---|---|
| `EMPTY` | `"—"` | marcador único de dato ausente (R2 lo lleva a `DataCell`) |
| `toNumber` | `(Numeric) => number \| null` | `""`, `null`, `undefined`, `NaN` e infinitos → `null`; **`0` es un valor** |
| `isMissing` | `(unknown) => boolean` | `null`, `undefined`, `""`, `[]`. **`false` y `0` no son ausencia** |
| `formatText` | `(v, prefix?)` | |
| `formatNumber` | `(v, decimals = 0, suffix?)` | es-CL vía `formatQuantity` |
| `formatMoneyValue` | `(v, currency = "CLP", sign)` | `never` → valor absoluto; `always` → "+" en positivos |
| `formatFlow` | `(v, direction, currency)` | inflow "+", outflow "−" (U+2212), neutral sin signo; usa el valor absoluto |
| `formatDate` | `(iso, time?)` | date-only **nunca** se desplaza de zona (`formatPlainDate`, GOVERNANCE #47); datetime en hora local `HH:mm` |
| `formatDateRange` | `({from,to})` | `to` nulo o igual a `from` → una fecha |
| `formatStatus` | `(StatusValue)` | `label ?? translateStatus(status)` |
| `formatProgress` | `(v, "percent" \| "ratio")` | `total ≤ 0` en porcentaje → `EMPTY` |
| `formatTags` | `(string[])` | unidos con ", " |

### 3.2 Reglas

- **F-1. Una sola fuente:** la celda, la card, el subtítulo, el texto accesible, el orden por defecto y la exportación usan el mismo `spec.format`. La regla `entity-view/no-adhoc-format` prohíbe `Intl.*` y `toLocale*String` en el código de entity-view fuera de `formatters.ts` (V).
- **F-2. Coherencia entre superficies:** como el kind se decide por campo y no por superficie, un mismo campo **no puede** formatearse distinto en la tabla y en la card. La Fase 8 añade el test que lo recorre (§13).
- **F-3. Deuda heredada:** `DataCell.Currency` pinta los negativos como "$-48.000" (`05` §5.3 P5), mientras que `formatMoneyValue` delega en `formatMoney`. *Pd (lote 1, con R1/R2):* unificar el signo en `lib/money` para que el texto y la celda coincidan.
- **F-4. Matriz de casos límite para la Fase 8:**
  - `null`, `undefined`, `""`, `0`, `"0.00"`, `false` (en `text`);
  - fechas inválidas (`"2026-13-45"`) y datetimes sin zona;
  - CLP sin decimales, USD con 2;
  - `progress` con total 0;
  - `dateRange` abierto.

---

## 4. Capa 3 · Definición de entidad

### 4.1 API pública (V: `core/define-entity.ts`)

```ts
export type KeysOfType<T, V> = { [P in keyof T]-?: T[P] extends V ? P : never }[keyof T] & string
export type Accessor<T, V> = KeysOfType<T, V> | ((row: T) => V)
export type RowAware<O, T> = { [P in keyof O]: O[P] | ((row: T) => O[P]) }

export interface FieldMeta { label: string; header?: string; sortable?: boolean; align?: Align }
export type FieldDef<T, K extends ValueKind = ValueKind> = FieldMeta & {
    readonly kind: K; readonly accessor: Accessor<T, KindValue<K>>; readonly options: RowAware<KindOptions<K>, T>
}
export interface FieldBuilders<T> {
    value<K extends ValueKind>(kind: K, accessor: Accessor<T, KindValue<K>>, input: FieldMeta & RowAware<KindOptions<K>, T>): FieldDef<T, K>
    text(…): FieldDef<T, "text">  /* … uno por kind del núcleo … */  progress(…): FieldDef<T, "progress">
}

export interface EntitySpec<T, F extends FieldMap<T>> {
    label: string                                  // → EntityLabel (R8)
    fields: F
    facets?: Record<string, (row: T) => string | null | undefined>
    export?: ExportSpec<Record<string, unknown>>
    rowId?: (row: T) => string | number
}
export interface Entity<T, F> extends EntitySpec<T, F> {
    readonly ids: readonly FieldId<F>[]
    field<Id extends FieldId<F>>(id: Id): F[Id]
    views<V extends ViewsInput<T, FieldId<F>>>(views: V): { table: BoundTableLayout<FieldId<F>> | undefined; card: V["card"] }
}
export function defineEntity<T>(): <F extends FieldMap<T>>(build: (f: FieldBuilders<T>) => EntitySpec<T, F>) => Entity<T, F>
```

El currying `defineEntity<T>()(…)` existe para fijar `T` explícitamente y dejar que `F` se infiera: TS no admite inferencia parcial de genéricos.

### 4.2 Reglas

- **D-2. Convención de archivo** `features/<f>/entity-view/<entidad>.entity.ts(x)`. Lo verifica el test de contrato (V). Una entidad puede tener varias variantes de vista (`orderLineViews.sale/.purchase`) en el mismo archivo.
- **D-3. Tipos con firma de índice** (`OrderLine`): `keyof` no se estrecha, así que todos los campos usan accesor función (V: `orderLine.entity.ts`). Se documenta como limitación conocida; la solución de fondo es tipar el serializer (Pd-backend/tipos).
- **D-4. Facetas ≠ columnas:** las facetas son dimensiones `(row) => string`. Las 3 columnas ocultas de Compras desaparecen (V).
- **D-5. Modos:** no son parte de la entidad. Cada modo es otra entidad (`purchaseInvoiceEntity`), y la pantalla los combina con `CollectionModes` (§6.5).
- **D-6. Exportación:** `export: { useExport, formats }`. El hook es de la feature (`export-formats.md`: un hook por exportación). La barra le pasa los filtros vigentes (`Collection.Toolbar exportFilters`). El backend genera el archivo. *Pd-backend:* no existe `/export/` de listas.

### 4.3 R8/A2 · Etiqueta tipada (especificado; lote 1)

```ts
// lib/entity-registry.ts
export const ENTITY_REGISTRY = { … } as const satisfies Record<string, EntityMetadata>
export type EntityLabel = keyof typeof ENTITY_REGISTRY
// define-entity.ts
export interface EntitySpec<T, F> { label: EntityLabel; … }
// value-kinds.ts
hubStatus: { …; options: { entity: EntityLabel; caption: StatusValue } }
// EntityViewProvider
interface EntityOpener { open(label: EntityLabel, id: number, row: unknown): void; labelOf(label: EntityLabel): string | undefined }
```

Criterio: `label: "inventory.uomx"` no compila. Se añade como test de tipos nº 17. Riesgo TY-7: con ~80 claves, la unión no debería pesar, pero se mide el tiempo de `tsc` antes y después (línea base de esta fase: **23,7 s** de reloj para `npx tsc --noEmit -p tsconfig.json` con Node 24 local, V).

---

## 5. Capa 4 · Estado de colección

### 5.1 API (V: `core/use-entity-collection.ts`)

`CollectionSource<T>`, `CollectionPagination` y `CollectionOptions` están en el contrato §5. Resultado:

```ts
export interface EntityCollection<T, F> {
    entity: Entity<T, F>
    table: Table<T>                 // TanStack: una columna por campo; cada superficie elige cuáles muestra
    status: "loading" | "error" | "empty" | "ready"
    isRefetching: boolean
    total: number                   // rowCount del servidor o filas locales
    paginated: boolean
    refetch?: () => void
    isFiltered: boolean
}
```

### 5.2 Reglas

- **S-1.** Las columnas TanStack se derivan de **todos** los campos (`accessorFn = sortValueOf`). La superficie decide cuáles muestra; el orden funciona sobre cualquier campo, aunque no se vea.
- **S-2.** `status` se calcula con precedencia `isLoading` → `error` → `rows.length === 0` → `ready`.
- **S-3.** Con paginación en servidor, `manualPagination` + `rowCount`. Sin `rowCount`, el total cae a `rows.length`. *D:* la Fase 7 convierte `rowCount` en obligatorio en el tipo cuando `mode: "server"` (unión discriminada en `CollectionSource`) para que el error "Página 1 de NaN" (TC-032) no pueda compilar. La regla `pagination/datatable-needs-rowcount` cumple esa función hoy en el sistema antiguo.
- **S-4.** Selección: estado TanStack (`rowSelection`). El modo lo decide `Collection.Root selection`.

### 5.3 Estado en la URL y búsqueda (especificado; Fase 7, antes de migrar documentos)

ADR-0022 exige que filtros, orden y página vivan en la URL. El spike usa estado local (`05` §8). Especificación:

```ts
// core/use-collection-url-state.ts (nuevo)
export interface CollectionUrlState<Id extends string> {
    view: "table" | "card"; sort: SortSpec<Id> | undefined
    pagination: PaginationState
}
export function useCollectionUrlState<Id extends string>(
    entity: { ids: readonly Id[] },
    defaults: { view?: "table" | "card"; sort?: SortSpec<Id>; pageSize?: number },
): [CollectionUrlState<Id>, (next: Partial<CollectionUrlState<Id>>) => void]
```

| Parámetro | Clave URL | Compatibilidad |
|---|---|---|
| vista | `?view=` | la misma clave que `useViewMode` (`component-datatable-views.md` §5) |
| orden | `?ordering=` (`campo` o `-campo`) | el formato DRF; el id de campo se traduce con `serverSortKey` (opción nueva del campo; por defecto la clave del accesor si es una clave) |
| página | `?page=`, `?page_size=` | `pagination-contract.md` |

- `useEntityCollection` acepta `{ sorting: { state, onChange } }`, igual que la paginación, para que la página conecte el estado de la URL. Un id que no pertenece a la entidad se **descarta** en lugar de propagarse.
- La búsqueda y los filtros siguen en `UnifiedSearchBar`, que va en `Collection.Toolbar children`. Las facetas de la entidad (D-4) alimentan sus opciones (*Pd:* adaptador `facetsToSearchConfig(entity)`).
- La vista por defecto sale de `defaultView`. `viewPolicy` del registro se muda a la definición al migrar (ADR-0087 §7).

---

## 6. Capa 5 · Superficies

### 6.1 Composición y techo de props

Las props de cada componente están en el contrato §6. Techo: **≤ 12**, verificado por test (V). Medición actual:

| Componente | Props |
|---|---|
| `Root` | 8 |
| `Toolbar` | 3 |
| `View` | 4 |
| `EditableCollection` | 7 |
| `CollectionModes` | 4 |

Una necesidad nueva se resuelve por este orden:

1. un **slot o hijo** existente (`Toolbar children`, `CardSection custom`, `actions`);
2. una **superficie de la feature** que consume `EntityCollection<T, F>` (el modelo tipado) y compone `FieldValue`;
3. si la usan ≥3 entidades de ≥2 features, un **componente nuevo del núcleo**. Nunca una prop nueva en uno existente si eso rompe el techo.

### 6.2 Tabla

- **T-1.** Una `<table>` con `aria-label`, `aria-busy`, `thead` fijo, `th scope="col"` y `aria-sort` (V: `Collection.tsx:254-276`).
- **T-2.** Las celdas y cabeceras se alinean según la regla R-6 (§7).
- **T-3.** La celda principal es un `Button` que abre la fila. Con R1 llevará el renderer completo dentro: hoy es texto plano porque `DataCell` renderiza un `div`.
- **T-4.** Acciones de fila con `actions(row)`, usando `ROW_ACTIONS` (`component-row-actions.md`), en la última columna con cabecera `sr-only` "Acciones".
- **T-5.** Pie de totales con `footer.sum`, agrupado por opciones resueltas (R-9).
- **T-6.** Densidad: tokens `--table-*` (compact/comfortable). R3 sustituye el parche `h-7` y el margen negativo.

### 6.3 Card

- **K-1.** Slots fijos (`media`, `title`, `subtitle`, `meta`, `trailing`, `body`) sobre `EntityCard`. Nada se infiere: un campo que no está en ningún slot no aparece.
- **K-2.** Toda la card es una región. El enlace es el título. El checkbox de selección lleva etiqueta propia (`Seleccionar {título}`). No hay interactivos anidados (AX-4).
- **K-3.** `hubStatus` en `trailing` baja bajo el título cuando la card mide menos de 28rem (consulta de contenedor; V, `05` §5.3).
- **K-4.** Grilla con `minmax(0, 1fr)` y 0 desbordes a 390 px (V, 42 capturas).
- **K-5.** R4 lleva `selectionLabel` y `EntityCard.Meta` al shell compartido y permite borrar `CardMeta` y el checkbox propios del spike.

### 6.4 Superficie editable

Especificada en el contrato §6.4 y verificada en el spike (play de story + jsdom). Reglas que nacen del spike:

- **ED-1.** Sin `min`/`max` nativos.
- **ED-2.** Eligibilidad = la declarada ∧ tope > 0.
- **ED-3.** `editableSchema` añade un error raíz si no hay ninguna cantidad ("Ingresa al menos una cantidad").
- **ED-4.** Los decimales del input salen de `step`: `step ≥ 1` → 0 decimales.
- **ED-5.** Pendiente de la crítica: primera columna fija a 390 px y foco en el primer error al enviar (AX-6).

### 6.5 Modos y provider

- **`CollectionModes`:** cada modo es un `render()` con su propio `Root`. La clave `key={value}` remonta el estado al cambiar de modo. La sincronización con `?view_mode=` la hace la página (D).
- **`EntityViewProvider`:** se monta **una vez** en `app/(dashboard)/layout` (o el provider global equivalente) con `opener.open = openEntity` del `GlobalModalProvider` y `labelOf = getEntityMetadata(label)?.title`. *Pd lote 1:* montarlo en producción. Hoy solo existe en las stories (`stories/withEntityView.tsx`).

### 6.6 Requisitos F/E aún no prototipados: cómo se resuelven por composición (D)

| Requisito (`02`) | Resolución | Por qué no es una prop |
|---|---|---|
| Agrupación (C, 31 vistas) | `Collection.Grouped` (núcleo, ≥3 features): recibe `groupBy: Id` y una función de etiqueta y pinta secciones con su propio encabezado. **En servidor** (PF-5, Pd-backend) para no repetir el tope de 200 | Cambia la estructura del cuerpo de la tabla y de la grilla |
| Fila expandida (F, 4) | `TableLayout.expand?: ComponentType<{ row: T }>` (campo de layout, no prop), con botón `aria-expanded` + `aria-controls` (AX-9) | Es layout de tabla, igual que `columns` |
| Árbol (E, 4) | Superficie de la feature sobre `collection.table` con `getSubRows` | Específico |
| Panel de analítica (F, 15) | Hermano de `Collection.View` dentro del `Root`, con `StatCard` y datos de un hook de la feature | No depende de las filas visibles |
| Kanban/timeline OT (E, 1) | Superficie de `features/production` que recibe `EntityCollection<WorkOrder>` y usa `FieldValue` para las cards | Un solo consumidor |
| Selección masiva + acciones (F, 7) | `selection="bulk"` + `Collection.BulkBar children` (hijo, a crear con el primer consumidor) | Acciones del dominio |
| Saldo acumulado (F, 4) | Lo calcula el backend (Pd-backend); en el front es `money`. Si no, un kind de feature | Depende del orden del servidor |
| Edición inline persistente (E, 1) | Kind de la feature con `render` editable (`EditableQtyCell`) | Un solo consumidor |
| Conciliación con arrastre (E, 1) | Superficie de `features/finance` | Dos colecciones coordinadas |

---

## 7. Reglas de resolución deterministas

Normativas en el contrato §7 (R-1…R-10). Pseudocódigo de referencia (V: `define-entity.ts#resolveField/sortValueOf/alignOf`, `Collection.tsx#FieldValue/formatSum`):

```
resolve(def, row, surface):
  spec    ← registry[def.kind]                     ; no registrado → error (no hay fallback)
  value   ← accessor(row) | row[accessor]
  options ← map(def.options, o ⇒ isFunction(o) ? o(row) : o)
  text    ← spec.format(value, options)            ; = export = subtítulo = nombre accesible
  sort    ← spec.sortValue?(value, options) ?? text  ; nulos al final (sortUndefined: "last")
  align   ← def.align ?? spec.align ?? "start"
  node    ← <spec.render value options surface align label=def.label/>
  header  ← def.header ?? def.label
```

**Prioridad de los overrides** (de mayor a menor):

1. opción por fila (función) sobre opción constante;
2. `def.align` sobre `spec.align`;
3. `layout.primary` sobre la primera columna;
4. `media.iconFor` sobre `media.icon`, y este sobre el icono del registro, y este sobre el icono genérico.

No existe ningún otro override: **ni por superficie ni por rol**. Si una superficie necesita otro formato del mismo dato, son **dos campos** con nombres distintos (p. ej. `total` y `totalSigned`). Así la divergencia queda visible y revisable.

**Card:**

- `title` → texto del renderer dentro del enlace;
- `subtitle` → `text` de cada campo unido por " · " (sin renderer, para que sea una sola línea);
- `meta` → pares `label: renderer`;
- `trailing` → renderer;
- `body` → la sección resuelta con los mismos campos.

---

## 8. Estados

Precedencia y comportamiento en el contrato §8. Copy (V: `Collection.tsx:196-217`):

| Estado | Título | Descripción | Acción |
|---|---|---|---|
| error | "No pudimos cargar {label en minúsculas}" | "Revisa tu conexión e intenta nuevamente." (nunca el código HTTP crudo) | "Reintentar" si hay `refetch` |
| empty filtrado | "Ningún resultado para el filtro" | "Prueba con otros términos o limpia los filtros." | — (la barra de búsqueda ofrece limpiar) |
| empty | `emptyTitle` o el defecto de `EmptyState` para `entityLabel` | `emptyDescription` | — (*Pd:* slot de acción "Crear" en `Collection.View`, dentro del techo de props) |

Invariante #8 cumplida: los componentes del núcleo manejan loading, empty y error. Los errores de red los sigue notificando el hook de la feature con `showApiError` (GOVERNANCE #28); la superficie solo muestra el estado.

---

## 9. Accesibilidad

| Requisito (`03`) | Implementación | Estado |
|---|---|---|
| AX-1 tabla única + `scope` | `Collection.Table` | V |
| AX-2 `aria-sort`, iconos `aria-hidden` | ídem | V |
| AX-3 acción por defecto real | celda principal `Button` / título de card | V (R1 para el renderer completo) |
| AX-4 sin interactivos anidados | card con checkbox etiquetado fuera del enlace | V (R4 en el shell) |
| AX-5 `aria-busy` + anuncio de resultados | `aria-busy` V · *Pd:* región `aria-live` "23 resultados" en `Toolbar` | parcial |
| AX-6 editables con nombre, error y foco | nombre, `aria-invalid` y `aria-describedby` V · foco en el primer error Pd | parcial |
| AX-7 estado no solo por color | `StatusBadge` con texto; `hubStatus` con `caption`; `progressbar` | V |
| AX-8 `aria-rowcount` con servidor | *Pd* (con §5.3) | Pd |
| AX-9 expansión | §6.6 | Pd |
| AX-10 táctil/POS | sin cambios en el spike | Pd |
| Navegación por teclado entre filas | crítica `05` §5.1 h7 | Pd |

---

## 10. Rendimiento y tipado

**Rendimiento** (`03` PF-1…6):

- PF-3 se cumple por convención y por estructura: las definiciones son de módulo y las columnas se memoizan por entidad.
- *Pd lote 1:* fila memoizada (`React.memo` por `row.id`) en tabla y editable, contexto memoizado y `accessorFn` barato con `sortingFn` semántico solo en la columna ordenada (`05` §7).
- Línea base PF-6 (100 filas × 12 columnas, 50 cards) frente al sistema antiguo: **Pd**, se mide al migrar la primera entidad documental con el Profiler de React en Storybook.

**Tipado:** 16 configuraciones inválidas rechazadas (V: `define-entity.types.test.ts`):

- clave inexistente;
- clave de tipo incompatible;
- id inexistente en `columns`, `primary`, `defaultSort`, `footer.sum`, `title`, `subtitle`, `meta`, `trailing`, `body`, `.without()` y `context`;
- opción desconocida;
- `flow` sin `direction`;
- `hubStatus` sin `caption`;
- `CardTone` inválido.

Pendientes: nº 17 (`label` no registrado, R8) y nº 18 (`mode: "server"` sin `rowCount`, S-3). Tiempo de `tsc`: línea base 23,7 s (§4.3).

---

## 11. Gobierno: invariantes, contratos y documentación

### 11.1 Invariantes (D, cubiertas por ADR-0087 §9; invariante #12)

**#6 (ampliada):**
> **Shared components imported via barrel only** — `@/components/shared` and `@/components/entity-view`, never a file path. The only exception is module augmentation of `@/components/entity-view/core/value-kinds` by feature value kinds.

**#13 (nueva redacción):**
> **Entity collections are declared once and composed per surface** — fields live in `defineEntity<T>()` (`features/*/entity-view/*.entity.ts`) and every table, card grid, embedded list and batch-edit table is rendered with `@/components/entity-view`. Specific needs are feature value kinds or typed card sections, never opaque escapes (`computed`, `renderCard`, inline JSX columns, `as unknown as`). The legacy system (`*Fields.ts`, `toColumns()`, `AutoEntityCard`, `DataTable`) is frozen until its last consumer migrates. See [component-entity-view.md](docs/20-contracts/component-entity-view.md) (ADR-0087).

**#14 (corrección de desincronía, V):** `docs/README.md` numeraba "Zero N+1" como #13 y omitía la regla de `*Fields.ts`, mientras que `CLAUDE.md` tenía la de `*Fields.ts` como #13 y omitía N+1. Las dos listas decían "the same 13". "Zero N+1" ya es la regla autoritativa GOVERNANCE #43, y pasa a ser la #14 en las tres listas. No es una regla nueva: solo se sincronizan los encabezados.

### 11.2 Documentación actualizada en esta fase

| Documento | Cambio |
|---|---|
| `docs/20-contracts/component-entity-view.md` | **nuevo** contrato normativo |
| `docs/20-contracts/component-fields.md` | aviso de *congelado*; sigue rigiendo a los consumidores antiguos |
| `docs/20-contracts/component-datatable-views.md` | aviso: la API de autoría queda congelada; §5 (`?view=`) y §10 (tokens) se heredan |
| `docs/20-contracts/component-contracts.md#datacell-primitives` | nota: `DataCell` pasa a ser primitiva de renderer de los kinds; cambios R1/R2 pendientes |
| `docs/20-contracts/component-decision-tree.md` | rama "colección de una entidad" → entity-view; las tablas crudas, solo en reportes |
| `docs/30-playbooks/add-feature.md` | paso 4 reescrito + sección **4c "Dar de alta la presentación de una entidad"** |
| `CLAUDE.md`, `docs/README.md` | invariantes #6, #13 y #14; fila de enrutamiento a `component-entity-view.md` |
| `docs/90-governance/GOVERNANCE.md` | §4.1 reescrita (reglas 24–26); regla 23 alineada con el gobierno de kinds |
| `docs/10-architecture/adr/0087-entity-view-system.md` | registro del resultado de la Fase 6 |
| `frontend/components/entity-view/README.md`, `index.ts` | estado *Accepted*, puntero al contrato, `docRef` por barrel |

`component-card.md` **no** se modifica: documenta el `Card` de shadcn.

---

## 12. Guardas mecánicas (implementadas)

| Guarda | Archivo | Verificación |
|---|---|---|
| 4 reglas `entity-view/*` (§contrato 9) | `frontend/eslint-rules/entity-view-guards.mjs` + `eslint.config.mjs` | V: un archivo sonda dispara las 4 (`no-legacy-presentation` 1:10, `no-deep-import` 3:1, `no-adhoc-format` 5:22 y 6:18, `no-adhoc-table` 7:30). El spike pasa limpio |
| Patrón `@/features/*/entity-view/*` en los dos bloques de imports entre features | `eslint.config.mjs` | V en archivos `.ts` |
| Test de contrato (12 aserciones) | `frontend/lib/__tests__/entity-view.contract.test.ts` | V: 12/12 en verde. **Mutación:** bajar los techos (12→7, 57→56, 12→11, 22→21, 15→14) hace fallar 5 aserciones y una tabla sonda en `features/` hace fallar el ratchet |

Comandos (Node 24 local, `PATH=/home/pato/.nvm/versions/node/v24.18.0/bin:$PATH`, desde `frontend/`):

```
npx vitest run --project '!storybook' lib/__tests__/entity-view.contract.test.ts components/entity-view   # 44/44
npx eslint components/entity-view features/*/entity-view features/documents/index.ts lib/__tests__/entity-view.contract.test.ts eslint-rules/entity-view-guards.mjs .storybook
npx tsc --noEmit -p tsconfig.json                                                                       # 0 errores
```

**Hallazgo nuevo (TC-034, V):** en los `.tsx` de `features/`, la guarda de imports entre features **no se aplica**. El bloque "UI component data fetching" (`eslint.config.mjs`, `files: ["components/**/*.tsx", "features/**/*.tsx"]`) redefine `no-restricted-imports` solo con la restricción de TanStack, y la configuración plana se queda con la última definición. Sonda: `import { useUoMs } from "@/features/inventory/hooks/useUoMs"` da error en `zzProbe.ts` y pasa en `zzProbe2.tsx`. Efecto en este sistema: `Purchasing.stories.tsx` (→ `billing`) y `SaleOrder.stories.tsx` (→ `orders`) importan entidades de otra feature por ruta profunda sin aviso. **No se corrige en esta fase**, porque arreglarlo puede destapar violaciones existentes en todo `features/**/*.tsx`. Se propone como tarea propia: fusionar los dos bloques en uno y medir con `npx eslint features --rule …`.

---

## 13. Coexistencia y migración (entrada a la Fase 7)

### 13.1 Adaptador `fromLegacyFields()` (especificado)

```ts
export function fromLegacyFields<T>(fields: LegacyEntityFields<T>, label: EntityLabel): Entity<T, FieldMap<T>>
```

| `FieldType` antiguo | kind | Notas |
|---|---|---|
| `text` / `secondary` | `text` (`tone`) | |
| `code` | `code` | |
| `date` / `dateTime` | `date` (`time`) | |
| `currency` | `money` | |
| `currencyFlow` | `flow` | `direction` desde la función de la opción antigua |
| `number` / `numericFlow` | `number` / `quantity` | `suffix`/`unit` → `uom` |
| `status` | `status` | |
| `contact` | `contact` | |
| `chip` / `chip-category` | `tags` (`domain`) | |
| `sourceDest` | — | **no adaptable** → `docRef` o kind de la feature |
| `computed` | — | **no adaptable** → el adaptador lanza un error de tipos y la entidad se migra a mano |

`placement`/`fieldRole`/`weight` → `views()`:

- `title` → `card.title`;
- `subtitle` → `card.subtitle`;
- `header` → `card.trailing`;
- `detail` → solo `table.columns`;
- orden de columnas = orden de declaración.

El resultado se **revisa a mano** (es una migración asistida, no un modo de compatibilidad permanente). El adaptador se borra con el último `*Fields.ts`.

### 13.2 Orden de lotes (≤5 entidades, Puerta D antes de cada uno)

| Lote | Contenido | Causa raíz que ataca |
|---|---|---|
| 1 | R1–R5 (`DataCell` `align`/`span`/`—`, regla Fitts, `EntityCard` selección/meta, `getHubStatuses` tipado) + R7 + R8 + `EntityViewProvider` en el shell + `useCollectionUrlState` (§5.3) | prerrequisitos; elimina los parches del spike |
| 2 | Compras (órdenes + notas), OV, UoM, Productos: lo prototipado | RC1, RC4, RC5 |
| 3 | Líneas de documento (OV/OC/factura, `orderLineFields`) + P1 (`DeliveryDrawer`, `Step3_Delivery`, `ReceiptModal`, `Step4_Receipt`) | RC3 (placement), tablas crudas P1 |
| 4+ | Por causa de rigidez (`01` §3): documentos con hub, tesorería con flujo, maestros simples con `fromLegacyFields()` | — |
| R6 | ADR de color aparte (contraste warning/success) | independiente |

Ciclo por lote: el del prompt (§4 Fase 7). Cada archivo que sale del sistema antiguo se **quita de `ADHOC_TABLE_ALLOWLIST`** si tenía una tabla cruda, y los techos de props bajan cuando se elimina una prop antigua.

---

## 14. Ejemplos completos (3 entidades)

Los tres compilan y tienen stories en verde en el spike. Las vistas muestran el patrón de producción: hook de feature + URL (§5.3, se marca donde aún no existe).

### 14.1 UoM — trivial (V: `features/inventory/entity-view/uom.entity.ts`)

```ts
import { defineEntity, type StatusValue } from "@/components/entity-view"
import type { UoM } from "../hooks/useUoMs"

const UOM_TYPE: Record<UoM["uom_type"], StatusValue> = {
    REFERENCE: { status: "INFO", label: "Referencia" },
    BIGGER: { status: "SUCCESS", label: "Mayor" },
    SMALLER: { status: "WARNING", label: "Menor" },
}

export const uomEntity = defineEntity<UoM>()((f) => ({
    label: "inventory.uom",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        abbreviation: f.code("abbreviation", { label: "Abreviación" }),
        category: f.text("category_name", { label: "Categoría", tone: "secondary" }),
        type: f.status((u) => UOM_TYPE[u.uom_type], { label: "Tipo" }),
        ratio: f.number("ratio", { label: "Ratio", decimals: (u) => (Number(u.ratio) % 1 === 0 ? 0 : 3) }),
    },
}))

export const uomViews = uomEntity.views({
    table: { columns: ["name", "abbreviation", "category", "type", "ratio"], defaultSort: "name" },
    card: { title: "name", subtitle: ["abbreviation", "category"], trailing: ["type"] },
})
```

```tsx
// features/inventory/components/UoMCollection.tsx
export function UoMCollection() {
    const { uoms, isLoading, isFetching, error, refetch } = useUoMs()           // hook de feature (inv. #5)
    const collection = useEntityCollection(uomEntity, { rows: uoms, isLoading, isRefetching: isFetching, error, refetch },
        { defaultSort: uomViews.table.defaultSort })
    return (
        <Collection.Root collection={collection} actions={(u) => <UoMRowActions uom={u} />}>
            <Collection.Toolbar />
            <Collection.View table={uomViews.table} card={uomViews.card} />
        </Collection.Root>
    )
}
```

Antes: 52 + 11 + 2 columnas inline y un campo duplicado. Después: 21 + ~9 líneas, 0 escapes (`05` §3.1).

### 14.2 OV — documental, con líneas y despacho editable

Entidad (V: `features/sales/entity-view/saleOrder.entity.ts`): folio, cliente, fecha, `hubStatus` con `caption: orderStageSummary`, canal, líneas, total, pendiente, facetas de pago y despacho, y exportación. Card: `media.tone` por fila y cuerpo `workflow`.

Líneas (V: `features/orders/entity-view/orderLine.entity.ts`, ahora con `docRef` desde el barrel):

```ts
import { defineEditable, defineEntity, toNumber } from "@/components/entity-view"
import { docRef } from "@/features/documents"
…
const lineTable = orderLineEntity.views({
    table: { columns: ["product", "quantity", "unitPrice", "delivered", "workOrder", "subtotal"], footer: { sum: ["subtotal"] } },
}).table
export const orderLineViews = { sale: lineTable, purchase: lineTable.without("workOrder") }

export const deliveryLinesEditable = defineEditable(orderLineEntity, {
    rowKey: (l) => l.id,
    context: ["description", "quantity", "pending"],
    inputs: { toDeliver: { kind: "quantity", header: "A despachar",
        label: (l) => `Cantidad a despachar — ${l.product_name ?? l.description ?? `línea ${l.id}`}`,
        max: (l) => Math.max(0, qty(l.quantity) - qty(l.quantity_delivered)),
        step: (l) => (l.uom_name === "Unidad" ? 1 : 0.01),
        initial: (l) => Math.max(0, qty(l.quantity) - qty(l.quantity_delivered)),
        unit: (l) => l.uom_name ?? l.unit_name } },
    eligible: (l) => (l.requires_advanced_manufacturing && !l.work_order_summary ? { ok: false, reason: "Requiere producción" } : { ok: true }),
    footer: { sum: ["toDeliver"] },
    bulk: ["fillToMax", "clear"],
    bulkLabels: { fillToMax: "Despachar todo lo pendiente" },
})
```

Vistas:

```tsx
// Lista de OV (Pd §5.3: useCollectionUrlState)
export function SaleOrderCollection() {
    const [url, setUrl] = useCollectionUrlState(saleOrderEntity, { sort: saleOrderViews.table.defaultSort })
    const { orders, count, isLoading, isFetching, error, refetch } = useSaleOrders({ ordering: url.sort, page: url.pagination })
    const { openHub, selectedId } = useOrderHub()
    const collection = useEntityCollection(saleOrderEntity,
        { rows: orders, rowCount: count, isLoading, isRefetching: isFetching, error, refetch },
        { pagination: { mode: "server", state: url.pagination, onChange: (p) => setUrl({ pagination: p }) } })
    return (
        <Collection.Root collection={collection} selection="panel" selectedId={selectedId} onOpen={openHub} defaultView={url.view}>
            <Collection.Toolbar exportFilters={url}><UnifiedSearchBar config={saleOrderSearch} /></Collection.Toolbar>
            <Collection.View table={saleOrderViews.table} card={saleOrderViews.card} />
        </Collection.Root>
    )
}

// Líneas en la ficha
<Collection.Root collection={useEntityCollection(orderLineEntity, { rows: order.lines }, { pagination: { mode: "none" } })} label="Productos de la orden">
    <Collection.View table={orderLineViews.sale} />
</Collection.Root>

// Despacho (DeliveryDrawer): schema.ts → editableSchema(deliveryLinesEditable, lines)
const form = useForm({ resolver: zodResolver(z.object({ lines: editableSchema(deliveryLinesEditable, lines) })),
                       defaultValues: { lines: initialEditableValues(deliveryLinesEditable, lines) } })
<Controller control={form.control} name="lines" render={({ field }) => (
    <EditableCollection definition={deliveryLinesEditable} rows={lines} value={field.value} onChange={field.onChange}
        errors={editableErrorsFromForm(form.formState.errors.lines, field.value)} label="Cantidades a despachar" />)} />
```

Antes: 96 + 28 + 29 (columnas de notas duplicadas) y 3 `computed`, más `orderLineFields` con 2 `computed`, 7 `placement: 'detail'` y el bug TC-012. Después: 35 + 62 líneas, 0 escapes.

### 14.3 Compras — la más rígida, con modos (V: `purchaseOrder.entity.ts`, `billing/entity-view/purchaseInvoice.entity.ts`)

- Órdenes: facetas de recepción, facturación y tesorería como dimensiones, en lugar de 3 columnas ocultas.
- Notas: entidad propia con NC con signo negativo (`f.money(signed, …)`) y tono por tipo de DTE.

Pantalla:

```tsx
export function PurchasingDocumentsView() {
    const [mode, setMode] = useViewModeParam<"orders" | "notes">("view_mode", "orders")  // URL, página
    return (
        <CollectionModes label="Documentos de compra" value={mode} onChange={setMode} modes={{
            orders: { label: "Órdenes", render: () => <PurchaseOrderCollection /> },
            notes: { label: "Notas", render: () => <PurchaseNoteCollection /> },
        }} />
    )
}
```

Cada `*Collection` sigue el patrón de §14.2. `purchaseInvoiceEntity` se exportará desde el barrel `@/features/billing` al migrar, y hoy la story la importa por ruta profunda (TC-034). Antes: 65 + 48 + 46 + 125 líneas, 2 `computed`, 3 columnas ocultas, 6 duplicadas y una vista de 881 líneas. Después: 40 + 23 + ~25 líneas, y 1 cast heredado que desaparece con R5 (lo permite la allowlist del test de contrato).

---

## 15. Decisiones de esta fase y preguntas para el usuario

| ID | Decisión (D) | Alternativa descartada |
|---|---|---|
| D-1 | `@/components/entity-view` como segundo barrel autorizado (inv. #6) | Reexportar desde `shared`: ciclo de dependencias y mezcla con lo congelado |
| D-2 | Convención `features/<f>/entity-view/<entidad>.entity.ts(x)`, verificada por test | Libre: rompe el descubrimiento por agentes y las guardas por ruta |
| D-5 | Modos = una entidad por modo + `CollectionModes` | Un campo "modo" en la entidad |
| D-6 | Exportación = hook de la feature declarado en la entidad | `useExport` genérico (prohibido por `export-formats.md`) |
| §7 | Sin overrides por superficie: dos formatos implican dos campos | Override por superficie, que reabre la incoherencia de formato |
| §11 | Desincronía de la #13 corregida con una #14 "Zero N+1" en las tres listas | Dejar `docs/README.md` distinto de `CLAUDE.md` |
| §12 | TC-034 se registra y no se corrige aquí | Corregirlo ya: puede destapar violaciones fuera del alcance |

**Respuestas (2026-10-17): las tres aprobadas.** TC-034 → issue #176.

Preguntas:

1. ¿Apruebas la nueva redacción de las invariantes **#6** y **#13**, y la sincronización de **"Zero N+1" como #14** en `CLAUDE.md`, `docs/README.md` y `GOVERNANCE.md`?
2. ¿El **lote 1** de la Fase 7 incluye, además de R1–R5, **R7, R8, el `EntityViewProvider` en el shell y `useCollectionUrlState`**? Sin el estado en la URL no se puede migrar ninguna lista documental sin perder ADR-0022.
3. ¿Abro una tarea aparte para **TC-034** (guarda de imports entre features que no se aplica en los `.tsx` de `features/`)?
