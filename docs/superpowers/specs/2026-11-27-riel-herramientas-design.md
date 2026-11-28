# Riel derecho de herramientas — diseño

Fecha: 2026-11-27 · Estado: propuesto · Enmienda a ADR-0162 (sidebar único) y ADR-0101 (calculadora como pestaña)

## Intención

El sidebar único (ADR-0162) acumula herramientas de apoyo (Buscar, Bandeja, Calculadora) que compiten con la
navegación. Y el botón de configuración de cada módulo vive suelto junto al título, aislado y distinto en cada
pantalla. Se crea un **riel derecho de 52 px solo con íconos** que reúne las herramientas de apoyo y la
configuración del módulo activo, dejando el sidebar para navegar.

## Objetivos

- Sidebar = identidad de empresa, **Punto de Venta** (central, se queda), módulos y sus vistas, y al pie
  Configuración global + Cuenta.
- Riel derecho, de arriba abajo: **Buscar · Calculadora · Bandeja (insignia de pendientes) · ⚙ del módulo**.
- Todo lo que abre el riel entra **desde la derecha con overlay**, anclado a la izquierda del riel (no lo tapa).
- La **Calculadora de Costos** deja el sistema de pestañas y pasa a drawer derecho de **900 px** con overlay,
  conservando su layout de dos columnas (grilla de productos + resumen).
- El **buscador universal** se alinea a la UI del sistema.

## No objetivos

- No cambia el contenido de la calculadora, la bandeja ni los modales de configuración.
- No cambia la búsqueda en sí (endpoint, ranking).
- No se toca la Configuración global ni el menú de Cuenta.

## Anti-objetivos

- Que el riel parezca un segundo sidebar de navegación.
- Que un panel abierto desde el riel tape el riel o lo deje inaccesible.
- Perder el deep link `?modal=settings` de los módulos.

## Enfoques considerados

1. **Cada header publica su ⚙ vía `HeaderProvider`** — *elegido*. `HeaderConfig` gana
   `settings?: { label: string; open: () => void }`; el riel lo muestra si existe. Cada módulo conserva su modal,
   su permiso y `?modal=settings`. Costo: el ícono aparece cuando monta el header del módulo.
2. Registro central en `module-registry` con modal `lazy` y estado en el shell. Ícono inmediato, pero mueve
   estado y deep link desde seis headers al shell. Descartado por mayor superficie de cambio.

Posición: se eligió riel **a la derecha** (junto a lo que abre) frente a la izquierda (recuperaría el riel que
eliminó ADR-0162 y se leería como navegación).

## Diseño

### Riel (`components/layout/ToolRail.tsx`)

- `w-[52px]`, alto completo del viewport, a la derecha del área de trabajo en `DashboardShell` (hermano del
  bloque contenido; fuera del `marginRight` que aplican las sheets). Fondo como el sidebar (`bg-muted/30`).
- Botones ícono con `Tooltip side="left"`, estado activo marcado cuando su panel está abierto; clic sobre el
  activo lo cierra.
- Visible desde `md`. *Decisión del builder:* en móvil el riel se oculta y sus acciones aparecen como fila
  compacta de íconos en el bloque de utilidades del `Sheet` de navegación móvil.
- El conteo de pendientes de la Bandeja y su polling se mueven tal cual desde `SidebarUtilityNav`.
- El ⚙ respeta el permiso que hoy aplica cada header (si un header no lo muestra, no publica `settings`).

### Anclaje de paneles derechos

- Variable CSS `--tool-rail-width: 52px` (0 en móvil). Todos los paneles derechos (`CollapsibleSheet` side
  right, drawers de entidad, bandeja, calculadora) suman esa base a su offset `right`, de modo que se abren a
  la izquierda del riel. El overlay bloqueante tampoco cubre el riel. *Decisión del builder:* aplicar en
  `getSheetOffset` / estilos de `CollapsibleSheet` para no tocar cada panel.

### Calculadora

- Se elimina `ToolTabId`, el tipo de pestaña `tool`, `openTool` y el montaje por pestaña en
  `GlobalModalProvider` (y su test). `QuickActionsMenu.tsx` no se usa en ningún lado: se elimina.
- `CostCalculatorDrawer` pasa a `CollapsibleSheet` con `fullViewport` + `blockingOverlay` (mismo patrón que
  `TaskInboxSidebar`), ancho 900 px (`max-w` acotado al viewport menos el riel), montado en `DashboardShell`
  con estado `isCalculatorOpen`.
- *Decisión del builder:* el estado de la calculadora (ítems elegidos) se conserva al cerrar y reabrir durante
  la sesión de la página (el componente queda montado tras la primera apertura), igual que hacía la pestaña.

### Bandeja

- Sin cambios de contenido. Solo cambia el disparador (riel) y el anclaje a la izquierda del riel.

### Configuración del módulo

- Los 6 `[Module]Header` (Ventas, Contabilidad, Inventario, Compras, RR.HH., Tesorería) quitan el botón ⚙ de
  `titleActions` y publican `settings: { label: "Configuración de <Módulo>", open: () => setIsSettingsOpen(true) }`.
  El modal sigue montado en el header; `?modal=settings` sigue igual.
- `HeaderProvider` persiste `settings` por módulo igual que `moduleNavigation`, para que un `PageHeader`
  anidado sin `settings` no lo borre.

### Buscador universal

- Ya corregido: no aceptaba texto (vaciaba la query en cada render con el diálogo abierto).
- Se retira lo ornamental: `backdrop-blur`, degradados, logo pulsante del estado vacío, segmentadores en
  mayúsculas con botones rellenos, avatar circular por resultado.
- Se usan piezas del sistema: superficie de `Dialog` estándar, filtros por tipo con el componente de chips
  (`component-chip.md`), filas con la densidad y tipografía de las listas de entidades, estado vacío y de error
  según `component-skeleton.md`. Atajo mostrado como `Ctrl K`.
- El disparador pasa del sidebar al riel; Ctrl+K sigue global.

### Sidebar resultante

Cabecera · bloque de utilidades solo con **Punto de Venta** · módulos · pie con Configuración global y Cuenta.
`SidebarUtilityNav` desaparece; `SidebarQuickActions` queda solo con POS.

## Documentación

- Enmienda en ADR-0162 (utilidades salen al riel) y ADR-0101 (calculadora deja de ser pestaña).
- Actualizar `module-layout-navigation.md` (riel + `HeaderConfig.settings`).

## Pruebas

- Riel: renderiza los cuatro botones; ⚙ solo si hay `settings`; activo/cierre por clic.
- Calculadora: abre como drawer, sin pestaña; conserva ítems al reabrir.
- Headers: el modal abre desde el riel y con `?modal=settings`.
- Ajustar `ModuleSidebarPanel.test.tsx` y `GlobalModalProvider.test.tsx`.
- Revisión visual en navegador (dev server) de riel, anclaje de paneles y buscador.
