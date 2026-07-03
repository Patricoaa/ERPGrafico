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

### 10.2 Shadow tokens (elevation system)

| Token | CSS value | Elementos |
|-------|-----------|-----------|
| `shadow-card` | `0 1px 3px oklch(0.12 0.02 240 / 0.06)` | Cards, containers, tables, buttons, badges, small surfaces |
| `shadow-elevated` | `0 4px 16px oklch(0.12 0.02 240 / 0.08), 0 1px 4px oklch(0.12 0.02 240 / 0.04)` | Hover states, elevated cards (RatiosView, BIAnalyticsView), button emphasis |
| `shadow-floating` | `0 8px 32px oklch(0.12 0.02 240 / 0.12), 0 2px 8px oklch(0.12 0.02 240 / 0.06)` | DropdownMenu, Popover, Select, tooltips, floating sidebars, scroll buttons |
| `shadow-overlay` | `0 16px 48px oklch(0.12 0.02 240 / 0.16)` | Modals (BaseModal), Sheets/Drawers, search dialogs, full-screen overlays |

**Regla:** Usar **siempre** los tokens semánticos del elevation system. **Prohibido** usar Tailwind defaults (`shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`).

**Excepciones permitidas:**
- `shadow-none` — remoción explícita de sombra (selectores, tabs underline, contenedores anidados)
- `shadow-inner` — elementos decorativos inset (drag handles, dock containers) — no hay token semántico equivalente

### 10.3 Radius hierarchy

| Nivel | Clase | Tamaño | Elementos |
|-------|-------|--------|-----------|
| Contenedor toolbar | `rounded-md` | 12px | Button group container, ToolbarCreateButton |
| Atomic (elementos interactivos) | `rounded-sm` | 8px | Todos los botones del toolbar (Sort, Columnas, Vista, Acciones), inputs de búsqueda (SmartSearch), SelectTrigger, botones de paginación, DropdownMenuItem, checkbox, option items |
| Overlay (dropdown/popover) | `rounded-lg` | 16px | DropdownMenuContent, PopoverContent (heredado del base `ui/` component) |
| Pill | `rounded-full` | ∞ | Badge de filtros activos, skeleton shapes |

**Reglas:**
- Todos los elementos interactivos del toolbar son **atómicos** → `rounded-sm`.
- Los contenedores estructurales (button group container, ToolbarCreateButton) usan `rounded-md`.
- No sobreescribir `rounded-lg` por `rounded-md` en overlays del toolbar. Los DropdownMenuContent y PopoverContent heredan el radius del componente base (`rounded-lg`).

### 10.4 Segmented button group

El grupo de botones del toolbar (Sort, Columnas, Vista, Acciones) usa el patrón de **segmented control**:
- Contenedor: `rounded-md border border-border/50 shadow-card divide-x divide-border/50`
- Botones internos: `rounded-none border-0`
- El `divide-x` reemplaza `border-r last:border-r-0` en cada hijo

---

## 11. Agrupación de Cards por Fecha — `cardGroupBy` / `createCardGroupView`

### 11.1 Propósito

Agrupar visualmente las tarjetas de una vista `"card"` por fecha, mostrando un **encabezado de grupo** con:
- Label inteligente de fecha ("Hoy", "Ayer", "lunes", o fecha formateada)
- Sublabel con la fecha completa (ej: "19 de junio de 2026")
- **Total acumulado** de montos para el segmento (si se configura `amountField`)

Los encabezados son sticky (`sticky top-0 z-10`) para mantenerse visibles al hacer scroll dentro del grupo.

### 11.2 Activación vía `DataTableView` (camino preferido)

Agregar la prop `cardGroupBy` al `DataTableView`. Funciona con ambos tipos de card:

```tsx
// entity cardComponent — con renderCard
<DataTableView
  entityLabel="treasury.movement"
  cardGroupBy={{ dateField: 'date', amountField: 'amount' }}
  renderCard={(m: TreasuryMovement) => (
    <EntityCard key={m.id} onClick={() => handleViewDetails(m.id)}>
      <EntityCard.Header title={`Movimiento ${m.display_id}`} subtitle={m.date} trailing={<StatusBadge ... />} />
      <EntityCard.Body>
        <EntityCard.Field label="Monto" value={<DataCell.Currency value={m.amount} />} />
      </EntityCard.Body>
    </EntityCard>
  )}
/>

// domain cardComponent — sin renderCard
<DataTableView
  entityLabel="sales.saleorder"
  cardGroupBy={{ dateField: 'date', amountField: 'total' }}
/>
```

### 11.3 Activación vía Factory (uso directo con `renderCustomView`)

Usar `createCardGroupView` directamente para vistas custom:

```tsx
import { createCardGroupView, createCardLoadingView } from "@/lib/view-helpers"

renderCustomView={isCustomView ? createCardGroupView({
  renderCard: (data) => <DomainCard label="sales.saleorder" data={data} />,
  cardGroupBy: { dateField: 'date', amountField: 'total' },
  gridLayout: 'single-column',
  emptyState: { context: 'filter' },
  isFiltered: isFiltered,
}) : undefined}
renderLoadingView={isCustomView ? createCardLoadingView('single-column') : undefined}
```

### 11.4 API del factory

```ts
function createCardGroupView<TData>(options: {
  renderCard: (data: TData) => React.ReactNode
  cardGroupBy: {
    dateField: string   // campo que contiene la fecha (ISO string o Date)
    amountField?: string // campo opcional para sumar montos
  }
  gridLayout?: 'single-column' | 'multi-column'
  emptyState?: DataTableEmptyState
  isFiltered?: boolean
}): (table: ReactTable<TData>) => React.ReactNode
```

### 11.5 Comportamiento de labels de fecha

| Condición | Label | Sublabel |
|-----------|-------|----------|
| Misma fecha que hoy | `"Hoy"` | Fecha formateada (ej: "19 de junio de 2026") |
| Día anterior | `"Ayer"` | Fecha formateada |
| Últimos 7 días | Nombre del día (ej: "lunes") | Fecha formateada |
| Más de 7 días | Fecha formateada | — (vacío) |
| Sin fecha (null/vacío) | `"Sin fecha"` | — |

### 11.6 Reglas de renderizado

- Los encabezados usan `sticky top-0 z-10` para mantenerse visibles durante el scroll
- El total usa `MoneyDisplay` con `showColor={false}` (color neutral)
- Si no hay `amountField` o el total es 0, se omite la columna de total
- Cards se renderizan en gap `gap-2` (single-column) o `gap-3` (multi-column)
- El skeleton de carga usa el mismo `createCardLoadingView` que las vistas no segmentadas

### 11.7 Visual

```
┌────────────────────────────────────────────────────────┐
│ ◷  Hoy                           Total    $1.500.000   │  ← sticky header
│    19 de junio de 2026                                  │
│ ───────────────────────────────────────────────────────  │
├────────────────────────────────────────────────────────┤
│ [EntityCard]                                             │
│ [EntityCard]                                             │
├────────────────────────────────────────────────────────┤
│ ◷  Ayer                          Total     $850.000    │  ← sticky header
│    18 de junio de 2026                                  │
│ ───────────────────────────────────────────────────────  │
├────────────────────────────────────────────────────────┤
│ [EntityCard]                                             │
└────────────────────────────────────────────────────────┘
```

---

## 12. Analytics Panel — `analyticsPanel` prop

El `DataTable` soporta un botón de análisis en la Fila 2 (entre Sort y Column Toggle) que abre un `Drawer` con gráficos y métricas.

### 12.1 API

```tsx
<DataTable
  analyticsPanel={{
    screen: {
      entityName: "Órdenes de Compra",
      granularity,
      onGranularityChange: setGranularity,
      dateRange,
      onDateRangeChange: setDateRange,
      tabs: [
        {
          value: "financiero",
          label: "Financiero",
          icon: BarChart3,
          columns: [
            {
              id: "col-main",
              weight: 2,
              sections: [
                {
                  id: "combo-chart",
                  content: {
                    type: "stat-card",
                    config: {
                      label: "Volumen",
                      variant: "chart",
                      chart: {
                        type: "line-chart",
                        data: lineData,
                        enableArea: true,
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  }}
/>
```

- `onClick?`: callback cuando se presiona el botón (útil para tracking)
- `screen`: cuando está presente, renderiza un `AnalyticsPanel` dentro de un `Drawer` con `side="bottom"` y `defaultSize="70vh"`
- Cada tab tiene `columns` con `sections` que pueden ser `StatCard`, `Custom`, o chart directo (bar/line/pie)

### 12.2 Data flow

```
Consumer → AnalyticsPanelConfig (useMemo) → DataTable → DataTableToolbar
  → botón LayoutDashboard → Drawer → TabBar → AnalyticsLayout → StatCard/Chart
  → AnalyticsSegmentation (granularity, date range, card account)
```

### 12.3 Reglas

- Los datos de analytics deben venir de un hook dedicado (ej. `usePurchasingAnalyticsData`)
- `AnalyticsPanelConfig` se importa desde `@/components/shared`
- No abusar: reservar para entidades con volumen de datos que justifique análisis visual

---

## 13. Footer de Totales — `renderFooter` prop

Slot opcional para renderizar una fila de totales/sumario al final de la tabla.

```tsx
<DataTable
  renderFooter={(table) => {
    const rows = table.getFilteredRowModel().rows
    const total = rows.reduce((sum, r) => sum + r.original.amount, 0)
    return (
      <TableRow className="bg-muted/10 font-bold">
        <TableCell colSpan={3}>Total</TableCell>
        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
      </TableRow>
    )
  }}
/>
```

**Reglas:**
- Recibe la instancia `table` de TanStack — usar `getFilteredRowModel().rows` para respetar filtros activos
- Renderizar dentro de `<TableRow>` nativo (no DataTable row)
- Útil para tablas financieras (libro mayor, movimientos de socio)

---

## 14. Bulk Actions

El DataTable soporta dos mecanismos para acciones sobre filas seleccionadas, ambos renderizados en un `BulkActionDock` flotante.

### 14.1 `bulkActions` — Declarativo (preferido)

```tsx
const bulkActions = useMemo<BulkAction<Product>[]>(() => [
  {
    key: 'delete',
    label: 'Eliminar',
    icon: Trash2,
    intent: 'destructive',
    onClick: (items) => handleBulkDelete(items),
    disabled: (items) => items.some(item => !item.can_delete),
  },
], [])

<DataTable bulkActions={bulkActions} />
```

### 14.2 `bulkDock` — Escape hatch

Para UI de bulk action que no encaja en el modelo declarativo (selects, múltiples controles):

```tsx
<DataTable
  bulkDock={(items, clear) => (
    <BulkActionDock selectedCount={items.length} onClear={clear}>
      <Select onValueChange={(value) => handleBulkUpdate(items, value, clear)}>
        <SelectTrigger>Asignar Categoría</SelectTrigger>
        <SelectContent>
          <SelectItem value="cat-a">Categoría A</SelectItem>
        </SelectContent>
      </Select>
    </BulkActionDock>
  )}
/>
```

### 14.3 Reglas

- `bulkActions` declarativo para acciones simples (eliminar, cambiar estado)
- `bulkDock` escape hatch reservado para UIs complejas (selects, formularios inline)
- Ambos reciben envoltura consistente de `BulkActionDock` (floating dock, pill de conteo, botón limpiar)

---

## 15. Toolbar — Slot de Acciones Secundarias

El toolbar tiene dos mecanismos para el dropdown "Acciones" en la esquina superior derecha:

### 15.1 `toolbarActions` — Typed (preferido)

```tsx
import type { ToolbarActionItem } from '@/components/shared'

const actions: ToolbarActionItem[] = [
  {
    key: 'deposit',
    label: 'Registrar Aporte',
    icon: Wallet,
    onClick: () => openDeposit(),
    intent: 'success',
  },
  {
    key: 'withdraw',
    label: 'Registrar Retiro',
    icon: LogOut,
    onClick: () => openWithdraw(),
    intent: 'destructive',
  },
]

<DataTable toolbarActions={actions} />
```

### 15.2 `toolbarAction` — Legacy (deprecado)

Acepta `ReactNode` de `<DropdownMenuItem>`. Migrar a `toolbarActions`.

### 15.3 Intent → Color mapping

| Intent      | Color     |
|-------------|-----------|
| `default`   | primary   |
| `primary`   | primary   |
| `success`   | success   |
| `destructive` | destructive |

---

## 16. SmartSearchBar — `prefix` slot

El `SmartSearchBar` acepta un slot `prefix?: ReactNode` renderizado antes del ícono de búsqueda. Útil para badges de contexto (cuenta activa, filtro permanente).

```tsx
<SmartSearchBar
  searchDef={mySearchDef}
  prefix={isFiltered ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-info/10 text-info border border-info/20 text-[10px] font-black uppercase tracking-wider font-mono shrink-0">
      Cta. #123
      <button onClick={handleClear}>×</button>
    </span>
  ) : undefined}
/>
```

---

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
- [ ] Si se usa `cardGroupBy`: `dateField` requerido; `amountField` opcional
- [ ] `cardGroupBy` compatible con `cardComponent: 'domain'` y `cardComponent: 'entity'`
- [ ] `createCardGroupView` usa `renderCard` con firma `(data: TData) => ReactNode` (no recibe `row`)
- [ ] Los grupos se ordenan descendente por fecha (más reciente primero)
- [ ] Items sin fecha se agrupan al final bajo "Sin fecha"
- [ ] La agrupación visual (`cardGroupBy`) es ortogonal al filtrado del toolbar (`SegmentationBar`) — uno filtra, el otro organiza
- [ ] Usar `groupByDate` desde `@/lib/group-by-date` si se necesita agrupación fuera del factory
- [ ] `analyticsPanel` usado solo si hay hook de datos dedicado (no construir inline en el componente)
- [ ] `renderFooter` usado solo para tablas financieras que requieren fila de totales
- [ ] `bulkActions` preferido sobre `bulkDock` para acciones declarativas
- [ ] `toolbarActions` preferido sobre `toolbarAction` legacy
- [ ] `toolbarActions` usa `intent` semántico (no className inline)
- [ ] `SmartSearchBar` con `prefix` para decoraciones contextuales (no wrapper divs)
