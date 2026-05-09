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
| **F6** | Hardening operacional y cierre de gates pendientes | 2 sprints (3-4 semanas) | Medio | F5 mergeada |
| **F7** | Detail routes reales para entidades searchable (corrige rutas inexistentes del Universal Search) | 2 sprints (3-4 semanas) | Medio | F6 mergeada |
| **F8** | Reversión de migraciones EntityForm + expansión del schema contract + contrato visual documentado | 3 sprints (5-6 semanas) | Medio-alto | F7 estable |

**Esfuerzo total estimado:** 17-19 sprints (~8-9 meses con 1 ingeniero senior dedicado, o 4-5 meses con 2).

**Hito de "Generic Form Injection mínimo viable":** fin de F4. F5 es enabler para escalar. F6 cierra deuda operacional. **F7 corrige las rutas inexistentes del Universal Search (Opción B documentada en la auditoría 2026-05-08).** **F8 revierte la migración prematura de formularios (Phase 4) y reconstruye sobre un contrato de schema alineado con los contratos de UI existentes.**

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

## F6 — Hardening operacional y cierre de gates pendientes

> **Origen:** auditoría de la rama `refactor/registry&arquitecturemodels` del 2026-05-08 detectó que F1..F5 implementaron los seis patrones (P-01..P-06) pero dejaron sin cumplir **gates operacionales documentados** y **tareas marcadas como TODO** en F2/F3.
> **Sin nueva funcionalidad.** F6 NO agrega features. Solo cierra deuda del plan original.

### Objetivos

- Cerrar la suite de regresión financiera (T-15) que el plan calificó como "no negociable" y que sigue sin existir.
- Eliminar las ocurrencias residuales del antipatrón `__class__.__name__` / `isinstance(SaleOrder|PurchaseOrder|...)` en `core/` y `services/` (gate F3 explícito).
- Migrar `PurchaseReceipt` y `PurchaseReturn` a `TransactionalDocument` para retirar `_legacy_recalculate_totals` del mixin (cierra T-14 WIP).
- Aplicar `R-03` (campos sensibles): `FormMeta.exclude_fields` en `User` y `*Settings`, más test que valide allowlist.
- Cerrar la decisión sobre feature flags: o implementarlos retroactivamente para los endpoints/strategies activos, o publicar ADR explícito que justifique la omisión y el riesgo aceptado.
- Completar el registro `UniversalRegistry` según T-03 (entidades de `core`, `accounting`, `inventory`, `treasury`, `tax` faltantes).
- Escribir los **tests arquitectónicos** prescritos en [50-testing-strategy.md](50-testing-strategy.md#linters-arquitectónicos-custom) para que la regresión de patrones falle CI automáticamente.
- Validar empíricamente los benchmarks de F1 (T-06) y F5 (T-52) con dataset realista; los resultados actuales se documentaron sobre datasets de desarrollo (2 entries) y no son evidencia válida.

### Entregables

- `backend/core/tests/fixtures/financial_baseline.py` + `backend/core/tests/test_financial_baseline.py` con ≥75 snapshots versionados en git.
- `backend/core/tests/test_architectural_invariants.py` con tests `test_no_class_name_discrimination`, `test_no_isinstance_for_polymorphism`, `test_no_secret_fields_exposed`, `test_all_apps_register_at_least_one_entity`.
- Refactor de [billing/services.py:967-1128](../../../backend/billing/services.py#L967) eliminando los 5 `isinstance(invoice.source_order, ...)` (delegar a `DTEStrategy` o método polimórfico del propio `source_order`).
- Migración de `PurchaseReceipt` y `PurchaseReturn` a `TransactionalDocument`; retiro de `_legacy_recalculate_totals` y de la rama `is_sales = self.__class__.__name__ in [...]` en [core/mixins.py:107](../../../backend/core/mixins.py#L107).
- `FormMeta.exclude_fields` en `User`, `CompanySettings`, `AccountingSettings`, `SalesSettings`, `GlobalHRSettings`, `WorkflowSettings`, `ReconciliationSettings`.
- ADR-0017 (uno de): _"Feature flags retroactivos para arch_*"_ ó _"Omisión justificada de feature flags en la refactorización 2026"_.
- `apps.py::ready()` de `core`, `accounting`, `inventory`, `treasury`, `tax` con las entidades faltantes registradas (ver T-03 original).
- Playwright o equivalente con tests E2E para los 4 flujos críticos de [50-testing-strategy.md §Tests E2E](50-testing-strategy.md#tests-e2e-5--solo-flujos-críticos).
- Benchmark de F1 con dataset ≥50k contactos + 100k movimientos; benchmark de F5 con auxiliar de proveedores sobre ≥100k entries. Resultados versionados en `docs/40-quality/benchmarks/`.
- Hardening del endpoint de schema: cache TTL ajustado a 300s (per [30-patterns.md](30-patterns.md#p-06-metadata-schema)) y prueba de invalidación.

### Gate de salida

- [ ] `pytest backend/core/tests/test_financial_baseline.py` produce 0 divergencias contra snapshots.
- [ ] `pytest backend/core/tests/test_architectural_invariants.py` pasa al 100%; en CI obligatorio.
- [ ] `grep -rn "__class__\.__name__" backend/core backend/services backend/*/services.py` retorna 0 ocurrencias en código ejecutable (whitelist solo en tests/migraciones documentadas).
- [ ] `grep -rn "isinstance(.*\(SaleOrder\|PurchaseOrder\|Invoice\|TreasuryMovement\))" backend/core backend/billing backend/sales backend/purchasing` retorna 0 fuera de `serializers.py`/`admin.py`.
- [ ] T-14 cerrada: todos los consumidores de `TotalsCalculationMixin` declaran `totals_strategy`; `_legacy_recalculate_totals` eliminado.
- [ ] `GET /api/registry/core.user/schema/` no expone `pos_pin` ni `password`. Test E2E lo verifica.
- [ ] ADR-0017 mergeado.
- [ ] `len(UniversalRegistry._entities) >= 20` con todas las apps de la matriz T-03 cubiertas.
- [ ] Suite Playwright pasa para los 4 flujos críticos.
- [ ] Reporte de benchmark publicado en `docs/40-quality/benchmarks/2026-XX-baseline.md` con p50/p95 medidos sobre dataset realista.

### Tareas asociadas

`T-56` a `T-67` en [20-task-list.md](20-task-list.md).

### Riesgos clave

- `R-09`: La suite de regresión financiera, al construirse **después** del refactor, fija el comportamiento *post-F5* como baseline en lugar del comportamiento legacy original. **Mitigación:** ejecutar la suite también contra el último commit pre-F2 (`git checkout` + run) y exportar esos snapshots como referencia adicional. Si divergen, abrir issue por cada diferencia y decidir caso por caso (regresión vs. mejora intencional documentada en ADR).
- `R-10`: La eliminación de `_legacy_recalculate_totals` rompe `PurchaseReceipt`/`PurchaseReturn` si la migración a `TransactionalDocument` se hace sin atención al `decimal_places`. **Mitigación:** repetir el playbook de F2 (ADR-0014, migration aditiva, validación pre-merge sobre dataset real).
- `R-11`: La refactorización de `isinstance(source_order, X)` en `billing/services.py` debe preservar la semántica de revertir el documento origen al estado correcto al cancelar la factura. **Mitigación:** golden test de `BillingService.cancel_invoice` para cada combinación (sale_order/purchase_order × DRAFT/POSTED/PAID).

---

## F7 — Detail routes reales para entidades searchable (Universal Search Opción B)

> **Origen:** auditoría del 2026-05-08 detectó que **ninguna** de las 26 rutas declaradas en `apps.py::ready()` coincide con una ruta real del App Router de Next.js. Dos defectos compuestos: (1) los segmentos están en español (`/ventas/ordenes`, `/contactos`, `/tesoreria/cuentas`) y el App Router está en inglés (`/sales/orders`, `/contacts`, `/treasury/accounts`); (2) sólo 4 entidades tienen rutas `[id]` reales (`finances/budgets/[id]`, `hr/payrolls/[id]`, `treasury/reconciliation/[id]`, `accounting/ledger/[id]`); el resto exponen detalle vía modal sobre la lista, sin URL canónica.
> **Decisión:** Opción B — convertir el detalle en URL deep-linkeable creando rutas `[id]` reales para **todas** las entidades registradas. La página `[id]` reutiliza el modal/form existente como contenido de página completa (no se reescribe lógica de form, solo se monta en `EntityDetailPage`).
> **Sin tocar modelos.** Sólo cambios en frontend + un ajuste de `apps.py::ready()` por app.

### Objetivos

- Cero rutas 404 desde resultados del Universal Search.
- Convención única: cada entidad searchable es accesible en `/<module>/<entity-plural>/[id]`.
- Cada `apps.py::ready()` declara `list_url` y `detail_url_pattern` en **inglés** alineados con los segmentos reales del App Router.
- Las páginas `[id]` reutilizan los formularios actuales (`SaleOrderForm`, `ProductForm`, `ContactForm`, etc.) embebidos en una shell `EntityDetailPage` con header, breadcrumb, acciones y `ActivitySidebar` opcional.

### Entregables

- ADR-0018: convención de "Searchable Entity Detail Route" (slugs en inglés, plurales canónicos, `[id]` como segmento).
- Contrato actualizado [docs/20-contracts/module-layout-navigation.md](../../20-contracts/module-layout-navigation.md) con la nueva sección "Searchable Entity Detail Route".
- `frontend/components/shared/EntityDetailPage.tsx` — shell con header, breadcrumb, slot principal, slot sidebar.
- 22 nuevas rutas `[id]/page.tsx` en App Router (ver matriz en [20-task-list.md](20-task-list.md#f7--detail-routes-para-universal-search)).
- 12 `apps.py::ready()` actualizados con `list_url`/`detail_url_pattern` reales.
- Test E2E (Playwright) que itera cada `SearchableEntity` registrada y verifica que `detail_url_pattern.replace('{id}', '<seed_id>')` no devuelve 404 ni 500.
- Test arquitectónico `test_search_routes_exist` que falla CI si una entidad declara un `detail_url_pattern` no resoluble.

### Gate de salida

- [ ] Cada entidad listada en `T-03/T-61` tiene su ruta `[id]` real y carga sin error con un id de fixture.
- [ ] `grep -r "/ventas\|/compras\|/contactos\|/tesoreria\|/rrhh\|/contabilidad\|/inventario\|/produccion\|/facturacion\|/tareas\|/tributario" backend/*/apps.py` retorna 0 ocurrencias.
- [ ] Suite Playwright `e2e/universal-search-routes.spec.ts` verde sobre las 26 entidades.
- [ ] Test arquitectónico `test_search_routes_exist` corre en CI; CI bloquea merge si una nueva entidad registra una ruta inexistente.
- [ ] Demo: buscar "NV-001" en la barra global y aterrizar en `/sales/orders/123` con la ficha completa renderizada.

### Tareas asociadas

`T-68` a `T-79` en [20-task-list.md](20-task-list.md#f7--detail-routes-para-universal-search).

### Riesgos clave

- `R-12`: algunas entidades (POSSession, BankStatement, StockMove) no tienen un formulario de edición tradicional — su "detalle" hoy es read-only. **Mitigación:** la shell `EntityDetailPage` admite modo `readonly` que muestra una vista de detalle sin formulario; documentado en el contrato T-70.
- `R-13`: el patrón de "modal sobre lista con `?selected=id`" coexistirá con `[id]` durante la migración. **Mitigación:** la lista detecta `id` en la URL y, si la ruta `[id]` ya existe, redirige; si no, abre el modal histórico. Removido al final de F7.
- `R-14`: rutas `[id]` con permisos finos (ej: ver factura ajena del mismo cliente) requieren guardas server-side. **Mitigación:** cada page server-component valida permiso vía endpoint existente antes de renderizar; mismo guard que el modal usaba.

---

## F8 — Schema-Driven Forms: reversión + expansión del contract + contrato visual documentado

> **Origen:** auditoría del 2026-05-08 detectó que la migración de formularios de Phase 4 (commit `9387cb91`) sustituyó tres formularios con estructura rica (`BudgetEditor`/`CategoryForm`/`UoMForm` — secciones, grid 4-col, switches con expansión condicional animada, selectores async filtrados, icon picker, `ActivitySidebar`) por `EntityForm` minimal que solo conoce `tabs` lineales y trata FK como input numérico de id. Esto produjo (1) bifurcación crear/editar (la creación usa el form genérico, la edición sigue usando el form rico original — usuarios encuentran dos UIs distintas para la misma entidad) y (2) regresión de UX en los flujos migrados sin haber siquiera entregado el "5 modelos simples sin código frontend" prometido.
> **Decisión:** Opción B+A — **revertir** las tres migraciones de Phase 4 y, en paralelo, **expandir** el contrato del schema (`FormMeta` backend + `EntityForm` frontend) hasta que pueda expresar el vocabulario visual real del proyecto, anclado a los contratos de UI ya existentes ([form-layout-architecture.md](../../20-contracts/form-layout-architecture.md), [component-form-patterns.md](../../20-contracts/component-form-patterns.md), [component-selectors.md](../../20-contracts/component-selectors.md), [component-visual-hierarchy.md](../../20-contracts/component-visual-hierarchy.md)). Sólo entonces re-migrar.
> **Sin tocar modelos de negocio.** Cambios concentrados en `core/serializers/metadata.py`, `frontend/components/shared/EntityForm/`, y los `FormMeta` de los modelos piloto.

### Objetivos

- Revertir los tres flujos de creación migrados en Phase 4 a su forma rica original (estado pre-`9387cb91`), conservando `BudgetEditor`/`CategoryForm`/`UoMForm` como fuente única para crear+editar.
- Publicar un nuevo contrato `docs/20-contracts/schema-driven-forms.md` que defina el vocabulario del schema (`sections`, `grid_cols`, `widget`, `widget_props`, `visible_if`, `sidebar`, `actions`) y su mapeo determinístico a los componentes ya contractuados (`FormSection`, `FormSplitLayout`, `LabeledInput`, selectores async, etc.). El contrato es **derivado**: no inventa primitives nuevos, sólo declara cómo el JSON los invoca.
- Implementar `EntityForm v2` que consume el contrato extendido y delega a un `Widget Registry` frontend (`AccountSelector`, `ProductSelector`, `CategorySelector`, `UoMSelector`, `ContactSelector`, `IconPicker`, `LabeledSwitch`, FK genérico async).
- Re-migrar las tres entidades con paridad visual probada (snapshot/Storybook) **antes** de declarar la migración cerrada; sólo entonces deprecar los forms legacy.
- Migrar también los pilotos verdaderamente simples del plan original (`UoMCategory`, `ProductAttribute`, `ProductAttributeValue`, `Attachment`) que sí cumplen con el alcance "schema-driven sin código custom".

### Entregables

- ADR-0019: reversión de Phase 4 + estrategia de expansión del schema. Justifica por qué la migración previa fue prematura (gap de contrato), define qué clase de formulario es candidato a schema-driven y cuál NO ([audit-report §2.1 — bloqueantes](00-audit-report.md#21--bloqueantes--formulario-especializado-siempre)).
- **Reversión** de [BudgetsListView.tsx](../../../frontend/features/finance/components/BudgetsListView.tsx), [CategoryList.tsx](../../../frontend/features/inventory/components/CategoryList.tsx), [UoMList.tsx](../../../frontend/features/inventory/components/UoMList.tsx) al patrón pre-Phase 4 (mismo form para crear y editar). Tres reverts limpios via `git revert -p` + ajuste de imports.
- **Nuevo contrato** [docs/20-contracts/schema-driven-forms.md](../../20-contracts/schema-driven-forms.md) declarando: vocabulario del JSON, tabla `widget → componente`, reglas de coherencia con los contratos UI existentes, ejemplos canónicos para los 3 niveles de complejidad (Micro / Estándar / Ficha Maestra), criterios de "este formulario NO califica para schema-driven".
- Backend: ampliación de `FormMeta` y `build_schema()` ([backend/core/serializers/metadata.py](../../../backend/core/serializers/metadata.py)) con `sections`, `grid_cols`, `field_widget`, `widget_props`, `visible_if`, `sidebar` (entityType para `ActivitySidebar`).
- Frontend: `EntityForm v2` ([frontend/components/shared/EntityForm/](../../../frontend/components/shared/EntityForm/)) — section grouping, grid 4-col, widget registry, `visible_if` con `animate-in fade-in`, integración condicional con `FormSplitLayout` + `ActivitySidebar`.
- Re-migración de Budget/ProductCategory/UoM con paridad visual probada (Storybook story por entidad + screenshot diff vs. el form legacy en commit pre-`9387cb91`).
- Migración nueva de UoMCategory, ProductAttribute, ProductAttributeValue, Attachment (entidades verdaderamente simples — pilotos correctos del plan original).
- Test arquitectónico `test_schema_widgets_resolve` que verifica que cada `widget` declarado en algún `FormMeta` existe en el frontend Widget Registry.
- Suite de visual regression (Storybook + Chromatic o Playwright screenshot) para los formularios re-migrados.

### Gate de salida

- [ ] `git diff master -- frontend/features/{finance,inventory}` no contiene `EntityForm` para Budget/ProductCategory/UoM en estado parcialmente migrado (o todo migrado, o nada — sin bifurcación crear/editar).
- [ ] [docs/20-contracts/schema-driven-forms.md](../../20-contracts/schema-driven-forms.md) mergeado y referenciado desde [docs/20-contracts/component-decision-tree.md](../../20-contracts/component-decision-tree.md) y desde [docs/30-playbooks/add-feature.md](../../30-playbooks/add-feature.md).
- [ ] Snapshot visual del `BudgetEditor` re-migrado coincide con el snapshot del commit pre-Phase 4 (tolerancia <2% diff píxel).
- [ ] `test_schema_widgets_resolve` corre en CI; falla si un `FormMeta` declara un `widget` no registrado.
- [ ] 7 modelos en producción usan `EntityForm v2` con cero código frontend custom y zero regresión visual: Budget, ProductCategory, UoM, UoMCategory, ProductAttribute, ProductAttributeValue, Attachment.
- [ ] Forms legacy (`BudgetEditor`, `CategoryForm`, `UoMForm`) deprecados (warning en CI) o eliminados según ADR-0019.
- [ ] Demo: agregar un campo nuevo a `Budget` (ej: `cost_center`) sólo requiere editar el modelo Django + migración; el form lo renderiza automáticamente con la sección y widget correctos.

### Tareas asociadas

`T-80` a `T-93` en [20-task-list.md](20-task-list.md#f8--schema-driven-forms-reversión--expansión--contrato-visual).

### Riesgos clave

- `R-15`: el contrato `schema-driven-forms.md` puede divergir de `form-layout-architecture.md` y producir dos fuentes de verdad sobre layouts. **Mitigación:** el contrato nuevo es **derivado** — declara cómo el JSON invoca primitives, no redefine primitives. Se incluye en `precondition` frontmatter de `schema-driven-forms.md` la dependencia explícita a los 4 contratos UI base; cualquier cambio incompatible requiere ADR.
- `R-16`: la paridad visual de la re-migración puede ser difícil de garantizar (animaciones, focus management, comportamiento del icon picker). **Mitigación:** aceptar que entidades con widgets verdaderamente custom (`Contact` con sus 50+ properties, `Account` con jerarquía) **nunca** califiquen para schema-driven y permanecen con form especializado. Documentar la frontera en el contrato T-84.
- `R-17`: la reversión puede chocar con cambios posteriores a `9387cb91` sobre los mismos archivos. **Mitigación:** revisar `git log frontend/features/{finance,inventory}` antes de iniciar T-81..T-83 y resolver conflictos manualmente; no hacer revert ciego.
- `R-18`: introducir `sections` y `visible_if` en `FormMeta` puede tentar a equipos a usar schema-driven en formularios complejos donde no aplica. **Mitigación:** el contrato T-84 incluye un "decision tree" explícito (cuándo SÍ, cuándo NO) y un test arquitectónico que falla si un modelo de la lista negra (`Account`, `JournalEntry`, `Contact`, `Product` manufacturable, `WorkOrder`) declara `FormMeta.ui_layout` con uso del schema-driven path.

---

## Diagrama de dependencias

```
F1 ──┐
     ├──> F2 ──> F3 ──> F4 ──> F5 ──> F6 ──> F7 ──> F8
     │        (paralelo: tests caracterización)
F1 termina antes de F2 (porque F1 no toca modelos y entrega valor)
F3 puede empezar cuando F2 mergea
F4 requiere F3 (Strategy + side-effects limpios) para que Service Layer sea limpia
F5 requiere F4 estable (DocumentService maneja la abstracción durante la migración)
F6 cierra los gates de F1..F5 que quedaron pendientes; sin features nuevas
F7 corrige las rutas inexistentes del Universal Search creando [id] reales
F8 revierte la migración prematura de Phase 4 y reconstruye sobre un contrato visual documentado
```

---

## Métricas de éxito (cómo sabremos que funcionó)

| Métrica | Línea base actual | Objetivo fin F5 | Objetivo fin F6 | Objetivo fin F7 | Objetivo fin F8 |
|---------|-------------------|-----------------|-----------------|-----------------|-----------------|
| Líneas duplicadas en `Model.save()` | ~600 (estimado por inspección) | <100 | <100 | <100 | <100 |
| Ocurrencias de `__class__.__name__` o `isinstance` para discriminación | 8 conocidas | 0 (gate F3) | **0 verificado por test arquitectónico en CI** | 0 | 0 |
| Apps registradas en UniversalRegistry | 0 | 12 | 12 (todas las entidades T-03 cubiertas) | 12 | 12 |
| Modelos con CRUD via `<EntityForm />` (sin frontend custom) | 0 | ≥10 | ≥10 | ≥10 | **≥7 con paridad visual probada (post-revert)** |
| Coverage de `core/strategies/` | n/a | >90% | >90% | >90% | >90% |
| Tiempo medio para agregar nueva entidad CRUD simple | ~3 días (hoy) | <1 día | <1 día | <1 día | <1 día |
| Tests de caracterización financiera | 0 | >50 | **≥75 snapshots versionados, CI obligatorio** | ≥75 | ≥75 |
| Tests E2E de flujos críticos | 0 | n/a | **4 flujos cubiertos (Venta, POS, Compra, Cierre)** | **+1 (Universal Search routes)** | +1 |
| Schema endpoint expone campos sensibles (`pos_pin`, etc.) | n/a | sin validar | **0 — validado por test** | 0 | 0 |
| Rutas registradas en UniversalRegistry que devuelven 404 | n/a | n/a | 26 (todas) | **0 — validado por Playwright** | 0 |
| Bifurcación crear/editar (entidades con dos UIs distintas) | 0 | 0 | 3 (Budget, Category, UoM) | 3 | **0 — eliminado por reversión + re-migración** |
| Contratos UI publicados en `docs/20-contracts/` | 18 | 18 | 18 | **19 (+module-layout extension)** | **20 (+schema-driven-forms.md)** |

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
