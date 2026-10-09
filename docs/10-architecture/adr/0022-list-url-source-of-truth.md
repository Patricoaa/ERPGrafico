---
id: 0022
title: Source of Truth para `list_url` de Entidades Searchables
status: Accepted
date: 2026-05-09
author: core-team
---

# 0022 — Source of Truth para `list_url` de Entidades Searchables

> **Depende de:** ADR-0020 (URL-state pattern), T-88 (`searchableEntityRoutes.ts`). Firmas Stakeholder: @pato.

---

## 1. Contexto

Existen dos lugares que declaran la URL de la lista de cada entidad searchable:

| Lugar | Propósito | Consumidor |
|-------|-----------|------------|
| `UniversalRegistry.list_url` (backend, `<app>/apps.py`) | Metadato de la entidad para el registro universal | API `/api/search/` (campo `list_url` en la respuesta) |
| `searchableEntityRoutes` (frontend, `lib/searchableEntityRoutes.ts`) | Redirect server-side desde `[id]/page.tsx` | Todos los `[id]/page.tsx` que hacen `redirect(<listUrl>?selected=<id>)` |

La auditoría de F9 detectó **5 divergencias** entre ambos mapas, produciendo `list_url` en la respuesta de búsqueda que apuntaban a páginas que ya no existían (o a tabs distintos de los reales):

| Entidad | `list_url` backend (antes) | `searchableEntityRoutes` frontend |
|---------|---------------------------|----------------------------------|
| `accounting.account` | `/accounting/accounts` | `/accounting/ledger` |
| `inventory.productcategory` | `/inventory/categories` | `/inventory/products?tab=categories` |
| `inventory.warehouse` | `/inventory/settings?tab=warehouses` | `/inventory/stock?tab=warehouses` |
| `inventory.stockmove` | `/inventory/stock-moves` | `/inventory/stock?tab=movements` |
| `treasury.bankstatement` | `/treasury/reconciliation` | `/treasury/reconciliation?tab=statements` |

---

## 2. Decisión

**`searchableEntityRoutes.ts` es la única fuente de verdad para las URLs de lista.**

El backend `UniversalRegistry.list_url` DEBE coincidir siempre con el valor en `searchableEntityRoutes`. El test arquitectónico `test_list_url_matches_frontend_routes` (T-103/T-108) fuerza esta invariante en CI.

### Reglas derivadas

1. **Cuando se cambia una ruta de lista** en el frontend, cambiar también el `list_url` correspondiente en `<app>/apps.py`.
2. **Cuando se agrega una nueva entidad** al `UniversalRegistry`, también agregar su entrada en `searchableEntityRoutes.ts`.
3. **Las excepciones** (entidades con vista standalone, no modal-on-list) se documentan con un comentario en ambos archivos y pueden omitirse de `searchableEntityRoutes` si no tienen deeplink por URL-state.

### Excepciones conocidas (F9)

| Entidad | Motivo |
|---------|--------|
| `accounting.budget` | Vista standalone `/finances/budgets/[id]` — no usa redirect modal. `list_url='/finances/budgets'` permanece en el backend; frontend no lo consume. |
| `hr.payroll` | Vista standalone `/hr/payrolls/[id]` — mismo caso que Budget. |
| `billing.invoice` | Split client-side (`is_sale_document`) — no aplica el patrón standard. |

### Excepciones T-108 — entidades drawer/tab-only (oct 2026)

El invariante T-103/T-79 asumía que TODA entidad searchable tiene lista y detalle
en rutas propias. La auditoría de T-108 reveló dos categorías que no:

**`DRAWER_ENTITIES`** — entidades SIN página de lista propia. Viven como drawer
(launch desde otra lista) o como tab/sección dentro de una página padre. Se omiten
de ambos invariantes (`test_list_url_matches_frontend_routes` y
`test_search_routes_match_app_router`). Sus `list_url`:
`/purchasing/orders` (returns/receipts), `/contacts` (partnertransaction),
`/finances/partners/distributions` (profitdistributionresolution),
`/treasury/bank-center` (bankloan, creditcardstatement, cardpurchasegroup,
cardpurchaseinstallment, loaninstallment, creditline), `/hr/settings/concepts`
(payrollconcept).

**`DRAWER_DETAIL_ENTITIES`** — entidades CON lista propia (su `list_url` se valida
contra `searchableEntityRoutes`), pero su detalle es un drawer: no existe
`[id]/page.tsx`. Se omiten solo del invariante de detalle (T-79). Actuales:
`production.bom`, `treasury.check`, `treasury.paymentmethod`,
`treasury.treasurymovement`, `treasury.treasuryaccount`, `hr.absence`,
`hr.salaryadvance`, `sales.saledelivery`, `inventory.inventorydocument`.

---

## 3. Implementación

### 3.1 Alineación inicial (T-103, 2026-05-09)

Los 5 `list_url` divergentes del backend fueron corregidos para coincidir con `searchableEntityRoutes`:

```python
# inventory/apps.py
list_url='/inventory/products?tab=categories'  # era /inventory/categories
list_url='/inventory/stock?tab=warehouses'      # era /inventory/settings?tab=warehouses
list_url='/inventory/stock?tab=movements'       # era /inventory/stock-moves

# accounting/apps.py
list_url='/accounting/ledger'                  # era /accounting/accounts

# treasury/apps.py
list_url='/treasury/reconciliation?tab=statements'  # era /treasury/reconciliation
```

### 3.2 Test arquitectónico (T-108)

Se agrega `test_list_url_matches_frontend_routes` a `backend/core/tests/test_architectural_invariants.py`.

El test:
1. Parsea `frontend/lib/searchableEntityRoutes.ts` con regex para extraer el mapa `label → list_url`.
2. Itera `UniversalRegistry._entities` y compara `entity.list_url` contra el mapa del frontend.
3. Falla con mensaje explicativo si hay divergencia.
4. Ignora explícitamente las excepciones documentadas (Budget, Payroll, Invoice).

### 3.3 Reconciliación T-108 (2026-10-09)

La auditoría T-108 constató que el mapa frontend contenía rutas que ya no existían
en el App Router (el propio `searchableEntityRoutes` se había quedado obsoleto) y
que varias entidades del `UniversalRegistry` eran drawer/tab-only sin ruta posible.

Correcciones de `list_url` (backend + frontend alineados contra páginas reales):

| Entidad | `list_url` corregido | Página real |
|---------|---------------------|-------------|
| `accounting.budget` | `/finances/budgets` (era `/finance/budgets`) | `/finances/budgets` |
| `sales.saledelivery` | `/sales/orders/deliveries` (era `/sales/deliveries`) | `/sales/orders/deliveries` |
| `inventory.stockmove` | `/inventory/reports/movements` (era `/inventory/stock/movements`) | `MovementClientView` en `/inventory/reports/movements` |
| `inventory.warehouse` | `/inventory/operations/warehouses` (era `/inventory/stock/warehouses`) | `WarehouseClientView` en `/inventory/operations/warehouses` |
| `treasury.bankstatement` | `/treasury/reconciliation` (era `/treasury/reconciliation/statements`) | `StatementsClientView` en `/treasury/reconciliation` |
| `treasury.check` | `/treasury/operaciones/checks` (era `/treasury/operaciones/movements`) | `/treasury/operaciones/checks` |
| `tax.taxperiod` | `/tax/periods` (era `/tax/declarations`) | `/tax/periods` |

Detalles corregidos:

| Entidad | `detail_url_pattern` corregido |
|---------|-------------------------------|
| `accounting.budget` | `/finances/budgets/{id}` (typo `/finance/...`) |
| `contacts.partnertransaction` | `/contacts` (parent, DRAWER_ENTITIES) |
| `contacts.profitdistributionresolution` | `/finances/partners/distributions` (parent, DRAWER_ENTITIES) |
| `purchasing.purchasereturn` / `purchasereceipt` | `/purchasing/orders` (parent, DRAWER_ENTITIES) |
| `treasury.bankloan` / `loaninstallment` | `/treasury/bank-center` (hub, DRAWER_ENTITIES) |
| `treasury.creditcardstatement` | `/treasury/bank-center` (se dropea `?statement=`) |
| `hr.payrollconcept` | `/hr/settings/concepts` |

Los redirects `[id]/page.tsx` que usaban `&selected=` sobre `list_url` sin query
(`inventory/warehouses`, `inventory/stock-moves`, `inventory/categories`,
`treasury/statements`) se corrigen a `?selected=` para no producir URLs rotas.

---

## 4. Trade-offs

| Trade-off | Mitigación |
|-----------|------------|
| El backend parsea un archivo TypeScript | Regex simple — el formato del objeto `searchableEntityRoutes` es estable y no usa sintaxis compleja. Si cambia el formato, el test falla ruidosamente. |
| `list_url` en la respuesta de API casi nunca se consume en el frontend | El campo sigue siendo útil para depuración y para clientes externos de la API. Mantenerlo sincronizado tiene coste negligible. |

---

## Changelog

- **2026-05-09**: ADR creado (F9, T-103). 5 divergencias corregidas en backend. Test arquitectónico agregado.
- **2026-10-09**: Reconciliación T-108. Mapa frontend estaba obsoleto (rutas inexistentes). Categorías `DRAWER_ENTITIES` (sin lista propia) y `DRAWER_DETAIL_ENTITIES` (detalle en drawer) documentadas y reflejadas en los invariantes. Corregidos list_url/detail de budget, saledelivery, stockmove, warehouse, bankstatement, check, taxperiod y redirects `&selected=` rotos.
