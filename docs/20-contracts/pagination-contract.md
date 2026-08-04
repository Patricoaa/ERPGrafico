---
layer: 20-contracts
doc: pagination-contract
status: active
owner: frontend-team + backend-team
created: 2026-05-23
last_review: 2026-05-28
stability: contract-changes-require-ADR
depends_on:
  - api-contracts.md
  - hook-contracts.md
  - component-datatable-views.md
---

# Contrato: Paginación end-to-end (HTTP → hook → DataTable)

Toda lista de entidades viaja por tres capas (backend, hook, componente). Históricamente cada capa tenía su propio sub-contrato (o ninguno) y los desarrolladores tenían que reconstruir la coherencia a mano — generando dos bugs estructurales:

1. **Truncado silencioso:** un endpoint que paginaba a 50 entregaba `T[]` al componente como si fuera el dataset completo. Páginas 2+ simplemente invisibles.
2. **Pie de paginación mentiroso:** `DataTable` en modo `manualPagination` calculaba "Mostrando X a Y de Z" desde `getFilteredRowModel().rows.length` (filas locales = una sola página), nunca desde el `count` del backend.

Este documento cierra el contrato cruzando las tres capas. **Si una de las tres lo viola, el bug reaparece.**

---

## 0. Resumen ejecutivo

| Capa | Responsable | Contrato |
|---|---|---|
| **HTTP** | Backend Django/DRF | Toda lista MUST devolver `{ count, next, previous, results }`. Única excepción: master data acotada (§1.5). |
| **Hook** | `features/<x>/hooks/use<Entity>.ts` | Hooks de listado MUST devolver `Page<T>` (no `T[]`). Prohibido `data.results \|\| data`. |
| **Componente** | Cualquier `<DataTable>` que reciba un `Page<T>` | MUST cablear `manualPagination`, `pageCount`, `pagination`, `onPaginationChange`, `rowCount={page.count}`. |

Reglas detalladas en las secciones 1-3.

---

## 1. Capa HTTP — envoltorio canónico

### 1.1 Forma de respuesta (MUST)

Todo endpoint `GET /api/<app>/<resource>/` que devuelva una colección MUST responder:

```json
{
  "count": 350,
  "next": "https://…/api/inventory/moves/?page=3&page_size=50",
  "previous": "https://…/api/inventory/moves/?page=1&page_size=50",
  "results": [ /* máx page_size objetos */ ]
}
```

- `count`: total de filas que matchean el filtro, **antes** de paginar. No es el length de `results`.
- `next` / `previous`: URLs absolutas o `null`. El frontend NO las parsea para extraer el page; solo las usa como booleano (`hasNextPage = !!next`).
- `results`: array de objetos serializados. Largo máximo = `page_size` efectivo.

### 1.2 Query params (MUST)

| Param | Tipo | Default | Notas |
|---|---|---|---|
| `page` | int ≥ 1 | `1` | Page-number pagination (no cursor). |
| `page_size` | int ≥ 1 | `50` | Cap obligatorio: ver §1.4. |

### 1.3 Configuración Django

Clase compartida en [backend/core/api/pagination.py](../../backend/core/api/pagination.py):

```python
from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200          # ver §1.4
```

Hoy los viewsets de `inventory` y `treasury` la usan vía `pagination_class = StandardResultsSetPagination`. **`DEFAULT_PAGINATION_CLASS` global en `settings.py` SÍ está activado** desde la auditoría 2026-06-25:

```python
# backend/config/settings.py
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'core.api.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 50,
}
```

Consecuencias de tener el default activo:

- **Transactional endpoints** (pedidos, facturas, movimientos, etc.): heredan el default automáticamente. Los que ya tenían `pagination_class = StandardResultsSetPagination` explícito no cambian.
- **Master data endpoints** (categorías, cuentas, almacenes, etc.): **deben** declarar `pagination_class = None` explícitamente para devolver `T[]` plano (§1.5). Ver lista completa en §8.
- **Nuevos viewsets**: paganizan por defecto — no es posible olvidar la paginación. Si un nuevo endpoint es master data, debe opt-out explícito.

Regla para implementación: todo viewset nuevo que NO sea master data ya cumple automáticamente. Todo viewset de master data debe agregar `pagination_class = None`.

### 1.4 `max_page_size` (MUST)

`max_page_size = 200`. Anteriormente las clases locales tenían `1000` — eso permite que un consumidor pida una página de 1000 filas y agote memoria/timeout sin que el backend lo bloquee. **200 es el tope.** Excepciones (export PDF/Excel) van por endpoints `/export/` dedicados, no por `?page_size=`.

### 1.5 Endpoints exentos (lista cerrada)

Pueden devolver `T[]` plano sin envoltorio:

- **Master data / reference data**: catálogos acotados (< 200 filas) consumidos para dropdowns, árboles, y autocomplete. NO son browsable lists — representan el dominio de valores posibles, no una colección de entidades transaccionales. Ejemplos: cuentas contables, categorías, almacenes, unidades de medida, bancos, métodos de pago, AFPs, conceptos de nómina, grupos, reglas de asignación. Ver lista completa en §8.
- Sub-recursos de detalle: `GET /api/sales/orders/{id}/lines/` (lines pertenecen al order, son acotadas por construcción).
- Endpoints de selector / typeahead: `GET /api/contacts/customers/search/?q=acm&limit=10` (top-N, no paginables).
- Singletons: `GET /api/settings/company/`.

**Cualquier endpoint nuevo que no caiga en uno de estos casos MUST paginar.** Si hay duda, paginar. La regla es "paginar por defecto".

---

## 2. Capa Hook — tipo `Page<T>` obligatorio

### 2.1 Tipo canónico

Definido una sola vez en [frontend/lib/pagination.ts](../../frontend/lib/pagination.ts) (ya existe — la propuesta original "a crear" fue completada en 2026-05-28):

```ts
// frontend/lib/pagination.ts
export interface Page<T> {
  /** Filas de la página actual. NUNCA confundir con el dataset completo. */
  results: T[]
  /** Total absoluto del backend antes de paginar. Fuente de verdad para el footer del DataTable. */
  count: number
  /** Tamaño de página efectivo (lo que el backend respetó, no lo que pediste). */
  pageSize: number
  /** Page-number 1-based, tal como lo enviás al backend. */
  pageIndex: number
  /** Derivado del backend (envoltorio DRF). No recalcular. */
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PageParams {
  page?: number       // default 1
  page_size?: number  // default 50
}

/** Empty page placeholder para estados skeleton de `useQuery`. */
export function emptyPage<T>(pageSize = 50): Page<T> { … }
```

### 2.2 Forma de retorno del hook (MUST)

Todo hook que consuma un endpoint paginado MUST devolver `Page<T>` (envuelto o no en el retorno completo). Patrón canónico:

```ts
// ✅ Correcto
export function useTreasuryMovements(filters: TreasuryMovementFilters = {}) {
  const { page = 1, page_size = 50, ...rest } = filters

  const { data, isLoading, isFetching, refetch } = useQuery<Page<TreasuryMovement>>({
    queryKey: MOVEMENTS_KEYS.list({ page, page_size, ...rest }),
    queryFn: ({ signal }) => treasuryApi.getMovements({ page, page_size, ...rest }, signal),
    staleTime: 2 * 60 * 1000,  // tier "Transactional"
  })

  return {
    page: data,                              // Page<TreasuryMovement> | undefined
    movements: data?.results ?? [],          // alias de conveniencia
    isLoading,
    isFetching,
    refetch,
  }
}
```

La capa `api/` MUST devolver `Promise<Page<T>>` — convertir el envoltorio HTTP a `Page<T>` ahí, no en el hook ni en el componente:

```ts
// frontend/features/treasury/api/treasuryApi.ts
import { toPage } from '@/lib/pagination'

export const treasuryApi = {
  getMovements: async (
    params: TreasuryMovementFilters,
    signal?: AbortSignal,
  ): Promise<Page<TreasuryMovement>> => {
    const { data } = await api.get('/treasury/movements/', { params, signal })
    return toPage<TreasuryMovement>(data, params.page ?? 1, params.page_size ?? 50)
  },
}
```

Helper único en `frontend/lib/pagination.ts`:

```ts
// frontend/lib/pagination.ts (implementación real)
export function toPage<T>(envelope: unknown, pageIndex: number, pageSize: number): Page<T> {
  // Runtime guard — el backend puede romper el contrato (§1.1)
  if (!isDrfEnvelope<T>(envelope)) {
    throw new Error('Backend did not return the {count, next, previous, results} envelope. …')
  }
  return {
    results: envelope.results,
    count: envelope.count,
    pageSize,
    pageIndex,
    hasNextPage: !!envelope.next,
    hasPrevPage: !!envelope.previous,
  }
}
```

`isDrfEnvelope` valida `count: number`, `results: array`, y `next`/`previous` como `string | null`.
Si el backend devuelve `T[]` en un endpoint declarado paginado, `toPage` **lanza** (debe
aflorar, no ocultarse) — el mensaje apunta a este contrato §1.1.

### 2.3 Anti-patrones (MUST NOT)

```ts
// ❌ NUNCA — descartar el envoltorio en api/
return data.results || data
// → si data es {count, results}, devuelve solo 50 filas y pierde el count.
// → si data es T[] (endpoint sin paginar), funciona por casualidad.
// → el componente no tiene cómo distinguir los dos casos.

// ❌ NUNCA — tipar el retorno como T[]
getOrders: async (): Promise<SaleOrder[]> => { … }
// → el tipo miente: puede ser "todas las órdenes" o "las primeras 50".

// ❌ NUNCA — exponer movements: T[] sin totalCount
return { movements: data?.results ?? [], isLoading }
// → DataTable no puede mostrar el conteo real, ni puede activar manualPagination.

// ❌ NUNCA — el componente parsea data.next con URL()
const nextPage = new URL(data.next).searchParams.get('page')
// → frágil. El hook ya tiene pageIndex; pasalo hacia arriba.
```

### 2.4 Estado del query cache

La `queryKey` MUST incluir `page` y `page_size` para que cada página tenga entrada separada en cache. Sin eso, navegar entre páginas refetchea pero no preserva la anterior y se ve flicker.

```ts
// ✅
queryKey: MOVEMENTS_KEYS.list({ page, page_size, ...filters })

// ❌
queryKey: MOVEMENTS_KEYS.list({ ...filters })  // pierde paginación
```

`keepPreviousData: true` (o `placeholderData: keepPreviousData` en TanStack v5+) es **fuertemente recomendado** para evitar que el body de la tabla colapse en cada cambio de página.

---

## 3. Capa Componente — `<DataTable>` consumiendo `Page<T>`

### 3.1 Regla absoluta (MUST)

Si un hook devuelve `Page<T>`, el `<DataTable>` que renderiza esos datos MUST estar en modo `manualPagination` completo:

```tsx
// ✅ Patrón canónico
const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })

const { page, isLoading } = useTreasuryMovements({
  page: pageState.pageIndex + 1,    // backend es 1-based, TanStack es 0-based
  page_size: pageState.pageSize,
  ...filters,
})

<DataTable
  columns={columns}
  data={page?.results ?? []}
  isLoading={isLoading}
  manualPagination
  pageCount={page ? Math.ceil(page.count / page.pageSize) : 0}
  rowCount={page?.count ?? 0}              // ← prop nueva, requerida por el footer
  pagination={pageState}
  onPaginationChange={setPageState}
/>
```

### 3.2 Prop `rowCount` (nueva, MUST cuando `manualPagination`)

`DataTable` MUST aceptar `rowCount?: number` y propagarla a `useReactTable({ rowCount })`. `DataTablePagination` MUST leer `table.getRowCount()` (TanStack v8 built-in), **no** `table.getFilteredRowModel().rows.length`, para el total mostrado en el footer.

Cambios concretos requeridos (rastrear en el PR que cierre este contrato):

- [frontend/components/shared/DataTable.tsx:103-109](../../frontend/components/shared/DataTable.tsx#L103) — añadir `rowCount?: number` al `DataTableProps`.
- [frontend/components/shared/DataTable.tsx:196-221](../../frontend/components/shared/DataTable.tsx#L196) — pasarla a `useReactTable({ rowCount })`.
- [frontend/components/shared/DataTablePagination.tsx:32-37](../../frontend/components/shared/DataTablePagination.tsx#L32) — reemplazar `table.getFilteredRowModel().rows.length` por `table.getRowCount()` en las dos ocurrencias.

### 3.3 Cuándo NO usar `manualPagination`

Solo si el hook devuelve `T[]` por una de estas razones legítimas:

- El endpoint es de los exentos en §1.5 (master data, sub-recurso, selector, singleton).
- La lista vive enteramente en cliente (datos derivados, no fetcheados de un endpoint paginado).

En esos casos, `<DataTable>` opera en modo cliente (default). **No mezclar**: si el hook expone `Page<T>` parcial y vos lo renderizás sin `manualPagination`, estás truncando datos silenciosamente.

### 3.4 Anti-patrones (MUST NOT)

```tsx
// ❌ Hook paginado + DataTable cliente = truncado silencioso
const { movements } = useTreasuryMovements()   // solo 50 filas
<DataTable data={movements} />                 // user ve "1 de 1 página" pero hay 300

// ❌ manualPagination sin pageCount o sin rowCount
<DataTable data={page.results} manualPagination />
// → pageCount = undefined → DataTable cree que hay 1 página
// → rowCount ausente → footer dice "Mostrando 1 a 50 de 50" aunque count=350

// ❌ pageSize hardcodeado en el componente, ignora la prop del hook
<DataTable data={page.results} manualPagination pageCount={Math.ceil(page.count / 50)} />
// → si el usuario cambia el size selector a 100, el cálculo queda mal.
//   Usar SIEMPRE page.pageSize.
```

---

## 4. Decision tree — ¿este listado necesita Page<T>?

```
¿El endpoint puede devolver más de ~50 filas en algún escenario realista?
├── SÍ  → MUST paginar (§1) + hook devuelve Page<T> (§2) + DataTable manual (§3)
└── NO  → ¿es master data / reference data? (§1.5, §8)
         ├── SÍ → puede devolver T[] plano, hook devuelve T[], DataTable cliente
         └── NO → ¿es sub-recurso / selector / singleton? (§1.5)
                  ├── SÍ → puede devolver T[] plano
                  └── NO → MUST paginar igual. La regla es "paginar por defecto".
```

Caso ambiguo (ej. "warehouses, máximo 20"): si está en la lista de master data (§8), exento. Si no, pagina igual. El costo de paginar 20 filas es cero; el costo de no paginar el día que sean 200 es el bug actual.

---

## 5. Estado por hook — auditoría 2026-05-23

Snapshot inicial. Se actualiza con cada migración en el mismo PR.

| Hook | Endpoint | Hoy devuelve | Compliant | Acción |
|---|---|---|---|---|
| [useTreasuryMovements](../../frontend/features/treasury/hooks/useTreasuryMovements.ts#L44) | `/treasury/movements/` | `{ page, movements, totalCount, isLoading, isFetching, refetch }` | ✅ Sí | `page` expuesto; `movements`/`totalCount` como alias de conveniencia |
| [useStockMoves](../../frontend/features/inventory/hooks/useStockMoves.ts#L62) | `/inventory/moves/` | `{ page, moves, totalCount, isLoading, isFetching, refetch }` | ✅ Sí | Usa `toPage<StockMove>` en el `queryFn` |
| [useReconciledLinesQuery](../../frontend/features/finance/bank-reconciliation/hooks/useReconciliationQueries.ts#L148) | `/finance/…/statements/{id}/reconciled-lines/` | `Page<T>` propio (params `page`/`pageSize`) | 🟡 Parcial | El `Page<T>` se arma en el hook pero el consumidor ([ReconciliationPanel.tsx:831,897](../../frontend/features/finance/bank-reconciliation/components/ReconciliationPanel.tsx#L831)) cablea `manualPagination` a mano; unificar con el patrón canónico |
| [salesApi.getOrders](../../frontend/features/sales/api/salesApi.ts#L15) | `/sales/orders/` | `Promise<Page<SaleOrder>>` | ✅ Sí | `toPage<SaleOrder>(data, page, page_size)` |
| [inventoryApi.getProducts](../../frontend/features/inventory/api/inventoryApi.ts#L34), `getInventoryDocuments`, `getInventoryCounts` | `/inventory/products/`, `/inventory/documents/`, `/inventory/counts/` | `Promise<Page<…>>` | ✅ Sí | Todos pasan por `toPage` |
| [useUsers](../../frontend/features/users/hooks/useUsers.ts#L12) | `/users/` | `{ page, users, isLoading, refetch }` | ✅ Sí | Expone `page` |
| [useJournalEntries](../../frontend/features/accounting/hooks/useJournalEntries.ts#L79) | `/accounting/journal-entries/` | `entries: pageData?.results ?? []` | 🟡 Parcial | Consume `Page<T>` interno pero no expone `page` — verificar si el DataTable consumidor necesita el footer |
| [useDrafts (pos)](../../frontend/features/pos/hooks/useDrafts.ts#L67) | `/pos/drafts/` | `raw?.results ?? []` (descarta envoltorio) | 🔴 No | Migrar a `Page<T>` |
| [useProducts (pos)](../../frontend/features/pos/hooks/useProducts.ts#L52) | `/pos/products/` | `page.results ?? []` con `as` casts | 🔴 No | Migrar a `Page<T>`; eliminar `as unknown as` |
| [productionApi.getBOMs](../../frontend/features/production/api/productionApi.ts#L55) | `/production/boms/` | `r.data.results` (descarta envoltorio) | 🔴 No | Migrar a `Page<BOM>` |
| Todos los hooks de detalle (`use<Entity>(id)`) | `/<resource>/{id}/` | `T` | ✅ N/A | Detalle no se pagina |

### Orden de migración — estado 2026-08-04 (reconciliado con código real)

| # | Paso | Estado |
|---|------|--------|
| 1 | `frontend/lib/pagination.ts` (`Page<T>`, `toPage`, `emptyPage`) | ✅ hecho |
| 2 | prop `rowCount` en `DataTable` + `DataTablePagination` lee `getRowCount()` (§3.2) | ✅ hecho |
| 3 | `StandardResultsSetPagination` consolidada en `backend/core/api/pagination.py` (sin duplicados) | ✅ hecho |
| 4 | `max_page_size` 1000 → 200 (§1.4) | ✅ hecho |
| 5 | ESLint rules `pagination/*` (§6) | ✅ hechas |
| 6 | `api-contracts.md` reconciliado (page-number, max 200, default 50) | ✅ hecho |
| 7 | Migrar hooks `data.results \|\| data` → `Page<T>` (sales, inventory, treasury, users) | ✅ hecho |
| 8 | **Activar `DEFAULT_PAGINATION_CLASS` global en `settings.py`** | ✅ hecho — ya activo (`settings.py:284`) |
| 9 | Migrar residuales: `productionApi.getBOMs`, `pos/useDrafts`, `pos/useProducts`, `useJournalEntries`, `useReconciledLinesQuery` | 🔴 pendiente (bloqueado por nada; riesgo: truncado silencioso en esos listados) |

---

## 6. Enforcement mecánico

Tres reglas de paginación **ya existen** en [frontend/eslint-rules/](../../frontend/eslint-rules/) y están activas como `error` (registradas bajo el namespace `pagination/` en [frontend/eslint.config.mjs:248-277](../../frontend/eslint.config.mjs#L248)):

| Rule | Detecta | Severidad |
|---|---|---|
| [`pagination/no-envelope-discard`](../../frontend/eslint-rules/pagination-no-envelope-discard.mjs) | `data.results \|\| data`, `?.results ?? data`, optional-chained variantes | **`error`** |
| [`pagination/no-raw-response-data`](../../frontend/eslint-rules/pagination-no-raw-response-data.mjs) | usar `response.data` crudo en el componente/hook (evita saltarse `toPage`) | **`error`** |
| [`pagination/datatable-needs-rowcount`](../../frontend/eslint-rules/pagination-datatable-needs-rowcount.mjs) | `<DataTable manualPagination />` sin `rowCount` (JSX AST) | **`error`** (es bug visible) |

**Auditoría manual** (correr antes de cada release):

```bash
# 1. Hooks/APIs que descartan el envoltorio
grep -rn "\.results || data\|\.results ?? data" frontend/features --include="*.ts"

# 2. DataTable manual sin rowCount (visual scan)
grep -rn "manualPagination" frontend/features --include="*.tsx" -A 4 | grep -B 4 "pageCount" | grep -v "rowCount"

# 3. Hooks que devuelven Promise<T[]> sobre endpoints listables
grep -rn "Promise<\w*\[\]>" frontend/features/*/api/*.ts
```

Cualquier resultado distinto del baseline anterior = desviación, clasificar con el procedimiento de [hook-contracts.md §Handling contract deviations](./hook-contracts.md#handling-contract-deviations).

---

## 7. Deuda conocida (pendiente real)

- **`DEFAULT_PAGINATION_CLASS` global está ACTIVO** (`settings.py:284`) — la paginación ya es el default para todos los viewsets. Los endpoints de master data (§8) deben declarar `pagination_class = None`; verificar que ninguno se haya truncado silenciosamente a 50 tras la activación.
- **Residuales sin migrar a `Page<T>`** (riesgo de truncado silencioso en esos listados, ya que el backend pagina por default): `productionApi.getBOMs`, `pos/useDrafts`, `pos/useProducts`, `useJournalEntries` (parcial), `useReconciledLinesQuery` (parcial).
- **`useStockMovesList` deprecado** fue eliminado — el consumidor único ([MovementList.tsx](../../frontend/features/inventory/components/MovementList.tsx)) migró a `useStockMoves`.

> **Cerrado desde la auditoría 2026-05-23:** `lib/pagination.ts`, prop `rowCount` + `getRowCount()`, consolidación de `StandardResultsSetPagination` en `core/api/pagination.py`, `max_page_size=200`, reconciliación de `api-contracts.md` y las ESLint rules `pagination/*` (§6). **Cerrado el 2026-08-04:** activación de `DEFAULT_PAGINATION_CLASS` global y migración de sales/inventory/treasury/users.

---

## 8. Apéndice — Mapa de clasificación master data vs transactional

Lista completa de viewsets clasificados durante la auditoría 2026-06-25. Los master data endpoints devuelven `T[]` sin envoltorio (§1.5). Los transactional endpoints mantienen paginación con `StandardResultsSetPagination`.

### Master data (22 viewsets — sin paginación)

| App | ViewSet | Endpoint |
|-----|---------|----------|
| accounting | `AccountViewSet` | `GET /api/accounting/accounts/` |
| accounting | `FiscalYearViewSet` | `GET /api/accounting/fiscal-years/` |
| inventory | `CategoryViewSet` | `GET /api/inventory/categories/` |
| inventory | `WarehouseViewSet` | `GET /api/inventory/warehouses/` |
| inventory | `UoMViewSet` | `GET /api/inventory/uoms/` |
| inventory | `UoMCategoryViewSet` | `GET /api/inventory/uom-categories/` |
| inventory | `ProductAttributeViewSet` | `GET /api/inventory/product-attributes/` |
| inventory | `ProductAttributeValueViewSet` | `GET /api/inventory/product-attribute-values/` |
| inventory | `PricingRuleViewSet` | `GET /api/inventory/pricing-rules/` |
| hr | `AFPViewSet` | `GET /api/hr/afps/` |
| hr | `PayrollConceptViewSet` | `GET /api/hr/concepts/` |
| hr | `EmployeeViewSet` | `GET /api/hr/employees/` |
| tax | `AccountingPeriodViewSet` | `GET /api/tax/periods/` |
| treasury | `BankViewSet` | `GET /api/treasury/banks/` |
| treasury | `PaymentMethodViewSet` | `GET /api/treasury/payment-methods/` |
| treasury | `TreasuryAccountViewSet` | `GET /api/treasury/accounts/` |
| treasury | `POSTerminalViewSet` | `GET /api/treasury/pos-terminals/` |
| treasury | `TerminalProviderViewSet` | `GET /api/treasury/terminal-providers/` |
| treasury | `TerminalDeviceViewSet` | `GET /api/treasury/terminal-devices/` |
| core | `GroupViewSet` | `GET /api/groups/` |
| workflow | `NotificationRuleViewSet` | `GET /api/workflow/notification-rules/` |
| workflow | `TaskAssignmentRuleViewSet` | `GET /api/workflow/assignment-rules/` |

### Transactional (mantienen paginación)

| App | ViewSets representativos |
|-----|--------------------------|
| sales | `OrderViewSet`, `QuotationViewSet`, `InvoiceViewSet`, `CreditNoteViewSet`, `DebitNoteViewSet`, `DeliveryNoteViewSet`, `ReceiptViewSet` |
| purchasing | `PurchaseOrderViewSet`, `PurchaseInvoiceViewSet`, `PurchaseReceiptViewSet` |
| inventory | `StockMoveViewSet`, `TransferViewSet`, `ProductViewSet`, `KitViewSet`, `SerialNumberViewSet`, `StockAdjustmentViewSet`, `SubscriptionViewSet`, `ProductUoMPriceViewSet` |
| accounting | `JournalEntryViewSet`, `JournalEntryItemViewSet` |
| billing | `InvoiceViewSet`, `CreditNoteViewSet`, `DebitNoteViewSet` |
| treasury | `MovementViewSet`, `CheckViewSet`, `LoanViewSet`, `LoanInstallmentViewSet`, `CreditLineViewSet`, `CardStatementViewSet` |
| contacts | `CustomerViewSet`, `SupplierViewSet` |
| hr | `PayrollViewSet`, `PayrollItemViewSet`, `AbsenceViewSet`, `SalaryAdvanceViewSet` |
| production | `WorkOrderViewSet`, `BOMViewSet`, `ProductionOrderViewSet` |
| pos | `SessionViewSet`, `DraftViewSet` |
| finance | `BankStatementViewSet`, `ReconciliationViewSet` |
| workflow | `WorkflowSettingsViewSet` |
| users | `UserViewSet` |

---

## Checklist de PR — listado paginado

Antes de mergear cualquier PR que añada o modifique un listado:

- [ ] El endpoint backend devuelve `{count, next, previous, results}` (§1.1) o está justificado como exento (§1.5).
- [ ] El método de `api/` tiene retorno `Promise<Page<T>>` (no `Promise<T[]>`).
- [ ] El hook usa el helper `toPage()` — no construye el `Page<T>` a mano.
- [ ] El hook expone `Page<T>` (o un objeto que lo contenga), nunca solo `results`.
- [ ] La `queryKey` incluye `page` y `page_size`.
- [ ] `<DataTable>` consumidor declara `manualPagination`, `pageCount`, `rowCount`, `pagination`, `onPaginationChange`.
- [ ] `page.pageSize` se usa en el cálculo de `pageCount` (no un literal).
- [ ] Grep `data.results || data` y `data.results ?? data` sobre el diff → 0 resultados.
- [ ] Smoke manual: navegar a página 2 y volver — la URL/estado debe persistir y el contador "Mostrando X a Y de Z" debe ser correcto en ambas.
