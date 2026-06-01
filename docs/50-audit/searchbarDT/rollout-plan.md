---
layer: 50-audit
doc: searchbar-rollout-plan
status: complete
created: 2026-05-13
updated: 2026-05-13
owner: frontend-team
scope: SmartSearchBar rollout en rutas pendientes
prerequisite: implementation-plan.md (M0–M6 completados)
---

# Plan de Rollout: SmartSearchBar — Rutas Pendientes

Continuación del rollout iniciado en M2–M4. Los módulos de primera ola
(Facturas, Tesorería/Movimientos, Órdenes de Venta, Productos, Contactos)
ya tienen SmartSearchBar server-side activo. Este plan cubre las rutas
restantes en orden de menor a mayor complejidad.

Referencia de complejidad: [gap-analysis.md](./gap-analysis.md)  
Tier 5 (datasets pequeños, client-side): `SmartSearchBar + useClientSearch` — ver [searchbar-decision.md](../../20-contracts/searchbar-decision.md)

---

## Orden de implementación

| Fase | Tier | Rutas | Esfuerzo estimado |
|------|------|-------|-------------------|
| F1 | T1 — Plug-in | `/billing/purchases`, `/inventory/stock?movements` | ~3h |
| F2 | T2 — Hook upgrade | 6 rutas (treasury terminals, inventory, sessions) | ~2 días |
| F3 | T4 — Crear hooks HR | 4 rutas HR | ~1 día |
| F4 | T3 — Backend + hook | purchasing, entries, production, users | ~3-4 días |

---

## Pre-flight (aplica a todas las fases)

Antes de empezar cualquier módulo:
- [ ] `npm run type-check` verde en la rama actual
- [ ] Backend corriendo localmente (`docker compose up -d` o híbrido)
- [ ] Revisar el checklist de prerequisitos de [implementation-plan.md §10](./implementation-plan.md)

El patrón canónico completo:
```
1. Backend: ViewSet tiene filter_backends + filterset_class + search_fields
2. Hook: acepta filters?: TypedFilters; filters en queryKey; API fn los pasa como params
3. searchDef: features/[app]/searchDef.ts — campos declarados
4. Vista: useSmartSearch(searchDef) → hook → DataTable leftAction
5. Eliminar: filterColumn, searchPlaceholder, facetedFilters del DataTable
```

---

## Fase 1 — Plug-in (< 3h total)

Infraestructura al 100%. Solo integrar.

---

### F1.1 — `/billing/purchases`

**Archivo a modificar:** `frontend/features/billing/components/PurchaseInvoicesClientView.tsx`

**Estado actual:**
- `purchaseInvoiceSearchDef` ya creado en `features/billing/searchDef.ts` ✅
- `usePurchaseInvoices` ya acepta `filters?: Omit<InvoiceFilters, 'mode'>` en queryKey ✅
- `InvoiceViewSet` tiene `filter_backends + search_fields + filterset_fields` ✅
- Vista usa `filterColumn="partner_name"` + `searchPlaceholder` client-side ❌

**Pasos:**
1. En `PurchaseInvoicesClientView.tsx`:
   - Añadir import: `import { SmartSearchBar, useSmartSearch } from '@/components/shared'`
   - Añadir import: `import { purchaseInvoiceSearchDef } from '../searchDef'`
   - Llamar `const { filters } = useSmartSearch(purchaseInvoiceSearchDef)` al inicio del componente
   - Pasar `filters` a `usePurchaseInvoices({ filters })`
   - Reemplazar `filterColumn` + `searchPlaceholder` en `<DataTable>` por:
     ```tsx
     leftAction={<SmartSearchBar searchDef={purchaseInvoiceSearchDef} placeholder="Buscar facturas de compra..." />}
     ```
2. `npm run type-check`

**Campos disponibles:** Proveedor/RUT (text→`?search=`), Estado (enum), Fecha (daterange).

---

### F1.2 — `/inventory/stock?tab=movements`

**Archivo a modificar:** `frontend/features/inventory/components/MovementList.tsx`

**Estado actual:**
- `useStockMoves` acepta `StockMoveFilters` completos en queryKey ✅
- `StockMoveViewSet` tiene `filter_backends + StockMoveFilter + StandardResultsSetPagination` ✅
- `StockMoveFilter` cubre: `product_id`, `warehouse_id`, `move_type` ✅
- Vista usa `filterColumn="product_name"` + `searchPlaceholder` client-side ❌

**Falta:** `searchDef` para movements (no existe aún).

**Pasos:**
1. En `features/inventory/searchDef.ts`, añadir:
   ```ts
   export const stockMoveSearchDef: SearchDefinition = {
     fields: [
       { key: 'move_type', label: 'Tipo', type: 'enum', serverParam: 'move_type',
         options: [
           { label: 'Entrada', value: 'IN' },
           { label: 'Salida', value: 'OUT' },
           { label: 'Interno', value: 'INTERNAL' },
         ]
       },
       { key: 'date', label: 'Fecha', type: 'daterange',
         serverParamStart: 'date_from', serverParamEnd: 'date_to'
       },
     ]
   }
   ```
   > Nota: product_id y warehouse_id son FKs numéricos — no son aptos para texto libre.
   > Si se quiere filtrar por nombre, añadir `product_name` icontains al `StockMoveFilter`
   > en `backend/inventory/filters.py` (ver P.opt abajo).

2. En `MovementList.tsx`:
   - Añadir imports de `SmartSearchBar`, `useSmartSearch`, `stockMoveSearchDef`
   - `const { filters } = useSmartSearch(stockMoveSearchDef)`
   - Pasar `filters` a `useStockMoves({ ...baseFilters, ...filters })`
   - Reemplazar `filterColumn` + `searchPlaceholder` por `leftAction={<SmartSearchBar.../>}`

3. **Opcional (P.opt):** Añadir filtro por nombre de producto al backend:
   ```python
   # backend/inventory/filters.py
   class StockMoveFilter(filters.FilterSet):
       product_id = filters.NumberFilter(field_name="product__id")
       warehouse_id = filters.NumberFilter(field_name="warehouse__id")
       product_name = filters.CharFilter(field_name="product__name", lookup_expr='icontains')
       date_from = filters.DateFilter(field_name="date", lookup_expr='gte')
       date_to   = filters.DateFilter(field_name="date", lookup_expr='lte')
       class Meta:
           model = StockMove
           fields = ['product_id', 'warehouse_id', 'move_type', 'product_name', 'date_from', 'date_to']
   ```
   Si se añade, agregar campo `text` al `stockMoveSearchDef`.

4. `npm run type-check`

---

## Fase 2 — Hook upgrade (~ 2 días total)

Backend con `filter_backends` pero hooks estáticos. Patrón repetitivo:
`extender hook → añadir params al API fn → definir searchDef → integrar SmartSearchBar`.

---

### F2.1 — `/sales/sessions`

**Hook:** `features/pos/hooks/usePOSSessions.ts`  
**Vista:** `features/sales/components/POSSessionsView.tsx`  
**Backend:** `POSSessionViewSet` — `filterset_fields = ['status', 'treasury_account', 'user']` ✅

**Pasos:**
1. Crear `POSSessionFilters`:
   ```ts
   export interface POSSessionFilters {
     status?: string
     treasury_account?: string
     user?: string
   }
   ```
2. En `usePOSSessions`: añadir `filters?: POSSessionFilters` al tipo de parámetro; incluir en `queryKey` y `queryFn`.
3. Crear `features/pos/searchDef.ts` (o `features/sales/searchDef.ts` si el módulo es sales):
   ```ts
   export const posSessionSearchDef: SearchDefinition = {
     fields: [
       { key: 'status', label: 'Estado', type: 'enum', serverParam: 'status',
         options: [
           { label: 'Abierta', value: 'OPEN' },
           { label: 'Cerrada', value: 'CLOSED' },
         ]
       },
     ]
   }
   ```
   > treasury_account y user son FKs — no exponer en SmartSearchBar sin endpoint de suggestions.
4. Integrar en `POSSessionsView.tsx`.

---

### F2.2 — `/sales/terminals?tab=batches`

**Hook:** `features/treasury/hooks/useTerminalBatches.ts`  
**Vista:** componente de terminales  
**Backend:** `TerminalBatchViewSet` — `filterset_fields = ['status', 'provider', 'sales_date']` ✅

**Pasos:**
1. Extender `useTerminalBatches` con `filters?: TerminalBatchFilters`.
2. `searchDef`:
   ```ts
   export const terminalBatchSearchDef: SearchDefinition = {
     fields: [
       { key: 'status', label: 'Estado', type: 'enum', serverParam: 'status',
         options: [
           { label: 'Pendiente', value: 'PENDING' },
           { label: 'Procesado', value: 'PROCESSED' },
           { label: 'Error', value: 'ERROR' },
         ]
       },
       { key: 'sales_date', label: 'Fecha venta', type: 'daterange',
         serverParamStart: 'sales_date_from', serverParamEnd: 'sales_date_to'
       },
     ]
   }
   ```
   > Verificar los valores exactos de `status` en el modelo antes de declarar las opciones.
3. Integrar en la vista de batches.

---

### F2.3 — `/sales/terminals?tab=devices`

**Backend:** `PaymentTerminalDeviceViewSet` — `filterset_fields = ['provider', 'status']` ✅  
**Vista:** `features/treasury/components/PaymentHardwareManagement.tsx`

**Pasos:**
1. No existe hook dedicado para devices — el componente usa datos inline.
   Crear `features/treasury/hooks/useTerminalDevices.ts` con el patrón estándar.
2. Definir `DeviceFilters { provider?: string; status?: string }`.
3. `searchDef` con campo enum `status`.
4. Integrar.

---

### F2.4 — `/inventory/products?tab=pricing-rules`

**Hook:** `features/inventory/hooks/usePricingRules.ts` (estático)  
**Vista:** `features/inventory/components/PricingRuleList.tsx`  
**Backend:** `PricingRuleViewSet` — `filter_backends + filterset_fields = ['product', 'category', 'active']` ✅

**Pasos:**
1. Añadir `search_fields = ['name']` al `PricingRuleViewSet` en `backend/inventory/views.py`.
2. Extender `usePricingRules` con `filters?: PricingRuleFilters`.
3. `searchDef`:
   ```ts
   export const pricingRuleSearchDef: SearchDefinition = {
     fields: [
       { key: 'search', label: 'Nombre', type: 'text', serverParam: 'search' },
       { key: 'active', label: 'Estado', type: 'enum', serverParam: 'active',
         options: [{ label: 'Activa', value: 'true' }, { label: 'Inactiva', value: 'false' }]
       },
     ]
   }
   ```
4. Integrar en `PricingRuleList.tsx`, eliminar `searchPlaceholder`.

---

### F2.5 — `/inventory/products?tab=subscriptions`

**Vista:** `features/inventory/components/SubscriptionsView.tsx`  
**Backend:** `SubscriptionViewSet` — `filter_backends + filterset_fields = ['status', 'product', 'supplier']` ✅

**Pasos:**
1. No existe hook dedicado. Crear `useSubscriptions` en `features/inventory/hooks/`.
2. Añadir `search_fields = ['product__name']` al `SubscriptionViewSet`.
3. `searchDef`:
   ```ts
   export const subscriptionSearchDef: SearchDefinition = {
     fields: [
       { key: 'status', label: 'Estado', type: 'enum', serverParam: 'status',
         options: [
           { label: 'Activa', value: 'ACTIVE' },
           { label: 'Pausada', value: 'PAUSED' },
           { label: 'Cancelada', value: 'CANCELLED' },
         ]
       },
     ]
   }
   ```
   > Verificar valores exactos del campo `status` en el modelo `Subscription`.
4. Integrar en `SubscriptionsView.tsx`.

---

### F2.6 — `/inventory/uoms?tab=units`

**Hook:** `features/inventory/hooks/useUoMs.ts` (estático)  
**Vista:** `features/inventory/components/UoMList.tsx`  
**Backend:** `UoMViewSet` — `filter_backends + filterset_fields = ['category', 'active']` ✅

**Pasos:**
1. Añadir `search_fields = ['name', 'abbreviation']` al `UoMViewSet`.
2. Extender `useUoMs` con `filters?: UoMFilters`.
3. `searchDef`:
   ```ts
   export const uomSearchDef: SearchDefinition = {
     fields: [
       { key: 'search', label: 'Nombre', type: 'text', serverParam: 'search' },
       { key: 'active', label: 'Estado', type: 'enum', serverParam: 'active',
         options: [{ label: 'Activa', value: 'true' }, { label: 'Inactiva', value: 'false' }]
       },
     ]
   }
   ```
4. Integrar en `UoMList.tsx`.

---

## Fase 3 — Crear hooks HR (~ 1 día)

El backend de HR tiene FilterSets completos. El frontend **no tiene hooks** —
las páginas llaman a `hrApi` directamente. Este bloque crea los 4 hooks
del módulo HR en una sola sesión.

---

### F3 — Módulo HR: crear capa de hooks

**Directorio a crear:** `frontend/features/hr/hooks/`

#### F3.1 — `useEmployees`

Backend: `EmployeeViewSet` con `EmployeeFilter(status, contact)` ✅

```ts
// features/hr/hooks/useEmployees.ts
export interface EmployeeFilters {
  status?: string       // 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'
  search?: string       // ← añadir search_fields al backend (ver abajo)
}
export function useEmployees({ filters }: { filters?: EmployeeFilters } = {}) { ... }
```

Backend: añadir `search_fields = ['contact__name', 'contact__rut', 'position']` a `EmployeeViewSet`.

```ts
// features/hr/searchDef.ts
export const employeeSearchDef: SearchDefinition = {
  fields: [
    { key: 'search', label: 'Nombre / RUT', type: 'text', serverParam: 'search',
      suggestionsUrl: '/hr/employees/filter-suggestions/' },
    { key: 'status', label: 'Estado', type: 'enum', serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' },
        { label: 'Con licencia', value: 'ON_LEAVE' },
      ]
    },
  ]
}
```

Integrar: `frontend/app/(dashboard)/hr/employees/page.tsx` — eliminar `searchPlaceholder`.

---

#### F3.2 — `useAbsences`

Backend: `AbsenceViewSet` con `AbsenceFilter(employee, absence_type, start_date)` ✅

```ts
export interface AbsenceFilters {
  absence_type?: string
  start_date_after?: string
  start_date_before?: string
}
```

```ts
export const absenceSearchDef: SearchDefinition = {
  fields: [
    { key: 'absence_type', label: 'Tipo', type: 'enum', serverParam: 'absence_type',
      options: [ /* valores del modelo */ ]
    },
    { key: 'date', label: 'Fecha inicio', type: 'daterange',
      serverParamStart: 'start_date_after', serverParamEnd: 'start_date_before'
    },
  ]
}
```

Integrar: `frontend/app/(dashboard)/hr/absences/page.tsx` — eliminar `searchPlaceholder`.

---

#### F3.3 — `usePayrolls`

Backend: `PayrollViewSet` con `PayrollFilter(employee, period_year, period_month, status)` ✅

```ts
export interface PayrollFilters {
  status?: string
  period_year?: string
  period_month?: string
}
```

```ts
export const payrollSearchDef: SearchDefinition = {
  fields: [
    { key: 'status', label: 'Estado', type: 'enum', serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Aprobada', value: 'APPROVED' },
        { label: 'Pagada', value: 'PAID' },
      ]
    },
    { key: 'period_year', label: 'Año', type: 'text', serverParam: 'period_year' },
  ]
}
```

Integrar: `frontend/app/(dashboard)/hr/payrolls/page.tsx` — eliminar `filterColumn="employee"` + `searchPlaceholder`.

---

#### F3.4 — `useSalaryAdvances`

Backend: `SalaryAdvanceViewSet` con `SalaryAdvanceFilter(employee, payroll, is_discounted)` ✅

```ts
export interface SalaryAdvanceFilters {
  is_discounted?: string   // 'true' | 'false'
}
```

```ts
export const salaryAdvanceSearchDef: SearchDefinition = {
  fields: [
    { key: 'is_discounted', label: 'Descontado', type: 'enum', serverParam: 'is_discounted',
      options: [
        { label: 'Sí', value: 'true' },
        { label: 'No', value: 'false' },
      ]
    },
  ]
}
```

Integrar: `frontend/app/(dashboard)/hr/advances/page.tsx`.

---

### Patrón estándar de hook para HR

Todos los hooks HR siguen el mismo esqueleto:

```ts
// features/hr/hooks/useXxx.ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { hrApi } from '../api/hrApi'

const XXX_QUERY_KEY = ['hr', 'xxx'] as const

interface UseXxxProps { filters?: XxxFilters }

export function useXxx({ filters }: UseXxxProps = {}) {
  return useQuery({
    queryKey: [...XXX_QUERY_KEY, filters],
    queryFn: () => hrApi.getXxx(filters),
    staleTime: 2 * 60 * 1000,  // 2 min (transaccional)
  })
}
```

Exportar todos desde `features/hr/index.ts` (o crear `features/hr/hooks/index.ts`).  
Confirmar que `hrApi.getXxx` pasa los filters como query params.

---

## Fase 4 — Backend + hook (~ 3-4 días)

Estos módulos requieren crear `FilterSet` + `filter_backends` en Django antes
de implementar el frontend.

---

### F4.1 — `/purchasing/orders` + `?view=card`

**Backend:** `PurchaseOrderViewSet` — sin `filter_backends` ❌

```python
# backend/purchasing/views.py
import django_filters

class PurchaseOrderFilterSet(django_filters.FilterSet):
    supplier_name = django_filters.CharFilter(
        field_name='supplier__name', lookup_expr='icontains'
    )
    date_after  = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    date_before = django_filters.DateFilter(field_name='date', lookup_expr='lte')
    class Meta:
        model = PurchaseOrder
        fields = ['status']

class PurchaseOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter]
    filterset_class = PurchaseOrderFilterSet
    search_fields   = ['supplier__name', 'number']
    # queryset debe ordenarse: ordering = ['-date', '-id']
```

**Frontend:** `usePurchasingOrders` en `features/purchasing/hooks/usePurchasing.ts`:
- Añadir `PurchasingOrderFilters { supplier_name?: string; status?: string; date_after?: string; date_before?: string }`
- Incluir `filters` en queryKey

```ts
// features/purchasing/searchDef.ts
export const purchaseOrderSearchDef: SearchDefinition = {
  fields: [
    { key: 'search', label: 'Proveedor', type: 'text', serverParam: 'supplier_name',
      suggestionsUrl: '/purchasing/orders/filter-suggestions/' },
    { key: 'status', label: 'Estado', type: 'enum', serverParam: 'status',
      options: [ /* estados del modelo PurchaseOrder */ ]
    },
    { key: 'date', label: 'Fecha', type: 'daterange',
      serverParamStart: 'date_after', serverParamEnd: 'date_before'
    },
  ]
}
```

Vista dual (orders/notes como SalesOrdersView T3.3):
- `viewMode === 'orders'`: SmartSearchBar server-side
- `viewMode === 'notes'` (si existe): client-side, sin cambios

**Opcional:** añadir `filter_suggestions` action al ViewSet para autocompletado de proveedor.

---

### F4.2 — `/accounting/entries`

**Backend:** `JournalEntryViewSet` — sin `filter_backends` ❌

```python
# backend/accounting/views.py
class JournalEntryFilterSet(django_filters.FilterSet):
    date_after  = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    date_before = django_filters.DateFilter(field_name='date', lookup_expr='lte')
    class Meta:
        model = JournalEntry
        fields = ['status']

class JournalEntryViewSet(viewsets.ModelViewSet, AuditHistory):
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter]
    filterset_class = JournalEntryFilterSet
    search_fields   = ['description', 'folio']
```

**Frontend:** `useJournalEntries` — actualmente sin params (queryKey estático):
- Añadir `JournalEntryFilters { status?: string; date_after?: string; date_before?: string; search?: string }`
- Incluir en queryKey

```ts
// features/accounting/searchDef.ts (nuevo archivo)
export const journalEntrySearchDef: SearchDefinition = {
  fields: [
    { key: 'search', label: 'Descripción', type: 'text', serverParam: 'search' },
    { key: 'status', label: 'Estado', type: 'enum', serverParam: 'status',
      options: [ /* estados del modelo JournalEntry */ ]
    },
    { key: 'date', label: 'Fecha', type: 'daterange',
      serverParamStart: 'date_after', serverParamEnd: 'date_before'
    },
  ]
}
```

Integrar en `EntriesClientView.tsx` — eliminar `filterColumn="description"`.

---

### F4.3 — `/production/orders`

**Backend:** `WorkOrderViewSet` — sin `filter_backends` ❌

> ⚠️ **Prerequisito:** `useWorkOrderSearch` usa `globalCache` + `useState` (P3+P4 del audit).
> Antes de integrar SmartSearchBar se debe migrar `useWorkOrderSearch` a `useQuery`
> (hook estándar declarativo). Esto es trabajo extra (~2-3h).

```python
# backend/production/views.py
class WorkOrderFilterSet(django_filters.FilterSet):
    customer_name = django_filters.CharFilter(
        field_name='sale_order__customer__name', lookup_expr='icontains'
    )
    date_after  = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    date_before = django_filters.DateFilter(field_name='date', lookup_expr='lte')
    class Meta:
        model = WorkOrder
        fields = ['status']

class WorkOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter]
    filterset_class = WorkOrderFilterSet
    search_fields   = ['description', 'folio']
```

**Frontend:**
1. Migrar `useWorkOrderSearch` de `globalCache`+`useState` → `useQuery` estándar
2. Crear `features/production/searchDef.ts`
3. Integrar en `frontend/app/(dashboard)/production/orders/page.tsx`

---

### F4.4 — `/production/boms`

**Backend:** `BillOfMaterialsViewSet` — solo params custom (`?product_id=`, `?parent_id=`) ❌

```python
class BOMFilterSet(django_filters.FilterSet):
    product_name = django_filters.CharFilter(
        field_name='product__name', lookup_expr='icontains'
    )
    class Meta:
        model = BillOfMaterials
        fields = ['product_name']
```

**Frontend:** `useBOMs` ya acepta `{ product_id?, parent_id? }` — extender con `search?`.

```ts
export const bomSearchDef: SearchDefinition = {
  fields: [
    { key: 'search', label: 'Producto', type: 'text', serverParam: 'product_name' },
  ]
}
```

Integrar en `frontend/app/(dashboard)/production/boms/page.tsx`.

---

### F4.5 — `/settings/users?tab=users` (baja prioridad)

Dataset pequeño (~10-50 usuarios). Solo si se necesita filtrar por rol o estado.

**Backend:** `UserViewSet` sin `filter_backends` — añadir `search_fields = ['username', 'email', 'first_name', 'last_name']`.

**Frontend:** `useUsers` estático — extender con `filters`.

```ts
export const userSearchDef: SearchDefinition = {
  fields: [
    { key: 'search', label: 'Usuario / email', type: 'text', serverParam: 'search' },
    { key: 'is_active', label: 'Estado', type: 'enum', serverParam: 'is_active',
      options: [{ label: 'Activo', value: 'true' }, { label: 'Inactivo', value: 'false' }]
    },
  ]
}
```

---

## Rutas Tier 5 — SmartSearchBar + useClientSearch

Rutas con datasets pequeños/estáticos. Usan `SmartSearchBar` (misma UI) con
`useClientSearch` (filtrado client-side, URL sync preservado).
Ver [searchbar-decision.md](../../20-contracts/searchbar-decision.md) para el árbol de decisión completo.

| Ruta | Razón client-side |
|------|-------------------|
| `/accounting/closures` | ~1 registro/año |
| `/accounting/tax` | ~12 registros/año |
| `/treasury/accounts?tab=banks` | 5-20 registros estáticos |
| `/treasury/accounts?tab=methods` | 5-20 registros estáticos |
| `/inventory/products?tab=categories` | Dataset pequeño |
| `/inventory/uoms?tab=categories` | Dataset pequeño |
| `/inventory/stock?tab=warehouses` | 5-20 almacenes |
| `/sales/terminals?tab=providers` | 5-10 providers, estático |
| `/settings/users?tab=groups` | Dataset muy pequeño |

**Rutas promovidas a T3** (antes en Tier 5, ahora con backend FilterSet):
`/accounting/ledger`, `/treasury/accounts?tab=accounts`, `/sales/credits+tabs`,
`/inventory/attributes`, `/sales/orders?tab=notes`

**Rutas sin searchbar** (patrón diferente al DataTable estándar):
`/treasury/reconciliation`, `/inventory/stock?tab=report`, `/sales/terminals?tab=pos-terminals`

---

## Estado de implementación Tier 5 ✅ COMPLETADO 2026-05-13

| Ruta | Componente | searchDef | Estado |
|------|-----------|-----------|--------|
| `/accounting/closures` | `AccountingClosuresView.tsx` | `fiscalYearSearchDef` | ✅ |
| `/accounting/tax` | `TaxDeclarationsView.tsx` | `taxPeriodSearchDef` | ✅ |
| `/treasury/accounts?tab=banks` | `MasterDataManagement.tsx` | `bankSearchDef` | ✅ |
| `/treasury/accounts?tab=methods` | `MasterDataManagement.tsx` | `paymentMethodSearchDef` | ✅ |
| `/inventory/products?tab=categories` | `CategoryList.tsx` | `categorySearchDef` | ✅ |
| `/inventory/uoms?tab=categories` | `UoMCategoryList.tsx` | `uomCategorySearchDef` | ✅ |
| `/inventory/stock?tab=warehouses` | `WarehouseList.tsx` | `warehouseSearchDef` | ✅ |
| `/sales/terminals?tab=providers` | `PaymentHardwareManagement.tsx` | `providerSearchDef` | ✅ |
| `/settings/users?tab=groups` | `GroupManagement.tsx` | `groupSearchDef` | ✅ |

**Hallazgo de implementación:** `useClientSearch<T>` requería `T extends Record<string, unknown>`, lo que era incompatible con interfaces tipadas (sin index signature). Se cambió la constraint a `T extends object` con cast interno `const r = row as Record<string, unknown>`. Todos los call sites existentes siguen siendo válidos.

**Dead code eliminado:** `PurchasingOrdersClientView.tsx` — props `facetedFilters`, `useAdvancedFilter`, `globalFilterFields` eran código muerto (DataTable toolbar ya no los renderiza). Eliminados.

---

## Definición de Done por fase

### Por ruta
- [ ] `npm run type-check` verde
- [ ] `filterColumn` y `searchPlaceholder` eliminados — no coexisten con SmartSearchBar
- [ ] Filtros persisten en URL (F5 → chips reaparecen, datos filtrados)
- [ ] Cambiar filtro no genera 404 (cursor reset verificado)
- [ ] `?selected=` se preserva al aplicar filtros (si la ruta usa modal deeplink)
- [ ] Zero `any` nuevo

### Por fase
- [ ] `npm run test` pasa
- [ ] Code review aprobado
- [ ] Testing manual S1–S5 de [implementation-plan.md §9] completado para cada ruta
