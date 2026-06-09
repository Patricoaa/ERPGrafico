---
layer: 20-contracts
doc: component-datatable-views
status: active
owner: frontend-team
created: 2026-05-12
last_review: 2026-05-14
depends_on:
  - component-contracts.md
  - component-skeleton.md
  - entity-identity.md
---

# Contrato: DataTable — Sistema de Vistas e Interacciones

Este documento describe las reglas de arquitectura para el ecosistema `DataTable`, incluyendo variantes, vistas, persistencia y primitivas de card. Toda implementación nueva que toque `DataTable` o sus consumidores debe pasar el [checklist al final de este documento](#checklist-de-pr).

---

## 1. Prop `variant` — Modo de renderizado

El `DataTable` opera en cuatro modos excluyentes:

| Valor | Cuándo usar |
|---|---|
| `"standalone"` | Tabla autónoma en página propia (ejm: `/inventory/products`). Incluye borde contenedor, header visible, padding externo. |
| `"embedded"` | Tabla incrustada dentro de un card, modal o panel (ejm: líneas de una orden, historial en `ContactDrawer`). Sin borde externo; comparte el espacio visual con el contenedor padre. |
| `"minimal"` | Tabla display-readonly dentro de tabs o paneles de detalle (ejm: variantes de producto, pricing, checkout steps). Sin toolbar, sin paginación. Usa el mismo motor TanStack pero con la mínima UI. |
| `"compact"` | Tabla densa para modals/drawers con CSS Grid (ejm: borradores POS, listas de selección). Sin toolbar, sin paginación, sin borde. Requiere `gridTemplate`. Ver §1.2. |

**Regla:** Siempre declarar `variant` explícitamente. La prop `cardMode` está deprecada y no debe usarse en código nuevo.

```tsx
// ✅ Correcto
<DataTable variant="embedded" ... />
<DataTable variant="minimal" columns={columns} data={data} />
<DataTable variant="compact" gridTemplate="grid-cols-[2rem_1fr_auto_auto_auto]" columns={columns} data={data} />

// ❌ Deprecado
<DataTable cardMode={true} ... />
```

### 1.1 `variant="minimal"` — Comportamiento específico

| Aspecto | Comportamiento |
|---|---|
| Toolbar | No se renderiza (aunque se pasen props de toolbar) |
| Paginación | Oculta por defecto (`hidePagination` default `true`) |
| Bulk actions | No se renderizan |
| Row selection | No visible (pero el motor TanStack puede tenerla internamente si se usa `onRowClick`) |
| Borde | Opcional vía `noBorder` (default: con borde) |
| Sticky header | No aplica (tabla fluida) |
| Loading state | Muestra skeleton sin toolbar ni paginación |
| Empty state | Mismo `EmptyState` que las otras variantes |

Las props `columns`, `data`, `isLoading`, `emptyState`, `noBorder`, `onRowClick`, `renderFooter`, `renderRow` funcionan igual que en los otros modos.

### 1.2 `variant="compact"` — Comportamiento específico

| Aspecto | Comportamiento |
|---|---|
| Rendering | CSS Grid (`<div>` elements), no `<table>` HTML |
| Toolbar | No se renderiza |
| Paginación | Oculta |
| Bulk actions | No se renderizan |
| Row selection | No disponible |
| Borde | Sin borde externo |
| Sticky header | Sí, sticky top-0 z-10 |
| Scroll | `ScrollArea` con `max-h` configurable (default `max-h-[65vh]`) |
| Separadores | `divide-y divide-border/60` entre filas |
| Loading state | Skeleton grid con la misma estructura de columnas |
| Empty state | Mismo `EmptyState` que las otras variantes |
| Accesibilidad | `role="table"`, `role="row"`, `role="columnheader"`, `role="cell"` |

**Props requeridas:** `gridTemplate` (clase CSS Grid, e.g. `"grid-cols-[2rem_1fr_auto_auto_auto]"`).

**Props opcionales:** `gridGap` (default `"gap-x-3"`), `compactMaxHeight` (default `"max-h-[65vh]"`), `renderRowActions`.

**Regla:** `gridTemplate` debe tener exactamente `columns.length` tracks cuando `renderRowActions` no se usa, o `columns.length + 1` tracks cuando sí se usa (el track extra es para acciones).

```tsx
// ✅ Correcto: 4 columnas + 1 track de acciones
<DataTable
  variant="compact"
  gridTemplate="grid-cols-[2rem_1fr_auto_auto_auto]"
  columns={columns}
  data={data}
  renderRowActions={(row) => <Button>...</Button>}
/>

// ✅ Correcto: 4 columnas sin acciones
<DataTable
  variant="compact"
  gridTemplate="grid-cols-[2rem_1fr_auto_auto]"
  columns={columns}
  data={data}
/>

// ❌ Incorrecto: gridTemplate no coincide con columns.length
<DataTable
  variant="compact"
  gridTemplate="grid-cols-[2rem_1fr_auto]"  // 3 tracks
  columns={fourColumns}                       // 4 columnas
/>
```

Las props `columns`, `data`, `isLoading`, `emptyState`, `onRowClick` funcionan igual que en los otros modos. Las primitivas `DataCell.*` (ya div-based) funcionan directamente dentro de las celdas grid.

---

## 2. Prop `isLoading` — Skeleton obligatorio

**Regla:** Toda tabla que realice fetching asíncrono **debe** pasar `isLoading`. Sin él, el usuario ve una tabla vacía durante la carga inicial (mala UX, sin skeleton).

```tsx
const { data, isLoading } = useMyData()
<DataTable isLoading={isLoading} data={data} ... />
```

Cuando `isLoading` es `true`, el DataTable sustituye el body de la tabla por `SharedTableSkeleton` (filas shimmer). El toolbar, encabezados y paginación permanecen visibles para evitar CLS.

> **Excepción:** Si la tabla usa `renderCustomView`, el skeleton automático **no aplica** dentro de la vista custom. Ver sección 4 (`renderLoadingView`).

---

## 2.5 Paginación — ver contrato dedicado

`DataTable` opera en dos modos de paginación:

| Modo | Cuándo | Props requeridas |
|---|---|---|
| **Cliente** (default) | El hook devuelve `T[]` y el dataset cabe entero en memoria (selector, sub-recurso, singleton). | Ninguna; TanStack pagina las filas locales. |
| **Manual (server-side)** | El hook devuelve `Page<T>` (endpoint paginado por DRF). | `manualPagination`, `pageCount`, `rowCount`, `pagination`, `onPaginationChange` — **las 5 son obligatorias**. |

**Regla núcleo:** si el hook devuelve `Page<T>`, el DataTable MUST estar en modo manual completo. Mezclar (hook paginado + DataTable cliente) trunca datos silenciosamente — es el bug histórico que motivó este contrato.

La prop `rowCount` (total absoluto del backend, no length de `data`) es la fuente de verdad del footer "Mostrando X a Y de Z registros". Sin ella, el footer cuenta filas locales (= page_size) y miente.

Tipo canónico de `Page<T>`, helper `toPage`, anti-patrones, decision tree y checklist completo en [pagination-contract.md](./pagination-contract.md).

---

## 3. Sistema de vistas — Valores canónicos

Las vistas disponibles en el sistema son:

| Valor | Descripción | Componente de renderizado |
|---|---|---|
| `"list"` | Tabla estándar (default en la mayoría de módulos) | Motor interno de DataTable |
| `"card"` | Vista de tarjetas en lista vertical | `renderCustomView` + `EntityCard` / `OrderCard` / `InvoiceCard` |
| `"grid"` | Grilla densa en múltiples columnas (ejm: Productos) | `renderCustomView` + `EntityCard variant="compact"` |
| `"kanban"` | Tablero Kanban (Producción) | `renderCustomView` + componente específico de dominio |

**Regla de consistencia:** Si se declara una opción diferente de `"list"` en `viewOptions`, **debe existir** `renderCustomView` que maneje esa vista.

```tsx
// ✅ Correcto: la opción 'grid' tiene su renderCustomView
viewOptions={[
  { label: "Lista", value: "list", icon: List },
  { label: "Grilla", value: "grid", icon: LayoutGrid },
]}
renderCustomView={view === 'grid' ? (table) => (
  <div className="grid grid-cols-3 gap-3">
    {table.getRowModel().rows.map(row => <EntityCard ... />)}
  </div>
) : undefined}

// ❌ Incorrecto: opción declarada pero sin render
viewOptions={[{ label: "Grilla", value: "grid" }]}
// renderCustomView ausente
```

---

## 4. Prop `renderLoadingView` — Skeleton en vistas custom

Cuando una tabla usa `renderCustomView`, el skeleton automático de `isLoading` **no se activa** dentro de la vista custom (el DataTable no puede inferir qué skeleton mostrar en un renderizado arbitrario).

**Regla:** Si una tabla tiene `renderCustomView` Y hace fetching asíncrono, también debe pasar `renderLoadingView`.

```tsx
renderCustomView={(table) => (
  <div className="grid gap-3">
    {table.getRowModel().rows.map(row => <EntityCard ... />)}
  </div>
)}
renderLoadingView={() => <CardSkeleton count={8} variant="compact" />}
```

---

## 5. Persistencia de vista — URL param `?view=`

La vista activa debe sobrevivir a la navegación atrás/adelante y ser bookmarkeable. El mecanismo estándar es el URL param `?view=<valor>`.

**Patrón canónico:**

```tsx
const searchParams = useSearchParams()
const router = useRouter()
const pathname = usePathname()

// Leer desde URL (con fallback al default de la página)
const currentView = (searchParams.get('view') ?? 'list') as 'list' | 'card'

// Escribir a URL sin scroll jump
const handleViewChange = (v: string) => {
  const params = new URLSearchParams(searchParams.toString())
  params.set('view', v)
  router.push(`${pathname}?${params.toString()}`, { scroll: false })
}
```

> **Nota de coexistencia:** El patrón `new URLSearchParams(searchParams.toString())` preserva todos los params existentes (`?selected=`, `?modal=`, etc.) al agregar `?view=`.

**Regla:** Nunca usar `useState` local para la vista activa. El estado efímero provoca que la vista se pierda al navegar atrás.

### Hook `useViewMode` — Patrón preferido

El hook `useViewMode` encapsula toda la lógica de URL sync y genera `viewOptions` automáticamente desde el `ENTITY_REGISTRY`:

```tsx
import { useViewMode } from "@/hooks/useViewMode"

const { currentView, handleViewChange, viewOptions, isCustomView } = useViewMode('sales.saleorder')

<DataTable
  currentView={currentView}
  onViewChange={handleViewChange}
  viewOptions={viewOptions}
  renderCustomView={isCustomView ? createDomainCardView('sales.saleorder', { ... }) : undefined}
  renderLoadingView={isCustomView ? createCardLoadingView('single-column') : undefined}
  ...
/>
```

**Regla:** Todo componente nuevo que use multi-vista **debe** usar `useViewMode`. El patrón manual `useState + useEffect` está deprecado.

---

## 6. Primitivas de card — Cuándo usar cada una

### `EntityCard` — Shell estándar (primitiva visual)
Primitiva genérica del design system. Usar cuando:
- Se necesita una tarjeta en una vista de grilla densa (ProductList en modo grid)
- La tarjeta no requiere lógica de dominio específica (hub, status complejo)
- Se construye un módulo nuevo de master data o settings

```tsx
import { EntityCard } from "@/components/shared/EntityCard"

<EntityCard onClick={handleClick} isSelected={isSelected}>
  <EntityCard.Header title="..." subtitle="..." trailing={<Badge />} />
  <EntityCard.Body>
    <EntityCard.Field label="Cliente" value="Acme SpA" />
    <EntityCard.Field label="Total" value="$12.000" />
  </EntityCard.Body>
  <EntityCard.Footer>
    <Button size="sm">Acción</Button>
  </EntityCard.Footer>
</EntityCard>
```

### `DomainCard` — Card inteligente para documentos transaccionales
Usa `EntityCard` como shell interno. Renderiza automáticamente:
- Icono, nombre de partner, y display ID desde `ENTITY_REGISTRY`
- `DomainHubStatus` (workflow badges)
- Montos totales y pendientes
- Líneas de producto

Usar exclusivamente para entidades con `viewPolicy.cardComponent: 'domain'`:
- Órdenes de Venta (`sales.saleorder`)
- Órdenes de Compra (`purchasing.purchaseorder`)
- Facturas/DTEs (`billing.invoice`)

```tsx
import { DomainCard } from "@/components/shared"

<DomainCard label="sales.saleorder" data={order} isSelected={...} isHubOpen={...} />
```

### ❌ `OrderCard`, `InvoiceCard` — Eliminados
Estos componentes legados fueron reemplazados por `DomainCard` y eliminados del codebase. No deben recrearse.

### ❌ Inline JSX en `renderCustomView` — Prohibido
No construir tarjetas con JSX inline dentro de `renderCustomView`. Todo card debe ser una composición de `EntityCard`, `DomainCard`, o un componente de dominio derivado de ellos.

---

## 6.1. View Helpers — Factories para `renderCustomView`

Para reducir boilerplate, existen factories en `lib/view-helpers.ts`:

### `createDomainCardView(label, options)`
Para entidades con `cardComponent: 'domain'`. Genera un `renderCustomView` completo con empty state y DomainCard:

```tsx
import { createDomainCardView, createCardLoadingView } from "@/lib/view-helpers"

renderCustomView={isCustomView ? createDomainCardView('sales.saleorder', {
  onRowClick: (data) => toggleSelection(data),
  isSelected: (data) => hubConfig?.orderId === data.id,
  isHubOpen,
}) : undefined}
renderLoadingView={isCustomView ? createCardLoadingView('single-column') : undefined}
```

### `createEntityCardView(label, options)`
Para entidades con `cardComponent: 'entity'` o `'entity-compact'`. El consumidor proporciona un `renderCard` callback:

```tsx
renderCustomView={isCustomView ? createEntityCardView('inventory.product', {
  gridLayout: 'multi-column',
  renderCard: (product) => (
    <EntityCard key={product.id} variant="compact" onClick={...}>
      <EntityCard.Header title={product.name} />
    </EntityCard>
  ),
}) : undefined}
```

### `createCardLoadingView(layout, count)`
Genera un `renderLoadingView` con EntityCard.Skeleton en la geometría correcta:

```tsx
renderLoadingView={isCustomView ? createCardLoadingView('multi-column', 15) : undefined}
```

---

## 7. Vista default — `viewPolicy` en ENTITY_REGISTRY

Cada entidad define su política de vistas en `ENTITY_REGISTRY.viewPolicy`. El hook `useViewMode` lee esta metadata automáticamente.

| Entidad | Vistas | Default | Card Component |
|---|---|---|---|
| `sales.saleorder` | list, card | card | `domain` |
| `purchasing.purchaseorder` | list, card | card | `domain` |
| `billing.invoice` | list, card | card | `domain` |
| `production.workorder` | list, kanban | list | `custom` |
| `inventory.product` | list, grid | list | `entity-compact` |
| `contacts.contact` | list, card | list | `entity` |
| `hr.employee` | list, card | list | `entity` |
| Demás entidades | list (solo) | list | — |

**Regla:** Si una entidad no tiene `viewPolicy`, se asume vista `list` única (sin selector). Entidades de tipo Settings y Analíticas no deben tener multi-vista.

---

## 8. Guía de migración — `cardMode` → `variant`

Si encuentras código con `cardMode`:

```bash
# Buscar usos residuales
grep -r "cardMode" frontend/
```

Reemplazar mecánicamente:
- `cardMode={true}` → `variant="embedded"`
- `cardMode` (sin valor) → `variant="embedded"`
- `cardMode={false}` → `variant="standalone"`

---

## 9. Filas expandibles — `renderSubComponent` vs `ExpandableTableRow` (deprecado)

DataTable soporta filas expandibles de dos formas:

### 9.1 `renderSubComponent` — Camino preferido (nuevos desarrollos)

DataTable nativo ya incluye un slot `renderSubComponent` que renderiza un panel debajo de la fila cuando se expande (vía chevron en la columna o `onRowClick`). Desde la Fase 1 de centralización, incluye animación framer-motion (`AnimatePresence` + `motion.tr`).

```tsx
<DataTable
    columns={columns}
    data={data}
    renderSubComponent={createExpandableRowView({
        lazyLoad: (row) => fetchDetail(row.id),
        renderDetail: (row, detail) => <DetailPanel data={detail} />,
    })}
/>
```

Ver helper `createExpandableRowView` en `@/lib/view-helpers`.

**Cuándo usar:**
- Nuevos desarrollos que requieran detalle inline
- El detalle se carga bajo demanda (lazy fetch)
- Se quiere mantener la tabla como DataTable estándar sin custom views

### 9.2 `ExpandableTableRow` — 🔴 Deprecado

> **DEPRECADO:** Usa `renderSubComponent` de DataTable o el helper `createExpandableRowView()` para nuevos consumidores.
> `ExpandableTableRow` se eliminará en una versión futura.

Existente en:
- `ExpandableContactRow` en `PortfolioTable` (créditos vigentes) — pendiente de migración
- `ExpandableBlacklistRow` en `BlacklistView` (incobrables/bloqueados) — pendiente de migración

API (solo referencia, no usar en código nuevo):

```tsx
import { ExpandableTableRow } from "@/components/shared"

<ExpandableTableRow
    row={row}
    onExpand={(isExpanding) => {...}}
    cellClassName="py-3 px-4"
    panelClassName="px-8 py-4 bg-background"
>
    {loadingDetail ? <TableSkeleton rows={2} /> : <MyDetailPanel data={detail} />}
</ExpandableTableRow>
```

---

---
## 10. Toolbar Border, Shadow & Radius Contract

El toolbar del DataTable sigue una jerarquía visual consistente con el [design system](../10-architecture/design-system.md). Todos los elementos del toolbar deben respetar los siguientes niveles:

### 10.1 Border opacities

| Nivel | Clase | Opacidad efectiva | Elementos |
|-------|-------|-------------------|-----------|
| Container/Group | `border-border/50` | 7.5% | Button group container, separadores internos, botón "Limpiar" |
| Input/Trigger | `border-border/40` | 6% | Inputs de búsqueda, SelectTrigger de paginación |
| Overlay (dropdown/popover) | `border-border/80` | 12% | DropdownMenuContent, PopoverContent |

**Regla:** Usar siempre la opacidad del nivel correspondiente. No inventar opacidades intermedias (`/60`).

### 10.2 Shadow tokens

| Nivel | Token | Elementos |
|-------|-------|-----------|
| Card/surface | `shadow-card` | Button group container, ToolbarCreateButton, TableHeader |
| Floating/overlay | `shadow-floating` | DropdownMenuContent, PopoverContent |

**Regla:** Usar siempre los tokens semánticos del elevation system (`shadow-card`, `shadow-floating`), nunca Tailwind defaults (`shadow-sm`, `shadow-xl`, `shadow-md`).

### 10.3 Radius hierarchy

| Nivel | Clase | Tamaño | Elementos |
|-------|-------|--------|-----------|
| Contenedor toolbar | `rounded-md` | 12px | Button group container, ToolbarCreateButton, inputs de búsqueda, SelectTrigger, botones de paginación |
| Overlay (dropdown/popover) | `rounded-lg` | 16px | DropdownMenuContent, PopoverContent (heredado del base `ui/` component) |
| Atomic (items internos) | `rounded-sm` | 8px | DropdownMenuItem, checkbox, option items |
| Pill | `rounded-full` | ∞ | Badge de filtros activos, skeleton shapes |

**Regla:** No sobreescribir `rounded-lg` por `rounded-md` en overlays del toolbar. Los DropdownMenuContent y PopoverContent heredan el radius del componente base (`rounded-lg`).

### 10.4 Segmented button group

El grupo de botones del toolbar (Sort, Columnas, Vista, Acciones) usa el patrón de **segmented control**:
- Contenedor: `rounded-md border border-border/50 shadow-card divide-x divide-border/50`
- Botones internos: `rounded-none border-0`
- El `divide-x` reemplaza `border-r last:border-r-0` en cada hijo

## Checklist de PR

Cada PR que toque `DataTable` o sus consumidores debe verificar:

- [ ] `variant` declarado explícitamente (`"embedded"`, `"standalone"`, `"minimal"` o `"compact"`)
- [ ] `cardMode` **no** usado — solo `variant`
- [ ] `isLoading` pasado si el componente hace fetch asíncrono
- [ ] Si hay `viewOptions` con algo distinto de `"list"`: `renderCustomView` presente para esa opción
- [ ] Si hay `renderCustomView` y `isLoading`: `renderLoadingView` presente
- [ ] Multi-vista usa `useViewMode(entityLabel)` — no `useState` manual para la vista
- [ ] `viewOptions` generados desde registry (`getViewOptions`) — no arrays hardcodeados
- [ ] `renderCustomView` usa `createDomainCardView` / `createEntityCardView` cuando aplique — no inline JSX
- [ ] Default de vista definido en `ENTITY_REGISTRY.viewPolicy.defaultView`
- [ ] Card views usan `EntityCard` o `DomainCard` — **no inline JSX**
- [ ] `variant="minimal"` usado en tablas display dentro de tabs de producto/config (no en listados CRUD)
- [ ] `variant="minimal"` no recibe props de toolbar, paginación ni bulk actions
- [ ] `variant="compact"` siempre declara `gridTemplate`
- [ ] `variant="compact"` con `renderRowActions`: `gridTemplate` tiene `columns.length + 1` tracks
- [ ] Expandable rows nuevos usan `renderSubComponent` o `createExpandableRowView` — **no** `ExpandableTableRow`
