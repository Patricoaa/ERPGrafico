---
id: 0155
title: Dominio documental `hr` (RRHH) y ventana reciente (`window`) en las relaciones documentales
status: Accepted
date: 2026-11-23
author: backend-team + frontend-team
---

# 0155 — Dominio RRHH y ventana reciente en relaciones

**Relacionado:** ADR-0080 (modelo documental), ADR-0083 (ficha documental, dominios), ADR-0154 (Employee archivable), `docs/20-contracts/document-relations.md`, `docs/20-contracts/component-document-sheet.md`.

## Contexto

La ficha de empleado no mostraba nada de lo que la rodea (liquidaciones, anticipos, inasistencias, pagos). Los tipos de RRHH caían en el área «Otros» (`hr` no tenía dominio) y solo `hr.payroll` y `hr.payrollconcept` estaban registrados. Además, un empleado antiguo acumula decenas de liquidaciones y, con los asientos indirectos, cientos de filas: la pestaña de relaciones listaba todo sin límite.

## Decisión

1. **Dominio `hr`** («RRHH»), ordenado entre `capital` y `contacts`. `DEFAULT_DOMAIN_BY_APP["hr"] = "hr"`.
2. **Tipos y proveedores de RRHH** registrados en `hr/relations.py`: `hr.employee`, `hr.absence`, `hr.salaryadvance`, `hr.payrollpayment` (junto a `hr.payroll` y `hr.payrollconcept`). Los vínculos empleado↔documento son `association` con `is_dependency=False` (si fueran dependencias la ventana nunca los ocultaría).
3. **Ventana reciente.** `GET …/relations/?window=recent|all`, default de la API **`all`** (ningún consumidor existente cambia; valor inválido → 400). Con `recent`, por área: solo se recorta si hay más de 10 vínculos; nunca se ocultan `is_dependency` ni los sin fecha; se conservan los de los últimos 12 meses y, si quedan menos de 10, se completa con los más recientes. La respuesta añade `window` y `hidden` (`{<dominio>: n}`).
4. **`DocumentRelationsTab` pide `recent` por defecto** (prop `window`), muestra «N anteriores» en el área y «Ver más (N)», que re-pide con `all` para toda la pestaña. Así la ventana aplica a todas las entidades que usan la pestaña.
5. **Pestaña «Relaciones» en los drawers de RRHH** que son formularios: empleado, inasistencia y anticipo. La liquidación conserva `DocumentRelationsButton` (su ficha es un flujo propio, ADR-0083 U5). Concepto, AFP y pago de remuneración no tienen drawer de entidad.

## Consecuencias

- La ventana recorta respuesta y render, **no** la resolución: el servicio sigue resolviendo todos los vínculos. Optimización posterior: que los proveedores filtren por fecha en su queryset (cambia la firma de los proveedores).
- La fecha de una liquidación es `created_at` (no declara `date_field`), por lo que la ventana la evalúa por creación, no por período.
- `DrawerLayout.contentDisabled` envuelve *todas* las pestañas en un `fieldset disabled`; los drawers con pestaña de relaciones bloquean solo sus pestañas de formulario para que las filas sigan siendo clicables.
- Campos aditivos en la respuesta (`window`, `hidden`); el frontend los parsea con defaults (`all`, `{}`).
