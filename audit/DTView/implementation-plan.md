---
layer: 50-audit
doc: datatable-view-implementation-plan
status: in-progress
owner: frontend-team
created: 2026-05-12
last_review: 2026-05-12
depends_on: DTView/README.md
progress: "Fase 0 ✅ | Fase 1 ✅ | T-01E ✅ | Fase 2 ✅ | Fase 3 ✅ | T-04A ✅ | T-04B ✅ | T-04C ✅ | T-04D ✅ | T-04E ✅ | T-05A ✅"
---

# Plan de Implementación — Refactor DataTable Views

Basado en [DTView/README.md](./README.md). Las tareas están ordenadas por dependencias: cada fase es prerequisito de la siguiente. Dentro de una fase las tareas son paralelas.

---

## Fase 0 — Correcciones urgentes (bugs activos, sin dependencias)

### T-00A: Corregir default de vista en `production/orders`

**Problema:** P-04 — OTs arranca en `'kanban'` sin intención.  
**Archivo:** `frontend/app/(dashboard)/production/orders/page.tsx`  
**Cambio:** `useState<string>("kanban")` → `useState<string>("list")`  
**Validación:** Navegar a `/production/orders` — debe mostrar lista por defecto. Kanban sigue accesible desde el selector.  
**Tamaño:** XS (1 línea)

---

### T-00B: Eliminar opción "Grilla" de `ProductList` hasta implementación

**Problema:** P-05 — selector con opción que no hace nada.  
**Archivo:** `frontend/features/inventory/components/ProductList.tsx`  
**Cambio:** Eliminar `{ label: "Grilla", value: "grid", icon: LayoutGrid }` de `viewOptions`. Eliminar import de `LayoutGrid` si queda huérfano.  
**Nota:** La grilla se implementa en Fase 3 (T-03C). Esta tarea evita confusión en producción hasta entonces.  
**Validación:** ProductList no muestra selector de vista (solo 1 opción → toolbar no muestra dropdown de vista).  
**Tamaño:** XS

---

## Fase 1 — `isLoading` en todas las instancias

**Objetivo:** Toda tabla con fetching asíncrono pasa `isLoading` al DataTable.  
**Impacto:** Activa el skeleton de "solo filas" en 42+ páginas.  
**Dependencias:** Ninguna (es additive, no breaking).

### T-01A: RRHH — agregar `isLoading`

**Archivos:**
- `hr/employees/page.tsx`
- `hr/payrolls/page.tsx`
- `hr/absences/page.tsx`
- `hr/advances/page.tsx`

**Patrón a seguir** (igual que `production/boms/page.tsx`):
```tsx
const [loading, setLoading] = useState(true)
// ...en fetchXxx():
setLoading(true)
try { ... } finally { setLoading(false) }

<DataTable ... isLoading={loading} />
```
**Validación:** Durante carga inicial se ven filas shimmer, no tabla vacía.

---

### T-01B: Inventario — agregar `isLoading`

**Archivos:**
- `inventory/WarehouseList.tsx`
- `inventory/UoMList.tsx`
- `inventory/UoMCategoryList.tsx`
- `inventory/CategoryList.tsx`
- `inventory/MovementList.tsx`
- `inventory/PricingRuleList.tsx`
- `inventory/AttributeManager.tsx`
- `inventory/StockReport.tsx`
- `inventory/SubscriptionsView.tsx`

**Nota:** Algunos usan TanStack Query (`isLoading` ya viene del hook). Verificar si el hook expone `isLoading` antes de añadir `useState` propio.

---

### T-01C: Contabilidad / Tesorería / Créditos — agregar `isLoading`

**Archivos:**
- `accounting/AccountsClientView.tsx`
- `accounting/EntriesClientView.tsx`
- `treasury/TreasuryMovementsClientView.tsx`
- `treasury/TreasuryAccountsView.tsx`
- `treasury/TerminalBatchesManagement.tsx`
- `treasury/MasterDataManagement.tsx` (×2 instancias)
- `credits/BlacklistView.tsx`
- `credits/PortfolioTable.tsx`

---

### T-01D: Otros módulos — agregar `isLoading`

**Archivos:**
- `contacts/ContactsClientView.tsx`
- `sales/POSSessionsView.tsx`
- `settings/GroupManagement.tsx`
- `settings/UsersSettingsView.tsx`
- `settings/HRSettingsView.tsx`
- `settings/partners/ProfitDistributionsTab.tsx`
- `settings/partners/PartnerLedgerTab.tsx`
- `settings/partners/EquityCompositionTab.tsx`
- `finance/BudgetsListView.tsx`
- `finance/bank-reconciliation/ReconciliationPanel.tsx`
- `finance/bank-reconciliation/StatementsList.tsx`
- `finance/bank-reconciliation/DashboardPendingTable.tsx`
- `settings/audit/page.tsx`

---

### T-01E: Multi-vista con card custom — `isLoading` + `renderLoadingView`

**Problema:** P-06 — cuando `renderCustomView` está activo, `isLoading=true` no muestra skeleton.

**Cambio en `DataTable`** (`components/ui/data-table.tsx`):
```tsx
// Añadir prop
renderLoadingView?: () => React.ReactNode

// En cardMode branch, línea ~261:
const tableBody = isLoading
    ? renderLoadingView
        ? renderLoadingView()  // custom skeleton
        : (/* TableRow con SharedTableSkeleton como hoy */)
    : renderCustomView ? null : (/* filas normales */)
```

**Archivos que usan `renderCustomView` y necesitan `renderLoadingView`:**
- `sales/SalesOrdersView.tsx` → `renderLoadingView={() => <CardSkeleton count={8} variant="compact" />}`
- `billing/SalesInvoicesClientView.tsx` → ídem
- `billing/PurchaseInvoicesClientView.tsx` → ídem
- `purchasing/PurchasingOrdersClientView.tsx` → ídem

---

## Fase 2 — Persistencia de vista con URL param

**Objetivo:** El modo de vista activo survives navegación atrás/adelante y es bookmarkeable.  
**Decisión:** URL param `?view=<value>` (sin hook wrapper, patrón directo con Next.js).  
**Dependencia:** Ninguna. Se puede hacer en paralelo con Fase 1.

### T-02A: Implementar patrón URL param en vistas conmutables

**Archivos a migrar** (reemplazar `useState` ephemeral por URL param):

```tsx
// ANTES
const [currentView, setCurrentView] = useState<'list' | 'card'>('list')

// DESPUÉS
const searchParams = useSearchParams()
const router = useRouter()
const pathname = usePathname()

const currentView = (searchParams.get('view') ?? 'list') as 'list' | 'card'
const setCurrentView = (v: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', v)
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
}
```

**Archivos:**
- `sales/SalesOrdersView.tsx` (default: `'card'`)
- `billing/SalesInvoicesClientView.tsx` (default: `'list'`)
- `billing/PurchaseInvoicesClientView.tsx` (default: `'list'`)
- `purchasing/PurchasingOrdersClientView.tsx` (default: `'list'`)
- `production/orders/page.tsx` (default: `'list'` — post T-00A)

**Nota sobre colisión de params:** Estas páginas ya usan `?selected=`, `?modal=` y `?view=` deberá coexistir sin borrar los otros. El patrón `new URLSearchParams(searchParams.toString())` ya lo maneja.

---

### T-02B: Actualizar `component-skeleton.md` — sección DataTable

**Archivo:** `docs/20-contracts/component-skeleton.md`

Añadir sección al final:

```markdown
## Estrategia 4: DataTable con `isLoading` (embedded tables)

Para tablas que usan `DataTable` con `variant="embedded"` (o `cardMode` antes del refactor):

- Pasar siempre `isLoading` cuando el fetch es asíncrono
- El DataTable sustituye solo las filas por `SharedTableSkeleton`
- Toolbar, encabezados y paginación permanecen visibles (sin CLS)
- Si la tabla usa `renderCustomView`, pasar también `renderLoadingView`
```

---

## Fase 3 — Prop `variant` + migración de `cardMode` ✅

**Objetivo:** Reemplazar `cardMode: boolean` por `variant: 'standalone' | 'embedded'`.  
**Dependencia:** Fases 0-2 completadas (asegura que todos los usos están auditados y estabilizados antes de hacer el cambio breaking).

### T-03A: Modificar `DataTable` — añadir prop `variant`

**Archivo:** `frontend/components/ui/data-table.tsx`

```tsx
// Añadir prop (manteniendo cardMode como deprecated alias)
variant?: 'standalone' | 'embedded'
/** @deprecated Use variant="embedded" instead */
cardMode?: boolean

// Resolver internamente:
const isEmbedded = variant === 'embedded' || (variant === undefined && cardMode === true)
```

Esto permite migración incremental: el código existente con `cardMode` sigue funcionando durante la transición.

---

### T-03B: Migrar todas las instancias a `variant`

**42 instancias** `cardMode` → `variant="embedded"`  
**3 instancias** `cardMode={false}` → `variant="standalone"`  

Ejecutar búsqueda global y reemplazar:
```
cardMode={true}  → variant="embedded"
cardMode         → variant="embedded"
cardMode={false} → variant="standalone"
```

Tras migración completa, marcar `cardMode` como `@deprecated` en el tipo (no eliminar aún — esperar 1 sprint para asegurar no hay regresiones).

---

### T-03C: Implementar vista grid de `ProductList` con `EntityCard`

**Prerequisito:** T-04A (EntityCard base disponible).  
**Archivo:** `frontend/features/inventory/components/ProductList.tsx`

Restaurar opción "Grilla" en `viewOptions` e implementar `renderCustomView` para `view === 'grid'`:
```tsx
renderCustomView={currentView === 'grid' ? (table) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-2">
        {table.getRowModel().rows.map(row => (
            <EntityCard key={row.id} variant="product" data={row.original} />
        ))}
    </div>
) : undefined}
```

---

## Fase 4 — `EntityCard` base y unificación de card views

**Objetivo:** Extraer shell de card compartida. Reemplazar los 5 inline JSX custom.  
**Dependencia:** Fases 1-2 completadas (las páginas deben estar estabilizadas antes de refactorizar su render).

### T-04A: Crear `EntityCard` base ✅

**Archivo nuevo:** `frontend/components/shared/EntityCard.tsx`

Estructura:
```tsx
interface EntityCardProps {
    variant?: 'compact' | 'full'
    isSelected?: boolean
    onClick?: () => void
    className?: string
    children: React.ReactNode
}

// Sub-componentes co-localizados:
EntityCard.Header    // Badge de estado + identificador principal
EntityCard.Body      // Campos clave (grid 2 cols)
EntityCard.Footer    // Acciones (botones/links)
EntityCard.Field     // Campo individual: label + value
```

**Exportar** desde `@/components/shared` barrel.

**Diseño:** Consistente con el design system (border-border/40, rounded-lg, shadow-sm, hover:bg-muted/30, transition-all). Variante `compact` para grillas densas (sin footer, padding reducido).

---

### T-04B: Migrar `SalesInvoicesClientView` inline card → `EntityCard`

**Archivo:** `frontend/features/billing/components/SalesInvoicesClientView.tsx`  
**Cambio:** Reemplazar el JSX inline del `renderCustomView` card por composición con `EntityCard`.

---

### T-04C: Migrar `PurchaseInvoicesClientView` inline card → `EntityCard`

**Archivo:** `frontend/features/billing/components/PurchaseInvoicesClientView.tsx`

---

### ✓ T-04D: Migrar `PurchasingOrdersClientView` inline card → `EntityCard`

**Archivo:** `frontend/app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx`

---

### ✓ T-04E: Migrar `TaxDeclarationsView` inline card → `EntityCard`

**Archivo:** `frontend/features/tax/components/TaxDeclarationsView.tsx`

---

### ✓ T-04F: Migrar `PortfolioTable` / `BlacklistView` inline → `EntityCard` / `ExpandableTableRow`

**Archivos:**
- `frontend/features/credits/components/PortfolioTable.tsx`
- `frontend/features/credits/components/BlacklistView.tsx`

---

## Fase 5 — Formalización de contratos

**Objetivo:** Prevenir divergencias futuras. Esta fase cierra el ciclo del refactor.  
**Dependencia:** Fases 3-4 completadas (los contratos deben describir el estado real, no el objetivo).

### ✓ T-05A: Crear contrato `component-datatable-views.md`

**Archivo:** `docs/20-contracts/component-datatable-views.md`

Contenido mínimo:
- Prop `variant` — cuándo usar `'embedded'` vs `'standalone'`
- Prop `isLoading` — obligatorio cuando hay fetching asíncrono (regla de PR)
- Sistema de vistas: valores canónicos (`'list'`, `'card'`, `'grid'`, `'kanban'`), con descripción
- Regla: si se declara opción distinta de `'list'` en `viewOptions`, **debe existir** `renderCustomView` para ella
- Regla de persistencia: usar URL param `?view=<value>` con `useSearchParams` + `router.push`
- Prop `renderLoadingView`: cuándo es obligatorio
- Vista default: definida en código por página, no configurable por usuario
- `EntityCard`: cuándo usar vs `OrderCard` (domain-specific) vs card inline (prohibido)

---

### ✓ T-05B: Actualizar `component-skeleton.md`

Ya cubierto en T-02B. Verificar que la sección añadida es coherente con el estado final.

---

### ✓ T-05C: Actualizar `component-contracts.md`

**Archivo:** `docs/20-contracts/component-contracts.md`

Añadir sección `DataTable` con referencia a `component-datatable-views.md` y la API de alto nivel (props más usados, cuándo `variant`, cuándo `renderCustomView`).

---

### ✓ T-05D: Actualizar `docs/README.md` — routing table

Añadir entrada:

```markdown
| "DataTable", "view mode", "card view", "kanban view", "view switching" | component-datatable-views.md | 20 |
```

---

### ✓ T-05E: Marcar `cardMode` como eliminado (cleanup final)

**Prerequisito:** T-03B completado + 1 sprint de margen.  
**Archivo:** `frontend/components/ui/data-table.tsx`

Eliminar prop `cardMode` del tipo. Actualizar la lógica interna para usar solo `variant`. El compilador TS señalará cualquier uso restante.

---

## Resumen y priorización

| Fase | Tareas | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|
| **0 — Bugs urgentes** | T-00A, T-00B | Alto | XS | 🔴 Inmediato |
| **1 — `isLoading`** | T-01A…E | Alto | M | 🔴 Sprint actual |
| **2 — URL param** | T-02A, T-02B | Medio | S | 🟡 Sprint actual |
| **3 — `variant` prop** | T-03A, T-03B, T-03C | Medio | M | 🟡 Próximo sprint |
| **4 — `EntityCard`** | T-04A…F | Medio | L | 🟢 Próximo sprint / backlog |
| **5 — Contratos** | T-05A…E | — | S | 🟡 Paralelo a Fases 3-4 |

**Regla de cierre:** Ninguna tarea de Fase N puede cerrarse sin que la tarea de contrato correspondiente esté merged. Los contratos no son opcionales.

---

## Checklist de PR para este refactor

Cada PR que toque `DataTable` o sus consumidores debe verificar:

- [x] `variant` usado en lugar de `cardMode`
- [x] `isLoading` pasado si el componente hace fetch
- [x] Si hay `viewOptions` con algo distinto de `'list'`: `renderCustomView` presente para esa opción
- [x] Si hay `renderCustomView` y `isLoading`: `renderLoadingView` presente
- [ ] Persistencia de vista usa URL param (`?view=`), no `useState`
- [ ] Default de vista definido en código (no hardcoded `'kanban'` salvo decisión explícita)
- [ ] Card views usan `EntityCard` — no inline JSX
