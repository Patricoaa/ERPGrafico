---
id: 0054
title: Entity Fields Schema — declarative field mapping for DataTable / EntityCard / Kanban
status: Superseded by 0066
date: 2026-07-14
author: core-team
---

# 0054 — Entity Fields Schema

**Superseded by:** ADR-0066 (discriminated-union `FieldDef` + total type→cell registry).
**Related:** ADR-0023 (ROW_ACTIONS registry), ADR-0028 (entity-drawer registry)

> El factory `createEntityFields<T>()` introducido aquí sigue vigente. La estructura de
> `FieldDef<T>` fue reemplazada por una unión discriminada (ADR-0066) y la tabla D-03 a
> continuación es **histórica** — el mapeo vigente `type` → `DataCell` vive en el motor
> `entity-fields` (ADR-0066/0067) y está documentado en
> [component-fields.md](../../20-contracts/component-fields.md).

---

## Context

Cada vista de entidad (DataTable, EntityCard, Kanban) re-mapea independientemente los mismos
campos de datos hacia componentes DataCell. El resultado es DRY violado en ~861 usos de DataCell
distribuidos en ~89 archivos, con tres patrones de mapeo diferentes:

| Vista | Patrón actual | Ejemplo |
|-------|---------------|---------|
| **DataTable** | `row.getValue("total")` → cast → `DataCell.Currency` | ColumnDef inline |
| **EntityCard** | `entity.total` → `parseFloat()` → `DataCell.Currency` | `renderCard` callback |
| **Kanban** | `order.total` → `<p>` HTML crudo (¡sin DataCell!) | JSX directo |

El sistema ya tiene un precedente de "una definición, múltiples superficies" con
`createEntityActions` para acciones (ADR-0023). La extensión natural es aplicar el mismo
patrón a los campos de datos.

## Decision

Crear `createEntityFields<T>()` — un factory genérico que define campos una vez y genera la
representación correcta para cada superficie de renderizado.

### D-01: Tipo `FieldDef<T>`

```ts
type FieldType =
  | 'text' | 'code' | 'date' | 'currency' | 'status'
  | 'number' | 'secondary' | 'contact' | 'chip' | 'icon'
  | 'progress' | 'numericFlow' | 'currencyFlow'

type FieldSurface = 'table' | 'card' | 'kanban'

interface FieldDef<T> {
  key: keyof T & string
  type: FieldType
  label: string
  header?: string                      // override DataTable header (default: label)
  get?: (entity: T) => unknown         // transform (default: entity[key])
  cellProps?: Record<string, unknown>  // extra DataCell props
  surfaces?: FieldSurface[]            // default: ['table', 'card', 'kanban']
  tableOptions?: {
    width?: number
    enableSorting?: boolean
    align?: 'left' | 'center' | 'right'
  }
  kanbanOptions?: {
    priority?: 'primary' | 'secondary'
  }
}
```

### D-02: API del factory `createEntityFields<T>()`

```ts
function createEntityFields<T>() {
  return (defs: Record<string, FieldDef<T>>) => ({
    /** ColumnDef<T>[] — genera columnas DataTable con DataCell correcto */
    toColumns(): ColumnDef<T>[]

    /** Array<{ key, label, value: ReactNode }> — genera EntityCard.Field items */
    toCardFields(entity: T, opts?: { only?: string[] }): CardField[]

    /** Array<{ key, label, value: ReactNode }> — genera campos compactos para Kanban */
    toKanbanFields(entity: T, opts?: { only?: string[] }): KanbanField[]

    /** ReactNode — renderiza un campo individual (para casos ad-hoc) */
    render(fieldKey: string, entity: T): ReactNode

    /** Acceso raw al schema (para componentes que necesitan más control) */
    defs: Record<string, FieldDef<T>>
  })
}
```

### D-03: Mapping type → DataCell

| `type` | DataTable (ColumnDef) | EntityCard | Kanban |
|--------|----------------------|------------|--------|
| `text` | `DataCell.Text` | `DataCell.Text` | `DataCell.Text` (truncated) |
| `code` | `DataCell.Code` | `DataCell.Code` | `DataCell.Code` (sm) |
| `date` | `DataCell.Date` | `DataCell.Date` | `DataCell.Date` |
| `dateTime` | `DataCell.Date` (showTime) | `DataCell.Date` (showTime) | `DataCell.Date` (showTime) |
| `currency` | `DataCell.Currency` | `DataCell.Currency` | `DataCell.Currency` (sm) |
| `status` | `DataCell.Status` | `DataCell.Status` | `DataCell.Status` (sm) |
| `number` | `DataCell.Number` | `DataCell.Number` | `DataCell.Number` |
| `secondary` | `DataCell.Secondary` | `DataCell.Secondary` | `DataCell.Secondary` |
| `contact` | `DataCell.ContactLink` | `DataCell.ContactLink` | `DataCell.ContactLink` |
| `chip` | `DataCell.Chip` | `DataCell.Chip` | `DataCell.Chip` (xs) |
| `chip-category` | `DataCell.Category` | `DataCell.Category` | `DataCell.Category` |
| `currencyFlow` | `DataCell.CurrencyFlow` | `DataCell.CurrencyFlow` | `DataCell.CurrencyFlow` |
| `sourceDest` | `DataCell.SourceDest` | `DataCell.SourceDest` | `DataCell.SourceDest` |
| `computed` | `render(entity)` | `render(entity)` | `render(entity)` |

> Nota (ADR-0066/0067): los fieldtypes `icon`, `progress` y `numericFlow` fueron removidos
> por ADR-0066 (cero usos); sus renderers siguen disponibles como componentes `DataCell.Icon`,
> `DataCell.Progress`, `DataCell.NumericFlow`. `numericFlow` fue **reintroducido** por ADR-0067
> como tipo declarativo (rol `flow`). `computed` es el único escape hatch y
> `fieldRole: 'complex'` reproduce el routing always-header del antiguo `complex`.

### D-04: Convención de archivos

Cada feature define sus campos en un archivo `*Fields.ts` al lado del view principal:

```
features/inventory/
├── components/
│   └── ProductClientView.tsx
└── productFields.ts

features/treasury/components/
├── TreasuryAccountsClientView.tsx
└── treasuryAccountFields.ts
```

### D-05: Composición con `createEntityActions`

Los campos y acciones se componen independientemente. Las acciones ya están resueltas por
`createEntityActions` (ADR-0023) y NO se duplican en el schema de campos:

```tsx
const orderFields = createEntityFields<Order>()({ ... })
const orderActions = createEntityActions<Order, Ctx>(...)

// DataTable: composición explícita
const columns = [...orderFields.toColumns(), orderActions.auto(ctx)]

// EntityCard: campos + acciones por separado
<EntityCard actions={orderActions.render(order, ctx)}>
  <EntityCard.Body>
    {orderFields.toCardFields(order)}
  </EntityCard.Body>
</EntityCard>
```

## Consequences

### Positivas
- Una sola definición de campos alimenta DataTable, EntityCard y Kanban — eliminar DRY.
- Kanban adopta DataCell (uniformidad visual) en vez de HTML crudo.
- Los transforms (`parseFloat`, `formatRUT`, ternarios de status) viven en `get` una sola vez.
- New features definen un `*Fields.ts` y obtienen las 3 vistas gratis.
- Type-safe: `FieldDef<T>` garantiza que `key` existe en la entidad.

### Negativas / Riesgos
- Migración de ~89 archivos en ~10 PRs — riesgo de merge conflicts.
- EntityCard con layouts custom (Hero cards, Product con imagen) necesitan `render()` o
  configuración adicional — no todo cabe en `toCardFields()` lineal.
- Nuevo archivo compartido (`entity-fields.tsx`) — punto central a mantener.

### Neutras
- `DataCell` sub-componentes existentes no cambian — el factory los consume, no los reemplaza.
- `createEntityActions` sigue funcionando independientemente — composición, no sustitución.

## Alternatives considered

| Alternativa | Razón de descarte |
|-------------|-------------------|
| Componente surface-aware (DataCell detecta superficie) | Acopla DataCell al contexto de renderizado; rompe la separación de responsabilidades. |
| Tres factories separados (createTableFields, createCardFields, createKanbanFields) | Más flexible pero más código de definición — viola DRY en la definición misma. |
| Expandir column factories existentes (createCodeColumn etc.) | Solo resuelve DataTable, no EntityCard ni Kanban. |
| HOC/Wrapper por vista | Más indirección, más complejidad de debugging, menos type-safe. |

## References

- Contrato: `docs/20-contracts/component-fields.md`, `docs/20-contracts/component-datatable-views.md`, `docs/20-contracts/component-contracts.md`
- Implementación: `frontend/components/shared/entity-fields.tsx`
- Patrón base: `frontend/components/shared/entity-actions.tsx` (ADR-0023)
- DataCell: `frontend/components/shared/DataTableCells.tsx`
