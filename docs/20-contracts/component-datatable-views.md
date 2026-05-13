---
layer: 20-contracts
doc: component-datatable-views
status: active
owner: frontend-team
created: 2026-05-12
last_review: 2026-05-12
depends_on:
  - component-contracts.md
  - component-skeleton.md
---

# Contrato: DataTable — Sistema de Vistas e Interacciones

Este documento describe las reglas de arquitectura para el ecosistema `DataTable`, incluyendo variantes, vistas, persistencia y primitivas de card. Toda implementación nueva que toque `DataTable` o sus consumidores debe pasar el [checklist al final de este documento](#checklist-de-pr).

---

## 1. Prop `variant` — Modo de renderizado

El `DataTable` opera en dos modos excluyentes:

| Valor | Cuándo usar |
|---|---|
| `"standalone"` | Tabla autónoma en página propia (ejm: `/inventory/products`). Incluye borde contenedor, header visible, padding externo. |
| `"embedded"` | Tabla incrustada dentro de un card, modal o panel (ejm: líneas de una orden, historial en `ContactModal`). Sin borde externo; comparte el espacio visual con el contenedor padre. |

**Regla:** Siempre declarar `variant` explícitamente. La prop `cardMode` está deprecada y no debe usarse en código nuevo.

```tsx
// ✅ Correcto
<DataTable variant="embedded" ... />

// ❌ Deprecado
<DataTable cardMode={true} ... />
```

---

## 2. Prop `isLoading` — Skeleton obligatorio

**Regla:** Toda tabla que realice fetching asíncrono **debe** pasar `isLoading`. Sin él, el usuario ve una tabla vacía durante la carga inicial (mala UX, sin skeleton).

```tsx
const { data, isLoading } = useMyData()
<DataTable isLoading={isLoading} data={data} ... />
```

Cuando `isLoading` es `true`, el DataTable sustituye el body de la tabla por `SharedTableSkeleton` (filas shimmer). El toolbar, encabezados y paginación permanecen visibles para evitar CLS.

> **Excepción:** Si la tabla usa `renderCustomView`, el skeleton automático **no aplica** dentro de la vista custom. Ver sección 4 (`renderLoadingView`).

---

## 3. Sistema de vistas — Valores canónicos

Las vistas disponibles en el sistema son:

| Valor | Descripción | Componente de renderizado |
|---|---|---|
| `"list"` | Tabla estándar (default en la mayoría de módulos) | Motor interno de DataTable |
| `"card"` | Vista de tarjetas en lista vertical | `renderCustomView` + `EntityCard` / `OrderCard` / `InvoiceCard` |
| `"grid"` | Grilla densa en múltiples columnas (ejm: Productos) | `renderCustomView` + `EntityCard variant="compact"` |
| `"kanban"` | Tablero Kanban (Producción) | `renderCustomView` + componente específico de dominio |

**Regla de consistencia:** Si se declara una opción diferente de `"list"` en `viewOptions`, **debe existir** `renderCustomView` que maneje esa vista.

```tsx
// ✅ Correcto: la opción 'grid' tiene su renderCustomView
viewOptions={[
  { label: "Lista", value: "list", icon: List },
  { label: "Grilla", value: "grid", icon: LayoutGrid },
]}
renderCustomView={view === 'grid' ? (table) => (
  <div className="grid grid-cols-3 gap-3">
    {table.getRowModel().rows.map(row => <EntityCard ... />)}
  </div>
) : undefined}

// ❌ Incorrecto: opción declarada pero sin render
viewOptions={[{ label: "Grilla", value: "grid" }]}
// renderCustomView ausente
```

---

## 4. Prop `renderLoadingView` — Skeleton en vistas custom

Cuando una tabla usa `renderCustomView`, el skeleton automático de `isLoading` **no se activa** dentro de la vista custom (el DataTable no puede inferir qué skeleton mostrar en un renderizado arbitrario).

**Regla:** Si una tabla tiene `renderCustomView` Y hace fetching asíncrono, también debe pasar `renderLoadingView`.

```tsx
renderCustomView={(table) => (
  <div className="grid gap-3">
    {table.getRowModel().rows.map(row => <EntityCard ... />)}
  </div>
)}
renderLoadingView={() => <CardSkeleton count={8} variant="compact" />}
```

---

## 5. Persistencia de vista — URL param `?view=`

La vista activa debe sobrevivir a la navegación atrás/adelante y ser bookmarkeable. El mecanismo estándar es el URL param `?view=<valor>`.

**Patrón canónico:**

```tsx
const searchParams = useSearchParams()
const router = useRouter()
const pathname = usePathname()

// Leer desde URL (con fallback al default de la página)
const currentView = (searchParams.get('view') ?? 'list') as 'list' | 'card'

// Escribir a URL sin scroll jump
const handleViewChange = (v: string) => {
  const params = new URLSearchParams(searchParams.toString())
  params.set('view', v)
  router.push(`${pathname}?${params.toString()}`, { scroll: false })
}
```

> **Nota de coexistencia:** El patrón `new URLSearchParams(searchParams.toString())` preserva todos los params existentes (`?selected=`, `?modal=`, etc.) al agregar `?view=`.

**Regla:** Nunca usar `useState` local para la vista activa. El estado efímero provoca que la vista se pierda al navegar atrás.

---

## 6. Primitivas de card — Cuándo usar cada una

### `EntityCard` — Shell estándar (preferido)
Primitiva genérica del design system. Usar cuando:
- Se necesita una tarjeta en una vista de grilla densa (ProductList en modo grid)
- La tarjeta no requiere lógica de dominio específica (hub, status complejo)
- Se construye un módulo nuevo

```tsx
import { EntityCard } from "@/components/shared/EntityCard"

<EntityCard onClick={handleClick} isSelected={isSelected}>
  <EntityCard.Header title="..." subtitle="..." trailing={<Badge />} />
  <EntityCard.Body>
    <EntityCard.Field label="Cliente" value="Acme SpA" />
    <EntityCard.Field label="Total" value="$12.000" />
  </EntityCard.Body>
  <EntityCard.Footer>
    <Button size="sm">Acción</Button>
  </EntityCard.Footer>
</EntityCard>
```

### `OrderCard` — Card de dominio para Órdenes
Usa `EntityCard` como shell. Renderiza lógica de hub (selección, de-énfasis), `OrderHubStatus`, `PurchaseOrderHubStatus`, `NoteHubStatus`, y líneas de producto. Usar en:
- `SalesOrdersView` (Ventas)
- `PurchasingOrdersClientView` (Compras)
- `ContactModal` → InsightsTable y CreditLedgerTable

### `InvoiceCard` — Card de dominio para Facturas
Usa `EntityCard` como shell. Renderiza `InvoiceHubStatus`, vínculos a documentos relacionados (notas/ajustes), y monto pendiente. Usar en:
- `SalesInvoicesClientView`
- `PurchaseInvoicesClientView`

### ❌ Inline JSX en `renderCustomView` — Prohibido
No construir tarjetas con JSX inline dentro de `renderCustomView`. Todo card debe ser una composición de `EntityCard` o un componente de dominio derivado de él.

```tsx
// ❌ Prohibido: JSX inline complejo dentro de renderCustomView
renderCustomView={(table) => (
  <div className="grid gap-3">
    {rows.map(row => (
      <div className="flex p-4 border rounded-lg ...">
        <h4>...</h4>
        ...muchas líneas de JSX...
      </div>
    ))}
  </div>
)}

// ✅ Correcto: composición con EntityCard o componente de dominio
renderCustomView={(table) => (
  <div className="grid gap-3">
    {rows.map(row => <MyDomainCard key={row.id} item={row.original} />)}
  </div>
)}
```

---

## 7. Vista default — Definida por módulo

Cada página define su vista default en código. No existe una configuración global de vista por usuario.

| Módulo | Vista default |
|---|---|
| `SalesOrdersView` | `"card"` |
| `PurchasingOrdersClientView` | `"card"` |
| `SalesInvoicesClientView` | `"card"` |
| `PurchaseInvoicesClientView` | `"card"` |
| `ProductList` | `"table"` |
| `production/orders` | `"list"` |
| `TaxDeclarationsView` | siempre card (sin selector) |
| `PortfolioTable`, `BlacklistView` | siempre tabla expandible (sin selector) |

---

## 8. Guía de migración — `cardMode` → `variant`

Si encuentras código con `cardMode`:

```bash
# Buscar usos residuales
grep -r "cardMode" frontend/
```

Reemplazar mecánicamente:
- `cardMode={true}` → `variant="embedded"`
- `cardMode` (sin valor) → `variant="embedded"`
- `cardMode={false}` → `variant="standalone"`

---

## 9. Variante `ExpandableTableRow` — Filas con detalle inline

Algunos módulos requieren mostrar detalle contextual de una fila **dentro de la misma tabla**, sin abrir un modal ni navegar. Para eso existe la primitiva `ExpandableTableRow`.

**Cuándo usar:**
- La entidad tiene datos de detalle que el usuario necesita con frecuencia pero no justifican una página propia
- El volumen de datos es alto y abrir un modal por cada fila sería costoso
- El contenido expandible incluye listas secundarias (historial de documentos, ledger de créditos)

**Cuándo NO usar:**
- Si el detalle requiere edición → usar modal (`BaseModal`)
- Si el detalle es la vista principal de la entidad → usar navegación a página de detalle
- Si la tabla tiene vista alternativa (`card`/`grid`) — `ExpandableTableRow` es solo para vista `list`

**Implementaciones canónicas:**
- `ExpandableContactRow` en `PortfolioTable` (créditos vigentes)
- `ExpandableBlacklistRow` en `BlacklistView` (incobrables/bloqueados)

**API:**

```tsx
import { ExpandableTableRow } from "@/components/shared"

<ExpandableTableRow
    row={row}                          // Row<TData> de TanStack
    onExpand={(isExpanding) => {...}}  // Lazy fetch en primera apertura
    cellClassName="py-3 px-4"          // Clase para cada TableCell de datos
    panelClassName="px-8 py-4 bg-background" // Clase para el div wrapper del panel
>
    {/* Contenido del panel expandido — renderizado SOLO cuando está abierto */}
    {loadingDetail ? <TableSkeleton rows={2} /> : <MyDetailPanel data={detail} />}
</ExpandableTableRow>
```

La primitiva gestiona internamente:
- Estado `expanded` (uncontrolled)
- Renderizado del chevron (Cell adicional al final de la fila)
- `AnimatePresence` + `motion.div` con `height: 0 → auto`
- `data-state="selected"` en el `TableRow` principal

El consumidor gestiona:
- Fetch lazy de datos de detalle mediante `onExpand(isExpanding: boolean)`
- Estado local del detalle (`useState<MyDetail[] | null>(null)`)
- Contenido del panel (dominio específico)

**Regla:** La columna de chevron es **invisible en la definición de columnas** de TanStack. `ExpandableTableRow` la agrega automáticamente. El `colSpan` del panel se calcula como `getVisibleCells().length + 1`. Si se usa `renderCustomView` con `ExpandableTableRow`, añadir una columna vacía `<th />` al header manual para que el layout sea consistente.

---

## Checklist de PR

Cada PR que toque `DataTable` o sus consumidores debe verificar:

- [ ] `variant` declarado explícitamente (`"embedded"` o `"standalone"`)
- [ ] `cardMode` **no** usado — solo `variant`
- [ ] `isLoading` pasado si el componente hace fetch asíncrono
- [ ] Si hay `viewOptions` con algo distinto de `"list"`: `renderCustomView` presente para esa opción
- [ ] Si hay `renderCustomView` y `isLoading`: `renderLoadingView` presente
- [ ] Persistencia de vista usa URL param (`?view=`) con `{ scroll: false }`, no `useState`
- [ ] Default de vista definido en código (evitar `'kanban'` hardcoded salvo decisión documentada)
- [ ] Card views usan `EntityCard` o un wrapper de dominio sobre él — **no inline JSX**
- [ ] Expandable rows usan `ExpandableTableRow` — **no** `AnimatePresence`/`motion.div` inline
