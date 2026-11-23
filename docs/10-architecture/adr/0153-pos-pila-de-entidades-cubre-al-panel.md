---
id: 0153
title: Pila de entidades del POS: drilldown en el mismo drawer
status: Proposed
date: 2026-11-22
author: frontend-team
---

# 0153 — Pila de entidades del POS: drilldown en el mismo drawer

**Relacionado:** ADR-0121 (panel de ventas del POS; este ADR reemplaza su punto 2 sobre "un solo drawer anidado" y "no hay drill-back"), ADR-0028 (registro de drawers).

## Contexto

ADR-0121 incrustó solo tres documentos (`sales.saleorder`, `billing.invoice`, `treasury.possession`) en el panel. Cualquier otra entidad abierta por un link o por la pestaña Relaciones (pagos, entregas, devoluciones, productos, contactos…) se mostraba como un drawer que entraba desde la derecha, y un documento abierto desde otro lo reemplazaba sin poder volver. Con decenas de entidades enlazables, adaptar cada una a `embedded` no escala.

## Decisión

1. **Pila sin límite.** Toda entidad abierta desde el panel (incluidos documentos de panel) se apila sobre la anterior en `usePosDocumentStack`. Solo la fila elegida en la lista queda incrustada en el drawer (raíz). Abrir una entidad ya presente recorta la pila hasta ella.
2. **Drilldown en línea.** `DrawerScope` admite `inline: { onBack, backLabel }`: todo `Drawer` del subárbol se dibuja en línea (sin Sheet, velo ni animación propia) en el espacio que le deja el contenedor. El drawer de ventas del POS muestra solo la cima de la pila en su cuerpo, en lugar de la lista o del documento, con el botón «Volver» siempre visible en el encabezado de la entidad. Ninguna entidad necesita soportar `embedded` y nunca se abre un drawer nuevo.
3. **Volver.** «Volver» quita la cima de inmediato y revela la entidad anterior; el documento raíz y la lista siguen montados (ocultos) y conservan su estado. Las entidades intermedias se desmontan (los datos siguen en caché de TanStack Query). Cerrar el drawer de ventas limpia toda la pila.
4. **Contexto POS.** Las OV, notas y sesiones apiladas se montan con `posSessionId` y `onActionSuccess` del POS; el resto sale de `ENTITY_DRAWERS`.

## Consecuencias

- Todas las entidades del registro que se montan con `Drawer` funcionan dentro del POS sin adaptación individual.
- La entidad en línea reutiliza el encabezado del drawer de ventas: porta su título, subtítulo y acciones a los nodos del header (`inline.header`), como ya hace el documento embebido, y «Volver» queda siempre visible en ese header. El documento raíz oculto deja de portar su identidad mientras una entidad lo cubre.
- Una entidad que no use `Drawer` (p. ej. `BaseModal`) sigue abriéndose como modal.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| `embedded` entidad por entidad | Reemplazo real, pero obliga a adaptar decenas de drawers |
| Cubrir al padre con un segundo drawer (`cover`, versión anterior de este ADR) | Sigue siendo un drawer nuevo que entra y se superpone; el cajero lo percibe como otra ventana |
| Tope de 2–3 niveles | El cajero navega por links y relaciones; un tope lo deja sin ruta de vuelta |
