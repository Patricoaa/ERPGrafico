# 10 — Hoja de Ruta

> **Audiencia:** tech leads, PMs, decisores.
> **Pregunta que responde:** ¿En qué orden y con qué esfuerzo se ejecuta esta refactorización?
> **Convención:** las fases son secuenciales en sus *gates*, pero dentro de cada fase hay paralelismo.

---

## Principios rectores

1. **Valor temprano, riesgo bajo primero.** Fase 1 entrega buscador universal sin tocar modelos.
2. **Sin big bangs.** Cada fase tiene rollback plan y feature flag (ver [40-migration-and-rollback.md](40-migration-and-rollback.md)).
3. **Tests antes de refactor.** Antes de tocar un modelo crítico, congelar su comportamiento con tests de caracterización ([50-testing-strategy.md](50-testing-strategy.md)).
4. **No tocar `accounting` ni `Account` en fase 1-3.** Su complejidad es de dominio, no técnica. Cualquier cambio espera a fase 5.
5. **Aceptar que algunos forms NO serán genéricos.** Ver §3 del [audit report](00-audit-report.md#22--bloqueantes--formulario-especializado-siempre).

---

## Resumen de fases

| Fase | Foco | Duración estimada | Riesgo | Dependencias |
|------|------|-------------------|--------|--------------|
| **F1** | Universal Registry (búsqueda) | 1 sprint (1-2 semanas) | Bajo | Ninguna |
| **F2** | BaseModel abstractos + cleanup de timestamps | 2 sprints (3-4 semanas) | Medio | F1 estable |
| **F3** | Strategy Pattern (Totals, DTE) + extracción de side-effects | 2 sprints (3-4 semanas) | Medio | F2 mergeada |
| **F4** | DocumentService + Metadata Schema endpoint | 2 sprints (3-4 semanas) | Medio-alto | F3 estable |
| **F5** | GenericForeignKey selectivo + ProductTypeStrategy | 3 sprints (5-6 semanas) | Alto | F4 estable, datos migrados |

**Esfuerzo total estimado:** 10-12 sprints (~5-6 meses con 1 ingeniero senior dedicado, o 3 meses con 2).

**Hito de "Generic Form Injection mínimo viable":** fin de F4. F5 es enabler para escalar.

---

## F1 — Universal Registry (Buscador Universal)

> **Patrón:** P-05 (ver [30-patterns.md#p-05-universal-registry](30-patterns.md#p-05-universal-registry))
> **Sin tocar modelos.** Solo se agrega un módulo nuevo y registros en `apps.py::ready()`.

### Objetivos

- Una barra de búsqueda global encuentra cualquier `SaleOrder`, `Contact`, `Invoice`, `Product`, etc., respetando permisos.
- API: `GET /api/search/?q=NV-001` retorna resultados de todas las apps registradas.
- Frontend: componente `<UniversalSearch />` consume el endpoint.

### Entregables

- `core/registry.py` con `UniversalRegistry` y `SearchableEntity`.
- Registros en `apps.py::ready()` para cada app (12 apps).
- Endpoint `core/api/search.py`.
- Componente frontend `frontend/components/shared/UniversalSearch.tsx`.
- Tests: por cada entidad registrada, un test de "search by code returns it".

### Gate de salida (criterios para considerar F1 completa)

- [ ] Las 12 apps están registradas con al menos `(model, search_fields, display_template)`.
- [ ] Endpoint pasa permisos por usuario (mock `is_staff` y verifica filtrado).
- [ ] Performance: query con 50.000 contactos + 100.000 movimientos retorna <300ms (medir antes de definir si necesita `tsvector`).
- [ ] Componente frontend cumple WCAG 2.1 AA.

### Tareas asociadas

`T-01` a `T-06` en [20-task-list.md](20-task-list.md).

---

## F2 — BaseModel abstractos + cleanup de timestamps

> **Patrón:** P-01 (ver [30-patterns.md#p-01-basemodel](30-patterns.md#p-01-basemodel))
> **Migración de schema.** Requiere `makemigrations` pero los campos ya existen (cambio de herencia, no de columnas en la mayoría de casos).

### Objetivos

- Extraer `created_at`/`updated_at`/`history` a clases abstractas.
- Estandarizar `decimal_places` en totales financieros.
- Agregar timestamps faltantes a `Account`, `JournalItem`, `*Settings`, `BudgetItem`.

### Entregables

- `core/models/abstracts.py` con `TimeStampedModel`, `AuditedModel`, `TransactionalDocument`.
- 8 modelos transaccionales migrados a `TransactionalDocument`.
- 6 modelos sin timestamps obtienen `TimeStampedModel`.
- Migración de datos: backfill de `created_at = updated_at = now()` solo donde no hay otra fecha disponible (el resto se infiere de `date` o `auto_now_add`).
- Decisión documentada en ADR sobre `decimal_places`: **estandarizar a `decimal_places=2`** para todos los totales (CLP usa 0 decimales pero la conversión USD/UF requiere precisión). Migración con cast.

### Gate de salida

- [ ] `python manage.py makemigrations --check --dry-run` retorna 0 cambios después del merge.
- [ ] Tests existentes pasan al 100%. Coverage no decae.
- [ ] Reportes financieros (Balance, Estado de Resultados) producen los mismos números antes/después de la migración (ver [50-testing-strategy.md](50-testing-strategy.md#regresión-financiera)).
- [ ] CHANGELOG.md actualizado con BREAKING CHANGES si los hay.

### Tareas asociadas

`T-07` a `T-15` en [20-task-list.md](20-task-list.md).

### Riesgos clave

- `R-01`: `simple_history` con `inherit=True` puede producir tablas históricas duplicadas si no se migra cuidadosamente. **Mitigación:** primero introducir abstractas vacías, después mover campos uno a uno con migrations explícitas.
- `R-02`: Cambiar `decimal_places=0 → 2` requiere casting en queries y aggregates existentes. **Mitigación:** auditar [accounting/services.py](../../../backend/accounting/services.py) y [billing/services.py](../../../backend/billing/services.py) antes del merge.

---

## F3 — Strategy Pattern + extracción de side-effects

> **Patrones:** P-02 (Strategy), parte de P-04 (cleanup de `Model.save`).
> **Sin migraciones de schema.** Solo refactor de código.

### Objetivos

- Eliminar `self.__class__.__name__` check de `TotalsCalculationMixin`.
- Implementar `DTEStrategy` por tipo (Factura, Boleta, NC, ND, etc.).
- Sacar side-effects de `Contact.save` a `ContactPartnerService.promote_to_partner()`.
- Sacar invalidación de cache de `Account.save` y `JournalEntry.save` a signals o servicios.

### Entregables

- `core/strategies/totals.py` con `TotalsStrategy`, `GrossFirstTotals`, `NetFirstTotals`.
- `billing/strategies/dte.py` con una subclase por `DTEType`.
- `contacts/services.py` con `ContactPartnerService`.
- Tests de regresión: `Contact` sin `is_partner=True` no crea cuentas en save (test contra side-effect).

### Gate de salida

- [ ] Cero ocurrencias de `__class__.__name__` o `isinstance(x, ConcreteModel)` en `core/` y `services/`.
- [ ] `Contact(is_partner=True).save()` ya no crea cuentas — la creación pasa por `ContactPartnerService`.
- [ ] Test de caracterización financiera (suite de comparación de estados financieros) pasa al 100%.

### Tareas asociadas

`T-16` a `T-25` en [20-task-list.md](20-task-list.md).

---

## F4 — DocumentService + Metadata Schema endpoint

> **Patrones:** P-04 (DocumentService), P-06 (Metadata Schema).
> **Hito MVP:** al final de F4, el frontend puede renderizar dinámicamente forms de las entidades simples.

### Objetivos

- Endpoint `/api/registry/<model_label>/schema/` retorna JSON con `fields`, `ui_layout`, `actions`, `transitions`, `permissions`.
- `DocumentRegistry` permite ejecutar `confirm`/`cancel` por `content_type_id` + `id`.
- Endpoint `POST /api/documents/<content_type_id>/<id>/<action>/` invoca el servicio registrado.
- Frontend: componente `<EntityForm modelLabel="..." instanceId={...} />` que renderiza desde el schema.

### Entregables

- `core/services/document.py` con `DocumentService` (ABC) y `DocumentRegistry`.
- `SaleOrderService` y `PurchaseOrderService` como pilotos (refactor desde `services.py` actual).
- `core/api/registry.py` con endpoints `schema/` y `action/`.
- `core/serializers/metadata.py` que introspecciona `_meta.get_fields()`.
- 5 modelos simples (`Budget`, `BudgetItem`, `UoM`, `ProductCategory`, `Attachment`) renderizan en `<EntityForm />` con cero código frontend custom.

### Gate de salida

- [ ] `<EntityForm />` renderiza CRUD completo de los 5 modelos simples sin codigo frontend específico.
- [ ] `SaleOrder.confirm()` y `cancel()` invocados via DocumentRegistry producen los mismos `JournalEntry` que el flujo actual (golden tests).
- [ ] Permisos del schema se respetan: usuario sin `add_*` no recibe el botón "Crear" en el JSON.

### Tareas asociadas

`T-26` a `T-40` en [20-task-list.md](20-task-list.md).

### Riesgos clave

- `R-03`: introspección automática de `_meta` puede exponer campos sensibles (ej: `pos_pin` en `User`). **Mitigación:** `FormMeta.exclude_fields` explícito y test que valida que campos hash/secret nunca aparecen en schema.
- `R-04`: `transitions` dispersas hoy en views — riesgo de inconsistencia. **Mitigación:** declarar transitions en `class FormMeta:` y test que valida que cada `Status` tiene transitions definidas.

---

## F5 — GenericForeignKey selectivo + ProductTypeStrategy

> **Patrones:** P-03 (GFK), P-02 cont. (ProductType).
> **Riesgo alto:** requiere migración de datos en producción.

### Objetivos

- Migrar `JournalEntry` a `source_document` (GFK).
- Migrar `TreasuryMovement` allocations a GFK `allocated_to`.
- Migrar `Invoice.sale_order`/`purchase_order` a `source_order` (GFK).
- Refactor de `Product.mfg_*` a `ProductManufacturingProfile` (1:1 opcional) + `ProductTypeStrategy`.

### Entregables

- Migración de datos por tipo de documento (con `RunPython` + verificación de invariantes).
- `Product.product_type == 'MANUFACTURABLE'` ahora delega `mfg_*` a un perfil 1:1.
- `<EntityForm />` para `Invoice` renderiza correctamente todos los `dte_type`.

### Gate de salida

- [ ] Reportes contables (auxiliar de proveedores, libro de ventas) producen los mismos resultados antes/después.
- [ ] Migración corre en <5 min sobre dataset de producción (medir en staging primero).
- [ ] Plan de rollback documentado y probado en staging.

### Tareas asociadas

`T-41` a `T-55` en [20-task-list.md](20-task-list.md).

### Riesgos clave

- `R-05`: GFK no permite `select_related` — performance puede degradar en listados. **Mitigación:** prefetch_related explícito + benchmarks antes/después.
- `R-06`: ALTER TABLE en `Invoice` (180k filas estimadas) puede bloquear. **Mitigación:** ventana de mantenimiento + migration con `--no-input` nocturna.

---

## Diagrama de dependencias

```
F1 ──┐
     ├──> F2 ──> F3 ──> F4 ──> F5
     │        (paralelo: tests caracterización)
F1 termina antes de F2 (porque F1 no toca modelos y entrega valor)
F3 puede empezar cuando F2 mergea
F4 requiere F3 (Strategy + side-effects limpios) para que Service Layer sea limpia
F5 requiere F4 estable (DocumentService maneja la abstracción durante la migración)
```

---

## Métricas de éxito (cómo sabremos que funcionó)

| Métrica | Línea base actual | Objetivo fin F5 |
|---------|-------------------|-----------------|
| Líneas duplicadas en `Model.save()` | ~600 (estimado por inspección) | <100 |
| Ocurrencias de `__class__.__name__` o `isinstance` para discriminación | 8 conocidas | 0 |
| Apps registradas en UniversalRegistry | 0 | 12 |
| Modelos con CRUD via `<EntityForm />` (sin frontend custom) | 0 | ≥10 |
| Coverage de `core/strategies/` | n/a | >90% |
| Tiempo medio para agregar nueva entidad CRUD simple | ~3 días (hoy) | <1 día |
| Tests de caracterización financiera | 0 | >50 (cubriendo Balance, ER, Mayor, Auxiliar) |

---

## Anti-objetivos explícitos (lo que NO vamos a hacer)

- ❌ No migrar PKs a UUIDs.
- ❌ No reescribir `Account` ni `JournalEntry` — su complejidad es de dominio.
- ❌ No abstraer formularios para `Product (manufacturable)` antes de F5.
- ❌ No introducir microservicios. Esta es una refactorización dentro del monolito.
- ❌ No cambiar el ORM (mantener Django ORM).
- ❌ No introducir GraphQL. REST + JSON Schema es suficiente.
- ❌ No migrar a Pydantic en backend (DRF serializers + Zod en frontend ya cumplen).

Cualquier propuesta que viole estos anti-objetivos requiere ADR explícito.

---

## Comunicación y reviews

- **Cada fase termina con demo** al equipo + PM antes del merge.
- **ADR por cada decisión arquitectónica** que afecte más de una app (ubicar en [docs/10-architecture/adr/](../../10-architecture/adr/)).
- **Code review obligatorio** por al menos un ingeniero que NO trabajó en la fase.
- **Sin merges a `master` los viernes** durante F2/F3/F5 — son fases con riesgo de regresión.
