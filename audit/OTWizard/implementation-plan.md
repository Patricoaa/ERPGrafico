---
layer: 50-audit
doc: ot-wizard-implementation-plan
status: ready-to-execute
owner: production-frontend
created: 2026-05-19
prerequisite: ./README.md
---

# Plan de Implementación — Unificación OT Wizard

Ejecución ordenada de tasks atómicas. Cada task es ejecutable en aislamiento por un LLM siguiendo los estándares del repo (CLAUDE.md + invariantes globales).

---

## Fases

```
┌────────────────────────────────────────────────────────────────┐
│  FASE 1 — Saneamiento (sin cambios visibles)                   │
│  Tasks: 01, 02                                                 │
│  Outcome: hooks de feature limpios + tipos discriminados       │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  FASE 2 — Refactor estructural (sin cambio de UX aún)          │
│  Tasks: 03                                                     │
│  Outcome: WorkOrderForm desacoplado del BaseModal,             │
│           reusable como step embebido                          │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  FASE 3 — Wizard unificado (cambio visible)                    │
│  Tasks: 04, 05                                                 │
│  Outcome: Step 0 dentro del wizard + deeplinks + idempotency   │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  FASE 4 — Limpieza y cobertura                                 │
│  Tasks: 06, 07                                                 │
│  Outcome: page.tsx simplificado + tests actualizados           │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  FASE 5 (opcional) — Atomicidad backend                        │
│  Tasks: 08                                                     │
│  Outcome: create + initial materials en una transacción        │
└────────────────────────────────────────────────────────────────┘
```

---

## Tabla de tareas

| # | Task | Depende de | Bloqueante para | Estimación |
|---|---|---|---|---|
| 01 | [Extraer `useQuery` a feature hooks](./tasks/01-extract-feature-hooks.md) | — | 03 | S |
| 02 | [Tipos discriminados + Zod refactor](./tasks/02-discriminated-mode-types.md) | — | 03 | S |
| 03 | [Crear `WorkOrderBasicStep`](./tasks/03-basic-step-component.md) | 01, 02 | 04 | M |
| 04 | [Wizard con `mode: 'create' \| 'manage'`](./tasks/04-wizard-create-mode.md) | 03 | 05, 06 | M |
| 05 | [Routing + deeplink + idempotency](./tasks/05-routing-and-deeplink.md) | 04 | 06 | S |
| 06 | [Cleanup `page.tsx`](./tasks/06-cleanup-page.md) | 04, 05 | 07 | S |
| 07 | [Tests](./tasks/07-tests.md) | 06 | — | M |
| 08 | [Backend `initial_materials[]` (opcional)](./tasks/08-optional-initial-materials.md) | — (independiente) | — | M |

Tamaños: **S** ≈ <2h, **M** ≈ 2–4h.

---

## Reglas globales para cada task

Cada task debe cumplir lo siguiente antes de marcarse `completed`:

1. **No introduce `any`** ni `// @ts-ignore`. Si surge un error de tipo, leer [resolve-type-errors.md](../../30-playbooks/resolve-type-errors.md).
2. **No usa colores Tailwind crudos** (`bg-red-500`). Sólo tokens semánticos (`bg-primary`, `text-destructive`).
3. **No introduce `useQuery`/`useMutation` en componentes** — todo via `features/production/hooks/`.
4. **Imports de shared via barrel** — `import { X } from '@/components/shared'`.
5. **Forms via `react-hook-form` + `zodResolver`**.
6. **Comentarios sólo si el "por qué" no es obvio** — nunca describir el "qué".
7. Tras editar:
   - `cd frontend && npm run type-check` ✅
   - `cd frontend && npm run lint` ✅
   - `cd frontend && npm run test -- features/production` ✅ (cuando aplique)
   - Para backend: `pytest backend/production -q` ✅

---

## Contrato de ejecución para el LLM

Al iniciar cada task, el LLM debe:

1. **Leer el archivo de la task completo** antes de escribir código.
2. **Leer los archivos del repo listados en `Archivos afectados`** en su totalidad.
3. **Consultar [contracts.md](./contracts.md)** si la task toca payload/serializer/tipos.
4. **Respetar el orden** — no saltar tasks. Si una dependencia no existe, detenerse y avisar.
5. **No hacer commits** salvo que el usuario lo pida explícitamente (CLAUDE.md).
6. Al terminar:
   - Reportar cambios con paths y números de línea.
   - Listar comandos de validación ejecutados y su resultado.
   - Si algún `Criterio de aceptación` no se cumple, marcar la task como `blocked` y describir el bloqueo.

---

## Rollback plan

El refactor es reversible en cualquier fase:

- **Fase 1–2**: revertir commits — cero cambios de comportamiento, cero riesgo.
- **Fase 3** sin Fase 4: `WorkOrderBasicStep` queda como componente independiente; `page.tsx` sigue importando `WorkOrderForm` antiguo (que sigue existiendo como wrapper). Sin downtime.
- **Fase 4**: feature flag `OT_WIZARD_UNIFIED` (env var en `next.config`) permite alternar entre wizard unificado y flujo antiguo durante 1 sprint de validación. Eliminar tras estabilización.
- **Fase 5** (opcional): la mejora backend es aditiva — el cliente puede seguir usando 2 llamadas; el rollback es desplegar versión previa del serializer.

---

## Definition of Done (global)

Al completar tasks 01–07:

- [ ] Una OT manual puede crearse desde inicio hasta MATERIAL_ASSIGNMENT sin abrir un segundo modal.
- [ ] Una OT linked puede crearse desde inicio hasta MATERIAL_ASSIGNMENT sin abrir un segundo modal.
- [ ] La edición de datos básicos (en etapas `MATERIAL_ASSIGNMENT|MATERIAL_APPROVAL|PREPRESS`) ocurre dentro del wizard.
- [ ] Deep-link `?selected=ID&step=PRESS` reabre el wizard en la etapa correcta.
- [ ] Deep-link `?new=true&type=stock&product_id=X` abre el wizard en Step 0 con producto preseleccionado.
- [ ] `npm run type-check` y `npm run lint` pasan.
- [ ] `pytest backend/production` pasa.
- [ ] Tests de Vitest en `features/production` pasan.
- [ ] LOC neto del módulo `features/production/components/` no aumenta más de +200.
- [ ] Cero `useQuery` directos en `components/forms/`.
- [ ] Cero violaciones de invariantes globales en archivos tocados.

---

## Próximo paso

Abrir [tasks/00-overview.md](./tasks/00-overview.md) e iniciar por [tasks/01-extract-feature-hooks.md](./tasks/01-extract-feature-hooks.md).
