---
layer: 20-contracts
doc: module-layout-navigation
status: active
owner: frontend-team
stability: stable
last_review: 2026-05-08
---

# Contrato: Layout y Navegación Dinámica por Módulo

Este contrato define el patrón estándar para la estructura de carpetas, navegación de tabs/breadcrumbs y gestión de layouts en el **App Router de Next.js**. Reemplaza el antiguo patrón monolítico basado exclusivamente en `?view=`.

## 1. Estructura de Archivos del Módulo

Cada módulo en `app/(dashboard)/[module]/` DEBE seguir esta estructura:

```
[module]/
├── layout.tsx             # Server Component: Define el contenedor y el Header
├── [Module]Header.tsx     # Client Component: Lógica de tabs y breadcrumbs
├── page.tsx               # Server Component: Redireccionador de compatibilidad
└── [view]/
    └── page.tsx           # Server Component: Punto de entrada físico de la vista
```

## 2. El Componente Header (`[Module]Header.tsx`)

Es el cerebro de la navegación del módulo. Debe ser un **Client Component** que consuma el estado de la URL.

### Responsabilidades:
- **Detección de Segmentos**: Usar `usePathname()` para identificar en qué vista física se encuentra el usuario.
- **Mapeo de Tabs**: Transformar el segmento de la URL (ej. `/sales/terminals`) en el valor activo del tab (ej. `pos`).
- **Gestión de Breadcrumbs**: Configurar el objeto `navigation` para el `PageHeader` inyectando el `moduleName`.
- **Sub-tabs**: Manejar sub-navegación mediante el parámetro `?tab=`.

### Ejemplo de Contrato de Navegación:
```tsx
const navigation = {
    moduleName: "Ventas",
    moduleHref: "/sales",
    tabs: [...],
    activeValue: currentSegment,
    subActiveValue: searchParams.get('tab')
}
```

## 3. El Layout del Módulo (`layout.tsx`)

Debe ser un **Server Component** para asegurar la eficiencia del renderizado y el SEO.

### Reglas:
- Debe envolver a los `children` en el componente técnico `<PageContainer />` (reemplaza al antiguo `LAYOUT_TOKENS.view`).
- Debe inyectar el componente `[Module]Header` en la parte superior.
- No debe manejar lógica de negocio, solo estructura visual.

## 4. El Redireccionador de Raíz (`page.tsx`)

Para mantener la compatibilidad con enlaces antiguos (Legacy), la página raíz del módulo debe procesar los antiguos `searchParams`.

```tsx
export default async function ModulePage({ searchParams }) {
    const { view, sub } = await searchParams;
    if (view === 'orders') redirect('/module/orders');
    // ... otros mapeos
    redirect('/module/default-view');
}
```

## 5. Contrato de las Vistas Hijas (`[view]/page.tsx`)

Las páginas dentro de los directorios de vista (sub-carpetas) tienen un contrato simplificado:

1. **Sin Chrome Propio**: NO deben renderizar `PageHeader`, `Breadcrumbs` ni el wrapper de `LAYOUT_TOKENS.view` (ya provistos por el layout).
2. **Acciones de Toolbar**: Si la vista requiere un botón de creación (ej. "Nuevo Cliente"), debe renderizar el componente `<ToolbarCreateButton />` y, si es necesario, pasarlo como prop `createAction` al componente de feature.
3. **Independencia**: La página es responsable de cargar sus propios datos (o usar Suspense) y manejar sus propios modales mediante `searchParams` (ej. `?modal=new`).

---

## 6. Beneficios del Patrón
- **URLs Semánticas**: `/sales/orders` en lugar de `/sales?view=orders`.
- **Persistencia Visual**: El Header no se re-renderiza al navegar entre sub-vistas del mismo módulo.
- **Desacople**: Las vistas se enfocan en los datos y el contenido, no en la navegación global.

---

## 7. Searchable Entity Detail Route

> **Origen:** ADR-0019 (2026-05-08). **Depende de:** F7 — Detail routes para Universal Search.  
> Ver audit: [F7-route-matrix.md](../../docs/50-audit/Arquitectura%20Django/F7-route-matrix.md)

### 7.1 Convención de ruta

Toda entidad registrada en el `UniversalRegistry` DEBE tener una ruta accesible en:

```
/[module]/[entity-plural]/[id]
```

Donde:
- `[module]` es el segmento en **inglés** del módulo frontend (tabla §7.2).
- `[entity-plural]` es el **plural canónico en inglés** de la entidad (tabla §7.3).
- `[id]` es el segmento dinámico de Next.js App Router (`[id]/page.tsx`).

La página `[id]/page.tsx` es un **Server Component** que:
1. Fetch de la entidad vía API.
2. Valida permiso `view_*` — devuelve 403 si no autorizado.
3. Llama `notFound()` si el id no existe.
4. Renderiza `<EntityDetailPage>` con el form/editor existente como `children`.

### 7.2 Tabla app → módulo frontend

| Django app | Segmento frontend | Notas |
|------------|------------------|-------|
| `sales` | `/sales` | |
| `purchasing` | `/purchasing` | |
| `billing` | `/billing` | Split: `/billing/sales` (ventas) + `/billing/purchases` (compras) |
| `contacts` | `/contacts` | |
| `accounting` | `/accounting` | Excepción: `Budget` vive en `/finances` (decisión UX preexistente) |
| `inventory` | `/inventory` | |
| `treasury` | `/treasury` | |
| `hr` | `/hr` | |
| `production` | `/production` | |
| `tax` | `/tax` | Módulo nuevo — carpeta no existía antes de F7 |
| `workflow` | `/workflow` | Módulo nuevo — carpeta no existía antes de F7 |
| `core` (User) | `/settings` | Users viven bajo Settings |
| `core` (Attachment) | `/files` | Módulo nuevo |

### 7.3 Tabla de patrones canónicos (26 entidades)

| app.model | `list_url` | `detail_url_pattern` | `[id]` existe | read-only |
|-----------|------------|----------------------|---------------|-----------|
| `sales.saleorder` | `/sales/orders` | `/sales/orders/{id}` | ❌ (T-72) | No |
| `sales.saledelivery` | `/sales/deliveries` | `/sales/deliveries/{id}` | ❌ (T-72) | No |
| `sales.salereturn` | `/sales/returns` | `/sales/returns/{id}` | ❌ (T-72) | No |
| `purchasing.purchaseorder` | `/purchasing/orders` | `/purchasing/orders/{id}` | ❌ (T-73) | No |
| `billing.invoice` | `/billing/sales` | `/billing/sales/{id}` o `/billing/purchases/{id}` | ❌ (T-73) | No |
| `contacts.contact` | `/contacts` | `/contacts/{id}` | ❌ (T-77) | No |
| `accounting.account` | `/accounting/accounts` | `/accounting/accounts/{id}` | ❌ (T-75) | Parcial |
| `accounting.journalentry` | `/accounting/entries` | `/accounting/entries/{id}` | ❌ (T-75) | No |
| `accounting.fiscalyear` | `/accounting/closures` | `/accounting/closures/{id}` | ❌ (T-75) | No |
| `accounting.budget` | `/finances/budgets` | `/finances/budgets/{id}` | ✅ | No |
| `inventory.product` | `/inventory/products` | `/inventory/products/{id}` | ❌ (T-74) | No |
| `inventory.productcategory` | `/inventory/categories` | `/inventory/categories/{id}` | ❌ (T-74) | No |
| `inventory.warehouse` | `/inventory/warehouses` | `/inventory/warehouses/{id}` | ❌ (T-74) | No |
| `inventory.stockmove` | `/inventory/stock-moves` | `/inventory/stock-moves/{id}` | ❌ (T-74) | **Sí** |
| `treasury.treasurymovement` | `/treasury/movements` | `/treasury/movements/{id}` | ❌ (T-76) | No |
| `treasury.treasuryaccount` | `/treasury/accounts` | `/treasury/accounts/{id}` | ❌ (T-76) | No |
| `treasury.possession` | `/treasury/sessions` | `/treasury/sessions/{id}` | ❌ (T-76) | **Sí** (cerrada) |
| `treasury.bankstatement` | `/treasury/statements` | `/treasury/statements/{id}` | ❌ (T-76) | **Sí** |
| `hr.employee` | `/hr/employees` | `/hr/employees/{id}` | ❌ (T-77) | No |
| `hr.payroll` | `/hr/payrolls` | `/hr/payrolls/{id}` | ✅ | No |
| `production.workorder` | `/production/orders` | `/production/orders/{id}` | ❌ (T-77) | No |
| `tax.f29declaration` | `/tax/f29` | `/tax/f29/{id}` | ❌ (T-77) | No |
| `tax.accountingperiod` | `/tax/periods` | `/tax/periods/{id}` | ❌ (T-77) | No |
| `workflow.task` | `/workflow/tasks` | `/workflow/tasks/{id}` | ❌ (T-77) | No |
| `core.user` | `/settings/users` | `/settings/users/{id}` | ❌ (T-77) | No |
| `core.attachment` | `/files` | `/files/{id}` | ❌ (T-77) | **Sí** |

### 7.4 Shell `EntityDetailPage`

**Archivo:** `frontend/components/shared/EntityDetailPage.tsx` (T-71)

```tsx
<EntityDetailPage
  entityType="sale_order"        // para ActivitySidebar
  title="Nota de Venta"
  displayId="NV-001"
  icon="receipt-text"
  breadcrumb={[{ label: 'Ventas', href: '/sales' }, { label: 'Órdenes', href: '/sales/orders' }]}
  actions={[...]}               // opcional — botones en footer
  sidebar={<ActivitySidebar />} // opcional — default activo si instanceId presente
  readonly={false}              // opcional — ver §7.5
>
  {/* form/editor existente sin modificar */}
  <SaleOrderForm initialData={order} />
</EntityDetailPage>
```

**Layout:**
```
┌─────────────────────────────────────────────┐
│ [icon] displayId · title     [breadcrumb]   │  ← header sticky
├──────────────────────────┬──────────────────┤
│                          │                  │
│     children (form)      │  ActivitySidebar │  ← main flex
│                          │  hidden lg:flex  │
│                          │  w-72 border-l   │
├──────────────────────────┴──────────────────┤
│  [danger action]        [cancel] [submit]   │  ← footer opcional
└─────────────────────────────────────────────┘
```

**Props:**

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `entityType` | `string` | ✅ | Registra el tipo para `ActivitySidebar` |
| `title` | `string` | ✅ | Nombre de la entidad en el header |
| `displayId` | `string` | No | Identificador visible (ej. `NV-001`) |
| `icon` | `string` | ✅ | Nombre de icono Lucide |
| `breadcrumb` | `BreadcrumbItem[]` | ✅ | Items: `{ label, href }` |
| `actions` | `ActionItem[]` | No | Botones extra en el footer |
| `sidebar` | `ReactNode` | No | Default: `<ActivitySidebar>` si `instanceId` presente |
| `readonly` | `boolean` | No | Activa modo lectura — ver §7.5 |
| `children` | `ReactNode` | ✅ | Form o contenido principal |

### 7.5 Modo `readonly`

Usado cuando la entidad no tiene formulario de edición (`StockMove`, `BankStatement`, `POSSession` cerrada, `Attachment`).

Cuando `readonly={true}`:
- El slot `children` renderiza una vista de detalle (no un form). Recomendado: `<dl>` semántico o tabla de detalle.
- No se renderiza `FormFooter` con acciones de edición.
- El header mantiene el icono + displayId + breadcrumb.
- El `ActivitySidebar` sigue presente si la entidad tiene historial.

### 7.6 Reglas de implementación

1. **La page `[id]/page.tsx` es siempre Server Component.** Nunca Client Component.
2. **No modificar el form/editor existente** al montarlo en `EntityDetailPage` — solo envolver.
3. **Redirect desde `?selected=id`** (patrón legacy): la página lista detecta el param y redirige a `/<module>/<entity>/[id]` durante la ventana de migración.
4. **`apps.py::ready()`** debe ser actualizado (T-78) con `list_url` y `detail_url_pattern` en inglés una vez que la ruta `[id]` exista.
5. **Test Playwright obligatorio** (T-79): cada ruta `[id]` debe pasar sin 404 ni 500 con un fixture de datos.

### 7.7 Cross-references

- Decision tree para forms: [component-decision-tree.md §5](./component-decision-tree.md)
- Shell `FormSplitLayout` + `ActivitySidebar`: [form-layout-architecture.md §5-6](./form-layout-architecture.md)
- Playbook para nueva entidad con ruta `[id]`: [add-feature.md §6](../30-playbooks/add-feature.md)
- ADR de la convención: [ADR-0019](../10-architecture/adr/0019-entity-detail-route-convention.md)
- Matriz de gap: [F7-route-matrix.md](../../docs/50-audit/Arquitectura%20Django/F7-route-matrix.md)
