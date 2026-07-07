# F7 — Matriz de Rutas: Gap Audit Universal Search

> **Generado:** 2026-05-08 · **Tarea:** T-69 · **Estado:** temporal (eliminar tras completar T-78)  
> **Propósito:** inventario completo del gap entre `apps.py::ready()` y el App Router real. Fuente de verdad para T-70..T-78.

---

## Convención de columnas

| Columna | Descripción |
|---------|-------------|
| `app.model` | Label Django del registry |
| `actual_list_route` | Ruta real actual en el App Router (`/app/(dashboard)/...`) |
| `actual_detail_or_modal` | Cómo se muestra el detalle hoy |
| `apps.py list_url` | Lo que registra `apps.py` hoy (incorrecto) |
| `target_list_url` | Ruta lista canónica (ADR-0019 D-02/D-03) |
| `target_detail_url_pattern` | Ruta `[id]` canónica (ADR-0019 D-03) |
| `current_form_component` | Componente de edición/creación actual |
| `read_only` | Sin form editable — usar `EntityDetailPage readonly` |
| `notes` | Observaciones y trabajo requerido |

---

## Matriz de 26 Entidades

### Módulo: Sales

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `sales.saleorder` | `/sales/orders` ✅ | Modal — `SaleOrderForm` dentro de `SalesOrdersClientView` | `/ventas/ordenes` ❌ | `/sales/orders` | `/sales/orders/{id}` | `features/sales/components/forms/SaleOrderForm.tsx` | No | Crear `sales/orders/[id]/page.tsx`. Ruta de lista existe. |
| `sales.saledelivery` | ❌ No existe carpeta `deliveries` | Modal — `DeliveryModal.tsx` dentro de `SalesOrdersClientView` | `/ventas/despachos` ❌ | `/sales/deliveries` | `/sales/deliveries/{id}` | `features/sales/components/DeliveryModal.tsx` | No | Crear carpeta `sales/deliveries/` + layout + `[id]/page.tsx`. Sin lista propia aún. |
| `sales.salereturn` | ❌ No existe. Credits (`/sales/credits`) es créditos, no devoluciones | Modal — `SaleNoteModal.tsx` | `/ventas/devoluciones` ❌ | `/sales/returns` | `/sales/returns/{id}` | `features/sales/components/SaleNoteModal.tsx` | No | Crear carpeta `sales/returns/` + `[id]/page.tsx`. Auditar si `/sales/credits` corresponde. |

### Módulo: Purchasing

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `purchasing.purchaseorder` | `/purchasing/orders` ✅ | Modal — `PurchaseOrderForm` dentro de la vista | `/compras/ordenes` ❌ | `/purchasing/orders` | `/purchasing/orders/{id}` | `features/purchasing/components/PurchaseOrderForm.tsx` | No | Solo crear `purchasing/orders/[id]/page.tsx`. |

### Módulo: Billing

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `billing.invoice` | `/billing/sales` ✅ y `/billing/purchases` ✅ | Modal — `SalesInvoicesClientView` / `PurchaseInvoicesClientView` | `/facturacion` ❌ | `/billing/sales` (ventas) `/billing/purchases` (compras) | `/billing/sales/{id}` o `/billing/purchases/{id}` | `features/billing/components/SalesInvoicesClientView.tsx` / `PurchaseInvoicesClientView.tsx` | No | La page `[id]` debe resolver `dte_type` y redirigir/renderizar correctamente. El registry registra una sola entidad — la page server-side hace el split. |

### Módulo: Contacts

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `contacts.contact` | `/contacts` ✅ | Modal — `ContactModal.tsx` dentro de `ContactsClientView` | `/contactos` ❌ | `/contacts` | `/contacts/{id}` | `features/contacts/components/ContactModal.tsx` | No | Form especializado (lista negra para EntityForm genérico). Crear `contacts/[id]/page.tsx` usando `ContactModal` embebido o form rico. |

### Módulo: Accounting / Finances

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `accounting.account` | `/accounting/ledger` ⚠️ (es el libro mayor, no el plan de cuentas) | Sidebar — `AccountsClientView` con panel lateral | `/contabilidad/plan-cuentas` ❌ | `/accounting/accounts` | `/accounting/accounts/{id}` | `features/accounting/components/AccountsClientView.tsx` + `features/finance/components/AccountForm.tsx` | Parcial (cuentas con hijos: read-only) | Existe `accounting/ledger/[id]/ledger/page.tsx` con estructura incorrecta. T-75 consolida en `accounting/accounts/[id]/page.tsx`. La ficha no editable si tiene hijos. |
| `accounting.journalentry` | `/accounting/entries` ✅ | Modal — `JournalEntryForm` | `/contabilidad/asientos` ❌ | `/accounting/entries` | `/accounting/entries/{id}` | `features/accounting/components/JournalEntryForm.tsx` | No | Solo crear `accounting/entries/[id]/page.tsx`. Respetar lock de período cerrado. |
| `accounting.fiscalyear` | `/accounting/closures` ✅ | Vista de lista — `AccountingClosuresView` (sin detalle propio) | `/contabilidad/periodos` ❌ | `/accounting/closures` | `/accounting/closures/{id}` | `features/accounting/components/closures/AccountingClosuresView.tsx` | No | Crear `accounting/closures/[id]/page.tsx`. Mostrar estado del cierre. |
| `accounting.budget` | `/finances/budgets` ✅ | Página propia — `BudgetDetailView` | `/contabilidad/presupuestos` ❌ | `/finances/budgets` | `/finances/budgets/{id}` | `features/finance/components/BudgetDetailView.tsx` + `BudgetEditor.tsx` | No | ✅ `finances/budgets/[id]/page.tsx` YA EXISTE. Solo corregir `apps.py` con la ruta correcta. |

### Módulo: Inventory

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `inventory.product` | `/inventory/products` ✅ | Modal/Panel — `ProductForm` | `/inventario/productos` ❌ | `/inventory/products` | `/inventory/products/{id}` | `features/inventory/components/ProductForm.tsx` | No | Form rico especializado (lista negra para EntityForm si es `MANUFACTURABLE`). Crear `inventory/products/[id]/page.tsx`. |
| `inventory.productcategory` | ❌ No existe `/inventory/categories` (está en `/inventory/products` como tab) | Modal — `CategoryForm` | `/inventario/categorias` ❌ | `/inventory/categories` | `/inventory/categories/{id}` | `features/inventory/components/CategoryForm.tsx` | No | Crear carpeta `inventory/categories/` + lista + `[id]/page.tsx`. Plural irregular: `category` → `categories`. |
| `inventory.warehouse` | ❌ No existe `/inventory/warehouses` | Modal — `WarehouseForm` | `/inventario/bodegas` ❌ | `/inventory/warehouses` | `/inventory/warehouses/{id}` | `features/inventory/components/WarehouseForm.tsx` | No | Crear carpeta `inventory/warehouses/` + `[id]/page.tsx`. |
| `inventory.stockmove` | `/inventory/stock` ✅ (ruta como `stock`, no `stock-moves`) | Lista — `MovementList`, sin detalle propio | `/inventario/movimientos` ❌ | `/inventory/stock-moves` | `/inventory/stock-moves/{id}` | `features/inventory/components/MovementList.tsx` | **Sí** | Read-only. Crear `inventory/stock-moves/[id]/page.tsx` con `EntityDetailPage readonly`. Auditar si la lista debe migrar de `/inventory/stock` a `/inventory/stock-moves`. |

### Módulo: Treasury

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `treasury.treasurymovement` | `/treasury/movements` ✅ | Modal — `MovementWizard` o `CashMovementModal` | `/tesoreria` ❌ | `/treasury/movements` | `/treasury/movements/{id}` | `features/treasury/components/MovementWizard.tsx` | No | Form especializado (split por `Type × Method × JustifyReason`). Crear `treasury/movements/[id]/page.tsx`. |
| `treasury.treasuryaccount` | `/treasury/accounts` ✅ | Modal — `TreasuryAccountModal` | `/tesoreria/cuentas` ❌ | `/treasury/accounts` | `/treasury/accounts/{id}` | `features/treasury/components/TreasuryAccountModal.tsx` | No | Crear `treasury/accounts/[id]/page.tsx`. |
| `treasury.possession` (POSSession) | ❌ No existe `/treasury/sessions` (las sesiones viven bajo `/sales/sessions`) | Vista — `POSSessionsView` | `/tesoreria/cajas` ❌ | `/treasury/sessions` | `/treasury/sessions/{id}` | `features/sales/components/POSSessionsView.tsx` | **Sí** (cerrada) | Crear `treasury/sessions/[id]/page.tsx` con `EntityDetailPage readonly`. Auditar si `/sales/sessions` redirige. |
| `treasury.bankstatement` | ❌ No existe `/treasury/statements` (cartolas viven en `/finances/statements`) | Vista — `StatementsView` bajo reconciliation | `/tesoreria/cartolas` ❌ | `/treasury/statements` | `/treasury/statements/{id}` | `features/finance/bank-reconciliation/components/StatementsList.tsx` | **Sí** | Read-only. Crear `treasury/statements/[id]/page.tsx` con `EntityDetailPage readonly`. |

### Módulo: HR

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `hr.employee` | `/hr/employees` ✅ | Modal — `EmployeeFormModal` | `/rrhh/empleados` ❌ | `/hr/employees` | `/hr/employees/{id}` | `features/hr/components/EmployeeFormModal.tsx` | No | Crear `hr/employees/[id]/page.tsx`. |
| `hr.payroll` | `/hr/payrolls` ✅ | Página propia — `PayrollDetailContent` | `/rrhh/liquidaciones` ❌ | `/hr/payrolls` | `/hr/payrolls/{id}` | `features/hr/components/payrolls/PayrollDetailContent.tsx` | No | ✅ `hr/payrolls/[id]/page.tsx` YA EXISTE. Solo corregir `apps.py`. |

### Módulo: Production

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `production.workorder` | `/production/orders` ✅ | Wizard — `WorkOrderWizard` / `WorkOrderForm` | `/produccion/ordenes` ❌ | `/production/orders` | `/production/orders/{id}` | `features/production/components/WorkOrderWizard.tsx` + `forms/WorkOrderForm/index.tsx` | No | Form especializado (wizard). Crear `production/orders/[id]/page.tsx`. |

### Módulo: Tax

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `tax.f29declaration` | ❌ No existe carpeta `/tax/f29` | Vista lista — `TaxDeclarationsView` con wizard de declaración | `/tributario/f29` ❌ | `/tax/f29` | `/tax/f29/{id}` | `features/tax/components/TaxDeclarationsView.tsx` + `DeclarationWizard.tsx` | No | Crear módulo completo: carpeta `/tax/`, layout, header, `f29/page.tsx`, `f29/[id]/page.tsx`. |
| `tax.accountingperiod` | ❌ No existe `/tax/periods` | Vista de lista — dentro de `TaxDeclarationsView` | `/tributario/periodos` ❌ | `/tax/periods` | `/tax/periods/{id}` | `features/tax/components/TaxDeclarationsView.tsx` | No | Crear `tax/periods/page.tsx` + `tax/periods/[id]/page.tsx`. |

### Módulo: Workflow

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `workflow.task` | ❌ No existe carpeta `/workflow`. Tasks en sidebar `TaskInbox` y `TaskInboxSidebar` | Panel lateral — `TaskActionCard` | `/tareas` ❌ | `/workflow/tasks` | `/workflow/tasks/{id}` | `features/workflow/components/TaskActionCard.tsx` | No | Crear módulo completo: carpeta `/workflow/`, layout, header, `tasks/page.tsx`, `tasks/[id]/page.tsx`. |

### Módulo: Core / Settings

| app.model | actual_list_route | actual_detail_or_modal | apps.py list_url | target_list_url | target_detail_url_pattern | current_form_component | read_only | notes |
|-----------|------------------|------------------------|-----------------|-----------------|--------------------------|----------------------|-----------|-------|
| `core.user` | `/settings/users` ✅ | Modal — `UserForm` dentro de `UsersSettingsView` | `/configuracion/usuarios` ❌ | `/settings/users` | `/settings/users/{id}` | `features/users/components/UserForm.tsx` | No | Crear `settings/users/[id]/page.tsx`. Respetar `FormMeta.exclude_fields` (sin `pos_pin`, `password`). |
| `core.attachment` | ❌ No existe `/files` | Sin vista de detalle propia | `/archivos` ❌ | `/files` | `/files/{id}` | — (ninguno) | **Sí** | Read-only con preview del archivo. Crear carpeta `/files/` + `[id]/page.tsx` con `EntityDetailPage readonly`. Requiere nuevo módulo completo. |

---

## Resumen Cuantitativo

| Estado | Cantidad | Entidades |
|--------|----------|-----------|
| `[id]` ya existe y correcto | 2 | `accounting.budget`, `hr.payroll` |
| `[id]` existe pero incorrecto | 1 | `accounting.account` (estructura anidada doble `ledger/[id]/ledger/`) |
| Lista existe, solo falta `[id]` | 10 | `sales.saleorder`, `purchasing.purchaseorder`, `billing.invoice`, `contacts.contact`, `accounting.journalentry`, `accounting.fiscalyear`, `inventory.product`, `treasury.treasurymovement`, `treasury.treasuryaccount`, `hr.employee` |
| Requiere lista + `[id]` nuevos | 11 | `sales.saledelivery`, `sales.salereturn`, `inventory.productcategory`, `inventory.warehouse`, `inventory.stockmove`, `treasury.possession`, `treasury.bankstatement`, `production.workorder`, `tax.f29declaration`, `tax.accountingperiod`, `workflow.task` |
| Requiere módulo completo nuevo | 2 | `tax.*` (carpeta `/tax/` no existe), `workflow.task` (carpeta `/workflow/` no existe), `core.attachment` (carpeta `/files/` no existe) |

**Entidades read-only:** 4 → `StockMove`, `BankStatement`, `POSSession`, `Attachment`

---

## Plan de Adopción Priorizado

### Prioridad 1 — Quick wins (lista existe, solo crear `[id]`) · T-72, T-73

Primero las transaccionales de alto valor y tráfico:

1. `sales.saleorder` → `sales/orders/[id]`
2. `purchasing.purchaseorder` → `purchasing/orders/[id]`
3. `billing.invoice` → `billing/sales/[id]` + `billing/purchases/[id]`
4. `accounting.journalentry` → `accounting/entries/[id]`

### Prioridad 2 — Maestros de alto tráfico · T-74, T-75

5. `inventory.product` → `inventory/products/[id]`
6. `contacts.contact` → `contacts/[id]`
7. `hr.employee` → `hr/employees/[id]`
8. `accounting.account` → `accounting/accounts/[id]` (consolidar ledger)
9. `accounting.fiscalyear` → `accounting/closures/[id]`
10. `treasury.treasurymovement` → `treasury/movements/[id]`
11. `treasury.treasuryaccount` → `treasury/accounts/[id]`

### Prioridad 3 — Read-only + módulos nuevos · T-76, T-77

12. `inventory.stockmove` → `inventory/stock-moves/[id]` (readonly)
13. `treasury.possession` → `treasury/sessions/[id]` (readonly)
14. `treasury.bankstatement` → `treasury/statements/[id]` (readonly)
15. `production.workorder` → `production/orders/[id]`
16. `hr.payroll` → ya existe, solo corregir `apps.py`
17. `accounting.budget` → ya existe, solo corregir `apps.py`

### Prioridad 4 — Módulos sin carpeta existente · T-77

18. `tax.f29declaration` → crear módulo `/tax/`
19. `tax.accountingperiod` → crear `/tax/periods/[id]`
20. `workflow.task` → crear módulo `/workflow/`
21. `sales.saledelivery` → crear `/sales/deliveries/[id]`
22. `sales.salereturn` → crear `/sales/returns/[id]`
23. `inventory.productcategory` → crear `/inventory/categories/[id]`
24. `inventory.warehouse` → crear `/inventory/warehouses/[id]`
25. `core.user` → `settings/users/[id]`
26. `core.attachment` → crear módulo `/files/` (readonly)

---

## Decisiones de T-78 (actualizar `apps.py`)

Una vez que todas las rutas existan, T-78 actualiza los 12 `apps.py` con los valores de la columna `target_list_url` y `target_detail_url_pattern` de esta matriz.

Validación post-T-78:
```bash
grep -rn "ventas\|compras\|contactos\|tesoreria\|rrhh\|contabilidad\|inventario\|produccion\|facturacion\|tareas\|tributario\|archivos\|configuracion" backend/*/apps.py
# debe retornar 0 ocurrencias
```
