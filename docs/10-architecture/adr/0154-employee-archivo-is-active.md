---
id: 0154
title: Employee migra de `status` ACTIVE/INACTIVE al patrón Archivo (`is_active`)
status: Accepted
date: 2026-11-23
author: backend-team + frontend-team
---

# 0154 — Employee sigue el patrón Archivo

**Relacionado:** `docs/20-contracts/deletion-policy.md`, `docs/30-playbooks/add-migration.md`, ADR-0091 (edit policy).

## Contexto

`Employee` era una excepción del patrón Archivo (`ARCHIVO_EXEMPT`): usaba `status` `ACTIVE`/`INACTIVE`, editable como un select ("Estado Ficha") dentro del formulario de contratación. Eso rompía la política en cuatro puntos: no había pareja `archive`/`restore` en row-actions, el listado no filtraba por defecto, el DELETE REST estaba permitido pese a que el empleado tiene liquidaciones POSTED y asientos, y el estado se podía cambiar sin pasar por una acción explícita.

## Decisión

1. `Employee.status` se reemplaza por `is_active` (Boolean, default `True`, `db_index=True`), igual que el resto de los datos maestros.
2. El listado devuelve solo activos por defecto; `?is_active=false` devuelve archivados y `?is_active=all` ambos. Detalle y edición alcanzan fichas archivadas.
3. `DELETE /hr/employees/{id}/` responde 405. Archivar/restaurar es `PATCH is_active`, expuesto en UI como acciones `archive` / `restore` con confirmación. El campo sale del formulario del drawer.
4. La generación masiva de liquidaciones borrador filtra `is_active=True`.
5. **`end_date` va atado al archivo.** Archivar fija `end_date` (el modal pide la fecha, por defecto hoy; sin valor el backend usa `localdate()`), debe ser ≥ `start_date`; restaurar la limpia, y un empleado activo no puede tener `end_date`. La regla vive en `EmployeeWriteSerializer.validate`.
6. **Anticipos e inasistencias** solo se crean (o se reasignan) para empleados activos: `validate_employee` responde 400 si el empleado está archivado. Editar un registro ya existente del mismo empleado archivado sigue permitido, y el selector del drawer lo muestra marcado "(archivado)".
7. `Employee` sale de `ARCHIVO_EXEMPT`; el test de arquitectura pasa a exigirle `is_active`, serializer y DELETE bloqueado.

## Migración

`hr/0015_employee_is_active`: añade `is_active` en `Employee` y `HistoricalEmployee`, backfill (`INACTIVE` → `False`), elimina `status`. Es reversible (el reverso recrea `status` y restaura `INACTIVE`). Se aplicó en una sola migración, sin las dos fases del playbook, porque no existe entorno de producción y el backfill es lossless; la API deja de aceptar `status` en el mismo cambio.

## Consecuencias

- Desaparece una fuente de excepción en la política y `status` ya no es editable libremente.
- Contrato de API: `status` y `status_display` salen de Employee; entra `is_active`. El filtro `?status=` deja de existir.
- Los pickers de anticipos e inasistencias solo ofrecen empleados activos; el backend lo hace cumplir.
- Employee expone `end_date` en la API (lectura y escritura).
