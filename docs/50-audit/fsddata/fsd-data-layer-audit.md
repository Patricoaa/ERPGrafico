---
layer: 50-audit
doc: fsd-data-layer-audit
status: active
owner: core-team
last_review: 2026-05-22
stability: snapshot-updated-as-features-migrate
---

# FSD Data Layer Audit — estado real de mutaciones y caché

Snapshot del cumplimiento de los invariantes **#4 (no `useQuery`/`useMutation` en componentes)** y **#5 (no `@/lib/api` directo en componentes ni páginas)** del proyecto. Junto con el invariante implícito de que cada entidad mutable debe tener su `queryKeys.ts` para que la invalidación de caché sea coordinada.

## Por qué este audit existe

El piloto de realtime (ADR-0026) reveló un problema de fondo: la invalidación de caché tras mutaciones es inconsistente en todo el frontend. El `entity bus` por sí solo no resuelve el síntoma más inmediato — que la UI muestra datos obsoletos tras una operación local — porque depende de que cada feature tenga el plumbing FSD correcto (`queryKeys` + `useMutation` con `invalidateQueries`).

El parche `staleTime: 0` en `useSelectedEntity` (commit `874fc7bd`) reduce el síntoma para los paneles de detalle, pero el problema arquitectural sigue:

- **119 imports directos** de `@/lib/api` en componentes (invariante #5).
- **33 usos directos** de `useQuery`/`useMutation` en componentes (invariante #4).
- **15 de 23 features sin `queryKeys.ts`** — la pieza necesaria para invalidación coordinada.

Este documento captura ese estado para que cualquier refactor futuro tenga un baseline contra el cual medir progreso.

## Metodología

Para cada directorio bajo [frontend/features/](../../frontend/features/) se midieron cuatro señales:

```bash
# 1. ¿Existe queryKeys.ts?
test -f features/<f>/hooks/queryKeys.ts

# 2. ¿Existe carpeta api/ (capa de acceso REST aislada)?
test -d features/<f>/api

# 3. Archivos en hooks/ (proxy del nivel de capa de datos)
ls features/<f>/hooks/*.ts | wc -l

# 4. Violación de invariante #5
grep -rl "from ['\"]\@/lib/api['\"]" features/<f>/components/ | wc -l

# 5. Violación de invariante #4
grep -rl "useQuery\|useMutation" features/<f>/components/ | wc -l
```

Snapshot tomado el 2026-05-22 sobre el commit `874fc7bd` (rama `feat/Nuevo-sistema-de-Fabricación`).

## Resumen ejecutivo

| Estado | Definición | Snapshot 2026-05-22 | Tras inventory | Tras sales | Tras treasury+purchasing+billing | Tras orders+production+settings | Tras contacts+users+tax | Tras accounting+hr |
|---|---|---|---|---|---|---|---|---|---|---|
| **Compliant** | Tiene `queryKeys.ts` (o no muta) + 0 violaciones de #4/#5 | 5 (22%) | 6 (26%) | 7 (30%) | 10 (43%) | 14 (61%) | 15 (65%) | **17 (74%)** |
| **Mostly compliant** | <5 violaciones combinadas, infraestructura FSD presente | 6 (26%) | 5 (22%) | 5 (22%) | 5 (22%) | 5 (22%) | 3 (13%) | **1 (4%)** |
| **Anti-pattern** | ≥5 violaciones o ausencia de infraestructura FSD | 12 (52%) | 12 (52%) | 11 (48%) | 8 (35%) | 4 (17%) | 5 (22%) | **5 (22%)** |

Violaciones agregadas:

| Métrica | Snapshot 2026-05-22 | Tras inventory | Tras sales | Tras treasury+purchasing+billing | Tras orders+production+settings | Tras contacts+users+tax |
|---|---|---|---|---|---|---|
| #5 (api directo en componentes) | 119 en 20 features | 95 en 19 features | 75 en 14 features | 51 en 14 features | 29 en 10 features | **19 en 5 features** |
| #4 (useQuery/Mutation en componentes) | 33 en 11 features | 29 en 10 features | 15 en 9 features | 12 en 8 features | 11 en 7 features | **10 en 6 features** |
| Sin `queryKeys.ts` | 15 de 23 (65%) | 15 de 23 (65%) | 15 de 23 (65%) | 15 de 23 (65%) | 12 de 23 (52%) | **11 de 23 (48%)** |
| Sin `api/` folder | 9 de 23 (39%) | 9 de 23 (39%) | 9 de 23 (39%) | 8 de 23 (35%) | 6 de 23 (26%) | **3 de 23 (13%)** |

**Reducción acumulada:** 100 violaciones #5 (-84%) y 23 #4 (-70%) en ~50 commits de 12 features.

## Tabla maestra por feature

Las columnas #5 y #4 muestran `inicial → actual` cuando hubo cambio. Estado refleja el actual.

| Feature | `queryKeys.ts` | `api/` folder | Violaciones #5 | Violaciones #4 | Estado |
|---|:---:|:---:|:---:|:---:|---|
| accounting | ✓ | ✓ | **1 → 0** ✅ | **1 → 0** ✅ | **Compliant** |
| audit | ✗ | ✗ | 0 | 0 | Compliant (read-only) |
| auth | ✓ | ✓ | 1 → 0 | 0 → 0 | Compliant (sweep completado) |
| **billing** | ✓ | ✓ | **5 → 0** ✅ | **1 → 0** ✅ | **Compliant (sweep completado)** |
| contacts | ✓ | ✓ | **2 → 0** ✅ | **1 → 0** ✅ | **Compliant** |
| credits | ✗ | ✓ | 0 | 0 | Compliant (read-only) |
| finance | ✗ | ✗ | 12 | 1 | Anti-pattern |
| hr | ✗ | ✓ | 0 | **3 → 0** ✅ | Compliant |
| **inventory** | ✓ | ✓ | **21 → 0** ✅ | **4 → 0** ✅ | **Compliant (sweep completado)** |
| **sales** | ✓ | ✓ | **11 → 0** ✅ | **4 → 0** ✅ | **Compliant (sweep completado)** |
| notifications | ✗ | ✗ | 0 | 0 | Compliant |
| **orders** | ✗ | **✗ → ✓** ✅ | **8 → 0** ✅ | 0 | **Compliant (aggregator, sweep completado)** |
| pos | ✓ | ✓ | 0 → 0 | 0 → 0 | Compliant |
| **production** | ✓ | **✗ → ✓** ✅ | **4 → 0** ✅ | **3 → 0** ✅ | **Compliant (sweep completado)** |
| profile | ✗ | ✓ | 0 | 0 | Compliant |
| **purchasing** | ✓ | **✗ → ✓** ✅ | **9 → 0** ✅ | **1 → 0** ✅ | **Compliant (sweep completado)** |
| realtime | ✗ | ✗ | 0 | 0 | Compliant (infra-only) |
| search | ✗ | ✓ | 0 | 0 | Compliant (aggregator) |
| **settings** | ✗ | ✓ | **11 → 0** ✅ | **1 → 0** ✅ | **Compliant (sweep completado)** |
| tax | ✗ | **✗ → ✓** ✅ | **4 → 0** ✅ | 0 | Anti-pattern |
| **treasury** | ✓ | ✓ | **12 → 0** ✅ | **3 → 0** ✅ | **Compliant (sweep completado)** |
| users | ✗ | **✗ → ✓** ✅ | **3 → 0** ✅ | 0 | Mostly compliant |
| workflow | ✓ | ✓ | 0 → 0 ✅ | 0 → 0 ✅ | Compliant (sweep completado) |

## Top ofensores actuales — archivos exactos

### inventory — completado (21 → 0)

✅ Sweep completado en 22 commits incrementales. Detalle de hooks creados y patrones
aplicados en [fsd-data-layer-refactor-plan.md](fsd-data-layer-refactor-plan.md).

### treasury — completado (12 → 0)

✅ Sweep completado en 12 commits incrementales. Migración completa:
- `api/treasuryApi.ts` completado con todas las funciones faltantes (providers, devices, payments, transfers, movements, banks, payment methods, contacts, POS sessions, monthly invoices).
- 9 hooks refactored/creados con `mutateAsync` directo + invalidación jerárquica.
- 9 componentes migrados (sin `api` directo).
- Type-check 0 errores, lint 0 violaciones.

Hooks creados/refactorizados: `useTerminalProviders`, `useTerminalBatches`, `useMasterData` (split en `useBanks` + `usePaymentMethods`), `useTreasuryMovements`, `useTerminals`, `useTreasuryAccounts`, `usePayments`, `useTransfer`, `useMonthlyInvoice`, `usePOSSession`, `useSuppliers`.

Como subproducto, otras features ganaron hooks aprovechables:
- `billing`: `useInvoice`, `confirmInvoice`, `registerNoteOnInvoice`, `posCheckout`, `requestCredit`
- `contacts`: `useContact`, `useContactCreditLedger`, `usePartners`
- `accounting`: `useAccountingSettings`
- `pos`: `usePOSSessionSummary`, `fetchPOSSessionSummary`
- `workflow`: `getTask` helper

### purchasing — completado (9 → 0)

✅ Sweep completado en una sesión. Migración completa:
- `api/purchasingApi.ts` creado con 15 funciones (orders CRUD, notes, invoices, products, UoMs, warehouses, contacts).
- Hooks refactorizados: `usePurchasingOrders`, `usePurchasingNotes` usa `purchasingApi`; nuevo `usePurchasingOrder(id)`.
- `queryKeys.ts` extendido con `lists()`, `detail(id)`.
- 9 componentes migrados (sin `api` directo).
- Root barrel `index.ts` creado.
- Type-check 0 errores, lint 0 violaciones.

### billing — completado (5 → 0)

✅ Sweep completado en una sesión. Migración completa:
- `api/billingApi.ts` extendido con 6 funciones: `deleteInvoice`, `createPayment`, `noteWorkflowCheckout`, `completeNoteWorkflow`, `getWarehouses`, `getAllowedUoms`.
- Hooks: `useNoteCheckout` creado; `usePurchaseInvoices` extendido con `deleteInvoice`, `confirmInvoice`, `makePayment`.
- 5 componentes migrados (sin `api` directo).
- Fix `items?: any[]` → `items?: Record<string, unknown>[]`.
- Type-check 0 errores, lint 0 violaciones.

### orders — completado (8 → 0)

✅ Sweep completado en una sesión. Migración completa (enfoque pragmático para feature aggregator):
- `api/ordersApi.ts` creado con 40 funciones (billing, sales, purchasing, treasury, production, auth, inventory).
- `hooks/useOrdersMutations.ts` con 12 mutation hooks con invalidación de caché.
- `hooks/useSaleOrderSearch.ts` migrado a usar ordersApi.
- 8 componentes migrados (sin `api` directo): `ActionCategory`, `OrderActionPanel`, `OriginPhase`, `BillingPhase`, `LogisticsPhase`, `TreasuryPhase`, `ProductionPhase`, `NoteLogisticsModal`.
- Type-check 0 errores, lint 0 violaciones.

### production — completado (4 → 0 #5, 3 → 0 #4)

✅ Sweep completado en una sesión. Migración completa:
- `api/productionApi.ts` creado con 40+ funciones (work orders, BOMs, inventory, accounting, core).
- `hooks/queryKeys.ts` con factory jerárquica.
- `hooks/useProductionQueries.ts` con hooks para métricas y tipos DTE.
- 6 componentes migrados: `ProductionMetricsCard`, `OutsourcedServiceForm`, `BOMFormModal`, `WorkOrderWizard`, `WorkOrderBasicStep`, `OutsourcingAssignmentStep`, `MaterialAssignmentStep`.
- Type-check 0 errores nuevos, lint 0 violaciones.

### settings — completado (11 → 0 #5, 1 → 0 #4)

✅ Sweep completado en una sesión. Migración completa:
- `api/settingsApi.ts` expandido con 12 métodos nuevos (groups, treasury accounts, terminals, warehouses, products, UoMs, inventory adjustments, custom field templates, IFRS chart).
- `api/types.ts` creado con tipos compartidos.
- Hooks: `useGroups`, `useTreasuryAccounts` creados; `useAccountingSettings` y `useTreasurySettings` migrados a usar `settingsApi`.
- `hooks/index.ts` barrel creado.
- 11 componentes migrados: `AccountingSettingsView`, `TreasurySettingsView`, `PurchasingSettingsView`, `GroupManagement`, `CompanySettingsView`, `CustomFieldTemplateForm`, `TerminalFormModal`, `MassPaymentModal`, `PartnerWithdrawalWizard`, `InventoryContributionModal`, `PartnerContributionWizard`, `EquityMovementModals`.
- Type-check 0 errores nuevos, lint 0 violaciones.

### contacts — completado (2 → 0 #5, 1 → 0 #4)

✅ Migración completa en 2 sesiones. Detalles:
- `ContactDetailClient.tsx`: reemplazó `api.get` manual por hook `useContact(id)` existente.
- `ContactModal.tsx`: reemplazó 4 `useQuery` directos — 2 migrados a hooks existentes (`useContact`, `useContactCreditLedger`), 2 extraídos a nuevo hook `useContactDefaults.ts` (`useDefaultCustomer`, `useDefaultVendor`). Eliminado `import api from "@/lib/api"` y `import { useQuery }`.
- `hooks/index.ts` barrel creado exportando todos los hooks.
- 0 violaciones #4 y #5. **Fully compliant.**

### users — completado (3 → 0 #5)

✅ Migración en una sesión. Detalles:
- `api/usersApi.ts` creado con 9 funciones (users CRUD, groups CRUD, roles).
- Hooks migrados: `useUsers`, `useUserSearch`/`useSingleUser`, `useGroupSearch`/`useSingleGroup` — todos reemplazaron `import api from "@/lib/api"` por `import { usersApi } from "../api/usersApi"`.
- Componentes migrados: `UserDetailClient.tsx` (refactorizado a hook `useSingleUser`), `GroupForm.tsx`, `UserForm.tsx`.
- `hooks/index.ts` barrel creado.
- 3 componentes migrados, 0 errores de type-check nuevos.

### tax — completado (4 → 0 #5)

✅ Migración en una sesión. Detalles:
- `api/taxApi.ts` creado con 10 funciones (periods, declarations, F29 detail, payments, check_closed).
- `actions.ts` server action migrada de `import api` directo a `import { taxApi }`.
- Componentes migrados: `DeclarationWizard.tsx` (4 llamadas), `TaxDeclarationsView.tsx` (3 llamadas), `TaxPeriodDetailClient.tsx`, `F29DeclarationDetailClient.tsx`.
- 4 componentes + 1 action migrados, 0 errores de type-check nuevos.

## Patrón canónico vs anti-patrón observado

### Compliant (referencia: `contacts`)

[features/contacts/hooks/queryKeys.ts](../../frontend/features/contacts/hooks/queryKeys.ts):

```ts
export const CONTACTS_KEYS = {
    all: ['contacts'] as const,
    lists: () => [...CONTACTS_KEYS.all, 'list'] as const,
    list: (filters?: ContactFilters) => [...CONTACTS_KEYS.lists(), { filters }] as const,
    details: () => [...CONTACTS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...CONTACTS_KEYS.details(), id] as const,
}
```

Jerarquía explícita: invalidar `CONTACTS_KEYS.all` cubre todo; invalidar `CONTACTS_KEYS.details()` cubre todos los detalles; invalidar `CONTACTS_KEYS.detail(7)` cubre un detalle específico. Esto es **lo que `useSelectedEntity` necesita para poder ser invalidado coordinadamente**.

### Anti-patrón (observado en mayoría)

```tsx
// En el componente — viola #4 y #5
import api from '@/lib/api'
import { useMutation } from '@tanstack/react-query'

export function ProductForm() {
    async function onSubmit(data) {
        await api.put(`/inventory/products/${id}/`, data)  // ← #5
        toast.success('Guardado')
        // sin invalidateQueries → caché obsoleto en lista, detalle, etc.
    }
    // ...
}
```

Síntomas observables al usuario:

- Tras editar, la lista muestra datos viejos hasta refresh por focus o 5min.
- Tras editar y reabrir un detalle, el modal muestra datos viejos.
- Cualquier feature que comparta entidad (ej. `contacts` aparece en `sales` y `purchasing`) queda incoherente entre dominios.

## Conclusión

El proyecto tenía un **gap arquitectural sistémico**: la capa de datos FSD existe en docs (ADR-0020, frontend-fsd.md, invariantes #4/#5) pero **no estaba mecánicamente enforced**. Las features escritas temprano seguían el patrón; las que crecieron orgánicamente bajo presión de feature work bypaseaban los hooks.

Desde el 2026-05-22 hay barrera mecánica activa: la regla custom `fsd/no-api-in-component` ([frontend/eslint-rules/fsd-no-api-in-component.mjs](../../frontend/eslint-rules/fsd-no-api-in-component.mjs)) reporta cada import de `@/lib/api` en `features/*/components/**` como warning visible en `npm run lint`. Detalle del rationale y plan para subirla a `error` en [fsd-data-layer-refactor-plan.md §Prerrequisito mecánico](fsd-data-layer-refactor-plan.md#prerrequisito-mecánico--eslint-rule--implementado-2026-05-22).

**Métrica de seguimiento** (correr tras cada PR de migración):

```bash
cd frontend && npm run lint 2>&1 | grep -c "fsd/no-api-in-component"
# Snapshot 2026-05-22 (regla recién activada):          74
# Tras inventory + sales sweeps:                         75
# Tras treasury sweep:                                   65
# Tras purchasing sweep:                                 56
# Tras billing sweep:                                    51
# Tras orders + production sweeps:                       43
# Tras settings sweep:                                   29
# Tras contacts + users + tax sweeps:                    18
```

## Referencias

- Patrón canónico: [frontend-fsd.md](../10-architecture/frontend-fsd.md)
- Plan de refactor derivado: [fsd-data-layer-refactor-plan.md](fsd-data-layer-refactor-plan.md)
- ADR del entity bus que reveló el problema: [ADR-0026](../10-architecture/adr/0026-entity-bus-realtime-invalidation.md)
- Fix puente que reduce el síntoma: commit `874fc7bd` (`staleTime: 0` en useSelectedEntity)
- Restricción operativa: PYME single-node, presupuesto ~$0 (memoria auto-cargada)
