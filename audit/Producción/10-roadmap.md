# 10 — Roadmap de Implementación

> Plan ordenado en fases con dependencias explícitas. Cada fase produce un entregable verificable y mergeable de forma independiente. Las fases tempranas desbloquean las tardías.

---

## Mapa de dependencias

```
FASE 1 ─┬─> FASE 2 ─┬─> FASE 3 ─┬─> FASE 4
(P0)    │  (P1 DRY) │  (P2 ERP) │  (P3 UX/Features)
        │           │           │
        └─ TASK-001 ┘           └─ TASK-301..317
           TASK-002              (independientes
           TASK-003               entre sí)
```

Las fases 1 y 2 son **secuenciales** (P1 depende del refactor base de P0).
Las fases 3 y 4 contienen tareas **paralelizables** (ver el grafo de dependencias dentro de cada una en [20-task-list.md](20-task-list.md)).

---

## FASE 1 — Estabilización (P0, bugs críticos)

**Objetivo:** dejar el módulo compilable, los filtros funcionando y sin crashes potenciales.

**Estimación:** 0.5 — 1 día.

**Entregables:**
- `tsc --noEmit` pasa sin errores en `features/production/`.
- Filtros de fecha del DataTable de OTs funcionan.
- Columna "Fecha Entrega" muestra el valor correcto.
- `create_from_sale_line` ya no puede crashear por delivery sin warehouse.

| ID | Tarea | Esfuerzo | Bloquea |
|---|---|---|---|
| TASK-001 | Fix `MaterialAssignmentStep.tsx` (state no declarado) | XS | TASK-101 |
| TASK-002 | Mapear `due_date` como alias en `WorkOrderSerializer` | XS | TASK-301 |
| TASK-003 | Fix FilterSet (`due_date` → `estimated_completion_date`) | XS | — |
| TASK-004 | Fix `deliveries.first().warehouse` con filtro previo | XS | — |
| TASK-005 | Validar transiciones de etapa en backend (no permitir saltos) | S | TASK-201 |
| TASK-006 | Cambiar `print()` por `logging.exception()` | XS | — |

**Criterio de salida de fase:**
- [ ] `npm run type-check` en `frontend/` pasa.
- [ ] `pytest backend/production/` pasa (incluyendo nuevos tests de las tareas anteriores).
- [ ] Manualmente: abrir wizard de OT en etapa MATERIAL_ASSIGNMENT, agregar y editar tercerizado, no debe haber errores en consola.

---

## FASE 2 — Refactor DRY (P1)

**Objetivo:** consolidar componentes duplicados, centralizar constantes, usar el hook que ya existe.

**Estimación:** 4 — 5 días.

**Pre-requisitos:** FASE 1 completa.

**Entregables:**
- Componente compartido `<OutsourcedServiceForm>` usado en 3 sitios.
- Componente compartido `<ManufacturingSpecsEditor>` usado en sales/checkout y production/form.
- Hook `useWorkOrderMutations` usado por todos los componentes que llamaban `api.*` directo.
- `STAGES_REGISTRY` único en `features/production/constants/stages.ts`.
- `services.py` con `_expand_bom_into_materials()` y `_create_initial_artifacts()` extraídos.
- IVA hardcoded `1.19` reemplazado por `useVatRate()` hook (frontend) / `AccountingSettings.vat_rate` (backend).
- `stage_data` con una sola estructura canónica.

| ID | Tarea | Esfuerzo | Depende | Patrón |
|---|---|---|---|---|
| TASK-101 | Crear `<OutsourcedServiceForm>` y migrar 3 usos | M | TASK-001 | [P-OSF](30-patterns.md#patron-outsourcedserviceform) |
| TASK-102 | Crear `useVatRate()` hook + endpoint `accounting/settings/vat/` | S | — | [P-VAT](30-patterns.md#patron-usevatrate) |
| TASK-103 | Reemplazar `1.19` hardcoded por `useVatRate()` | S | TASK-102 | — |
| TASK-104 | Crear `STAGES_REGISTRY` y migrar wizard + kanban | S | — | [P-STG](30-patterns.md#patron-stages_registry) |
| TASK-105 | Migrar `WorkOrderWizard` a `useWorkOrderMutations` | S | — | — |
| TASK-106 | Migrar `MaterialAssignmentStep` + `OutsourcingAssignmentStep` a hook | S | TASK-101, TASK-105 | — |
| TASK-107 | Migrar `orders/page.tsx` a `useWorkOrderMutations` | XS | TASK-105 | — |
| TASK-108 | Crear `<ManufacturingSpecsEditor>` compartido | M | — | [P-MSE](30-patterns.md#patron-manufacturingspecseditor) |
| TASK-109 | Migrar `AdvancedManufacturingModal` y `WorkOrderMaterials` a editor | M | TASK-108 | — |
| TASK-110 | Refactor `services.py` con `_expand_bom_into_materials()` | M | — | [P-WCC](30-patterns.md#patron-workordercreationcore) |
| TASK-111 | Refactor `services.py` con `_create_initial_artifacts()` | S | TASK-110 | — |
| TASK-112 | Definir shape canónica de `stage_data` + migración inline | M | — | [P-SDC](30-patterns.md#patron-stagedatacanonical) |
| TASK-113 | Eliminar 4 copias del dict en `_map_manufacturing_data` | XS | TASK-112 | — |

**Criterio de salida de fase:**
- [ ] Zero ocurrencias de `1.19` en `frontend/features/production/` y `frontend/features/sales/components/`.
- [ ] Zero llamadas `api.*` directas en componentes de `features/production/components/`.
- [ ] `STAGES_REGISTRY` importado en `WorkOrderWizard` y `WorkOrderKanban`.
- [ ] Cada `create_*` en `services.py` ≤ 30 LOC.
- [ ] Cobertura pytest > 80% en `backend/production/services.py`.

---

## FASE 3 — Gaps ERP (P2)

**Objetivo:** cerrar gaps de buenas prácticas que tienen impacto en data integrity y operativa diaria.

**Estimación:** 8 — 10 días.

**Pre-requisitos:** FASE 2 completa.

**Entregables:**
- Numeración configurable con prefijo por año.
- Unique constraint contra dobles OT por sale_line.
- PDF de OT con template HTML + QR.
- Endpoint `/production/orders/metrics/` operativo.
- `views.py` con todos los métodos ≤ 20 LOC.
- Discrepancia de servicios tercerizados visible en UI.

| ID | Tarea | Esfuerzo | Depende |
|---|---|---|---|
| TASK-201 | UniqueConstraint contra doble OT por sale_line | S | TASK-005 |
| TASK-202 | Refactor `WorkOrderViewSet.create` a `WorkOrderService.create_from_request_payload()` | M | TASK-111 |
| TASK-203 | PDF de OT con template HTML (weasyprint) + branding | M | — |
| TASK-204 | Endpoint `/production/orders/metrics/` (tiempo por etapa) | M | — |
| TASK-205 | Card "Métricas de Producción" en dashboard | S | TASK-204 |
| TASK-206 | Numeración con prefijo configurable (`SequenceService`) | M | — |
| TASK-207 | Permitir `unique_together` con `is_outsourced` + `supplier` | S | — |
| TASK-208 | Mostrar costo planificado vs real en `WorkOrderMaterialSerializer` | S | — |
| TASK-209 | Rectificación de servicios tercerizados (UI + service) | M | — |
| TASK-210 | Stage data versionado (`_version: 1`) + migrate-on-read | M | TASK-112 |

**Criterio de salida de fase:**
- [ ] Tests de regresión: race condition al crear OT duplicada falla con `IntegrityError`.
- [ ] Endpoint `/production/orders/metrics/` responde con tiempos promedios por etapa.
- [ ] PDF de OT incluye logo, QR, specs técnicas legibles.
- [ ] Cada acción en `views.py` ≤ 20 LOC, lógica en `services.py`.

---

## FASE 4 — UX y Features nuevos (P3)

**Objetivo:** mejoras de experiencia de usuario que no requieren cambios de modelo. Cada tarea es **independiente** y puede priorizarse según feedback de usuarios.

**Estimación:** 12 — 15 días.

**Pre-requisitos:** FASE 3 completa (algunas tareas usan endpoints/patrones creados allí).

**Sugerencia de orden por valor/esfuerzo:** TASK-301 → TASK-302 → TASK-310 → TASK-308 → resto según prioridad del owner.

| ID | Tarea | Esfuerzo | Valor |
|---|---|---|---|
| TASK-301 | Badge "OT atrasada" en kanban y tabla | XS | Alto |
| TASK-302 | Botón "Duplicar OT" en lista y wizard | S | Alto |
| TASK-303 | Vista "Mi cola de trabajo" filtrada por user | S | Alto |
| TASK-304 | Atajo `/production/orders/new?type=stock&product_id=X` | XS | Medio |
| TASK-305 | Notificaciones de OT atrasada (Celery beat) | S | Alto |
| TASK-306 | Cambio masivo de estado / impresión masiva | M | Medio |
| TASK-307 | Sincronizar comentarios OT ↔ NV (feed unificado) | M | Alto |
| TASK-308 | Drag-and-drop en kanban | S | Alto |
| TASK-309 | Vista previa de impacto al rectificar | S | Medio |
| TASK-310 | Empty state útil en BOMs | XS | Medio |
| TASK-311 | Cheatsheet modal con `?` (atajos teclado) | XS | Bajo |
| TASK-312 | Plantillas de OT por cliente | M | Alto |
| TASK-313 | QR/Barcode en hoja de OT + endpoint scan | M | Muy alto |
| TASK-314 | Tiempo estimado por etapa en BOM | M | Medio |
| TASK-315 | Foto del producto final en `FinishedStep` | XS | Medio |
| TASK-316 | Botón "Imprimir copia" (re-impresión rápida) | S | Medio |
| TASK-317 | Tablero "Hoy / Mañana / Esta semana" | S | Alto |

**Criterio de salida de fase:**
- [ ] Cada feature merged tiene su validación manual documentada.
- [ ] Cero regresiones detectadas por usuarios piloto en 2 semanas.

---

## Cronograma sugerido

| Semana | Fase | Tareas | Estado |
|---|---|---|---|
| 1 | FASE 1 | TASK-001 → TASK-006 | Pendiente |
| 2 | FASE 2 (parte 1) | TASK-101 → TASK-104 | Pendiente |
| 3 | FASE 2 (parte 2) | TASK-105 → TASK-113 | Pendiente |
| 4 | FASE 3 (parte 1) | TASK-201 → TASK-205 | Pendiente |
| 5 | FASE 3 (parte 2) | TASK-206 → TASK-210 | Pendiente |
| 6-8 | FASE 4 | Selección según prioridad | Pendiente |

---

## Estrategia de PRs

**Una tarea = un PR**, salvo excepciones explícitas:
- TASK-101 incluye los 3 migrations de usos (no se mergea el componente shared sin los reemplazos).
- TASK-108/109 igual: el editor se mergea con sus dos consumers migrados.
- TASK-105/106/107 pueden hacerse en un solo PR si el LLM los ejecuta en serie.

**Naming de branches:**
```
feat/prod-task-XXX-<slug>
fix/prod-task-XXX-<slug>
refactor/prod-task-XXX-<slug>
```

**Naming de commits:**
```
[TASK-XXX] <imperativo corto>

<contexto si hace falta>
```

**Criterios para mergear cualquier PR del plan:**
1. `npm run type-check` y `npm run lint` pasan.
2. `pytest backend/production/` pasa.
3. Si toca `services.py` o `views.py`, hay nuevo test pytest cubriendo el cambio.
4. PR description referencia el TASK-XXX y marca su criterio de aceptación.
