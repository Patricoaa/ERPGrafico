---
layer: 20-contracts
doc: component-collection-toolbar
status: active
owner: frontend-team
created: 2026-11-25
last_review: 2026-11-25
stability: evolving
adr: 0158
supersedes:
  - unified-searchbar.md (retirado en la etapa 5 de ADR-0158)
depends_on:
  - component-entity-view.md
  - export-formats.md
  - pagination-contract.md
  - component-modal.md
  - zero-n-plus-one-policy.md
---

# Contrato: barra de colección — buscar, filtrar, ordenar, agrupar, vista, exportar y analítica

Una sola barra para toda colección de entidad. **Fuente:** [ADR-0158](../10-architecture/adr/0158-barra-de-coleccion-unificada.md).

> **Estado por etapa.** Este contrato describe el destino. Cada sección indica desde qué etapa de ADR-0158 está vigente:
> - **E1** fila de filtros aplicados y exportación en menú;
> - **E2** analítica en modal;
> - **E3** `entity.query` y la barra de comandos;
> - **E4** endpoints `groups/` (hecho, piloto en órdenes de venta) y `facets/`;
> - **E5** limpieza.
>
> Etapa 5 cerrada: ninguna pantalla declara `unifiedSearchDef.ts`. `UnifiedSearchBar` queda solo como la caja de búsqueda de esta barra.
>
> **Migradas a la barra de comandos:**
> - órdenes de venta (`saleOrderEntity.query`, piloto de la etapa 3c);
> - oleada 3d-1 (ventas y compras): notas de venta, guías de despacho, devoluciones de venta, despachos y devoluciones, órdenes de compra, recepciones, devoluciones de compra y recepciones y devoluciones.
>
> Las notas de compra siguen con `purchaseInvoiceUnifiedSearchDef` de billing y migran con esa app.
>
> - modo cliente (3d-2): sesiones POS, terminales POS y suscripciones.
> - oleada 3d-3 (inventario): productos, movimientos, documentos y conteos (servidor); unidades, categorías de UdM, categorías, atributos, bodegas, reglas de precio y reporte de existencias (cliente).
>
> - oleada 3d-4 (tesorería, primera parte): movimientos de tesorería y bancarios, ventas y sincronizaciones de terminal (servidor); bancos, métodos de pago, cuentas, liquidaciones, proveedores y terminales de cobro (cliente).
> - oleada 3d-5 (tesorería, segunda parte): estados de cuenta y cargos no facturados de tarjetas, líneas de crédito, cheques y préstamos (cliente). Préstamos y cargos no facturados cargan en su primera vista (activos; cargos del mes).
> - oleada 3d-6 (contabilidad): asientos, documentos e importaciones RCV (servidor); plan de cuentas y cierres (cliente, árboles). Las ventas del RCV usan `rcvSaleQueryEntity`, que deriva de `rcvDocumentEntity` sin acuse ni estado: `useCollectionQuery` solo necesita `fields` y `query`.
> - resto (etapa 3 completa): facturas de venta y compra, notas de compra, órdenes de trabajo, usuarios y cuadre fiscal (servidor); contactos, RR.HH. (empleados, ausencias, movimientos, liquidaciones), listas de materiales, declaraciones, grupos, conceptos de nómina, tareas, auditoría, cartera, historial y lista negra de crédito, socios, distribuciones y cartolas (cliente). El cuadre fiscal sigue escribiendo sus filtros por defecto en la URL y pasa los conteos por `filterOptions`; las cartolas usan `bankStatementQueryEntity` (sin filtro de banco) dentro de un banco.
> - presupuestos (`accounting.budget`, 2026-11-26): migrados a la barra canónica en **modo servidor** — `budgetEntity.query` + `useCollectionQuery` + `useBudgets(query.params)`. El filtro de período escribe `start_date__gte`/`end_date__lte` y el orden y la paginación los resuelve `BudgetViewSet` (sin `sorting: "client"`). La fila abre una pestaña de registro y «Ver Ejecución» abre el panel `variant="execution"` (ADR-0152).
>
> En modo cliente, `search.filterFn` aplica el texto libre sobre todas las columnas primitivas y cada filtro `single`/`multi` comparando **la clave de la fila igual al parámetro**. Si el filtro no es una clave de la fila, o nómbralo como ella (`credit_risk_level`, `treasury_account`), o fíltralo a mano: si no, vacía la lista. Los `toggle` no los aplica.
>
> **Listas embebidas** (en un drawer, una pestaña o un modal sobre otra lista) usan la misma barra con `useCollectionQuery(entity, { urlPrefix })`: cada clave de URL lleva el prefijo (`ledger_search`, `ledger_ordering`), así que no choca con la lista de la página.
>
> | Lista | Prefijo |
> |---|---|
> | Libro mayor (contabilidad y ficha de cuenta) | `ledger_` |
> | Detalle de conteo | `count_` |
> | Actividad de sesión POS | `activity_` |
> | Movimientos / utilidades del socio | `mov_` / `dst_` |
> | Detalle de cartola | `line_` |
> | Panel de conciliación (una búsqueda para las dos listas y los conciliados) | `rec_` |
> | Modal de mapeo de cuentas | `map_` |
>
> El reporte de existencias embebido en la analítica de productos ignora el estado de la URL (que es de la lista de productos).

---

## 1. Anatomía

```
┌ ViewTabs ─────────────────────────────────────────────── 1–38 de 38 ┐   ← solo si query.views
│ [Search────────────] [⛛ 3] [⇅ Fecha ↓] [◇ Estado] [▦ Tabla] │ [📊] [⤓] [+ Nueva nota] │
└ AppliedFilters: (Estado: 2 ×) (Fecha: Este mes ×) (Agrupado por Estado ×)  Limpiar todo ┘
```

Las piezas tienen orden fijo. Cada una aparece solo si la entidad la declara:

| Pieza | Aparece si | Etapa |
|---|---|---|
| `ViewTabs` | `query.views` tiene ≥ 2 vistas | E3 |
| `Search` | `query.search` | E3 (antes: `UnifiedSearchBar`) |
| `FilterMenu` | `query.filters` | E3 |
| `SortMenu` | `query.sort` | E3 |
| `GroupMenu` | `query.groupBy` | E3 |
| `DisplayMenu` | más de un layout en `viewPolicy`, o columnas ocultables | E3 |
| `AnalyticsButton` | hay un hijo `Collection.Analytics` | E2 |
| `ExportMenu` | `entity.export` | E1 |
| `action` | prop de `Collection.Toolbar` | — |
| `AppliedFilters` | hay algún filtro, búsqueda o grupo activo | E1 |

La página **no** arma la barra:

```tsx
<Collection.Root collection={collection} label="Notas de venta">
  <Collection.Toolbar action={<ToolbarCreateButton … />} />
  <Collection.View table={views.table} card={views.card} />
  <Collection.Analytics><AnalyticsPanelContent {...screen} /></Collection.Analytics>
  <Collection.BulkBar actions={…} />
</Collection.Root>
```

## 2. Botones de comando

| Regla | Detalle |
|---|---|
| Contenido | **Ícono + valor elegido**: Filtros `3` · Orden `Fecha ↓` (`Fecha ↓ +1` con más claves) · Grupo `Estado` · Vista `Tabla` |
| Sin valor | Solo el ícono, sin borde de estado activo |
| Con valor | Borde `--foreground` (estado activo) |
| Nombre | Tooltip y `aria-label` con nombre y valor: `"Ordenar: Fecha descendente"`, `"Filtros: 3 activos"` |
| Solo ícono | `AnalyticsButton`, `ExportMenu` (con tooltip y `aria-label`) |
| Acción primaria | Conserva su texto (`ToolbarCreateButton`) |
| `aria-expanded` | En todo botón que abre un popover |
| Pantallas < `md` | Filtros, Orden, Grupo y Vista se juntan en un botón de ajustes con el total de cambios. `Search` ocupa la fila |

Tamaño `size="sm"` y tokens semánticos solamente (invariante 2).

## 3. Declaración: `entity.query` (E3)

```ts
export const saleOrderEntity = defineEntity<SaleOrder>()((f) => ({
  label: "sales.saleorder",
  fields: { /* … */ },
  query: {
    // El texto libre va siempre en `search` (los campos que busca los decide el backend).
    search:  { scopes: [{ field: "customer", param: "customer_name", suggestionsUrl: "sales/orders/filter-suggestions/" }] },
    filters: {
      status:   { field: "status", control: "multi", options: [{ value: "CONFIRMED", label: "Confirmada" }, { value: "IN_PRODUCTION", label: "En producción" }], counts: true },
      customer: { field: "customer", control: "multi", options: "remote" },
      date:     { field: "date", control: "date" },
      total:    { field: "total", control: "range" },
      overdue:  { control: "toggle", label: "Solo vencidas", param: "overdue" },
    },
    sort:    { fields: ["date", "total", "number"], default: "-date" },
    groupBy: { fields: ["status", "customer", "salesperson"], aggregate: { total: "sum" } },
    views: [
      { id: "all", label: "Todas" },
      { id: "open", label: "En curso", count: true, filters: { status: ["CONFIRMED", "IN_PRODUCTION"] } },
    ],
  },
}))
```

### 3.1 Filtros

| `control` | Valor en URL | Aplica | Notas |
|---|---|---|---|
| `toggle` | `param=<activeValue>` (por defecto `true`) | al instante | Sin `field`: requiere `label` |
| `single` | `param=<valor>` | al instante | Puede tener `defaultValue` |
| `multi` | `param=a,b,c` | con «Aplicar · N resultados» o al cerrar | Con más de 8 opciones tiene búsqueda con foco automático |
| `range` | `param_gte` / `param_lte` (o `paramFrom` / `paramTo`) | con «Aplicar» o al cerrar | Números en el formato del `field` |
| `date` | `param_after` / `param_before` (o `paramFrom` / `paramTo`) | al elegir un preset o confirmar el rango | Presets: hoy, esta semana, este mes, últimos 30 días, este año, rango… |

- **Etiqueta:** un filtro con `field` usa el `label` del campo (G-1, ADR-0120). No acepta `label` propio.
- **Valores:** valores de dominio, nunca tokens de UI (G-2).
- **`param`:** por defecto, el id del filtro. Se fija para conservar el nombre del `FilterSet` existente.
- **`options`:** arreglo fijo `{ value, label }[]`, o `"remote"` (opciones desde el endpoint de facetas, con etiqueta). Un campo `f.status` no expone sus opciones: se declaran en el filtro.
- **`counts: true`:** cada opción muestra su conteo (§7.2), y las opciones con 0 se deshabilitan (salvo las ya elegidas).
- **Prohibido:** el control `custom`, los constructores de condiciones (y/o, operadores elegibles) y el JSX en la definición.

### 3.2 Orden

- **`fields`:** los campos ordenables. El backend los acepta en `ordering_fields`.
- **`default`:** en formato DRF (`"-date"`).
- **Claves:** hasta **3**, cada una con dirección.

### 3.3 Agrupación

- **Un nivel.** `fields` lista los campos agrupables.
- **`aggregate`:** opcional, `{ <campoNumérico>: "sum" | "avg" | "count" }`, y se muestra en la fila del grupo.
- **Con paginación de servidor** usa `groups/` (§7.1). Con `source: { rows }`, agrupa en el cliente (`groupItems`).

### 3.4 Vistas

- **Solo predefinidas en código.** No hay vistas de usuario.
- **Contenido de una vista:** `filters`, más `ordering` (ids de campo, `["-date"]`) y `groupBy` opcionales. La primera vista es la de defecto: si la URL llega sin filtros, sus filtros se escriben al cargar.
- **Claves de `filters`:** el id de un filtro de un solo parámetro (`status: ["DRAFT", "CONFIRMED"]`) o, para rangos y fechas, el parámetro crudo (`total_gte: "500000"`).
- **Cambiar de pestaña** reemplaza búsqueda, filtros, orden y grupo por los de la vista, en una sola escritura de la URL.
- **`count: true`:** la pestaña muestra su total (§7.2).
- **«Restablecer»:** si el estado difiere del de la vista activa, junto a las pestañas aparece «Restablecer», que vuelve a la definición.

## 4. Estado en la URL: `useCollectionQuery(entity)` (E3)

Es un único dueño del estado, construido sobre `nuqs`. Cualquier cambio de filtro, búsqueda, orden o grupo resetea `cursor` o `page`. `selected` se preserva.

| Param | Contenido |
|---|---|
| `v` | id de vista |
| `search` | texto libre (parámetro fijo) |
| `<param>` por filtro | §3.1 |
| `ordering` | `-date,-total` |
| `group_by` | id del campo |
| `view` | layout: `table` (`list`), `card`, `kanban`, `timeline` |
| `analytics` | pestaña abierta del modal |

Preferencias por entidad que **no van en la URL**: densidad y columnas (visibilidad, orden, fijadas). Desde E3 se guarda la visibilidad en `localStorage` con la clave `entity-view:hidden-columns:<label>` (si la entidad no tiene `label`, se usa `title`). La instantánea del servidor es «nada oculto», así que la hidratación coincide y la preferencia se aplica justo después. Densidad, orden y fijado quedan para una etapa posterior.

**Modo cliente:** `useCollectionQuery(entity, { sorting: "client" })` es para listas que cargan todas sus filas y las ordenan en el navegador.
- Los campos de `query.sort` no necesitan `orderBy`.
- Las claves siguen en `?ordering=`, pero `params` no lleva `ordering`.
- `sorting` usa el modo `query` de `useEntityCollection`: ordena las filas cargadas por todas las claves, y solo las columnas declaradas son ordenables.
- Filtros y búsqueda funcionan igual. La pantalla los envía al servidor (`params`) o filtra en el cliente (`search.filters` o `search.filterFn`).
- Con `search.filterFn`, cada `scope` busca en las claves de fila de `clientKey` (por defecto, su `param`): `{ label: "Nombre / Código", param: "name", clientKey: ["name", "code", "address"] }`.
- Los filtros `options: "remote"` reciben sus opciones en `useCollectionQuery(entity, { filterOptions: { category: [...] } })`.

En ambos modos, el encabezado actúa solo sobre la primera clave y solo esa columna lleva `aria-sort`. Las secundarias se ven y se cambian en `SortMenu`.

**Adaptador:** `useCollectionQuery(entity, { searchDef })` usa un `unifiedSearchDef` existente (vía `fromUnifiedSearchDef(def)`) en lugar de `entity.query`, para migrar la vista antes que su definición. Con el adaptador no hay orden múltiple, vistas ni agregados.

**Montaje:** la pantalla pasa el resultado del hook a `<Collection.Root query={query}>`. Con `query`, `Collection.Toolbar` deja de ser la barra antigua y compone `ViewTabs` → fila de comandos (`Search`, `FilterMenu`, `SortMenu`, `GroupMenu`, `DisplayMenu`, `children`, analítica, `ExportMenu`, `action`) → `AppliedFilters`. `ExportMenu` recibe `query.params` salvo que se pase `exportFilters`. El buscador es `UnifiedSearchBar`: solo la caja de texto con sus sugerencias (Backspace en vacío quita el último filtro). La barra dibuja la fila de filtros aplicados. `useUnifiedSearch` expone `applyMany(values)`, que escribe varios parámetros en una sola actualización y resetea el cursor.

**Placeholder:** `query.search.placeholder` («Buscar guías de despacho…») es también el nombre accesible del buscador. Por defecto: «Buscar…».

**Sin buscador:** `query.search: false` cuando el endpoint no tiene búsqueda de texto (ventas y sincronizaciones de terminal). La barra no muestra un buscador que no haría nada; los filtros siguen igual.

**Presets de fecha:** por defecto `today`, `this_week`, `this_month`, `this_quarter` y `this_year`. `last_7_days` («Últimos 7 días») se pide en `presets`.

**Lo que entrega el hook:** `search` (lo que consume `UnifiedSearchBar`), `sort` / `setSort`, `ordering` (DRF, con desempate por `id`), `sorting` (listo para `useEntityCollection`), `groupBy` / `setGroupBy` (solo campos declarados), `views` / `activeView` / `setView` / `isDirty` / `resetView` y `params` (búsqueda + filtros + `ordering`, sin `group_by`) para la petición.

## 5. Piezas

### 5.1 `FilterMenu` (E3)

- **Popover de dos paneles.** El panel izquierdo lista los filtros: tiene búsqueda y muestra en negrita cuántos valores elegidos tiene cada filtro. El derecho muestra los valores del filtro elegido, con los controles propios de `FilterMenu`.
- **Pie del panel derecho:** «Quitar» y «Aplicar» para `multi` y `range`. En `multi`, con conteos (`facets/`), el botón dice «Aplicar · N resultados»: N es exacto (la lista con la elección sin aplicar), no una suma de opciones.
- **Controles por tipo:** `multi` con borrador de casillas y búsqueda si hay más de 8 opciones; `single` y presets de `date` como radios; `toggle`; `range` y `date` con dos campos («desde» / «hasta»). El panel de `date` es `PeriodPanel`, el mismo cuerpo que `PeriodPicker` (ADR-0160). Los filtros `custom` del adaptador no aparecen en el menú.
- **Al cerrar con cambios sin aplicar:** se aplican. `Esc` descarta.

### 5.2 `AppliedFilters` (E1)

- **Un chip por filtro:**
  - `filter` neutro, `date` info, `range` warning y `group` violeta (tokens de `UnifiedChip.variant`).
  - Un `multi` con más de 2 valores se resume (`Estado: 3`).
- **Distribución:** la fila crece en líneas (prohibido el scroll horizontal) y termina con «Limpiar todo».
- **Atajos:** Backspace en `Search` vacío quita el último chip.
- **Conteo:** el de resultados va a la derecha de `ViewTabs` o, sin pestañas, al final de `AppliedFilters` (`"38 resultados"`).
- **Solo lectura:** sin `onClearAll`, la fila no tiene botones de quitar ni «Limpiar todo». La usa la franja de alcance de la analítica (§5.7).

### 5.3 `SortMenu` (E3)

Filas de `[n] [campo ▾] [↑|↓] [subir] [×]`, más «Agregar orden secundario» (hasta 3) y «Restablecer». En E3 se reordena con «subir», no con arrastre. El botón muestra `Folio ↓ +1` y se anuncia «Ordenar: Folio descendente y 1 más».

El **encabezado de columna** usa el mismo estado: ordenar desde él reemplaza la **primera** clave y conserva las secundarias (E3). Su menú contextual (ordenar ↑/↓, «Filtrar por…», agrupar, fijar, ocultar) queda pendiente.

### 5.4 `GroupMenu` (E3)

- **Radios:** «Sin agrupar» más `groupBy.fields`.
- Elegir cierra el menú.
- **Pendiente:** elegir el subtotal entre los `aggregate` declarados (llega con `groups/`, E4) y la preferencia «Grupos plegados al abrir».

### 5.5 `DisplayMenu` (E3)

- **Layout:** radios con los layouts de `viewPolicy.availableViews`. El botón muestra el ícono y el nombre corto del layout actual.
- **Columnas:** casillas de visibilidad para las columnas de la tabla montada. La columna identificadora (`primary`, o la primera) está deshabilitada y marcada «fija».
- **Pendiente:** densidad ([density-system.md](./density-system.md)) y orden por arrastre.

### 5.6 `ExportMenu` (E1)

- **Formatos:** un ícono que abre el menú con los formatos de `entity.export`. El título es «Exportar N filas filtradas».
- **Qué exporta:** la consulta actual (filtros, búsqueda, `ordering`) y las columnas visibles ([export-formats.md](./export-formats.md)).

### 5.7 Analítica en modal (E2)

- **No es un layout.** `"analytics"` no existe en `CollectionViewMode` ni en `ViewPolicy.availableViews`.
- **Montaje:** `Collection.Analytics` monta sus hijos dentro de `AnalyticsModal` (`BaseModal` grande con pantalla completa; hoja completa en el teléfono). El botón de la barra lo abre y escribe `?analytics=<pestaña>`. Cerrarlo borra el parámetro.
- **Alcance (E3, con `query`):** el modal muestra una franja: «Analizando con la vista X» (o «…con los filtros de la lista»), más los chips de solo lectura. Sin contador de resultados: el total vive en la barra de la colección. La vista se nombra solo mientras el estado coincide con ella. «Analizar sin filtros» cambia el alcance solo dentro del modal: `useCollectionAnalytics` expone `scope` (`"query"` | `"all"`) y `onScopeChange`, y la pantalla pide la analítica sin filtros cuando `scope === "all"`. Cerrar el modal vuelve a `"query"`.
- **Drill-down (E3, con `query`):** un gráfico de barras o de torta declara `drillDown: { param, values? }` en su config (`ChartDrillDown`). Un clic envía la categoría (el `id` de la porción o el valor de `indexBy`), traducida por `values` si se declara; una categoría sin traducción no es clicable. `Collection.Analytics` provee el destino (`AnalyticsDrillDownProvider`): aplica `{ [param]: value }` a la colección y cierra el modal en una sola actualización de URL. Fuera de una colección, `AnalyticsPanelContent` acepta `onDrillDown(filter)`. `param` debe ser un parámetro que la consulta de la colección conozca. El clic es una mejora de puntero: el mismo filtro está en `FilterMenu`.
- **URL:** `useCollectionAnalytics` escribe con nuqs, igual que la consulta. Abrir y cerrar crean una entrada de historial y cambiar de pestaña la reemplaza.
- **Consultas:** se piden solo con el modal abierto (`enabled: analyticsOpen`).
- **Compatibilidad:** `?view=analytics` se reescribe a `?analytics=` con `router.replace`.

## 6. Estados (invariante 8)

| Estado | Barra | Superficie |
|---|---|---|
| loading inicial | Los botones se muestran deshabilitados con su valor (desde la URL). Los conteos se muestran como skeleton de ancho fijo | skeleton de `Collection.View` |
| refetch | La barra queda interactiva. El conteo conserva su ancho (sin CLS) | `isRefetching` atenúa la tabla |
| vacío filtrado | `AppliedFilters` visible | `EmptyState` «Sin resultados» con «Limpiar filtros» (`onResetFilters`) |
| vacío real | Sin `AppliedFilters` | `EmptyState` con `emptyAction` |
| error de `facets/` | Las opciones quedan sin conteos y nada se deshabilita | sin efecto |
| error de `groups/` | El chip de grupo muestra un aviso | mensaje de error de la colección con reintentar |

## 7. Backend (E4)

Los dos endpoints usan **el mismo `FilterSet` y el mismo queryset de lectura** que el listado. Se exponen con el mixin de `core` (`GroupedListMixin`, `FacetedListMixin`). La vista queda en 20 líneas o menos (invariante 10) y la lógica va en el selector.

### 7.1 `GET <lista>/groups/?group_by=<campo>&<filtros>&ordering=…`

```json
[{ "key": "IN_PRODUCTION", "label": "En producción", "count": 26, "aggregates": { "total": "4215600" }, "params": { "status": "IN_PRODUCTION" } }]
```

- **Declaración:** `GroupedListMixin` en el `ViewSet` con `group_fields = {nombre: GroupField(campo, label=…, param=…, null_param=…)}` y `group_aggregates = {id_de_campo: ruta_orm}` (suma). En la entidad, el campo declara `groupKey: "<nombre>"`; en una lista paginada en servidor es obligatorio (`compileQuery` lanza error sin él). Un valor derivado usa `GroupField(nombre_anotación, param=…, expression=<Case/Coalesce>, labels={clave: etiqueta})`, y la lista declara un filtro con la misma expresión para que `params` de cada grupo liste sus filas.
  - `param` es el filtro de la lista que selecciona las filas del grupo (por defecto, el nombre). Una tupla pone la clave en todos: una fecha usa el rango existente (`param=("date_from", "date_to")`), sin un filtro exacto nuevo.
  - El grupo solo es posible si la columna existe en la base. Un valor derivado (el estado compuesto de un documento, el origen de un asiento, el cliente de una OT, que puede venir de un JSON) sigue agrupando la página.
  - En el cliente, el feature arma los params de filas y grupos con la misma función (`orderListParams`, `invoiceListParams`, `movementListParams`…), y la lista plana no se pide mientras se agrupa en el servidor (`enabled: groupKey === null`).
- **Consulta:** una sola, `values(campo[, etiqueta]).annotate(count=Count("pk"), sum…)` sobre un subquery de los pk filtrados: las búsquedas que cruzan líneas no inflan las sumas.
- **Etiqueta:** la ruta `label` (FK) o los `choices`; para valores simples (fechas, números) es `null` y el cliente formatea `key` (las fechas como fecha).
- **Subtotales:** `aggregates` se indexa por el id del campo de la entidad y se formatea como su columna, con la escala del campo del modelo.
- **Orden:** por la dirección de `?ordering` si el campo agrupado (o su etiqueta) figura en él. Sin `?ordering`, rige `group_ordering` del `ViewSet` (para listas ordenadas por su selector, p. ej. `["-date"]`) o su `ordering`. Si no, por `label`, o por valor cuando no hay etiqueta. El grupo sin valor va al final.
- **Conteo:** `Count("pk", distinct=True)`, así un subtotal que suma líneas no infla el conteo.
- **Filas de cada grupo:** el listado normal con los `params` del grupo y su propia paginación (`useServerGroups`). Se abren los 3 primeros; el resto carga al desplegarlo, y cada uno tiene «Mostrar más». Un grupo sin `params` (sin valor y sin `null_param`) muestra su conteo pero no se despliega.
- **Listas con agrupación en servidor:** órdenes de venta y de compra, facturas y notas, despachos, recepciones y devoluciones, OTs (estado y etapa), productos (tipo y categoría), movimientos de stock, documentos de inventario, movimientos de tesorería y asientos (estado y fecha). También las vistas unificadas de despachos y de recepciones (ver abajo).
- **Lista sobre dos tipos de documento (`UnionListViewSet`, `core/services/union_list.py`):** `union_sources = [UnionSource(kind, label, ListViewSet, columns)]`. Cada fuente filtra, busca, verifica permisos y serializa con su propio `ViewSet` de lista; las filas son un `UNION` SQL de sus claves (`columns`: las columnas por las que se ordena), paginado y ordenado en la base. Cada fila lleva `fulfillment_type`, que también filtra las fuentes. `groups/` fusiona por clave los grupos de cada fuente (conteos y agregados sumados); `group_by=type` da un grupo por fuente. Consultas: conteo + página + una carga por fuente presente en la página. Rutas: `sales/fulfillment/` (despachos + devoluciones) y `purchasing/fulfillment/` (recepciones + devoluciones).

### 7.2 `GET <lista>/facets/?fields=status,customer&views=<json>&<filtros>`

```json
{ "fields": { "status": [{ "value": "CONFIRMED", "count": 12 }] }, "views": { "open": 212, "to-invoice": 47 } }
```

- **Conteo de cada campo:** sobre los filtros activos **menos el propio filtro** de ese campo (semántica de facetas).
- **Conteo de cada vista:** sobre los filtros de la vista, sin los del usuario. Las vistas viven en el frontend, así que `views` lleva sus params en JSON: `{"to-invoice": {"origin_status": "ACTIVE", "billing_status": "PENDING"}}` (hasta 12; mal formado → 400).
- **Consultas:** una por campo o vista pedidos. No crecen con las filas.

Los dos endpoints exigen un test `ci_gate` de conteo de consultas (zero-n-plus-one-policy.md, Regla 8).

**Implementación (`FacetedListMixin`, `core/services/facets.py`).** El viewset declara
`facet_fields = {param: FacetField(...)}`; el nombre es el param del filtro en la lista.

- `FacetField(field="delivery_status")`: columna → una consulta `values(field).annotate(Count)` sobre una subconsulta de pks.
- `FacetField(values=("DRAFT", "ACTIVE", …))`: filtro método del `FilterSet` → un `count()` por opción, aplicando el filtro con ese valor. Prohibido para filtros que se evalúan en Python sobre toda la lista (p. ej. el pago derivado).
- `params`: params que se quitan al contar (por defecto, el nombre).
- Los conteos reutilizan `filter_queryset(get_queryset())`, así que coinciden con la lista. Un campo desconocido → 400.

Frontend: el filtro `multi` declara `counts: true` → `compiled.facetParams` / `query.facetFields`. La pantalla
pide los conteos con su hook de feature (`useFacetCounts` en `/hooks`) y entrega `{ ...query, facets }` a
`Collection.Root`. `FilterMenu` muestra el conteo de cada opción y deshabilita las de 0 salvo las ya elegidas;
sin conteos (cargando, error) las opciones se ven sin número. Una vista con `count: true` muestra su total en la
pestaña (`query.facetViews` → `facets.views`). No se marca `count`/`counts` en filtros o vistas que se evalúan
en Python sobre toda la lista. Listas con `facets/`: órdenes de venta (opciones y vistas), despachos,
devoluciones de venta, recepciones y devoluciones de compra (estado y vistas), órdenes de compra (vistas).
«Aplicar · N resultados»: el panel `multi` informa su elección sin aplicar con `query.setDraft` (se limpia al
aplicar, cerrar o cambiar de filtro). `useCollectionQuery` la agrega a `facetViews` como una vista más, con id
`draftViewId(draft)` y los params de la lista con la elección en lugar del filtro (`draftViewParams`), con 250 ms
de debounce. El hook de facetas de la pantalla la cuenta sin cambios. El id lleva la elección, así que una
respuesta vieja no se muestra para otra elección: mientras carga, el botón dice solo «Aplicar». Solo en listas
con algún filtro `counts: true`.

## 8. Accesibilidad

- **`Collection.Toolbar`:** `role="toolbar"` con `aria-label="Herramientas de <entidad>"`.
- **Botones de comando:** `aria-label` con nombre y valor, y `aria-expanded`.
- **Popovers:** atrapan el foco y se cierran con `Esc`. El foco vuelve al botón.
- **`AppliedFilters`:** `role="list"`. Cada «×» lleva `aria-label="Quitar <chip>"`.
- **Atajo `/`:** enfoca `Search` cuando el foco no está en un campo editable.
- **Conteo de resultados:** `aria-live="polite"`.

## 9. Pruebas

- **Barra:** se renderiza según `query`. Un botón sin valor muestra solo el ícono y tiene `aria-label`.
- **Aplicación de filtros:**
  - `multi` no escribe la URL hasta «Aplicar» o el cierre;
  - `toggle` escribe al instante;
  - cualquier cambio resetea `cursor`.
- **`AppliedFilters`:** «Limpiar todo» deja solo los parámetros preservados.
- **Analítica:** `?view=analytics` redirige a `?analytics=`, y el drill-down aplica el filtro y cierra el modal.
- **Backend:** los tests de conteo de consultas de `groups/` y `facets/`, y la semántica de facetas (excluir el propio filtro).
