---
id: 0160
title: Control de período compartido (`PeriodPicker`) y barra de informes alineada con la barra de colección
status: Accepted
date: 2026-11-26
author: frontend-team
---

# 0160 — Control de período compartido y barra de informes

**Relacionado:**
- ADR-0158 (barra de colección; dejó «la alineación de `ReportToolbar`» para una etapa posterior).
- ADR-0091 (`DateRangeFilter` en `BaseModal`, que este ADR reemplaza).

## Contexto

Elegir un período tiene hoy tres controles distintos:

| Dónde | Control | Cómo se ve y se usa |
|---|---|---|
| Listas (`Collection.Toolbar`, filtro `date`) | `DatePane` en el menú de filtros | Presets («Hoy», «Este mes»…) + Desde/Hasta + «Aplicar». Se aplica al cerrar el menú y Esc descarta |
| Informes (`ReportToolbar`: estados financieros, análisis) | `DateRangeFilter` ×2 | Botón fantasma con el texto «Período Actual». Abre un **modal** con calendario de dos meses y «Cancelar/Aceptar». Sin presets |
| Drawers y modales (libro mayor, ficha de cuenta, lotes de terminal, historial de suscripción) | `DateRangeFilter` | Igual que en los informes |

Además, `ReportToolbar` no sigue la barra de comandos:
- los botones llevan el nombre de la herramienta («Mapeo», «Vista: Año», «Comparar»), no su valor;
- «Comparar» es un interruptor separado del segundo período;
- no tiene `role="toolbar"`.

Problemas:
1. **Abrir un modal para elegir un período es desproporcionado.** El período más usado en informes (año a la fecha, mes anterior) requiere navegar el calendario.
2. **Dos gramáticas para lo mismo.** Quien filtra por fecha en una lista y luego abre un informe aprende otro control.
3. **Comparar en dos pasos.** Primero se activa el interruptor y después se ajusta un período que no se veía.

## Decisión

### 1. `PeriodPicker`, un solo control de período (`@/components/shared`)

- **Botón:** `CommandButton` con ícono de calendario.
  - El valor es el nombre del preset si el período coincide con uno («Este mes»); si no, el rango corto («1 ene – 26 nov 2026»).
  - El nombre del control va en el tooltip y en el nombre accesible («Período: Este mes»).
- **Panel:** popover, no modal. Es el mismo `PeriodPanel` que usa el filtro `date` de las listas:
  - presets como radios: elegir uno aplica de inmediato y cierra;
  - Desde/Hasta (`input type="date"`);
  - pie con «Quitar» (solo si `clearable`) y «Aplicar».
  - Cerrar aplica el borrador; Esc lo descarta, como en el menú de filtros (collection-toolbar §5.1).
- **Valor:** ISO (`{ from: "yyyy-MM-dd", to: "yyyy-MM-dd" } | null`), el mismo formato que los params de las listas. `lib/date-presets` da `periodOf(range)` / `datesOf(period)` para pantallas con `Date`.
- **Presets:** viven en `lib/date-presets` (`PERIOD_PRESETS`):
  - los cinco de las listas;
  - más «Año a la fecha», «Mes anterior» y «Año anterior», que piden los informes.
  - Cada pantalla elige cuáles muestra.
  - Se calculan con la fecha local. La fecha del servidor (`useServerDate`) sigue fijando solo el período **inicial** de los informes.

### 2. `ReportToolbar` como barra de comandos

`role="toolbar"`, de izquierda a derecha: alcance, presentación, acciones.

| Control | Botón | Comportamiento |
|---|---|---|
| Período | `PeriodPicker` «Período» | Presets de informe; no se puede quitar |
| Comparar con | `PeriodPicker` «Comparar con», ícono de comparar | Presets **relativos al período**: «Período anterior» (misma duración, justo antes) y «Mismo período del año anterior». Elegir uno activa la comparación; «Quitar» la apaga. Reemplaza el interruptor «Comparar» |
| Encabezado | `CommandButton` con valor («Año», «Mes/Año», «Día/Mes/Año») | Menú de radios |
| Mapeo, Exportar | Botones ghost de ícono con nombre en tooltip y `aria-label` | A la derecha, en `role="group" aria-label="Acciones del informe"`; los comandos con valor quedan a la izquierda (sin separador: el informe no tiene acción primaria) |

La API de `ReportToolbarProps` no cambia (`DateRange` de react-day-picker), así que las pantallas de informes no se tocan. El componente convierte internamente.

### 3. Se retira `DateRangeFilter`

- Sus cuatro consumidores (libro mayor, ficha de cuenta, lotes de terminal, historial de suscripción) pasan a `PeriodPicker`.
- `DateRangeFilter` se borra.
- El selector de fecha única (`DatePicker`) no cambia.

### 4. `CommandButton` pasa a `@/components/shared`

Lo usan ahora la barra de colección y la de informes, así que deja de ser interno de entity-view.

## Consecuencias

- **Positivas:**
  - Una sola gramática de período en listas, informes y drawers.
  - Los períodos habituales quedan a un clic.
  - Comparar es un solo control con presets relativos.
- **Negativas:**
  - Desaparece el calendario de dos meses. Un rango a medida se escribe en Desde/Hasta; el `input type="date"` del navegador trae su propio calendario.
  - Los presets usan la fecha local, no la del servidor. Es la misma regla que ya tienen las listas.
- **Contratos:** `component-datepicker.md` (patrón 2), `component-decision-tree.md` y `component-collection-toolbar.md` (§5, filtro `date`).

## Alternativas consideradas

- **Mantener el modal con calendario y agregarle presets.** Se descartó porque conserva dos gramáticas y el modal para una elección de un clic.
- **Popover con calendario de dos meses.** Se descartó: es demasiado ancho para drawers y no aporta frente a Desde/Hasta más presets en un ERP donde los períodos son meses y años.
- **Barra de informes construida sobre `Collection.Toolbar`.** Se descartó porque un informe no es una colección: no tiene búsqueda, filtros por campo ni vistas.
