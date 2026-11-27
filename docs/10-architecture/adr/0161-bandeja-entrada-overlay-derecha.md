---
id: 0161
title: Bandeja de entrada como overlay bloqueante a pantalla completa desde la derecha
status: Accepted
date: 2026-11-26
author: frontend-team
---

# 0161 — Bandeja de entrada como overlay bloqueante desde la derecha

**Relacionado:**
- ADR-0013 (ActionDock: regla 3, centrado reactivo según paneles abiertos).
- ADR-0101 (barra de trabajo: los paneles abren debajo del header).
- ADR-0083 (el Order Hub se retiró; la bandeja es el único panel global).

## Contexto

`TaskInboxSidebar` usaba `CollapsibleSheet` como un panel más: abría a la **derecha**, empezaba en `top: var(--header-height)`, **empujaba** el canvas (`marginRight: totalSheetsWidth`) y publicaba `data-inbox-open` en `body` para que el CSS (`--inbox-width`) y el `ActionDock` se desplazaran. No tenía overlay: el fondo solo se atenuaba con `brightness(0.8)`.

Problemas:

1. La bandeja es el panel global más usado, pero se comportaba como un drawer de entidad: competía visualmente con el contenido en vez de dominarlo.
2. Empujar el canvas dejaba un hueco y desplazaba el `ActionDock`, justo cuando el operador está trabajando en la lista que tiene detrás.
3. No había un tratamiento visual que la distinguiera de los drawers de entidad.

## Decisión

### 1. La bandeja es un overlay bloqueante, no un panel que empuja

- `TaskInboxSidebar` pasa `side="right"`, `fullViewport`, `blockingOverlay` y `registerInStack={false}` a `CollapsibleSheet`.
- Ocupa `100dvh` desde `top: 0`: cubre también la barra de trabajo. Esto es una **excepción explícita** a ADR-0101, que reservaba el header para los paneles laterales. La barra de trabajo deja de ser visible mientras la bandeja está abierta.
- Entra deslizándose **desde la derecha** (`panel-enter-right` / `panel-exit-right`), con borde izquierdo y sombra hacia el canvas.
- Superficie `bg-card` + `shadow-overlay` (token semántico) para que se lea como elemento principal.
- Radix `Sheet` se monta en modo `modal`: `bg-overlay/50 + backdrop-blur-sm`, foco capturado dentro del panel, `Escape` y clic en el scrim cierran. El canvas queda con `blur(6px) brightness(0.65)`.
- Al no registrarse en la pila de `GlobalModalProvider`, no desplaza ni al contenido ni a los drawers de entidad.

### 2. Se retira la repulsión de la bandeja

- `DashboardShell` deja de publicar `data-inbox-open`.
- `ActionDock` vuelve a estar siempre centrado (`left-1/2 -translate-x-1/2`) y pierde su `MutationObserver`.
- El sistema de repulsión sigue vigente para los drawers de entidad mediante `totalSheetsWidth`.

### 3. `CollapsibleSheet` gana props opt-in

`fullViewport`, `blockingOverlay`, `registerInStack` y `overlayClassName`. Los defaults conservan el comportamiento anterior, de modo que `ProfileSidePanel` y los drawers de entidad no cambian. La geometría (`left`/`right`, borde, dirección del `translateX`, keyframes, z-index) pasa a derivar de `side`.

## Consecuencias

### Positivas

- La bandeja se lee como un elemento principal y no como una card más.
- El canvas permanece inmóvil: no hay hueco ni recentrado del dock al abrir/cerrar.
- Cierre coherente con cualquier overlay: botón del `PanelHeader`, `Escape` o clic fuera.

### Negativas

- Los accesos a «Bandeja de entrada» (sidebar y Quick Actions) quedan detrás del scrim mientras está abierta; el cierre depende del panel.
- Se pierde la vista de las acciones de la barra de trabajo mientras la bandeja está abierta (excepción a ADR-0101).
- El modo `modal` de Radix captura el foco: si hay un drawer de entidad abierto, queda inactivo hasta cerrar la bandeja.

## Alternativas consideradas

- **Cambiar los defaults de `CollapsibleSheet` a overlay.** Rechazado: habría convertido en bloqueantes todos los drawers y el panel de perfil.
- **Mantener el empuje además del overlay.** Rechazado: visualmente redundante y deja un hueco lateral.
- **Scrim solo visual (canvas interactivo).** Rechazado: no transmite la importancia del elemento ni evita clics en la lista de detrás.
- **Entrada desde la izquierda.** Descartada tras el ajuste final: el panel entra desde la derecha para mantener el lado de los paneles globales.

## References

- `frontend/features/workflow/components/TaskInboxSidebar.tsx`
- `frontend/components/shared/CollapsibleSheet.tsx`
- `frontend/components/layout/DashboardShell.tsx`
- `frontend/components/shared/ActionDock.tsx`
