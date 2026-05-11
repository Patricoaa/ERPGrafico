# Auditoría de Arquitectura Django — Generic Form Injection & Universal Registry

> **Estado:** F1..F6 ejecutadas. F7 (corrección de rutas Universal Search) y F8 (reversión Phase 4 + expansión schema) **planificadas** — pendientes de aprobación para inicio.
> **Última actualización:** 2026-05-08
> **Alcance:** Backend Django (12 apps · ~7.800 líneas de modelos) + frontend Next.js
> **Objetivo:** Validar y planificar la refactorización hacia formularios genéricos data-driven y un registro universal de entidades.

---

## Cómo usar esta carpeta

Esta es una **refactorización mayor** que se ejecutará por fases a lo largo de varios sprints. La documentación está organizada para tres audiencias:

| Audiencia | Empieza por | Luego lee |
|-----------|-------------|-----------|
| **Stakeholder / decisor técnico** | [00-audit-report.md](00-audit-report.md) | [10-roadmap.md](10-roadmap.md) |
| **Tech lead planificando un sprint** | [10-roadmap.md](10-roadmap.md) | [20-task-list.md](20-task-list.md) |
| **Ingeniero ejecutando una tarea** | [20-task-list.md](20-task-list.md) | [30-patterns.md](30-patterns.md) + [40-migration-and-rollback.md](40-migration-and-rollback.md) |
| **QA / SRE diseñando validación** | [50-testing-strategy.md](50-testing-strategy.md) | [40-migration-and-rollback.md](40-migration-and-rollback.md) |

---

## Índice

| # | Documento | Propósito |
|---|-----------|-----------|
| 00 | [audit-report.md](00-audit-report.md) | Diagnóstico completo de la base actual: qué juega a favor, qué rompe la inyectabilidad, cuáles son los modelos bloqueantes |
| 10 | [roadmap.md](10-roadmap.md) | Plan en 5 fases con hitos, dependencias, criterios de salida y estimación de esfuerzo |
| 20 | [task-list.md](20-task-list.md) | Tareas atómicas con acceptance criteria, archivos afectados, esfuerzo y orden de ejecución |
| 30 | [patterns.md](30-patterns.md) | Guías de implementación para los 5 patrones clave: BaseModel, Strategy, GFK, DocumentService, UniversalRegistry, Metadata Schema |
| 40 | [migration-and-rollback.md](40-migration-and-rollback.md) | Estrategia de migración por fase, feature flags, rollback plan |
| 50 | [testing-strategy.md](50-testing-strategy.md) | Cómo validar que la refactorización no introduce regresiones contables/operativas |

---

## TL;DR de la auditoría

**Veredicto:** La arquitectura actual está **al ~60%** del objetivo. Lo restante son **tres deudas concretas**, no una reescritura.

**Lo que ya juega a favor:**
- `ContentType` + `GenericForeignKey` ya en producción ([core/models.py](../../../backend/core/models.py))
- `simple_history` consistente en 11 modelos
- `display_id` con prefijos por entidad estandarizados
- `Status.TextChoices` con `DRAFT/CONFIRMED/CANCELLED` recurrentes
- `services.py` por app ya creado en 11 apps
- Singletons con `get_solo()` + Redis cache unificados

**Las tres deudas a resolver:**
1. **Falta `BaseModel` abstracto** — cada modelo redefine `created_at`/`updated_at`/`notes`/`history` desde cero, con inconsistencias de `decimal_places`.
2. **Polimorfismo resuelto con `if class.__name__`** en lugar de Strategy ([core/mixins.py:71-72](../../../backend/core/mixins.py#L71-L72), [core/services.py:73-77](../../../backend/core/services.py#L73-L77)).
3. **Side-effects pesados en `Model.save()`** ([contacts/models.py:142-162](../../../backend/contacts/models.py#L142-L162) crea hasta 4 cuentas; [accounting/models.py:161-241](../../../backend/accounting/models.py#L161-L241) cascadea regeneración de códigos) que un form genérico no puede prever.

**Lo que NO se va a hacer (decisiones tomadas):**
- ❌ Migrar PKs a UUID (no aporta nada al objetivo, ruptura masiva).
- ❌ Forms genéricos para `Account`, `JournalEntry`, `Product (manufacturable)` — su complejidad es inherente y merecen forms especializados.
- ❌ Reescribir `accounting` o `contacts` — solo se extraen side-effects a servicios.

**Próximo paso recomendado:** ejecutar **Fase 1** del [roadmap](10-roadmap.md): introducir `BaseModel` abstractos + `UniversalRegistry` (sin tocar lógica de negocio). Bajo riesgo, valor visible en 2 sprints.

---

## Convenciones de estos documentos

- **Referencias a código** usan `[archivo:línea](ruta)` para que sean clicables desde VSCode.
- **Tareas** se identifican con código `T-NN` (ej: `T-01`) y se cruzan entre roadmap y task list.
- **Patrones** se identifican con código `P-NN` (ej: `P-01: BaseModel`).
- **Riesgos** se identifican con código `R-NN`.
- Toda tarea tiene **acceptance criteria** explícitos antes de poder marcarse como completada.

## Glosario corto

| Término | Significado en este contexto |
|---------|------------------------------|
| **Generic Form Injection** | Capacidad del frontend de renderizar el form de cualquier entidad con un solo componente, leyendo metadatos del backend. |
| **Universal Registry** | Catálogo central de entidades buscables en el ERP (la barra de navegación encuentra cualquier cosa). |
| **Inyectabilidad** | Qué tan preparado está un modelo para ser tratado como data-driven sin lógica custom en frontend. |
| **Strategy Pattern** | Patrón GoF que reemplaza ramas `if class == X` por objetos polimórficos. |
| **Singleton** (en este proyecto) | Modelo de configuración con `get_solo()` que cachea una única instancia (ej: `AccountingSettings`). |
| **Documento transaccional** | Cabecera de negocio con número, estado, totales y journal entry asociado (NV, OCS, FAC, AS, etc.). |

---

## Estado del trabajo

Sprint actual: **F1..F7 cerradas** + **F8 ejecutada parcialmente (T-80..T-84)** + **F8 reorientada el 2026-05-09 a Opción A** tras detectar que el shell de página completa de F7 produce una segunda UI de edición que coexiste con el modal de la lista, y que la expansión schema-driven de F8 original es innecesaria dado que los formularios existentes ya cumplen los contratos UI del proyecto.

**Brechas iniciales (originadas en auditoría 2026-05-08):**
1. **Universal Search → 404:** las 26 rutas declaradas en `apps.py::ready()` no coincidían con el App Router (slugs en español vs. rutas en inglés; sólo 4 entidades tenían `[id]` real). Resuelto en F7 (rutas `[id]` reales).
2. **Phase 4 forms → bifurcación crear/editar:** las migraciones de Budget/ProductCategory/UoM a `EntityForm` dejaron dos UIs distintas para la misma entidad. Resuelto por los reverts T-81..T-83.

**Brecha residual (detectada el 2026-05-09):**
3. **Doble UI de edición:** F7 introdujo `*DetailClient` + `EntityDetailPage` (página completa) que coexiste con el modal de edición local de la lista. Search lleva a página completa; click "Editar" en la lista abre modal. F8 (Opción A) corrige unificando el flujo sobre query-param: el deeplink redirige a `<list_url>?selected={id}` y la lista abre su modal local existente. Una sola UI canónica.

F8 (Opción A) descarta explícitamente la migración a EntityForm schema-driven — los formularios existentes ya cumplen los contratos UI y son la fuente de verdad.

Para actualizar el estado de cada tarea, edita [20-task-list.md](20-task-list.md). Para reportar bloqueos, agrégalos en la sección "Riesgos activos" de [40-migration-and-rollback.md](40-migration-and-rollback.md).
