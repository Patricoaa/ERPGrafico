---
layer: 20-contracts
doc: searchbar-decision
status: active
owner: frontend-team
created: 2026-05-13
updated: 2026-06-19
last_review: 2026-06-19
stability: stable
scope: Decisión de búsqueda en vistas de tabla — SmartSearchBar + useSmartSearch vs useClientSearch vs sin searchbar. A partir de 2026-06 los filtros de estado/fecha/clasificación migraron a SegmentationBar.
---

# Contrato: SmartSearchBar — Árbol de Decisión

Todo `DataTable` con búsqueda/filtrado debe usar `SmartSearchBar` como `leftAction`.
El componente es siempre el mismo; la diferencia está en el hook de estado.

**A partir de 2026-06:** SmartSearchBar maneja solo campos de tipo `text`.
Los filtros de estado, clasificación de entidad (tabs/dropdown) y fechas (calendario)
se declaran como `SegmentationDefinition` y se renderizan con `<SegmentationBar>`
en la Fila 1 del toolbar. Ver [segmentation-decision.md](segmentation-decision.md).

---

## Árbol de decisión

```
¿La vista tiene un DataTable con datos filtrables?
│
├── NO → No aplica searchbar (ej. /treasury/reconciliation, vistas agregadas)
│
└── SÍ
    │
    ├── ¿El dataset puede superar ~100 registros O requiere deeplinks/URL sync?
    │   │
    │   └── SÍ → SmartSearchBar + useSmartSearch (server-side)
    │           Requisitos: ViewSet con filter_backends + FilterSet; hook acepta filters
    │
    └── NO (dataset pequeño/estático, < ~100 registros)
        │
        └── SmartSearchBar + useClientSearch (client-side)
                Sin cambios de backend. filterFn aplica filtros sobre datos ya cargados.
                URL sync, chips y deeplinks funcionan igual que server-side.
```

**Regla adicional para "pequeño/estático":** si el endpoint es una acción custom (no
`list()` estándar de ModelViewSet), usar `useClientSearch` independientemente del tamaño.

---

## Cuándo NO usar searchbar

| Patrón de UI | Ejemplo | Razón |
|---|---|---|
| UI de matching/reconciliación | `/treasury/reconciliation` | Patrón diferente al DataTable estándar |
| Vista agregada (no lista filtrable) | `/inventory/stock?tab=report` | No hay filas individuales filtrables |
| Datos en memoria por diseño | `/sales/terminals?tab=pos-terminals` | Sin DataTable estándar |

---

## Tipos de campo en searchDef

| `type` | Dónde se renderiza | Propósito |
|---|---|---|
| `text` | SmartSearchBar (input de texto libre) | Búsqueda por nombre, código, RUT, etc. |

Cualquier filtro con opciones predefinidas (estado, tipo, clasificación de entidad,
selector de tarjeta, alcance, año) **no** va en el searchDef. Va en `segmentationDef.ts`
como `TabSegmentDef`, `DropdownSegmentDef` o `DateSegmentDef`. Ver
[segmentation-decision.md](segmentation-decision.md).

---

## Patrón canónico: server-side (useSmartSearch) con segmentation

```tsx
// 1. searchDef — features/[app]/searchDef.ts (solo text)
export const myEntitySearchDef: SearchDefinition = {
  fields: [
    { key: 'search', label: 'Nombre', type: 'text', serverParam: 'search' },
  ],
}

// 2. segmentationDef — features/[app]/segmentationDef.ts
export const myEntitySegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' },
      ],
    },
  ],
}

// 3. En el componente (Client Component)
const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText }
  = useSmartSearch(myEntitySearchDef)
const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg }
  = useSegmentation(myEntitySegDef)
const isFiltered = isTextFiltered || isSegFiltered

const { data } = useMyEntities({ ...textFilters, ...segFilters })

<DataTable
  data={data ?? []}
  columns={columns}
  leftAction={<SmartSearchBar searchDef={myEntitySearchDef} placeholder="Buscar..." />}
  // segmentation se pasa como prop aparte (Fila 1 del toolbar)
  segmentation={<SegmentationBar def={myEntitySegDef} />}
  showReset={isFiltered}
  onReset={() => { clearText(); clearSeg() }}
  isFiltered={isFiltered}
/>
```

---

## Patrón canónico: client-side (useClientSearch)

```tsx
// 1. searchDef — solo text fields con clientKey
export const mySmallListSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search', label: 'Nombre', type: 'text',
      serverParam: 'search',
      clientKey: ['name', 'code'],
    },
  ],
}

// 2. En el componente
const { data } = useMyStaticEntities()
const { filterFn } = useClientSearch<MyEntity>(mySmallListSearchDef)
const filtered = useMemo(() => filterFn(data ?? []), [data, filterFn])

<DataTable
  data={filtered}
  columns={columns}
  leftAction={<SmartSearchBar searchDef={mySmallListSearchDef} placeholder="Buscar..." />}
/>
```

---

## Invariantes (violación = PR rechazado)

| Regla | Detalle |
|---|---|
| `filterColumn` / `searchPlaceholder` eliminados | No coexisten con SmartSearchBar |
| `useAdvancedFilter` / `globalFilterFields` eliminados | SmartSearchBar reemplaza estos mecanismos |
| `facetedFilters` eliminados | Los filtros de tipo `enum` van en `segmentationDef`, no en searchDef |
| Solo `SmartSearchBar` como `leftAction` | No usar SimpleSearchBar — no existe en el barrel |
| `useClientSearch` solo para datasets sin paginación | Si el hook ya pagina server-side, usar `useSmartSearch` |
| `clientKey` en `TextFieldDef` solo para `useClientSearch` | Ignorado por SmartSearchBar (server-side) |
| Sin `type: 'enum'`, `type: 'daterange'`, ni `type: 'identity-enum'` en searchDef | Esos tipos fueron eliminados 2026-06. Usar SegmentationBar. |
| `FieldDef` es solo `TextFieldDef` | No existe `IdentityEnumFieldDef` desde 2026-06. |

---

## Tabla de decisión por ruta (estado actual)

### Server-side activo (useSmartSearch) — con SegmentationBar
| Ruta | searchDef | segmentationDef |
|---|---|---|
| `/contacts` | `contactSearchDef` | `contactSegDef` |
| `/billing/invoices` | `invoiceSearchDef` | `invoiceSegDef` |
| `/billing/purchases` | `purchaseInvoiceSearchDef` | `purchaseInvoiceSegDef` |
| `/sales/orders?tab=orders` | `saleOrderSearchDef` | `salesOrderSegDef` |
| `/sales/orders?tab=notes` | `salesNoteSearchDef` | `salesNoteSegDef` |
| `/sales/sessions` | `posSessionSearchDef` | `posSessionSegDef` |
| `/sales/terminals?tab=batches` | `terminalBatchSearchDef` | `terminalBatchSegDef` |
| `/sales/terminals?tab=devices` | `deviceSearchDef` | `deviceSegDef` |
| `/inventory/products` | `productSearchDef` | `productSegDef` |
| `/inventory/stock?tab=movements` | `stockMoveSearchDef` | `stockMoveSegDef` |
| `/inventory/products?tab=pricing-rules` | `pricingRuleSearchDef` | `pricingRuleSegDef` |
| `/inventory/products?tab=subscriptions` | `subscriptionSearchDef` | `subscriptionSegDef` |
| `/inventory/uoms?tab=units` | `uomSearchDef` | — (solo text) |
| `/inventory/attributes` | `attributeSearchDef` | — (solo text) |
| `/treasury/accounts?tab=accounts` | `treasuryAccountSearchDef` | `treasuryAccountSegDef` |
| `/treasury/movements` | `treasuryMovementSearchDef` | `treasuryMovementsSegDef` |
| `/treasury/card-statements` | — (solo segmentation) | (inline segDef en StatementsView) |
| `/treasury/unbilled-charges` | — (solo segmentation) | (inline segDef en UnbilledChargesView) |
| `/purchasing/orders` | `purchaseOrderSearchDef` | `purchaseOrderSegDef` |
| `/production/orders` | `workOrderSearchDef` | `workOrderSegDef` |
| `/production/boms` | `bomSearchDef` | `bomSegDef` |
| `/hr/employees` | `employeeSearchDef` | `employeeSegDef` |
| `/hr/absences` | — (solo segmentation) | `absenceSegDef` |
| `/hr/payrolls` | `payrollSearchDef` | `payrollSegDef` |
| `/hr/advances` | — (solo segmentation) | `salaryAdvanceSegDef` |
| `/accounting/ledger` | `accountSearchDef` | `accountSegDef` |
| `/accounting/entries` | `journalEntrySearchDef` | `journalEntrySegDef` |
| `/settings/users?tab=users` | `userSearchDef` | `userSegDef` |

### Client-side (useClientSearch)
| Ruta | searchDef |
|---|---|
| `/accounting/closures` | `fiscalYearSearchDef` |
| `/accounting/tax` | `taxPeriodSearchDef` |
| `/treasury/accounts?tab=banks` | `bankSearchDef` |
| `/treasury/accounts?tab=methods` | `paymentMethodSearchDef` |
| `/inventory/products?tab=categories` | `categorySearchDef` |
| `/inventory/uoms?tab=categories` | `uomCategorySearchDef` |
| `/inventory/stock?tab=warehouses` | `warehouseSearchDef` |
| `/sales/terminals?tab=providers` | `terminalProviderSearchDef` |
| `/settings/users?tab=groups` | `groupSearchDef` |
| `/sales/credits?tab=portfolio` | `creditContactSearchDef` |
| `/sales/credits?tab=history` | `creditHistorySearchDef` |
| `/sales/credits?tab=blacklist` | `creditContactSearchDef` |

### Sin searchbar
| Ruta | Razón |
|---|---|
| `/treasury/reconciliation` | UI de matching, patrón diferente |
| `/inventory/stock?tab=report` | Vista agregada |
| `/sales/terminals?tab=pos-terminals` | Datos en memoria |

---

## Migración client-side → server-side

Cuando un dataset Tier 5 crece y justifica filtrado server-side:

1. Backend: añadir `FilterSet` + `filter_backends` al ViewSet
2. Hook: añadir `filters?: MyFilters` al hook; incluir en `queryKey` y `queryFn`
3. Vista: cambiar `useClientSearch` → `useSmartSearch`; pasar `filters` al hook
4. `filterFn` y `useMemo(filterFn(...))` → eliminar
5. Si hay filtros de estado/fecha, crear `segmentationDef` y agregar `SegmentationBar`
6. `SmartSearchBar` en `leftAction` sin cambios (solo text)
7. Si el dataset no usa filtros server-side pero hay filtros de clasificación (ej.
   `state` en `StatementsList`), combinar `useClientSearch` + `useSegmentation` y
   aplicar ambos filtros en el `useMemo`:
   ```tsx
   const { filterFn } = useClientSearch<MyEntity>(searchDef)
   const { filters: segFilters } = useSegmentation(segDef)
   const filtered = useMemo(() => {
     let result = filterFn(data)
     if (segFilters.state) result = result.filter(s => s.state === segFilters.state)
     return result
   }, [filterFn, data, segFilters])
   ```
