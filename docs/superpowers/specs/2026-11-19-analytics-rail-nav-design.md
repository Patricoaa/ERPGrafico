# Riel de navegación compartido para analytics (RailNav)

## Intención
Unificar el riel izquierdo de los analytics con el del modal de perfil (`ProfileSettingsSidebar`) y quitar el subtítulo redundante del modal de producto.

## Goals
- Extraer de `ProfileSettingsSidebar` un componente genérico `RailNav` en `components/shared` (secciones e ítems con ícono/etiqueta/badge, slots `top` y `bottom`).
- `ProfileSettingsSidebar`, `AnalyticsPanelContent` y `ProductAnalyticsModal` lo usan; se eliminan los dos rieles propios de analytics.
- Modal de producto: `description` vacío. Sin `onProductChange`, el nombre del producto se muestra en el slot superior del riel.
- Selector de producto en el slot `top`; `GranularityControl` en el slot `bottom`.

## Non-goals
- No cambiar contenido de tabs ni charts. No cambiar el modal de perfil visualmente.

## Decisiones del usuario
- Subtítulo del modal de producto: vacío.
- Contexto inline (vistas con `AnalyticsPanelContent`): riel sin bordes.
- Contexto modal: usa `DrawerLayout` con `leftRail` como el perfil (`w-14 sm:w-56`).

## Approaches
A (elegida): componente compartido `RailNav`. B (descartada): copiar clases en cada riel; deja tres copias que divergen.

## Pendiente del builder
Nombre/ubicación exacta, export por barrel de `@/components/shared`, tests de las vistas que mockean `AnalyticsPanelContent`, docs de contrato (add-shared-component.md).
