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

`SegmentationBar` es el componente que reemplaza los antiguos campos `type: 'enum'`
y `type: 'daterange'` de `SmartSearchBar`. Los filtros de estado operacional, tipo
de documento y rangos de fecha se declaran como `SegmentationDefinition` y se
renderizan en la Fila 1 del toolbar del DataTable.

---

## Árbol de decisión

```
¿El filtro representa estado operacional, tipo de documento, o rango de fecha?
│
├── NO → Usar SmartSearchBar (text) o identity-enum (clasificación de entidad)
│
└── SÍ
    │
    ├── ¿Son 2-6 opciones bien definidas y el orden importa?
    │   │
    │   └── SÍ → TabSegment (shadcn Tabs, `variant: 'tabs'`)
    │           Ej: estado (Borrador/Publicado/Anulado), tipo (Entrada/Salida/Ajuste)
    │
    ├── ¿Son muchas opciones (>6) o secundarias?
    │   │
    │   └── SÍ → DropdownSegment (DropdownMenu, `variant: 'dropdown'`)
    │           Ej: tipo de DTE (33/34/35/…), cuenta bancaria, método de pago
    │
    └── ¿Es un filtro de fecha?
        │
        └── SÍ → DateSegment (Popover + Calendar)
                Modos: "Todos", "Fecha única", "Rango"
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
  options: { label: string; value: string }[]
}

type DateSegmentDef = {
  key: string
  label: string
  type: 'date'
  serverParamDate?: string   // server param for single date mode
  serverParamFrom: string    // server param for range start
  serverParamTo: string      // server param for range end
}

type SegmentDef = TabSegmentDef | DateSegmentDef

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
| No mezclar `type: 'enum'` en searchDef | Los status/tipo van en segmentationDef, no en searchDef |
| `SegmentationBar` se renderiza en Fila 1 del toolbar | Pasa como prop `segmentation` a DataTable/DataTableView |
| `useSegmentation` se importa desde `@/components/shared` | Barrel only |
| `SegmentationDefinition` se declara en `features/[app]/segmentationDef.ts` | Un archivo por feature, exportado desde `index.ts` |
| No renderizar SegmentationBar si `segments.length === 0` | El componente retorna `null` internamente |
| DateSegment importa `DateRange` de `react-day-picker` como type-only | Evita bundling innecesario |
| Un segmento `date` sin `serverParamDate` oculta el modo "Fecha única" | El modo "Todos" y "Rango" siempre están disponibles |
