---
layer: 20-contracts
doc: api-contracts
status: active
owner: backend-team
last_review: 2026-04-23
stability: contract-changes-require-ADR
---

# API Contracts

Backend REST surface under `/api/`. Every endpoint has request schema, response schema, auth, rate limit. Change = ADR + coordinated frontend update.

## Global conventions

- Base URL: `/api/[app]/`
- Auth: JWT `Authorization: Bearer <access>` on all except `/api/token/*`.
- Content-Type: `application/json` (except uploads).
- Pagination: DRF cursor — `?cursor=…&page_size=N` (max 100). Response: `{ next, previous, results }`.
- Filtering: `django_filter` query params.
- Ordering: `?ordering=field,-other`.
- Errors: DRF standard — `{ detail }` or `{ field: [msg] }`.

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
POST   /api/token/            body: {username, password}     → {access, refresh}
POST   /api/token/refresh/    body: {refresh}                → {access}
POST   /api/token/verify/     body: {token}                  → 200/401
```

## App routes — overview

| App | Base | Key resources |
|-----|------|---------------|
| `accounting` | `/api/accounting/` | `journal-entries/`, `accounts/`, `periods/` |
| `billing` | `/api/billing/` | `invoices/`, `credit-notes/`, `folios/` |
| `contacts` | `/api/contacts/` | `customers/`, `suppliers/` |
| `core` | `/api/core/` | `users/`, `roles/` |
| `finances` | `/api/finances/` | `reports/`, `cashflow/` |
| `hr` | `/api/hr/` | `employees/`, `payrolls/` |
| `inventory` | `/api/inventory/` | `items/`, `warehouses/`, `movements/` |
| `production` | `/api/production/` | `work-orders/`, `routes/`, `operations/` |
| `purchasing` | `/api/purchasing/` | `purchase-orders/`, `reconciliations/` |
| `sales` | `/api/sales/` | `orders/`, `quotes/` |
| `tax` | `/api/tax/` | `rates/`, `fiscal-documents/` |
| `treasury` | `/api/treasury/` | `accounts/`, `transactions/`, `reconciliations/` |
| `workflow` | `/api/workflow/` | `transitions/`, `approvals/` |

## Example — SaleOrder resource

```
GET    /api/sales/orders/                list, paginated
POST   /api/sales/orders/                create
GET    /api/sales/orders/{id}/           detail
PATCH  /api/sales/orders/{id}/           partial update
DELETE /api/sales/orders/{id}/           soft-delete
POST   /api/sales/orders/{id}/transition/  body: {to_state, comment?}
```

Request schema (create) — mirrored by frontend Zod `SaleOrderCreateSchema`:

```json
{
  "customer_id": "uuid",
  "items": [
    {"sku": "string", "qty": "int>0", "unit_price_cents": "int>=0"}
  ],
  "delivery_date": "ISO-8601",
  "notes": "string?"
}
```

Response schema (detail):

```json
{
  "id": "uuid",
  "folio": "string",
  "status": "draft|confirmed|in_production|…",
  "customer": { "id": "uuid", "name": "string" },
  "items": [ /* line items with computed totals */ ],
  "totals": { "subtotal_cents": "int", "tax_cents": "int", "total_cents": "int" },
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

### journal-entries/

```
GET    /api/accounting/journal-entries/          list
POST   /api/accounting/journal-entries/          create (manual entries)
GET    /api/accounting/journal-entries/{id}/     detail
PATCH  /api/accounting/journal-entries/{id}/     update
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

### periods/ (fiscal years)

```
GET    /api/accounting/fiscal-years/           list
POST   /api/accounting/fiscal-years/{id}/close/   close fiscal year (action)
```

---

## billing

Base: `/api/billing/`

### invoices/

```
GET    /api/billing/invoices/          list, paginated
POST   /api/billing/invoices/          create
GET    /api/billing/invoices/{id}/     detail
PATCH  /api/billing/invoices/{id}/     update (limited — use actions for status)
DELETE /api/billing/invoices/{id}/     cancel
POST   /api/billing/invoices/{id}/complete/   body: {number, date, document_attachment?} — mark POSTED
```

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
GET    /api/inventory/products/          list, paginated
POST   /api/inventory/products/          create (multipart/form-data for image)
GET    /api/inventory/products/{id}/     detail
PATCH  /api/inventory/products/{id}/     update
DELETE /api/inventory/products/{id}/     soft-delete (sets active=false)
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

### stock-moves/

```
GET    /api/inventory/stock-moves/       list, paginated
POST   /api/inventory/stock-moves/       create (manual adjustment)
GET    /api/inventory/stock-moves/{id}/  detail
```

Response key fields:

```json
{
  "id": "number",
  "reference_code": "string (e.g. 'MOV-000042')",
  "product": "number",
  "product_name": "string",
  "quantity": "decimal (positive = in, negative = out)",
  "uom_name": "string",
  "warehouse": "number",
  "warehouse_name": "string",
  "move_type_display": "string",
  "date": "YYYY-MM-DD",
  "related_documents": "array"
}
```

---

## purchasing

Base: `/api/purchasing/`

### purchase-orders/

```
GET    /api/purchasing/purchase-orders/          list, paginated
POST   /api/purchasing/purchase-orders/          create
GET    /api/purchasing/purchase-orders/{id}/     detail
PATCH  /api/purchasing/purchase-orders/{id}/     update
DELETE /api/purchasing/purchase-orders/{id}/     delete
POST   /api/purchasing/purchase-orders/{id}/confirm/     action — confirm order
POST   /api/purchasing/purchase-orders/{id}/receive/     action — create receipt
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

### purchase-receipts/

```
GET    /api/purchasing/purchase-receipts/          list
POST   /api/purchasing/purchase-receipts/          create
GET    /api/purchasing/purchase-receipts/{id}/     detail
```

### purchase-returns/

```
GET    /api/purchasing/purchase-returns/     list
POST   /api/purchasing/purchase-returns/     create
```

---

## treasury

Base: `/api/treasury/`

### accounts/ (TreasuryAccount)

```
GET    /api/treasury/accounts/          list
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
POST   /api/treasury/movements/{id}/reconcile/  action — reconcile with bank statement line
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

### bank-statements/

```
GET    /api/treasury/bank-statements/            list
POST   /api/treasury/bank-statements/            import (multipart)
GET    /api/treasury/bank-statements/{id}/       detail (includes lines)
POST   /api/treasury/bank-statements/{id}/reconcile/  action
```

---

## production

Base: `/api/production/`

### work-orders/

```
GET    /api/production/work-orders/          list, paginated
POST   /api/production/work-orders/          create
GET    /api/production/work-orders/{id}/     detail
PATCH  /api/production/work-orders/{id}/     update
DELETE /api/production/work-orders/{id}/     delete
POST   /api/production/work-orders/{id}/advance/      action — advance to next stage
POST   /api/production/work-orders/{id}/consume/      action — register material consumption
POST   /api/production/work-orders/{id}/finish/       action — mark finished
```

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

### bom/ (Bill of Materials)

```
GET    /api/production/bom/           list
POST   /api/production/bom/           create
GET    /api/production/bom/{id}/      detail
PATCH  /api/production/bom/{id}/      update
DELETE /api/production/bom/{id}/      delete
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
GET    /api/hr/payrolls/           list
POST   /api/hr/payrolls/           create
GET    /api/hr/payrolls/{id}/      detail
POST   /api/hr/payrolls/{id}/calculate/   action
POST   /api/hr/payrolls/{id}/close/       action
```

---

## tax

Base: `/api/tax/`

### tax-periods/

```
GET    /api/tax/tax-periods/          list
GET    /api/tax/tax-periods/{id}/     detail
POST   /api/tax/tax-periods/{id}/close/   action — close period
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

### f29-declarations/

```
GET    /api/tax/f29-declarations/           list
GET    /api/tax/f29-declarations/{id}/      detail
POST   /api/tax/f29-declarations/{id}/pay/  action — register F29 payment
```

Key computed fields: `net_taxed_sales`, `net_taxed_purchases`, `vat_debit`, `vat_credit`, `total_amount_due`, `vat_to_pay`.

---

## workflow

Base: `/api/workflow/`

### tasks/

```
GET    /api/workflow/tasks/          list, paginated
POST   /api/workflow/tasks/          create
GET    /api/workflow/tasks/{id}/     detail
PATCH  /api/workflow/tasks/{id}/     update
DELETE /api/workflow/tasks/{id}/     delete
POST   /api/workflow/tasks/{id}/complete/   action
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
PATCH  /api/workflow/notifications/{id}/    mark read
```

---

## finances

Base: `/api/finances/`

This app exposes report views only (no CRUD resources). All endpoints are `GET`.

```
GET    /api/finances/balance-sheet/     ?end_date=YYYY-MM-DD&start_date=YYYY-MM-DD&comp_end_date=...
GET    /api/finances/income-statement/  ?start_date=...&end_date=...
GET    /api/finances/cash-flow/         ?start_date=...&end_date=...
GET    /api/finances/report-status/{task_id}/   poll async report generation
```

All report endpoints support `?is_async=true` to return `{ task_id, status: "PENDING" }` for long-running reports (polled via `report-status/`).

Response shape (balance-sheet / income-statement): tree of `ReportNode` objects — same shape consumed by `ReportTable` component.

```json
{
  "data": [
    { "id": "number", "code": "string", "name": "string", "balance": "decimal",
      "comp_balance": "decimal | null", "children": [...] }
  ]
}
```

---

## core

Base: `/api/core/` (users, roles, permissions — partial; see serializer for full schema)

```
GET    /api/core/users/           list
POST   /api/core/users/           create
GET    /api/core/users/{id}/      detail
PATCH  /api/core/users/{id}/      update

GET    /api/core/groups/          list (permission groups)
```

---

## Money format (correction)

The `_cents` convention in the SaleOrder example section above is illustrative only. Actual API monetary values are **plain decimals** (e.g. `"total": "150000.00"` for 150,000 CLP), NOT integer cents. CLP has no decimal fraction in practice so values are whole numbers, but the field type is `DecimalField`, not integer.

## Money format

- All monetary amounts: plain **decimal strings** (e.g. `"150000"` or `"150000.00"`).
- Currency: CLP implicit. Multi-currency = ADR required.
- Money stored as `DecimalField(max_digits=14, decimal_places=0)` for CLP amounts.

## ID format

- Primary keys: UUIDv4 strings.
- Never expose integer auto-increment in API.

## Date/time

- All datetimes: ISO-8601 UTC with `Z` suffix.
- Date-only: `YYYY-MM-DD`.
- Server clock authoritative — frontend uses `useServerDate`.

## Versioning

Current: implicit v1 via URL path. Breaking change → `/api/v2/[app]/`, parallel period ≥1 release. ADR required.

## Rate limits

| Scope | Limit |
|-------|-------|
| Anonymous | 60 req/min |
| Authenticated | 600 req/min |
| `/api/token/` | 5 req/min per IP |

Headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

## OpenAPI

Auto-generated via `drf-spectacular` at `/api/schema/` + Swagger UI at `/api/docs/`. Keep serializer docstrings up to date — they populate the spec.
