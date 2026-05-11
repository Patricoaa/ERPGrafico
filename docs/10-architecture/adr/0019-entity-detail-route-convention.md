# ADR-0019: Convención "Searchable Entity Detail Route"

**Status:** Accepted  
**Date:** 2026-05-08  
**Authors:** Architecture team  
**Supersedes:** N/A  
**Related:** ADR-0016 (Post-Refactor F5), T-68 (F7 — Detail routes para Universal Search)

---

## Contexto

El Universal Registry (introducido en F1, expandido en F6) registra 26 entidades con dos campos de ruta: `list_url` y `detail_url_pattern`. Al momento de redactar este ADR (post-F6), **ninguna** de las 26 `detail_url_pattern` coincide con una ruta real del App Router de Next.js. Dos defectos compuestos:

1. **Idioma:** todos los slugs están en español (`/ventas/ordenes`, `/contabilidad/asientos`) pero el App Router está en inglés (`/sales/orders`, `/accounting/entries`).
2. **Ausencia de ruta `[id]`:** solo 2 entidades tienen página `[id]` real en el frontend (`finances/budgets/[id]` y `hr/payrolls/[id]`). Las demás exponen el detalle vía modal sobre la lista, sin URL canónica.

El efecto observable: hacer clic en cualquier resultado del Universal Search genera un 404 o navega a una lista (no al detalle).

### Opciones evaluadas

**Opción A — `?selected=id` (descartada):** mantener el patrón de modal con query param. Más rápido de implementar pero produce URLs no compartibles, no de deep-linkeable, dependientes del estado SSR del modal, incompatibles con navegación directa desde email/notificación.

**Opción B — Rutas `[id]` reales (adoptada):** crear una página `[id]/page.tsx` por entidad en el App Router. La página reutiliza el form/editor existente envuelto en una shell `EntityDetailPage`. No se reescribe lógica de formulario.

---

## Decisión

### D-01: Convención de ruta canónica

Toda entidad registrada en el `UniversalRegistry` DEBE tener una ruta accesible en:

```
/[module]/[entity-plural]/[id]
```

Donde:
- `[module]` es el **segmento en inglés** del módulo frontend (ver tabla §D-02).
- `[entity-plural]` es el **plural canónico en inglés** de la entidad (ver tabla §D-03).
- `[id]` es el segmento dinámico de Next.js App Router (`[id]/page.tsx`).

Ejemplo: `SaleOrder` → `/sales/orders/123`

### D-02: Tabla app → módulo frontend

| Django app | Segmento frontend | Notas |
|------------|------------------|-------|
| `sales` | `/sales` | |
| `purchasing` | `/purchasing` | |
| `billing` | `/billing` | Split: `/billing/sales` (ventas) + `/billing/purchases` (compras) según `dte_type` |
| `contacts` | `/contacts` | |
| `accounting` | `/accounting` | Excepción: `Budget` vive en `/finances` (decisión preexistente de UX) |
| `inventory` | `/inventory` | |
| `treasury` | `/treasury` | |
| `hr` | `/hr` | |
| `production` | `/production` | |
| `tax` | `/tax` | Carpeta nueva — no existe aún en el router |
| `workflow` | `/workflow` | Carpeta nueva — no existe aún en el router |
| `core` (User) | `/settings` | Users viven bajo Settings |
| `core` (Attachment) | `/files` | Carpeta nueva |

### D-03: Tabla de patrones canónicos (las 26 entidades)

| app.model | `list_url` | `detail_url_pattern` | `[id]` ya existe | read-only |
|-----------|------------|----------------------|------------------|-----------|
| `sales.saleorder` | `/sales/orders` | `/sales/orders/{id}` | ❌ | No |
| `sales.saledelivery` | `/sales/deliveries` | `/sales/deliveries/{id}` | ❌ | No |
| `sales.salereturn` | `/sales/returns` | `/sales/returns/{id}` | ❌ | No |
| `purchasing.purchaseorder` | `/purchasing/orders` | `/purchasing/orders/{id}` | ❌ | No |
| `billing.invoice` | `/billing/sales` | `/billing/sales/{id}` o `/billing/purchases/{id}` | ❌ | No |
| `contacts.contact` | `/contacts` | `/contacts/{id}` | ❌ | No |
| `accounting.account` | `/accounting/accounts` | `/accounting/accounts/{id}` | ❌ (parcial, ver nota) | Parcial |
| `accounting.journalentry` | `/accounting/entries` | `/accounting/entries/{id}` | ❌ | No |
| `accounting.fiscalyear` | `/accounting/closures` | `/accounting/closures/{id}` | ❌ | No |
| `accounting.budget` | `/finances/budgets` | `/finances/budgets/{id}` | ✅ | No |
| `inventory.product` | `/inventory/products` | `/inventory/products/{id}` | ❌ | No |
| `inventory.productcategory` | `/inventory/categories` | `/inventory/categories/{id}` | ❌ | No |
| `inventory.warehouse` | `/inventory/warehouses` | `/inventory/warehouses/{id}` | ❌ | No |
| `inventory.stockmove` | `/inventory/stock-moves` | `/inventory/stock-moves/{id}` | ❌ | **Sí** |
| `treasury.treasurymovement` | `/treasury/movements` | `/treasury/movements/{id}` | ❌ | No |
| `treasury.treasuryaccount` | `/treasury/accounts` | `/treasury/accounts/{id}` | ❌ | No |
| `treasury.possession` | `/treasury/sessions` | `/treasury/sessions/{id}` | ❌ | **Sí** (cuando cerrada) |
| `treasury.bankstatement` | `/treasury/statements` | `/treasury/statements/{id}` | ❌ | **Sí** |
| `hr.employee` | `/hr/employees` | `/hr/employees/{id}` | ❌ | No |
| `hr.payroll` | `/hr/payrolls` | `/hr/payrolls/{id}` | ✅ | No |
| `production.workorder` | `/production/orders` | `/production/orders/{id}` | ❌ | No |
| `tax.f29declaration` | `/tax/f29` | `/tax/f29/{id}` | ❌ | No |
| `tax.accountingperiod` | `/tax/periods` | `/tax/periods/{id}` | ❌ | No |
| `workflow.task` | `/workflow/tasks` | `/workflow/tasks/{id}` | ❌ | No |
| `core.user` | `/settings/users` | `/settings/users/{id}` | ❌ | No |
| `core.attachment` | `/files` | `/files/{id}` | ❌ | **Sí** |

> **Nota `accounting.account`:** existe `accounting/ledger/[id]/ledger/page.tsx` con estructura anidada doble — no cumple el patrón. T-75 consolida esta ruta en `accounting/accounts/[id]/page.tsx` (ficha de cuenta) manteniendo `accounting/ledger/` para el mayor.

### D-04: Shell `EntityDetailPage`

Se introduce el componente `frontend/components/shared/EntityDetailPage.tsx` que provee:
- Header sticky: icono de entidad + display + breadcrumb (lista → detalle)
- Slot principal (`children`): form o editor existente sin modificar
- Slot sidebar: `ActivitySidebar` opcional (default activo en entidades con historial)
- Footer opcional con acciones (confirm, cancel, etc.)
- Prop `readonly?: boolean`: activa modo de solo lectura para entidades sin form de edición

Las páginas `[id]/page.tsx` son **Server Components** que:
1. Fetch de la entidad vía API
2. Validan permiso `view_*` — 403 si no autorizado
3. Devuelven `notFound()` si el id no existe
4. Renderizan `<EntityDetailPage>` con el form/editor existente como `children`

### D-05: Modo read-only para entidades sin formulario

Las entidades identificadas como read-only (`StockMove`, `BankStatement`, `POSSession` cerrada, `Attachment`) usan `<EntityDetailPage readonly>`. En este modo:
- El slot principal renderiza una vista de detalle en lugar de un formulario editable
- No hay footer de acciones de edición
- Los campos se muestran como `<dl>` semántico o tabla de detalle

### D-06: Coexistencia y deprecación del patrón `?selected=id`

Durante la migración (F7 completo):
- Las listas con `?selected=id` que ya tienen ruta `[id]` DEBEN redirigir: `redirect('/module/entity/id')` desde `page.tsx` de lista cuando detecta el param `?selected=id` (o equivalente legacy)
- Una vez que T-72..T-77 estén completos y el test arquitectónico T-79 pase, el patrón legacy se elimina

---

## Consecuencias

### Positivas
- Cero 404 desde resultados del Universal Search.
- URLs deep-linkeables: compartibles por email/chat, bookmarkeables, funcionales con el botón Atrás del browser.
- Consistencia: un solo patrón para navegar a cualquier entidad del sistema.
- Sin reescritura de lógica: los forms/editors existentes se montan en la shell sin modificarse.

### Negativas / Riesgos aceptados
- **R-12:** entidades read-only (`StockMove`, `BankStatement`, `POSSession`, `Attachment`) requieren una vista de detalle ad-hoc en lugar de un formulario. Mitigado con modo `readonly` del shell.
- **R-13:** el patrón `?selected=id` coexistirá con `[id]` durante F7. Mitigado con redirect condicional en las listas.
- **R-14:** rutas `[id]` requieren guardas de permiso server-side explícitas por entidad. Mitigado: cada page server-component valida permiso antes de renderizar.
- **Carpetas nuevas requeridas** en el App Router: `sales/deliveries`, `sales/returns`, `inventory/categories`, `inventory/warehouses`, `treasury/sessions`, `treasury/statements`, `tax/`, `workflow/`, `files/` — están fuera de los módulos existentes y requieren crear `layout.tsx` + header de módulo donde no exista.

---

## Anti-objetivos

- ❌ No se reescriben formularios ni lógica de negocio existente.
- ❌ No se cambian los modelos Django.
- ❌ No se adopta el patrón `?selected=id` (Opción A descartada).
- ❌ `Contact`, `Account`, `Product` (manufacturable) y `WorkOrder` no migran a `EntityForm` genérico — siguen con formulario especializado. La ruta `[id]` sí se crea, pero usa el form rico existente como `children`.
