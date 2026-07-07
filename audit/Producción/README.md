# Auditoría del Módulo de Producción — ERPGrafico

**Fecha auditoría:** 2026-05-15
**Alcance:** Backend (`backend/production/`) + Frontend (`frontend/features/production/`) + integraciones cruzadas con `sales`, `billing`, `pos`, `inventory`, `purchasing`, `workflow`.
**Tipo:** Auditoría completa con plan de remediación ejecutable por LLM.

---

## Cómo leer este folder

Si vas a **implementar**, comienza por [99-llm-execution-guide.md](99-llm-execution-guide.md) — define precondiciones, comandos y criterios de éxito por tarea.

Si vas a **revisar el análisis**, lee [00-audit-report.md](00-audit-report.md).

Si necesitas **entender la priorización**, lee [10-roadmap.md](10-roadmap.md).

| Archivo | Propósito | Audiencia |
|---|---|---|
| [00-audit-report.md](00-audit-report.md) | Hallazgos completos: bugs, DRY, gaps ERP, UX | Lectura humana |
| [10-roadmap.md](10-roadmap.md) | Fases ordenadas con dependencias y entregables | PM / tech lead |
| [20-task-list.md](20-task-list.md) | Tareas atómicas con criterios de aceptación | Ejecutor (LLM o dev) |
| [30-patterns.md](30-patterns.md) | Patrones reusables a crear (`OutsourcedServiceForm`, `useWorkOrderMutations`, etc.) | Ejecutor |
| [40-testing-strategy.md](40-testing-strategy.md) | Qué probar, cómo, y dónde poner el test | Ejecutor |
| [99-llm-execution-guide.md](99-llm-execution-guide.md) | Manual operativo paso-a-paso para que un LLM ejecute el plan | LLM |

---

## Resumen ejecutivo

El módulo de producción está **funcionalmente completo** para una imprenta pequeña pero arrastra:

- **6 bugs latentes** activos (TypeScript roto en runtime, filtros que no filtran, AttributeError potencial).
- **8 violaciones DRY** mayores (formulario de tercerizado duplicado 3 veces, IVA 1.19 hardcoded en 8+ sitios, constantes de etapas en 3 lugares, hook `useWorkOrderMutations` no usado por nadie).
- **10 gaps de buenas prácticas ERP** (PDF rudimentario, sin métricas por etapa, sin trazabilidad real vs planificado en servicios).
- **12 oportunidades de UX** de alto valor / bajo esfuerzo (duplicar OT, drag-and-drop kanban, QR planta, vista "mi cola").

**Veredicto:** la arquitectura **no necesita expansión** — necesita **consolidación**. El refactor unifica entrypoints, elimina redundancias en `stage_data`, aprovecha el hook que ya está construido pero nadie usa, y agrega features pequeños de alto impacto.

---

## Decisiones arquitectónicas tomadas (input del owner)

Antes de redactar este plan se acordaron las siguientes decisiones, que orientan toda la implementación:

1. **Auditoría previa en `docs/50-audit/OT/`** queda intacta como referencia histórica. Este folder es la **fuente de verdad activa**.
2. **Campo `estimated_completion_date`** del modelo se mantiene (sin migración). Se expone como alias `due_date` en el serializer para alinear con frontend/filtros existentes.
3. **Alcance del plan:** completo (P0 → P3), incluye features nuevos (QR, plantillas, métricas).
4. **Tests obligatorios** en backend (pytest) para cada cambio de `services.py`/`views.py`. Frontend (vitest) opcional salvo en hooks centralizados (`useWorkOrderMutations`).

---

## Convenciones de las tareas

Cada tarea en [20-task-list.md](20-task-list.md) usa este formato:

```
### TASK-XXX — Título corto
**Prioridad:** P0 | P1 | P2 | P3
**Tipo:** Bugfix | DRY | Refactor | Feature | UX
**Esfuerzo:** XS | S | M | L
**Archivos:** lista clickeable
**Dependencias:** TASK-YYY si aplica

Descripción de qué hay que cambiar y por qué.

**Criterio de aceptación:**
- [ ] Condición concreta verificable
- [ ] Otra condición

**Comandos de verificación:**
- `comando 1`
- `comando 2`
```

Las **prioridades** son:
- **P0** — bug en producción / TypeScript roto / data inconsistente. Bloquea release.
- **P1** — DRY crítico o regla del proyecto violada (zero-any, `useQuery` en componente, etc.).
- **P2** — refactor profundo, mejora de calidad estructural sin urgencia.
- **P3** — feature nuevo o UX nice-to-have.

---

## Métricas de éxito del proyecto

Al cerrar el plan completo se espera:

- `npm run type-check` y `npm run lint` pasan sin errores en `features/production/`.
- `pytest backend/production/` con cobertura > 80% en `services.py`.
- Cero llamadas directas `api.*` en componentes de `features/production/components/`.
- Cero ocurrencias hardcoded de `1.19` en frontend.
- Constantes de `Stage` definidas en **un** solo archivo (`features/production/constants/stages.ts`).
- Formulario "Servicio Tercerizado" centralizado en **un** componente compartido.
- Endpoint `/production/orders/metrics/` operativo y consumido por una card del dashboard.
- PDF de OT renderizado con template HTML (weasyprint), no `reportlab.canvas` plano.
