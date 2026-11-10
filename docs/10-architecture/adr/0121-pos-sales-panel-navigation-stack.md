---
id: 0121
title: Panel de ventas del POS con pila de navegación propia y movimiento ease-in
status: Accepted
date: 2026-11-09
author: frontend-team
---

# 0121 — Panel de ventas del POS con pila de navegación propia

**Relacionado:** ADR-0083 (ficha documental, modo `embedded`), ADR-0101 (barra de pestañas del espacio de trabajo), ADR-0028 (registro de drawers), contratos `component-document-sheet.md` §6 y `component-animation.md` (las vistas POS quedan fuera de sus reglas de página).

## Contexto

El panel de ventas del POS es un drawer modal anclado a `body`. Los documentos que abre con `openEntity` (líneas, relaciones, origen de notas) se volcaban en la pila global de pestañas, que se monta dentro de `#main-content`. Por eso aparecían **detrás** del panel del POS y no eran interactivos. En táctil, además, el cajero perdía la lista al abrir un documento.

## Decisión

1. **Ámbito de navegación.** `EntityNavigationScope` (`components/providers/GlobalModalProvider.tsx`) sobrescribe `openEntity` y el opener de entity-view en su subárbol. El resto de acciones globales se heredan. El POS es el único consumidor.
2. **Un solo drawer.** El POS no abre drawers por documento. Una fila de la lista muestra su documento **dentro del mismo drawer**: la ficha se embebe (`embedded`) y reemplaza el contenido de la lista. El header de la ficha lleva «Volver a la lista …», que devuelve a la lista sin cerrar el drawer. Abrir otro documento lo reemplaza; no hay drill-back.
   - Maestros enlazados (producto, contacto, OT…): como mucho **un** drawer anidado, que reemplaza al anterior. Nunca hay una cadena de drawers. Su X vuelve al documento.
   - Estado en `usePosDocumentStack` (`features/pos/hooks`): como mucho un documento y un maestro a la vez; funciones puras en `features/pos/utils/documentStack.ts`. Apilar y cerrar pasan por `runGuarded` (ADR-0101 §7).
3. **Ámbito de drawers.** `DrawerScope` (`components/shared/Drawer.tsx`) hace que todo drawer montado dentro del POS herede `boundary="screen"` (se ancla a `body`, por encima del panel) y la clase `pos-motion`. Un `boundary` explícito gana.
4. **Encabezado compartido.** La ficha embebida no pinta encabezado propio: título, subtítulo y acciones (incluido «Volver») se portan a los nodos del header del drawer del POS (`DocumentHeaderSlotContext`, `components/shared/DocumentDrawerShell.tsx`). El header principal cambia de contenido con el documento; el cuerpo solo muestra la ficha. Los nodos son setters estables para no provocar re-renders en bucle.
5. **Layout.** La lista y el documento comparten el cuerpo del drawer del POS; el cambio de vista usa `pos-view-in`. La lista se mantiene montada mientras hay un documento (filtros y scroll).
6. **Movimiento.** Curva ease-in (`--ease-pos-enter: cubic-bezier(0.55, 0, 0.9, 0.35)`): arranque lento y final rápido, en entrada y salida. Duraciones 640 ms (entrada) y 460 ms (salida). Solo se aplica a las clases `pos-*` de `globals.css`. Con `prefers-reduced-motion` la duración pasa a 1 ms.

## Consecuencias

- Los documentos enlazados desde el POS no salen a pestañas globales mientras el panel está abierto. Otros puntos de la app no cambian.
- `useOpenDocument` y las filas de Relaciones funcionan sin cambios: consumen `openEntity` del ámbito.
- La lista no se ve con un documento abierto; «Volver» la recupera en un toque.
- Un documento abierto desde otro lo sustituye: el cajero no puede volver al anterior, solo a la lista.
- Un maestro abierto desde un documento sustituye a cualquier otro maestro; si se quiere volver al documento, se cierra con la X.
- Riesgo conocido: los documentos abiertos dentro del panel no tienen pestaña, así que no aparecen en la barra del espacio de trabajo.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Subir el z-index de las pestañas globales | Dos sistemas de pila compitiendo; la lista sigue oculta y el táctil no mejora |
| Pestañas dentro del POS (ADR-0101 local) | Oculta la lista casi siempre; demasiado cambio de contexto en táctil |
| Curva premium del resto de sheets (`--ease-premium`) | Rápida al inicio y lenta al final; el POS pidió lo contrario |
