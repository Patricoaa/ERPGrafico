---
id: 0162
title: Sidebar único con identidad de empresa y módulos como primer nivel
status: Accepted
date: 2026-11-26
author: frontend-team
---

# 0162 — Sidebar único con identidad de empresa y módulos como primer nivel

**Relacionado:**
- ADR-0079 (establece el shell de dos columnas; enmienda 1.6 queda reemplazada).
- ADR-0101 (barra de trabajo; los accesos POS/Calculadora dejan de vivir en el pie del panel).
- `docs/20-contracts/module-layout-navigation.md` §2.1, `docs/20-contracts/typography-scale.md` § chrome del shell.

## Contexto

ADR-0079 definió `ModuleRail` (56 px, iconos de módulos + logo + avatar) y `ModuleSidebarPanel` (224 px, navegación del módulo activo). Su enmienda 1.6 prohibía explícitamente un selector de módulos en el panel «porque el riel ya cambia de módulo». En la práctica eso obliga a dos columnas para una sola decisión de navegación: elegir módulo y elegir vista.

Además, los accesos globales estaban repartidos: Buscar y Bandeja arriba del panel; POS y Calculadora en su pie; Configuración y Cuenta en el pie del riel de iconos. La cabecera del panel mostraba el nombre del módulo activo, información ya presente en la barra de trabajo y en el propio listado.

## Decisión

1. **Shell de una sola columna.** Se elimina `ModuleRail`. `DashboardShell` renderiza únicamente `ModuleSidebarPanel` (224 px) en desktop y dentro del `Sheet` en móvil. El contenido gana los 56 px liberados.
2. **Cabecera de empresa.** El bloque `h-12` del panel pasa a mostrar logo + nombre (`trade_name || name` de `useBranding`), con iniciales como fallback y tooltip para el nombre truncado. El logo conserva el enlace a «Inicio». El nombre del módulo activo deja de ocupar la cabecera.
3. **Módulos como primer nivel.** El área con scroll lista `MODULE_ORDER` (filtrado por `Can`) con icono y etiqueta. El módulo activo se marca y despliega debajo las vistas que publica su `[Module]Header` vía `navigation`. `ModuleNavTree` gana `renderDepth` (solo sangría) y `embedded` para reutilizar la resolución de activo sin duplicarla ni anidar `<nav>`. No hay colapso a nivel módulo: la fila es un enlace directo a la vista por defecto del módulo.
4. **Utilidades globales juntas y fijas.** Buscar, Bandeja de entrada, Punto de Venta y Calculadora de Costos se agrupan en el bloque superior, antes del área con scroll. POS mantiene su permiso y la Calculadora su estado de pestaña activa (ADR-0101).
5. **Pie del panel.** Configuración (`core.change_companysettings`) y Cuenta (dropdown de perfil/sesión del avatar) se mueven desde el extinto riel de iconos al pie del panel. `onProfileOpen` pasa de `ModuleRail` a `ModuleSidebarPanel`.

### Enmienda 1 (2026-11-26) — acordeón de primer nivel y ajustes del panel

Aplica sobre los puntos 2, 3 y 4 de la Decisión:

1. **Cabecera centrada.** La cabecera `h-12` muestra un único elemento centrado: el logo de `useBranding`, o el nombre de la empresa (`trade_name || name`) como fallback cuando no hay logo. Se retiran las iniciales y el nombre junto al logo. El enlace a «Inicio» y el tooltip con el nombre completo se conservan.
2. **Acordeón en todo el primer nivel.** Ninguna fila de módulo navega: las nueve son cabeceras de acordeón (`expanded` / `aria-expanded` en `SidebarNavItem`) que contraen o despliegan sus vistas. La del módulo activo arranca expandida; el estado se conserva por módulo mientras el panel esté montado. El módulo activo usa el `navigation` publicado por su `[Module]Header` (`HeaderProvider.moduleNavigation`, con bancos y preferencias de vista resueltos). Para los inactivos, `module-nav-fallback.ts` deriva el árbol de las constantes canónicas `*_TABS` de cada feature; Contactos y Producción, que no tienen `navigation.ts`, declaran allí sus vistas mínimas. Sólo las vistas (nivel ≥ 1) son enlaces.
3. **Bandeja y POS contiguas.** Se elimina el separador entre `SidebarUtilityNav` y `SidebarQuickActions`. El separador bajo el bloque de utilidades, antes de los módulos, se mantiene.
4. **Cuenta como fila simple.** La fila de Cuenta se alinea con el resto de ítems de navegación: sin chevron, etiqueta a la izquierda y blobatar del mismo tamaño que los iconos (`h-4 w-4`). El dropdown de Perfil/Cerrar Sesión no cambia.

### Enmienda 2 (2026-11-27) — herramientas de apoyo al riel derecho

Aplica sobre los puntos 3 y 4 de la Decisión y el punto 3 de la Enmienda 1. Spec: `docs/superpowers/specs/2026-11-27-riel-herramientas-design.md`.

1. **Riel derecho de herramientas.** `ToolRail` (52 px, solo íconos, visible desde `md`) se monta en `DashboardShell` a la derecha del área de trabajo. Orden: **Buscar** (Ctrl+K) · **Calculadora de Costos** · **Bandeja de entrada** (insignia de pendientes) · ⚙ **configuración del módulo activo**. En móvil el riel se oculta y la misma botonera se pinta como fila (`variant="row"`) arriba del bloque de utilidades del `Sheet` de navegación.
2. **El sidebar queda para navegar.** El bloque de utilidades conserva solo el **Punto de Venta** (central). `SidebarUtilityNav` se elimina; el conteo de pendientes pasa a `usePendingTasksCount` (`@/features/workflow`). Configuración global y Cuenta siguen al pie.
3. **Paneles anclados al riel.** Bandeja y Calculadora son overlays bloqueantes (`CollapsibleSheet` `fullViewport` + `blockingOverlay`, scrim `.rail-overlay`) cuyo borde derecho termina en el riel (`--tool-rail-width`: 0 en móvil, 52 px desde `md`). El riel sigue visible y clicable (`[data-tool-rail]`, `pointer-events-auto`): un clic en él no cierra el overlay; el riel alterna el panel activo o cambia de herramienta.
4. **⚙ del módulo.** Los `[Module]Header` dejan el botón ⚙ de `titleActions` y publican `settings: { label, open }` vía `PageHeader` → `HeaderProvider.moduleSettings`, que sobrevive a headers anidados sin `settings` y se descarta al cambiar de módulo. El modal y `?modal=settings` siguen en cada header.
5. **Un solo buscador.** `DashboardShell` monta un único `UniversalSearch` controlado; lo abren el riel, la fila móvil y Ctrl+K. Elegir un resultado lo abre con `openEntity` (pestaña de registro, ADR-0152) y cierra el panel activo del riel; ya no navega a una URL armada por el backend.

## Consecuencias

### Positivas

- Una sola columna decide módulo y vista; se elimina la duplicidad de selector.
- Las cuatro acciones globales más usadas quedan juntas y siempre visibles, sin depender del scroll del árbol.
- La identidad de la empresa tiene presencia permanente en el shell, como en el login.

### Negativas

- El panel con todos los módulos es más largo; el área con scroll crece y el módulo activo queda más abajo en la lista.
- La cabecera deja de nombrar el módulo activo; ese contexto se lee ahora en la fila marcada del primer nivel y en la barra de trabajo.
- Se reemplaza ADR-0079 §1 y enmienda 1.6; `ModuleRail.tsx` y sus referencias desaparecen.

## Alternativas consideradas

- **Mantener el riel de iconos y añadir el selector al panel.** Rechazado: duplica la navegación de módulos y conserva dos columnas para una sola decisión.
- **Panel de 280 px (56 + 224) al eliminar el riel.** Rechazado: prioriza la densidad del contenido sobre el ancho del chrome.
- **Cabecera con el módulo activo y la empresa en el pie.** Rechazado: la empresa es identidad persistente; el módulo ya se lee en el primer nivel.

## References

- `frontend/components/layout/DashboardShell.tsx`
- `frontend/components/layout/ModuleSidebarPanel.tsx`
- `frontend/components/layout/ModuleNavTree.tsx`
- `frontend/components/layout/module-nav-fallback.ts`
- `frontend/components/layout/SidebarQuickActions.tsx`
- `frontend/components/layout/ToolRail.tsx` (Enmienda 2)
- `frontend/components/layout/UserSidebarMenu.tsx`
