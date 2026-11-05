---
id: 0113
title: Server-side group counts for collections above the grouping cap
status: Proposed
date: 2026-11-05
author: fullstack-team
---

# 0113 — Conteos de agrupado en servidor

## Context

El agrupado de las colecciones (`frontend/components/entity-view/core/use-entity-collection.ts`) se calcula en el cliente sobre las filas que ya cargó la página. Para no mostrar grupos incompletos, `GROUP_ROW_LIMIT = 200` (`use-entity-collection.ts:63`) desactiva el agrupado cuando el total del servidor supera 200 filas (`GROUP_ROW_LIMIT` en las seis vistas de `complexity-map.md` §2.6).

Consecuencia: en catálogos o movimientos de más de 200 filas el usuario no puede agrupar. Es una limitación de producto, no un error de cálculo, pero hoy no existe ninguna forma de obtener conteos por grupo sobre el conjunto completo.

No hay soporte de agrupado en backend. El texto de agrupado es el texto formateado de la celda, que mezcla campos FK (nombre del relacionado), choices (etiqueta) y valores calculados.

## Decision

1. **Endpoint de conteos.** Cada viewset que admite agrupado expone `GET <lista>/group_counts/?field=<id>` (action `group_counts`). Respuesta: `[{ "key": str, "label": str, "count": int }]` ordenada igual que el cliente (claves ordenadas, "Sin …" al final). Los filtros de la lista aplican igual.
2. **Campos permitidos por viewset.** Whitelist explícita en el viewset: `field id → expresión ORM`. Un `field` fuera de la whitelist responde 400. Nada de agrupar por expresiones arbitrarias.
3. **Etiqueta = la misma función de formato que la celda.** Para FK la etiqueta se resuelve con un `values()` del relacionado (una query por tipo de campo, no por fila). Para choices se usa la etiqueta del choice. El backend no reimplementa el formato: usa el mismo `label` que el serializer.
4. **Filas dentro del grupo** siguen cargándose con la lista paginada usando el filtro del grupo (`?<campo>=<key>`). Esto evita cargar filas sin límite.
5. **Cap de filas sin cambio.** `GROUP_ROW_LIMIT` deja de aplicar a los conteos. Se mantiene solo para el modo cliente antiguo mientras se migran las vistas.

## Consequences

- Positivo: conteos correctos sin importar el volumen; el agrupado deja de ser una limitación de producto.
- Negativo: nuevo endpoint por viewset (seis vistas) y cambio de la UI de grupos a carga por grupo.
- Contrato: nueva action en la API. Requiere este ADR aceptado antes de implementar (invariante 12).

## Open questions

- ¿Los grupos se cargan por demanda (al expandir) o se cargan todas las filas de todos los grupos paginadas?
- ¿Hace falta paginar la lista de grupos si un campo tiene miles de valores (p. ej. contacto)? Propuesta: `max 200 grupos` y aviso en la UI.

## Verification (propuesta)

- Test por viewset: conteos de `group_counts` = suma de filas de la lista sin agrupar, con más de 200 filas.
- `assertNumQueries` en `group_counts`: query fija (no depende del número de grupos).
