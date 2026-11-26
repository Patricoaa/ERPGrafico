---
id: 0159
title: Collection — selección controlada, tono de fila, arrastrar y soltar, y elección en el dock de selección
status: Accepted
date: 2026-11-26
author: frontend-team
---

# 0159 — Selección controlada, tono de fila, arrastre y elección en el dock

**Relacionado:** ADR-0087 (entity-view; este ADR amplía `useEntityCollection` y `Collection.BulkBar`), ADR-0158 (etapa 5: retiro de `DataTable`).

## Contexto

Tras ADR-0158, dos pantallas seguían en `DataTable` (`EXEMPT_CONSUMERS`), porque entity-view no tenía API para lo que usan:

| Pantalla | Necesidad |
|---|---|
| Panel de conciliación bancaria (`ReconciliationPanel`) | Arrastrar un movimiento de tesorería sobre una línea de cartola. Resaltar las filas sugeridas y atenuar las excluidas. La selección vive en la pantalla: alimenta las sugerencias y el dock de acciones propio, y se limpia tras conciliar |
| Modal de mapeo de cuentas (`MappingConfigModal`) | Asignar una categoría a las filas seleccionadas con un selector dentro del dock |

Ambas lo resolvían con `renderRow` y `cloneElement` sobre el `<tr>` de `DataTable`, y con `bulkDock` como render libre. Es justo el escape opaco que el invariante 13 prohíbe.

## Decisión

Cuatro capacidades **tipadas**. Ninguna recibe JSX libre de la pantalla.

1. **Selección controlada.** `useEntityCollection(…, { selection: { state, onChange } })`.
   - `state` es el `RowSelectionState` de TanStack (claves = `rowId`).
   - Con selección controlada, la colección no limpia la selección al cambiar de página del servidor: lo decide la pantalla.
   - Sin la opción, la selección sigue interna, como hasta ahora.
2. **Tono de fila.** `useEntityCollection(…, { rowTone: (row) => "attention" | "muted" | null })`.
   - Dos tonos semánticos: `attention` (sugerencia; tinte `warning`) y `muted` (fuera del flujo; atenuada).
   - No acepta clases.
3. **Arrastrar y soltar.** `useEntityCollection(…, { dnd: { drag?, drop? } })`.
   - `drag(row)` / `drop(row)` devuelven `{ id, data }` (y `disabled` en `drag`), o `null`.
   - La tabla conecta cada `<tr>` con `useDraggable` / `useDroppable` de `@dnd-kit/core`.
   - La pantalla pone el `DndContext` y resuelve el `onDragEnd`.
   - Solo en la superficie tabla.
4. **Elección en el dock.** `Collection.BulkBar` acepta `choice: { label, options, onChoose(items, value) }`, además de `actions`. Muestra un selector en el dock; al elegir, aplica y limpia la selección.

## Consecuencias

- Las dos pantallas migran a entity-view y `EXEMPT_CONSUMERS` queda vacío.
- Se borran `DataTable`, `DataTableToolbar`, `FacetedFilter` / `DataTableFacetedFilter`, `DataTableColumnToggle` y `DataTableColumnHeader`.
- `@dnd-kit/core` pasa a ser dependencia de `components/entity-view`. Solo se usa cuando una colección declara `dnd`.
- Los props de los componentes núcleo no crecen (techo de 12, Gate B): todo entra por las opciones de `useEntityCollection`, salvo `choice` en `BulkBar`.

## Alternativas descartadas

- **`renderRow` / envoltorio libre de fila.** Reabre el escape opaco que ADR-0087 cerró: clases y elementos arbitrarios por pantalla.
- **Mantener las dos pantallas en `DataTable`.** Deja vivo el sistema congelado, con su toolbar, filtros y selector de columnas, solo por dos consumidores.
