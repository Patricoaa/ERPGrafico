---
layer: 20-contracts
doc: unified-searchbar
status: active
owner: frontend-team
created: 2026-07-09
updated: 2026-07-09
last_review: 2026-07-09
stability: stable
scope: Contrato único para UnifiedSearchBar — reemplaza SmartSearchBar + SegmentationBar + GroupBy. Búsqueda por texto, filtros dropdown, filtros de fecha, group-by y chips en un solo componente.
---

# Contrato: UnifiedSearchBar — Barra de Búsqueda y Filtros Unificada

`UnifiedSearchBar` reemplaza los tres componentes anteriores:
- `SmartSearchBar` (búsqueda de texto)
- `SegmentationBar` (filtros de estado/fecha/clasificación)
- `GroupBy` (agrupación en vista de tarjetas)

Todo `DataTable` con búsqueda/filtrado debe usar `UnifiedSearchBar` como prop `unifiedSearch`.
No existen más `searchDef.ts` ni `segmentationDef.ts` — todo se define en un único archivo `unifiedSearchDef.ts` por feature.

---

## Árbol de decisión

```
¿La vista tiene un DataTable con datos filtrables?
│
├── NO → No aplica searchbar (ej. /treasury/reconciliation, vistas agregadas)
│
└── SÍ → UnifiedSearchBar + useUnifiedSearch
    │
    ├── ¿El dataset requiere filtros server-side (paginación, deeplinks/URL sync)?
    │   │
    │   └── SÍ → Configurar serverParam en cada field. Hook acepta filters.
    │           Requisitos: ViewSet con filter_backends + FilterSet
    │
    └── NO (dataset pequeño/estático, < ~100 registros)
        │
        └── Usar clientKey para filtrado client-side.
            Sin cambios de backend. filterFn aplica filtros sobre datos ya cargados.
            URL sync, chips y deeplinks funcionan igual que server-side.
```

---

## UnifiedSearchConfig — Definición de búsqueda

Toda la configuración se declara en un único objeto `UnifiedSearchConfig`:

```typescript
// features/[app]/unifiedSearchDef.ts
export const myUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'search', label: 'Nombre', serverParam: 'search' },
  ],
}
```

### searchFields — Campos de texto

```typescript
interface TextFieldDef {
  key: string
  label: string
  serverParam: string
  suggestionsUrl?: string
  clientKey?: string | string[]
}
```

| Prop | Uso |
|------|-----|
| `serverParam` | Query param enviado al backend |
| `suggestionsUrl` | URL para autocomplete (endpoint que retorna sugerencias) |
| `clientKey` | Solo para filtrado client-side: campos del objeto donde buscar |

### filters — Filtros dropdown

Se renderizan en el menú desplegable del searchbar. Tipos disponibles:

| Type | Componente UI | Cuándo |
|------|--------------|--------|
| `toggle` | Switch on/off | Filtro booleano (ej. "Solo activos") |
| `date` | Popover con presets + calendario | Rangos de fecha predefinidos |
| `range` | Inputs "Desde" / "Hasta" | Rango numérico (cantidad, monto) |
| `multi` | Popover con checkboxes | Selección múltiple desde opciones fijas o dinámicas |
| `single` | Dropdown de selección única | Clasificación con defaultValue (tarjeta, alcance) |
| `custom` | Renderizado arbitrario | Filtros especiales sin equivalente nativo |

### dateFilters — Filtros de fecha con presets

```typescript
interface DateFilterDef {
  type: 'date'
  key: string
  label: string
  options: DateFilterOption[]
}
```

Cada `DateFilterOption` puede tener:
- `serverParamFrom` / `serverParamTo` estáticos (fijo)
- `getValue` dinámico (calcula fechas relativas como "today", "thisMonth")
- Modo "Todos" (limpia los params) disponible automáticamente

### basePeriod — Período base

```typescript
basePeriod?: {
  serverParamFrom: string
  serverParamTo: string
}
```

Establece el rango inicial del filtro de fecha por defecto (visible al abrir el date filter).

### groupBy — Agrupación para vista de tarjetas

```typescript
interface GroupByOptionDef {
  key: string
  label: string
  field: string
  default?: boolean
}
```

Se renderiza en el panel derecho del menú de filtros. Controla cómo se agrupan las tarjetas en card view.

---

## useUnifiedSearch Hook

### Firma

```typescript
function useUnifiedSearch(config: UnifiedSearchConfig): UseUnifiedSearchReturn
```

### Return type

```typescript
interface UseUnifiedSearchReturn {
  filters: Record<string, string>           // Active filters (non-null only)
  paramValues: Record<string, string | null> // All URL param values
  chips: UnifiedChip[]                       // Chip descriptors for active filters
  isFiltered: boolean                        // true when chips.length > 0
  groupBy: string | null                     // Current group_by key
  setGroupBy: (key: string | null) => Promise<void>
  applyFilter: (param: string, value: string) => Promise<void>
  removeFilter: (param: string) => Promise<void>
  clearAll: () => Promise<void>
  inputValue: string                         // Local text input state
  setInputValue: (val: string) => void
  filterFn: <T>(data: T[]) => T[]           // Client-side filter function
}
```

| Prop | Propósito |
|------|-----------|
| `filters` | Pasar como props a hooks de datos: `useMyEntities(search.filters)` |
| `paramValues` | Pasar a `<UnifiedSearchBar paramValues={...}>` |
| `chips` | Pasar a `<UnifiedSearchBar chips={...}>` para mostrar chips activos |
| `isFiltered` | Controlar `showReset` y `onReset` en DataTable |
| `applyFilter` | Aplica un filtro y resetea cursor a null |
| `removeFilter` | Remueve un filtro y resetea cursor a null |
| `clearAll` | Limpia todos los filtros excepto el param `selected` |
| `filterFn` | Filtrado client-side para datasets pequeños sin paginación server-side |

### Comportamiento interno

- Usa `nuqs` para sincronizar todos los filtros con query params en la URL.
- `applyFilter` / `removeFilter` siempre resetean `cursor` (paginación) a `null`.
- El param `selected` se preserva a través de `clearAll()`.
- Los chips multi-select muestran "N seleccionados" cuando hay más de un valor.

---

## UnifiedSearchBar — Props del componente

```typescript
interface UnifiedSearchBarProps {
  config: UnifiedSearchConfig
  chips: UnifiedChip[]
  isFiltered: boolean
  inputValue: string
  onInputChange: (val: string) => void
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
  onClearAll: () => Promise<void>
  groupBy: string | null
  onGroupBySelect: (key: string | null) => Promise<void>
  paramValues: Record<string, string | null>
  placeholder?: string
  className?: string
  prefix?: React.ReactNode
}
```

### prefix — Controles inline

El prop `prefix` permite insertar controles dentro del input del searchbar, antes del icono de búsqueda. Usos comunes:

- Selector de cuenta bancaria / tarjeta
- Badge de filtro fijo con botón de limpiar
- Filtro de categoría inline

### Teclas y comportamiento

| Tecla | Acción |
|-------|--------|
| Enter | Commits el texto como filtro `search` global |
| Backspace (input vacío) | Remueve el último chip |
| Escape | Cierra el popover de filtros |
| Flecha abajo (input) | Abre el menú de filtros |

---

## Patrón canónico — server-side con UnifiedSearchBar

```tsx
// 1. unifiedSearchDef
export const myEntityUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'search', label: 'Nombre', serverParam: 'search' },
  ],
  filters: [
    {
      key: 'status',
      label: 'Estado',
      type: 'single',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' },
      ],
    },
  ],
}

// 2. En el componente (Client Component)
const search = useUnifiedSearch(myEntityUnifiedSearchDef)

const { data } = useMyEntities(search.filters)

<DataTable
  data={data ?? []}
  columns={columns}
  unifiedSearch={
    <UnifiedSearchBar
      config={myEntityUnifiedSearchDef}
      chips={search.chips}
      isFiltered={search.isFiltered}
      inputValue={search.inputValue}
      onInputChange={search.setInputValue}
      onApply={search.applyFilter}
      onRemove={search.removeFilter}
      onClearAll={search.clearAll}
      groupBy={search.groupBy}
      onGroupBySelect={search.setGroupBy}
      paramValues={search.paramValues}
    />
  }
  unifiedSearchConfig={myEntityUnifiedSearchDef}
  currentGroupBy={search.groupBy}
  showReset={search.isFiltered}
  onReset={search.clearAll}
/>
```

---

## Patrón canónico — client-side

```tsx
export const mySmallListUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search', label: 'Nombre', serverParam: 'search',
      clientKey: ['name', 'code'],
    },
  ],
}

// En el componente
const search = useUnifiedSearch(mySmallListUnifiedSearchDef)
const { data } = useMyStaticEntities()
const filtered = search.filterFn(data ?? [])

<DataTable
  data={filtered}
  columns={columns}
  unifiedSearch={<UnifiedSearchBar ... />}
/>
```

---

## Patrón con prefix (controles inline)

```tsx
<UnifiedSearchBar
  config={config}
  {...search}
  prefix={
    <div className="flex items-center gap-0">
      <CategoryFilter />
      <WarehouseFilter />
    </div>
  }
/>
```

---

## Patrón con placeholder dinámico

```tsx
<UnifiedSearchBar
  config={config}
  {...search}
  placeholder={viewMode === 'orders' ? 'Buscar órdenes...' : 'Buscar notas...'}
/>
```

---

## Patrón con config inline

```tsx
const config: UnifiedSearchConfig = useMemo(() => ({
  searchFields: [
    { key: 'search', label: 'Producto / SKU', serverParam: 'search', clientKey: ['name', 'code'] },
  ],
  filters: [
    { type: 'range', key: 'stock_qty', label: 'Stock (Físico)',
      serverParamFrom: 'stock_qty_from', serverParamTo: 'stock_qty_to' },
  ],
}), [])
const search = useUnifiedSearch(config)
```

---

## Reglas de renderizado de filtros

| Filter type | UI | Cuándo |
|-------------|-----|--------|
| `toggle` | Switch | Booleano on/off (activo/inactivo) |
| `date` | Popover + Calendar + presets | Rangos de fecha predefinidos |
| `range` | Inputs numéricos Desde/Hasta | Rango de cantidad o monto |
| `multi` | Popover + checkboxes | Selección múltiple (estático o dinámico) |
| `single` | Dropdown de selección única | defaultValue requerido (tarjeta, alcance) |
| `custom` | ReactNode arbitrario | Casos especiales |

---

## URL sync

`useUnifiedSearch` usa `nuqs` para sincronizar cada filtro con un query param en la URL.
Los valores persisten en la URL y soportan deeplinks y navegación con historial.

---

## Migración desde SmartSearchBar + SegmentationBar

| Viejo | Nuevo |
|-------|-------|
| `searchDef.ts` con `fields: [{ type: 'text', ... }]` | `unifiedSearchDef.ts` con `searchFields: [{ ... }]` |
| `segmentationDef.ts` con `segments: [{ type: 'tabs', ... }]` | `unifiedSearchDef.ts` con `filters: [{ type: 'single', ... }]` |
| `SegmentationBar` + `SmartSearchBar` separados | Único `UnifiedSearchBar` |
| `useSmartSearch()` + `useSegmentation()` | Único `useUnifiedSearch()` |
| `leftAction={<SmartSearchBar ... />}` + `segmentation={<SegmentationBar ... />}` | `unifiedSearch={<UnifiedSearchBar ... />}` |
| `searchDef.fields[type: 'enum']` | `filters: [{ type: 'single' | 'multi', ... }]` |
| `searchDef.fields[type: 'daterange']` | `filters: [{ type: 'date', ... }]` |
| `searchDef.fields[type: 'identity-enum']` | `filters: [{ type: 'single', ... }]` |
| `filterFn` llamada manual | `search.filterFn(data)` |

---

## Invariantes (violación = PR rechazado)

| Regla | Detalle |
|-------|---------|
| No usar `SmartSearchBar` ni `SegmentationBar` | Ambos fueron eliminados. Usar `UnifiedSearchBar` |
| No importar desde `searchDef.ts` ni `segmentationDef.ts` | Usar `unifiedSearchDef.ts` |
| No existe `leftAction` para searchbar | El searchbar se pasa como prop `unifiedSearch` a `DataTable`/`DataTableToolbar` |
| `useUnifiedSearch` se importa desde `@/components/shared` | Barrel only |
| `UnifiedSearchConfig` se declara en `features/[app]/unifiedSearchDef.ts` | Un archivo por feature, exportado desde `index.ts` |
| `TextFieldDef` no tiene tipos `enum`, `daterange`, `identity-enum` | Esos tipos fueron eliminados. Usar `filters` en el config |
| `filterFn` solo para datasets sin paginación server-side | Si el hook pagina server-side, usar `search.filters` |
| `clientKey` solo para `useClientSearch` | Ignorado por el backend; filtrar con `filterFn` |
| `prefix` para controles inline, no para filtros principales | Los filtros van en `filters[]` del config |
| No mezclar filtros en `searchFields` y `filters` | `searchFields` = texto libre; `filters` = dropdown/predefinidos |
| `MultiSelectFilterDef.dynamic: true` requiere `columnId` | `columnId` debe coincidir con `accessorKey` de TanStack |

---

## Tabla de decisión por ruta (estado actual)

Ver `features/*/unifiedSearchDef.ts` para la lista completa. Cada feature tiene su propio archivo de configuración.

| Feature | Archivo |
|---------|---------|
| Contacts | `features/contacts/unifiedSearchDef.ts` |
| Sales | `features/sales/unifiedSearchDef.ts` |
| Billing | `features/billing/unifiedSearchDef.ts` |
| Purchasing | `features/purchasing/unifiedSearchDef.ts` |
| Inventory | `features/inventory/unifiedSearchDef.ts` |
| Treasury | `features/treasury/unifiedSearchDef.ts` |
| Accounting | `features/accounting/unifiedSearchDef.ts` |
| HR | `features/hr/unifiedSearchDef.ts` |
| Production | `features/production/unifiedSearchDef.ts` |
| POS | `features/pos/unifiedSearchDef.ts` |
| Settings | `features/settings/unifiedSearchDef.ts` |
| Bank Reconciliation | `features/finance/bank-reconciliation/unifiedSearchDef.ts` |
