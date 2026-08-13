---
id: 0075
title: Entity Fields — acceso a columnas por clave (column(key)) y prohibición del destructuring posicional de toColumns()
status: Accepted
date: 2026-08-13
author: core-team
---

# 0075 — Entity Fields: acceso a columnas por clave (`column(key)`)

## Context

`toColumns()` devuelve las columnas de una entidad **ordenadas por zonas de placement** (title → subtitle → detail → header), no en el orden de definición de los campos ([ADR-0059](0059-tocolumns-mirrors-card-ordering.md), [ADR-0067](0067-entity-fields-placement-surface-and-weight.md)). Varios views destructureaban el arreglo posicionalmente:

```tsx
const [, saleOrderCol, startDateCol, productDescCol, stageCol, dueDateCol] = workOrderFields.toColumns()
```

El contrato no garantiza que el índice de la posición corresponda a un campo, por lo que este patrón es inválido por definición. Consecuencias reales:

- **Crash** en `WorkOrdersPageClient` ("Columns require an id when using a non-string header"): el destructure pedía 6 posiciones con 5 columnas, dejando `dueDateCol = undefined` dentro del arreglo que recibe TanStack Table.
- **Columnas equivocadas silenciosas** en `WarehouseClientView` (code/name intercambiados), `UoMClientView` (abbreviation como categoría, name_singular como ratio) y `UnbilledChargesClientView` (chargeType como fecha, date como monto).

## Decisión

1. **Nuevo método público `column(key)` en `createEntityFields`** (`frontend/components/shared/entity-fields.tsx`): devuelve la `ColumnDef<T>` de un único campo, seleccionada por su **data key** (`def.key`), con el mismo `weight` semibold de la zona header que `toColumns()`. Lanza un `Error` descriptivo si el campo no existe o no tiene superficie `table`.
2. **Implementación compartida.** El builder de columna (`buildColumn`) y la resolución de placements (`resolveTablePlacementMap`) se extraen de `toColumns()` y se reutilizan en `column()`. `toColumns()` conserva su orden por zonas sin cambios.
3. **Migración de los 5 consumers** con destructuring posicional a `column(key)`:
   - `WorkOrdersPageClient` → `column('sale_order_number' | 'start_date' | 'product_description' | 'current_stage' | 'due_date')`.
   - `WarehouseClientView` → `column('name' | 'code' | 'address')`.
   - `UoMClientView` → `column('id' | 'name' | 'category_name' | 'ratio')`.
   - `UnbilledChargesClientView` → `column('date' | 'amount' | 'installmentNumber')`.
   - `BlacklistClientView` → `column('credit_balance_used' | 'credit_last_evaluated')`.
4. **Anti-patrón prohibido**: destructuring posicional de `toColumns()` (`const [a, b, c] = fields.toColumns()`). Se documenta como tal en `component-fields.md`.

## Consecuencias

- **Positivo:** el acceso por clave elimina la dependencia del orden interno por zonas (frágil ante cambios de `placement`/`type`), arregla el crash y corrige las columnas equivocadas en 4 views. Es API aditiva — ningún consumer existente cambia.
- **Neutral:** `column(key)` toma un string sin validación de tipos; un key mal escrito falla en runtime con mensaje claro (patrón ya usado por `render(key)`).
- **Riesgo:** futuro — cualquier destructuring posicional nuevo reintroduce el bug; mitigado por la documentación del anti-patrón y, opcionalmente, una regla ESLint `no-restricted-syntax` si reaparece.

## Alternativas consideradas

- **Corregir solo WorkOrders** con lookup por accessorKey. Rechazado: deja el anti-patrón latente en los otros 4 views y la causa raíz sigue en el código.
- **Hacer `toColumns()` con orden de definición.** Rechazado: contradice ADR-0059/0067 (orden por zonas es el contrato de las tablas).
- **Regla ESLint inmediata.** Aplazada: los 5 usos se migran, no queda ningún caso válido; se añade si el anti-patrón reaparece.

## References

- Related: [ADR-0059](0059-tocolumns-mirrors-card-ordering.md), [ADR-0067](0067-entity-fields-placement-surface-and-weight.md), [ADR-0072](0072-entity-fields-contact-display.md)
- Contract: [component-fields.md](../../20-contracts/component-fields.md) (§1.1 Seleccionar columnas individuales)
- Implementation: `frontend/components/shared/entity-fields.tsx`, tests en `frontend/components/shared/__tests__/entity-fields.test.ts`
- Views migradas: `frontend/app/(dashboard)/production/orders/WorkOrdersPageClient.tsx`, `frontend/features/inventory/components/WarehouseClientView.tsx`, `frontend/features/inventory/components/UoMClientView.tsx`, `frontend/features/treasury/card-statements/UnbilledChargesClientView.tsx`, `frontend/features/credits/components/BlacklistClientView.tsx`
