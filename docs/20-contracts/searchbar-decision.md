---
layer: 20-contracts
doc: searchbar-decision
status: active
created: 2026-05-13
updated: 2026-05-13
scope: Decisión de búsqueda en vistas de tabla — SmartSearchBar + useSmartSearch vs useClientSearch vs sin searchbar
---

# Contrato: SmartSearchBar — Árbol de Decisión

Todo `DataTable` con búsqueda/filtrado debe usar `SmartSearchBar` como `leftAction`.
El componente es siempre el mismo; la diferencia está en el hook de estado.

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

## Patrón canónico: server-side (useSmartSearch)

```tsx
// 1. searchDef — features/[app]/searchDef.ts
export const myEntitySearchDef: SearchDefinition = {
  fields: [
    { key: 'search', label: 'Nombre', type: 'text', serverParam: 'search' },
    { key: 'status', label: 'Estado', type: 'enum', serverParam: 'status',
      options: [{ label: 'Activo', value: 'ACTIVE' }] },
  ],
}

// 2. En el componente (Client Component)
const { filters } = useSmartSearch(myEntitySearchDef)
const { data } = useMyEntities({ filters })          // hook pasa filters al backend

<DataTable
  data={data ?? []}
  columns={columns}
  leftAction={<SmartSearchBar searchDef={myEntitySearchDef} placeholder="Buscar..." />}
/>
```

**Backend necesario:**
```python
class MyFilterSet(django_filters.FilterSet):
    class Meta:
        model = MyModel
        fields = ['status']

class MyViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = MyFilterSet
    search_fields = ['name']
```

---

## Patrón canónico: client-side (useClientSearch)

```tsx
// 1. searchDef — los serverParam no se envían al backend, pero se necesitan
//    para que nuqs gestione la URL. clientKey apunta al campo del objeto de fila.
export const mySmallListSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search', label: 'Nombre', type: 'text',
      serverParam: 'search',               // clave en URL
      clientKey: ['name', 'code'],         // campos del row a comparar
    },
  ],
}

// 2. En el componente (Client Component)
const { data } = useMyStaticEntities()     // hook estático, sin filters
const { filterFn } = useClientSearch<MyEntity>(mySmallListSearchDef)
const filtered = useMemo(() => filterFn(data ?? []), [data, filterFn])

<DataTable
  data={filtered}
  columns={columns}
  leftAction={<SmartSearchBar searchDef={mySmallListSearchDef} placeholder="Buscar..." />}
/>
```

**Sin cambios de backend.** El hook estático existente no necesita modificarse.

---

## Migración client-side → server-side

Cuando un dataset Tier 5 crece y justifica filtrado server-side:

1. Backend: añadir `FilterSet` + `filter_backends` al ViewSet
2. Hook: añadir `filters?: MyFilters` al hook; incluir en `queryKey` y `queryFn`
3. Vista: cambiar `useClientSearch` → `useSmartSearch`; pasar `filters` al hook
4. `filterFn` y `useMemo(filterFn(...))` → eliminar
5. `SmartSearchBar` en `leftAction`: sin cambios

---

## Invariantes (violación = PR rechazado)

| Regla | Detalle |
|---|---|
| `filterColumn` / `searchPlaceholder` eliminados | No coexisten con SmartSearchBar |
| `useAdvancedFilter` / `globalFilterFields` eliminados | SmartSearchBar reemplaza estos mecanismos |
| `facetedFilters` eliminados | Los filtros de tipo `enum` van en el `searchDef` |
| Solo `SmartSearchBar` como `leftAction` | No usar SimpleSearchBar — no existe en el barrel |
| `useClientSearch` solo para datasets sin paginación | Si el hook ya pagina server-side, usar `useSmartSearch` |
| `clientKey` en `TextFieldDef` solo para `useClientSearch` | Ignorado por SmartSearchBar (server-side) |

---

## Tabla de decisión por ruta (estado actual)

### Server-side activo (useSmartSearch)
| Ruta | searchDef |
|------|-----------|
| `/billing/purchases` | `purchaseInvoiceSearchDef` |
| `/sales/orders?tab=orders` | `saleOrderSearchDef` |
| `/inventory/products` | `productSearchDef` |
| `/contacts` | `contactSearchDef` |
| `/treasury/movements` | `treasuryMovementSearchDef` |
| `/accounting/entries` | `journalEntrySearchDef` |
| `/purchasing/orders` | `purchaseOrderSearchDef` |
| `/inventory/stock?tab=movements` | `stockMoveSearchDef` |
| `/inventory/products?tab=pricing-rules` | `pricingRuleSearchDef` |
| `/inventory/products?tab=subscriptions` | `subscriptionSearchDef` |
| `/inventory/uoms?tab=units` | `uomSearchDef` |
| `/sales/sessions` | `posSessionSearchDef` |
| `/sales/terminals?tab=batches` | `terminalBatchSearchDef` |
| `/sales/terminals?tab=devices` | `deviceSearchDef` |
| `/hr/employees` | `employeeSearchDef` |
| `/hr/absences` | `absenceSearchDef` |
| `/hr/payrolls` | `payrollSearchDef` |
| `/hr/advances` | `salaryAdvanceSearchDef` |
| `/production/orders` | `workOrderSearchDef` |
| `/production/boms` | `bomSearchDef` |
| `/settings/users?tab=users` | `userSearchDef` |
| `/accounting/ledger` | `accountSearchDef` |
| `/treasury/accounts?tab=accounts` | `treasuryAccountSearchDef` |
| `/inventory/attributes` | `attributeSearchDef` |
| `/sales/orders?tab=notes` | `salesNoteSearchDef` |

### Client-side (useClientSearch)
| Ruta | searchDef |
|------|-----------|
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
|------|-------|
| `/treasury/reconciliation` | UI de matching, patrón diferente |
| `/inventory/stock?tab=report` | Vista agregada |
| `/sales/terminals?tab=pos-terminals` | Datos en memoria |
