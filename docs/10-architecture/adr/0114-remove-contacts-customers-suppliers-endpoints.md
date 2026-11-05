---
id: 0114
title: Remove unbounded contacts customers and suppliers endpoints
status: Accepted
date: 2026-11-05
author: fullstack-team
---

# 0114 — Eliminar `contacts/customers` y `contacts/suppliers`

## Context

`GET /api/contacts/customers/` y `GET /api/contacts/suppliers/` devolvían todos los contactos con órdenes de venta o de compra, sin paginar (`complexity-map.md` §2.1, residual de `contacts/views.py:71,77`). Crecían en O(n) sin límite.

Auditoría de consumidores (2026-11-05): ningún componente de frontend, ningún hook, ningún test y ningún documento los usa. El selector `ContactSelector.list_customers` / `list_suppliers` solo los alimenta.

## Decision

1. Eliminar las acciones `customers` y `suppliers` de `ContactViewSet` y los selectores `list_customers` / `list_suppliers`.
2. Para buscar clientes o proveedores se usan los endpoints existentes: `GET /api/contacts/?role=CUSTOMER` / `?role=SUPPLIER` (paginados) o `GET /api/contacts/customers/search/` (typeahead top-N).

## Consequences

- Cambio de API (rutas eliminadas). Sin consumidores conocidos, no hay impacto funcional. Cualquier cliente externo que las use recibirá 404; esta es la única superficie de riesgo.
- Se elimina una superficie O(n) sin cap.

## Verification

- `core/tests/test_rbac_action_coverage.py` y `contacts` pasan.
- Fallos preexistentes no relacionados (`billing.confirm_invoice`) se mantienen igual que en `master`.
