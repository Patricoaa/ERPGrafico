---
id: 0112
title: Master data lists — opt-in pagination for unbounded catalogs
status: Proposed
date: 2026-11-05
author: fullstack-team
---

# 0112 — Master data con paginación opt-in

## Context

El mapa de complejidad (`docs/40-quality/complexity-map.md` §2.6) identifica tres catálogos que se consumen completos sin paginar:

- `GET /api/accounting/accounts/` (`AccountViewSet`)
- `GET /api/treasury/accounts/` (`TreasuryAccountViewSet`)
- `GET /api/hr/employees/` (`EmployeeViewSet`)

`pagination-contract.md §1.5 / §8` los clasifica como master data "< 200 filas" con `pagination_class = None`. Ese supuesto no está garantizado: un plan de cuentas o una planilla pueden crecer más allá de 200 y el endpoint sigue devolviendo todo en O(n) sin límite.

Cambiar la respuesta por defecto a `{count, next, previous, results}` rompería a todos los consumidores actuales (dropdowns, árboles), por lo que no es un cambio aceptable de golpe.

## Decision

1. **Paginación opt-in.** Los tres viewsets usan `OptionalPaginationMixin` (`core/api/pagination.py`) con `pagination_class = StandardResultsSetPagination`.
   - Sin `page` ni `page_size` en la query: respuesta `T[]` plana, idéntica a la actual.
   - Con `page` o `page_size`: respuesta paginada con el envoltorio estándar y `page_size` máximo 200.
2. **Sin cambio de cap.** El máximo por página sigue en 200 (`StandardResultsSetPagination`); no se sube.
3. **Retiro de la whitelist.** Los tres endpoints salen de la lista de exentos de `test_pagination_contract.py` porque ya declaran la clase de paginación.
4. **Migración de consumidores fuera de alcance de este ADR.** Los consumidores frontend siguen pidiendo la lista completa. Pasarlos a paginación o a búsqueda server-side es trabajo posterior; mientras tanto el riesgo queda acotado solo por el tamaño real del catálogo.

## Consequences

- Positivo: quien necesite acotar la respuesta puede hacerlo hoy sin romper a nadie.
- Negativo: la respuesta por defecto sigue siendo no acotada. El endpoint solo deja de ser un problema cuando los consumidores migran.
- Contrato: cambio aditivo en la API (nuevos parámetros válidos, sin cambio de forma por defecto). Requiere este ADR por invariante 12.

## Verification

- `backend/core/tests/test_master_data_optional_pagination.py`: forma plana por defecto, envoltorio con `page_size`, y que la página 2 coincide con el slice de la lista completa.
- `backend/core/tests/test_pagination_contract.py`: los tres viewsets ya no están en la whitelist y pasan la regla.

## Migración de consumidores (2026-11-05)

Los consumidores frontend de `accounts`, `treasury/accounts` y `hr/employees` pasan por `fetchBoundedList` (`frontend/lib/bounded-list.ts`). Piden `page_size=200`. Si el catálogo tiene más filas, la petición falla con `BoundedListError` que indica filtrar; no se trunca en silencio. El backend sigue devolviendo lista plana sin parámetros.
