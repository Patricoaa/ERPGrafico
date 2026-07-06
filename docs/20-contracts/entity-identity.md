---
layer: 20-contracts
doc: entity-identity
status: active
owner: frontend-team
last_review: 2026-05-28
stability: contract-changes-require-ADR
---

# Entity Identity Contract

Sistema centralizado de identidad de entidades ERP. Define el **único lugar** donde se registran prefijos de documentos, íconos, títulos y rutas para todas las entidades del sistema.

> **Regla cardinal**: Ningún módulo puede definir prefijos, íconos o títulos de entidades de forma ad-hoc.
> - **Backend**: todo fluye desde `EntityPrefix` enum en `core/prefix_registry.py`.
> - **Frontend**: todo fluye desde `ENTITY_REGISTRY` + API `/api/core/entity-prefixes/`.

---

## Tabla de contenidos

1. [ENTITY\_REGISTRY](#1-entity_registry)
2. [Funciones helpers del registry](#2-funciones-helpers)
3. [API de prefijos (frontend)](#3-api-de-prefijos-frontend)
4. [DynamicIcon](#4-dynamicicon)
5. [EntityBadge](#5-entitybadge)
6. [EntityHeader](#6-entityheader)
7. [DataCell.Entity](#7-datacellEntity)
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

> **⚠️ Después de agregar**: actualizar también el backend `AppConfig.ready()` si la entidad es buscable.

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

Aplica el template del registro a un objeto `data`. Soporta dot notation y zero-padding.

**Orden de resolución del template:**
1. API config (`getEntityConfig(label).shortTemplate` desde `UniversalRegistry`)
2. `ENTITY_REGISTRY[label].shortTemplate` (fallback para entidades frontend-only)

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

### `getDtePrefix(dteType?: string | null): string`

Obtiene el prefijo de un DTE según su tipo. Lee desde el caché de la API `/api/core/entity-prefixes/` con fallback a un mapa hardcodeado (`FACTURA` → `FACV`, `BOLETA` → `BOL`, etc.).

```typescript
getDtePrefix('FACTURA');  // → 'FACV'
getDtePrefix('NOTA_CREDITO');  // → 'NC'
```

### `getDteLabel(dteType?: string | null): string`

Retorna la etiqueta legible para un tipo de DTE. También lee desde el API con fallback hardcodeado.

```typescript
getDteLabel('FACTURA');  // → 'Factura'
getDteLabel('BOLETA');   // → 'Boleta'
```

---

## 3. API de prefijos (frontend)

**Archivo**: `frontend/lib/api/entity-prefixes.ts`

Módulo que centraliza la obtención y caché de prefijos de entidades desde el backend.

### Flujo de datos

```
[Componente] → getDtePrefix(dteType) → cachedPrefixes (sync)
                                       → FALLBACK_MAP (hardcodeado)

[App init]  → fetchEntityPrefixes() → GET /api/core/entity-prefixes/ → cachedPrefixes
```

### `fetchEntityPrefixes(): Promise<Record<string, string>>`

Solicita al endpoint `/api/core/entity-prefixes/` el mapa completo de prefijos. Puebla un caché en memoria que las funciones síncronas consultan. En caso de error de red retorna `FALLBACK_MAP`.

### `getDtePrefix(dteType?: string | null): string`

Síncrona. Lee del caché (poblado por `fetchEntityPrefixes`) y fallback a `FALLBACK_MAP`. Reexportada desde `@/lib/entity-registry` para backward compatibility.

### `getDteLabel(dteType?: string | null): string`

Similar a `getDtePrefix` pero retorna la etiqueta legible (ej: `'Factura'`, `'Boleta'`).

### Inicialización

Ambos cachés se pueblan automáticamente desde `app/providers.tsx` al cargar la app:

```typescript
import { fetchEntityPrefixes, fetchEntityConfig } from '@/lib/api/entity-prefixes';

useEffect(() => {
  fetchEntityPrefixes();
  fetchEntityConfig();
}, []);
```

Mientras el caché no se ha poblado, `getEntityConfig()` retorna `undefined` y `formatEntityDisplay` cae graceful a `ENTITY_REGISTRY.shortTemplate`.

---

## 3b. API de config de entidades (`/api/core/entity-config/`)

**Endpoint**: `GET /api/core/entity-config/`  
**Fuente**: `UniversalRegistry.all_entities_serializable()` en `backend/core/registry.py`

Retorna un array con los `SearchableEntity` registrados, incluyendo templates y prefijos:

```json
[
  {
    "label": "sales.saleorder",
    "title": "Nota de Venta",
    "prefix": "NV",
    "shortTemplate": "NV-{number}",
    "displayTemplate": "NV-{number} · {customer.name}",
    "subtitleTemplate": "{customer.name} · {customer.tax_id}",
    "icon": "receipt-text",
    "listUrl": "/sales/orders",
    "detailUrlPattern": "/sales/orders/{id}"
  }
]
```

Desde el frontend:

```typescript
import { getEntityConfig, fetchEntityConfig } from '@/lib/api/entity-prefixes';

const config = getEntityConfig('sales.saleorder');
// config?.shortTemplate → "NV-{number}"
```

### `getEntityConfig(label: string): EntityConfig | undefined`

Síncrona. Retorna undefined si el label no existe en el caché o el caché no se ha poblado aún. El template del API tiene prioridad sobre `ENTITY_REGISTRY.shortTemplate` en `formatEntityDisplay` (ver §2).

---

## 4. DynamicIcon

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

## 5. EntityBadge

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

**Uso en tablas**: ver `DataCell.Entity` (§7) que es el wrapper para listas.

---

## 6. EntityHeader

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

## 7. EntityDetailPage — eliminado (T-95)

> ⚠️ **Componente eliminado en T-95 (ADR-0020).** `frontend/components/shared/EntityDetailPage.tsx` y las 16 páginas `*DetailClient.tsx` ya no existen. No usar en código nuevo.

Esta sección se conserva solo como puntero histórico. El shell orquestaba `EntityHeader` + `FormSplitLayout` + `ActivitySidebar` para las rutas `[id]` introducidas por [ADR-0019](../10-architecture/adr/0019-entity-detail-route-convention.md). [ADR-0020](../10-architecture/adr/0020-modal-on-list-edit-ux.md) revirtió esa decisión: hoy las rutas `[id]` redirigen server-side a `<list_url>?selected={id}` y abren el modal/drawer de edición sobre la lista. Patrón canónico: [list-modal-edit-pattern.md](./list-modal-edit-pattern.md).

---

## 8. DataCell.Entity

**Archivo**: `frontend/components/shared/DataTableCells.tsx`  
**Import**: `import { DataCell, createActionsColumn } from '@/components/shared'`

Celda de tabla estandarizada para mostrar identificadores de documentos. Internamente usa `EntityBadge`.

```tsx
// ✅ Correcto — usar entityLabel directamente (preferido)
<DataCell.Entity entityLabel="purchasing.purchaseorder" data={row.original} />

// ✅ Aceptable — type como clave del mapa interno
<DataCell.Entity type="purchase_order" number={row.getValue('number')} />

// ❌ Incorrecto — type en mayúsculas no existe en el mapa
<DataCell.Entity type="PURCHASE_ORDER" number={row.getValue('number')} />
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

## 9. PageHeader — integración con iconos

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

## 10. Tabla maestra de prefijos

Todos los prefijos canónicos del sistema. **No usar prefijos que no estén en esta tabla.**

| Registry key | Prefijo | Backend `EntityPrefix` | Título | Ícono Lucide |
|---|---|---|---|---|
| `sales.saleorder` | `NV` | `SALE_ORDER` | Nota de Venta | `ReceiptText` |
| `sales.saledelivery` | `DES` | `SALE_DELIVERY` | Guía de Despacho | `Truck` |
| `sales.salereturn` | `DEV` | `SALE_RETURN` | Devolución | `Undo2` |
| `purchasing.purchaseorder` | `OCS` | `PURCHASE_ORDER` | Orden de Compra | `ShoppingCart` |
| `purchasing.purchasereceipt` | `REC` | `PURCHASE_RECEIPT` | Recepción de Compra | `PackageCheck` |
| `billing.invoice` | dinámico (`FACV`/`FACC`/`BOL`/`NC`/etc.) | — | Factura/DTE | `FileText` |
| `production.workorder` | `OT` | `WORK_ORDER` | Orden de Trabajo | `Wrench` |
| `production.bom` | `BOM` | `BOM` | Lista de Materiales | `ClipboardList` |
| `inventory.stockmove` | `MOV` | `STOCK_MOVE` | Movimiento de Stock | `ArrowLeftRight` |
| `inventory.product` | `PRD` | `PRODUCT` | Producto | `Package` |
| `inventory.subscription` | `SUB` | `SUBSCRIPTION` | Suscripción | `Repeat` |
| `inventory.pricingrule` | `REG` | `PRICING_RULE` | Regla de Precio | `Percent` |
| `inventory.category` | `CAT` | `CATEGORY` | Categoría | `LayoutGrid` |
| `inventory.customfieldtemplate` | `CF` | `CUSTOM_FIELD` | Campo Personalizado | `Tag` |
| `treasury.treasurymovement` | `TES` | `TREASURY_MOVEMENT` | Movimiento de Tesorería | `ArrowRightLeft` |
| `treasury.bankstatement` | `CAR` | `BANK_STATEMENT` | Cartola Bancaria | `BookOpen` |
| `treasury.check` | `CHQ` | `CHECK` | Cheque | `FileText` |
| `treasury.bankloan` | `CRE` | `BANK_LOAN` | Crédito Bancario | `HandCoins` |
| `treasury.creditline` | `CL` | `CREDIT_LINE` | Línea de Crédito | `ScrollText` |
| `treasury.loaninstallment` | `CUO` | `LOAN_INSTALLMENT` | Cuota de Crédito | `Calendar` |
| `treasury.creditcardstatement` | `EST` | `CREDIT_CARD_STMT` | Estado de Cuenta Tarjeta | `CreditCard` |
| `treasury.cardpendingcharge` | `CHG` | `CARD_PENDING_CHARGE` | Cargo No Facturado | `CreditCard` |
| `treasury.terminalbatch` | `LOT` | `TERMINAL_BATCH` | Lote de Terminal | `ClipboardCheck` |
| `treasury.transfer` | `TRF` | `TRANSFER` | Traspaso | `ArrowLeftRight` |
| `treasury.bank` | — | — | Banco | `Landmark` |
| `treasury.treasuryaccount` | — | — | Cuenta de Tesorería | `Landmark` |
| `accounting.journalentry` | `AS` | `JOURNAL_ENTRY` | Asiento Contable | `Hash` |
| `accounting.fiscalyear` | `EJ` | `FISCAL_YEAR` | Ejercicio Contable | `Calendar` |
| `accounting.budget` | `BUD` | `BUDGET` | Presupuesto | `PieChart` |
| `accounting.account` | `{code}` | — | Cuenta Contable | `Book` |
| `contacts.contact` | `CON` | `CONTACT` | Contacto | `Users` |
| `contacts.partnertransaction` | `PT` | `PARTNER_TRANSACTION` | Transacción de Socio | `ArrowRightLeft` |
| `hr.employee` | `EMP` | `EMPLOYEE` | Empleado | `UserCheck` |
| `hr.payroll` | `LIQ` | `PAYROLL` | Liquidación de Sueldo | `Receipt` |
| `hr.absence` | `AUS` | `ABSENCE` | Inasistencia | `CalendarX2` |
| `hr.salaryadvance` | `ANT` | `SALARY_ADVANCE` | Anticipo de Sueldo | `HandCoins` |
| `hr.payrollconcept` | `CON-LIQ` | `PAYROLL_CONCEPT` | Concepto de Liquidación | `ClipboardList` |
| `core.user` | `USR` | `USER` | Usuario | `User` |
| `workflow.task` | `TASK` | `TASK` | Tarea | `ClipboardCheck` |
| `finance.bankjournal` | `BJ` | `BANK_JOURNAL` | Diario Banco | `Landmark` |
| `finance.payment` | `PAY` | `PAYMENT` | Pago | `Receipt` |
| `pos.session` | `POS` | `POS_SESSION` | Sesión POS | `ShoppingCart` |
| `pos.terminal` | `POS-C` | `POS_TERMINAL` | Caja POS | `Monitor` |
| `tax.f29declaration` | `F29` | `F29_DECLARATION` | Declaración F29 | `FileText` |
| `tax.accountingperiod` | `PER` | `ACCOUNTING_PERIOD` | Período Contable | `Calendar` |
| `tax.taxperiod` | `IMP` | `TAX_PERIOD` | Período Tributario | `Calendar` |
| `sales.saledelivery` | `DES` | `SALE_DELIVERY` | Guía de Despacho | `Truck` |

> Para `billing.invoice` el prefijo es dinámico según `dte_type`. Ver `getDtePrefix()` en §3. El backend `EntityPrefix` define `INVOICE_FACTURA=FACV`, `INVOICE_BOLETA=BOL`, `NOTA_CREDITO=NC`, etc.


---

## 11. Reglas de cumplimiento

### ✅ Permitido

- Leer metadata via `getEntityMetadata()`, `getEntityIcon()`, `formatEntityDisplay()`.
- Renderizar identificadores via `EntityBadge` o `DataCell.Entity`.
- Usar `EntityHeader` en todas las superficies que muestren la identidad de una entidad (modales, drawers, headers).
- ~~Usar `EntityDetailPage` en rutas `[id]/page.tsx`~~ — **Decommissionado (T-95)**. Las rutas `[id]` redirigen server-side a `<list_url>?selected={id}` (ADR-0020).
- Agregar entidades nuevas al registry con ADR previo si cambia la interfaz `EntityMetadata`.

### ❌ Prohibido

```tsx
// ❌ Prefijo hardcodeado en el componente
<span>OCS-{order.number}</span>

// ❌ type en mayúsculas (no existe en el mapa)
<DataCell.Entity type="PURCHASE_ORDER" ... />

// ❌ Ícono de entidad ad-hoc fuera del registry
<ShoppingCart className="h-5 w-5" />  // en un EntityHeader
// → usar EntityHeader con entityLabel en su lugar

// ❌ Título de entidad hardcodeado
<h1>Orden de Compra #{id}</h1>
// → usar EntityHeader con entityLabel dentro del drawer/modal de edición

// ❌ Usar getDtePrefix sin importarlo desde @/lib/entity-registry (es re-exportado desde api/entity-prefixes)
```

### Checklist para nueva entidad

- [ ] Miembro en `backend/core/prefix_registry.py` enum `EntityPrefix`
- [ ] Entrada en `ENTITY_REGISTRY` con todos los campos de `EntityMetadata` (sin `shortTemplate` si está en `UniversalRegistry`)
- [ ] Backend: `AppConfig.ready()` registra la entidad con `title_singular`, `title_plural`, `short_display_template` (si es buscable)
- [ ] `short_display_template` en `apps.py` usa `f"{EntityPrefix.X}-{{number}}"` — **no hardcodear el string**
- [ ] Vista de lista: `DataCell.Entity` usa `entityLabel` o `type` en snake_case correcto
- [ ] `pytest backend/core/tests/test_prefix_sync.py` pasa (atrapa drift entre enum y templates)

---

*Fuentes: `backend/core/prefix_registry.py` · `frontend/lib/entity-registry.ts` · `frontend/lib/api/entity-prefixes.ts` · `frontend/components/shared/EntityBadge.tsx` · `frontend/components/shared/EntityHeader.tsx` · `frontend/components/shared/DataTableCells.tsx` · `frontend/components/ui/dynamic-icon.tsx`*

> **Nota histórica:** `EntityDetailPage.tsx` fue eliminado en T-95. Ver [list-modal-edit-pattern.md](./list-modal-edit-pattern.md) para el patrón canónico actual.
