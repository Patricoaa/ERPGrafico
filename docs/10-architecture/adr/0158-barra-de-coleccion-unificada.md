---
id: 0158
title: Barra de colección unificada — consulta declarada en `defineEntity`, una barra de comandos para todas las entidades, agrupación en servidor y analítica en modal
status: Accepted
date: 2026-11-25
author: frontend-team
---

# 0158 — Barra de colección unificada

**Relacionado:** ADR-0087 (entity-view; este ADR amplía `defineEntity` y `Collection.Toolbar` y retira el modo de vista `analytics`), ADR-0120 (implementa su «hoja de ruta arquitectónica»: el filtro se declara junto al campo), ADR-0058 (agregación de analítica en servidor; sin cambios en los datos), ADR-0137 (variante embebida; no cambia), ADR-0118 (cero N+1; aplica a los endpoints nuevos). Contrato reemplazado: [`unified-searchbar.md`](../../20-contracts/unified-searchbar.md).

## Contexto

Las herramientas de una colección (buscar, filtrar, ordenar, agrupar, elegir vista, exportar, analítica) están repartidas en tres lenguajes que la página arma a mano:

| Pieza | Uso (2026-11-25) | Qué hace |
|---|---|---|
| `UnifiedSearchBar` + `useUnifiedSearch` + `unifiedSearchDef.ts` | ~78 archivos, 59 tocan un `unifiedSearchDef` | Input con chips adentro. El chevron abre `SearchBarMenu`, con tres columnas: Filtrar, Agrupar y Visualización (vista, orden, columnas) |
| `Collection.Toolbar` | todas las colecciones entity-view | Íconos de vista (tabla, tarjetas, analítica, kanban, cronograma) y botones de exportación sueltos |
| `Collection.Analytics` + `AnalyticsPanelContent` | 9 vistas | Modo de vista `analytics`: reemplaza la tabla por pestañas de análisis |
| `ReportToolbar` + `DateRangeFilter` | 2 / 4 | Barra propia de los informes |
| `AnalyticsPanel` (Drawer), `DataTableToolbar`, `FacetedFilter`, `DataTableColumnToggle` | 0–4 | Restos sin uso o congelados (ADR-0087) |

Problemas verificados en el código:

1. **El filtro aplicado no se ve completo.** Los chips viven dentro del input con `overflow-x-auto` y se cortan con varios filtros activos. `UnifiedSearchBar` recibe `onClearAll` e `isFiltered`, pero no los desestructura, así que no hay «Limpiar todo». Tampoco se muestra cuántos resultados quedan.
2. **Un popover con tres tareas.** `SearchBarMenu` mezcla el alcance (filtros), la estructura (agrupar) y la presentación (vista, orden, columnas). El selector de vista aparece ahí y en `Collection.Toolbar`. El orden y la agrupación activos no se ven sin abrir el menú.
3. **La agrupación cubre solo lo cargado.** Con `groupBy` activo, la vista pide `GROUP_ROW_LIMIT = 200` filas y agrupa en el cliente (`groupItems`). Más allá de ese límite, los grupos y conteos son parciales (`truncated`).
4. **Orden de una sola clave**, sin dirección explícita fuera del encabezado.
5. **La multi-selección aplica en cada clic**: cada check reescribe la URL y dispara un refetch.
6. **La analítica es un modo de vista.** Al volver a la tabla se pierden el scroll y la selección. `SearchBarMenu` tiene una rama `isAnalyticsView` que oculta orden y columnas. La analítica no comparte su alcance de forma visible.
7. **Filtros y columnas se declaran por separado** (ADR-0120, problema 1). La regla G-1 se cumple por revisión, no por tipo.

Antecedentes de diseño (Eleken, *Table design UX*; Pencil & Paper, *Enterprise filtering UX patterns*):

- El filtro aplicado debe verse en tres lugares: el control con su conteo, una fila resumen y la opción marcada.
- Una barra horizontal sirve para volumen medio y queda junto a la sección que afecta.
- Las opciones simples se aplican al instante. La multi-selección y los rangos se aplican al cerrar.
- Las opciones muestran conteos y las que dejarían cero resultados se deshabilitan.
- Las fechas usan presets más un rango libre.
- Conviene ofrecer pestañas prefiltradas.
- El encabezado de columna es el acceso más contextual.
- La agrupación muestra subtotales.
- Los gráficos van en una superficie propia, con la tabla a un clic.

Maqueta aprobada (propuesta A con ajustes): artefacto «Barra de colección unificada», versión 2.

## Decisión

### 1. Una sola barra, compuesta por `Collection.Toolbar`

`Collection.Toolbar` arma la barra completa a partir de la entidad. La página no pasa `UnifiedSearchBar` como hijo, solo `action` (crear) y, si hace falta, `views` para restringir los layouts. Orden fijo:

```
[ViewTabs ··························· 1–38 de 38]
[Search──────────] [Filtros] [Orden] [Grupo] [Vista] | [Analítica] [Exportar] [Acción primaria]
[AppliedFilters: chip · chip · chip · Limpiar todo]
```

Cada pieza solo aparece si la entidad la declara. Una entidad sin `query` muestra solo la acción y los layouts, como hoy.

### 2. Anatomía de los botones de comando

- **Ícono + valor elegido**, sin el nombre de la herramienta. Filtros: ícono + conteo (`3`). Orden: ícono + `Fecha ↓` (con más de una clave, `Fecha ↓ +1`). Grupo: ícono + `Estado`. Vista: ícono + `Tabla`.
- **Sin valor elegido, solo el ícono.** Un botón con valor lleva borde marcado (estado «activo»).
- El nombre va en el **tooltip y en el `aria-label`**, que también incluye el valor (`"Ordenar: Fecha descendente"`).
- **Analítica y Exportar** son solo ícono.
- La **acción primaria** (crear) conserva su texto: es la acción de la página, no un comando de la barra.
- **En pantallas angostas** (< `md`), Filtros, Orden, Grupo y Vista se juntan en un botón de ajustes con el total de cambios, y la búsqueda ocupa la fila.

### 3. La consulta se declara en la entidad: `entity.query`

`defineEntity` acepta una sección `query` opcional. Implementa la hoja de ruta de ADR-0120:

```ts
query: {
  search:  { fields: ["number", "customer", "items"], param?: "search" },
  filters: {
    status:   { field: "status", control: "multi", counts: true },
    customer: { field: "customer", control: "multi", options: "remote" },
    date:     { field: "date", control: "date" },           // presets + rango
    total:    { field: "total", control: "range" },
    overdue:  { control: "toggle", label: "Solo vencidas", param: "overdue" },
  },
  sort:    { fields: ["date", "total", "number"], default: "-date" },
  groupBy: { fields: ["status", "customer", "salesperson"], aggregate: { total: "sum" } },
  views:   [{ id: "all", label: "Todas" }, { id: "open", label: "En curso", filters: { status: ["CONFIRMED", "IN_PRODUCTION"] } }],
}
```

Reglas:

- Un filtro con `field` **hereda la etiqueta del campo**, así que G-1 de ADR-0120 queda garantizada por el tipo. Solo un filtro sin campo (`toggle` de dominio) declara `label`.
- Los valores de las opciones son valores de dominio (G-2).
- `param` por defecto es el nombre del campo. Se puede fijar para conservar los nombres de los `FilterSet` actuales, así que **el backend no cambia nombres de parámetros**.
- **Controles cerrados:** `multi`, `single`, `toggle`, `range` y `date`. Se elimina el tipo `custom` de filtro: hoy no tiene consumidores (los 29 `type: 'custom'` del repo son bloques de analítica, no filtros). Invariante 13: no hay escapes opacos.
- **No hay constructor de condiciones avanzado** (y/o, operadores elegibles).

### 4. Estado en la URL: `useCollectionQuery(entity)`

Un solo hook, construido sobre la base de `useUnifiedSearch` (parsers `nuqs`, reset de `cursor`, preservación de `selected`), es dueño de todo el estado:

| Parámetro | Contenido |
|---|---|
| `v` | vista predefinida activa |
| `q` (o `search.param`) | texto libre |
| `<param>` por filtro | valor; multi separados por coma; rango `<param>_gte` / `<param>_lte` (o sus `serverParamFrom/To` actuales) |
| `ordering` | lista DRF: `-date,-total` |
| `group_by` | campo de agrupación |
| `view` | layout (`table`, `card`, `kanban`, `timeline`; valores de `?view=` actuales) |
| `analytics` | pestaña del modal de analítica abierta |

La **densidad y las columnas** (visibilidad, orden, fijadas) no van en la URL. Se guardan como preferencia por entidad junto a la que ya usa `useViewMode`.

### 5. Filtros: `FilterMenu` y `AppliedFilters`

- **`FilterMenu`** es un popover de dos paneles: la lista de filtros a la izquierda (con búsqueda y el conteo de valores elegidos) y los valores del filtro actual a la derecha. Usa sus propios controles.
- **Momento de aplicar:**
  - `toggle` y `single` aplican al instante.
  - `multi` y `range` aplican con «Aplicar · N resultados» o al cerrar el popover.
  - `date` aplica al elegir un preset, o al confirmar un rango libre.
- **Conteos:** con `counts: true`, cada opción muestra cuántas filas quedarían con los demás filtros aplicados, y una opción con 0 se deshabilita (§8). Las listas con más de 8 opciones tienen búsqueda con foco automático.
- **`AppliedFilters`** es una fila bajo la barra, visible solo con filtros, búsqueda o grupo activos:
  - Un chip por filtro. Un multi con más de 2 valores se resume (`Estado: 3`). El grupo lleva su propio chip.
  - La fila crece en líneas (no hay scroll horizontal) y termina con «Limpiar todo».
- El **conteo de resultados** («1–38 de 38») va a la derecha de las pestañas de vista.
- El menú del **encabezado de columna** (ordenar, filtrar por esta columna, agrupar, fijar, ocultar) usa el mismo estado. «Filtrar por…» abre `FilterMenu` con ese filtro seleccionado.

### 6. Orden: `SortMenu`

- Hasta **3 claves**, cada una con dirección explícita (↑/↓) y reordenables por arrastre. «Restablecer» vuelve a `sort.default`.
- Se envía como `ordering` (DRF `OrderingFilter` acepta la lista separada por comas). El orden en cliente queda solo para colecciones sin servidor.

### 7. Agrupación en el servidor: `GroupMenu`

- **Un nivel**, con los campos de `groupBy.fields` y un agregado opcional por grupo (`sum`, `count`, `avg`).
- Los grupos se piden a **`GET <lista>/groups/?group_by=<campo>&<filtros>`**, que devuelve `[{ key, label, count, aggregates }]` en el orden de `ordering` del campo agrupado. Las filas de cada grupo se piden al endpoint de lista con el filtro del grupo y paginación propia («Mostrar más» por grupo). Los grupos se pueden plegar.
- El servicio del backend resuelve los grupos con **una consulta** (`values(campo).annotate(Count, Sum…)`) sobre el mismo queryset filtrado del listado (ADR-0118).
- Se retiran `GROUP_ROW_LIMIT`, la agrupación en cliente de colecciones con servidor (`groupItems` queda para `source: { rows }`) y el aviso `truncated` en esos casos.

### 8. Facetas: `GET <lista>/facets/`

Si alguna entidad declara `counts: true`, el backend expone `GET <lista>/facets/?fields=status,customer&<filtros>`. Devuelve `{ <campo>: [{ value, count }] }`. El conteo de cada campo se calcula excluyendo su propio filtro, que es la semántica estándar de facetas. Es una consulta por campo pedido, y la cantidad de consultas no depende de las filas. Sin `counts`, no se llama.

### 9. Vistas: solo predefinidas (`ViewTabs`)

- Las vistas se declaran en `query.views`, en código. **No hay vistas guardadas por el usuario**: ni modelo, ni API, ni «Guardar vista».
- Cada vista es un conjunto de filtros, más `ordering` y `group_by` opcionales. La primera es la de defecto.
- La pestaña activa se refleja en `?v=`. Si el usuario cambia filtros respecto de la vista, aparece «Restablecer», que vuelve a la definición.
- Con `count: true` en la vista, la pestaña muestra su total. Esos totales los calcula el endpoint de facetas en una sola llamada (`?views=open,to-invoice`).

### 10. Presentación: `DisplayMenu`

Reúne lo que hoy está en los íconos de `Collection.Toolbar` y en la sección Visualización de `SearchBarMenu`:

- El layout, según `viewPolicy.availableViews`.
- La densidad (compacta o cómoda; usa los tokens de densidad existentes).
- Las columnas: visibilidad, orden por arrastre y columna identificadora fija.

### 11. Analítica en modal

- `Collection.Analytics` **deja de ser un modo de vista**. Se elimina `"analytics"` de `CollectionViewMode` y de `ViewPolicy.availableViews`. Su contenido (`AnalyticsPanelContent`, screens `build…AnalyticsScreen`, hooks de la feature) no cambia.
- Un botón de ícono en la barra abre **`AnalyticsModal`**: `BaseModal` grande con opción de pantalla completa, que en el teléfono ocupa la hoja completa. El riel de pestañas y la granularidad no cambian.
- **Alcance heredado:** el modal recibe la consulta actual (filtros, búsqueda y vista) y la muestra en una franja («Analizando 38 notas con la vista En curso» + chips). «Analizar sin filtros» cambia el alcance solo dentro del modal.
- **Drill-down:** `AnalyticsPanelContent` acepta `onDrillDown(filtro)`. Un clic en una barra o en un segmento aplica ese filtro a la colección y cierra el modal.
- **Enlace profundo:** `?analytics=<pestaña>` abre el modal. Por compatibilidad, `?view=analytics` se reescribe a `?analytics=` con `router.replace`.
- Las consultas de analítica se piden solo con el modal abierto. Es la regla actual (`enabled: view === "analytics"`), que pasa a depender del modal.

### 12. Exportar: `ExportMenu`

Es un botón de ícono con los formatos de `entity.export`. Exporta la consulta actual (filtros, búsqueda, `ordering`) con las columnas visibles. Reemplaza los botones sueltos de `ExportButtons`.

### 13. Fuera de alcance

- Constructor de condiciones avanzado.
- Vistas guardadas por el usuario.
- Panel lateral de facetas (propuesta B): **todas las entidades usan la misma barra**.
- Agrupación anidada.
- La alineación de `ReportToolbar` queda para una etapa posterior: compartirá el control de fecha con presets, pero no se decide aquí.

## Migración

| Etapa | Contenido | Toca páginas |
|---|---|---|
| 0 | Este ADR + contrato nuevo [`component-collection-toolbar.md`](../../20-contracts/component-collection-toolbar.md) | no |
| 1 | `AppliedFilters` con «Limpiar todo» y conteo dentro de `UnifiedSearchBar` (sin chips en el input), vista fuera de `SearchBarMenu`, `ExportMenu` | no (~78 pantallas lo reciben solas) |
| 2 | `AnalyticsModal` dentro de `Collection.Analytics`; retiro del modo `analytics` y compatibilidad de `?view=analytics` | 9 vistas + `entity-registry` (`viewPolicy`) |
| 3 | `entity.query` + `useCollectionQuery` + adaptador `fromUnifiedSearchDef(def)`, para que una vista migre sin reescribir su definición. Barra de comandos (`FilterMenu`, `SortMenu`, `GroupMenu`, `DisplayMenu`, `ViewTabs`) | por oleadas, por app |
| 4 | Backend: `groups/` y `facets/` por entidad, en un mixin de `core` sobre el `FilterSet` y el queryset del listado; tests de cantidad de consultas | por entidad que declare `groupBy` o `counts` |
| 5 | Limpieza: se retiran `SearchBarMenu`, el modo de chips en el input, `GROUP_ROW_LIMIT`, `AnalyticsPanel` (Drawer), `DataTableToolbar`, `FacetedFilter`, `DataTableColumnToggle` y los `unifiedSearchDef.ts` migrados | sí |

Mientras dura la migración, una vista usa `unifiedSearchDef` (vía el adaptador) o `entity.query`, nunca los dos.

**Cierre de la etapa 5 (2026-11-26).**
- Retirados: el adaptador `fromUnifiedSearchDef`, `SearchBarMenu` y sus secciones, el último `unifiedSearchDef.ts`, `AnalyticsPanel` (Drawer) y `useGroupByPagination`.
- `DataTable` se borró junto con `DataTableToolbar`, `FacetedFilter` y `DataTableColumnToggle`. Sus dos últimas pantallas (conciliación y mapeo de cuentas) migraron con [ADR-0159](0159-collection-seleccion-controlada-tono-y-arrastre.md).
- Las listas embebidas usan la barra completa con `useCollectionQuery(entity, { urlPrefix })`.
- `GROUP_ROW_LIMIT` se retiró después (2026-11-26): los dos últimos valores derivados (origen del asiento, cliente de la OT) se agrupan en servidor con `GroupField(expression=…)`, y `compileQuery` exige `groupKey` en modo servidor.

## Consecuencias

- **Una declaración por entidad.** Filtros, orden, agrupación y vistas viven en el `.entity.ts`. La página solo compone (invariante 13). Las etiquetas de filtro ya no pueden divergir de las columnas.
- **El estado se lee sin abrir menús**: los botones con valor y la fila de filtros aplicados muestran el alcance completo.
- **Grupos y subtotales correctos** sobre todo el resultado, a costa de dos endpoints nuevos por entidad agrupable o con conteos. El mixin de `core` evita escribirlos a mano. Cada uno lleva un test de cantidad de consultas (ADR-0118).
- **Menos refetch**: la multi-selección y los rangos aplican al cerrar.
- **La analítica conserva la tabla debajo**: no se pierden scroll ni selección, y el alcance es explícito. Se pierde poder ver la analítica «en la página» sin modal; la pantalla completa lo compensa.
- **Botones de ícono + valor**: dependen del tooltip y del `aria-label` para nombrar la herramienta. Los tests de accesibilidad verifican ambos.
- **Sin vistas de usuario**: una combinación frecuente que no es una vista predefinida se agrega en código.
- **Contratos a actualizar:**
  - `unified-searchbar.md` pasa a `superseded` y apunta al contrato nuevo.
  - `component-entity-view.md`: §6.1 (`Toolbar`, `Analytics`), las reglas de analítica y agrupación de la pantalla, y `defineEntity.query`.
  - `component-decision-tree.md`.
  - `export-formats.md` (exporta la consulta actual).
  - `zero-n-plus-one-policy.md` (endpoints `groups/` y `facets/`).
  - Playbooks `add-feature.md` y `add-endpoint.md`.
  - `ADR-0120`: su hoja de ruta queda implementada por 0158.
  - `ADR-0087`: se anota el retiro del modo `analytics`.
- **Tests:**
  - Los tests de vistas que afirman `?view=analytics` cambian a `?analytics=`.
  - Los que buscan chips dentro del input pasan a buscarlos en `AppliedFilters`.
  - Los de agrupación con servidor mockean `groups/`.

## Alternativas consideradas

- **Propuesta C, evolución mínima del mega-menú.** Corrige los chips y «Limpiar todo», pero mantiene oculto el estado de orden y agrupación y no agrega vistas ni conteos. Se usa como etapa 1, no como destino.
- **Propuesta B, panel lateral de facetas.** Escala mejor con muchos filtros, pero le quita unos 240 px a tablas anchas que se usan con 2 o 3 filtros. Descartada por ahora para tener un solo patrón.
- **Botones con texto («Filtros 3», «Ordenar Fecha ↓»).** Son más explícitos, pero ocupan casi el doble de ancho. Con el valor visible, el nombre se infiere y queda en el tooltip.
- **Vistas guardadas por usuario.** Requieren modelo, API y permisos de compartir. Su costo no se justifica con el presupuesto actual.
- **Mantener la agrupación en cliente con un límite mayor.** Solo desplaza el problema y aumenta la descarga.
- **Analítica como drawer.** Ya existió (`AnalyticsPanel`) y no tiene uso: el ancho no alcanza para el riel más los gráficos.

## Referencias

- Contratos: [`unified-searchbar.md`](../../20-contracts/unified-searchbar.md), [`component-entity-view.md`](../../20-contracts/component-entity-view.md), [`export-formats.md`](../../20-contracts/export-formats.md), [`zero-n-plus-one-policy.md`](../../90-governance/zero-n-plus-one-policy.md).
- ADRs: [0087](0087-entity-view-system.md), [0120](0120-filter-label-domain-values.md), [0058](0058-analytics-server-side-high-volume.md), [0137](0137-variante-embebida-collection.md).
- Código: `frontend/components/shared/UnifiedSearchBar/`, `frontend/components/entity-view/surfaces/Collection.tsx`, `frontend/components/entity-view/core/use-entity-collection.ts` (`GROUP_ROW_LIMIT`, `groupItems`), `frontend/lib/entity-registry.ts` (`viewPolicy`).
- Externas: Eleken, «Table Design UX» (https://www.eleken.co/blog-posts/table-design-ux); Pencil & Paper, «Filter UX Design Patterns» (https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering).
