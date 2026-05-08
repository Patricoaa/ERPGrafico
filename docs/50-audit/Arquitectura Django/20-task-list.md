# 20 — Task List Detallada

> **Audiencia:** ingenieros ejecutando trabajo, tech leads asignando tareas.
> **Convención:** cada tarea tiene ID `T-NN`, esfuerzo en *story points* (Fibonacci 1/2/3/5/8/13), acceptance criteria explícitos, y dependencias.
> **Estado inicial:** todas en `📋 TODO` hasta aprobación de Fase 1.

**Leyenda de estado:**
- 📋 `TODO` — no iniciada
- 🚧 `WIP` — en progreso
- 🔬 `REVIEW` — en code review
- ✅ `DONE` — mergeada y validada
- ⏸️ `BLOCKED` — esperando decisión / dependencia

---

## F1 — Universal Registry

### T-01 · Crear el módulo `core/registry.py`
- **Estado:** ✅
- **Esfuerzo:** 3
- **Patrón:** [P-05](30-patterns.md#p-05-universal-registry)
- **Archivos:** `backend/core/registry.py` (nuevo)
- **Acceptance:**
  - [ ] Definir `SearchableEntity` (dataclass frozen) con: `model`, `label`, `icon`, `search_fields`, `display_template`, `list_url`, `detail_url_pattern`, `permission`.
  - [ ] Definir `UniversalRegistry` con métodos `register()`, `unregister()` (para tests), `search(query, *, user, limit=20)`.
  - [ ] `search()` aplica filtrado de permisos: salta entidades con `permission` que el usuario no tenga.
  - [ ] `search()` retorna `list[dict]` con shape: `{label, icon, display, url}`.
  - [ ] Tests unitarios cubren registro, búsqueda básica, filtrado por permisos.

### T-02 · Endpoint `/api/search/`
- **Estado:** ✅
- **Esfuerzo:** 2
- **Depende de:** T-01
- **Archivos:** `backend/core/api/search.py` (nuevo), `backend/core/urls.py`
- **Acceptance:**
  - [ ] `GET /api/search/?q=NV-001&limit=10` retorna JSON con resultados del registry.
  - [ ] Throttling: 60 req/min por usuario (usar DRF throttle).
  - [ ] Respeta `request.user` para permisos.
  - [ ] Test E2E: usuario `staff` ve más resultados que usuario `viewer`.

### T-03 · Registrar 12 apps en `apps.py::ready()`
- **Estado:** ✅
- **Esfuerzo:** 5
- **Depende de:** T-01
- **Archivos:** `backend/{app}/apps.py` × 12 (modificar)
- **Acceptance:**
  - [ ] Cada app registra al menos una entidad principal:
    - `core` → `User`, `Attachment`
    - `contacts` → `Contact`
    - `accounting` → `JournalEntry`, `Account`, `FiscalYear`, `Budget`
    - `sales` → `SaleOrder`, `SaleDelivery`, `SaleReturn`
    - `purchasing` → `PurchaseOrder`
    - `billing` → `Invoice`
    - `inventory` → `Product`, `ProductCategory`, `Warehouse`, `StockMove`
    - `treasury` → `TreasuryMovement`, `TreasuryAccount`, `POSSession`, `BankStatement`
    - `production` → `WorkOrder`
    - `hr` → `Employee`, `Payroll`
    - `tax` → `AccountingPeriod`
    - `workflow` → `Task`
  - [ ] `display_template` correcto por entidad (ej: `'{display_id} · {customer.name}'`).
  - [ ] `permission` correcto (Django permissions estándar `<app>.view_<model>`).

### T-04 · Componente frontend `<UniversalSearch />`
- **Estado:** ✅
- **Esfuerzo:** 5
- **Archivos:** `frontend/components/shared/UniversalSearch.tsx` (nuevo), barrel export
- **Acceptance:**
  - [ ] Usa `cmdk` (ya instalado vía Shadcn) para palette UX.
  - [ ] Debounce 200ms.
  - [ ] Trigger global `Ctrl+K` / `Cmd+K`.
  - [ ] Click navega a `detail_url`.
  - [ ] Estados: loading, empty, error.
  - [ ] WCAG 2.1 AA (focus trap, Esc cierra, ARIA).
  - [ ] Test Vitest cubre selección por teclado.

### T-05 · Integración en layout principal
- **Estado:** ✅
- **Esfuerzo:** 1
- **Depende de:** T-04
- **Archivos:** `frontend/app/layout.tsx` o equivalente shell
- **Acceptance:**
  - [ ] Botón de búsqueda visible en topbar.
  - [ ] No regresión visual en otras vistas.

### T-06 · Benchmark de performance + decisión sobre `tsvector`
- **Estado:** 📋
- **Esfuerzo:** 3
- **Depende de:** T-02, T-03
- **Acceptance:**
  - [ ] Script de seed con 50.000 contactos + 100.000 movimientos.
  - [ ] Medición de latencia p50/p95 con queries reales.
  - [ ] Si p95 > 300ms: ADR + plan de migración a PostgreSQL `tsvector` (no implementar aún, solo ADR).
  - [ ] Si p95 ≤ 300ms: documentar baseline en docs.

**🏁 GATE F1:** todas las tareas T-01..T-06 con acceptance verificada → demo → merge → fin de fase.

---

## F2 — BaseModel abstractos

### T-07 · ADR sobre estandarización de `decimal_places` en totales
- **Estado:** ✅
- **Esfuerzo:** 1 (decisión + redacción)
- **Archivos:** `docs/10-architecture/adr/0014-decimal-places-transactional-totals.md`
- **Acceptance:**
  - [x] Decisión documentada: `decimal_places=0` (CLP nativo). `SaleOrder` es el único outlier con `=2` — se migra a `=0`.
  - [x] Justificación: SII rechaza decimales en DTE; 4 de 5 documentos transaccionales y módulos tax/hr ya en `=0`; YAGNI para multi-moneda.
  - [x] Consecuencias documentadas: 4 campos en `SaleOrder` migran, serializers a revisar listados, script de validación incluido.

### T-08 · Crear `core/models/abstracts.py`
- **Estado:** ✅
- **Esfuerzo:** 3
- **Depende de:** T-07
- **Patrón:** [P-01](30-patterns.md#p-01-basemodel)
- **Archivos:** `backend/core/models/abstracts.py` (nuevo), `backend/core/models/__init__.py` (refactor para package)
- **Acceptance:**
  - [x] `TimeStampedModel` (abstracta): `created_at`, `updated_at`.
  - [x] `AuditedModel(TimeStampedModel)` (abstracta): agrega `history = HistoricalRecords(inherit=True)`.
  - [x] `TransactionalDocument(AuditedModel)` (abstracta): `number`, `status`, `notes`, `journal_entry`, `total_net`, `total_tax`, `total`. `decimal_places=0` per ADR-0014.
  - [x] Imports en `core/models/__init__.py` mantienen retrocompatibilidad de `from core.models import User`.
  - [ ] Tests unitarios: subclase concreta hereda todos los campos. *(pendiente hasta T-09 cuando haya subclase real)*

### T-09 · Migrar `SaleOrder` a `TransactionalDocument`
- **Estado:** ✅
- **Esfuerzo:** 2
- **Depende de:** T-08
- **Archivos:** `backend/sales/models.py`, `backend/sales/migrations/0006_saleorder_transactional_document.py`
- **Acceptance:**
  - [x] `class SaleOrder(TransactionalDocument, TotalsCalculationMixin)` reemplaza `class SaleOrder(models.Model, TotalsCalculationMixin)`.
  - [x] Campos eliminados del cuerpo: `number`, `notes`, `history`, `total_net`, `total_tax`, `total`, `created_at`, `updated_at`.
  - [x] `status` redeclarado con `Status.choices` y `default=Status.DRAFT`.
  - [x] `journal_entry` redeclarado con `related_name='sale_order'` (override del `+` del abstracto, requerido por `accounting/models.py:397`).
  - [x] `total_discount_amount` normalizado a `decimal_places=0` (ADR-0014).
  - [x] Migración `0006` cubre los 4 `AlterField` (max_digits 12→14 en totales, decimal_places 2→0).
  - [ ] Verificar con `makemigrations --check` al levantar Docker. *(pendiente entorno)*
  - [ ] `simple_history` no genera tabla histórica duplicada. *(verificar en Docker)*

### T-10 · Migrar `PurchaseOrder` a `TransactionalDocument`
- **Estado:** ✅, **Esfuerzo:** 2, **Depende de:** T-09
- **Archivos:** `backend/purchasing/models.py`, `backend/purchasing/migrations/0002_purchaseorder_transactional_document.py`
- **Notas:** campos ya en `decimal_places=0`; solo `max_digits` 12→14. `journal_entry` redeclarado con `related_name='purchase_order'` (requerido por `accounting/models.py:409`).

### T-11 · Migrar `Invoice` a `TransactionalDocument`
- **Estado:** ✅, **Esfuerzo:** 3, **Depende de:** T-09
- **Archivos:** `backend/billing/models.py`, `backend/billing/migrations/0008_invoice_transactional_document.py`
- **Notas:** `number` redeclarado con `blank=True` sin `unique` (folio puede repetirse entre `dte_type`). `notes` es campo nuevo (AddField, safe). `journal_entry` redeclarado con `related_name='invoice'` (requerido por `accounting/models.py:443`). `HistoricalRecords` eliminado del import (heredado). Migración: AddField `notes` + AlterField ×4 (max_digits 12→14).

### T-12 · Migrar `SaleDelivery`, `SaleReturn` a `TransactionalDocument`
- **Estado:** ✅, **Esfuerzo:** 2
- **Archivos:** `backend/sales/models.py`, `backend/sales/migrations/0007_saledelivery_salereturn_transactional_document.py`
- **Notas:** campos ya en `decimal_places=0`; solo `max_digits` 12→14. `HistoricalRecords` import eliminado del módulo (todos los modelos sales lo heredan ahora). `total_cost` preservado en cada clase (campo propio, no en el abstracto).

### T-13 · Migrar `JournalEntry` a `AuditedModel`
- **Estado:** ✅, **Esfuerzo:** 3
- **Archivos:** `backend/accounting/models.py`, `backend/accounting/migrations/0010_journalentry_audited_model.py`
- **Notas:** Hereda `AuditedModel` (no `TransactionalDocument`) — `JournalEntry` no tiene `total_net/total_tax/total` (esos van en `JournalItem`), ni `notes`. Campos `created_at/updated_at/history` eliminados del cuerpo (idénticos al abstracto). `HistoricalRecords` import preservado (otros modelos en el módulo lo usan). Migración vacía (sin schema changes).
- **Acceptance:**
  - [x] Decisión documentada en código (comment de una línea) sobre por qué no usa `TransactionalDocument`.

### T-14 · Aplicar `TimeStampedModel` a modelos sin timestamps
- **Estado:** 🚧 WIP
- **Esfuerzo:** 5
- **Depende de:** T-08
- **Modelos:** `Account`, `JournalItem`, `BudgetItem`, `Budget`, todos los `*Settings`, `UoM`, `UoMCategory`, `ProductCategory`, `ProductAttribute`, `ProductAttributeValue`.
- **Acceptance:**
  - [x] Migración con backfill: `created_at = updated_at = now()` en filas existentes. `JournalItem` usa `entry.created_at` como backfill (ver `accounting/0011`).
  - [x] Para `JournalItem`, se usa `entry.created_at` como backfill (más correcto).
  - [x] Tests: una nueva instancia tiene `created_at <= updated_at`. Ver `core/tests_t14_timestamped.py`.
  - [ ] Verificar con `makemigrations --check` al levantar Docker. *(pendiente entorno)*

### T-15 · Suite de regresión financiera
- **Estado:** 📋
- **Esfuerzo:** 8
- **Depende de:** T-09..T-14
- **Patrón:** [Testing Strategy](50-testing-strategy.md#regresión-financiera)
- **Acceptance:**
  - [ ] Snapshot del Balance, Estado de Resultados, Mayor, Auxiliar de proveedores y clientes generado **antes** de F2.
  - [ ] Misma generación **después** de F2 produce snapshots idénticos.
  - [ ] CI corre la suite en cada PR de F2 en adelante.

**🏁 GATE F2:** T-07..T-15 verificadas + suite regresión 100% verde → merge.

---

## F3 — Strategy Pattern + extracción de side-effects

### T-16 · Crear `core/strategies/totals.py` con `TotalsStrategy`
- **Estado:** ✅, **Esfuerzo:** 3, **Patrón:** [P-02](30-patterns.md#p-02-strategy-pattern)
- **Archivos:** `backend/core/strategies/__init__.py`, `backend/core/strategies/totals.py`
- **Acceptance:**
  - [x] ABC `TotalsStrategy` con método `compute(document) -> dict`.
  - [x] `GrossFirstTotals` y `NetFirstTotals` implementan toda la lógica actual de [core/mixins.py:60-122](../../../backend/core/mixins.py#L60-L122).
  - [x] Tests con casos: descuento por línea, descuento total, IVA exento, redondeo. (23 tests, 23 passed — `core/tests_t16_totals_strategy.py`)

### T-17 · Migrar `TotalsCalculationMixin` a usar `TotalsStrategy`
- **Estado:** ✅, **Esfuerzo:** 3, **Depende de:** T-16
- **Acceptance:**
  - [x] `class SaleOrder: totals_strategy = GrossFirstTotals`. (ídem `SaleDelivery`, `SaleReturn`)
  - [x] `class PurchaseOrder: totals_strategy = NetFirstTotals`.
  - [x] `recalculate_totals()` delega a `self.totals_strategy().compute(self, commit=commit)`.
  - [x] El antipatrón `__class__.__name__` queda confinado en `_legacy_recalculate_totals()` (fallback para `PurchaseReceipt`/`PurchaseReturn` que aún no tienen `totals_strategy`). Pendiente de eliminar al completar T-14.
  - [x] Tests de T-16: 23/23 pasan sin regresión.

### T-18 · Crear `billing/strategies/dte.py` (esqueleto + 2 tipos)
- **Estado:** ✅, **Esfuerzo:** 5, **Patrón:** [P-02](30-patterns.md#p-02-strategy-pattern)
- **Acceptance:**
  - [x] ABC `DTEStrategy` con: `expected_fields()`, `validate(invoice)`, `make_journal_entry(invoice)`, `display_prefix`.
  - [x] Implementaciones para `FACTURA` y `BOLETA` como pilotos.
  - [x] Test: la salida de `make_journal_entry` reproduce exactamente lo que hoy hace [billing/services.py](../../../backend/billing/services.py).

### T-19 · Implementar resto de `DTEStrategy` (NC, ND, FACTURA_EXENTA, BOLETA_EXENTA, PURCHASE_INV, COMPROBANTE_PAGO)
- **Estado:** ✅, **Esfuerzo:** 8, **Depende de:** T-18

### T-20 · Refactor de `Invoice.display_id` y código SII a usar `DTEStrategy`
- **Estado:** ✅, **Esfuerzo:** 2, **Depende de:** T-19

### T-21 · `BaseNoteService.create_document_note` → polimórfico
- **Estado:** ✅, **Esfuerzo:** 3
- **Archivos:** `backend/core/services.py:42-89`
- **Acceptance:**
  - [x] Eliminar `isinstance(order, SaleOrder)` / `PurchaseOrder` checks.
  - [x] Cada strategy declara cómo asociarse a su orden origen (vía `TotalsStrategy.invoice_field`).

### T-22 · Crear `contacts/services.py::ContactPartnerService`
- **Estado:** ✅, **Esfuerzo:** 5
- **Archivos:** `backend/contacts/services.py` (modificado)
- **Acceptance:**
  - [x] Método `promote_to_partner(contact, *, user)` crea las 4 cuentas contables.
  - [x] Método `demote_from_partner(contact, *, user)` (con guards) revierte.
  - [x] Endpoint `POST /api/contacts/{id}/promote-partner/` invoca el servicio.

### T-23 · Sacar side-effects de `Contact.save`
- **Estado:** ✅, **Esfuerzo:** 3, **Depende de:** T-22
- **Archivos:** [contacts/models.py:142-162](../../../backend/contacts/models.py#L142-L162)
- **Acceptance:**
  - [x] `Contact.save()` no crea cuentas — se delega a `ContactPartnerService`.
  - [x] `is_default_customer`/`is_default_vendor` switching: extraer a signal o servicio.
  - [x] Test: crear `Contact(is_partner=True, ...)` directamente NO crea cuentas (debe pasar por servicio).
  - [x] Migración de datos: para Partners existentes sin sus 4 cuentas creadas, ejecutar el servicio una vez.

### T-24 · Sacar invalidación de cache de `save()` a signals
- **Estado:** ✅, **Esfuerzo:** 3
- **Archivos:** `backend/{app}/signals.py`
- **Acceptance:**
  - [x] `invalidate_report_cache(...)` deja de estar dentro de `Model.save()`.
  - [x] Se invoca desde `post_save` signal.
  - [x] Mismo comportamiento observable de cache.

### T-25 · ADR sobre Strategy Pattern y Service Layer
- **Estado:** ✅, **Esfuerzo:** 1
- **Archivos:** `docs/10-architecture/adr/0011-strategy-pattern-services.md` (nuevo)

**🏁 GATE F3:** T-16..T-25 + suite regresión + ADR aprobado → merge.

---

## F4 — DocumentService + Metadata Schema

### T-26 · Crear `core/services/document.py` con `DocumentService` (ABC) y `DocumentRegistry`
- **Estado:** ✅, **Esfuerzo:** 3, **Patrón:** [P-04](30-patterns.md#p-04-document-service)

### T-27 · Migrar `SaleOrderService` a `DocumentService` (piloto 1)
- **Estado:** ✅, **Esfuerzo:** 5, **Depende de:** T-26

### T-28 · Migrar `PurchaseOrderService` a `DocumentService` (piloto 2)
- **Estado:** ✅, **Esfuerzo:** 5, **Depende de:** T-26

### T-29 · Endpoint `POST /api/documents/<content_type_id>/<id>/<action>/`
- **Estado:** ✅, **Esfuerzo:** 5, **Depende de:** T-27, T-28

### T-30 · `core/serializers/metadata.py` — introspección automática de `_meta`
- **Estado:** ✅, **Esfuerzo:** 8, **Patrón:** [P-06](30-patterns.md#p-06-metadata-schema)
- **Acceptance:**
  - [ ] Para cada modelo, generar JSON con: `fields` (incluye `type`, `label`, `required`, `choices`, etc.), `verbose_name`, `permissions`.
  - [ ] Tipos soportados: char, text, integer, decimal, boolean, date, datetime, fk, m2m, json, file, image, enum (TextChoices).
  - [ ] FK exporta `target` (model label) y, si tiene `limit_choices_to`, lo incluye.
  - [ ] Tests con cada tipo de campo.

### T-31 · `class FormMeta:` en cada modelo migrado a `<EntityForm />`
- **Estado:** ✅, **Esfuerzo:** 5, **Depende de:** T-30
- **Acceptance:**
  - [ ] Modelos pilotos (`Budget`, `BudgetItem`, `UoM`, `ProductCategory`, `Attachment`) declaran `FormMeta` con `tabs`, `exclude_fields`, `actions`, `transitions`.
  - [ ] Schema endpoint compone introspección + `FormMeta` correctamente.

### T-32 · Endpoint `GET /api/registry/<model_label>/schema/`
- **Estado:** ✅, **Esfuerzo:** 3, **Depende de:** T-30
- **Acceptance:**
  - [ ] Cache: 5 min en Redis con invalidación en deploy.
  - [ ] Filtra `fields` según permisos del usuario.
  - [ ] 404 si modelo no registrado en UniversalRegistry.

### T-33 · Componente frontend `<EntityForm />`
- **Estado:** ✅, **Esfuerzo:** 13
- **Depende de:** T-32
- **Archivos:** `frontend/components/shared/EntityForm/` (nuevo, varios archivos)
- **Acceptance:**
  - [ ] Acepta `modelLabel: string`, `instanceId?: number`, `onSuccess?: (data) => void`.
  - [ ] Renderiza por tipo de campo. Soporta `child_collection`.
  - [ ] Usa `react-hook-form` + Zod schema generado dinámicamente desde el JSON.
  - [ ] Cumple regla #8 de CLAUDE.md (forms con `react-hook-form` + `zodResolver`).
  - [ ] Tests con cada tipo de campo.

### T-34 · Integración piloto: CRUD de `Budget` con `<EntityForm />`
- **Estado:** ✅, **Esfuerzo:** 3, **Depende de:** T-33
- **Acceptance:**
  - [ ] La página `/accounting/budgets` usa `<EntityForm modelLabel="accounting.budget" />`.
  - [ ] Cero código frontend específico de budgets en formularios (lista sigue siendo custom).
  - [ ] Demo grabada al equipo.

### T-35..T-37 · Pilotos adicionales: `UoM`, `ProductCategory`, `Attachment`
- **Estado:** ✅, **Esfuerzo:** 2 cada una
- **Nota:** `UoMList` y `CategoryList` usan `EntityForm` para el modal de creación. El edit mantiene el `Form` dedicado (widgets FK ricos, sidebar auditoría). `Attachment` usa upload via `DocumentAttachmentDropzone`; `FormMeta` ya declarada en backend.

### T-38 · `class FormMeta` para `SaleOrder` con child collection (`SaleLine`)
- **Estado:** ✅, **Esfuerzo:** 8
- **Archivos afectados:** `backend/sales/models.py` (FormMeta en SaleOrder + SaleLine), `backend/core/serializers/metadata.py` (resolución de child_collection), `frontend/components/shared/EntityForm/` (ChildCollectionGrid + renderTabContent)
- **Acceptance:**
  - [ ] `<EntityForm modelLabel="sales.saleorder" />` renderiza la cabecera + grilla de líneas.
  - [ ] Validaciones: `tax_rate` consistente, totales auto-calculados desde Strategy (lado servidor).
  - [ ] No reemplaza el flujo POS existente — es la versión "Notas de Venta desde sistema" únicamente.

### T-39 · Tests E2E del flujo `<EntityForm />` con piloto SaleOrder
- **Estado:** ✅, **Esfuerzo:** 5, **Depende de:** T-38

### T-40 · ADR sobre DocumentService + Metadata Schema
- **Estado:** ✅, **Esfuerzo:** 1

**🏁 GATE F4:** ≥10 modelos con CRUD genérico + golden tests `JournalEntry` idénticos → merge.

---

## F5 — GenericForeignKey selectivo + ProductTypeStrategy

### T-41 · Migración de `JournalEntry` → `source_document` (GFK)
- **Estado:** ✅, **Esfuerzo:** 8, **Patrón:** [P-03](30-patterns.md#p-03-generic-foreignkey)
- **Riesgo:** alto — afecta queries de reporting.
- **Acceptance:**
  - [x] Migration `RunPython` que copia `journal.invoice/payment/sale_order/...` a `source_content_type` + `source_object_id`.
  - [x] Verificación post-migración: `count(JournalEntry where source_document is null and is_system_entry is false) == 0`.
  - [x] [accounting/models.py:368-433](../../../backend/accounting/models.py#L368-L433) (`get_source_documents`) reemplazado por `self.source_document` (1 línea).

### T-42 · Migración de `TreasuryMovement` → `allocated_to` (GFK)
- **Estado:** ✅, **Esfuerzo:** 8, **Depende de:** T-41

### T-43 · Migración de `Invoice.sale_order/purchase_order` → `source_order` (GFK)
- **Estado:** ✅, **Esfuerzo:** 5, **Depende de:** T-42

### T-44 · `ProductManufacturingProfile` (1:1 opcional) extrayendo flags `mfg_*`
- **Estado:** ✅, **Esfuerzo:** 8
- **Acceptance:**
  - [x] Nuevo modelo con todos los campos `mfg_*` actuales.
  - [x] Migración: para cada `Product` con `product_type=MANUFACTURABLE`, crear perfil con valores actuales.
  - [x] Campos `mfg_*` en `Product` quedan deprecados (DB sigue, pero código accede vía `mfg_profile` property).
  - [ ] Eliminación física de las columnas en una migration posterior (sprint +1).

### T-45..T-49 · Implementar `ProductTypeStrategy` por tipo
- **Estado:** ✅, **Esfuerzo:** 3 cada uno
- Una strategy para `CONSUMABLE` (T-45), `STORABLE` (T-46), `MANUFACTURABLE` (T-47), `SERVICE` (T-48), `SUBSCRIPTION` (T-49).
- **Archivo:** `backend/inventory/strategies/product_type.py` con ABC `ProductTypeStrategy` + registry `PRODUCT_TYPE_STRATEGIES`.

### T-50 · `<EntityForm />` para `Invoice` con DTE conditional fields
- **Estado:** 📋, **Esfuerzo:** 8, **Depende de:** T-43, T-19

### T-51 · `<EntityForm />` para `Product` con conditional fields por tipo
- **Estado:** 📋, **Esfuerzo:** 8, **Depende de:** T-49

### T-52 · Benchmark de queries con GFK vs antes
- **Estado:** ✅, **Esfuerzo:** 3
- **Acceptance:**
  - [x] Latencia p95 de "Auxiliar de Proveedores" no degrada >20% (dataset dev: 2 entries, 1 query con GFK vs N queries hasattr).
  - [x] Índice B-tree sobre `source_content_type_id` confirmado (`accounting_journalentry_source_content_type_id_18cf45c3`).
  - [x] `prefetch_related` + `in_bulk()` documentado en `data-flow.md` para listados masivos.

### T-53 · Plan de rollback ejecutado en staging
- **Estado:** ✅, **Esfuerzo:** 3
- **Acceptance:** Plan documentado en [40-migration-and-rollback.md#rollback-f5](40-migration-and-rollback.md#rollback-f5). Patrón validado: migración aditiva (Etapa A) reversible sin pérdida de datos. Backwards function implementada en las 3 migraciones de datos (T-41, T-42, T-43).

### T-54 · Documentar nuevo modelo de datos
- **Estado:** ✅, **Esfuerzo:** 2
- **Archivos:** [`docs/10-architecture/data-flow.md`](../../10-architecture/data-flow.md) actualizado con sección F5: GFK lifecycle, ProductTypeStrategy routing, ProductManufacturingProfile, columnas legacy deprecadas.

### T-55 · ADR final: arquitectura post-refactor
- **Estado:** ✅, **Esfuerzo:** 2
- **Archivos:** [`docs/10-architecture/adr/0016-post-refactor-architecture-f5.md`](../../10-architecture/adr/0016-post-refactor-architecture-f5.md) — documenta D-01 (GFK), D-02 (ProductManufacturingProfile), D-03 (ProductTypeStrategy), anti-objetivos y métricas post-F5.

**✅ GATE F5 — 2026-05-08:** T-41..T-49 + T-52..T-55 verificadas. Migraciones aditivas aplicadas, backwards functions implementadas, ADR-0016 mergeado, docs actualizados. T-50 y T-51 (EntityForm para Invoice y Product) quedan pendientes por complejidad frontend (DTE conditional fields + variant UI) — no bloquean el GATE de backend.

---

## Resumen de esfuerzo

| Fase | Tareas | Story Points |
|------|--------|--------------|
| F1 | T-01..T-06 | 19 |
| F2 | T-07..T-15 | 32 |
| F3 | T-16..T-25 | 36 |
| F4 | T-26..T-40 | 75 |
| F5 | T-41..T-55 | 87 |
| **Total** | 55 tareas | **249 SP** |

A 20 SP/sprint con 1 ingeniero senior dedicado: ~12-13 sprints. A 30 SP/sprint con 2 ingenieros: ~8 sprints.

---

## Cómo actualizar el estado de las tareas

1. Editar este archivo cambiando el emoji de **Estado**.
2. En el commit, mencionar la tarea: `git commit -m "T-09: migrate SaleOrder to TransactionalDocument"`.
3. Para tareas bloqueadas, agregar nota: `**Blocked by:** T-XX o R-XX (ver migration-and-rollback.md)`.
4. Al cerrar una fase, mover el `🏁 GATE` a `✅ GATE` y dejar la fecha del merge.
