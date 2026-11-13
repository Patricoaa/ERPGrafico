---
id: 0136
title: `Section` compartida reemplaza FormSection, SummarySection y PendingChecklist
status: Accepted
date: 2026-11-12
author: frontend-team
---

# 0136 — `Section` compartida

## Contexto

El patrón «cabecera en mayúsculas + filas con divisores» existía cuatro veces con estilos casi idénticos: `FormSection` (separador centrado, 111 usos), `SummarySection/Row/Note` (wizards), `PendingChecklist` (en `features/tax`, consumido desde `accounting`, violando la regla de imports entre features) y encabezados escritos a mano en las pestañas del perfil. Más copias locales de `SummaryRow` en tres wizards.

## Decisión

1. Se crea `Section` en `components/shared/Section/` (compuesto: `Header`, `Row`, `Note`, `Action`, `Checklist`). Contrato en [component-section.md](../../20-contracts/component-section.md).
2. La cabecera convencional (título alineado a la izquierda, línea inferior, icono/conteo/acciones) reemplaza el separador centrado de `FormSection`. Mantiene el estilo N1 del contrato tipográfico.
3. Los controles de fila (`control`) son nodos controlados externamente; la fila no tiene lógica de formulario.
4. Se migran y eliminan `FormSection`, `SummaryList` y `PendingChecklist`. El `SectionHeader` de tarjetas de tesorería (`href` «Ver todas») queda aparte.

## Consecuencias

- Los formularios cambian de aspecto (separador centrado → cabecera con línea inferior).
- Una sola pieza para checklists, resúmenes y pestañas de datos; nuevos usos no requieren componente propio.
- Pendiente: unificar el `SectionHeader` de tesorería y migrar otras pestañas/wizards que aún usan encabezados a mano.
