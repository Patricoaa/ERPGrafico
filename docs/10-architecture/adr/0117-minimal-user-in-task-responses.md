---
id: 0117
title: Usuario mínimo embebido en las respuestas de tareas
status: Accepted
date: 2026-11-06
author: core-team
---

# ADR-0117 — Usuario mínimo embebido en las respuestas de tareas

**Relacionado:** [zero-n-plus-one-policy.md](../../90-governance/zero-n-plus-one-policy.md), contrato [`api-contracts.md`](../../20-contracts/api-contracts.md).

## Contexto

`GET /api/workflow/tasks/` es el endpoint con mayor tiempo acumulado del backend en Sentry: el frontend lo consulta cada 30 s (`useTasks`) y tiene un N+1 reportado (`FRONTEND-ERP-7Q`).

`TaskSerializer` embebía hasta tres usuarios (`assigned_to_data`, `created_by_data`, `completed_by_data`) con el `UserSerializer` completo. Ese serializer consulta, por usuario, sus grupos con perfil y todos sus permisos. Al estar declarado como campo anidado, se instancia sin `view` en el contexto, por lo que su protección para listados no retira `permissions`. Resultado medido: 22 queries con 1 tarea y 122 con 6.

El frontend no lee esos datos: declara `TaskUserData` como "datos mínimos" (`id`, `username`, `first_name`, `last_name`) y solo usa esos campos. Cada fila exponía además la lista completa de permisos de cada usuario sin necesidad.

## Decisión

`assigned_to_data`, `created_by_data` y `completed_by_data` usan `TaskUserSerializer`, con exactamente `id`, `username`, `first_name` y `last_name`. También aplica a las tareas embebidas en `WorkOrderSerializer.workflow_tasks`, que reutiliza `TaskSerializer`.

`UserSerializer` no cambia. `assigned_user_data` en reglas de asignación y de notificación queda fuera de esta decisión.

## Alternativas descartadas

- **Mantener el payload y precargarlo.** Los grupos se pueden precargar, pero `get_all_permissions()` calcula por instancia de usuario; evitarlo exigiría una caché de permisos para datos que nadie consume.
- **Recortar `permissions` y conservar `groups`.** Sigue siendo una query por usuario salvo con más precarga, para un campo sin consumidores.

## Consecuencias

- La consulta de tareas no crece con el número de filas; lo fija `workflow/tests/test_task_list_queries.py`.
- **Cambio de API:** las respuestas de tareas dejan de incluir `email`, `is_active`, `is_superuser`, `permissions`, `groups`, `contact` y `theme` en esos tres campos. No hay consumidores en el frontend; un consumidor externo tendría que usar `/api/core/users/{id}/`.
