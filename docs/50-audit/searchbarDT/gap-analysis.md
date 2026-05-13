---
layer: 50-audit
doc: searchbar-gap-analysis
status: active
created: 2026-05-13
updated: 2026-05-13
scope: Clasificación de rutas pendientes por complejidad de implementación
---

# Gap Analysis: SmartSearchBar — Rutas Pendientes

Análisis de las 37 rutas identificadas sin SmartSearchBar en el toolbar.
Clasifica cada ruta en un tier de complejidad y describe las brechas exactas
entre el estado actual y el estado objetivo.

Plan de acción: [rollout-plan.md](./rollout-plan.md)  
Árbol de decisión: [searchbar-decision.md](../../20-contracts/searchbar-decision.md)

---

## Criterios de clasificación

Una ruta está **lista para SmartSearchBar** cuando las tres capas están completas:

| Capa | Requisito |
|------|-----------|
| Backend | `filter_backends + filterset_class/fields` en el ViewSet; `search_fields` si hay campo `text` |
| Hook | Acepta `filters?: TypedFilters`; filtros incluidos en `queryKey` |
| Frontend | `searchDef` declarado; `SmartSearchBar` como `leftAction`; `filterColumn`/`searchPlaceholder` eliminados |

---

## TIER 1 — Plug-in (< 2h total)

Las tres capas están completas. Solo falta conectar los piezas.

### `/billing/purchases`
| Capa | Estado |
|------|--------|
| Backend | ✅ `InvoiceViewSet` — `filter_backends + search_fields + filterset_fields` (migrado Fase 2 audit) |
| Hook | ✅ `usePurchaseInvoices` acepta `filters?: Omit<InvoiceFilters, 'mode'>` en queryKey |
| searchDef | ✅ `purchaseInvoiceSearchDef` creado en `features/billing/searchDef.ts` |
| Integración | ❌ `PurchaseInvoicesClientView.tsx:279` usa `filterColumn="partner_name"` + `searchPlaceholder` |

**Brecha real:** una sola vista que reemplazar. Sin cambios de backend ni de hook.

---

### `/inventory/stock?tab=movements`
| Capa | Estado |
|------|--------|
| Backend | ✅ `StockMoveViewSet` — `filter_backends + StockMoveFilter + StandardResultsSetPagination` |
| Hook | ✅ `useStockMoves` acepta `StockMoveFilters` (product_id, warehouse_id, move_type, page, page_size) en queryKey |
| searchDef | ❌ No existe `stockMoveSearchDef` |
| Integración | ❌ `MovementList.tsx:174` usa `filterColumn="product_name"` + `searchPlaceholder` |

**Brecha real:** definir searchDef (2-3 campos) + integrar en MovementList.  
Mejora opcional: añadir `product_name` icontains y `date_from/to` a `StockMoveFilter`.

---

## TIER 2 — Bajo esfuerzo (4-8h/ruta)

Backend con `filter_backends`. Hook estático → necesita aceptar `filters`.

### `/sales/sessions`
| Capa | Estado |
|------|--------|
| Backend | ✅ `POSSessionViewSet` — `filterset_fields = ['status', 'treasury_account', 'user']` |
| Hook | ❌ `usePOSSessions` — queryKey estático sin filters |
| searchDef | ❌ No existe |
| Integración | ❌ `POSSessionsView.tsx:190` — `searchPlaceholder="Buscar por cajero..."` |

---

### `/sales/terminals?tab=batches`
| Capa | Estado |
|------|--------|
| Backend | ✅ `TerminalBatchViewSet` — `filterset_fields = ['status', 'provider', 'sales_date']` |
| Hook | ❌ `useTerminalBatches` — estático |
| searchDef | ❌ No existe |
| Integración | ❌ Sin searchbar actualmente |

---

### `/sales/terminals?tab=devices`
| Capa | Estado |
|------|--------|
| Backend | ✅ `PaymentTerminalDeviceViewSet` — `filterset_fields = ['provider', 'status']` |
| Hook | ❌ Sin hook dedicado (`PaymentHardwareManagement.tsx` carga datos directamente) |
| searchDef | ❌ No existe |
| Integración | ❌ `PaymentHardwareManagement.tsx:311` — `filterColumn="name"` + `searchPlaceholder` |

---

### `/inventory/products?tab=pricing-rules`
| Capa | Estado |
|------|--------|
| Backend | ✅ `PricingRuleViewSet` — `filter_backends + filterset_fields = ['product', 'category', 'active']` |
| Backend text | ❌ `search_fields` no definido — añadir `['name']` |
| Hook | ❌ `usePricingRules` — estático |
| searchDef | ❌ No existe |
| Integración | ❌ `PricingRuleList.tsx:235` — `searchPlaceholder` |

---

### `/inventory/products?tab=subscriptions`
| Capa | Estado |
|------|--------|
| Backend | ✅ `SubscriptionViewSet` — `filter_backends + filterset_fields = ['status', 'product', 'supplier']` |
| Backend text | ❌ `search_fields` no definido — añadir `['product__name']` |
| Hook | ❌ Sin hook dedicado (`SubscriptionsView.tsx` carga directamente) |
| searchDef | ❌ No existe |
| Integración | ❌ `SubscriptionsView.tsx:498` — `filterColumn="product"` + `searchPlaceholder` |

---

### `/inventory/uoms?tab=units`
| Capa | Estado |
|------|--------|
| Backend | ✅ `UoMViewSet` — `filter_backends + filterset_fields = ['category', 'active']` |
| Backend text | ❌ `search_fields` no definido — añadir `['name', 'abbreviation']` |
| Hook | ❌ `useUoMs` — estático |
| searchDef | ❌ No existe |
| Integración | ❌ `UoMList.tsx:169` — `filterColumn="name"` + `searchPlaceholder` |

---

## TIER 3 — Esfuerzo medio (0.5-1 día/ruta)

Backend sin `filter_backends`. Requiere crear `FilterSet` + hook upgrade.

### `/purchasing/orders` + `?view=card`
| Capa | Estado |
|------|--------|
| Backend | ❌ `PurchaseOrderViewSet` — sin `filter_backends`, sin `filterset_class` |
| Hook | ❌ `usePurchasingOrders` — queryKey estático |
| searchDef | ❌ No existe |
| Integración | ❌ `PurchasingOrdersClientView.tsx:460` — `filterColumn` + `searchPlaceholder` |

---

### `/accounting/entries`
| Capa | Estado |
|------|--------|
| Backend | ❌ `JournalEntryViewSet` — sin `filter_backends` |
| Hook | ❌ `useJournalEntries` — sin params, queryKey estático |
| searchDef | ❌ No existe |
| Integración | ❌ `EntriesClientView.tsx:222` — `filterColumn="description"` + `searchPlaceholder` |

---

### `/production/orders`
| Capa | Estado |
|------|--------|
| Backend | ❌ `WorkOrderViewSet` — sin `filter_backends` |
| Hook | ❌ `useWorkOrderSearch` usa `globalCache` + `useState` (P3+P4 pendientes) |
| searchDef | ❌ No existe |
| Integración | ❌ `production/orders/page.tsx:307` — `filterColumn + searchPlaceholder` |

> ⚠️ Prerequisito extra: migrar `useWorkOrderSearch` a `useQuery` antes de integrar SmartSearchBar.

---

### `/production/boms`
| Capa | Estado |
|------|--------|
| Backend | ❌ `BillOfMaterialsViewSet` — solo `?product_id=`/`?parent_id=` custom, sin `filter_backends` |
| Hook | ⚠️ `useBOMs` acepta `{ product_id?, parent_id? }` pero no search genérico |
| searchDef | ❌ No existe |
| Integración | ❌ `production/boms/page.tsx:205` — `filterColumn="product_name"` + `searchPlaceholder` |

---

### `/settings/users?tab=users` (baja prioridad)
| Capa | Estado |
|------|--------|
| Backend | ❌ `UserViewSet` (core) — sin `filter_backends` |
| Hook | ❌ `useUsers` — estático |
| searchDef | ❌ No existe |
| Integración | ❌ Sin searchbar actualmente |

---

### `/settings/users?tab=groups` (baja prioridad)
| Capa | Estado |
|------|--------|
| Backend | ❌ Sin verificar |
| Hook | ❌ Sin hook de grupos |
| searchDef | ❌ No existe |
| Integración | ❌ Sin searchbar actualmente |

---

## TIER 4 — Alto esfuerzo: crear hooks HR desde cero (~1 día bloque)

Backend HR tiene FilterSets completos. El frontend **no tiene capa de hooks**:
las páginas llaman a `hrApi` directamente. Crear los 4 hooks es trabajo extra
pero está desacoplado — se puede hacer en un solo PR.

### `/hr/employees`
| Capa | Estado |
|------|--------|
| Backend | ✅ `EmployeeViewSet` — `EmployeeFilter(status, contact)` |
| Backend text | ❌ `search_fields` no definido — añadir `['contact__name', 'contact__rut', 'position']` |
| Hook | ❌ Sin `useEmployees` — página usa `hrApi` directamente |
| searchDef | ❌ No existe |
| Integración | ❌ `hr/employees/page.tsx:162` — `searchPlaceholder` client-side |

---

### `/hr/absences`
| Capa | Estado |
|------|--------|
| Backend | ✅ `AbsenceViewSet` — `AbsenceFilter(employee, absence_type, start_date)` |
| Hook | ❌ Sin `useAbsences` |
| searchDef | ❌ No existe |
| Integración | ❌ `hr/absences/page.tsx` — `searchPlaceholder` |

---

### `/hr/advances`
| Capa | Estado |
|------|--------|
| Backend | ✅ `SalaryAdvanceViewSet` — `SalaryAdvanceFilter(employee, payroll, is_discounted)` |
| Hook | ❌ Sin `useSalaryAdvances` |
| searchDef | ❌ No existe |
| Integración | ❌ `hr/advances/page.tsx:168` — `filterColumn="employee_name"` |

---

### `/hr/payrolls`
| Capa | Estado |
|------|--------|
| Backend | ✅ `PayrollViewSet` — `PayrollFilter(employee, period_year, period_month, status)` |
| Hook | ❌ Sin `usePayrolls` |
| searchDef | ❌ No existe |
| Integración | ❌ `hr/payrolls/page.tsx:322` — `filterColumn="employee"` + `searchPlaceholder` |

---

## TIER 5 — SmartSearchBar + useClientSearch

Datasets pequeños/estáticos. Se usa `SmartSearchBar` (misma UI + URL sync + chips)
con `useClientSearch` (filtrado client-side). Sin cambios de backend.
Ver [searchbar-decision.md](../../20-contracts/searchbar-decision.md).

| Ruta | Razón client-side |
|------|-------------------|
| `/accounting/closures` | ~1 registro/año — filtro server-side desproporcionado |
| `/accounting/tax` | ~12 registros/año |
| `/treasury/accounts?tab=banks` | 5-20 registros estáticos |
| `/treasury/accounts?tab=methods` | 5-20 registros estáticos |
| `/inventory/products?tab=categories` | `CategoryViewSet` sin `filter_backends`; dataset pequeño |
| `/inventory/uoms?tab=categories` | Dataset pequeño |
| `/inventory/stock?tab=warehouses` | 5-20 almacenes |
| `/sales/terminals?tab=providers` | 5-10 providers estáticos |
| `/settings/users?tab=groups` | Dataset muy pequeño (~5-20 grupos) |

**Promovidas a T3** (requieren backend FilterSet):
`/accounting/ledger`, `/treasury/accounts?tab=accounts`, `/sales/credits+tabs`,
`/inventory/attributes`, `/sales/orders?tab=notes`

**Sin searchbar** (patrón de UI diferente al DataTable estándar):
`/treasury/reconciliation`, `/inventory/stock?tab=report`, `/sales/terminals?tab=pos-terminals`

---

## Resumen ejecutivo

| Tier | Rutas | Esfuerzo estimado | Observación |
|------|-------|-------------------|-------------|
| T1 | 2 | ~3h total | Sin bloqueantes, solo integrar |
| T2 | 6 | ~2 días | Hook upgrade + backend search_fields |
| T4 HR | 4 | ~1 día (bloque) | Backend listo, crear hooks desde cero |
| T3 | 11 | ~5-6 días | FilterSet nuevo (incluye 5 promovidos) |
| T5 | 9 | ~0.5 días (useClientSearch) | URL sync preservado, sin backend |
| **Total** | **32** | **~9-10 días** | |
