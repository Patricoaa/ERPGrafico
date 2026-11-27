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
- `frontend/components/layout/SidebarQuickActions.tsx`
- `frontend/components/layout/UserSidebarMenu.tsx`
