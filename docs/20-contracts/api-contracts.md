---
layer: 20-contracts
doc: api-contracts
status: active
owner: backend-team
last_review: 2026-04-21
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

## Money format

- All monetary amounts: integers in **cents**, field suffix `_cents`.
- Currency implicit (single-currency deployment). Multi-currency = ADR.

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
