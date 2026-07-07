---
layer: 50-audit
doc: datatable-view-audit
status: active
owner: frontend-team
created: 2026-05-12
last_review: 2026-05-12
---

# Auditoría: Sistema de Vistas de DataTable — ERPGrafico

## Decisiones de diseño (cerradas)

| # | Pregunta | Decisión |
|---|---|---|
| 1 | Persistencia de vista | **URL param** (`?view=card`) — bookmarkeable, consistente con ADR-0020 |
| 2 | Vista default por módulo | **Por código** — definida en cada página, sin configuración de usuario |
| 3 | `EntityCard` base | **Unificar** — extraer componente base compartido |
| 4 | `cardMode` rename | **Sí** — nuevo prop `variant: 'standalone' \| 'embedded'` |
| 5 | Default kanban en OTs | **No era intención** — cambiar a `'list'` como default |

---

## 1. Superficie total de uso

| Ubicación | Archivos con `DataTable` |
|---|---|
| `app/(dashboard)/**` | 12 archivos |
| `features/**` | 44 archivos |
| **Total** | **~56 instancias** |

---

## 2. Inventario por modo de renderizado

### 2.1 Solo tabla — `variant="standalone"` (classic, hoy `cardMode={false}`)

Tabla con borde propio (`rounded-md border`). Usada dentro de modales o sheets donde la tabla necesita definir su propio contenedor.

| Archivo | Contexto |
|---|---|
| `features/settings/partners/PartnerLedgerModal.tsx` | Modal de ledger de socio |
| `features/profile/ProfileView.tsx` | Tab dentro de perfil |
| `features/finance/MappingConfigSheet.tsx` | Sheet lateral |

---

### 2.2 `variant="embedded"` simple (hoy `cardMode`, ~42 instancias)

Toolbar + Header + Paginación siempre visibles; durante `isLoading=true` solo las filas se reemplazan por skeleton.

**Estado de `isLoading`:**

| Módulo | Archivo | `isLoading` | Estado |
|---|---|---|---|
| Producción / BOMs | `production/boms/page.tsx` | ✅ | Correcto |
| RRHH / Empleados | `hr/employees/page.tsx` | ❌ | Pendiente |
| RRHH / Nóminas | `hr/payrolls/page.tsx` | ❌ | Pendiente |
| RRHH / Ausencias | `hr/absences/page.tsx` | ❌ | Pendiente |
| RRHH / Adelantos | `hr/advances/page.tsx` | ❌ | Pendiente |
| Inventario / Bodegas | `inventory/WarehouseList.tsx` | ❌ | Pendiente |
| Inventario / UoM | `inventory/UoMList.tsx` | ❌ | Pendiente |
| Inventario / Categorías | `inventory/CategoryList.tsx` | ❌ | Pendiente |
| Inventario / Movimientos | `inventory/MovementList.tsx` | ❌ | Pendiente |
| Inventario / Suscripciones | `inventory/SubscriptionsView.tsx` | ❌ | Pendiente |
| Inventario / Precios | `inventory/PricingRuleList.tsx` | ❌ | Pendiente |
| Inventario / Atributos | `inventory/AttributeManager.tsx` | ❌ | Pendiente |
| Inventario / Stock | `inventory/StockReport.tsx` | ❌ | Pendiente |
| Contabilidad / Cuentas | `accounting/AccountsClientView.tsx` | ❌ | Pendiente |
| Contabilidad / Asientos | `accounting/EntriesClientView.tsx` | ❌ | Pendiente |
| Tesorería / Movimientos | `treasury/TreasuryMovementsClientView.tsx` | ❌ | Pendiente |
| Tesorería / Cuentas | `treasury/TreasuryAccountsView.tsx` | ❌ | Pendiente |
| Tesorería / Terminales | `treasury/TerminalBatchesManagement.tsx` | ❌ | Pendiente |
| Tesorería / Maestros (×2) | `treasury/MasterDataManagement.tsx` | ❌ | Pendiente |
| Créditos / Blacklist | `credits/BlacklistView.tsx` | ❌ | Pendiente |
| Contactos | `contacts/ContactsClientView.tsx` | ❌ | Pendiente |
| Sesiones POS | `sales/POSSessionsView.tsx` | ❌ | Pendiente |
| Settings / Grupos | `settings/GroupManagement.tsx` | ❌ | Pendiente |
| Settings / Usuarios | `settings/UsersSettingsView.tsx` | ❌ | Pendiente |
| Settings / RRHH | `settings/HRSettingsView.tsx` | ❌ | Pendiente |
| Settings / Socios (×3) | `settings/partners/*.tsx` | ❌ | Pendiente |
| Auditoría | `settings/audit/page.tsx` | ❌ | Pendiente |
| Presupuestos | `finance/BudgetsListView.tsx` | ❌ | Pendiente |
| Conciliación | `finance/bank-reconciliation/*.tsx` | ❌ | Pendiente |

---

### 2.3 Multi-vista conmutable — estado actual y decisiones

| Página | Default actual | Default correcto | Opciones | Custom renderer | Persistencia |
|---|---|---|---|---|---|
| `sales/SalesOrdersView.tsx` | `'card'` | `'card'` ✓ | Lista, Tarjeta | `OrderCard` grid | ❌ → URL param |
| `billing/SalesInvoicesClientView.tsx` | `'list'` | `'list'` ✓ | Lista, Tarjeta | card grid inline | ❌ → URL param |
| `billing/PurchaseInvoicesClientView.tsx` | `'list'` | `'list'` ✓ | Lista, Tarjeta | card grid inline | ❌ → URL param |
| `purchasing/PurchasingOrdersClientView.tsx` | `'list'` | `'list'` ✓ | Lista, Tarjeta | card grid inline | ❌ → URL param |
| `production/orders/page.tsx` | `'kanban'` | **`'list'`** ⚠️ | Lista, Grilla, Tablero | `WorkOrderKanban` | ❌ → URL param |
| `inventory/ProductList.tsx` | `'table'` | `'list'` (renombrar) | Lista, Grilla | **ninguno — bug** | ❌ → URL param |

---

### 2.4 `renderCustomView` sin `viewOptions` — Vista fija custom

| Archivo | Vista custom | Notas |
|---|---|---|
| `billing/purchases/page.tsx` | Cards facturas de compra | Siempre card, sin selector |
| `tax/TaxDeclarationsView.tsx` | Grid de declaraciones | Siempre custom |
| `credits/PortfolioTable.tsx` | Portfolio custom | Siempre custom |
| `contacts/ContactModal.tsx` (×2) | Listas custom en modal | Siempre custom |
| `credits/BlacklistView.tsx` | Grid blacklist | Siempre custom |

---

### 2.5 `manualPagination` — Paginación server-side

| Archivo | Notas |
|---|---|
| `finance/bank-reconciliation/ReconciliationPanel.tsx` (×2) | Paginación manual con `pageCount` |

---

### 2.6 `hidePagination`

| Archivo | Razón |
|---|---|
| `profile/ProfileView.tsx` | Tabla embebida pequeña, sin sentido paginar |

---

## 3. Anatomía del sistema — estado actual

```
DataTable (cardMode=true / futuro: variant="embedded")
├── [Siempre visible] DataTableToolbar
│     ├── Search input
│     ├── Button group (filtros, orden, columnas)
│     ├── [si viewOptions] Dropdown selector de vista  ← estado HOY: useState ephemeral
│     │                                                   FUTURO: ?view= URL param
│     └── [si createAction] Botón de creación
├── overflow-x-auto wrapper
│     ├── [si renderCustomView] → custom renderer
│     │     └── [HOY: sin skeleton cuando isLoading=true — bug]
│     └── [si !renderCustomView] → Table HTML estándar
│           ├── [Siempre visible] TableHeader
│           ├── TableBody
│           │     ├── [si isLoading] → SharedTableSkeleton (solo rows) ← correcto
│           │     ├── [si data.length>0] → filas reales
│           │     └── [si !data.length] → EmptyState
│           └── [si renderFooter] → TableFooter
└── [si !hidePagination, siempre visible] DataTablePagination
```

---

## 4. Problemas identificados

### P-01 — `cardMode` sin semántica clara (severidad: media)

**Decisión:** Reemplazar con `variant: 'standalone' | 'embedded'`.
- `'embedded'` = sin borde propio (hoy `cardMode={true}`)
- `'standalone'` = con borde propio (hoy `cardMode={false}` / default)
- Migración: ~45 instancias (42 a `embedded` + 3 a `standalone` explícito).

---

### P-02 — `isLoading` ausente en ~42 instancias (severidad: alta)

Solo `/production/boms` pasa `isLoading`. El resto muestra tabla vacía durante la carga.

**Decisión:** Estandarizar en todas las instancias con fetching asíncrono.

---

### P-03 — Estado de vista ephemeral (severidad: media)

**Decisión:** URL param `?view=<value>`. Leer con `useSearchParams`, escribir con `router.push` (scroll: false). El valor canónico fallback si no hay param = default definido en código.

```ts
// Patrón a adoptar (sin hook wrapping — directo con useSearchParams/router)
const searchParams = useSearchParams()
const router = useRouter()
const pathname = usePathname()

const currentView = searchParams.get('view') ?? 'list'
const setView = (v: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', v)
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
}
```

---

### P-04 — Default de OTs en `'kanban'` sin intención (severidad: baja)

**Decisión:** Cambiar default a `'list'`. El kanban sigue disponible en el selector.

---

### P-05 — `ProductList` grilla sin `renderCustomView` (severidad: alta — bug)

`viewOptions` declara "Grilla" pero no hay renderer. El selector cambia estado sin efecto.

**Decisión:** Implementar la vista grid de productos con `EntityCard` base una vez disponible, o eliminar la opción hasta entonces.

---

### P-06 — `renderCustomView` sin skeleton cuando `isLoading=true` (severidad: media)

Cuando `renderCustomView` está activo y `isLoading=true`, el DataTable retorna `null` para el body.

**Decisión:** Añadir prop `renderLoadingView?: () => ReactNode`. Cuando `isLoading=true` Y existe `renderCustomView`, usar `renderLoadingView` (fallback: `CardSkeleton` genérico si no se provee).

---

### P-07 — `'grid'` sin contrato de layout (severidad: media)

Cada módulo hace su propio grid ad-hoc.

**Decisión:** Formalizar con componente `EntityCard` base. Hasta que exista, no añadir nuevas opciones `'grid'`.

---

### P-08 — Ausencia total de contrato documentado (severidad: alta)

**Decisión:** Crear `docs/20-contracts/component-datatable-views.md` como contrato formal post-refactor.

---

## 5. Catálogo de card views custom

| Módulo | Componente | Estado |
|---|---|---|
| Ventas / Pedidos y Notas | `OrderCard` | ✅ Extraído — reutilizable |
| Facturación ventas | inline JSX | ❌ Pendiente migrar a `EntityCard` |
| Facturación compras | inline JSX | ❌ Pendiente migrar a `EntityCard` |
| Compras / Órdenes | inline JSX | ❌ Pendiente migrar a `EntityCard` |
| Declaraciones impuestos | inline JSX | ❌ Pendiente migrar a `EntityCard` |
| Créditos portfolio | inline JSX | ❌ Pendiente migrar a `EntityCard` |

---

## 6. Brechas de documentación

| Contrato existente | Gap identificado |
|---|---|
| `component-skeleton.md` | No cubre `isLoading` en DataTable ni `renderLoadingView` |
| `component-contracts.md` | No menciona DataTable ni sus modos |
| `list-modal-edit-pattern.md` | No cubre multi-view ni view switching |
| *(ninguno)* | DataTable views: sin contrato → **crear `component-datatable-views.md`** |
