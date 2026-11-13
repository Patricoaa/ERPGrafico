---
id: 0137
title: Variante embebida de `Collection` (marco, vacío en columnas y «Mostrar más»)
status: Accepted
date: 2026-11-12
author: frontend-team
---

# 0137 — Variante embebida de `Collection`

## Contexto

Las tablas dentro de modales y drawers se veían como tablas de página completa: marco `rounded-md border`, paginador numérico y un `EmptyState` en caja. Para quitar el marco, cuatro pantallas del perfil copiaron el selector `[&>div>div]:rounded-none [&>div>div]:border-0`, que depende de la estructura DOM interna de `Collection`. Además, 48 usos de `pagination: { mode: "none" }` indican que las colecciones embebidas, con pocos registros, rehúyen la paginación estándar.

## Decisión

1. **Variante `embedded`** en `Collection.View` / `Table` / `Grid` (`variant?: "default" | "embedded"`). Agrupa tres comportamientos, cada uno sobrescribible: `frame` (`card` \| `none`), `empty` (`message` \| `columns`) y `pager` (`pages` \| `more`). Se añade `maxHeight` (tope de altura; las filas hacen scroll con la cabecera fija).
2. **Herencia por contexto.** `BaseModal` y `Drawer` envuelven su contenido en `EmbeddedSurfaceProvider` (`components/shared`). Dentro, `Collection` usa `embedded` por defecto; fuera, `default`. `variant="default"` fuerza el aspecto clásico (wizards y vistas con varios bloques).
3. **Vacío en columnas.** Con `empty="columns"` el vacío real pinta solo la cabecera, sin mensaje ni marco, con un `caption` `sr-only` «Sin registros». Error, vacío filtrado, vacío con `emptyAction` y la vista de cards conservan el mensaje (sin marco si `frame="none"`).
4. **Modo `{ mode: "more"; step? }`** en `useEntityCollection` (solo cliente, `step` por defecto 10). Dentro de una superficie embebida, la paginación cliente por defecto se presenta también como «Mostrar más (N restantes)»; la paginación en servidor conserva el paginador. El hook expone `paging` y `moreStep`.
5. **Cabecera fija sin fondo** en la variante embebida (`<thead>` sin `bg-background`).
6. **Conteo en `Section`.** `Collection.Root` publica su total a un ámbito de conteo (`RecordCountScope`, expuesto como `Section.Scope`; `Section` ya lo es). `Section.Header` sin `count` muestra «N registro(s)». `count` explícito prevalece.
7. Se eliminan los cuatro selectores `[&>div>div]` del perfil. `MaterialAssignmentStep` y `DistributionImpactStep` (wizards) fijan `variant="default"`.

## Consecuencias

- Las tablas de modales y drawers pierden el marco sin tocar a cada consumidor; una tabla que lo necesite pide `variant="default"` o `frame="card"`.
- `Collection.View` pasa a 11 props (límite del contrato: 12).
- «Mostrar más» no reinicia el contador al cambiar las filas: acortar la lista solo oculta el botón.
- Pendiente: revisar visualmente en navegador las tablas de modales y drawers existentes, que cambian de aspecto.
