---
layer: 20-contracts
doc: entity-identity
status: active
owner: frontend-team
last_review: 2026-05-10
stability: contract-changes-require-ADR
---

# Entity Identity Contract

Sistema centralizado de identidad de entidades ERP. Define el **único lugar** donde se registran prefijos de documentos, íconos, títulos y rutas para todas las entidades del sistema.

> **Regla cardinal**: Ningún módulo puede definir prefijos, íconos o títulos de entidades de forma ad-hoc. Todo debe fluir desde `ENTITY_REGISTRY`.

---

## Tabla de contenidos

1. [ENTITY\_REGISTRY](#1-entity_registry)
2. [Funciones helpers del registry](#2-funciones-helpers)
3. [DynamicIcon](#3-dynamicicon)
4. [EntityBadge](#4-entitybadge)
5. [EntityHeader](#5-entityheader)
6. [EntityDetailPage](#6-entitydetailpage)
7. [DataCell.DocumentId](#7-datacelldocumentid)
8. [PageHeader — integración con iconos](#8-pageheader--integración-con-iconos)
9. [Tabla maestra de prefijos](#9-tabla-maestra-de-prefijos)
10. [Reglas de cumplimiento y prohibiciones](#10-reglas-de-cumplimiento)

---

## 1. ENTITY\_REGISTRY

**Archivo**: `frontend/lib/entity-registry.ts`

Objeto central `Record<string, EntityMetadata>` que contiene **toda** la identidad visual y de navegación de las entidades ERP. Es la única fuente de verdad para prefijos, íconos y URLs.

### Interfaz `EntityMetadata`

```typescript
export interface EntityMetadata {
  label: string;           // Clave Django app.Model (e.g. 'sales.saleorder')
  title: string;           // Nombre singular (e.g. 'Nota de Venta')
  titlePlural: string;     // Nombre plural (e.g. 'Notas de Venta')
  icon: LucideIcon;        // Ícono Lucide importado directamente (tree-shakeable)
  shortTemplate: string;   // Patrón de identificador corto (e.g. 'NV-{number}')
  listUrl: string;         // URL de la vista de lista
  detailUrlPattern: string; // Patrón de URL de detalle (e.g. '/sales/orders/{id}')
}
```

### `shortTemplate` — sintaxis de plantillas

El campo `shortTemplate` soporta:

| Sintaxis | Ejemplo | Resultado |
|----------|---------|-----------|
| `{field}` | `NV-{number}` | `NV-42` |
| `{nested.field}` | `{customer.name}` | `Acme Corp` |
| `{field:06d}` | `{number:06d}` | `000042` (zero-padding) |

El campo plano más común es `number` (número de secuencia del documento). Para entidades sin número de secuencia se usa `id`.

### Agregar una nueva entidad

```typescript
// frontend/lib/entity-registry.ts
import { MyIcon } from 'lucide-react';

'myapp.mymodel': {
  label: 'myapp.mymodel',
  title: 'Mi Entidad',
  titlePlural: 'Mis Entidades',
  icon: MyIcon,
  shortTemplate: 'ENT-{number}',
  listUrl: '/myapp/entities',
  detailUrlPattern: '/myapp/entities/{id}',
},
```

> **⚠️ Después de agregar**: actualizar también `detectEntityLabel()` (ver §2) y el backend `AppConfig.ready()` si la entidad es buscable.

---

## 2. Funciones helpers

Todas exportadas desde `@/lib/entity-registry`.

### `getEntityMetadata(label: string): EntityMetadata | undefined`

Retorna la metadata completa de una entidad. Retorna `undefined` si la clave no existe — el caller debe manejar el caso nulo.

```typescript
const meta = getEntityMetadata('sales.saleorder');
// { title: 'Nota de Venta', icon: ReceiptText, shortTemplate: 'NV-{number}', ... }
```

### `formatEntityDisplay(label: string, data: any): string`

Aplica el `shortTemplate` del registro a un objeto `data`. Soporta dot notation y zero-padding.

```typescript
formatEntityDisplay('sales.saleorder', { number: 42 });
// → 'NV-42'

formatEntityDisplay('purchasing.purchaseorder', { number: 7 });
// → 'OCS-7'
```

### `getEntityIcon(label: string): LucideIcon`

Retorna el ícono Lucide de la entidad. Fallback: `Package`.

```typescript
const Icon = getEntityIcon('production.workorder'); // → Wrench
```

### `detectEntityLabel(text: string): string | null`

Detecta el label del registry a partir de un string (útil para notificaciones, tareas, búsqueda). Reconoce prefijos canónicos como `OCS-`, `NV-`, `OT-`, etc.

```typescript
detectEntityLabel('OCS-123');  // → 'purchasing.purchaseorder'
detectEntityLabel('NV-007');   // → 'sales.saleorder'
detectEntityLabel('random');   // → null
```

---

## 3. DynamicIcon

**Archivo**: `frontend/components/ui/dynamic-icon.tsx`  
**Import**: `import { DynamicIcon } from '@/components/ui/dynamic-icon'`

Carga íconos Lucide por **nombre como string** usando `next/dynamic`. Ideal para configuraciones serializadas (sidebar, tabs, menú de navegación) donde no se puede importar el ícono directamente.

> **No usar** `DynamicIcon` cuando el ícono puede importarse estáticamente. En esos casos preferir el ícono directo desde `ENTITY_REGISTRY` via `getEntityIcon()`.

```tsx
<DynamicIcon name="ShoppingCart" className="h-4 w-4" />
<DynamicIcon name="receipt-text" className="h-4 w-4" />  {/* kebab-case también funciona */}
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `name` | `string` | ✅ | — | PascalCase o kebab-case del ícono Lucide |
| `...LucideProps` | — | ❌ | — | `className`, `size`, `strokeWidth`, etc. |

**Comportamiento**: Si el nombre no existe en el catálogo Lucide, renderiza `<Package />` como fallback. Internamente cachea componentes dinámicos para evitar re-registros.

**Uso en PageHeader**: el prop `iconName` de `PageHeader` acepta el nombre del ícono como string y lo renderiza via `DynamicIcon` en el `DashboardShell`.

---

## 4. EntityBadge

**Archivo**: `frontend/components/shared/EntityBadge.tsx`  
**Import**: `import { EntityBadge } from '@/components/shared'`

Componente premium para renderizar identificadores de entidades de forma consistente. Combina ícono + código de documento + link a la vista de detalle.

```tsx
<EntityBadge label="sales.saleorder" data={{ id: 1, number: 42 }} />
// Renderiza: [ReceiptText icon] NV-42  (clickeable → /sales/orders/1)

<EntityBadge label="purchasing.purchaseorder" data={{ id: 5, number: 7 }} link={false} />
// Renderiza: [ShoppingCart icon] OCS-7  (no clickeable)
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `label` | `string` | ✅ | — | Clave del `ENTITY_REGISTRY` (e.g. `'sales.saleorder'`) |
| `data` | `any` | ✅ | — | Objeto con los campos usados por `shortTemplate` + `id` para URL |
| `showIcon` | `boolean` | ❌ | `true` | Muestra el ícono de la entidad |
| `link` | `boolean` | ❌ | `true` | Envuelve en `<Link>` hacia `detailUrlPattern` |
| `size` | `'sm' \| 'md' \| 'lg'` | ❌ | `'md'` | Tamaño del badge |
| `className` | `string` | ❌ | — | Clases adicionales |

**Uso en tablas**: ver `DataCell.DocumentId` (§7) que es el wrapper para listas.

---

## 5. EntityHeader

**Archivo**: `frontend/components/shared/EntityHeader.tsx`  
**Import**: `import { EntityHeader } from '@/components/shared'`

Header estandarizado para páginas de detalle `[id]/page.tsx`. Renderiza el ícono del registry + título de la entidad + displayId formateado + breadcrumb + slot de acciones.

```tsx
<EntityHeader
  entityLabel="purchasing.purchaseorder"
  data={{ id: 5, number: 7 }}
  action="view"
  breadcrumb={[
    { label: 'Compras', href: '/purchasing' },
    { label: 'Órdenes', href: '/purchasing/orders' },
  ]}
>
  <Button>Confirmar</Button>
</EntityHeader>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `entityLabel` | `string` | ✅ | — | Clave `ENTITY_REGISTRY`. Determina ícono y título. |
| `data` | `any` | ❌ | — | Objeto para formatear `displayId` (e.g. `{ id, number }`) |
| `action` | `'create' \| 'edit' \| 'view'` | ❌ | `'view'` | Prefija el título: `view` → título base, `create` → "Nuevo/a …", `edit` → "Editar …" |
| `customTitle` | `string` | ❌ | — | Sobreescribe el título generado por `action` |
| `breadcrumb` | `BreadcrumbItem[]` | ❌ | — | `[{ label, href }]`. El último item es la página actual. |
| `readonly` | `boolean` | ❌ | `false` | Muestra badge "Solo lectura" |
| `children` | `ReactNode` | ❌ | — | Botones de acción alineados a la derecha |
| `className` | `string` | ❌ | — | Clases del contenedor raíz |

**Lógica de resolución de ícono**: lee `ENTITY_REGISTRY[entityLabel].icon`. Fallback: `Package`.

---

## 6. EntityDetailPage

**Archivo**: `frontend/components/shared/EntityDetailPage.tsx`  
**Import**: `import { EntityDetailPage } from '@/components/shared'`

Shell completo para rutas `[id]/page.tsx`. Orquesta `EntityHeader` + `FormSplitLayout` + `ActivitySidebar` + footer pegajoso. **Usar este componente para toda página de detalle de entidad.**

```tsx
<EntityDetailPage
  entityLabel="purchasing.purchaseorder"
  instanceId={id}
  breadcrumb={[
    { label: 'Compras', href: '/purchasing' },
    { label: 'Órdenes de Compra', href: '/purchasing/orders' },
  ]}
  footer={<SubmitButton />}
>
  <PurchaseOrderForm initialData={data} />
</EntityDetailPage>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `entityLabel` | `string` | ❌ | — | Preferido sobre `entityType`. Clave del registry. |
| `entityType` | `ActivityEntityType` | ❌ | — | Legacy. Usar `entityLabel` cuando sea posible. |
| `title` | `string` | ❌ | — | Sobreescribe el título del registry |
| `displayId` | `string` | ❌ | — | Identificador visible (e.g. `'OCS-7'`). Si se omite, se formatea desde `instanceId`. |
| `icon` | `string` | ❌ | — | Legacy icon name. Ignorado si `entityLabel` tiene entrada en el registry. |
| `breadcrumb` | `BreadcrumbItem[]` | ✅ | — | Siempre requerido |
| `instanceId` | `number \| string` | ❌ | — | ID del registro. Si se omite, no se muestra sidebar (modo crear). |
| `sidebar` | `ReactNode \| null` | ❌ | — | Override del sidebar. `null` deshabilita explícitamente. |
| `footer` | `ReactNode` | ❌ | — | Acciones del footer pegajoso |
| `readonly` | `boolean` | ❌ | `false` | Modo solo lectura: oculta footer, pasa `readonly` al header |
| `children` | `ReactNode` | ✅ | — | Contenido principal (formulario, vista detalle) |
| `className` | `string` | ❌ | — | |

**Derivación automática de `entityType`**: Si sólo se provee `entityLabel`, el componente deriva el `entityType` para `ActivitySidebar` tomando el sufijo del label (e.g. `'purchasing.purchaseorder'` → `'purchaseorder'`).

---

## 7. DataCell.DocumentId

**Archivo**: `frontend/components/ui/data-table-cells.tsx`  
**Import**: `import { DataCell } from '@/components/ui/data-table-cells'`

Celda de tabla estandarizada para mostrar identificadores de documentos. Internamente usa `EntityBadge`.

```tsx
// ✅ Correcto — usar entityLabel directamente (preferido)
<DataCell.DocumentId entityLabel="purchasing.purchaseorder" data={row.original} />

// ✅ Aceptable — type como clave del mapa interno
<DataCell.DocumentId type="purchase_order" number={row.getValue('number')} />

// ❌ Incorrecto — type en mayúsculas no existe en el mapa
<DataCell.DocumentId type="PURCHASE_ORDER" number={row.getValue('number')} />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `entityLabel` | `string` | ❌ | — | **Preferido.** Clave directa del `ENTITY_REGISTRY` |
| `label` | `string` | ❌ | — | Alias de `entityLabel` |
| `type` | `string` | ❌ | — | Clave legacy del mapa interno (ver tabla abajo). **Usar snake_case.** |
| `number` | `string \| number \| null` | ❌ | — | Valor numérico. Si se usa `entityLabel` + `data`, no es necesario. |
| `data` | `any` | ❌ | — | Objeto completo del row (permite formatear con dot-notation) |
| `className` | `string` | ❌ | — | |

### Mapa de tipos legacy (`type` prop)

| `type` value | Resuelve a |
|---|---|
| `sale_order` | `sales.saleorder` |
| `purchase_order` | `purchasing.purchaseorder` |
| `invoice` | `billing.invoice` |
| `payment` | `treasury.treasurymovement` |
| `journal_entry` | `accounting.journalentry` |
| `stock_move` | `inventory.stockmove` |
| `work_order` | `production.workorder` |
| `sale_delivery` | `sales.saledelivery` |
| `sale_return` | `sales.salereturn` |

> Si ningún `entityLabel`, `label` ni `type` resuelve, el fallback es `'sales.saleorder'` (prefijo `NV-`). **Esto es un bug silencioso** — siempre verificar que el tipo sea correcto.

---

## 8. PageHeader — integración con iconos

**Archivo**: `frontend/components/shared/PageHeader.tsx`

`PageHeader` sincroniza su configuración con el `DashboardShell` via `HeaderProvider`. El ícono del módulo se pasa por `iconName` (string) o `icon` (componente).

### Regla para módulos del ERP

Los módulos de lista (no detalle) usan `PageHeader` con `iconName` que corresponde al ícono del módulo (no necesariamente del `ENTITY_REGISTRY`, puede ser un ícono de sección).

```tsx
// Vista de lista — usa PageHeader con iconName de módulo
<PageHeader
  title="Órdenes de Compra"
  iconName="ShoppingCart"       // ← string, renderizado por DynamicIcon en DashboardShell
  description="Gestión de órdenes de compra"
/>

// Vista de detalle — usa EntityDetailPage (que usa EntityHeader con ícono del registry)
<EntityDetailPage
  entityLabel="purchasing.purchaseorder"  // ← ícono viene del ENTITY_REGISTRY
  instanceId={id}
  breadcrumb={[...]}
>
```

| prop relevante | type | notes |
|---|---|---|
| `icon` | `LucideIcon` | Ícono como componente importado |
| `iconName` | `string` | Nombre Lucide (PascalCase), renderizado via `DynamicIcon` |

> Solo uno de `icon` o `iconName` debe usarse. Preferir `iconName` para configuraciones dinámicas; `icon` para íconos importados estáticamente.

---

## 9. Tabla maestra de prefijos

Todos los prefijos canónicos del sistema. **No usar prefijos que no estén en esta tabla.**

| Registry key | Prefijo | Título | Ícono Lucide |
|---|---|---|---|
| `sales.saleorder` | `NV-` | Nota de Venta | `ReceiptText` |
| `sales.saledelivery` | `DES-` | Guía de Despacho | `Truck` |
| `sales.salereturn` | `DEV-` | Devolución | `Undo2` |
| `purchasing.purchaseorder` | `OCS-` | Orden de Compra | `ShoppingCart` |
| `billing.invoice` | `FAC-` | Factura/DTE | `FileText` |
| `production.workorder` | `OT-` | Orden de Trabajo | `Wrench` |
| `inventory.stockmove` | `MOV-` | Movimiento de Stock | `ArrowLeftRight` |
| `inventory.product` | `PRD-` | Producto | `Package` |
| `treasury.treasurymovement` | `TRX-` | Movimiento de Tesorería | `Landmark` |
| `treasury.bankstatement` | `CAR-` | Cartola Bancaria | `BookOpen` |
| `accounting.account` | `{code}` | Cuenta Contable | `Book` |
| `accounting.journalentry` | `AS-` | Asiento Contable | `Hash` |
| `contacts.contact` | `CON-` | Contacto | `Users` |
| `hr.employee` | `EMP-` | Empleado | `UserCheck` |
| `hr.payroll` | `LIQ-` | Liquidación de Sueldo | `Receipt` |
| `core.user` | `USR-` | Usuario | `User` |

### Prefijos legacy reconocidos por `detectEntityLabel()`

| Prefijo legacy | Resuelve a |
|---|---|
| `OC-`, `OC_` | `purchasing.purchaseorder` (soporte legacy) |
| `OV-`, `OV_` | `sales.saleorder` (alias legacy de NV) |

---

## 10. Reglas de cumplimiento

### ✅ Permitido

- Leer metadata via `getEntityMetadata()`, `getEntityIcon()`, `formatEntityDisplay()`.
- Renderizar identificadores via `EntityBadge` o `DataCell.DocumentId`.
- Usar `EntityHeader` / `EntityDetailPage` en todas las rutas `[id]/page.tsx`.
- Agregar entidades nuevas al registry con ADR previo si cambia la interfaz `EntityMetadata`.

### ❌ Prohibido

```tsx
// ❌ Prefijo hardcodeado en el componente
<span>OCS-{order.number}</span>

// ❌ type en mayúsculas (no existe en el mapa)
<DataCell.DocumentId type="PURCHASE_ORDER" ... />

// ❌ Ícono de entidad ad-hoc fuera del registry
<ShoppingCart className="h-5 w-5" />  // en un EntityHeader
// → usar EntityHeader con entityLabel en su lugar

// ❌ Título de entidad hardcodeado
<h1>Orden de Compra #{id}</h1>
// → usar EntityDetailPage con entityLabel

// ❌ Agregar un registro al ENTITY_REGISTRY sin actualizar detectEntityLabel()
```

### Checklist para nueva entidad

- [ ] Entrada en `ENTITY_REGISTRY` con todos los campos de `EntityMetadata`
- [ ] Regla en `detectEntityLabel()` para el prefijo canónico
- [ ] Backend: `AppConfig.ready()` registra la entidad con `title_singular`, `title_plural`, `short_display_template` (si es buscable)
- [ ] Vista de lista: `DataCell.DocumentId` usa `entityLabel` o `type` en snake_case correcto
- [ ] Vista de detalle: `EntityDetailPage` usa `entityLabel`

---

*Fuentes: `frontend/lib/entity-registry.ts` · `frontend/components/shared/EntityBadge.tsx` · `frontend/components/shared/EntityHeader.tsx` · `frontend/components/shared/EntityDetailPage.tsx` · `frontend/components/ui/data-table-cells.tsx` · `frontend/components/ui/dynamic-icon.tsx`*
