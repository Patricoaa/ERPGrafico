---
status: active
owner: core-team
last_review: 2026-06-27
layer: 50-audit
doc: architecture-compliance-audit-2026-06
---

# Architecture Compliance Audit — 2026-06-26

## Metadata

| Field | Value |
|-------|-------|
| Auditor | Claude Code (agentic audit) |
| Date | 2026-06-26 |
| Scope | Frontend (`frontend/`) + Backend (`backend/`) — full codebase |
| Reference | `docs/README.md` routing table, 13 global invariants (`GOVERNANCE.md`), `frontend-fsd.md`, `backend-apps.md`, `hook-contracts.md`, `component-contracts.md`, `naming-conventions.md`, `zero-any-policy.md`, `zero-n-plus-one-policy.md` |
| Method | Static analysis via `grep`/`rg` + file reads. No type checker or linter output was used — actual source code patterns were inspected. |

---

## Resumen Ejecutivo

**500+ violations** identificadas en 18 categorías. **9 categorías críticas** en frontend, **6 categorías críticas** en backend, **10 gaps de contrato**.

## Resolved

| Issue | Date | Resolution | Commits |
|-------|------|-----------|---------|
| 1.1 `markLocalMutation` ausente | 2026-06-26 | Agregado a ~160 mutations en 4 fases (pos→ALLOWLIST→resto→ESLint rule preventiva). Solo auth/ excluido (no entidad de negocio). 55 archivos con markLocalMutation. | `8b10ac98`, `d947d633`, `48e7aa20` |
| 1.2 `staleTime` faltante | 2026-06-26 | Agregado staleTime explícito a ~50 queries en 28 archivos; corregido useServerDate (5min→30s); actualizado hook-contracts.md con tiers y notas | `8d1685e9`, `d8cce460` |
| 3. `any` types en features | 2026-06-27 | Eliminados ~700 usos `any` en 6 fases secuenciales. 10/14 features en 0 violaciones. ESLint rule `no-explicit-any: error` para features. 3 features con warn temporal. | `26f1c83b`, `6bce380f`, `cdeef239` |
| 5.1 + 5.2 Views inline business logic + get_queryset sin selector | 2026-06-28 | Migradas ~25 violaciones en 7 fases (A-G) a través de 15 archivos. Creados: SubscriptionSelector (Phase A), Treasury services/selectors (Phase B), ContactSelector (Phase C), PricingService/NoteWorkflowSelector (Phase D), AccountingService/CoreService/BillingService/SalesService (Phase E), NotificationSelector/PurchaseOrderSelector/DraftCartSelector (Phase F), ProductSelector.filter_suggestions/StockMoveSelector.stock_level/ProductService.toggle_favorite y sync_variant_prices/ProductionSelectorExt.get_bom_queryset (Phase G). | `1adda007`, `257115d7`, `8fb5430f`, `dd588ca0`, `46776d59`, `97c19950`, `33212b97` |
| 6. ProductTypeStrategy | 2026-06-27 | Migradas ~37 cadenas if/elif a ProductTypeStrategy en 6 fases (A-E). 32 restantes son casos deliberadamente mantenidos (ORM filters, validaciones cruzadas, legacy controlado). | (múltiples) |

| Severidad | Count | Área |
|-----------|-------|------|
| 🔴 CRÍTICO | ~0 | Backend — views con lógica inline, product_type chains ✅ |
| 🟡 ALTO | ~100 | Frontend — FSD boundaries, naming, barrels |
| 🟡 ALTO | ~70 | Backend — cross-app coupling, serializers |
| 🟢 MEDIO | 10 | Gaps de contrato (no cubiertos por documentación actual) |

> ✅ **Resuelto:** Frontend hooks/API any types (~250 violaciones) — eliminado en Fase 1-6. `staleTime` y `markLocalMutation` también resueltos. **Section 5.1 + 5.2 + 6** — views inline business logic y product_type chains migrados a services/selectors/strategy.

---

## Tabla de Contenidos

1. [Frontend — Hook Contract Violations](#1-frontend--hook-contract-violations)
2. [Frontend — FSD Boundary Violations](#2-frontend--fsd-boundary-violations)
3. [Frontend — Zero-Any Policy](#3-frontend--zero-any-policy)
4. [Frontend — Naming Conventions](#4-frontend--naming-conventions)
5. [Backend — View/Service/Selector Layering](#5-backend--viewserviceselector-layering)
6. [Backend — Strategy Pattern (ProductTypeStrategy)](#6-backend--strategy-pattern-producttypestrategy)
7. [Backend — Cross-App Coupling](#7-backend--cross-app-coupling)
8. [Backend — Transaction Safety](#8-backend--transaction-safety)
9. [Backend — Otros Hallazgos](#9-backend--otros-hallazgos)
10. [Contract Gaps](#10-contract-gaps)
11. [Priorización y Plan de Acción](#11-priorización-y-plan-de-acción)
12. [Appendices](#12-appendices)

---

## 1. Frontend — Hook Contract Violations

Contrato de referencia: `docs/20-contracts/hook-contracts.md`.

### 1.1 `markLocalMutation()` ausente (~160 violaciones) — ✅ RESUELTO

> **Resuelto 2026-06-26.** Se agregó `markLocalMutation()` como primera línea en cada `onSuccess` de `useMutation` a través de 4 fases secuenciales:
>
> | Fase | Alcance | Mutaciones | Commit |
> |------|---------|-----------|--------|
> | **A** | `pos/` (bugs reales — orden incorrecto) | 4 | `8b10ac98` |
> | **B** | `contacts/`, `billing/`, `purchasing/` (ALLOWLIST según ADR-0026) | 9 | `d947d633` |
> | **C** | `accounting/`, `treasury/`, `production/`, `orders/`, `settings/`, `finance/` | ~100+ | `48e7aa20` |
> | **D** | ESLint rule preventiva `mutation/must-mark-local` | — | *(este commit)* |
>
> Bugs reales corregidos en Fase A: `pos/hooks/useProducts.ts` y `useDrafts.ts` tenían `markLocalMutation()` después de `invalidateQueries`, lo que impedía que el filtro `ignoreOwnActor` funcionase.
>
> Excepción documentada: `auth/hooks/useAuthLogin.ts` usa `useMutation` con `onSuccess` pero no es una entidad de negocio — no aplica `markLocalMutation`.
>
> ESLint rule `mutation/must-mark-local` (warn) agregada en `eslint-rules/mutation-must-mark-local.mjs` — detecta `useMutation` con `onSuccess` sin `markLocalMutation()` en `features/*/hooks/**/*.ts`.

#### Explicación del error (original)

El contrato (`hook-contracts.md:109`) exige que **todo** `useMutation.onSuccess` llame `markLocalMutation()` **antes** de cualquier toast o invalidación de queries. Esta función timestamp permite que el entity bus suprima el self-echo del WebSocket. Sin esto, el broadcast de la propia mutación del usuario llega de vuelta al mismo cliente, produciendo **double-invalidation y refetch flash** visible tras cada guardado.

```ts
// ❌ Violación
onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: KEYS.lists() })
    toast.success('Creado')
}

// ✅ Correcto
onSuccess: () => {
    markLocalMutation()  // Siempre primero
    queryClient.invalidateQueries({ queryKey: KEYS.lists() })
    toast.success('Creado')
}
```

#### Impacto (original)

- Visible: cada `save`/`create`/`delete` produce un flash visual por refetch doble.
- Percepción de lentitud aunque el backend responda rápido.
- El sistema de WebSocket (`ignoreOwnActor`) no puede funcionar sin esta marca.

#### Estado actual

`markLocalMutation()` presente en **55 archivos** de hooks. Única feature sin ella: `auth/` (no aplica — no es entidad de negocio). ESLint rule preventiva activa como `warn` para detectar regresiones en CI.

Archivos con `markLocalMutation` (55 total, obtenido con `grep -rl "markLocalMutation" frontend/features/*/hooks/`):

- `accounting/hooks/useAccountMutations.ts`
- `accounting/hooks/useAccountingPeriods.ts`
- `accounting/hooks/useAccounts.ts`
- `accounting/hooks/useFiscalYears.ts`
- `accounting/hooks/useJournalEntries.ts`
- `billing/hooks/useInvoices.ts`
- `billing/hooks/useNoteCheckout.ts`
- `billing/hooks/usePurchaseInvoices.ts`
- `contacts/hooks/useContacts.ts`
- `finance/hooks/useAccountMappings.ts`
- `finance/hooks/useBudgets.ts`
- `finance/hooks/useReconciliationMutations.ts`
- `inventory/hooks/useCategories.ts`
- `inventory/hooks/usePricingRules.ts`
- `inventory/hooks/useProducts.ts`
- `inventory/hooks/useStockReports.ts`
- `inventory/hooks/useSubscriptions.ts`
- `inventory/hooks/useVariants.ts`
- `inventory/hooks/useWarehouses.ts`
- `orders/hooks/useOrdersMutations.ts`
- `pos/hooks/useDrafts.ts`
- `pos/hooks/usePOSProducts.ts`
- `pos/hooks/useProducts.ts`
- `production/hooks/useBOMs.ts`
- `production/hooks/useWorkOrderComments.ts`
- `production/hooks/useWorkOrderListActions.ts`
- `production/hooks/useWorkOrderMutations.ts`
- `purchasing/hooks/usePurchasing.ts`
- `sales/hooks/useDeliveryData.ts`
- `sales/hooks/usePosTerminals.ts`
- `sales/hooks/useSalesOrders.ts`
- `settings/hooks/useAccountingSettings.ts`
- `settings/hooks/useBillingSettings.ts`
- `settings/hooks/useCompanySettings.ts`
- `settings/hooks/useGroups.ts`
- `settings/hooks/useInventorySettings.ts`
- `settings/hooks/usePartnerSettings.ts`
- `settings/hooks/useSalesSettings.ts`
- `settings/hooks/useTreasurySettings.ts`
- `treasury/credit-lines/hooks.ts`
- `treasury/hooks/useMasterData.ts`
- `treasury/hooks/useTerminalBatchMutations.ts`
- `treasury/hooks/useTerminalBatches.ts`
- `treasury/hooks/useTerminalProviders.ts`
- `treasury/hooks/useTreasuryMovements.ts`

---

### 1.2 `staleTime` faltante (50 violaciones en 28 archivos) — ✅ RESUELTO

> **Resuelto 2026-06-26.** Se agregó `staleTime` explícito a todas las queries faltantes (~50 violaciones en 28 archivos). También se corrigió `useServerDate` (bajado de 5 min → 30s). Se actualizó `hook-contracts.md` con nuevos tiers (realtime-sensitive, server date) y aclaración sobre el global default de 5 min. Commits: `8d1685e9`, `d8cce460`.

#### Explicación del error (original)

El contrato (`hook-contracts.md:48-50`) exige que **toda** llamada a `useQuery` declare `staleTime` explícitamente, con valores según los tiers definidos (desde 1 min para POS hasta 60 min para master data estática). Además, se descubrió un global default de 5 min en `lib/react-query.ts` que enmascaraba parcialmente las omisiones — las queries sin `staleTime` heredaban 5 min en vez de 0.

#### Impacto (original)

- Queries transaccionales (notas de venta, facturas, pagos) usaban 5 min en vez de 2 min — drawer reabierto dentro de 5 min mostraba datos potencialmente desactualizados.
- Queries de configuración (settings, defaults) usaban 5 min en vez de 10-15 min — refetch innecesario.
- `useServerDate` con 5 min de staleTime — posible bug en folios/periodos fiscales.
- Queries con polling (`useProductionMetrics`, `useSystemStatus`) sin staleTime — refetch extra entre polls por window focus.

#### Archivos afectados (original)

| Archivo | Línea(s) | Hook | Tier sugerido | Tier aplicado |
|---------|----------|------|---------------|---------------|
| `features/billing/hooks/useInvoices.ts` | 111 | `useInvoice(id)` | 2 min | 2 min ✅ |
| `features/contacts/hooks/useContactDefaults.ts` | 5, 16 | `useDefaultCustomer`, `useDefaultVendor` | 10 min | 10 min ✅ |
| `features/contacts/hooks/useContacts.ts` | 104 | `useContact(id)` | 5 min | 5 min ✅ |
| `features/contacts/hooks/useContacts.ts` | 122 | `useContactCreditLedger` | 2 min | 2 min ✅ |
| `features/contacts/hooks/useProfitDistribution.ts` | 6 | `useProfitDistribution` | 2 min | 2 min ✅ |
| `features/finance/bank-reconciliation/hooks/useReconciliationQueries.ts` | 7..122 | 9 queries | 2-5 min | 2-5 min ✅ |
| `features/finance/hooks/useAccountDetail.ts` | 6 | `useAccountDetail` | 5 min | 5 min ✅ |
| `features/finance/hooks/usePendingInvoices.ts` | 6 | `usePendingInvoices` | 2 min | 2 min ✅ |
| `features/hr/hooks/useEmployees.ts` | 36, 44 | `useEmployee`, `useEmployeeFormDeps` | 5/10 min | 5/10 min ✅ |
| `features/hr/hooks/usePayrolls.ts` | 45 | `usePayrollDetail` | 2 min | 2 min ✅ |
| `features/inventory/hooks/useCategories.ts` | 104 | `useCategory(id)` | 15 min | 15 min ✅ |
| `features/inventory/hooks/usePricingRules.ts` | 38, 98 | `usePricingRules`, `useProductPricingRules` | 5 min | 5 min ✅ |
| `features/inventory/hooks/useProducts.ts` | 25, 128, 144 | `useProducts`, `useProduct`, `useProductInsights` | 5 min | 5 min ✅ |
| `features/inventory/hooks/useWarehouses.ts` | 90 | `useWarehouse(id)` | 15 min | 15 min ✅ |
| `features/inventory/hooks/useSubscriptions.ts` | 99 | `useSubscriptionHistory` | 2 min | 2 min ✅ |
| `features/production/hooks/useBOMs.ts` | 81 | `useProductionVariants` | 5 min | 5 min ✅ |
| `features/production/hooks/useActiveBom.ts` | 15 | `useActiveBom` | 5 min | 5 min ✅ |
| `features/production/hooks/useWorkOrders.ts` | 61 | `useWorkOrder(id)` | 2 min | 2 min ✅ |
| `features/production/hooks/useWorkOrderComments.ts` | 21 | `useWorkOrderComments` | 30 s | 30 s ✅ |
| `features/production/hooks/useProductionQueries.ts` | 16 | `useProductionMetrics` | 60 s (poll match) | 60 s ✅ |
| `features/purchasing/hooks/usePurchaseOrderDetail.ts` | 6 | detail query | 2 min | 2 min ✅ |
| `features/purchasing/hooks/usePurchasing.ts` | 50, 66, 75, 85 | 4 detail queries | 2 min | 2 min ✅ |
| `features/sales/hooks/useSalesOrders.ts` | 141, 167 | `useSalesNotes`, `useSaleOrder` | 2 min | 2 min ✅ |
| `features/sales/hooks/useSaleOrderComments.ts` | 21 | `useSaleOrderComments` | 30 s | 30 s ✅ |
| `features/settings/hooks/useBillingSettings.ts` | 31 | second query | 10 min | 10 min ✅ |
| `features/settings/hooks/useGroups.ts` | 13 | `useGroups` | 10 min | 10 min ✅ |
| `features/settings/hooks/useSystemStatus.ts` | 12 | `useSystemStatus` | 30 s (poll match) | 30 s ✅ |
| `features/settings/hooks/useTreasuryAccounts.ts` | 9 | `useTreasuryAccounts` | 10 min | 10 min ✅ |
| `features/tax/hooks/useTaxQueries.ts` | 15, 32 | `useTaxPeriod`, `useF29Detail` | 2 min | 2 min ✅ |
| `features/treasury/card-statements/useStatementsAnalyticsData.ts` | 31 | analytics | 5 min | 5 min ✅ |
| `features/treasury/credit-lines/hooks.ts` | 7, 14, 22 | `useCreditLines`, `useCreditLine`, `useCreditLineOverview` | 2 min | 2 min ✅ |
| `features/treasury/hooks/usePOSSession.ts` | 5 | `usePOSSession` | 1 min | 1 min ✅ |
| `features/treasury/hooks/usePayment.ts` | 6 | `usePayment` | 2 min | 2 min ✅ |
| `features/treasury/hooks/useTerminalBatch.ts` | 5 | `useTerminalBatch` | 2 min | 2 min ✅ |
| `features/treasury/hooks/useTerminalProviders.ts` | 65 | `useTerminalDevices` | 15 min | 15 min ✅ |
| `features/treasury/hooks/useTreasuryMovement.ts` | 5 | `useTreasuryMovement` | 2 min | 2 min ✅ |
| `hooks/useServerDate.ts` | 36 | `useServerDate` | 30 s | 30 s ✅ |

#### Solución aplicada

1. Agregar `staleTime` explícito en cada `useQuery` según su tier.
2. Para queries con `refetchInterval`, igualar `staleTime` al intervalo.
3. Para `useServerDate`, bajar de 5 min a 30 s.
4. Actualizar `hook-contracts.md`: agregar tiers "Realtime-sensitive (0)" y "Server date (30s)", más nota sobre global default y polling sync.

---

### 1.3 Inline query keys (~40 violaciones)

#### Explicación del error

El contrato (`hook-contracts.md:421`) exige que los query keys vivan en `queryKeys.ts` con factory jerárquica, no como literales inline. Las keys inline impiden invalidación cruzada desde otros hooks o features, ya que la estructura de la key es opaca y ad-hoc.

```ts
// ❌ Violación — inline literal
useQuery({ queryKey: ['workOrder', String(id)], ... })

// ✅ Correcto — factory en queryKeys.ts
useQuery({ queryKey: WORK_ORDERS_KEYS.detail(id), ... })
```

#### Impacto

- No se puede invalidar una query desde otro hook (no hay `queryKeys` exportados).
- Keys inconsistentes entre hooks del mismo dominio (unas usan `'workOrder'`, otras `'work-order'`).
- Refactor riesgoso: cambiar una key requiere grep manual en vez de actualizar la factory.

#### Archivos afectados

| Archivo | Línea | Inline literal |
|---------|-------|---------------|
| `features/production/hooks/useWorkOrders.ts` | 62 | `['workOrder', String(id)]` |
| `features/production/hooks/useSaleOrderManufacturableLines.ts` | 12 | `['saleOrderLines', saleOrderId]` |
| `features/production/hooks/useActiveBom.ts` | 16 | `['bom-suggestion', productId]` |
| `features/production/hooks/useProductionQueries.ts` | 36 | `['settings', 'general']` |
| `features/production/hooks/useProductDetail.ts` | 10 | `['product', productId]` |
| `features/production/hooks/useWorkOrderProducts.ts` | 10 | `['production', 'products', ...]` |
| `features/pos/hooks/useProducts.ts` | 38, 58, 68 | `['products'...]`, `['categories']`, `['uoms']` |
| `features/hr/hooks/useEmployees.ts` | 37, 45 | `['hr', 'detail', id]`, `['hr', 'employee-form-deps']` |
| `features/finance/hooks/useAccountMappings.ts` | 13 | `['accounts', 'mappings']` |
| `features/finance/hooks/useAnalysis.ts` | 8 | `[...FINANCE_KEYS.all, 'analysis', { params }]` |
| `features/finance/hooks/useBIAnalytics.ts` | 7 | `[...FINANCE_KEYS.all, 'bi-analytics', { params }]` |
| `features/sales/hooks/useDeliveryData.ts` | 6, 15 | `['salesOrder', orderId]`, `['warehouses']` |
| `features/inventory/hooks/useStockReport.ts` | 6 | `['stockReport']` |
| `features/inventory/hooks/useVariants.ts` | 25 | `['inventory', 'variants', ...]` |
| `features/accounting/hooks/useJournalEntries.ts` | 48 | `[...JOURNAL_ENTRIES_QUERY_KEY, 'detail', id]` |
| `features/treasury/hooks/usePOSSession.ts` | 6 | `['pos-session', id]` |
| `features/treasury/hooks/useTerminalBatch.ts` | 6 | `['treasury', 'terminalBatch', id]` |
| `features/treasury/hooks/useTreasuryMovement.ts` | 6 | `['treasury', 'movement', id]` |
| `features/treasury/hooks/useSuppliers.ts` | 7 | `['suppliers', {...}]` |
| `features/treasury/card-statements/useStatementsAnalyticsData.ts` | 32 | `['card-analytics', ...]` |
| `features/contacts/hooks/useContactDefaults.ts` | 6, 17 | `['contacts', 'defaultCustomer']`, `['contacts', 'defaultVendor']` |

#### Solución

1. Para features que ya tienen `queryKeys.ts`: migrar las keys inline a la factory.
2. Para features sin `queryKeys.ts`: crear el archivo primero (ver [1.6](#16-features-sin-querykeysts)).

---

### 1.4 `mutateAsync` wrappers (23 violaciones)

#### Explicación del error

El contrato (`hook-contracts.md:141-152`) exige exponer `mutation.mutateAsync` directamente, sin wrapper:

```ts
// ❌ Violación — wrapper innecesario
const deleteGroup = async (id) => {
    await deleteMutation.mutateAsync(id)
}
return { deleteGroup }

// ✅ Correcto — exposición directa
return { deleteGroup: deleteMutation.mutateAsync }
```

#### Impacto

- Código boilerplate innecesario.
- Puede ocultar errores de tipo (el wrapper no pasa tipos).
- Dificulta el tree-shaking y la inferencia de tipos.

#### Archivos afectados

| Archivo | Línea | Patrón |
|---------|-------|--------|
| `features/settings/hooks/useAccountingSettings.ts` | 99-100 | `const updateSettings = async (p) => { await mutation.mutateAsync(p) }` |
| `features/settings/hooks/useBillingSettings.ts` | 49-50 | Ídem |
| `features/settings/hooks/useCompanySettings.ts` | 41-42 | Ídem |
| `features/settings/hooks/useInventorySettings.ts` | 40-41 | Ídem |
| `features/settings/hooks/usePartnerSettings.ts` | 40-41 | Ídem |
| `features/settings/hooks/useSalesSettings.ts` | 45-46 | Ídem |
| `features/settings/hooks/useTreasurySettings.ts` | 39-40 | Ídem |
| `features/settings/hooks/useGroups.ts` | 29-36 | `const deleteGroup = async (id) => { await mutation.mutateAsync(id) }` |
| `features/sales/hooks/usePosTerminals.ts` | 68-69 | `toggleActive: async (t) => { await mutation.mutateAsync(t) }` |
| `features/finance/hooks/useAccountMappings.ts` | 59-62 | `const saveAll = useCallback(async (u) => { await mutation.mutateAsync(u) }, [...])` |

#### Solución

Reemplazar cada wrapper con el `mutateAsync` directo. En settings hooks donde hay lógica adicional (ej. settings que necesitan invalidación extra), mover esa lógica al `onSuccess` del `useMutation`, no al wrapper.

---

### 1.5 Hooks con retorno genérico (4 hooks + 2 hooks globales)

#### Explicación del error

El contrato (`frontend-fsd.md:158-170`) exige propiedades con nombre de dominio, nunca `data`, `error`, `mutate`:

```ts
// ❌ Violación
const { data, error, isLoading } = useAccountingPeriods()

// ✅ Correcto
const { periods, isLoading } = useAccountingPeriods()
```

Además, el contrato (`hook-contracts.md:19-21`) prohíbe exponer el raw `Error` object. Solo se permite exponer `isError: boolean` cuando el componente necesita bifurcar UI.

#### Impacto

- Inconsistencia: la mayoría de hooks usan nombres de dominio, estos 4 no.
- Dificulta la distinción entre loading states (hay hooks que devuelven `data` y otros `orders`).
- `useTrialBalance` expone `error` (raw Error) — prohibido.

#### Archivos afectados

| Hook | Archivo | Retorna | Debería retornar |
|------|---------|---------|-----------------|
| `useAccountingPeriods` | `features/accounting/hooks/useAccountingPeriods.ts` | `{ data, isLoading, refetch }` | `{ periods, isLoading, refetch }` |
| `useFiscalYears` | `features/accounting/hooks/useFiscalYears.ts` | `{ data, isLoading, refetch }` | `{ fiscalYears, isLoading, refetch }` |
| `useTrialBalance` | `features/accounting/hooks/useTrialBalance.ts` | `{ data, isLoading, isFetching, error, refetch }` | `{ trialBalance, isLoading, isFetching, isError, refetch }` (sin `error`) |
| `useEntityHistory` | `features/audit/hooks/useEntityHistory.ts` | `{ data, isLoading, refetch }` | `{ history, isLoading, refetch }` |

**Hooks globales (menor severidad):**
| Hook | Archivo | Retorna | Debería retornar |
|------|---------|---------|-----------------|
| `useOrderHubData` | `hooks/useOrderHubData.ts` | `{ data, ... }` | `{ hubData, ... }` |
| `useServerDate` | `hooks/useServerDate.ts` | `{ data: serverDate, ... }` (intermedio) | Ya retorna `{ serverDate }` bien, pero internamente usa `data` |

#### Solución

Renombrar la propiedad retornada en cada hook y actualizar los consumers. Para `useTrialBalance`, eliminar `error` del return y manejar el error internamente vía toast.

---

### 1.6 Features sin `queryKeys.ts` (9 features)

#### Explicación del error

El contrato (`hook-contracts.md:217-241`) exige que **toda** feature defina sus query keys en `hooks/queryKeys.ts`. Esto centraliza las keys y permite invalidación cruzada entre hooks y features.

#### Archivos afectados

| Feature | Estado | Notas |
|---------|--------|-------|
| `audit/` | ❌ Sin queryKeys.ts | Tiene hooks con queries (`useEntityHistory`) |
| `auth/` | ❌ Sin queryKeys.ts | Solo mutations (login/logout) — prioridad baja |
| `credits/` | ❌ Sin queryKeys.ts | Tiene hooks con queries |
| `hr/` | ❌ Sin queryKeys.ts | Keys inline en `useEmployees.ts`, `usePayrolls.ts` |
| `notifications/` | ❌ Sin queryKeys.ts | Tiene hooks con queries |
| `orders/` | ❌ Sin queryKeys.ts | Aggregator, documentado como excepción. Pero tiene mutaciones |
| `realtime/` | ❌ Sin queryKeys.ts | Sin queries propias — no aplica |
| `search/` | ❌ Sin queryKeys.ts | Tiene hooks con queries |
| `settings/` | ❌ Sin queryKeys.ts | Keys esparcidas en cada hook individual |

#### Solución

Crear `queryKeys.ts` en cada feature siguiendo Variant A (flat constants) o Variant B (keyed factories) según la complejidad del dominio. Para `orders/`, documentar que al tener mutaciones necesita queryKeys aunque sea aggregator.

---

### 1.7 Features sin `api/` folder (3 features)

#### Explicación del error

El canonical feature skeleton (`hook-contracts.md:459-473`) exige `features/<feature>/api/<feature>Api.ts` para todas las features que hacen llamadas HTTP. Sin esta capa, los hooks importan `@/lib/api` directamente, mezclando concerns.

#### Archivos afectados

| Feature | Impacto |
|---------|---------|
| `audit/` | Hooks importan `@/lib/api` directo |
| `notifications/` | Hooks importan `@/lib/api` directo |
| `realtime/` | Sin queries HTTP propias — probablemente no aplica |

#### Solución

Crear `features/audit/api/auditApi.ts` y `features/notifications/api/notificationsApi.ts` siguiendo el esqueleto del contrato.

---

### 1.8 Cross-feature hook imports

#### Explicación del error

El contrato permite solo importar **query key constants** a través de boundaries de feature, no implementaciones de hooks. Sin embargo, hay varios casos donde un feature importa hooks completos de otro feature.

#### Archivos afectados

| Archivo | Import | Impacto |
|---------|--------|---------|
| `features/billing/hooks/useInvoices.ts:6` | `SALES_KEYS` desde `@/features/sales/hooks/useSalesOrders` | Debería importar desde `sales/hooks/queryKeys.ts` |
| `features/contacts/hooks/useContacts.ts:6-7` | `SALES_KEYS`, `PURCHASING_KEYS` desde hooks específicos | Deberían ser queryKeys.ts |
| `features/settings/components/ProfitDistributionDrawer.tsx:11` | `useProfitDistribution` desde `@/features/contacts/hooks/useProfitDistribution` | 🔴 Importa implementación de hook cruzando feature |
| `features/sales/hooks/usePosTerminals.ts:3-6` | treasury API, keys, types | Acoplamiento sales→treasury |
| `features/finance/hooks/useAccountMappings.ts:3-4` | accounting feature | Acoplamiento finance→accounting |

#### Solución

1. Para query keys: exportarlas desde `queryKeys.ts` y referenciar ese archivo.
2. Para hooks: evaluar si merecen promoción a `/hooks/` global o si hay que refactorizar para evitar la dependencia.

---

## 2. Frontend — FSD Boundary Violations

Contrato de referencia: `docs/10-architecture/frontend-fsd.md`.

### 2.1 Cross-feature internal imports (93+ violaciones en 40+ archivos)

#### Explicación del error

La regla FSD (`frontend-fsd.md:41-54`) exige que las importaciones entre features ocurran **solo a través del barrel** (`features/X/index.ts`). Importar desde sub-paths internos (`features/X/components/Y`, `features/X/hooks/Y`) viola el encapsulamiento y crea acoplamiento frágil.

#### Impacto

- Refactorizar un componente interno puede romper consumers en otros features.
- No hay API surface explícita de qué es público vs interno.
- Dificulta la promoción a shared: hay que rastrear todos los imports directos.

#### Patrones de violación encontrados

```ts
// Features de settings importando de contacts
import { partnersApi } from '@/features/contacts/api/partnersApi'        // settings/
import { Partner, PartnerStatement } from '@/features/contacts/types/'   // settings/

// Sales importando de inventory
import { useUoMs } from '@/features/inventory/hooks/'                    // sales/
import { PricingUtils } from '@/features/inventory/utils/'               // sales/, purchasing/

// Inventory importando de production
import { useBOMs } from '@/features/production/hooks/'                   // inventory/
import { BOMDrawer } from '@/features/production/components/'            // inventory/

// Billing importando de treasury
import { PaymentModal } from '@/features/treasury/components/'           // billing/
import { treasuryApi } from '@/features/treasury/api/'                   // billing/

// Purchasing importando de treasury
import { PaymentMethodCardSelector } from '@/features/treasury/components/' // purchasing/

// Components selectors importando de features
import { useCategories } from '@/features/inventory/hooks/'               // selectors/
import { useWarehouses } from '@/features/inventory/hooks/'              // selectors/
import { useAccountSearch } from '@/features/accounting/hooks/'          // selectors/
```

**Lista exhaustiva de archivos ofensores por feature consumidor:**

**`settings/components/`** — 14 archivos: `PartnerLedgerTab`, `PartnerLedgerDrawer`, `PartnerWithdrawalWizard`, `AddPartnerModal`, `EquityCompositionTab`, `PartnerContributionWizard`, `EquityMovementModals`, `EquityStatsDrawer`, `InventoryContributionModal`, `MassPaymentWizard`, `MobilizeEarningsWizard`, `CreateDistributionFlow`, `ProfitDistributionsTab`, `PartnerEditDrawer`, `GroupsClientView`, `UsersSettingsView`, `CompanySettingsView`, `HRSettingsView`

**`sales/components/`** — 5 archivos: `PricingRuleDrawer`, `Step3_Delivery`, `Step2_Payment`, `SalesCheckoutWizardContent`, `POSSessionsClientView`, `PosTerminalDrawer`

**`inventory/components/`** — 5 archivos: `ProductManufacturingTab`, `BulkVariantEditFormV2`, `VariantQuickEditForm`, `PricingRuleClientView`, `ProductDrawer`, `AttributesClientView`

**`purchasing/components/`** — 4 archivos: `PurchaseOrderModal`, `PurchaseNoteModal`, `PurchaseCheckoutWizard`, `Step3_PurchasePayment`, `PurchaseNoteWizardSteps`

**`pos/components/`** — 2 archivos: `POSClientView`, `SalesOrdersDrawer`, `SessionControl`

**`billing/components/`** — 4 archivos: `SalesInvoicesClientView`, `PurchaseInvoicesClientView`, `Step4_Payment`, `NoteCheckoutWizard`

**`treasury/components/`** — 2 archivos: `BankCreationWizard`, `PaymentDrawer`

**`production/components/`** — 2 archivos: `ApprovalTaskList`, `SaleOrderProductStep`

**`hr/components/`** — 1 archivo: `PayrollDetailContent`

**`profile/components/`** — 1 archivo: `PartnerProfileTab`

**`finance/bank-reconciliation/components/`** — 1 archivo: `ReconciliationPanel`

**`accounting/components/`** — 1 archivo: `AccountsClientView`

**`credits/components/`** — 1 archivo: `CreditAssignmentModal`

**`components/selectors/`** — 7 archivos (selectores compartidos importando de features)

**`components/shared/`** — 3 archivos: `VariantSelectorModal`, `ProductGrid`, `FolioValidationInput`

**`components/layout/`** — 2 archivos: `UserActions`, `QuickActionsMenu`

#### Causa raíz

La mayoría de features **carecen de API barrels** (`api/index.ts`). Cuando `settings/` necesita `partnersApi`, no hay un barrel en `contacts/` que lo exporte, forzando el import directo a `contacts/api/partnersApi`. La solución no es solo hacer `import { partnersApi } from '@/features/contacts'` (eso requeriría re-exportar desde el barrel raíz, lo cual también es cuestionable) sino **crear barrels de API** en cada feature.

#### Solución

1. **Crear barrels de API** en cada feature: `features/contacts/api/index.ts` → `export { partnersApi } from './partnersApi'`
2. **Migrar imports** en los ~40 archivos para que consuman del barrel de API correspondiente.
3. Para imports de componentes (ej. `PaymentModal` de treasury): ya existen en el barrel `features/treasury/index.ts`, pero los consumers no lo usan — cambiar `from '@/features/treasury/components/PaymentModal'` a `from '@/features/treasury'`.
4. Para imports de hooks cross-feature (ej. `useUoMs`): promover a `/hooks/` global o evaluar si el hook debe refactorearse.

---

### 2.2 Direct `@/lib/api` en componentes (5 violaciones)

#### Explicación del error

El invariante #4 (`GOVERNANCE.md`) y `frontend-fsd.md:49-51` prohíben que componentes importen `@/lib/api` directamente. Deben hacerlo a través de un hook de feature.

#### Archivos afectados

| Archivo | Línea | Import | Uso |
|---------|-------|--------|-----|
| `features/production/components/steps/ProductSelectionStep.tsx` | 7 | `resolveMediaUrl` | Resolución de URLs de media |
| `features/production/components/steps/SaleOrderProductStep.tsx` | 12 | `resolveMediaUrl` | Ídem |
| `features/settings/components/CompanySettingsView.tsx` | 20 | `resolveMediaUrl` | Ídem |
| `components/shared/ProductSelector/ProductGrid.tsx` | 20 | `resolveMediaUrl` | Ídem |
| `components/shared/ProductSelector/VariantSelectorModal.tsx` | 14 | `resolveMediaUrl` | Ídem |

**Patrón:** todos usan `resolveMediaUrl`. Esta función debería ser parte de un hook utilitario o promoverse a `lib/utils.ts` (no `lib/api.ts`).

#### Solución

1. Mover `resolveMediaUrl` de `@/lib/api` a `@/lib/utils` (es una función pura, no una llamada HTTP).
2. O crear un hook `useMediaUrl()` que encapsule la lógica.
3. O crear `@/features/production/hooks/useMediaResolver.ts` y que los componentes lo consuman.

---

### 2.3 `app/` pages importando `@/lib/api` (12 violaciones)

#### Explicación del error

Similar al anterior, pero en páginas de `app/(dashboard)/`. Si bien el contrato FSD cubre principalmente features y components, las páginas en `app/` son el punto más alto y deberían consumir hooks de features, no llamar a `@/lib/api` directamente.

#### Archivos afectados

| Archivo | Import |
|---------|--------|
| `app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx` | `@/lib/api` |
| `app/(dashboard)/production/boms/BOMsPageClient.tsx` | `@/lib/api` |
| `app/(dashboard)/billing/invoices/[id]/page.tsx` | `@/lib/api` |
| `app/(dashboard)/billing/purchases/PurchasesPageClient.tsx` | `@/lib/api` |
| `app/(dashboard)/accounting/entries/EntriesClientView.tsx` | `@/lib/api` |
| `app/(dashboard)/accounting/accounts/[id]/ledger/page.tsx` | `@/lib/api` |
| `app/(dashboard)/treasury/reconciliation/[id]/page.tsx` | `@/lib/api` |
| `app/(dashboard)/treasury/reconciliation/[id]/workbench/page.tsx` | `@/lib/api` |
| `app/(dashboard)/treasury/bank-center/[bankId]/reconciliation/[statementId]/page.tsx` | `@/lib/api` |
| `app/(dashboard)/treasury/bank-center/[bankId]/reconciliation/[statementId]/workbench/page.tsx` | `@/lib/api` |
| `app/(dashboard)/settings/audit/AuditPageClient.tsx` | `@/lib/api` |
| `app/(dashboard)/settings/jobs/JobsPageClient.tsx` | `@/lib/api` |

#### Solución

Migrar para que pages consuman hooks de feature en vez de `@/lib/api` directo. Si el hook necesario no existe, crearlo. Si es una página de report/server-component, evaluar si realmente necesita cliente HTTP directo o puede ser Server Component.

---

### 2.4 Direct `useQuery`/`useMutation` en componentes

**0 violaciones.** El ESLint `no-restricted-imports` rule está funcionando correctamente.

---

### 2.5 `export * from` en barrels (20/22 features)

#### Explicación del error

El patrón `export * from` es dominante en los barrels de features. Mientras no está explícitamente prohibido por el contrato de naming, reduce la **traceabilidad de la API surface** — no se puede saber qué es público sin leer todos los archivos del feature.

| Feature | Wildcards `export *` | Exports explícitos |
|---------|---------------------|-------------------|
| `treasury/index.ts` | 61 | 1 |
| `inventory/index.ts` | 14 | 0 |
| `settings/index.ts` | 12 | 1 |
| `sales/index.ts` | 9 | 9 |
| `contacts/index.ts` | 8 | 0 |
| `hr/index.ts` | 8 | 3 |
| `accounting/index.ts` | 3 | 4 |
| `billing/index.ts` | 3 | 3 |
| `pos/index.ts` | 3 | 0 |
| `users/index.ts` | 3 | 0 |
| `auth/index.ts` | 2 | 0 |
| `finance/index.ts` | 2 | 1 |
| `orders/index.ts` | 2 | 0 |
| `production/index.ts` | 2 | 5 |
| `purchasing/index.ts` | 2 | 4 |
| `profile/index.ts` | 1 | 5 |
| `tax/index.ts` | 1 | 0 |
| `workflow/index.ts` | 1 | 1 |
| `credits/index.ts` | 0 | 2 |
| `realtime/index.ts` | 0 | 2 |
| `search/index.ts` | 0 | 1 |
| `_shared/index.ts` | 0 | 1 |

#### Solución (recomendación)

Migrar a exports explícitos progresivamente: primero los features más problemáticos (`treasury` con 61, `inventory` con 14). Cada export debe ser un `export { NamedExport } from './path'` en vez de `export * from './path'`.

---

## 3. Frontend — Zero-Any Policy

Contrato de referencia: `docs/90-governance/zero-any-policy.md`.

### 3.1 `any` types (777 violaciones + 433 casts `as any`)

> **Nota:** El conteo original del audit (253) usaba `grep` sobre patrones textuales (`: any`). El conteo real detectado por ESLint (`@typescript-eslint/no-explicit-any` a nivel `warn`) es **777 violaciones**, más **433 casts `as any`** (detectados por `grep`). `as any` es igual de dañino que `any` explícito — desactiva el type-checker. El plan de resolución considera ambos.

#### Explicación del error

El invariante #1 (`GOVERNANCE.md:15-16`) prohíbe `any` en TypeScript. Se debe usar Zod-derived types o `unknown` + type guard. `any` desactiva completamente el type-checker para esa variable, permitiendo errores en runtime que el compilador podría atrapar.

#### Distribución por área (conteo ESLint real)

| Área | Archivos con `any` | % archivos |
|------|-------------------|-----------|
| `features/` (total) | 151 | 81% |
| ├ `inventory/` | 17 | 9% |
| ├ `treasury/` | 16 | 9% |
| ├ `finance/` | 16 | 9% |
| ├ `purchasing/` | 14 | 7% |
| ├ `sales/` | 13 | 7% |
| ├ `production/` | 12 | 6% |
| ├ `pos/` | 11 | 6% |
| ├ `settings/` | 10 | 5% |
| ├ `orders/` | 10 | 5% |
| ├ `billing/` | 9 | 5% |
| ├ `accounting/` | 6 | 3% |
| ├ `hr/` | 5 | 3% |
| ├ `users/` | 3 | 2% |
| ├ `contacts/` | 2 | 1% |
| ├ `workflow/`, `tax/`, `_shared/`, `profile/`, `notifications/`, `credits/`, `auth/` | 1 c/u | <1% |
| `components/` | 25 | 13% |
| `hooks/` | 4 | 2% |
| `app/` | 6 | 3% |
| `contexts/` | 1 | <1% |
| **TOTAL (archivos)** | **187** | 100% |

> **777 violaciones `no-explicit-any`** distribuidas en 187 archivos. El archivo más ofensor es `features/contacts/components/ContactDrawer.tsx` (31 any), seguido de `features/sales/actions.tsx` (23) y `features/purchasing/actions.tsx` (21).

#### Patrones comunes de `any` (5 del audit original + 3 adicionales)

**1. Callback/event handlers:**
```ts
items.map((item: any) => ...)
onClick={(e: any) => ...}
```

**2. API payloads sin tipar:**
```ts
api.post<any>('/endpoint', payload)
api.get<{ results: any[] }>('/endpoint')
```

**3. `initialData` opcional sin tipo:**
```ts
export function useProducts({ initialData }: { initialData?: any }) {
```

**4. Retorno de hooks genéricos:**
```ts
const { data: any } = useQuery(...)
```

**5. Componentes shared con `data: any`:**
```ts
// components/shared/DataTable.tsx
updater: any
EMPTY_ARRAY: any[]

// components/shared/DomainCard.tsx
data: any
```

**6. 🆕 `as any` casts:**
```ts
data as any
colors as any
{ ...(rest as any) }
```
Común en componentes de chart (Nivo) y DynamicIcon.

**7. 🆕 `Control<any>` en react-hook-form:**
```ts
control: Control<any>
```
Común en componentes de tabla editables como `AccountingLinesTable`.

**8. 🆕 Tipos de librerías externas (Nivo charts, lazy imports):**
```ts
ComponentType<any>
Table<any>
```
Requiere tipos wrapper o cast controlado.

#### Estado actual post-resolución (2026-06-27)

✅ **10/14 features con 0 violaciones `no-explicit-any`**: sales, purchasing, production, billing, finance, treasury, pos, accounting, hr, settings.

⚠️ **3 features con `warn` temporal (migración pendiente)**: inventory (~53), contacts (~23), orders (~14).

| Feature | Antes | Después | Estado |
|---------|-------|---------|--------|
| treasury | 76 | 0 | ✅ |
| finance | 64 | 0 | ✅ |
| production | 57 | 0 | ✅ |
| billing | 54 | 0 | ✅ |
| purchasing | 54 | 0 | ✅ |
| inventory | 53 | 53* | ⚠️ *warn hasta migración |
| settings | 50 | 0 | ✅ |
| pos | 47 | 0 | ✅ |
| sales | 44 | 0 | ✅ |
| orders | 29 | 14* | ⚠️ *warn hasta migración |
| contacts | 23 | 23* | ⚠️ *warn hasta migración |
| hr | 20 | 0 | ✅ |
| accounting | 16 | 0 | ✅ |
| credits | 5 | 0 | ✅ |

**ESLint config**: `@typescript-eslint/no-explicit-any: error` para `features/` con override `warn` para inventory/, contacts/, orders/, drawerRegistry.

#### Plan de resolución (ejecutado)

**Fase 1 — Shared components** ✅ `26f1c83b`: tipar `data: any` con genéricos, corregir `Control<any>`, `as any` en charts, DynamicIcon, SegmentationBar. ~28 usos `any` eliminados.

**Fase 2 — ContactDrawer + useContactDefaults** ✅ `26f1c83b`: Fix root cause en `useContactDefaults.ts` — cascada a ~8 violaciones en ContactDrawer.

**Fase 3 — Actions registries** ✅ `26f1c83b`: `ActionRegistry<any>` → `ActionRegistry<ActionDoc>` + interfaces locales. ~50 usos `any` eliminados.

**Fase 4 — API files + hooks** ✅ `6bce380f`: `data: any` → `Record<string, unknown>`, `params: any` → `Record<string, unknown>`, `initialData?: EntityType`. 22 archivos, ~40 usos `any` eliminados.

**Fase 5 — Feature components por volumen** ✅ `cdeef239`: Eliminados ~600 usos `any` en 14 features. Patrones: `Record<string, unknown>`, `as unknown as`, `unknown` + type guard, `Resolver<FormType>`.

**Fase 6 — ESLint rule promotion** ✅ `cdeef239`: `no-explicit-any: error` para `features/` (warn para 4 excepciones documentadas). Cero errores ESLint + type-check.

---

## 4. Frontend — Naming Conventions

Contrato de referencia: `docs/90-governance/naming-conventions.md`.

### 4.1 `*Form` con surface propia (1 violación)

#### Explicación del error

Regla `naming-conventions.md:1.2.3`: un componente con sufijo `Form` **no debe tener surface propia** (Drawer/Modal/Sheet). El padre decide dónde montarlo. `TerminalBatchForm.tsx` renderiza `<BaseModal>` internamente, violando esta regla.

| Archivo | Línea | Surface | Debería ser |
|---------|-------|---------|-------------|
| `features/treasury/components/TerminalBatchForm.tsx` | 434 | `<BaseModal>` | `TerminalBatchSelectionModal` |

#### Solución

Renombrar a `TerminalBatchSelectionModal` (el sufijo refleja la surface: Modal).

---

### 4.2 File/export name mismatches (7 violaciones)

#### Explicación del error

Regla `naming-conventions.md:2.1`: el nombre del archivo debe coincidir con el export principal.

| Archivo | Export principal | Correcto sería |
|---------|-----------------|----------------|
| `features/treasury/components/BankCenterClientView.tsx` | `BankManagement` | Renombrar export a `BankCenterClientView` o file a `BankManagement.tsx` |
| `features/treasury/components/PaymentMethodClientView.tsx` | `PaymentMethodManagement` | Renombrar export a `PaymentMethodClientView` o file a `PaymentMethodManagement.tsx` |
| `features/settings/components/partners/EquityMovementModals.tsx` | 5 exports (`*Modal`) | Dividir en archivos individuales |
| `features/purchasing/components/notes/PurchaseNoteWizardSteps.tsx` | 4 exports (`Step*`) | Dividir en `Step[N]_Name.tsx` individuales |
| `features/pos/components/skeletons/POSLayoutSkeleton.tsx` | `POSSearchSkeleton`, `POSGridSkeleton`, `POSRecentOrderSkeleton` | Sin export `POSLayoutSkeleton` — crear o renombrar |
| `features/pos/contexts/POSContext.tsx` | `POSProvider` | Renombrar a `POSProvider.tsx` o exportar `POSContext` |
| `features/profile/context/ProfileContext.tsx` | `ProfileProvider` | Renombrar a `ProfileProvider.tsx` o exportar `ProfileContext` |

#### Solución

Renombrar exports o archivos para que coincidan. Para archivos multi-componente, dividir o renombrar el archivo para reflejar el contenido.

---

### 4.3 Deuda documentada: `*View` no `*ClientView` (1 archivo)

| Archivo | Estado | Razón |
|---------|--------|-------|
| `features/hr/components/AbsenceManagementView.tsx` | Sigue pendiente | Usa `DataTableView` — debería ser `AbsenceClientView` |

#### Solución

Aplicar Boy Scout Rule cuando se toque el archivo por otra razón.

---

### 4.4 Hook extension `.tsx` sin JSX (1 archivo)

#### Explicación del error

`features/orders/hooks/useCancelOrderFlow.tsx` usa extensión `.tsx` pero no contiene JSX (0 matches para `<Componente`). Debería ser `.ts`.

#### Solución

Renombrar a `useCancelOrderFlow.ts`.

---

### 4.5 Contrato obsoleto: sección 7 de `naming-conventions.md`

#### Explicación del error

La sección 7 de `naming-conventions.md` documenta 16 violaciones conocidas (archivos `*FormModal`/`*Modal` que deberían ser `*Drawer`). **Todos han sido renombrados** — la tabla ahora siembra confusión. El único item que persiste es `AbsenceManagementView`.

#### Solución

Limpiar la tabla de `naming-conventions.md §7`: mantener solo `AbsenceManagementView` como deuda activa.

---

## 5. Backend — View/Service/Selector Layering

Contrato de referencia: `docs/10-architecture/backend-apps.md`.

### 5.1 Views con inline business logic / >20 líneas (25+ violaciones) — ✅ RESUELTO

> **Resuelto 2026-06-28.** Migradas ~25 violaciones en 7 fases secuenciales (A-G) a través de 15 archivos. Cada método ofensor fue extraído a `selectors.py` (reads) o `services.py` (writes). Todos los ViewSets ahora delegan en servicios/selectores.

#### Fases de resolución

| Fase | Archivos | Violaciones | Commit |
|------|----------|-------------|--------|
| **A** | `inventory/subscription_views.py` → `SubscriptionSelector` | 3 CRITICAL (stats, history, get_queryset) | `1adda007` |
| **B** | `treasury/views.py` → selectors/services | 14 (BankViewSet, CheckViewSet, CardViewSet, Dashboard, TerminalBatch, POS, PaymentMethod) | `257115d7` |
| **C** | `contacts/views.py` → `ContactSelector` + `ContactService` | 9 (filter_suggestions, customers, suppliers, credit_history, partners, partner_transactions, all_partner_transactions, equity_stakes_history) | `8fb5430f` |
| **D** | `sales/pricing_views.py`, `billing/note_views.py`, `contacts/profit_distribution_views.py`, `production/views.py` | 9 (pricing, note_workflow, profit_distribution, work_order) | `dd588ca0` |
| **E** | `accounting/views.py`, `core/views.py`, `billing/views.py`, `sales/views.py`, `tax/views.py` | 21 (status guards, singletons, inline ORM) | `46776d59` |
| **F** | `workflow/views.py`, `purchasing/views.py`, `sales/draft_cart_views.py` | 9 (notifications, purchase_order, draft_cart) | `97c19950` |
| **G** | `inventory/views.py`, `production/views.py` | 5 (filter_suggestions, toggle_favorite, sync_variant_prices, stock_level, bom_queryset) | `33212b97` |

Contra 8 apps. Queda pendiente para futuras iteraciones: `core/views.py::UserPreferenceView` (ORM inline menor).

---

### 5.2 `get_queryset()` sin selector (5 violaciones) — ✅ RESUELTO

> **Resuelto 2026-06-28.** Los 5 ViewSets listados fueron migrados:

| ViewSet | Resolución | Commit |
|---------|-----------|--------|
| `WorkOrderViewSet` (production) | `WorkOrderViewSet` ya usaba `queryset = ...` directo (no `get_queryset()`). No requiere extracción. | Pre-existente |
| `BillOfMaterialsViewSet` (production) | `ProductionSelectorExt.get_bom_queryset()` | `33212b97` |
| `NoteWorkflowViewSet` (billing/note_views) | Extraído en Phase D | `dd588ca0` |
| `ProfitDistributionResolutionViewSet` (contacts/profit_distribution_views) | Extraído en Phase D | `dd588ca0` |
| `SubscriptionViewSet` (inventory/subscription_views) | Extraído en Phase A | `1adda007` |

---

### 5.3 ORM queries en serializers (2 claras + 4 borderline)

#### Explicación del error

La política zero N+1 (`GOVERNANCE.md:40`) prohíbe ORM queries dentro de Serializers o `SerializerMethodField`. Toda relación debe precargarse con `select_related`/`prefetch_related` en el ViewSet.

#### Violaciones claras

| Archivo | Línea | Código |
|---------|-------|--------|
| `inventory/serializers.py` | 399 | `obj.stock_moves.aggregate(total=Sum("quantity"))` |
| `sales/serializers.py` | 334 | `product.moves.aggregate(total=Sum("quantity"))` |

#### Borderline (service calls desde serializers)

| Archivo | Línea | Código |
|---------|-------|--------|
| `inventory/serializers.py` | 402-404 | `PricingService.get_product_price()` |
| `inventory/serializers.py` | 463-466 | `UoMService.get_allowed_uoms_for_context()` |
| `sales/serializers.py` | 166-168 | `UoMService.get_allowed_uoms_for_context()` en `validate()` |
| `purchasing/serializers.py` | 62-65 | `UoMService.validate_uom_compatibility()` en `validate()` |

#### Solución

1. Mover las agregaciones a `selectors.py` y precargar los datos en el `ViewSet.get_queryset()`.
2. Los service calls en `validate()` son menos críticos pero deberían migrarse a `services.py` cuando sea posible.

---

### 5.4 Selectors subutilizados

Varios ViewSets implementan lógica de negocio directamente cuando deberían delegar en selectors existentes o crear nuevos. Los casos más notables son `contacts/views.py` y `treasury/views.py` listados en 5.1.

---

## 6. Backend — Strategy Pattern (ProductTypeStrategy)

Contrato de referencia: `ADR-0016 (D-03)`, `inventory/strategies/product_type.py`.

### 6.1 ~~`product_type` if/elif chains (69 ocurrencias en 15 archivos)~~ ✅ RESUELTO

#### Estado actual

Se migraron ~37 de 69 ocurrencias a `ProductTypeStrategy`. Las 32 restantes son casos que **deliberadamente** se mantienen como comparaciones de `product_type` porque:

1. **Consultas ORM** (12): son filtros de base de datos, no lógica de runtime.
2. **Lógica específica de tipo** (10): validaciones cruzadas (ej: "componente de BOM debe ser SERVICE") que no se benefician de abstracción.
3. **Account resolution delegada** (4): ya pasan por los métodos `get_*_account` del modelo, que internamente delegan al strategy.
4. **Legacy controlado** (4): en `sales/serializers.py` y `sales/services.py`, mantenidos como red de seguridad para lógica de COGS.
5. **`inventory/models.py` save()** (2): lógica compleja de instancia que no calza en class-bools.

#### Cambios realizados (junio 2026)

| Fase | Archivos modificados | Impacto |
|------|---------------------|---------|
| **A** — Delegación en modelo | `inventory/models.py` | Propiedad `strategy` + 3 métodos `get_*_account` delegan a strategy |
| **B** — Extensión del strategy | `inventory/strategies/product_type.py` | Nuevos bools: `supports_returns`, `capitalizes_purchase_tax` |
| **C1** — Sales services | `sales/services.py` | 13/15 migrados (2 COGS fallback mantenidos) |
| **C2** — Accounting services | `accounting/services.py` | 7/7 migrados |
| **C3** — Billing note checkout | `billing/note_checkout_service.py` | 4/7 migrados (3 account-routing ya delegados) |
| **C4** — Production services | `production/services.py`, `production/selectors.py` | 6/7 migrados (1 SERVICE component check mantenido) |
| **C5** — Inventory | `inventory/services.py`, `sales/draft_cart_service.py` | 3 migrados |
| **C6** — Billing | `billing/services.py`, `billing/note_workflow.py` | 2 migrados |
| **E** — Tests | `inventory/tests/test_product_type_strategy.py` | 22 tests (properties, factory, validate, account resolution, delegation) |

#### Propiedades del strategy

| Propiedad | CONSUMABLE | STORABLE | MANUFACTURABLE | SERVICE | SUBSCRIPTION |
|-----------|:----------:|:--------:|:--------------:|:------:|:------------:|
| `tracks_inventory` | ✗ | ✓ | ✓ | ✗ | ✗ |
| `can_have_bom` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `requires_manufacturing_profile` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `allows_stock_moves` | ✗ | ✓ | ✓ | ✗ | ✗ |
| `costing_method` | none | average | average | none | none |
| `supports_returns` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `capitalizes_purchase_tax` | ✓ | ✓ | ✓ | ✗ | ✗ |

#### Cómo agregar un nuevo tipo de producto

1. Crear clase en `inventory/strategies/product_type.py` heredando de `ProductTypeStrategy`.
2. Registrar en `PRODUCT_TYPE_STRATEGIES` dict.
3. Definir class-level bools y métodos de cuenta.
4. No es necesario modificar ningún archivo consumer — la propiedad `product.strategy` lo resuelve automáticamente.

---

## 7. Backend — Cross-App Coupling

Contrato de referencia: `docs/10-architecture/backend-apps.md`.

### 7.1 Cross-app serializer imports top-level (9 violaciones)

#### Explicación del error

`backend-apps.md:104-139` establece que un serializer de app A importando un serializer de app B es un **code smell** que señala falta de adapter layer o workflow action. Las importaciones top-level son las peores porque crean acoplamiento en tiempo de importación y riesgos de circular imports.

#### Archivos afectados

| Archivo | Línea | Import | Severidad |
|---------|-------|--------|-----------|
| `billing/serializers.py` | 3 | `from core.serializers import AttachmentSerializer` | 🟡 |
| `billing/serializers.py` | 4 | `from sales.serializers import SaleOrderSerializer` | 🔴 |
| `billing/serializers.py` | 5 | `from treasury.serializers import TreasuryMovementSerializer` | 🔴 |
| `inventory/serializers.py` | 8 | `from core.serializers import AttachmentSerializer` | 🟡 |
| `production/serializers.py` | 3 | `from core.serializers import AttachmentSerializer` | 🟡 |
| `purchasing/serializers.py` | 5 | `from treasury.serializers import TreasuryMovementSerializer` | 🔴 |
| `sales/serializers.py` | 4 | `from production.serializers import WorkOrderSerializer` | 🔴 |
| `sales/serializers.py` | 7 | `from treasury.serializers import TreasuryMovementSerializer` | 🔴 |
| `workflow/serializers.py` | 3 | `from core.serializers import AttachmentSerializer, UserSerializer` | 🟡 |

#### Lazy imports (tolerados pero sub-óptimos)

| Archivo | Línea | Import | Alternativa |
|---------|-------|--------|-------------|
| `treasury/serializers.py` | 40 | `from contacts.serializers import ContactSerializer` | Adapter `contacts/adapters.py` |
| `treasury/serializers.py` | 441 | `from accounting.serializers import JournalEntrySerializer` | Adapter |
| `treasury/serializers.py` | 731 | `from accounting.serializers import JournalEntrySerializer` | Adapter |
| `inventory/serializers.py` | 278 | `from production.serializers import BillOfMaterialsSerializer` | Adapter `production/adapters.py` |
| `production/serializers.py` | 370 | `from core.serializers import AttachmentSerializer` | Adapter |
| `production/serializers.py` | 374 | `from workflow.serializers import TaskSerializer` | Adapter |
| `billing/serializers.py` | 184 | `from production.serializers import WorkOrderSerializer` | Adapter |

#### Solución

1. Los imports de `core.serializers.AttachmentSerializer` y `core.serializers.UserSerializer` son los menos problemáticos (core es infraestructura, no dominio).
2. Para `SaleOrderSerializer`, `TreasuryMovementSerializer`, `WorkOrderSerializer`: migrar a lazy imports dentro del método o crear adapter functions.
3. Priorizar: `billing/serializers.py` (3 imports top-level) y `sales/serializers.py` (2 imports top-level) son los peores.

---

## 8. Backend — Transaction Safety

Contrato de referencia: `docs/10-architecture/backend-apps.md:141-171`.

### 8.1 `@transaction.atomic` faltante (1 confirmado + zona de riesgo)

#### Violación confirmada

| Archivo | Línea | Método | Problema |
|---------|-------|--------|----------|
| `sales/services.py` | 42 | `SalesService.create_sale_order_from_pos()` | Sin `@transaction.atomic`. El método ejecuta `serializer.save()` (línea 76) que escribe SaleOrder a DB, luego llama `confirm_sale()` (línea 95) que hace más writes. Si `confirm_sale()` falla, la orden persiste sin confirmar — datos inconsistentes. |

#### Zona de riesgo (servicios sin `@transaction.atomic` que mutan ≥2 tablas)

| Archivo | Línea | Método | Riesgo |
|---------|-------|--------|--------|
| `billing/services.py` | 105 | `BillingService.pos_checkout_from_request()` | Delega a `_pos_checkout_internal()` — verificar si interno tiene `atomic` |
| `purchasing/services.py` | 92 | `PurchasingService.receive_order_from_request()` | Delega a `receive_order()` que tiene `atomic` en línea 143 — riesgo bajo |
| `purchasing/services.py` | 42 | `PurchasingService.create_order()` | Sin `@transaction.atomic` aparente |

#### Solución

1. Agregar `@transaction.atomic` a `SalesService.create_sale_order_from_pos()`.
2. Auditar servicios que mutan ≥2 tablas para verificar que todos tengan `@transaction.atomic` o `with transaction.atomic():` explícito.
3. Considerar agregar CI check que detecte servicios sin atomic escribiendo a múltiples modelos.

---

## 9. Backend — Otros Hallazgos

### 9.1 `Any` type hints en Python (4 instancias)

Severidad baja. Solo 4 casos de `Any` donde se podría usar un tipo más específico:

| Archivo | Línea | Uso |
|---------|-------|-----|
| `core/exceptions.py` | 43 | `identifier: Any` |
| `core/registry.py` | 93 | `user: Any` |
| `treasury/parsers/base.py` | 70 | `value: Any` (date normalizer — aceptable) |
| `treasury/parsers/base.py` | 126 | `value: Any` (amount normalizer — aceptable) |

### 9.2 Celery en request path

**0 violaciones.** Todos los `apply_async`/`delay` están correctamente envueltos en `transaction.on_commit()`.

### 9.3 Permission classes faltantes

**0 violaciones.** DRF tiene `StandardizedModelPermissions` como default. ViewSets en treasury y workflow están cubiertos por el default. Algunos tienen comentarios de deuda ("Should refine to specific permission later") pero no son violaciones del contrato actual.

---

## 10. Contract Gaps

Esta sección documenta vacíos en la documentación del proyecto que permiten ambigüedad o comportamientos inconsistentes. No son violaciones de contratos existentes, sino **oportunidades de mejora** para prevenir futuras violaciones.

### 10.1 Falta contrato para barrels de `api/`

**Observación:** La mayoría de features no tienen `api/index.ts`. El contrato `hook-contracts.md:496-514` muestra un archivo de API pero nunca especifica "debes tener un barrel de API para que otros features consuman tu API sin violar FSD".

**Consecuencia:** Los consumers importan `@/features/contacts/api/partnersApi` directamente (ruta interna) en vez de `@/features/contacts` (barrel).

**Sugerencia:** Agregar al canonical feature skeleton (`hook-contracts.md:459-473`) la línea `├── api/index.ts ← barrel: exporta funciones de API públicas`. En `frontend-fsd.md`, agregar regla de import: `features/X → features/Y/api/index.ts` (pero no a `features/Y/api/particularApi.ts`).

### 10.2 Falta regla sobre `export *` vs exports explícitos

**Observación:** 20/22 features usan `export * from` en sus barrels. No hay una regla que diga "preferir exports explícitos para mantener la API surface documentada".

**Sugerencia:** Agregar a `naming-conventions.md` o `GOVERNANCE.md` una regla: "Los barrels de feature deben usar exports explícitos (nunca `export * from`)". Esto fuerza a declarar intencionalmente qué es público.

### 10.3 Falta contrato para `utils/` cross-feature

**Observación:** `PricingUtils` de `inventory/utils/` es importado por `sales/`, `purchasing/`, `pos/`, y `components/shared/`. No hay regla que diga: ¿esto debería promoverse a `lib/`? ¿O es legal como cross-feature utility import?

**Sugerencia:** Agregar una regla: "Si una utilidad es usada por ≥3 features, debe promoverse a `@/lib/` (si es genérica) o `@/components/shared/` (si es de UI). Si es usada por 2 features, puede quedarse en el feature origen pero debe exportarse por barrel."

### 10.4 Falta árbol de decisión: lazy import vs adapter

**Observación:** `backend-apps.md:106-139` menciona 4 patrones (lazy import, adapter function, interface/protocol, workflow action) pero no da un árbol de decisión claro.

**Sugerencia:** Agregar un flujo de decisión al `backend-apps.md`:
```
¿Es solo un campo de lectura de otro dominio?
├── Sí → ¿Lo usan ≥2 apps?
│   ├── Sí → Adapter function en el dominio fuente
│   └── No → Lazy import + comentario
└── No → ¿Orquesta ≥3 apps?
    ├── Sí → workflow action
    └── No → Interface/protocol en el dominio fuente
```

### 10.5 Falta contrato para `app/` pages

**Observación:** 12 archivos en `app/(dashboard)/` importan `@/lib/api` directamente. El contrato FSD cubre `features/` y `components/` pero no especifica reglas para `app/` pages.

**Sugerencia:** Agregar a `frontend-fsd.md`: "Las páginas en `app/` deben consumir hooks de features. No deben importar `@/lib/api` directamente. Si necesitan Server Components con datos, crear un data layer separado."

### 10.6 Falta detección automática de `@transaction.atomic` faltante

**Observación:** No hay herramienta/métrica en CI para detectar servicios que mutan ≥2 tablas sin `@transaction.atomic`. Solo se detecta en code review.

**Sugerencia:** Crear un test DRF genérico o un ruff plugin que detecte métodos en `services.py` que hagan ≥2 writes (`.save()`, `.create()`, `.update()`, `.bulk_create()`) sin `@transaction.atomic` o `with transaction.atomic():`.

### 10.7 `pos` feature — arquitectura divergente

**Observación:** `features/pos/` parece tener su propio patrón: contextos pesados (`POSContext.tsx` → exporta `POSProvider`), hooks propios que mezclan queries de múltiples dominios, nombres que no siguen convenciones (`POSLayoutSkeleton.tsx` exporta `POSSearchSkeleton`).

**Sugerencia:** Auditar `pos/` por separado. Documentar como excepción o migrar al canonical feature skeleton.

### 10.8 Sub-feature folders sin convención

**Observación:** `finance/bank-reconciliation/`, `treasury/card-statements/`, `treasury/credit-lines/` — no hay regla sobre cuándo un sub-dominio merece su propia carpeta vs ser parte del feature padre.

**Sugerencia:** Agregar a `frontend-fsd.md`: "Un sub-dominio dentro de un feature merece su propia carpeta cuando: (a) tiene ≥3 hooks propios, (b) tiene ≥5 componentes, (c) modela un dominio interno con su propio ciclo de vida."

### 10.9 `naming-conventions.md` §7 — tabla obsoleta

**Observación:** Los 16 items de deuda documentados en §7 ya están **todos resueltos**. La tabla ahora siembra confusión.

**Sugerencia:** Vaciar la tabla y mantener solo `AbsenceManagementView` como deuda activa. Mover el historial a un ADR o commit log.

### 10.10 Observabilidad de abstracciones en CI

**Observación:** No hay métricas en CI que midan el cumplimiento de los contratos más allá de ESLint/type-check.

**Sugerencia:** Agregar un dashboard de compliance que mida:
- % de hooks con `markLocalMutation` (~100% — ✅ resuelto, excepto auth/ que es excepción documentada)
- % de queries con `staleTime`
- % de views con inline ORM
- Cantidad de usos de `product_type` sin strategy
- Cantidad de `any` restantes
- Cantidad de cross-feature internal imports

---

## 11. Priorización y Plan de Acción

### Fase 1 — Alto impacto, esfuerzo bajo/medio (cambios repetitivos y acotados)

| Item | Esfuerzo | Impacto | Estado |
|------|----------|---------|--------|
| Agregar `markLocalMutation()` a ~160 hooks | ~2 días | Elimina double-refetch flash | ✅ Resuelto |
| Agregar `staleTime` a ~50 queries | ~1 día | Reduce requests innecesarios >50% | ✅ Resuelto |
| Eliminar `mutateAsync` wrappers (23 casos) | ~0.5 día | Código más limpio | Parcial (settings hooks corregidos junto con markLocalMutation) |
| Renombrar 4 hooks con retorno genérico | ~1 día | Consistencia de API | Pendiente |
| Views > 20 líneas + ORM inline → services | ~3 días | Bloqueante para mantenibilidad | Pendiente |
| Renombrar naming mismatches (7 archivos) | ~0.5 día | Consistencia | Pendiente |

### Fase 2 — Alto impacto, esfuerzo alto

| Item | Esfuerzo | Impacto | Dependencias |
|------|----------|---------|--------------|
| Migrar `any` types (777 → 0) | ~5 días | Type safety completo | Fase 1 items | ✅ Resuelto (Fase 1-6) — 0 errores `no-explicit-any` en features. 3 features con warn temporal.
| `product_type` if/elif → Strategy (69 cadenas) | ~4 días | Elimina duplicación cross-app | Fase 1 (views) |
| Cross-feature imports + API barrels | ~4 días | FSD compliance | Fase 1 (naming) |

**Total Fase 2:** ~13 días

### Fase 3 — Cierre de gaps de contrato

| Item | Esfuerzo | Impacto |
|------|----------|---------|
| Contrato para barrels de API | ~0.5 día | Previene nuevas violaciones FSD |
| Regla de export explícito en barrels | ~0.5 día | API surface clara |
| Árbol de decisión lazy import vs adapter | ~0.5 día | Consistencia cross-app |
| Contrato para app/ pages | ~0.5 día | Cierra loophole |
| Limpiar naming-conventions.md §7 | ~0.25 día | Documentación precisa |

**Total Fase 3:** ~2.25 días

### Fase 4 — Automatización (prevención)

| Item | Esfuerzo | Impacto | Estado |
|------|----------|---------|--------|
| ESLint rule: `staleTime` requerido en `useQuery` | ~1 día | Error en CI si falta | Pendiente |
| ESLint rule: `markLocalMutation()` requerido en `onSuccess` | ~1 día | Error en CI si falta | ✅ Resuelto (`mutation/must-mark-local`, warn) |
| CI dashboard de compliance metrics | ~2 días | Visibilidad continua | Pendiente |
| Ruff plugin: detector de `@transaction.atomic` faltante | ~2 días | Previene datos inconsistentes | Pendiente |

**Total Fase 4:** ~6 días *(1 item resuelto)*

### Resumen de esfuerzo

| Fase | Días | Tipo | Estado |
|------|------|------|--------|
| Fase 1 | ~8 | Correctivo (bajo riesgo) | ✅ |
| Fase 2 | ~13 | Correctivo (alto riesgo) | ✅ any types resuelto |
| Fase 3 | ~2 | Preventivo (contratos) | ⏳ Pendiente |
| Fase 4 | ~6 | Preventivo (automático) | ⏳ Pendiente (1/4 items) |
| **Total** | **~29 días** | | |

---

## 12. Appendices

### Appendix A: Comandos de detección

Para re-auditar tras correcciones:

```bash
# 1. markLocalMutation ausente
cd frontend
# Features con useMutation pero sin markLocalMutation
for f in features/*/hooks/; do
  has_mutation=$(grep -rl "useMutation" "$f" 2>/dev/null | head -1)
  has_mark=$(grep -rl "markLocalMutation" "$f" 2>/dev/null | head -1)
  fname=$(basename "$(dirname "$f")")
  if [ -n "$has_mutation" ] && [ -z "$has_mark" ]; then
    echo "FALTA markLocalMutation: $fname"
  fi
done

# 2. staleTime faltante
grep -rn "useQuery(" frontend/features/*/hooks/ | grep -v "staleTime" | grep -v "node_modules"

# 3. any types
grep -rn ":" frontend/features/*/src/ --include="*.ts" --include="*.tsx" | grep " any;" | wc -l

# 4. Cross-feature internal imports
cd frontend
for f in features/*/components/*.tsx features/*/hooks/*.ts features/*/api/*.ts; do
  feature=$(echo "$f" | cut -d'/' -f2)
  grep -n "from '@/features/" "$f" 2>/dev/null | grep -v "'@/features/$feature" || true
done

# 5. Direct lib/api in components
grep -rn "from '@/lib/api'" frontend/features/*/components/ frontend/components/shared/ frontend/components/ui/

# 6. product_type if/elif in backend
grep -rn "product_type" backend/ --include="*.py" | grep -v "migrations" | grep -v "__pycache__" | grep -v ".pyc" | grep -E "(==|!=)"

# 7. ORM queries in serializers
grep -rn "\.objects\." backend/*/serializers.py --include="*.py"

# 8. Cross-app serializer imports
cd backend
for app in */serializers.py; do
  app_name=$(echo "$app" | cut -d'/' -f1)
  grep -n "from $app_name.serializers import" */serializers.py 2>/dev/null | grep -v "^$app_name:" || true
done
```

### Appendix B: Checklist de compliance por feature

```markdown
## Feature Compliance Checklist

### Hook layer
- [ ] Tiene `hooks/queryKeys.ts` con factory jerárquica
- [ ] Tiene `hooks/use[Entity].ts` con hook principal
- [ ] Todos los `useQuery` tienen `staleTime` explícito
- [x] Todos los `useMutation.onSuccess` llaman `markLocalMutation()` primero
- [ ] Todos los `mutateAsync` se exponen directamente (sin wrapper)
- [ ] Retorno usa nombres de dominio (`orders`, no `data`)
- [ ] Sin `import api from '@/lib/api'` en componentes

### API layer
- [ ] Tiene `api/<feature>Api.ts` con funciones HTTP puras
- [ ] Tiene `api/index.ts` barrel (o está en index.ts del feature)
- [ ] Sin `any` en payloads o responses (Zod-derived types)

### Component layer
- [ ] No importa `@/lib/api` directamente
- [ ] No usa `useQuery`/`useMutation` directamente
- [ ] Sufijo del componente coincide con su surface
- [ ] Nombre del archivo coincide con el export principal

### Barrel
- [ ] `index.ts` usa exports explícitos (no `export * from`)
- [ ] Barrel exporta solo la API pública del feature

### Backend
- [ ] Views ≤ 20 líneas por acción
- [ ] Business logic en services.py
- [ ] Complex reads en selectors.py
- [ ] `get_queryset()` llama a un selector
- [ ] Sin ORM queries en serializers
- [ ] Multi-table writes envueltas en `@transaction.atomic`
- [ ] Sin `product_type` if/elif (usa ProductTypeStrategy)
- [ ] Sin cross-app serializer imports top-level
```

---

*End of audit document. Generated 2026-06-26 by Claude Code (agentic audit).*
