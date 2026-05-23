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

| Estado | Definición | Snapshot 2026-05-22 | Tras inventory sweep | Tras sales sweep |
|---|---|---|---|---|
| **Compliant** | Tiene `queryKeys.ts` (o no muta) + 0 violaciones de #4/#5 | 5 (22%) | 6 (26%) | **7 (30%)** |
| **Mostly compliant** | <5 violaciones combinadas, infraestructura FSD presente | 6 (26%) | 5 (22%) | 5 (22%) |
| **Anti-pattern** | ≥5 violaciones o ausencia de infraestructura FSD | 12 (52%) | 12 (52%) | 11 (48%) |

Violaciones agregadas:

| Métrica | Snapshot 2026-05-22 | Tras inventory | Tras sales |
|---|---|---|---|
| #5 (api directo en componentes) | 119 en 20 features | 95 en 19 features | **75 en 14 features** |
| #4 (useQuery/Mutation en componentes) | 33 en 11 features | 29 en 10 features | **15 en 9 features** |
| Sin `queryKeys.ts` | 15 de 23 (65%) | 15 de 23 (65%) | 15 de 23 (65%) |
| Sin `api/` folder | 9 de 23 (39%) | 9 de 23 (39%) | 9 de 23 (39%) |

**Reducción acumulada:** 44 violaciones #5 (-37%) y 18 #4 (-55%) en 30 commits de 2 features.

## Tabla maestra por feature

Las columnas #5 y #4 muestran `inicial → actual` cuando hubo cambio. Estado refleja el actual.

| Feature | `queryKeys.ts` | `api/` folder | Violaciones #5 | Violaciones #4 | Estado |
|---|:---:|:---:|:---:|:---:|---|
| accounting | ✓ | ✓ | 1 | 1 | Mostly compliant |
| audit | ✗ | ✗ | 0 | 0 | Compliant (read-only) |
| auth | ✗ | ✗ | 1 | 0 | Anti-pattern |
| billing | ✓ | ✓ | 5 | 1 | Anti-pattern |
| contacts | ✓ | ✓ | 2 | 1 | Mostly compliant |
| credits | ✗ | ✓ | 0 | 0 | Compliant (read-only) |
| finance | ✗ | ✗ | 8 | 1 | Anti-pattern |
| hr | ✗ | ✓ | 0 | 3 | Mostly compliant |
| **inventory** | ✓ | ✓ | **21 → 0** ✅ | **4 → 0** ✅ | **Compliant (sweep completado)** |
| **sales** | ✓ | ✓ | **11 → 0** ✅ | **4 → 0** ✅ | **Compliant (sweep completado)** |
| notifications | ✗ | ✗ | 0 | 0 | Compliant |
| orders | ✗ | ✗ | 8 | 0 | Anti-pattern |
| pos | ✗ | ✗ | 4 | 0 → 1 | Anti-pattern |
| production | ✗ | ✗ | 4 | 3 | Anti-pattern |
| profile | ✗ | ✓ | 0 | 0 | Compliant |
| purchasing | ✓ | ✗ | 9 | 1 | Anti-pattern |
| realtime | ✗ | ✗ | 0 | 0 | Compliant (infra-only) |
| search | ✗ | ✓ | 0 | 0 | Compliant (aggregator) |
| **settings** | ✗ | ✓ | **11** | 1 | Anti-pattern |
| tax | ✗ | ✗ | 4 | 0 | Anti-pattern |
| **treasury** | ✓ | ✓ | **12** | 3 | Anti-pattern |
| users | ✗ | ✗ | 3 | 0 | Anti-pattern |
| workflow | ✗ | ✓ | 3 | 0 | Anti-pattern |

## Top ofensores actuales — archivos exactos

### inventory — completado (21 → 0)

✅ Sweep completado en 22 commits incrementales. Detalle de hooks creados y patrones
aplicados en [fsd-data-layer-refactor-plan.md](fsd-data-layer-refactor-plan.md).

### treasury (12 violaciones #5)

```
TerminalManagement.tsx              MovementWizard.tsx
POSSessionDetailClient.tsx          TerminalBatchForm.tsx
MonthlyInvoiceModal.tsx             TreasuryMovementDetailClient.tsx
PaymentReferenceModal.tsx           BankStatementDetailClient.tsx
CashMovementModal.tsx               PaymentModal.tsx
TransferModal.tsx                   MasterDataManagement.tsx
```

Sub-entidades: `Terminal`, `TerminalBatch`, `POSSession`, `TreasuryMovement`, `BankStatement`, `Payment`, `PaymentReference`, `MonthlyInvoice`, `Transfer`, `CashMovement`.

### sales — completado (11 → 0)

✅ Sweep completado en 8 commits. Hooks creados:
`useSaleOrder`, `useSubscriptionHistory`, mutaciones de `registerNoteOnOrder`,
`dispatchOrder`, `dispatchOrderPartial` + 3 DetailClients huérfanos eliminados
(ADR-0020 los reemplazó por list+modal pattern).

Como subproducto, otras features ganaron hooks aprovechables:
- `billing`: `useInvoice`, `confirmInvoice`, `registerNoteOnInvoice`, `posCheckout`, `requestCredit`
- `contacts`: `useContact`, `useContactCreditLedger`, `usePartners`
- `accounting`: `useAccountingSettings`
- `pos`: `usePOSSessionSummary`, `fetchPOSSessionSummary`
- `workflow`: `getTask` helper

### treasury (12 violaciones #5 — siguiente en cola)

```
TerminalManagement.tsx              MovementWizard.tsx
POSSessionDetailClient.tsx          TerminalBatchForm.tsx
MonthlyInvoiceModal.tsx             TreasuryMovementDetailClient.tsx
PaymentReferenceModal.tsx           BankStatementDetailClient.tsx
CashMovementModal.tsx               PaymentModal.tsx
TransferModal.tsx                   MasterDataManagement.tsx
```

Sub-entidades: `Terminal`, `TerminalBatch`, `POSSession`, `TreasuryMovement`, `BankStatement`, `Payment`, `PaymentReference`, `MonthlyInvoice`, `Transfer`, `CashMovement`.

Nota: `useSalesOrders` ya existe con la mayoría de las mutaciones bien hechas (commit del piloto realtime). El gap está en `SaleOrderForm.tsx` (usa `api.put` directo) y los wizards de checkout.

### settings (11 violaciones #5, además **sin** `queryKeys.ts`)

```
PurchasingSettingsView.tsx                 partners/MassPaymentModal.tsx
TerminalFormModal.tsx                      partners/InventoryContributionModal.tsx
CustomFieldTemplateForm.tsx                partners/PartnerWithdrawalWizard.tsx
GroupManagement.tsx                        partners/PartnerContributionWizard.tsx
TreasurySettingsView.tsx
AccountingSettingsView.tsx
CompanySettingsView.tsx
```

Settings es transversal: muta entidades de varios módulos (purchasing config, treasury config, accounting config, partners). El refactor aquí es más complejo porque las mutaciones cruzan dominios.

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

El proyecto tiene un **gap arquitectural sistémico**: la capa de datos FSD existe en docs (ADR-0020, frontend-fsd.md, invariantes #4/#5) pero **no está mecánicamente enforced**. Las features que se escribieron temprano siguen el patrón; las que crecieron orgánicamente bajo presión de feature work bypasean los hooks.

El plan de remediación está en [fsd-data-layer-refactor-plan.md](fsd-data-layer-refactor-plan.md). Antes de cualquier refactor masivo es prerrequisito **agregar la barrera mecánica** (ESLint rule) — sin eso las violaciones reaparecen.

## Referencias

- Patrón canónico: [frontend-fsd.md](../10-architecture/frontend-fsd.md)
- Plan de refactor derivado: [fsd-data-layer-refactor-plan.md](fsd-data-layer-refactor-plan.md)
- ADR del entity bus que reveló el problema: [ADR-0026](../10-architecture/adr/0026-entity-bus-realtime-invalidation.md)
- Fix puente que reduce el síntoma: commit `874fc7bd` (`staleTime: 0` en useSelectedEntity)
- Restricción operativa: PYME single-node, presupuesto ~$0 (memoria auto-cargada)
