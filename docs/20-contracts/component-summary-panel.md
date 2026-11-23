---
layer: 20-contracts
doc: component-summary-panel
status: beta
owner: frontend-team
last_review: 2026-11-22
---

# SummaryPanel — panel derecho de resumen

Superficie única (encabezado · líneas · total · acciones) para el carrito del POS y la lista de la
calculadora de costos. Import: `@/components/shared`.

## Piezas

| Pieza | Función |
|---|---|
| `SummaryPanel` | Superficie (`bg-card`, borde, sin sombra). |
| `SummaryPanelHeader` | Título + contador ("N ítems") + `leading` (p. ej. "Editar carrito") + `status` + `menu`. |
| `SummaryMenu` | Menú ⋮ declarativo. Entradas con `hidden`; si no queda ninguna, **no se dibuja**. Las destructivas van al final. |
| `SummaryLineList` / `SummaryLine` | Lista con estado vacío y de carga. Línea de 2 filas: nombre + total / precio × cantidad · unidad · insignias · acciones. |
| `SummaryTotal` | Total dominante (`text-3xl`) + desglose plegable + nota corta. |
| `SummaryActions` / `SummaryActionRow` | Pie de acciones; `ratio="1:2"` para Atrás / Siguiente. |

## Reglas

- **Táctil primero**: ningún control depende de hover; todos miden `control-touch`.
- Una acción primaria por contexto (POS: *Venta rápida*; checkout: *Siguiente* → *Finalizar venta* en verde).
- El motivo de un botón deshabilitado va en `SummaryActions hint`, nunca dentro de la etiqueta.
- El guardado del borrador es automático: se muestra `AutoSaveStatusBadge`, sin botón "Guardar".
- **Continuar en otro equipo** (antes "Pagar en otra sesión") está disponible en todos los pasos, junto a las
  acciones principales, y exige confirmación: libera el carrito para editarlo desde otro equipo.

## Consumidores

POS (`features/pos/components/Cart.tsx`, `CartItem.tsx`) y `components/tools/CostCalculatorDrawer.tsx`.
Promoción a shared con 2 consumidores: la calculadora no puede importar internals de `features/pos`.
