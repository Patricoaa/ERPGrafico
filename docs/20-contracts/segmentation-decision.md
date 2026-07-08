---
layer: 20-contracts
doc: segmentation-decision
status: active
owner: frontend-team
created: 2026-06-19
last_review: 2026-06-19
stability: stable
scope: Contrato para SegmentationBar — filtros de estado (tabs/dropdown) y fechas en toolbar Fila 1
---

# Contrato: SegmentationBar — Filtros de Segmentación en Toolbar

`SegmentationBar` es el componente que reemplaza los antiguos campos `type: 'enum'`,
`type: 'daterange'` y `type: 'identity-enum'` de `SmartSearchBar`. Los filtros de
estado operacional, tipo de documento, clasificación de entidad y rangos de fecha
se declaran como `SegmentationDefinition` y se renderizan en la Fila 1 del toolbar
del DataTable.

---

## Árbol de decisión

```
¿El filtro tiene opciones predefinidas (conjunto cerrado)?
│
├── NO → SmartSearchBar (text, búsqueda libre)
│       Ej: nombre, RUT, código, descripción
│
└── SÍ → SegmentationBar (Row 1)
    │
    ├── ¿Es un filtro de fecha?
    │   │
    │   └── SÍ → DateSegment (Popover + Calendar)
    │           Modos: "Todos", "Fecha única", "Rango"
    │
    ├── ¿Es clasificación de entidad con defaultValue requerido?
    │   │
    │   └── SÍ → DropdownSegment con defaultValue
    │           Ej: selector de tarjeta (card), alcance (scope)
    │           No muestra "Todos" — siempre hay un valor activo
    │
    ├── ¿Son 2-6 opciones y el orden importa?
    │   │
    │   └── SÍ → TabSegment (Tabs, `variant: 'tabs'`)
    │           Ej: estado (Borrador/Publicado/Anulado), tipo contacto (Cliente/Proveedor)
    │
    ├── ¿Selección múltiple (checkboxes) o filtro dinámico desde datos?
    │   │
    │   └── SÍ → MultiSelectSegment (Popover + checkboxes)
    │           Usar `dynamic: true` + `columnId` para valores desde TanStack
    │           Ej: estado reconciliación, período, origen (action_log/history)
    │
    └── ¿Son muchas opciones (>6) o secundarias?
        │
        └── SÍ → DropdownSegment (DropdownMenu, `variant: 'dropdown'`)
                Ej: tipo de DTE (33/34/35/…), cuenta bancaria, tipo de producto
```

---

## API de types

```ts
// types/segmentation.ts

type TabSegmentDef = {
  key: string
  label: string
  type: 'tabs'
  serverParam: string
  variant?: 'tabs' | 'dropdown'  // default 'tabs'
  defaultValue?: string           // valor inicial; isFiltered lo ignora
  options: { label: string; value: string; icon?: LucideIcon }[]
}

type DateSegmentDef = {
  key: string
  label: string
  type: 'date'
  serverParamDate?: string   // server param for single date mode
  serverParamFrom: string    // server param for range start
  serverParamTo: string      // server param for range end
}

type MultiSelectSegmentDef = {
  key: string
  label: string
  type: 'multiselect'
  serverParam: string
  columnId?: string            // TanStack column id (requerido si dynamic:true)
  dynamic?: boolean            // si true, obtiene opciones de TanStack getFacetedUniqueValues
  options?: { label: string; value: string; icon?: LucideIcon }[]
}

type CustomSegmentDef = {
  key: string
  type: 'custom'
  render: (helpers: { apply: (key: string, value: string) => void; remove: (key: string) => void }) => React.ReactNode
}

type SegmentDef = TabSegmentDef | DateSegmentDef | MultiSelectSegmentDef | CustomSegmentDef

type SegmentationDefinition = {
  segments: SegmentDef[]
}
```

---

## Ejemplo de uso

```tsx
// features/sales/segmentationDef.ts
export const salesOrderSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Confirmado', value: 'CONFIRMED' },
        { label: 'Enviado', value: 'SENT' },
        { label: 'Entregado', value: 'DELIVERED' },
        { label: 'Facturado', value: 'INVOICED' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
    {
      key: 'date',
      label: 'Fecha',
      type: 'date',
      serverParamDate: 'date',
      serverParamFrom: 'date_after',
      serverParamTo: 'date_before',
    },
  ],
}
```

```tsx
// En el componente
const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg }
  = useSegmentation(salesOrderSegDef)

<DataTableView
  smartSearch={<SmartSearchBar ... />}
  segmentation={<SegmentationBar def={salesOrderSegDef} />}
  showReset={isTextFiltered || isSegFiltered}
  onReset={() => { clearText(); clearSeg() }}
  isFiltered={isTextFiltered || isSegFiltered}
/>
```

Los filtros de segmentación se combinan con los de texto al llamar al backend:

```tsx
const allFilters = { ...textFilters, ...segFilters }
const { data } = useMyEntities(allFilters)
```

---

## Reglas de renderizado

| variant | Componente UI | Cuándo |
|---|---|---|
| `tabs` (default) | shadcn `Tabs` + `TabsList` | 2-6 opciones principales (estado, tipo) |
| `dropdown` | shadcn `DropdownMenu` | >6 opciones o secundarias (tipo DTE, cuenta) |

Los Tabs se renderizan en línea con `h-7, text-[10px], uppercase, font-bold, tracking-widest`.
Dropdown también usa ese mismo estilo visual en el trigger.

---

## DateSegment — modos

El DateSegment abre un Popover con Calendar (react-day-picker v9) y tres sub-tabs:

| Modo | serverParam enviado |
|---|---|
| **Todos** | Ninguno (limpia from/to) |
| **Fecha única** | `serverParamDate` = valor seleccionado |
| **Rango** | `serverParamFrom` + `serverParamTo` |

---

## URL sync

`useSegmentation` usa `nuqs` para sincronizar cada segmento con un query param en la URL.
Los valores persisten en la URL y soportan deeplinks y navegación con historial.

---

## Invariantes (violación = PR rechazado)

| Regla | Detalle |
|---|---|
| No mezclar `type: 'enum'`, `type: 'identity-enum'` ni `type: 'daterange'` en searchDef | Status, clasificación, fecha → segmentationDef |
| `SegmentationBar` se renderiza en Fila 1 del toolbar | Pasa como prop `segmentation` a DataTable/DataTableView |
| `useSegmentation` se importa desde `@/components/shared` | Barrel only |
| `SegmentationDefinition` se declara en `features/[app]/segmentationDef.ts` | Un archivo por feature, exportado desde `index.ts`. Excepción: segDefs dinámicos inline en vistas complejas (ej. card-statements) |
| No renderizar SegmentationBar si `segments.length === 0` | El componente retorna `null` internamente |
| DateSegment importa `DateRange` de `react-day-picker` como type-only | Evita bundling innecesario |
| Un segmento `date` sin `serverParamDate` oculta el modo "Fecha única" | El modo "Todos" y "Rango" siempre están disponibles |
| Si un segmento tiene `defaultValue`, `isFiltered` no lo cuenta como filtro activo | El valor default es el estado "neutro"; solo filtros distintos del default se consideran activos |
 | `customFilters` está deprecado desde 2026-06 | Los filtros de entidad (card, scope) y estado van en SegmentationBar. No crear nuevos customFilters. |
| `facetedFilters` está deprecado desde 2026-06 | Migrar a `MultiSelectSegmentDef` con `dynamic: true` + `columnId`. Ver Phase 6 del rollout. |
| `MultiSelectSegmentDef.dynamic: true` requiere `columnId` | `columnId` debe coincidir con `accessorKey` de la columna TanStack para sincronizar filtro client-side. |
| `CustomSegmentDef` no sincroniza URL automáticamente | El consumer decide si usa `serverParam` via `apply`/`remove` para persistir en URL. |
| `icon` en opciones solo se muestra en MultiSelectSegment | TabSegment y DropdownSegment ignoran `icon` visualmente en este release. |
