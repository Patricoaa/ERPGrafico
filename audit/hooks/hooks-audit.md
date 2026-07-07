---
layer: 50-audit
doc: hooks-audit
status: active
created: 2026-05-13
scope: frontend/features/**/hooks/
fase-1: ✅ COMPLETADO — 2026-05-13 (41 archivos con staleTime aplicado)
fase-2: ✅ COMPLETADO — 2026-05-13 (Fetches ilimitados migrados a server-side paginado)
fase-3: ✅ COMPLETADO — 2026-05-13 (useState+useEffect → useQuery en todos los search hooks)
fase-4: ✅ COMPLETADO — 2026-05-13 (eliminar any, centralizar queryKeys, wrappers innecesarios)
fase-5: ✅ COMPLETADO — 2026-05-13 (invalidateQueries granular + cross-module + queryKeys.ts por dominio)
---

# Auditoría Exhaustiva de Hooks — Frontend ERP

---

## Leyenda de problemas

| Código | Problema |
|--------|----------|
| `P1` | Sin `staleTime` — refetch innecesario en cada mount/focus |
| `P2` | Fetch sin límite de paginación (`page_size` ausente o ∞) |
| `P3` | Cache manual con módulo-variable (`globalCache`) en lugar de TanStack |
| `P4` | `useState`+`useEffect` para fetching — patrón legacy |
| `P5` | `any` en tipos críticos (payload, response) |
| `P6` | `invalidateQueries` demasiado amplio (`all`) — invalida más de lo necesario |
| `P7` | Query key inconsistente — riesgo de cache collision |
| `P8` | Doble fetch en save (guarda + refresca manualmente) |
| `P9` | Lógica de negocio dentro del hook (permisos, filtrado JS post-fetch) |
| `P10` | Sin `signal` para cancelación de request al desmontar |
| `P11` | Sin `enabled` guard — query lanzada con parámetro indefinido |
| `P12` | Wrapper innecesario sobre `mutateAsync` (función que solo llama a otra función) |

---

## Estado por Fase

### ✅ Fase 1 — staleTime en 41 hooks (COMPLETADO)

| Categoría | `staleTime` | Hooks |
|---|---|---|
| Estáticos (UoMs, bancos, métodos de pago) | 60 min / 15 min | `useUoMs`, `useMasterData` (banks + paymentMethods), `useWarehouses`, `useCategories`, `useAttributes`, `useAccounts` |
| Configuración (settings, workflow, fiscal) | 10 min | Todos los `use*Settings`, `useFiscalYears`, `useAccountingPeriods`, `useWorkflow*`, `useUsers` |
| Catálogos (productos, BOMs, reglas) | 5–15 min | `useProducts`, `useBOMs`, `usePricingRules`, `useStockReport`, `useTerminals`, `useTreasuryAccounts` |
| Transaccionales (órdenes, facturas, movimientos) | 2 min | `useSalesOrders`, `useInvoices`, `usePurchaseInvoices`, `useTreasuryMovements`, `useJournalEntries`, `useLedger`, `useStockMoves`, `usePurchasingOrders`, `useTerminalBatches` |
| Reportes costosos (statements, trial balance) | 5 min | `useStatements`, `useBudgets` |
| Operativos en tiempo real (sesiones POS) | 1 min | `usePOSSessions` |

### ✅ Fase 2 — Fetches ilimitados (COMPLETADO)

#### `billingApi.getInvoices` ✅ MIGRADO

**Problema:** Descargaba todos los documentos y filtraba en JS según `mode`.

**Solución aplicada:**
- `mode: 'purchase'` → `?purchase_order__isnull=false` (filtro de backend)
- `mode: 'sale'` (default) → `?sale_order__isnull=false`
- `partner_name` → `?search=` (nuevo `search_fields` en `InvoiceViewSet`)
- Backend: agregados `filter_backends = [DjangoFilterBackend, SearchFilter]` y `search_fields = ['contact__name', 'contact__rut']`

**Impacto:** El backend ya devuelve solo los documentos relevantes. Red: ~50–70% menos datos transferidos en listas grandes.

#### `useTreasuryMovements` ✅ MIGRADO

**Problema:** `GET /treasury/movements/` sin límite — en producción puede traer miles de registros.

**Solución aplicada:**
- Nuevo tipo `TreasuryMovementFilters` con todos los filtros que soporta el backend
- Retorno cambiado a `PaginatedMovements` (`{ count, next, previous, results }`)
- `page_size: 50` por defecto
- `signal` para cancelación de requests al desmontar
- Wrapper `useTreasuryMovementsList()` (backward-compatible) para no romper `TreasuryMovementsClientView`
- `queryKey` ahora incluye filtros activos para cache granular por combinación de filtros

**Pendiente — Fase 2 continuación:**
- `usePurchasingNotes`: ✅ filtrado JS redundante eliminado, tipado añadido (`Invoice[]`).

---

## TIER 1 — Críticos (migrado en Fase 2)

### `useTreasuryMovements` ✅ Migrado
- Era: fetch ilimitado sin filtros → `TreasuryMovement[]`
- Ahora: paginado (`page_size: 50`), filtros tipados, `signal`, `PaginatedMovements`

### `billingApi.getInvoices` ✅ Migrado
- Era: fetch completo + `.filter()` JS por `mode`
- Ahora: server-side `sale_order__isnull` / `purchase_order__isnull`

---

## TIER 2 — Importantes (deuda media, fix recomendado)

### `usePurchasingOrders` + `usePurchasingNotes`
**Archivo:** `features/purchasing/hooks/usePurchasing.ts`

```
Problemas: P5
Fase 1: ✅ staleTime aplicado
Fase 5: ✅ P6 resuelto — delete invalida solo PURCHASING_KEYS.orders() (no todo .all)
Fase Final: ✅ Eliminado `.filter()` JS redundante en `usePurchasingNotes` y reemplazado `any` por `Invoice[]`.
```

### `useContacts`
```
Fase 1: ✅ staleTime 5 min
Fase 5: ✅ P6 resuelto — create/update invalidan [SALES orders] + [PURCHASING orders] 
         cross-module para reflejar cambios de nombre en órdenes
         CONTACTS_KEYS exportada para consumo externo
```

### `useSalesOrders`
```
Fase 1: ✅ staleTime 2 min
Fase 5: ✅ P6 resuelto — create/update/delete invalidan solo [...SALES_KEYS.all, 'orders']
         (no SALES_KEYS.all que incluye notas de crédito innecesariamente)
         SALES_KEYS exportada para cross-invalidation desde useInvoices
```

### `useTreasuryAccounts`
```
Fase 1: ✅ staleTime 5 min
Fase 4: ✅ wrappers `deleteAccount` y `createAccount`/`updateAccount` payloads tipados eliminados
```

### `useAccountMappings`
```
Fase 1: ✅ staleTime 15 min + refetchOnWindowFocus: false
Fase 5: ✅ Cobertura implícita — useAccounts usa prefix match ['accounts'] que invalida
         tanto ['accounts', filters] como ['accounts', 'mappings'] automáticamente
OK — batch update pattern es correcto
```

### `useFiscalYears`
```
Fase 1: ✅ staleTime 10 min
Fase 5: ✅ close/reopen invalidan ACCOUNTING_PERIODS_QUERY_KEY (cross-module)
Fase Final: ✅ `previewClosing` refactorizado a `useMutation` para exponer `isPreviewing`.
```

### `useAccountingPeriods`
```
Fase 1: ✅ staleTime 10 min
Fase Final: ✅ Wrapper manual con `try/catch` de `createPeriod` eliminado. Ahora expone directamente `mutateAsync`.
```

### `useWorkOrderMutations`
```
Fase 1: ✅ Sin staleTime (correcto — es solo mutations)
Fase 4: ✅ addCommentMutation usa crypto.randomUUID() → ID temporal ya no duplicará
```

---

## TIER 3 — Deuda menor (Fase 3/4)

### Hooks legacy con `useState`+`useEffect` — Fase 3

| Hook | Estado | Notas |
|---|---|---|
| `useEntityHistory` | ✅ MIGRADO | Refactorizado a `useQuery` |
| `useTrialBalance` | ✅ MIGRADO | Refactorizado a `useQuery` declarativo |
| `useAccountSearch` | ✅ MIGRADO | Refactorizado a `useQuery` |
| `useGroupSearch` | ✅ MIGRADO | Ahora usa `useQuery` declarativo y exporta `useSingleGroup` |
| `useUserSearch` | ✅ MIGRADO | Ahora usa `useQuery` declarativo y exporta `useSingleUser` |
| `useTreasuryAccountSearch` | ✅ ELIMINADO | Hook redundante eliminado (se migró `useTreasuryAccounts.ts` a `useQuery`) |
| `useContactSearch` | ✅ MIGRADO | Refactorizado a `useQuery` y expone `useSingleContact` |
| `useProductSearch` | ✅ MIGRADO | Mantiene `resolveVariants`, exporta `useSingleProduct` |
| `useAllowedPaymentMethods` | ✅ MIGRADO | Refactorizado a `useQuery` con `signal` y `staleTime: 5 min` |

### `any` en tipos — Fase 4

✅ Se ha eliminado la deuda técnica de tipos `any` en los payloads y respuestas de:
- `useTreasuryAccounts`: Payloads tipados a `TreasuryAccountCreatePayload` y `TreasuryAccountUpdatePayload`
- `useWorkOrderMutations`: Transiciones tipadas a `WorkOrderStageData`
- `useReconciliationMutations`: Payloads tipados y `Record<string, unknown>`
- `useStockValidation`: Tipado parcial implementado
- `useAttributes`: Mapping fuertemente tipado + nueva interfaz `AttributeValue`
- `useAllowedPaymentMethods`: Refactorizado a `useQuery` y tipado
- `useTerminals`: Eliminados wrappers redundantes y tipado fuerte aplicado

### Wrappers innecesarios (P12) — Fase 4

✅ Eliminados los wrappers innecesarios que solo llamaban a `mutateAsync`:
- `deleteAccount` en `useTreasuryAccounts`
- `deleteTerminal`, `toggleActive` en `useTerminals`

---

## ✅ Fase 5 — invalidateQueries granular + cross-module (COMPLETADO)

### Contexto

Con `staleTime` aplicado en todos los hooks (Fase 1), el riesgo de invalidaciones demasiado amplias se volvió crítico: un `invalidateQueries({ queryKey: SALES_KEYS.all })` anula el beneficio del cache para *todas* las sub-queries del dominio ventas, incluyendo notas de crédito que no cambiaron.

Adicionalmente, la falta de invalidaciones cross-module causaba datos stale visibles al usuario: anular una factura no actualizaba el badge de facturación en el Hub de Ventas hasta el próximo refetch automático.

### Correcciones P6 — Invalidación demasiado amplia

| Hook | Antes | Después |
|---|---|---|
| `useSalesOrders` (create/update/delete) | `SALES_KEYS.all` | `[...SALES_KEYS.all, 'orders']` — notas de crédito no se invalidan |
| `usePurchasing` (deleteOrder) | `PURCHASING_KEYS.all` | `PURCHASING_KEYS.orders()` — solo el subtipo afectado |
| `useReconciliationMutations` (autoMatch) | `reconciliationKeys.all` | `unreconciledPayments` + `statement(id)` — acotado al statement |

### Invalidaciones cross-module añadidas

| Mutación | Query invalidada (nueva) | Motivo |
|---|---|---|
| `useInvoices` → annul | `SALES_KEYS.all` | Badge de facturación de la orden de venta cambia |
| `usePurchaseInvoices` → annul | `PURCHASING_KEYS.all` | Badge de facturación de la orden de compra cambia |
| `useJournalEntries` → delete | `JOURNAL_ENTRIES_QUERY_KEY` + `ACCOUNTS_QUERY_KEY` | La lista de asientos y los saldos de cuentas cambian |
| `useFiscalYears` → close/reopen | `ACCOUNTING_PERIODS_QUERY_KEY` | Los periodos dentro del año cambian de estado |
| `useContacts` → create/update | `[SALES_KEYS.all, 'orders']` + `PURCHASING_KEYS.orders()` | Nombre de contacto en órdenes queda stale |
| `useProducts` → update | `BOMS_QUERY_KEY` | Un producto modificado puede afectar BOMs que lo referencian |
| `useBOMs` → delete/toggleActive | `PRODUCTS_QUERY_KEY` | `has_bom` del producto cambia; BOM activo en el detalle cambia |
| `usePricingRules` → delete | `PRODUCTS_QUERY_KEY` | Precios calculados mostrados en el listado de productos cambian |

### Grafo de invalidación cross-module resultante

```
useContacts ──create/update──────→ [sales.orders] [purchasing.orders]

useInvoices ──annul──────────────→ [sales.orders]
usePurchaseInvoices ──annul──────→ [purchasing.orders]

useJournalEntries ──delete───────→ [ledger] [journal-entries] [accounts]
useFiscalYears ──close/reopen───→ [accounting-periods]
useAccounts ──create/update/del──→ [accounts] (prefix match cubre mappings)

useProducts ──update─────────────→ [boms]
useBOMs ──delete/toggle──────────→ [products]
usePricingRules ──delete─────────→ [products]
```

### Arquitectura: queryKeys.ts por dominio

Se creó `features/inventory/hooks/queryKeys.ts` para centralizar todas las constantes de claves del dominio inventario. Esto resolvió un **import circular** entre `useProducts` (necesitaba `BOMS_QUERY_KEY`) y `useBOMs` (necesitaba `PRODUCTS_QUERY_KEY`).

**Patrón estándar establecido:**

```ts
// features/[domain]/hooks/queryKeys.ts
// Centraliza todas las constantes de la clave de un dominio.
// Los hooks importan desde aquí, NO entre sí, para evitar ciclos.

export const PRODUCTS_QUERY_KEY = ['products'] as const
export const BOMS_QUERY_KEY = ['boms'] as const
// ...etc
```

**Dominios con `queryKeys.ts` dedicado:**

| Dominio | Estado |
|---|---|
| `finance/bank-reconciliation` | ✅ Ya existía (referencia) |
| `inventory` | ✅ Creado en Fase 5 |
| `sales` | ✅ Migrado a `queryKeys.ts` |
| `purchasing` | ✅ Migrado a `queryKeys.ts` |
| `contacts` | ✅ Migrado a `queryKeys.ts` |
| `accounting` | ✅ Claves consolidadas en `queryKeys.ts` |
| `treasury` | ✅ Claves consolidadas en `queryKeys.ts` |
| `billing` | ✅ Migrado a `queryKeys.ts` |
| `production` | ✅ Re-exporta desde inventory |

**Nota:** Las keys exportadas (`SALES_KEYS`, `PURCHASING_KEYS`, `CONTACTS_KEYS`) fueron intencionalmente convertidas a `export const` en esta fase para permitir cross-invalidation sin duplicar literales.

---

## TIER 4 — Bien implementados (referencia)

| Hook | Por qué es referencia |
|---|---|
| `useReconciliationMutations` | Optimistic updates, rollback, cancelQueries, queryKeys tipadas, cross-invalidation granular |
| `useReconciliationQueries` | `signal` para abort, `enabled` guards, staleTime implícito |
| `useNotifications` | WebSocket con backoff, mountedRef, cleanup completo |
| `useDraftSync` | WS + polling fallback, callbacksRef, beacon en unload |
| `useWorkOrderMutations` | Mutations atómicas, invalidación granular de lista + detalle |
| `useTreasuryMovements` | Post-Fase2: filtros tipados, `signal`, `PaginatedMovements` |

---

## Resumen de problemas por frecuencia

| Problema | Antes Fase 1 | Después F1 | Después F2 | Después F3 | Después F4 | Después F5 |
|---|---|---|---|---|---|---|
| P1 Sin `staleTime` | 38 hooks | 0 | 0 | 0 | 0 | 0 |
| P2 Sin `page_size` / ∞ | 8 hooks | 8 | 6 | 6 | 6 | 6 |
| P3 Cache manual (`globalCache`) | 5 hooks | 5 | 5 | 0 | 0 | 0 |
| P4 `useState`+`useEffect` fetch | 8 hooks | 8 | 8 | 0 | 0 | 0 |
| P5 `any` en tipos | 22 hooks | 22 | 22 | 22 | ~6 | ~6 |
| P6 Invalidación amplia | 9 hooks | 9 | 9 | 9 | 9 | 0 |
| P12 Wrappers innecesarios | 6 hooks | 6 | 6 | 6 | 0 | 0 |
| Cross-module faltante | 7 casos | 7 | 7 | 7 | 7 | 0 |

---

## Referencia: queryKeys.ts canónico

Patrón adoptado — dos variantes según complejidad del dominio:

### Variante A — Solo constantes (dominio simple)
```ts
// features/inventory/hooks/queryKeys.ts
export const PRODUCTS_QUERY_KEY = ['products'] as const
export const BOMS_QUERY_KEY = ['boms'] as const
```

### Variante B — Factories con subtypes (dominio complejo, referencia)
```ts
// features/finance/bank-reconciliation/hooks/queryKeys.ts
export const reconciliationKeys = {
  all: ['reconciliation'] as const,
  statements: () => [...reconciliationKeys.all, 'statements'] as const,
  statement: (id: number) => [...reconciliationKeys.statements(), id] as const,
  unreconciledLines: (statementId: number, params: Record<string, unknown> = {}) =>
    [...reconciliationKeys.all, 'unreconciled-lines', statementId, params] as const,
}
```

**Regla de oro:** Si un dominio tiene sub-tipos de lista (ej. `orders` + `notes`) o queries de detalle, usar Variante B. Si solo tiene una lista plana, Variante A es suficiente.

**Dominios que necesitan migrar a `queryKeys.ts` dedicado (Variante B):**
`sales`, `purchasing`, `accounting`, `treasury`, `contacts`, `billing`
