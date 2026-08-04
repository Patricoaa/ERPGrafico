---
layer: 20-contracts
doc: api-contracts
status: active
owner: backend-team
last_review: 2026-08-04
stability: contract-changes-require-ADR
---

# API Contracts

Backend REST surface under `/api/`. Every endpoint has request schema, response schema, auth, rate limit. Change = ADR + coordinated frontend update.

## Global conventions

- Base URL: `/api/[app]/` (excepción: `finances` usa `/api/finances/api/...` — ver sección finances).
- Auth: JWT `Authorization: Bearer <access>` on all except `/api/token/*` y `/api/logout/`.
- Content-Type: `application/json` (except uploads).
- Pagination: DRF page-number — `?page=N&page_size=M` (default `page_size=50`, max `200`). Response: `{ count, next, previous, results }`. **Activa globalmente** via `REST_FRAMEWORK.DEFAULT_PAGINATION_CLASS = core.api.pagination.StandardResultsSetPagination` (`config/settings.py`). Contrato cruzado backend↔hook↔DataTable: [pagination-contract.md](./pagination-contract.md). Excepciones documentadas (endpoints que devuelven `T[]` plano): ver [pagination-contract.md](./pagination-contract.md).
- Filtering: `django_filter` query params.
- Ordering: `?ordering=field,-other`.
- Errors: DRF standard — `{ detail }` or `{ field: [msg] }`, vía `core.api.exceptions.erpgrafico_exception_handler`.
- Permisos: `core.api.permissions.StandardizedModelPermissions` por defecto.

## Serializer Integrity & Performance (Zero N+1)

Queda estrictamente **PROHIBIDO** ejecutar consultas a la base de datos (uso del ORM como `.objects.filter()`, `.objects.get()`, `.create()`, `.all()`) dentro de los métodos de cualquier `serializers.Serializer` o `SerializerMethodField`.

*   **Delegación de precarga:** Si un Serializador requiere datos de modelos relacionados, es responsabilidad exclusiva del `ViewSet` precargar esos datos en memoria utilizando `select_related()` o `prefetch_related()` en su queryset.
*   **Iteración en memoria:** Todo método del serializador debe trabajar leyendo la caché en memoria RAM. Ejemplo: En lugar de `Payment.objects.filter(invoice=obj)`, se debe usar `[p for p in obj.payments.all()]` (sabiendo que `payments` fue prefetcheado en el ViewSet).
*   **Motivo:** Ejecutar queries dentro del serializador genera un comportamiento N+1 catastrófico cuando el endpoint retorna listados paginados de 50 o más elementos.

## Status codes

| Code | Meaning |
|------|---------|
| 200 | OK (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No content (DELETE) |
| 400 | Validation error (serializer) |
| 401 | Missing/invalid JWT |
| 403 | Authenticated but forbidden |
| 404 | Not found |
| 409 | Conflict (state transition, duplicate folio) |
| 422 | Business rule violation |
| 429 | Rate limit |
| 5xx | Server error → Sentry |

## Auth endpoints

```
POST   /api/token/             body: {username, password}     → {access, refresh}   (CustomTokenObtainPairView)
POST   /api/token/refresh/     body: {refresh}                → {access}
POST   /api/logout/            (JWT)                          → 205                 (blacklist refresh)
GET    /api/auth/user/         (JWT)                          → CurrentUserSerializer (usuario + rol + empresa)
```

> **No existe `/api/token/verify/`.** La verificación del token se hace en el cliente decodificando el JWT y comprobando expiración; ante `401` se refresca. No añadir el endpoint sin ADR.

## App routes — overview

| App | Base | Key resources |
|-----|------|---------------|
| `accounting` | `/api/accounting/` | `accounts/`, `entries/`, `fiscal-years/`, `budgets/`, `budget-items/`, `settings/` |
| `billing` | `/api/billing/` | `invoices/`, `note-workflows/` |
| `contacts` | `/api/contacts/` | root `contacts/`, `profit-distributions/` |
| `core` | `/api/core/` | `users/`, `groups/`, `company/`, `action-logs/`, `jobs/` + `auth/*`, `audit/`, `entity-prefixes/`, `entity-config/`, `preferences/`, `search/`, `server-time/`, `status/` |
| `finances` | `/api/finances/api/` | `balance-sheet/`, `trial-balance/`, `income-statement/`, `cash-flow/`, `analysis/`, `bi-analytics/`, `report-status/{task_id}/` (solo reportes GET) |
| `hr` | `/api/hr/` | `employees/`, `payrolls/`, `payroll-items/` (nested), `payroll-payments/`, `absences/`, `advances/`, `afps/`, `concepts/`, `global-settings/` |
| `inventory` | `/api/inventory/` | `products/`, `categories/`, `warehouses/`, `moves/`, `uoms/`, `uom-categories/`, `uom-prices/`, `attributes/`, `attribute-values/`, `pricing-rules/`, `subscriptions/`, `documents/`, `counts/` |
| `production` | `/api/production/` | `orders/`, `boms/` |
| `purchasing` | `/api/purchasing/` | `orders/`, `receipts/`, `returns/` |
| `sales` | `/api/sales/` | `orders/`, `deliveries/`, `returns/`, `pos-drafts/`, `settings/`, `pricing/`, `credit_history/` |
| `tax` | `/api/tax/` | `periods/`, `accounting-periods/`, `declarations/`, `payments/` |
| `treasury` | `/api/treasury/` | `accounts/`, `movements/`, `payments/` (= movements), `statements/`, `statement-lines/`, `banks/`, `payment-methods/`, `checks/`, `loans/`, `loan-installments/`, `credit-lines/`, `card-statements/`, `pos-terminals/`, `terminal-batches/`, `terminal-providers/`, `terminal-devices/`, `pos-sessions/`, `dashboard/`, `reconciliation-settings/` |
| `workflow` | `/api/workflow/` | `tasks/`, `notifications/`, `assignment-rules/`, `notification-rules/`, `settings/` |

> **Prefijos de ruta:** los routers registran el **sustantivo real** de cada app (`orders/`, `entries/`, `moves/`, `periods/`, `statements/`, `declarations/`), no nombres largos estilo `journal-entries/`. El frontend mapea a su propia URL de navegación (que puede diferir, p.ej. `/inventory/stock-moves` en el navegador vs `/api/inventory/moves/` en la API).

## Example — SaleOrder resource

```
GET    /api/sales/orders/                list, paginated
POST   /api/sales/orders/                create
GET    /api/sales/orders/{id}/           detail
PATCH  /api/sales/orders/{id}/           partial update
DELETE /api/sales/orders/{id}/           transactional doc — annul via status=CANCELLED, not hard-delete (deletion-policy.md)
GET    /api/sales/orders/{id}/cancel_impact/   preview impacto de cancelación
POST   /api/sales/orders/{id}/confirm/         confirmar
POST   /api/sales/orders/{id}/cancel/          cancelar (solo DRAFT)
POST   /api/sales/orders/{id}/dispatch/        despacho parcial/total
POST   /api/sales/orders/{id}/partial_dispatch/
POST   /api/sales/orders/{id}/annul/           anular (requiere idempotency_key)
POST   /api/sales/orders/{id}/write_off/       castigo
POST   /api/sales/orders/{id}/register_note/   registrar nota (crédito/débito)
POST   /api/sales/orders/{id}/register_merchandise_return/   devolución mercadería
GET    /api/sales/orders/{id}/deliveries/      entregas vinculadas
GET    /api/sales/orders/{id}/comments/        hilo de comentarios (GET/POST)
GET    /api/sales/orders/filter-suggestions/   sugerencias de filtro (server-side)
GET    /api/sales/credit_history/              historial crediticio (top-level)
```

> **No existe `/transition/` genérico** para órdenes de venta. Las transiciones son acciones explícitas (`confirm`, `cancel`, `dispatch`, `annul`, …). El único ViewSet con `transition` es `production` (work orders).

Request schema (create) — mirrored by frontend Zod `SaleOrderCreateSchema`:

```json
{
  "customer_id": "number (id)",
  "items": [
    {"product_id": "number", "quantity": "decimal>0", "unit_price": "decimal>=0"}
  ],
  "delivery_date": "YYYY-MM-DD",
  "notes": "string?"
}
```

Response schema (detail):

```json
{
  "id": "number",
  "number": "int (business identifier — rendered as OV-{number} via ENTITY_REGISTRY)",
  "status": "DRAFT|CONFIRMED|PAYMENT_PENDING|INVOICED|PAID|CANCELLED",
  "customer": { "id": "number", "name": "string" },
  "items": [ /* line items with computed totals */ ],
  "total_net": "decimal",
  "total_tax": "decimal",
  "total": "decimal",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

---

## accounting

Base: `/api/accounting/`

### accounts/

```
GET    /api/accounting/accounts/          list
POST   /api/accounting/accounts/          create
GET    /api/accounting/accounts/{id}/     detail
PATCH  /api/accounting/accounts/{id}/     update
DELETE /api/accounting/accounts/{id}/     delete
```

Request schema (create/update):

```json
{
  "name": "string",
  "code": "string (optional — auto-generated from parent if blank)",
  "account_type": "asset|liability|equity|income|expense",
  "parent": "number (id) | null",
  "is_reconcilable": "boolean",
  "is_selectable": "boolean",
  "bs_category": "string | null",
  "cf_category": "string | null"
}
```

Response key fields:

```json
{
  "id": "number",
  "code": "string",
  "name": "string",
  "account_type": "string",
  "account_type_display": "string",
  "parent": "number | null",
  "is_reconcilable": "boolean",
  "is_selectable": "boolean",
  "balance": "decimal (read-only, computed)",
  "debit_total": "decimal",
  "credit_total": "decimal",
  "is_category": "boolean"
}
```

### entries/ (JournalEntry)

```
GET    /api/accounting/entries/               list (filtros vía JournalEntryFilterSet)
POST   /api/accounting/entries/               create (manual entries)
GET    /api/accounting/entries/{id}/          detail
PATCH  /api/accounting/entries/{id}/          update
```

Response key fields:

```json
{
  "id": "number",
  "display_id": "string (e.g. 'JE-000123')",
  "number": "string",
  "date": "YYYY-MM-DD",
  "description": "string",
  "reference": "string | null",
  "status": "draft|posted",
  "items": [
    { "id": "number", "account": "number", "account_code": "string", "account_name": "string",
      "partner": "number | null", "label": "string", "debit": "decimal", "credit": "decimal" }
  ],
  "source_documents": "array (computed links to originating docs)"
}
```

### fiscal-years/

```
GET    /api/accounting/fiscal-years/                       list
POST   /api/accounting/fiscal-years/<year>/close/          close fiscal year (año, no id)
GET    /api/accounting/fiscal-years/<year>/mappings/       snapshot de mapeos históricos
```

### budgets/ + settings/

```
GET    /api/accounting/budgets/          list
POST   /api/accounting/budgets/          create
GET    /api/accounting/budgets/{id}/     detail
PATCH  /api/accounting/budgets/{id}/     update
DELETE /api/accounting/budgets/{id}/     delete

GET    /api/accounting/budgets/{id}/versus/   comparativo vs real (action)

GET    /api/accounting/settings/          configuración contable (get/put/patch)
GET    /api/accounting/budget-items/      ítems de presupuesto
```

---

## billing

Base: `/api/billing/`

### invoices/

```
GET    /api/billing/invoices/                list, paginated (filtros vía InvoiceFilterSet)
POST   /api/billing/invoices/                create
GET    /api/billing/invoices/{id}/           detail
PATCH  /api/billing/invoices/{id}/           update (limited — use actions for status)
GET    /api/billing/invoices/{id}/cancel_impact/   preview impacto de cancelación
POST   /api/billing/invoices/check_folio/         valida folio disponible (detail=False)
POST   /api/billing/invoices/create_from_order/   crea factura desde una orden (detail=False)
POST   /api/billing/invoices/pos_checkout/        checkout POS (detail=False)
POST   /api/billing/invoices/request_credit/      solicitud de crédito (detail=False)
POST   /api/billing/invoices/{id}/confirm/        confirma/marca POSTED
POST   /api/billing/invoices/{id}/annul/          anula (genera NOTA_CREDITO)
POST   /api/billing/invoices/{id}/cancel/         cancela
POST   /api/billing/invoices/{id}/process_logistics/   procesa logística
```

> **No existen** `complete/`, `issue/` ni un sub-recurso `credit-notes/`. Las notas de crédito se generan via la acción `annul` o el flujo de `note-workflows/`.

Request schema (create via `CreateInvoiceSerializer`):

```json
{
  "order_id": "number",
  "order_type": "sale|purchase",
  "dte_type": "FACTURA|BOLETA|PURCHASE_INV|NOTA_CREDITO|NOTA_DEBITO",
  "payment_method": "CASH|CREDIT|TRANSFER (default: CREDIT)",
  "supplier_invoice_number": "string (optional, for purchase)",
  "document_attachment": "file (optional)",
  "issue_date": "YYYY-MM-DD (optional)",
  "status": "DRAFT|POSTED (default: POSTED)"
}
```

Response key fields:

```json
{
  "id": "number",
  "dte_type": "string",
  "dte_type_display": "string",
  "number": "string | null",
  "date": "YYYY-MM-DD",
  "status": "DRAFT|POSTED|CANCELLED",
  "payment_method": "string",
  "total_net": "decimal",
  "total_tax": "decimal",
  "total": "decimal",
  "pending_amount": "decimal (computed)",
  "partner_name": "string (computed)",
  "partner_id": "number (computed)",
  "sale_order": "number | null",
  "purchase_order": "number | null",
  "lines": "array (computed from order or note lines)",
  "serialized_payments": "array of TreasuryMovement",
  "attachments": "array",
  "work_orders": "array (for NOTA_DEBITO only)"
}
```

Note: monetary amounts are plain `decimal`, NOT cents. The `_cents` convention in the SaleOrder example is legacy documentation — actual DB/serializer values are decimals (CLP integers stored without fraction).

### note-workflows/ (NotaWorkflow)

Flujo de notas de crédito/débito generadas desde una factura.

```
GET    /api/billing/note-workflows/          list
POST   /api/billing/note-workflows/          create
GET    /api/billing/note-workflows/{id}/     detail
PATCH  /api/billing/note-workflows/{id}/     update
```

---

## contacts

Base: `/api/contacts/`

### contacts/ (root resource)

```
GET    /api/contacts/                list, paginated
POST   /api/contacts/                create
GET    /api/contacts/{id}/           detail
PATCH  /api/contacts/{id}/           update
DELETE /api/contacts/{id}/           delete
```

Filter params: `?is_default_customer=true`, `?is_default_vendor=true`, `?is_partner=true`, `?search=name_or_rut`

Request schema (create/update — partial):

```json
{
  "name": "string",
  "tax_id": "string (RUT, e.g. '12345678-9')",
  "contact_name": "string | null",
  "email": "string | null",
  "phone": "string | null",
  "address": "string | null",
  "is_default_customer": "boolean",
  "is_default_vendor": "boolean",
  "credit_enabled": "boolean",
  "credit_limit": "decimal | null",
  "credit_days": "number | null",
  "is_partner": "boolean"
}
```

Response key fields (ContactSerializer — full):

```json
{
  "id": "number",
  "code": "string",
  "display_id": "string",
  "name": "string",
  "tax_id": "string",
  "contact_type": "PERSON|COMPANY (computed from tax_id)",
  "is_customer": "boolean (computed)",
  "is_supplier": "boolean (computed)",
  "credit_balance_used": "decimal",
  "credit_available": "decimal",
  "credit_risk_level": "string",
  "is_partner": "boolean",
  "partner_net_equity": "decimal (computed)"
}
```

List view uses `ContactListSerializer` (lighter subset of the same fields).

### profit-distributions/

```
GET    /api/contacts/profit-distributions/           list
POST   /api/contacts/profit-distributions/           create
GET    /api/contacts/profit-distributions/{id}/      detail
POST   /api/contacts/profit-distributions/{id}/approve/   action
POST   /api/contacts/profit-distributions/{id}/execute/   action
```

---

## inventory

Base: `/api/inventory/`

### products/

```
GET    /api/inventory/products/          list, paginated (filtros: active, category, product, supplier, uom)
POST   /api/inventory/products/          create (multipart/form-data for image)
GET    /api/inventory/products/{id}/     detail
PATCH  /api/inventory/products/{id}/     update
DELETE /api/inventory/products/{id}/     soft-delete (sets active=false)
GET    /api/inventory/products/analytics/    agregación servidor (ProductAnalyticsService)
```

Request schema (create/update key fields — partial; see serializer for full schema):

```json
{
  "name": "string",
  "code": "string",
  "internal_code": "string | null",
  "category": "number (id)",
  "product_type": "STORABLE|MANUFACTURABLE|SERVICE|SUBSCRIPTION",
  "uom": "number (id)",
  "sale_uom": "number (id) | null",
  "purchase_uom": "number (id) | null",
  "sale_price": "decimal",
  "cost_price": "decimal",
  "track_inventory": "boolean",
  "can_be_sold": "boolean",
  "can_be_purchased": "boolean",
  "has_variants": "boolean",
  "boms": "array (BOM objects with lines)"
}
```

Response key fields:

```json
{
  "id": "number",
  "code": "string",
  "internal_code": "string | null",
  "name": "string",
  "product_type": "string",
  "uom": "number",
  "uom_name": "string",
  "category_name": "string",
  "current_stock": "float (computed)",
  "qty_available": "float (computed, stock - reserved)",
  "qty_reserved": "float (computed)",
  "sale_price": "decimal",
  "sale_price_gross": "decimal (with IVA)",
  "has_bom": "boolean",
  "requires_advanced_manufacturing": "boolean",
  "has_variants": "boolean",
  "variants": "array (ProductSimpleSerializer)",
  "boms": "array (BOM with lines)"
}
```

### warehouses/

```
GET    /api/inventory/warehouses/       list
POST   /api/inventory/warehouses/       create
PATCH  /api/inventory/warehouses/{id}/  update
```

### moves/ (StockMove)

Ruta real del router: `/api/inventory/moves/` (`StockMoveViewSet`, basename `stockmove`).
Nota: `/inventory/stock-moves/` en el frontend es solo la ruta de navegación de detalle (redirige a la lista con `?selected=`).

```
GET    /api/inventory/moves/              list, paginated (filtros vía StockMoveFilter)
GET    /api/inventory/moves/{id}/         detail
GET    /api/inventory/moves/analytics/    analytics — agregación servidor para el panel (ADR-0058)
```

List filters (`GET /api/inventory/moves/`):

| Param | Type | Description |
|-------|------|-------------|
| `product_id` | int | Filtrar por producto |
| `product_name` | string | Filtro `icontains` por nombre de producto |
| `source_location_id` | int | Filtrar por ubicación origen |
| `destination_location_id` | int | Filtrar por ubicación destino |
| `date_from` / `date_to` | `YYYY-MM-DD` | Rango de fechas |
| `direction` | `IN\|OUT\|TRANSFER\|ADJUSTMENT\|OTHER` | Tipo de movimiento (clasificación derivada de ubicaciones) |

Response key fields:

```json
{
  "id": "number",
  "reference_code": "string (e.g. 'MOV-000042')",
  "product": "number",
  "product_name": "string",
  "quantity": "decimal (siempre positivo; la dirección se expone en `direction`)",
  "direction": "IN | OUT | TRANSFER | ADJUSTMENT | OTHER — clasificado por tipos de ubicación",
  "uom_name": "string",
  "warehouse": "number",
  "warehouse_name": "string",
  "move_type_display": "string",
  "date": "YYYY-MM-DD",
  "related_documents": "array"
}
```

Analytics query params (todos opcionales):

| Param | Type | Description |
|-------|------|-------------|
| `granularity` | `day\|month\|year` (default `month`) | Truncamiento del período para series/agrupaciones |
| `months` | int (default `12`) | Ventana retroactiva (ignorado si viene `date_from`) |
| `product_id` | int | Filtrar por producto |
| `product_name` | string | Filtro `icontains` por nombre de producto |
| `source_location_id` | int | Filtrar por ubicación origen |
| `destination_location_id` | int | Filtrar por ubicación destino |
| `date_from` / `date_to` | `YYYY-MM-DD` | Rango de fechas (override de `months`) |

Analytics response shape (`StockMoveAnalyticsService.get_consolidated`):

```json
{
  "flow_trend": [ { "period": "YYYY-MM-DD", "count": "int", "entradas": "decimal", "salidas": "decimal", "ajustes": "decimal", "transferencias": "decimal" } ],
  "value_trend": [ { "period": "YYYY-MM-DD", "entrada": "decimal", "salida": "decimal", "ajuste": "decimal", "transferencia": "decimal", "total": "decimal" } ],
  "direction_distribution": [ { "id": "IN|OUT|TRANSFER|ADJUSTMENT|OTHER", "label": "string", "count": "int", "quantity": "decimal", "amount": "decimal" } ],
  "top_products": [ { "product_id": "number", "product_name": "string", "quantity": "decimal", "amount": "decimal" } ],
  "category_distribution": [ { "id": "string", "value": "float" } ],
  "location_distribution": [ { "id": "string", "value": "int", "in": "int", "out": "int" } ],
  "summary": { "total_movements": "int", "total_in_qty": "decimal", "total_out_qty": "decimal", "total_adjustment_qty": "decimal", "total_value": "decimal" }
}
```

Dirección del movimiento (clasificada en DB, prioridad TRANSFER > ADJUSTMENT > IN > OUT > OTHER): ver ADR-0058.

### Otros recursos de master data

```
GET/POST/PATCH/DELETE   /api/inventory/categories/        categorías de producto
GET/POST/PATCH/DELETE   /api/inventory/uoms/              unidades de medida
GET/POST/PATCH/DELETE   /api/inventory/uom-categories/    categorías de UoM
GET/POST/PATCH/DELETE   /api/inventory/attributes/        atributos (color, talla, …)
GET/POST/PATCH/DELETE   /api/inventory/attribute-values/  valores de atributo
GET/POST/PATCH/DELETE   /api/inventory/pricing-rules/     reglas de precio
GET/POST/PATCH/DELETE   /api/inventory/subscriptions/     suscripciones de producto
GET/POST/PATCH/DELETE   /api/inventory/uom-prices/        precios por UoM
GET/POST/PATCH/DELETE   /api/inventory/documents/         documentos de inventario (InventoryDocument)
GET/POST/PATCH/DELETE   /api/inventory/counts/            conteos (InventoryCount)
```

---

## purchasing

Base: `/api/purchasing/`

### orders/ (PurchaseOrder)

```
GET    /api/purchasing/orders/                list, paginated (filtros vía PurchaseOrderFilterSet)
POST   /api/purchasing/orders/                create
GET    /api/purchasing/orders/{id}/           detail
PATCH  /api/purchasing/orders/{id}/           update
GET    /api/purchasing/orders/{id}/cancel_impact/   preview impacto de cancelación
POST   /api/purchasing/orders/{id}/confirm/          action — confirmar
POST   /api/purchasing/orders/{id}/receive/          action — registrar recepción
POST   /api/purchasing/orders/{id}/cancel/           action — cancelar
POST   /api/purchasing/orders/{id}/annul/            action — anular
```

Request schema (create/update via `WritePurchaseOrderSerializer`):

```json
{
  "supplier": "number (contact id)",
  "warehouse": "number",
  "work_order": "number | null",
  "notes": "string | null",
  "supplier_reference": "string | null",
  "payment_method": "string | null",
  "lines": [
    { "product": "number", "quantity": "decimal", "uom": "number", "unit_cost": "decimal", "tax_rate": "decimal" }
  ]
}
```

Response key fields (`PurchaseOrderSerializer`):

```json
{
  "id": "number",
  "number": "string",
  "display_id": "string (e.g. 'OC-000042')",
  "supplier": "number",
  "supplier_name": "string",
  "warehouse_name": "string",
  "date": "YYYY-MM-DD",
  "status": "string",
  "total_net": "decimal",
  "total_tax": "decimal",
  "total": "decimal",
  "total_paid": "decimal (computed)",
  "pending_amount": "decimal (computed)",
  "is_invoiced": "boolean (computed)",
  "lines": "array (PurchaseLineSerializer)",
  "related_documents": "object {invoices, notes, receipts, payments}"
}
```

### receipts/ + returns/

```
GET    /api/purchasing/receipts/          list
POST   /api/purchasing/receipts/          create (genera StockMove IN)
GET    /api/purchasing/receipts/{id}/     detail

GET    /api/purchasing/returns/           list
POST   /api/purchasing/returns/           create
GET    /api/purchasing/returns/{id}/      detail
POST   /api/purchasing/returns/{id}/annul/   action
```

---

## treasury

Base: `/api/treasury/`

### accounts/ (TreasuryAccount)

```
GET    /api/treasury/accounts/          list (filtros vía TreasuryAccountFilterSet)
POST   /api/treasury/accounts/          create
GET    /api/treasury/accounts/{id}/     detail
PATCH  /api/treasury/accounts/{id}/     update
```

Response key fields:

```json
{
  "id": "number",
  "name": "string",
  "code": "string",
  "account_type": "BANK|CASH|CARD|OTHER",
  "account": "number (linked accounting account id)",
  "account_name": "string",
  "bank": "number | null",
  "current_balance": "decimal (read-only, computed)",
  "allows_cash": "boolean",
  "allows_card": "boolean",
  "allows_transfer": "boolean",
  "payment_methods": "array (PaymentMethodSerializer)"
}
```

### movements/ (TreasuryMovement / payments)

```
GET    /api/treasury/movements/          list, paginated
POST   /api/treasury/movements/          create payment or cash movement
GET    /api/treasury/movements/{id}/     detail
PATCH  /api/treasury/movements/{id}/     update (limited)
DELETE /api/treasury/movements/{id}/     delete
GET    /api/treasury/movements/analytics/  analytics — agregación servidor para el panel (ADR-0058)
POST   /api/treasury/movements/{id}/cancel/   action — cancelar
GET    /api/treasury/movements/{id}/cancel_impact/
POST   /api/treasury/movements/{id}/annul/    action — anular (reverso)
GET    /api/treasury/movements/current/       sesión/caja actual (detail=False)
POST   /api/treasury/movements/open_session/  abrir sesión
POST   /api/treasury/movements/{id}/close_session/   cerrar sesión
```

> `/api/treasury/payments/` registra el **mismo** `TreasuryMovementViewSet` (basename `treasury-payment`) — es un alias de router, no un ViewSet distinto. **No existe `/movements/{id}/reconcile/`**: la conciliación vive en los statements (ver abajo).

Filter params: `?is_reconciled=true|false`, `?movement_type=INBOUND|OUTBOUND|TRANSFER`, `?payment_method=<id>`, `?contact=<id>`, `?bank=<id>`, `?treasury_account=<id>`, `?date=YYYY-MM-DD`, `?date_from=YYYY-MM-DD`, `?date_to=YYYY-MM-DD`, `?amount_min=<num>`, `?amount_max=<num>`, `?direction=IN|OUT`, `?search=<text>`

Analytics params: `?granularity=day|month|year` (default `month`), `?months=12` (default), `?treasury_account=<id>`, `?bank=<id>`, `?movement_type=INBOUND|OUTBOUND|TRANSFER|ADJUSTMENT|CREDIT_LINE_DRAW|CREDIT_LINE_REPAY`, `?payment_method=CASH|CARD|TRANSFER|...`, `?amount_min=<num>`, `?amount_max=<num>`, `?date_from=YYYY-MM-DD`, `?date_to=YYYY-MM-DD`. Los movimientos `CANCELLED` siempre se excluyen. Direcciones: `CREDIT_LINE_DRAW`→Egresos, `CREDIT_LINE_REPAY`→Ingresos.

Analytics response shape:

```json
{
  "flow_trend": [{ "period": "YYYY-MM", "count": "int", "ingresos": "decimal", "egresos": "decimal", "ajustes": "decimal", "transferencias": "decimal" }],
  "direction_distribution": [{ "id": "IN|OUT|TRANSFER|ADJUSTMENT", "label": "string", "count": "int", "amount": "decimal" }],
  "account_distribution": [{ "id": "number|null", "account_name": "string", "count": "int", "in": "decimal", "out": "decimal" }],
  "payment_method_distribution": [{ "id": "string", "label": "string", "count": "int", "amount": "decimal" }],
  "type_distribution": [{ "id": "string", "label": "string", "count": "int", "amount": "decimal" }],
  "summary": { "total_movements": "int", "ingresos_count": "int", "egresos_count": "int", "ingresos_amount": "decimal", "egresos_amount": "decimal", "ajustes_amount": "decimal", "transfer_amount": "decimal", "net_flow": "decimal" }
}
```

Response key fields (`TreasuryMovementSerializer`):

```json
{
  "id": "number",
  "display_id": "string (e.g. 'PAY-000123')",
  "amount": "decimal",
  "date": "YYYY-MM-DD",
  "payment_method": "string",
  "movement_type": "INBOUND|OUTBOUND|TRANSFER",
  "status": "POSTED|PENDING|RECONCILED (computed)",
  "account": "number (treasury account id)",
  "account_name": "string",
  "partner_name": "string (computed)",
  "invoice": "number | null",
  "sale_order": "number | null",
  "purchase_order": "number | null",
  "is_reconciled": "boolean",
  "is_pending_registration": "boolean"
}
```

### statements/ (BankStatement) + statement-lines/

```
GET    /api/treasury/statements/                    list
POST   /api/treasury/statements/                    import (multipart) — ver import-csv-xlsx.md
GET    /api/treasury/statements/{id}/               detail (includes lines)
GET    /api/treasury/statements/formats/            formatos de import disponibles
POST   /api/treasury/statements/{id}/auto_match/    conciliación automática (async)
GET    /api/treasury/statements/{id}/auto_match_status/
POST   /api/treasury/statements/{id}/confirm/       confirmar conciliación
POST   /api/treasury/statements/{id}/unmatch/       desconciliar
GET    /api/treasury/statements/{id}/suggested_difference/
GET    /api/treasury/statements/{id}/match/         match manual (statement line)

GET    /api/treasury/statement-lines/               líneas de estado de cuenta
GET    /api/treasury/statement-lines/{id}/          detail
```

La conciliación se opera sobre `statement-lines` (métodos `match` / `unmatch` en el workbench) y las acciones `confirm` / `auto_match` del statement.

### loans/ (BankLoan) — F2.11

Crédito bancario (CLP o UF). `liability_account` debe ser de tipo
`CREDIT_CARD` (única `LIABILITY` en taxonomía vigente, ADR-0031).

```
GET    /api/treasury/loans/                       list (filtros: status, currency, lender, amortization_system)
POST   /api/treasury/loans/                       create (DRAFT)
GET    /api/treasury/loans/{id}/                  detail
PATCH  /api/treasury/loans/{id}/                  update (campos editables)
DELETE /api/treasury/loans/{id}/                  delete (solo DRAFT)
POST   /api/treasury/loans/{id}/disburse/         action — genera tabla + INBOUND al banco + ACTIVE (idempotente)
POST   /api/treasury/loans/{id}/prepay/           action — pago total anticipado (payload: payment_account, date?, interest_expense_account?, insurance_expense_account?)
POST   /api/treasury/loans/{id}/refinance/        action — marca REFINANCED + cancela pendientes (payload: notes?)
GET    /api/treasury/loans/{id}/schedule/         preview de tabla sin persistir (solo si no hay tabla ya)
GET    /api/treasury/loans/{id}/amortization_table/  tabla persistida con cuotas
```

Display IDs: `CRE-{id}` para el crédito, `CUO-{id}` para cada cuota.

### loan-installments/ (LoanInstallment) — F2.11

Solo lectura + pago. La creación de cuotas es interna (`generate_schedule`).

```
GET    /api/treasury/loan-installments/           list (filtros: status, loan)
GET    /api/treasury/loan-installments/{id}/      detail
POST   /api/treasury/loan-installments/{id}/pay/  action — paga la cuota (payload: payment_account, date?, interest_expense_account?, insurance_expense_account?)
```

Si el crédito es UF, `pay` convierte usando
`IndicatorValue.get_value('UF', pay_date)` y persiste el valor en
`uf_value_used`.

### card-statements/ (CreditCardStatement) — F3.5

Estado de cuenta mensual de la tarjeta de crédito propia. `card_account`
debe ser de tipo `CREDIT_CARD` (LIABILITY, ADR-0031).

```
GET    /api/treasury/card-statements/                    list (filtros: status, card_account, period_year, period_month)
POST   /api/treasury/card-statements/                    create (OPEN)
GET    /api/treasury/card-statements/{id}/               detail
PATCH  /api/treasury/card-statements/{id}/               update (campos editables)
DELETE /api/treasury/card-statements/{id}/               delete
POST   /api/treasury/card-statements/{id}/pay/           action — pagar (payload: payment_account, date?)
POST   /api/treasury/card-statements/{id}/apply-charges/ action — imputar interés/comisiones (payload: interest_expense_account?, fees_expense_account?)
POST   /api/treasury/card-statements/{id}/cancel/        action — anular (payload: notes?)
GET    /api/treasury/card-statements/analytics/          analytics de tarjeta (CardAnalyticsService)
```

Display ID: `EST-{id}`. El pago crea una TRANSFER banco→tarjeta (ADR-0034).

### Otros recursos de tesorería

```
GET/POST/PATCH/DELETE   /api/treasury/banks/                    bancos
GET/POST/PATCH/DELETE   /api/treasury/payment-methods/          métodos de pago
GET/POST/PATCH/DELETE   /api/treasury/checks/                   cheques (CheckService: receive/issue)
GET/POST/PATCH/DELETE   /api/treasury/credit-lines/             líneas de crédito (ADR-0049/0050)
GET/POST/PATCH/DELETE   /api/treasury/pos-terminals/            terminales POS
GET/POST/PATCH/DELETE   /api/treasury/terminal-batches/         lotes de terminal
GET/POST/PATCH/DELETE   /api/treasury/terminal-providers/       proveedores de terminal
GET/POST/PATCH/DELETE   /api/treasury/terminal-devices/         dispositivos de terminal
GET/POST/PATCH/DELETE   /api/treasury/pos-sessions/             sesiones POS
GET/POST/PATCH/DELETE   /api/treasury/reconciliation-settings/  settings de conciliación
GET                     /api/treasury/dashboard/                dashboard agregado
```

---

## production

Base: `/api/production/`

### orders/ (WorkOrder)

```
GET    /api/production/orders/                  list, paginated
POST   /api/production/orders/                  create
GET    /api/production/orders/{id}/             detail
PATCH  /api/production/orders/{id}/             update
DELETE /api/production/orders/{id}/             delete
POST   /api/production/orders/create_manual/    create manual (detail=False)
POST   /api/production/orders/{id}/transition/  action — transición de etapa (body: to_stage, comment?)
POST   /api/production/orders/{id}/advance/     no existe — usar transition
POST   /api/production/orders/{id}/annul/       action — anular
POST   /api/production/orders/{id}/rectify/     action — rectificar
POST   /api/production/orders/{id}/duplicate/   action — duplicar
PATCH  /api/production/orders/{id}/update_section/   action — actualizar sección
POST   /api/production/orders/{id}/restart/     action — reiniciar
POST   /api/production/orders/{id}/add_material/     action — agregar material
POST   /api/production/orders/{id}/update_material/  action — actualizar material
POST   /api/production/orders/{id}/remove_material/  action — quitar material
GET    /api/production/orders/{id}/print_pdf/   action — PDF (WeasyPrint)
POST   /api/production/orders/bulk_transition/  action — transición masiva (detail=False)
POST   /api/production/orders/bulk_print/       action — impresión masiva (detail=False)
GET    /api/production/orders/{id}/comments/    hilo de comentarios (GET/POST)
GET    /api/production/orders/metrics/          métricas agregadas (detail=False)
```

Filter params: `?status=DRAFT|IN_PROGRESS|DONE`, `?product=<id>`, `?search=<text>`, `?active=true|false`

Response key fields (`WorkOrderSerializer` — partial; see serializer for full schema):

```json
{
  "id": "number",
  "number": "string",
  "display_id": "string (e.g. 'OT-000042')",
  "status": "string",
  "product_name": "string",
  "product_info": "object (read-only)",
  "sale_order": "number | null",
  "sale_order_number": "string | null",
  "sale_customer_name": "string (computed)",
  "quantity": "decimal",
  "warehouse": "number",
  "materials": "array (WorkOrderMaterialSerializer)",
  "consumptions": "array (ProductionConsumptionSerializer)",
  "stage_history": "array",
  "attachments": "array",
  "requires_prepress": "boolean (computed)",
  "requires_press": "boolean (computed)",
  "requires_postpress": "boolean (computed)"
}
```

### boms/ (Bill of Materials)

```
GET    /api/production/boms/           list
POST   /api/production/boms/           create
GET    /api/production/boms/{id}/      detail
PATCH  /api/production/boms/{id}/      update
DELETE /api/production/boms/{id}/      delete
```

---

## hr

Base: `/api/hr/`

### employees/

```
GET    /api/hr/employees/          list, paginated
POST   /api/hr/employees/          create
GET    /api/hr/employees/{id}/     detail
PATCH  /api/hr/employees/{id}/     update
```

Request schema (create/update key fields):

```json
{
  "contact": "number (contact id — person)",
  "position": "string",
  "department": "string | null",
  "start_date": "YYYY-MM-DD",
  "status": "ACTIVE|INACTIVE|ON_LEAVE",
  "contract_type": "string",
  "base_salary": "decimal",
  "afp": "number (id)",
  "salud_type": "FONASA|ISAPRE",
  "jornada_type": "string",
  "jornada_hours": "number",
  "gratificacion": "boolean",
  "concept_amounts": [{ "concept": "number", "amount": "decimal" }]
}
```

Response key fields:

```json
{
  "id": "number",
  "code": "string",
  "display_id": "string",
  "contact_detail": { "id": "number", "name": "string", "tax_id": "string" },
  "position": "string",
  "status": "string",
  "status_display": "string",
  "base_salary": "decimal",
  "afp_detail": "object",
  "concept_amounts": "array"
}
```

### payrolls/

```
GET    /api/hr/payrolls/                    list, paginated
POST   /api/hr/payrolls/                    create (llama initialize_after_create interno)
GET    /api/hr/payrolls/{id}/               detail
PATCH  /api/hr/payrolls/{id}/               update
DELETE /api/hr/payrolls/{id}/               delete

# Actions
POST   /api/hr/payrolls/{id}/post_payroll/  Contabiliza (crea JournalEntry)
POST   /api/hr/payrolls/{id}/recalculate/   Recalcula haberes/descuentos/totales
POST   /api/hr/payrolls/{id}/pay_previred/  Registra pago Previred → 201 PayrollPaymentSerializer
POST   /api/hr/payrolls/{id}/pay_salary/    Registra pago salario → 201 PayrollPaymentSerializer
GET    /api/hr/payrolls/{id}/download_pdf/  Descarga PDF liquidación → application/pdf
POST   /api/hr/payrolls/create_draft_payrolls/  Async (Celery): crea borradores del mes
POST   /api/hr/payrolls/generate_proforma/      Genera preview sin guardar (body: employee, year, month)
```

Filter params: `?employee=<id>`, `?period_year=<YYYY>`, `?period_month=<1-12>`, `?status=DRAFT|CONFIRMED|PAID`, `?search=<name>`

Response key fields (detail — `PayrollDetailSerializer`):

```json
{
  "id": "number",
  "number": "string",
  "display_id": "string",
  "employee": "number",
  "employee_detail": "object (EmployeeSerializer)",
  "period_year": "number",
  "period_month": "number",
  "period_label": "string",
  "status": "DRAFT|CONFIRMED|PAID",
  "status_display": "string",
  "base_salary": "decimal",
  "agreed_days": "number",
  "absent_days": "number",
  "worked_days": "number",
  "total_haberes": "decimal (computed)",
  "total_descuentos": "decimal (computed)",
  "net_salary": "decimal (computed)",
  "journal_entry": "number | null",
  "previred_journal_entry": "number | null",
  "items": "array (PayrollItemSerializer)",
  "advances": "array (SalaryAdvanceSerializer)"
}
```

### payroll-items/ (Nested)

Router anidado bajo payroll: `/api/hr/payrolls/{payroll_pk}/items/`. Filtrar por `?payroll=id`.

```json
{
  "id": "number",
  "payroll": "number",
  "concept": "number",
  "concept_detail": "object",
  "description": "string",
  "amount": "decimal",
  "is_previred": "boolean (read_only)"
}
```

### payroll-payments/ (PayrollPayment)

Filtros: `?payroll=id`, `?payment_type=SALARIO|PREVIRED`

```json
{
  "id": "number",
  "payroll": "number",
  "payment_type": "SALARIO|PREVIRED",
  "amount": "decimal",
  "date": "YYYY-MM-DD",
  "notes": "string",
  "journal_entry": "number | null"
}
```

### Otros recursos de RRHH

```
GET/POST/PATCH/DELETE   /api/hr/absences/          ausencias
GET/POST/PATCH/DELETE   /api/hr/advances/          anticipos
GET/POST/PATCH/DELETE   /api/hr/afps/              AFP
GET/POST/PATCH/DELETE   /api/hr/concepts/          conceptos de remuneración
GET/PATCH               /api/hr/global-settings/   settings globales
```

---

## tax

Base: `/api/tax/`

### periods/ (TaxPeriod)

```
GET    /api/tax/periods/          list
GET    /api/tax/periods/{id}/     detail
POST   /api/tax/periods/{id}/close/   action — close period
```

Response key fields:

```json
{
  "id": "number",
  "year": "number",
  "month": "number",
  "month_display": "string",
  "status": "OPEN|CLOSED",
  "declaration_summary": {
    "id": "number",
    "vat_to_pay": "decimal",
    "total_paid": "decimal",
    "is_fully_paid": "boolean",
    "folio_number": "string | null"
  }
}
```

### accounting-periods/

```
GET    /api/tax/accounting-periods/          list
GET    /api/tax/accounting-periods/{id}/     detail
POST   /api/tax/accounting-periods/{id}/close/   action
```

### declarations/ (F29Declaration)

```
GET    /api/tax/declarations/           list
GET    /api/tax/declarations/{id}/      detail
POST   /api/tax/declarations/{id}/pay/  action — register F29 payment
GET    /api/tax/declarations/{id}/pdf/  action — PDF
```

Key computed fields: `net_taxed_sales`, `net_taxed_purchases`, `vat_debit`, `vat_credit`, `total_amount_due`, `vat_to_pay`.

### payments/ (F29Payment)

```
GET    /api/tax/payments/          list
GET    /api/tax/payments/{id}/     detail
```

---

## workflow

Base: `/api/workflow/`

### tasks/

```
GET    /api/workflow/tasks/          list, paginated (filtros: status, priority, task_type, assigned_to, category)
POST   /api/workflow/tasks/          create
GET    /api/workflow/tasks/{id}/     detail
PATCH  /api/workflow/tasks/{id}/     update
DELETE /api/workflow/tasks/{id}/     delete
POST   /api/workflow/tasks/{id}/complete/   action — completar
```

Request schema (create):

```json
{
  "title": "string",
  "description": "string | null",
  "assigned_to": "number (user id) | null",
  "assigned_group": "string (group name) | null",
  "due_date": "YYYY-MM-DD | null",
  "priority": "LOW|MEDIUM|HIGH|URGENT",
  "related_model": "string | null",
  "related_id": "number | null"
}
```

Response key fields:

```json
{
  "id": "number",
  "title": "string",
  "status": "OPEN|IN_PROGRESS|DONE|CANCELLED",
  "assigned_to": "number | null",
  "assigned_to_data": "object (UserSerializer)",
  "assigned_group_name": "string | null",
  "due_date": "YYYY-MM-DD | null",
  "priority": "string",
  "created_by": "number",
  "created_at": "ISO-8601",
  "completed_at": "ISO-8601 | null"
}
```

### notifications/

```
GET    /api/workflow/notifications/         list (own notifications)
POST   /api/workflow/notifications/{id}/mark_read/   action — marcar leída
```

### Otros recursos de workflow

```
GET/POST/PATCH/DELETE   /api/workflow/assignment-rules/    reglas de asignación
GET/POST/PATCH/DELETE   /api/workflow/notification-rules/  reglas de notificación
GET/PUT/PATCH           /api/workflow/settings/            settings
```

---

## finances

Base: `/api/finances/api/` — **nota el doble prefijo**: `config/urls.py` incluye `finances.urls` bajo `api/finances/`, y `finances/urls.py` registra a su vez las rutas bajo `api/`. La URL completa es `/api/finances/api/<reporte>/`.

Esta app expone únicamente reportes (sin CRUD). Todos los endpoints son `GET` (excepto por el parámetro `is_async` que lanza un proceso de fondo).

### Reportes disponibles

```
GET /api/finances/api/balance-sheet/     Balance general
GET /api/finances/api/trial-balance/     Balance de comprobación
GET /api/finances/api/income-statement/  Estado de resultados
GET /api/finances/api/cash-flow/         Flujo de caja
GET /api/finances/api/analysis/          Análisis financiero (ratios)
GET /api/finances/api/bi-analytics/      BI Analytics
GET /api/finances/api/report-status/{task_id}/  Polling de reportes async
```

**Query params comunes (todos los reportes):**
- `start_date` (YYYY-MM-DD): Fecha de inicio
- `end_date` o `date` (YYYY-MM-DD): Fecha de fin
- `comp_start_date` / `comp_end_date`: Fechas para columna de comparación
- `is_async=true`: Dispara ejecución en Celery y devuelve `{ "task_id": "...", "status": "PENDING" }`
- `fiscal_year_id` (int): ID del año fiscal para usar mapeos históricos (snapshot tomado al cierre). Si el año no está cerrado o no tiene snapshot, cae a mapeos vivos.

**Comportamiento Sync:**
Devuelve el JSON del reporte directamente. Los reportes se cachean 90 segundos vía `core.cache.cache_report`. No usan serializers DRF, devuelven el diccionario construido por `FinanceService`.

Response shape (balance-sheet / income-statement / cash-flow):
Árbol jerárquico de nodos (consumido por `ReportTable`).

```json
{
  "data": [
    { 
      "id": "number", 
      "code": "string", 
      "name": "string", 
      "balance": "decimal",
      "comp_balance": "decimal | null", 
      "children": [...] 
    }
  ]
}
```

---

## core

Base: `/api/core/` — usuarios, grupos, empresa, configuración y endpoints de soporte.

```
GET    /api/core/users/           list
POST   /api/core/users/           create
GET    /api/core/users/{id}/      detail
PATCH  /api/core/users/{id}/      update

GET    /api/core/groups/          list (permission groups)

# Empresa y configuración
GET/PUT/PATCH   /api/core/company/              settings de la empresa
GET/PATCH       /api/core/preferences/          preferencias del usuario actual

# Auditoría y jobs
GET    /api/core/action-logs/     log de acciones
GET    /api/core/audit/global/    auditoría global
GET    /api/core/jobs/            background jobs (Celery) + estado

# Soporte (consultados por el frontend en bootstrap)
GET    /api/core/entity-prefixes/   prefijos de display id por entidad
GET    /api/core/entity-config/     configuración de entidades (getEntityConfig)
GET    /api/core/search/            Universal Search
GET    /api/core/server-time/       hora del servidor (useServerDate)
GET    /api/core/status/            estado del sistema

# Auth propio
GET    /api/core/auth/me/               usuario actual
GET    /api/core/auth/my-profile/       perfil del usuario
POST   /api/core/auth/change-password/  cambio de password
POST   /api/core/auth/change-pin/       cambio de PIN
```

> `/api/auth/user/` (top-level, `config/urls.py`) y `/api/core/auth/me/` exponen el mismo usuario actual — `/api/auth/user/` es el punto de entrada del bootstrap de sesión.

---

## Money format

- All monetary amounts: plain **decimal strings** (e.g. `"150000"` for CLP 150.000).
- CLP has no decimal fraction in practice so values are whole numbers, but the field type is `DecimalField`, not integer.
- `DecimalField(max_digits=14, decimal_places=0)` for CLP amounts.
- Currency: CLP implicit. Multi-currency = ADR required.

## ID format

- Primary keys: integer auto-increment PK (ver ADR-0016 — no se migró a UUID).
- Display IDs: `{PREFIJO}-{id}` generados desde `core/api/entity_prefixes` (ej. `OV-`, `OC-`, `JE-`, `PAY-`, `MOV-`, `OT-`, `CRE-`, `CUO-`, `EST-`). Ver [entity-identity.md](./entity-identity.md).

## Date/time

- All datetimes: ISO-8601 UTC (`Z` o `+00:00`). Todo serializer debe usar **un solo formato** — no mezclar `Z` en unos y `+00:00` en otros.
- Date-only: `YYYY-MM-DD`.
- Nunca datetimes naive (sin timezone). `datetime.utcnow()` prohibido — usar `django.utils.timezone.now()`.
- Server clock authoritative — frontend usa `useServerDate`.
- Frontend: prohibido `new Date("YYYY-MM-DD")`. Parsear date-only con `new Date(y, m-1, d)` o utility `parseDateOnly`.

## Versioning

Current: implicit v1 via URL path. Breaking change → `/api/v2/[app]/`, parallel period ≥1 release. ADR required.

### PaymentOrchestrator — CHECK integration (F4.4)

When `PaymentMethod.method_type == 'CHECK'`, the orchestrator branches to `CheckService`
instead of creating a generic `TreasuryMovement`.

**Orchestrator params (CHECK-specific, optional):**

| Param | Type | Description |
|-------|------|-------------|
| `check_bank_id` | int \| None | Banco del cheque. Si None, se resuelve del settlement account. |
| `check_number` | str \| None | Número del cheque. Si checkbook_id se provee, se auto-genera. |
| `check_issue_date` | date \| None | Fecha de emisión. Default: hoy. |
| `check_due_date` | date \| None | Fecha de vencimiento. Default: hoy. |
| `checkbook_id` | int \| None | ID de la chequera para auto-folio. |

**Behavior:**
- `INBOUND` → `CheckService.receive()` → Check `IN_PORTFOLIO`
- `OUTBOUND` → `CheckService.issue()` → Check `ISSUED`
- Return: `Check` instance (not `TreasuryMovement`)

**Purchase checkout** accepts `payment_method_id` + same check params.

**Sale checkout** passes check params through orchestrator.

## Rate limits

Definidos en `REST_FRAMEWORK.DEFAULT_THROTTLE_RATES` (`config/settings.py`), aplicados via `AnonRateThrottle` + `UserRateThrottle`:

| Scope | Limit |
|-------|-------|
| `anon` | 30 req/min |
| `user` | 300 req/min |
| `heavy_report` | 10 req/min (endpoints de reportes pesados) |
| `search` | 60 req/min (Universal Search) |

Los endpoints de acciones de negocio (confirm/annul/disburse) no tienen throttle extra declarado; heredan el scope `user`. Si un endpoint necesita un límite menor, definir un scope dedicado en settings (y documentarlo aquí).

## Idempotency

Los endpoints de escritura de alto riesgo aceptan `Idempotency-Key` (header) — ver [idempotency.md](./idempotency.md) para la lista completa de scopes y el contrato.

## OpenAPI

**No configurado.** `drf-spectacular` no está instalado ni hay `/api/schema/` / `/api/docs/`. La documentación canónica es este contrato. Si se introduce OpenAPI, requiere ADR.
