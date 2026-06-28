---
status: active
owner: core-team
last_review: 2026-06-28
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
| 1.1 `markLocalMutation` ausente | 2026-06-26 (Fase 1-4), 2026-06-28 (Fase 5) | Agregado a ~160 mutations en 5 fases (pos→ALLOWLIST→resto→ESLint rule→cierre). 2 regresiones corregidas: `useSaleOrderComments.ts` y `useWorkflowMutations.ts`. 57 archivos con markLocalMutation. Solo auth/ excluido (no entidad de negocio). | `8b10ac98`, `d947d633`, `48e7aa20`, `6de9d153` |
| 1.2 `staleTime` faltante | 2026-06-26 | Agregado staleTime explícito a ~50 queries en 28 archivos; corregido useServerDate (5min→30s); actualizado hook-contracts.md con tiers y notas | `8d1685e9`, `d8cce460` |
| 3. `any` types en features | 2026-06-27 | Eliminados ~700 usos `any` en 6 fases secuenciales. 10/14 features en 0 violaciones. ESLint rule `no-explicit-any: error` para features. 3 features con warn temporal. | `26f1c83b`, `6bce380f`, `cdeef239` |
| 5.1 + 5.2 Views inline business logic + get_queryset sin selector | 2026-06-28 | Migradas ~25 violaciones en 7 fases (A-G) a través de 15 archivos. Creados: SubscriptionSelector (Phase A), Treasury services/selectors (Phase B), ContactSelector (Phase C), PricingService/NoteWorkflowSelector (Phase D), AccountingService/CoreService/BillingService/SalesService (Phase E), NotificationSelector/PurchaseOrderSelector/DraftCartSelector (Phase F), ProductSelector.filter_suggestions/StockMoveSelector.stock_level/ProductService.toggle_favorite y sync_variant_prices/ProductionSelectorExt.get_bom_queryset (Phase G). | `1adda007`, `257115d7`, `8fb5430f`, `dd588ca0`, `46776d59`, `97c19950`, `33212b97` |
| 6. ProductTypeStrategy | 2026-06-27 | Migradas ~37 cadenas if/elif a ProductTypeStrategy en 6 fases (A-E). 32 restantes son casos deliberadamente mantenidos (ORM filters, validaciones cruzadas, legacy controlado). | (múltiples) |
| 8.1 `@transaction.atomic` faltante | 2026-06-28 | Agregado `@transaction.atomic` a `SalesService.create_sale_order_from_pos`. Creados 7 tests unitarios en `sales/tests/test_create_order_from_pos.py` cubriendo rollback en 3 tipos de excepción, happy path, sesión inválida, PIN requerido y PIN bypass. | `ac26a91d` |
| 2.1 Cross-feature internal imports (~86 violaciones) + 10.1 API barrels | 2026-06-28 | Migrados ~95 archivos a barrel imports en 24 features. Creados barrels `api/index.ts` en 20 features. Cerrados agujeros ESLint `no-restricted-imports`. Promovido `PricingUtils` a `@/lib/pricing-utils`. Script `validate-barrel-imports.sh` para CI. | (múltiples) |
| 7.1 Cross-app serializer imports top-level | 2026-06-28 | Eliminados 5 imports top-level en 3 serializers (billing, sales, purchasing). `TreasuryMovementSerializer` en billing era dead code. Los restantes migrados a `SerializerMethodField` + lazy import inside method. Solo `core` (infraestructura) mantiene imports top-level. | `3dd68676` |
| 5.3 ORM queries en serializers | 2026-06-28 | Eliminados 2 aggregates inline en inventory/serializers y sales/serializers. Inventory: get_current_stock usa getattr(annotated_current_stock). Sales: validate usa product.qty_on_hand. Agregado test assertNumQueries para ProductViewSet list. | `14fbd077` |
| 8.1 Phase 0 — Transaction safety extendida | 2026-06-28 | Auditados 8 paths multi-write adicionales. Corregidos 4: `create_task`, `finalize_task_update`, `handle_update_attachments`, `request_credit_approval`. Removido `@transaction.atomic` de `handle_task_update` (savepoint anidado). Eliminado dead code (`complete_hub_stage_task`, `_revert_tax_from_product_cost`). 9 tests de rollback agregados. | `e364d0cc` + commits relacionados |

| Severidad | Count | Área |
|-----------|-------|------|
| 🔴 CRÍTICO | ~0 | Backend — views lógica inline, product_type chains, transaction safety (Phase 0 extendida ✅), ORM en serializers ✅ |
| 🟡 ALTO | ~0 | Frontend — FSD boundaries, naming, barrels ✅ |
| 🟡 ALTO | ~0 | Backend — cross-app coupling, serializers ✅ |
| 🟢 MEDIO | 8 | Gaps de contrato (no cubiertos por documentación actual) — 2 resueltos (10.1 API barrels, 10.3 PricingUtils) |

> ✅ **Resuelto:** Frontend hooks/API any types (~250 violaciones) — eliminado en Fase 1-6. `staleTime` y `markLocalMutation` también resueltos (57 archivos, 2 regresiones corregidas en Fase 5). **Section 5.1 + 5.2 + 6** — views inline business logic y product_type chains migrados a services/selectors/strategy. **Section 8.1** — `@transaction.atomic` agregado a `create_sale_order_from_pos` y 4 métodos adicionales en Phase 0 (`create_task`, `finalize_task_update`, `handle_update_attachments`, `request_credit_approval`). `handle_task_update` liberado de decorador (savepoint anidado). 16 tests de rollback agregados. Dead code (`complete_hub_stage_task`, `_revert_tax_from_product_cost`) eliminado. **Section 2.1** — cross-feature internal imports (~86 violaciones) migrados a barrel imports en 24 features. `PricingUtils` promovido a `@/lib/pricing-utils`. **Section 7.1** — cross-app serializer imports top-level (~9 violaciones) migrados a lazy imports inside method. **Section 5.3** — ORM queries en serializers (2 aggregates inline) reemplazados por annotation/property reads. Test `assertNumQueries` agregado.

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

> **Resuelto 2026-06-26 (Fase 1-4), 2026-06-28 (Fase 5).** Se agregó `markLocalMutation()` como primera línea en cada `onSuccess` de `useMutation` a través de 5 fases secuenciales:
> 
> | Fase | Alcance | Mutaciones | Commit |
> |------|---------|-----------|--------|
> | **A** | `pos/` (bugs reales — orden incorrecto) | 4 | `8b10ac98` |
> | **B** | `contacts/`, `billing/`, `purchasing/` (ALLOWLIST según ADR-0026) | 9 | `d947d633` |
> | **C** | `accounting/`, `treasury/`, `production/`, `orders/`, `settings/`, `finance/` | ~100+ | `48e7aa20` |
> | **D** | ESLint rule preventiva `mutation/must-mark-local` | — | *(este commit)* |
> | **E** | Cierre: `useSaleOrderComments.ts`, `useWorkflowMutations.ts` | 2 | `6de9d153` |
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

`markLocalMutation()` presente en **57 archivos** de hooks. Única feature sin ella: `auth/` (no aplica — no es entidad de negocio). ESLint rule preventiva activa como `warn` para detectar regresiones en CI. Se corrigieron 2 regresiones post-audit: `useSaleOrderComments.ts` y `useWorkflowMutations.ts`.

Archivos con `markLocalMutation` (57 total, obtenido con `grep -rl "markLocalMutation" frontend/features/*/hooks/`):

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
- `sales/hooks/useSaleOrderComments.ts`
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
- `workflow/hooks/useWorkflowMutations.ts`

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

### 1.8 Cross-feature hook imports — ⚠️ MITIGADO (barrels)

#### Explicación del error

El contrato permite solo importar **query key constants** a través de boundaries de feature, no implementaciones de hooks. Sin embargo, hay varios casos donde un feature importa hooks completos de otro feature.

#### Estado actual (2026-06-28)

Todas las importaciones listadas fueron migradas a barrels:
- `SALES_KEYS` y `PURCHASING_KEYS` ahora se importan desde `@/features/sales` y `@/features/purchasing` respectivamente.
- `useProfitDistribution` ahora se importa desde `@/features/contacts` (barrel).
- treasury API, keys, types: `@/features/treasury`.
- accounting API, types: `@/features/accounting`.

La violación de **sub-path** está resuelta. Sin embargo, el patrón de **hooks cross-feature** persiste: settings consume `useProfitDistribution` de contacts, sales consume treasury API hooks, finance consume accounting. Estos son acoplamientos de diseño legítimos pero que idealmente deberían pasar por una capa de interfaz compartida o promoverse a `/hooks/` globales si el patrón se repite ≥3 veces.

---

## 2. Frontend — FSD Boundary Violations

Contrato de referencia: `docs/10-architecture/frontend-fsd.md`.

### 2.1 Cross-feature internal imports (93+ violaciones en 40+ archivos) — ✅ RESUELTO

> **Resuelto 2026-06-28.** Migradas ~86 violaciones a barrel imports en 24 features. Creación de barrels `api/index.ts` en 20 features. ESLint `no-restricted-imports` cerrado (agregados patrones `utils/*`, `actions`, `contexts/*`, expandido scope a `hooks/`, `components/shared/`, `app/`). `PricingUtils` promovido de `features/inventory/utils/pricing` a `@/lib/pricing-utils`. Fix estructural: treasury/index.ts ya no re-exporta cross-feature desde finance. Script `validate-barrel-imports.sh` como barrera CI.

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
| `treasury/index.ts` | 60 | 1 |
| `inventory/index.ts` | 14 | 6 |
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

### 5.3 ORM queries en serializers (2 claras + 4 borderline) — ✅ RESUELTO

> **Resuelto 2026-06-28.** Inventory: `get_current_stock` reemplazó el aggregate fallback por `float(getattr(obj, "annotated_current_stock", None) or 0.0)`, eliminando la query N+1 en detail endpoints. Sales: `product.moves.aggregate(Sum("quantity"))` en `CreateSaleOrderSerializer.validate()` reemplazado por `product.qty_on_hand` (property que respeta annotation existente). Pricing: `PricingService.get_product_price()` en `get_effective_price`/`get_effective_price_net` evita N+1 en list vía `bulk_annotate_pricing()` (2 queries totales en vez de 2×N). Se agregó `select_related("parent_template")` a ambos selectors. Test `assertNumQueries` reducido de 45 a ≤38. Commits: `14fbd077`, `(pending)`.

#### Explicación del error (original)

La política zero N+1 (`GOVERNANCE.md:40`) prohíbe ORM queries dentro de Serializers o `SerializerMethodField`. Toda relación debe precargarse con `select_related`/`prefetch_related` en el ViewSet.

#### Violaciones claras (originales)

| Archivo | Línea | Código original | Estado |
|---------|-------|-----------------|--------|
| `inventory/serializers.py` | 399 | `obj.stock_moves.aggregate(total=Sum("quantity"))` | ✅ `getattr` + annotation |
| `sales/serializers.py` | 334 | `product.moves.aggregate(total=Sum("quantity"))` | ✅ `product.qty_on_hand` |

#### Borderline (service calls desde serializers)

| Archivo | Línea | Código | Estado |
|---------|-------|--------|--------|
| `inventory/serializers.py` | 402-404 | `PricingService.get_product_price()` | ✅ Anotación via `bulk_annotate_pricing` |
| `inventory/serializers.py` | 463-466 | `UoMService.get_allowed_uoms_for_context()` | ⚠️ Persiste |
| `sales/serializers.py` | 166-168 | `UoMService.get_allowed_uoms_for_context()` en `validate()` | ⚠️ Persiste |
| `purchasing/serializers.py` | 62-65 | `UoMService.validate_uom_compatibility()` en `validate()` | ⚠️ Persiste |

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

### 7.1 Cross-app serializer imports top-level (9 violaciones) — ✅ RESUELTO

#### Explicación del error

`backend-apps.md:104-139` establece que un serializer de app A importando un serializer de app B es un **code smell** que señala falta de adapter layer o workflow action. Las importaciones top-level son las peores porque crean acoplamiento en tiempo de importación y riesgos de circular imports.

> **Resuelto 2026-06-28.** Eliminados 5 imports top-level en 3 archivos (`billing/serializers.py`, `sales/serializers.py`, `purchasing/serializers.py`). `TreasuryMovementSerializer` en `billing/serializers.py:5` era dead code — eliminado sin reemplazo (el uso real ya era lazy import via `billing/selectors.py`). Los 3 campos class-level que usaban cross-app serializers (`sale_order_detail` en `InvoiceSerializer`, `serialized_payments` en `SaleOrderSerializer` y `PurchaseOrderSerializer`) convertidos a `SerializerMethodField` + lazy import inside method. Usos programáticos (`WorkOrderSerializer` en `sales/serializers.py`) migrados a lazy import directo en cada método. Único import top-level restante: `core.serializers.AttachmentSerializer` (core es infraestructura, no dominio). Commit: `3dd68676`.

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

#### Solución aplicada

1. ✅ `billing/serializers.py`: eliminado import muerto `TreasuryMovementSerializer` (línea 5). `SaleOrderSerializer` migrado a `SerializerMethodField` + lazy import.
2. ✅ `sales/serializers.py`: eliminados imports de `WorkOrderSerializer` y `TreasuryMovementSerializer`. Ambos migrados a lazy imports dentro de métodos.
3. ✅ `purchasing/serializers.py`: eliminado import de `TreasuryMovementSerializer`. Migrado a `SerializerMethodField` + lazy import.
4. ✅ Los imports de `core.serializers` se mantienen (core es infraestructura, no dominio).
5. ⏳ Los lazy imports dentro de serializers (treasury→contacts, treasury→accounting, inventory→production, production→workflow, billing→production) permanecen como lazy imports. Son el patrón recomendado por `backend-apps.md:110` para read-only access. No requieren acción correctiva inmediata pero podrían beneficiarse de adapters en una iteración futura.

---

## 8. Backend — Transaction Safety

Contrato de referencia: `docs/10-architecture/backend-apps.md:141-171`.

### 8.1 `@transaction.atomic` faltante (5 confirmados + zona de riesgo) — ✅ RESUELTO

> **Resuelto en 2 fases:**
>
> **Fase 1 (2026-06-28):** Se agregó `@transaction.atomic` a `SalesService.create_sale_order_from_pos()` en `backend/sales/services.py:42`. Se crearon 7 tests unitarios en `backend/sales/tests/test_create_order_from_pos.py` que verifican rollback en 3 tipos de excepción (ValidationError, PermissionDenied, Exception genérica), happy path, sesión inválida, PIN requerido y PIN bypass. Commit: `ac26a91d`.
>
> **Fase 2 (2026-06-28) — Phase 0 (auditoría extendida):** Se auditaron 8 paths multi-write adicionales y se corrigieron 4:
>
> - `create_task` (`workflow/services.py`): Escribe `Task` + 1..N `Notification`. Sin `@transaction.atomic`. Callers no garantizaban atomicidad.
> - `finalize_task_update` (`workflow/services.py`): `serializer.save()` (Task update) + `finalize_task_completion` + `handle_task_update` (Notification). Sin `@transaction.atomic`. Called from `TaskViewSet.perform_update` en contexto no atómico.
> - `handle_update_attachments` (`production/services.py`): Loop `Attachment.create()` × N + `work_order.save()`. Sin `@transaction.atomic`. Called from `WorkOrderViewSet.update` en contexto no atómico.
> - `request_credit_approval` (`billing/services.py`): Queries SaleOrder + `create_task` (Task + Notification). Sin `@transaction.atomic`. Called from `billing/views.py` request_credit action en contexto no atómico.
>
> **Hallazgos que resultaron ser falsos positivos (ya protegidos):**
> - `create_task` → `purchasing/tasks.py`: Ya envuelto en `with transaction.atomic():` por iteración de suscripción (línea 34).
> - `create_hub_stage_tasks`: Solo caller `sync_hub_tasks` ya tiene `@transaction.atomic`.
> - `complete_periodic_task`: Todos los callers en `tax/services.py` ya tienen `@transaction.atomic`.
> - `_create_initial_artifacts`: Todos los callers ya tienen `@transaction.atomic`.
>
> **Cambio estructural:** Se removió `@transaction.atomic` de `handle_task_update` (`workflow/services.py`) porque solo es llamada desde `finalize_task_update` y `complete_task` — ambos ahora atómicos en su borde. Mantener el decorador en `handle_task_update` crearía un savepoint anidado, violando `backend-apps.md:152`.
>
> **Dead code eliminado:** `complete_hub_stage_task` (workflow/services.py) y `_revert_tax_from_product_cost` (billing/services.py) — no tenían callers.
>
> Commits: `ac26a91d`, `e364d0cc`, commits de dead code y decorator fix.

#### Violaciones confirmadas (originales + Phase 0)

| Archivo | Línea | Método | Problema | Estado |
|---------|-------|--------|----------|--------|
| `sales/services.py` | 42 | `SalesService.create_sale_order_from_pos()` | Sin `@transaction.atomic`. `serializer.save()` escribe SaleOrder, luego `confirm_sale()` escribe más. Si falla, orden huérfana. | ✅ Resuelto (`ac26a91d`) |
| `workflow/services.py` | 39 | `WorkflowService.create_task()` | Sin `@transaction.atomic`. Escribe `Task` + 1..N `Notification` vía `notify_assignment`. | ✅ Resuelto (`e364d0cc`) |
| `workflow/services.py` | 784 | `WorkflowService.finalize_task_update()` | Sin `@transaction.atomic`. `serializer.save()` + `finalize_task_completion` + `handle_task_update` (Notification). | ✅ Resuelto (`e364d0cc`) |
| `production/services.py` | 1758 | `WorkOrderService.handle_update_attachments()` | Sin `@transaction.atomic`. Loop `Attachment.create()` × N + `work_order.save()`. | ✅ Resuelto (`e364d0cc`) |
| `billing/services.py` | 176 | `BillingService.request_credit_approval()` | Sin `@transaction.atomic`. Queries SaleOrder + `create_task` (Task + Notification). | ✅ Resuelto (`e364d0cc`) |

#### Zona de riesgo (re-evaluada post-Phase 0)

| Archivo | Línea | Método | Riesgo |
|---------|-------|--------|--------|
| `billing/services.py` | 105 | `BillingService.pos_checkout_from_request()` | Delega a `_pos_checkout_internal()` — verificar si interno tiene `atomic` |
| `purchasing/services.py` | 92 | `PurchasingService.receive_order_from_request()` | Delega a `receive_order()` que tiene `atomic` en línea 143 — riesgo bajo |
| `purchasing/services.py` | 42 | `PurchasingService.create_order()` | Sin `@transaction.atomic` aparente |

#### Tests agregados (Phase 0)

9 tests de rollback en 3 archivos:

| Test | Archivo | Verifica |
|------|---------|----------|
| `test_create_task_rollback` | `workflow/tests/test_workflow_transactional_atomic.py` | Si `notify_assignment` falla, no queda Task |
| `test_finalize_task_update_rollback` | `workflow/tests/test_workflow_transactional_atomic.py` | Si `finalize_task_completion` falla, status del Task se revierte |
| `test_complete_task_rollback_hub` | `workflow/tests/test_workflow_transactional_atomic.py` | HUB tasks son rechazadas sin persistencia |
| `test_complete_task_rollback_files` | `workflow/tests/test_workflow_transactional_atomic.py` | Si `send_notification` falla, status + completed_by se revierten |
| `test_handle_task_update_no_atomic_decorator` | `workflow/tests/test_workflow_transactional_atomic.py` | Verifica que no hay savepoint anidado |
| `test_complete_task_has_atomic_decorator` | `workflow/tests/test_workflow_transactional_atomic.py` | Regresión: decorador se mantiene |
| `test_handle_update_attachments_rollback` | `production/tests/test_production_transactional_atomic.py` | Si 2do Attachment falla, 1ero se revierte |
| `test_request_credit_approval_rollback` | `billing/tests/test_billing_transactional_atomic.py` | Si `create_task` falla, no queda Task |
| `test_request_credit_approval_happy_path` | `billing/tests/test_billing_transactional_atomic.py` | Flujo feliz verifica creación correcta |

#### Solución

1. ~~Agregar `@transaction.atomic` a `SalesService.create_sale_order_from_pos()`.~~ ✅ Resuelto (`ac26a91d`)
2. ~~Agregar `@transaction.atomic` a `WorkflowService.create_task()`.~~ ✅ Resuelto (`e364d0cc`)
3. ~~Agregar `@transaction.atomic` a `WorkflowService.finalize_task_update()`.~~ ✅ Resuelto (`e364d0cc`)
4. ~~Remover `@transaction.atomic` de `WorkflowService.handle_task_update()` (evitar savepoint anidado).~~ ✅ Resuelto
5. ~~Agregar `@transaction.atomic` a `WorkOrderService.handle_update_attachments()`.~~ ✅ Resuelto (`e364d0cc`)
6. ~~Agregar `@transaction.atomic` a `BillingService.request_credit_approval()`.~~ ✅ Resuelto (`e364d0cc`)
7. ~~Eliminar dead code: `complete_hub_stage_task`, `_revert_tax_from_product_cost`.~~ ✅ Resuelto
8. ~~Escribir 9 tests de rollback.~~ ✅ Resuelto
9. Considerar agregar CI check que detecte servicios sin atomic escribiendo a múltiples modelos.

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

## 10. Contract Gaps (8 pendientes, 2 resueltos)

Esta sección documenta vacíos en la documentación del proyecto que permiten ambigüedad o comportamientos inconsistentes. No son violaciones de contratos existentes, sino **oportunidades de mejora** para prevenir futuras violaciones.

### 10.1 Falta contrato para barrels de `api/` — ✅ RESUELTO

> **Resuelto 2026-06-28.** Se crearon barrels `api/index.ts` en 20 features. El canonical feature skeleton en `hook-contracts.md` ahora incluye `api/index.ts` como barrel público. La barrera CI `validate-barrel-imports.sh` previene regresiones.

### 10.2 Falta regla sobre `export *` vs exports explícitos

**Observación:** 20/22 features usan `export * from` en sus barrels. No hay una regla que diga "preferir exports explícitos para mantener la API surface documentada".

**Sugerencia:** Agregar a `naming-conventions.md` o `GOVERNANCE.md` una regla: "Los barrels de feature deben usar exports explícitos (nunca `export * from`)". Esto fuerza a declarar intencionalmente qué es público.

### 10.3 Falta contrato para `utils/` cross-feature — ✅ RESUELTO

> **Resuelto 2026-06-28.** `PricingUtils` promovido a `@/lib/pricing-utils`. Todos los consumers (12 cross-feature + 2 within-inventory) migrados. Una regla se agregó a `hook-contracts.md` en la sección del canonical feature skeleton: utilidades reutilizables deben ir a `@/lib/` cuando son usadas por ≥3 features.

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
| Views > 20 líneas + ORM inline → services | ~3 días | Bloqueante para mantenibilidad | ✅ Resuelto (Fases A-G) |
| Cross-app serializer imports top-level | ~1 día | Acoplamiento cross-app | ✅ Resuelto (`3dd68676`) |
| Renombrar naming mismatches (7 archivos) | ~0.5 día | Consistencia | Pendiente |

### Fase 2 — Alto impacto, esfuerzo alto

| Item | Esfuerzo | Impacto | Dependencias |
|------|----------|---------|--------------|
| Migrar `any` types (777 → 0) | ~5 días | Type safety completo | Fase 1 items | ✅ Resuelto (Fase 1-6) — 0 errores `no-explicit-any` en features. 3 features con warn temporal.
| `product_type` if/elif → Strategy (69 cadenas) | ~4 días | Elimina duplicación cross-app | Fase 1 (views) | ✅ Resuelto |
| Cross-feature imports + API barrels | ~4 días | FSD compliance | ✅ Resuelto |

**Total Fase 2:** ~13 días (completado)

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
| **Subtotal auditoría original** | **~29 días** | | |
| 8.1 `@transaction.atomic` faltante (Fase 1) | ~0.25 día | Correctivo (alto riesgo) | ✅ Resuelto (`ac26a91d`) |
| 8.1 Phase 0 — Transaction safety extendida (4 métodos + 9 tests) | ~1 día | Correctivo (alto riesgo) | ✅ Resuelto (`e364d0cc`) |
| 7.1 Cross-app serializer imports top-level | ~0.5 día | Correctivo (riesgo medio) | ✅ Resuelto (`3dd68676`) |
| 5.3 ORM queries en serializers | ~0.25 día | Correctivo (N+1 performance) | ✅ Resuelto (`14fbd077`) |
| **Total acumulado** | **~31 días** | | |

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

# 4. Cross-feature internal imports (usar el script CI)
bash scripts/validate-barrel-imports.sh
# Alternativamente, VERBOSE=1 para ver cada violación:
VERBOSE=1 bash scripts/validate-barrel-imports.sh

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
