---
layer: 50-audit
doc: ot-wizard-tasks-index
status: active
---

# Tasks — OT Wizard Unification

Ejecutar en el orden listado. Cada task tiene su propio archivo con scope, acceptance, validation.

## Orden de ejecución

| # | Task | Fase | Estado |
|---|---|---|---|
| [01](./01-extract-feature-hooks.md) | Extraer `useQuery` a feature hooks | 1 (saneo) | ✅ done |
| [02](./02-discriminated-mode-types.md) | Tipos discriminados + Zod refactor | 1 (saneo) | ✅ done |
| [03](./03-basic-step-component.md) | Crear `WorkOrderBasicStep` | 2 (estructural) | ✅ done |
| [04](./04-wizard-create-mode.md) | Wizard con `mode: 'create' \| 'manage'` | 3 (visible) | pending |
| [05](./05-routing-and-deeplink.md) | Routing + deeplink + idempotency | 3 (visible) | pending |
| [06](./06-cleanup-page.md) | Cleanup `page.tsx` | 4 (limpieza) | pending |
| [07](./07-tests.md) | Tests | 4 (limpieza) | pending |
| [08](./08-optional-initial-materials.md) | Backend `initial_materials[]` (opcional) | 5 (mejora) | optional |

## Reglas del LLM ejecutor

Antes de empezar cualquier task:

1. ✅ Leer [../README.md](../README.md) (auditoría y decisiones).
2. ✅ Leer [../implementation-plan.md](../implementation-plan.md) (fases y DoD).
3. ✅ Leer [../contracts.md](../contracts.md) (contratos a preservar).
4. ✅ Leer **completo** el archivo de la task antes de tocar código.
5. ✅ Leer **completos** los archivos del repo listados en `Archivos afectados`.

Tras cada task:

- Reportar paths + line numbers de los cambios.
- Ejecutar los comandos listados en `Validación`.
- Si falla algún `Criterio de aceptación`, marcar `blocked` y describir el bloqueo en lugar de continuar.

## Formato de cada task

Cada archivo `NN-*.md` sigue este shape:

```
# Task NN — <Título>

## Objetivo
<Una frase>

## Depende de
<Tasks previas>

## Archivos afectados
<Lista con paths>

## Cambios paso a paso
<Pasos concretos>

## Contrato
<Qué NO se debe romper — referencia a contracts.md>

## Criterios de aceptación
<Checklist verificable>

## Validación
<Comandos a ejecutar>

## Rollback
<Cómo revertir si algo falla>
```
