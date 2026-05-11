# ADR-0022: Source of Truth para `list_url` de Entidades Searchables

**Fecha:** 2026-05-09
**Estado:** Aceptado
**Fase:** F9 (T-103)
**Depende de:** ADR-0020 (URL-state pattern), T-88 (`searchableEntityRoutes.ts`)
**Firmas Stakeholder:** @pato

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

---

## 4. Trade-offs

| Trade-off | Mitigación |
|-----------|------------|
| El backend parsea un archivo TypeScript | Regex simple — el formato del objeto `searchableEntityRoutes` es estable y no usa sintaxis compleja. Si cambia el formato, el test falla ruidosamente. |
| `list_url` en la respuesta de API casi nunca se consume en el frontend | El campo sigue siendo útil para depuración y para clientes externos de la API. Mantenerlo sincronizado tiene coste negligible. |

---

## Changelog

- **2026-05-09**: ADR creado (F9, T-103). 5 divergencias corregidas en backend. Test arquitectónico agregado.
