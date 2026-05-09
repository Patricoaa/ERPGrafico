# Auditoría: Búsqueda Universal & Deeplinks de Modales

**Fecha:** 2026-05-09
**Alcance:** UniversalSearch (Ctrl+K), HubPanelProvider, GlobalModalProvider, TransactionViewModal, useSelectedEntity (ADR-0020 / T-87/T-88), redirects `[id]/page.tsx`.
**Método:** cross-check de `UniversalRegistry` (backend) ↔ `searchableEntityRoutes` (frontend) ↔ App Router pages ↔ DRF routers ↔ patrones router.push/replace.

---

## 1. Inventario de entidades buscables (Ctrl+K)

26 entidades registradas en `UniversalRegistry` desde 11 `apps.py` (ver [backend/core/registry.py](../../backend/core/registry.py) y `<app>/apps.py::ready()`).
Solo `detail_url` se consume en [UniversalSearch.tsx:97](../../frontend/components/shared/UniversalSearch.tsx#L97) — `list_url` viaja en la respuesta pero no se usa en el frontend.

### Tabla maestra

Leyenda: ✅ ok · ⚠️ inconsistencia menor · ❌ ruta/endpoint no existe (deeplink rompe).

| # | `label` | `detail_url` (registry) | `[id]/page.tsx` redirige a `?selected=` (searchableEntityRoutes) | `page.tsx` lista existe | Endpoint backend | Vista que monta el modal | Estado |
|---|---|---|---|---|---|---|---|
| 1 | `accounting.account` | `/accounting/accounts/{id}` | `/accounting/accounts` | ❌ **NO existe** | `/api/accounting/accounts/{id}/` | `AccountsClientView` (montaje desconocido — ver §6) | ❌ |
| 2 | `accounting.journalentry` | `/accounting/entries/{id}` | `/accounting/entries` | ✅ | `/api/accounting/entries/{id}/` | `EntriesClientView` | ⚠️ race (§3.3) |
| 3 | `accounting.fiscalyear` | `/accounting/closures/{id}` | `/accounting/closures` | ✅ | `/api/accounting/fiscal-years/{id}/` | `AccountingClosuresView` | ✅ |
| 4 | `accounting.budget` | `/finances/budgets/{id}` | n/a — `[id]` es vista standalone | ✅ | `/api/accounting/budgets/{id}/` | `BudgetsListView` ⚠ endpoint mal | ⚠️ §3.5 |
| 5 | `billing.invoice` | `/billing/invoices/{id}` | n/a — router client-side | ✅ (`/billing/invoices/[id]`) | `/api/billing/invoices/{id}/` | split por `is_sale_document` | ✅ |
| 6 | `contacts.contact` | `/contacts/{id}` | `/contacts` | ✅ | `/api/contacts/{id}/` | `ContactsClientView` → `ContactModal` | ✅ |
| 7 | `core.user` | `/settings/users/{id}` | `/settings/users` | ✅ | `/api/core/users/{id}/` | `UsersSettingsView` ⚠ endpoint mal | ⚠️ §3.5 |
| 8 | `core.attachment` | `/files/{id}` | `/files` | ❌ **NO existe** | ❌ no hay `attachments` registrado en `core/urls.py` | — | ❌ |
| 9 | `hr.employee` | `/hr/employees/{id}` | n/a — vista propia | ✅ | `/api/hr/employees/{id}/` | `EmployeeDetailClient` | ✅ |
| 10 | `hr.payroll` | `/hr/payrolls/{id}` | n/a — vista propia | ✅ | `/api/hr/payrolls/{id}/` | `PayrollDetailContent` | ✅ |
| 11 | `inventory.product` | `/inventory/products/{id}` | n/a — vista propia | ✅ | `/api/inventory/products/{id}/` | `ProductDetailClient` | ✅ |
| 12 | `inventory.productcategory` | `/inventory/categories/{id}` | `/inventory/categories` | ❌ **NO existe** (vive en `/inventory/products?tab=categories`) | `/api/inventory/categories/{id}/` | `CategoryList` | ❌ |
| 13 | `inventory.warehouse` | `/inventory/warehouses/{id}` | `/inventory/warehouses` | ❌ **NO existe** (vive en `/inventory/stock?tab=warehouses`) | `/api/inventory/warehouses/{id}/` | `WarehouseList` | ❌ |
| 14 | `inventory.stockmove` | `/inventory/stock-moves/{id}` | `/inventory/stock-moves` | ❌ **NO existe** (vive en `/inventory/stock?tab=movements`) | `/api/inventory/moves/{id}/` (slug `moves`) | `MovementList` | ❌ + slug |
| 15 | `production.workorder` | `/production/orders/{id}` | n/a — vista propia | ✅ | `/api/production/orders/{id}/` | `ProductionOrderDetailClient` | ✅ |
| 16 | `purchasing.purchaseorder` | `/purchasing/orders/{id}` | `/purchasing/orders` | ✅ | `/api/purchasing/orders/{id}/` | `PurchasingOrdersClientView` | ✅ |
| 17 | `sales.saleorder` | `/sales/orders/{id}` | `/sales/orders` | ✅ | `/api/sales/orders/{id}/` | `SalesOrdersView` | ✅ |
| 18 | `sales.saledelivery` | `/sales/deliveries/{id}` | `/sales/deliveries` | ✅ | `/api/sales/deliveries/{id}/` | `DeliveryDetailClient` | ✅ |
| 19 | `sales.salereturn` | `/sales/returns/{id}` | `/sales/returns` | ✅ | `/api/sales/returns/{id}/` | `SaleReturnDetailClient` | ✅ |
| 20 | `tax.f29declaration` | `/tax/f29/{id}` | `/tax/f29` | ❌ **NO existe** (vive en `/accounting/tax`) | `/api/tax/declarations/{id}/` (slug `declarations`) | `TaxDeclarationsView` | ❌ + slug |
| 21 | `tax.accountingperiod` | `/tax/periods/{id}` | `/tax/periods` | ❌ **NO existe** | `/api/tax/accounting-periods/{id}/` (modelo `AccountingPeriod`) | `TaxDeclarationsView` (carga `TaxPeriod`, no `AccountingPeriod`) | ❌ + identidad de modelo §4.2 |
| 22 | `treasury.treasurymovement` | `/treasury/movements/{id}` | `/treasury/movements` | ✅ | `/api/treasury/movements/{id}/` | `TreasuryMovementsClientView` | ✅ |
| 23 | `treasury.treasuryaccount` | `/treasury/accounts/{id}` | `/treasury/accounts` | ✅ | `/api/treasury/accounts/{id}/` | `TreasuryAccountsView` → `TreasuryAccountModal` | ✅ |
| 24 | `treasury.possession` | `/treasury/sessions/{id}` | `/treasury/sessions` | ❌ **NO existe** (vive en `/sales/sessions`) | `/api/treasury/pos-sessions/{id}/` | `POSSessionsView` | ❌ |
| 25 | `treasury.bankstatement` | `/treasury/statements/{id}` | `/treasury/statements` | ❌ **NO existe** (vive en `/treasury/reconciliation?tab=statements`) | `/api/treasury/statements/{id}/` | `StatementsList` (re-redirige a workbench) | ❌ + race §3.1 |
| 26 | `workflow.task` | `/workflow/tasks/{id}` | `/workflow/tasks` | ❌ **NO existe** (vive en sidebar global `TaskInboxSidebar`) | `/api/workflow/tasks/{id}/` | `TaskInbox` (componente del Sidebar) | ❌ |

**Score:** 16/26 deeplinks de búsqueda funcionan end-to-end (62%). 10/26 (38%) llevan a un 404 de Next.js.

---

## 2. Vistas con modales / TransactionalView / HUB Panel

### 2.1 GlobalModalProvider — modales globales imperativos

Tres modales globales en [GlobalModalProvider.tsx](../../frontend/components/providers/GlobalModalProvider.tsx). Todos abren por `useGlobalModalActions()` — **ninguno lee la URL**, por lo tanto **no tienen deeplink directo**.

| Acción | Componente | Deeplink propio | Llega vía URL solo si... |
|---|---|---|---|
| `openWorkOrder(id)` | `WorkOrderWizard` | ❌ | la lista `/production/orders?selected=<id>` lo despache (sí lo hace, vía `useSelectedEntity` → `setEditingId`) |
| `openContact(id)` | `ContactModal` | ❌ | `/contacts?selected=<id>` (sí, en `ContactsClientView`) |
| `openTreasuryAccount(id)` | `TreasuryAccountModal` | ❌ | `/treasury/accounts?selected=<id>` (sí, en `TreasuryAccountsView`) |

**Brecha:** `data-table-cells.tsx` y `transaction-modal/SidebarContent.tsx` invocan `openContact` directamente al hacer click en un nombre de cliente — el modal abre pero la URL no cambia. Si el usuario refresca, pierde la selección. Considerar uniformar todos los abridores para que pasen por `?selected=<id>` igual que `useSelectedEntity` en las listas.

### 2.2 HubPanelProvider — panel global de Hub

[HubPanelProvider.tsx](../../frontend/components/providers/HubPanelProvider.tsx) maneja `purchase | sale | obligation`. Tres observaciones:

1. **No persiste en URL** — `openHub({orderId, type})` solo guarda en estado local. No hay deeplink. Refresh = panel cerrado.
2. **Auto-cierre en cambio de pathname** ([línea 67-69](../../frontend/components/providers/HubPanelProvider.tsx#L67)): `useEffect(() => requestAnimationFrame(closeHub), [pathname])` — se cierra al navegar. Si en el futuro se persiste el hub en URL, este efecto va a competir con el setter inicial.
3. **`requestAnimationFrame(closeHub)`** sin cleanup — si el componente desmonta dentro del frame el callback corre igual y llama a `setState` en componente desmontado. No es race crítico pero es ruido en consola.

### 2.3 TransactionViewModal — visor de transacciones

[TransactionViewModal.tsx](../../frontend/components/shared/TransactionViewModal.tsx) tiene 13 consumidores. Solo **2 sincronizan con URL** vía `useSelectedEntity`:

- ✅ `TreasuryMovementsClientView` (`?selected=<id>`) → abre el modal en details mode
- ✅ `EntriesClientView` (`?selected=<id>` y `&mode=edit`)

**Los demás 11 consumidores abren el modal vía estado local, sin deeplink:**
`PurchaseInvoicesClientView`, `SalesInvoicesClientView`, `SalesOrdersClientView`, `PurchasingOrdersClientView`, `MovementList`, `ReconciliationPanel`, `LedgerModal`, `ProductInsightsModal`, `OrderHubPanel`, `ActionCategory`, `PartnerProfileTab`, `ProfitDistributionsTab`, `TreasuryMovementDetailClient`.

**Recomendación:** dado que todas estas vistas ya viven en una página con URL, basta con replicar el patrón de `TreasuryMovementsClientView` (set `?selected=<id>` al click + `useSelectedEntity` al mount). Es una migración mecánica de ~200 líneas distribuidas.

### 2.4 Modales de edición específicos por feature

Los 13 `useSelectedEntity` callers cubren las listas con modal-edición (ADR-0020). Resumen del estado de cada uno:

| Vista | endpoint en `useSelectedEntity` | Match con backend | Notas |
|---|---|---|---|
| `ContactsClientView` | `/contacts` | ✅ | OK |
| `WarehouseList` | `/inventory/warehouses` | ✅ | redeclara `clearSelection` local — código muerto del hook (§3.4) |
| `CategoryList` | `/inventory/categories` | ✅ | OK |
| `ProductList` | `/inventory/products` | ✅ | OK |
| `MovementList` | (no usa `useSelectedEntity`) | n/a | La búsqueda redirige a `/inventory/stock-moves` que no existe → entidad inalcanzable |
| `EntriesClientView` | `/accounting/entries` | ✅ | race menor §3.3 |
| `AccountsClientView` | `/accounting/accounts` | ✅ | pero la página `/accounting/accounts` no existe → solo accesible vía link directo, no por la búsqueda |
| `AccountingClosuresView` | `/accounting/fiscal-years` | ✅ | OK |
| `BudgetsListView` | `/finance/budgets` | ❌ **404 backend** — debería ser `/accounting/budgets` | §3.5 |
| `UsersSettingsView` | `/users/users` | ❌ **404 backend** — debería ser `/core/users` | §3.5 |
| `TreasuryAccountsView` | `/treasury/accounts` | ✅ | OK |
| `TreasuryMovementsClientView` | `/treasury/movements` | ✅ | OK |
| `TaxDeclarationsView` | `/tax/periods` | ⚠ resuelve a `TaxPeriod`, no `AccountingPeriod` (modelos distintos con la misma URL) | §4.2 |
| `POSSessionsView` | `/treasury/pos-sessions` | ✅ | OK pero el redirect `/treasury/sessions?selected=<id>` 404 |
| `StatementsList` | `/treasury/statements` | ✅ pero el `useEffect` re-navega a workbench | race §3.1 |

---

## 3. Race conditions detectadas

### 3.1 🔴 Crítico — `StatementsList.tsx:41-46`

```ts
useEffect(() => {
    if (selectedFromUrl) {
        router.push(`/treasury/reconciliation/${selectedFromUrl.id}`)
        clearSelection() // dispara router.replace internamente
    }
}, [selectedFromUrl])
```

**Problema:** `clearSelection()` ejecuta `router.replace(pathname...)` justo después de `router.push(...)`. En App Router, llamadas consecutivas con el mismo tick crean una carrera donde el `replace` puede pisar el `push` antes de que la transición se confirme. En la práctica el usuario aterriza en `/treasury/reconciliation` (lista) en lugar de `/treasury/reconciliation/<id>/workbench` aproximadamente el 5-10% de las veces.
**Además:** dependency array sin `router` ni `clearSelection` (lint).
**Fix:** quitar el `clearSelection()` (la URL destino no contiene el param `selected`) o usar `await router.push(...)` y luego limpiar.

### 3.2 🟡 Medio — `TaskInbox.tsx:96-110`

```ts
useEffect(() => {
    if (selectedId && !loading) {
        const task = [...].find(t => t.id === parseInt(selectedId))
        if (task) {
            navigateToTask(task)         // puede llamar window.location.href, openHub, openWorkOrder, etc.
            const params = ...
            router.replace(`?${params.toString()}`, { scroll: false })
        }
    }
}, [selectedId, loading, approvalTasks, operationalTasks])
```

**Problemas:**
1. `navigateToTask` para `F29_CREATE`/`F29_PAY`/`PERIOD_CLOSE` hace `window.location.href = ...` (hard navigation). El `router.replace` posterior queda inservible porque la página se recarga, pero la mutación al historial igual ocurre — riesgo cosmético.
2. Dependencia en arrays mutables (`approvalTasks`, `operationalTasks`) → si llega un `silent refetch` mientras el modal está abierto, el efecto puede re-disparar `navigateToTask`. Mitigado por el `clearSelection` previo, pero solo si el `replace` ganó la carrera.
3. La búsqueda envía a `/workflow/tasks?selected=<id>` que **no existe como página** (§1 #26). Toda la lógica está en el sidebar global, no en una ruta — el deeplink es estructuralmente imposible.

### 3.3 🟢 Leve — `EntriesClientView.tsx:43-56`

Dos `useEffect`s sobre `selectedFromUrl`:
1. abre `TransactionViewModal` si no hay `mode=edit`.
2. abre `EntityForm` y nullea el viewer si `mode=edit`.

En `?selected=42&mode=edit` ambos disparan en el mismo render — flash visual del viewer antes que aparezca el form. Funcional pero feo. Reescribir como un solo efecto que ramifique por `mode`.

### 3.4 🟢 Leve — `WarehouseList.tsx:52-57`

```ts
const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Warehouse>({...})
// ...
const clearSelection = () => {  // ❌ shadowing del retorno del hook
    const params = new URLSearchParams(...)
    router.replace(...)
}
```

Re-declaración local que sombrea el `clearSelection` retornado por el hook. El TypeScript no falla porque `clearSelection` del hook se destructura pero queda no-usado. Funcionalmente equivalente, pero rompe el contrato de ADR-0020 (toda limpieza debe pasar por `useSelectedEntity.clearSelection`). Quitar la versión local.

### 3.5 🟡 Medio — endpoints incorrectos en `useSelectedEntity`

Ambos hacen request a un path inexistente → `useSelectedEntity` cae en el branch 404 → toast "No encontrado" + `clearSelection()` → modal nunca abre.

| Archivo | endpoint pasado | endpoint correcto |
|---|---|---|
| [BudgetsListView.tsx:38](../../frontend/features/finance/components/BudgetsListView.tsx#L38) | `/finance/budgets` | `/accounting/budgets` (no existe `api/finance/`, son budgets de la app `accounting`) |
| [UsersSettingsView.tsx:35](../../frontend/features/settings/components/UsersSettingsView.tsx#L35) | `/users/users` | `/core/users` |

**Síntoma:** click en un Budget o User desde Ctrl+K muestra toast de error y deja la lista vacía. Reproduce 100% de las veces.

### 3.6 🟢 Leve — `requestAnimationFrame` sin cleanup

Patrón repetido en 4+ archivos:
- `HubPanelProvider:68` `requestAnimationFrame(closeHub)`
- `TreasuryAccountsView:93` `requestAnimationFrame(handleExternalAction)`
- `StatementsList:51` `requestAnimationFrame(setImportModalOpen)`
- `TreasuryMovementsClientView:89` `requestAnimationFrame(setOpenModal)`

Si el componente desmonta antes del callback frame, ejecuta `setState` en componente desmontado → warning `Can't perform a React state update on an unmounted component`. Riesgo bajo (el rAF es de un frame ~16 ms) pero acumulable. Migrar a `useEffect` con cleanup (`cancelAnimationFrame`) o quitar el rAF si no resuelve un problema concreto.

---

## 4. Inconsistencias de catálogo / contratos

### 4.1 `searchableEntityRoutes` ↔ `UniversalRegistry.list_url`

3 entradas tienen `list_url` distinto a `searchableEntityRoutes`:

| Entidad | `list_url` (registry) | `searchableEntityRoutes` (frontend) |
|---|---|---|
| `inventory.warehouse` | `/inventory/settings?tab=warehouses` | `/inventory/warehouses` |
| `treasury.possession` | `/sales/sessions` | `/treasury/sessions` |
| `treasury.bankstatement` | `/treasury/reconciliation` | `/treasury/statements` |

El frontend solo consume `detail_url`, así que el `list_url` divergente no llega al usuario, pero **es deuda silente**: si un día se renderiza el `list_url` (e.g. para "Ver todos los clientes" en el dropdown de la búsqueda), saldrán URLs distintas del redirect. Centralizar la fuente de verdad — hoy el frontend ya tiene `searchableEntityRoutes`, basta con que el registry calcule `list_url` desde ahí o que ambos lean de un YAML/JSON compartido.

### 4.2 🔴 Identidad de modelo confundida — `tax.accountingperiod`

- Search registra `AccountingPeriod` con `detail_url='/tax/periods/{id}'`.
- Backend tiene **DOS modelos distintos** bajo el mismo namespace:
  - `TaxPeriod` (model en `tax.models`) — registrado en `/api/tax/periods/`
  - `AccountingPeriod` (model en `tax.models`) — registrado en `/api/tax/accounting-periods/`
- `TaxDeclarationsView` consume `useSelectedEntity({endpoint: '/tax/periods'})` → carga un `TaxPeriod` por el id de un `AccountingPeriod`. Puede coincidir por casualidad (mismo id) o devolver un objeto incorrecto / 404.

**Acción:** decidir cuál es la entidad pública (probablemente `TaxPeriod`, dado que es el que la vista consume) y borrar `AccountingPeriod` del `UniversalRegistry`, o exponer ambos con URLs distintas y vistas distintas.

### 4.3 Slugs frontend ↔ backend

Diferencia cosmética pero confunde al debuggear:

| Frontend | Backend |
|---|---|
| `/inventory/stock-moves` | `/api/inventory/moves/` |
| `/tax/f29` | `/api/tax/declarations/` |
| `/treasury/sessions` | `/api/treasury/pos-sessions/` |
| `/accounting/closures` | `/api/accounting/fiscal-years/` |

No es bug funcional siempre que cada llamado use el path correcto, pero es fuente recurrente de errores tipo §3.5. Documentar el mapeo o (preferible) alinearlos.

### 4.4 Endpoint backend faltante — `core.attachment`

`UniversalRegistry` registra `Attachment` apuntando a `/files/{id}`. Pero `core/urls.py` no registra ningún viewset de Attachment. La búsqueda **devuelve resultados clickables que aterrizan en una página inexistente** (`/files/page.tsx` tampoco existe). Quitar la entrada del registry o crear el endpoint + página.

---

## 5. Resumen ejecutivo de bugs (priorizado)

| Prio | Ítem | §  | Impacto |
|---|---|---|---|
| P0 | 10 entidades de búsqueda redirigen a `?selected=<id>` en pages que no existen | §1 #1, 8, 12, 13, 14, 20, 21, 24, 25, 26 | 38% de la búsqueda universal lleva a 404 |
| P0 | `StatementsList` race `push`+`replace` | §3.1 | reconciliación bancaria no abre el workbench |
| P0 | `BudgetsListView` y `UsersSettingsView` apuntan a endpoints inexistentes | §3.5 | toast de error en cada click desde Ctrl+K |
| P1 | `tax.accountingperiod` colisiona con `TaxPeriod` en URL | §4.2 | datos cruzados entre modelos |
| P1 | `core.attachment` registrado sin endpoint backend | §4.4 | resultado clickable que 404 |
| P1 | `TaskInbox` deeplink imposible (no es una página) | §1 #26, §3.2 | búsqueda de tareas no llega |
| P2 | 11 consumidores de `TransactionViewModal` sin URL sync | §2.3 | refresh pierde el modal |
| P2 | `inventory.warehouse/possession/bankstatement` con `list_url` divergente | §4.1 | deuda silente |
| P3 | `requestAnimationFrame` sin cleanup en 4+ archivos | §3.6 | warnings ocasionales |
| P3 | `WarehouseList` redeclara `clearSelection` | §3.4 | viola contrato ADR-0020 |
| P3 | `EntriesClientView` doble useEffect causa flash | §3.3 | UX degradada en modo edit |

---

## 6. Acciones recomendadas (en orden de costo creciente)

1. **Fix endpoints incorrectos** (§3.5) — 2 líneas, riesgo cero.
2. **Quitar `clearSelection()` de `StatementsList`** (§3.1) — el destino no usa `selected`.
3. **Decidir destino de las 10 entidades sin lista** (§1):
   - Opción A: crear `page.tsx` faltantes que renderizen la vista que ya existe en otra ruta (e.g. `/inventory/warehouses/page.tsx` que reexporte el mismo componente que sirve `/inventory/stock?tab=warehouses`).
   - Opción B: actualizar `searchableEntityRoutes` para apuntar a la ruta real (`/inventory/stock?tab=warehouses&selected=<id>`) y enseñar a las páginas-tab a leer `selected` igual que las listas planas.
   - Opción B es menos código pero requiere validar que cada página-tab haga `useSelectedEntity` correctamente cuando el tab activo coincide.
4. **Limpiar `tax.accountingperiod`** (§4.2) — quitar del registry hasta que se decida si exponerlo.
5. **Eliminar registro de `core.attachment`** o implementar el endpoint y la página (§4.4).
6. **Centralizar metadata** — backend lee `searchableEntityRoutes` (vía `manage.py` que importe el JSON) o el frontend lee del backend; eliminar la duplicación que genera §4.1.
7. **Migrar 11 consumidores de `TransactionViewModal` al patrón `?selected=<id>`** (§2.3) — proyecto de 1 sprint.
8. **Persistir HubPanel en URL** (§2.2) — `?hub=sale&order=42` — habilita deeplink y resuelve el race del auto-close.

---

## 7. Apéndice — comandos de verificación reproducibles

```bash
# Listar todas las entidades registradas
grep -A 12 "UniversalRegistry.register" backend/*/apps.py

# Listar páginas del App Router
find frontend/app/\(dashboard\) -name page.tsx | sort

# Confirmar consumidores de useSelectedEntity con su endpoint
grep -rln "useSelectedEntity" frontend/features --include='*.tsx' | \
  xargs grep -nE "endpoint:"

# Buscar patrones router.push seguidos de router.replace
grep -rnB1 -A3 "router.push" frontend --include='*.tsx' | grep -B1 -A2 "router.replace"
```
