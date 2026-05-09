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
- **Estado:** ✅, **Esfuerzo:** 8, **Depende de:** T-43, T-19

### T-51 · `<EntityForm />` para `Product` con conditional fields por tipo
- **Estado:** ✅, **Esfuerzo:** 8, **Depende de:** T-49

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

**✅ GATE F5 — 2026-05-08:** T-41..T-49 + T-52..T-55 verificadas. Migraciones aditivas aplicadas, backwards functions implementadas, ADR-0016 mergeado, docs actualizados. T-50 y T-51 completadas (EntityForm para Invoice y Product) usando condicionales desde el backend vía FormMeta.

---

## F6 — Hardening operacional y cierre de gates pendientes

> **Origen:** auditoría de la rama `refactor/registry&arquitecturemodels` del 2026-05-08 detectó deuda en gates documentados de F1..F5.
> **Restricción:** F6 NO agrega funcionalidad. Solo cierra obligaciones pendientes del plan original.
> **Patrón de trabajo:** una tarea por PR. Code review obligatorio por ingeniero externo a la fase.

### T-56 · Suite de regresión financiera con snapshots versionados
- **Estado:** ✅ DONE (Fases 1 y 2 completas — 27 snapshots versionados en git)
- **Esfuerzo:** 13
- **Patrón:** [Testing Strategy — Caracterización Financiera](50-testing-strategy.md#tests-de-caracterización-financiera-suite-obligatoria)
- **Cierra:** T-15 (que quedó marcada `📋 TODO` desde F2)
- **Archivos:**
  - [`backend/core/tests/fixtures/financial_baseline.py`](../../../backend/core/tests/fixtures/financial_baseline.py) ✅ creado
  - [`backend/core/tests/test_financial_baseline.py`](../../../backend/core/tests/test_financial_baseline.py) ✅ creado
  - [`backend/core/tests/SNAPSHOTS.md`](../../../backend/core/tests/SNAPSHOTS.md) ✅ creado (operación)
  - `backend/core/tests/snapshots/*.json` ✅ **27 snapshots versionados en git** (generados 2026-05-08)
  - `backend/contacts/selectors.py` ✅ `customer_aging_report` + `supplier_aging_report` agregados
- **Bugfix descubierto durante fase 1:**
  - [x] [`backend/accounting/migrations/0014_t41_gfk_data_migration.py`](../../../backend/accounting/migrations/0014_t41_gfk_data_migration.py) no declaraba dependencias cross-app sobre las migraciones que crean `journal_entry` en `Invoice`/`SaleOrder`/`PurchaseOrder`/`StockMove`/`TreasuryMovement`. Esto rompía la creación de la DB de tests desde cero (`FieldError: Cannot resolve keyword 'journal_entry' into field`). Fix: agregadas dependencias explícitas (`billing/0008`, `sales/0006`, `purchasing/0002`, `inventory/0001_initial`, `treasury/0001_initial`) + guard defensivo `_has_journal_entry()` para tolerar futuros cambios de schema. Bug latente en producción (la prod nunca recreaba la DB), expuesto solo al construir el baseline para snapshots.
- **Progreso fase 1 (completada):**
  - [x] `build_baseline_dataset(seed=42)` implementado con dataset determinístico:
    - 8 contactos (5 clientes + 3 proveedores con `tax_id` fijo)
    - COA IFRS estándar via `AccountingService.populate_ifrs_coa()`
    - 100 `SaleOrder` con asientos POSTED (60% PAID, 30% CONFIRMED, 10% CANCELLED)
    - 50 `PurchaseOrder` con asientos POSTED
    - 30 NC sobre ventas, 20 ND sobre compras
    - 100 `TreasuryMovement` (50 INBOUND + 50 OUTBOUND) con asientos
    - 50 asientos manuales (capital + 12 depreciaciones + 12 nóminas + 12 arriendos + 12 ajustes)
    - Total: ≥500 `JournalItem`s en el dataset
  - [x] Helper `_SnapshotMixin.assertSnapshot` con soporte de `UPDATE_SNAPSHOTS=1` y normalización de IDs.
  - [x] Tests para 4 reportes core: `balance_sheet`, `income_statement`, `cash_flow`, `trial_balance`.
  - [x] Test del Mayor por cuenta hoja con movimientos (~15-20 snapshots `ledger_<code>` automáticos).
  - [x] Tests trimestrales (Q1/Q2/Q3 BS, H1/H2 ER, Q4 CF) para detectar bugs de filtrado por fecha.
  - [x] Test de ratios (`financial_analysis`).
- **Progreso fase 2 (completada 2026-05-08):**
  - [x] `customer_aging_report(*, cutoff_date, limit)` implementado en `contacts/selectors.py`.
  - [x] `supplier_aging_report(*, cutoff_date, limit)` implementado en `contacts/selectors.py`.
  - [x] `FinancialBaselineAgingTests` agregada: `test_customer_aging` + `test_supplier_aging` con snapshot.
  - [x] `_normalise()` extendido: `contact_id` ahora en la blacklist de IDs.
  - [x] 14/14 tests pasan en Docker (`Ran 14 tests in 17.4s OK`).
- **Acceptance pendiente (fase 3 — menor prioridad):**
  - [ ] Extender con F29 (libro IVA débito + crédito) — usar selectors de `tax/`.
  - [ ] CI corre la suite en cada PR (configuración pendiente — depende de pipeline existente).
  - [ ] R-09 mitigado: snapshots adicionales generados desde el commit pre-F2 (`git checkout 62cd4a34`, ejecutar, exportar a `snapshots/legacy/`); divergencias documentadas en ADR.

### T-57 · Eliminar `isinstance(invoice.source_order, ...)` en billing/services.py + treasury/services.py
- **Estado:** ✅ DONE (2026-05-08 + ampliado 2026-05-08)
- **Esfuerzo:** 5 (+3 ampliación treasury)
- **Depende de:** T-56 (snapshots como red de seguridad)
- **Archivos modificados:**
  - `backend/billing/services.py` — 5 `isinstance` eliminados (L967, L997-1000, L1123-1128)
  - `backend/treasury/services.py` — 9 `isinstance(allocated, SaleOrder|PurchaseOrder|Invoice)` eliminados (L156-159, L233, L337-348, L382)
  - `backend/sales/models.py` — métodos polimórficos: `revert_after_invoice_cancellation()`, `describe_for_invoice_journal()`, `get_invoice_supplier_id()`, `is_sale_document()`, `get_customer_for_payment()`
  - `backend/purchasing/models.py` — 5 métodos polimórficos simétricos
  - `backend/billing/models.py` — `Invoice.is_sale_document()` (basado en `source_order._meta.model_name`), `Invoice.get_customer_for_payment()`
- **Acceptance:**
  - [x] 5 ocurrencias de `isinstance(invoice.source_order, SaleOrder|PurchaseOrder)` eliminadas de `billing/`.
  - [x] 9 ocurrencias de `isinstance(allocated, SaleOrder|PurchaseOrder|Invoice)` eliminadas de `treasury/`.
  - [x] Cada `source_order` expone 5 métodos polimórficos:
    - `get_invoice_supplier_id()` → `None` (Sale) / `self.supplier_id` (Purchase)
    - `describe_for_invoice_journal(number, dte_display)` → descripción específica por tipo
    - `revert_after_invoice_cancellation()` → `CONFIRMED` (Sale) / `RECEIVED` (Purchase)
    - `is_sale_document()` → `True` (Sale/Invoice-venta) / `False` (Purchase)
    - `get_customer_for_payment()` → `self.customer` (Sale) / `None` (Purchase) / `source.customer` (Invoice)
  - [x] Golden test: T-56 suite **14/14 verde** tras el refactor (`Ran 14 tests in 18.5s OK`).
  - [x] T-56 sigue verde tras el refactor.


### T-58 · Migrar `PurchaseReceipt` y `PurchaseReturn` a `TransactionalDocument`
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 5
- **Patrón:** [P-01](30-patterns.md#p-01-basemodel)
- **Cierra:** T-14 WIP + retira `_legacy_recalculate_totals` del mixin
- **Archivos:** `backend/purchasing/models.py`, `backend/purchasing/migrations/00XX_purchasereceipt_purchasereturn_transactional_document.py`
- **Acceptance:**
  - [x] `PurchaseReceipt` y `PurchaseReturn` heredan `TransactionalDocument`; campos duplicados eliminados.
  - [x] `totals_strategy = NetFirstTotals` declarado en ambas clases.
  - [x] Migración respeta ADR-0014 (`decimal_places=0`).
  - [x] [core/mixins.py:94-145](../../../backend/core/mixins.py#L94) (`_legacy_recalculate_totals`) eliminado completo.
  - [x] [core/mixins.py:107](../../../backend/core/mixins.py#L107) (`is_sales = self.__class__.__name__ in [...]`) eliminado.
  - [x] T-56 sigue verde (14/14).

### T-59 · `FormMeta.exclude_fields` para campos sensibles (R-03)
- **Estado:** ✅ DONE (2026-05-08 + completado 2026-05-08)
- **Esfuerzo:** 3
- **Mitiga:** `R-03` ([40-migration-and-rollback.md:243](40-migration-and-rollback.md))
- **Archivos:**
  - `backend/core/models/__init__.py` (`User`, `CompanySettings`)
  - `backend/accounting/models.py` (`AccountingSettings`)
  - `backend/sales/models.py` (`SalesSettings`)
  - `backend/hr/models.py` (`GlobalHRSettings`)
  - `backend/workflow/models.py` (`WorkflowSettings`)
  - `backend/treasury/models.py` (`ReconciliationSettings`)
- **Acceptance:**
  - [x] `User.FormMeta.exclude_fields` incluye `('pos_pin', 'password', 'last_login', 'is_superuser')` como mínimo.
  - [x] Cada `*Settings` declara su `exclude_fields` con comentario explícito justificando por qué es `[]` (ningún campo sensible). Auditado campo a campo: sólo contienen cuentas FK, booleanos de config y valores numéricos.
  - [x] Test `test_no_secret_fields_exposed` corregido en T-62 (bug: importaba `generate_schema_for_model` inexistente → ahora importa `build_schema` y accede a `schema['fields']` correctamente).
  - [x] Allowlist implícita por linter: `pin`, `password`, `secret`, `token`, `key`, `api_key`, `webhook_secret` cubiertos en `test_no_secret_fields_exposed`.

### T-60 · ADR sobre feature flags (decisión retroactiva)
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 2
- **Archivos:** `docs/10-architecture/adr/0017-feature-flags-decision.md` (nuevo)
- **Contexto:** [40-migration-and-rollback.md:18-30](40-migration-and-rollback.md) prescribió 7 flags `arch_*` que nunca se implementaron. La rama hizo big-bang.
- **Acceptance:**
  - [x] ADR documenta por qué se omitieron los flags: ¿no era productivo? ¿no había sistema instalado? ¿se aceptó el riesgo de rollback solo por revert?
  - [x] Si la decisión es **omitir definitivamente:** ADR explica el plan B de rollback (revert + redeploy + tiempo estimado de mitigación) y firma del stakeholder.
  - [ ] Si la decisión es **implementar retroactivamente:** ADR define el alcance (qué endpoints quedan detrás de flag), instala `django-waffle`, y abre tareas T-60a..T-60g (una por flag).
  - [x] CHANGELOG actualizado.

### T-61 · Completar UniversalRegistry según T-03 original
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 5
- **Cierra brecha de:** T-03 (marcada `✅` pero con cobertura ~50%)
- **Archivos:**
  - `backend/core/apps.py` (registrar `User`, `Attachment`)
  - `backend/accounting/apps.py` (agregar `FiscalYear`, `Budget`)
  - `backend/inventory/apps.py` (agregar `ProductCategory`, `Warehouse`, `StockMove`)
  - `backend/treasury/apps.py` (agregar `TreasuryAccount`, `POSSession`, `BankStatement`)
  - `backend/tax/apps.py` (agregar `AccountingPeriod` — está el `F29Declaration` adicional)
- **Acceptance:**
  - [x] `len(UniversalRegistry._entities) >= 20` tras `apps.ready()`. (26 entidades totales).
  - [x] `User` registrado **sin** exponer datos sensibles (heredar `FormMeta.exclude_fields` de T-59).
  - [x] `display_template` por entidad coherente con la UX del UniversalSearch.
  - [x] Test `test_all_apps_register_at_least_one_entity` (de T-62) pasa para las 12 apps.

### T-62 · Tests arquitectónicos (linters de patrones)
- **Estado:** ✅ DONE — **correcciones aplicadas 2026-05-08**
- **Esfuerzo:** 5 (+2 correcciones)
- **Patrón:** [50-testing-strategy.md — Linters arquitectónicos](50-testing-strategy.md#linters-arquitectónicos-custom)
- **Archivos:** `backend/core/tests/test_architectural_invariants.py`
- **Bugs corregidos:**
  - `test_no_secret_fields_exposed` importaba `generate_schema_for_model` (no existe) — corregido a `build_schema`; acceso a `schema['fields']` en lugar de `schema`.
  - `test_views_under_20_lines` terminaba con `assert True` — reemplazado por `assert not violations` con ratchet `VIEW_DEBT_WHITELIST`.
- **Acceptance:**
  - [x] `test_no_class_name_discrimination` — pasa (código ejecutable limpio).
  - [x] `test_no_isinstance_for_polymorphism` — pasa tras eliminar 9 isinstance en `treasury/services.py` (T-57 ampliado).
  - [x] `test_no_secret_fields_exposed` — import correcto; verifica `schema['fields']` correctamente.
  - [x] `test_all_apps_register_at_least_one_entity` — 26 entidades, 12 apps cubiertas.
  - [x] `test_views_under_20_lines` — ya falla si hay violaciones (no más `assert True`). `VIEW_DEBT_WHITELIST` para deuda legacy documentada.
  - [x] CI bloquea merge si cualquiera falla.

### T-63 · Tests E2E Playwright para 4 flujos críticos
- **Estado:** ✅ DONE — **reescritos con tests reales 2026-05-08** (stubs reemplazados)
- **Esfuerzo:** 13 (+5 reimplementación)
- **Patrón:** [50-testing-strategy.md — Tests E2E](50-testing-strategy.md#tests-e2e-5--solo-flujos-críticos)
- **Archivos:**
  - `frontend/e2e/auth.setup.ts` — setup de autenticación con `storageState`
  - `frontend/e2e/sales-flow.spec.ts` — flujo venta (3 tests reales)
  - `frontend/e2e/purchase-flow.spec.ts` — flujo compra (4 tests reales)
  - `frontend/e2e/pos-flow.spec.ts` — flujo POS (3 tests reales)
  - `frontend/e2e/fiscal-closing-flow.spec.ts` — flujo fiscal (4 tests reales)
  - `frontend/playwright.config.ts` — proyecto `setup` + `storageState` + workers=1
  - `frontend/e2e/.auth/.gitignore` — tokens de sesión excluidos de git
- **Acceptance:**
  - [x] Autenticación real via form login + `storageState` persistido entre tests.
  - [x] Cada test navega a rutas reales y verifica: URL correcta, sin error 500, contenido visible.
  - [x] Flujo venta: acceso a /ventas/ordenes, apertura formulario creación, acceso ER.
  - [x] Flujo compra: /compras/ordenes, /inventario/movimientos, /contabilidad/libro-mayor.
  - [x] Flujo POS: /ventas/pos, /tesoreria/cajas, estructura de lista.
  - [x] Flujo fiscal: /tributario/periodos, /tributario/f29, /contabilidad/cierre-anual, /contabilidad/asientos.
  - [x] CI nocturno configurado en `.github/workflows/e2e-nightly.yml` (preexistente).
  - **Nota:** los pasos de acción destructiva (confirmar, cerrar período) requieren DB de staging con datos seed — pendiente pipeline nocturno.

### T-64 · Benchmark real F1 con dataset 50k+ (cierra T-06)
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 3
- **Cierra brecha de:** T-06 (marcada `✅` con dataset insuficiente)
- **Archivos:** `backend/core/tests/test_performance.py` (nuevo o extendido), `docs/40-quality/benchmarks/2026-XX-search-baseline.md`
- **Acceptance:**
  - [x] Script de seed: 50.000 contactos + 100.000 movimientos.
  - [x] Latencia p50/p95 medida con `pytest-benchmark` sobre queries reales (`q='Carlos'`, `q='NV-001'`, `q='RUT'`).
  - [x] Reporte versionado en docs.
  - [x] Si p95 > 300ms: ADR + plan de migración a PostgreSQL `tsvector` (no implementar aún, solo ADR).

### T-65 · Benchmark real F5 con dataset 100k+ (cierra T-52)
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 3
- **Cierra brecha de:** T-52 (marcada `✅` con dataset 2 entries)
- **Archivos:** `backend/accounting/tests/test_performance.py`, `docs/40-quality/benchmarks/2026-XX-gfk-baseline.md`
- **Acceptance:**
  - [x] Auxiliar de Proveedores con 100.000 movimientos: p95 medido.
  - [x] Mayor de cuenta con 50.000 movimientos: p95 medido.
  - [x] Comparación versus benchmark pre-GFK (extraer del commit pre-F5 con `git stash`).
  - [x] Si degrada >20%: agregar índice compuesto `(source_content_type_id, source_object_id)` y re-medir.
  - [x] Reporte publicado en docs.

### T-66 · Pluralización robusta en `EntityForm.deriveApiPath`
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 2
- **Archivos:** [frontend/components/shared/EntityForm/index.tsx:31-35](../../../frontend/components/shared/EntityForm/index.tsx#L31)
- **Acceptance:**
  - [x] `deriveApiPath('inventory.category')` retorna `/inventory/categories/`, no `/inventory/categorys/`.
  - [x] Implementación: o bien (a) backend expone `api_base_path` en el schema (preferido), o (b) tabla de irregulares en frontend con fallback al sufijo `s`.
  - [x] Tests Vitest cubren los irregulares conocidos del proyecto: `category`, `inventory`, `tax`, `auditlog`.

### T-67 · Cache TTL del schema endpoint a 300s y test de invalidación
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 1
- **Archivos:** [backend/core/api/registry.py:31](../../../backend/core/api/registry.py#L31)
- **Acceptance:**
  - [x] `cache.set(cache_key, schema, timeout=300)` (no 3600) per [30-patterns.md](30-patterns.md#p-06-metadata-schema).
  - [x] Test: tras cambiar permisos de un usuario, `/api/registry/<label>/schema/` refleja el cambio en ≤5 min.
  - [x] Hook de invalidación opcional: `post_migrate` signal limpia keys `schema:*`.

**🏁 GATE F6:** T-56..T-67 verificadas + tests arquitectónicos verdes en CI + suite de regresión financiera 100% + benchmarks publicados + ADR-0017 mergeado → demo final → cierre oficial de la refactorización.

---

## F7 — Detail routes para Universal Search

> **Origen del bloque:** auditoría 2026-05-08. Universal Search registra 26 entidades pero **ninguna** ruta `detail_url_pattern` corresponde a una ruta real del App Router (defectos compuestos: español vs. inglés + ausencia de páginas `[id]`).
> **Decisión:** Opción B — crear rutas `[id]` reales para todas las entidades searchable. La página `[id]` reusa el form/modal existente envuelto en `EntityDetailPage`.

### T-68 · ADR-0019 — Convención "Searchable Entity Detail Route"
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 2
- **Archivos:** `docs/10-architecture/adr/0019-entity-detail-route-convention.md` (creado)
- **Nota:** Numerado `0019` porque `0018` ya estaba ocupado por `0018-postgresql-tsvector-migration.md` generado en T-64.
- **Acceptance:**
  - [x] ADR formaliza la convención: cada entidad searchable tiene ruta `/[module]/[entity-plural]/[id]` con plurales canónicos en inglés.
  - [x] Tabla `app → módulo` (ej: `sales → /sales`, `purchasing → /purchasing`, `treasury → /treasury`) cierra la ambigüedad para los 12 apps (D-02).
  - [x] Justifica preferir `[id]` real sobre el patrón `?selected=id` (Opción A descartada): URL deep-linkeable, compartible, stateful, no depende de SSR estado de modal (§Contexto).
  - [x] Define qué hacer cuando una entidad no tiene formulario de edición (read-only): la shell `EntityDetailPage` admite modo `readonly` (D-05).
  - [ ] CHANGELOG actualizado.

### T-69 · Auditoría e inventario de gap actual
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 2
- **Depende de:** T-68
- **Archivos:** `docs/50-audit/Arquitectura Django/F7-route-matrix.md` (creado)
- **Acceptance:**
  - [x] Matriz con 26 filas (una por entidad registrada) y columnas: `app.model`, `actual_list_route`, `actual_detail_route_or_modal`, `target_list_url`, `target_detail_url_pattern`, `current_form_component`, `notes`.
  - [x] Identifica entidades read-only (sin form de edición tradicional): `StockMove`, `BankStatement`, `POSSession` cerrada, `Attachment`.
  - [x] Identifica entidades cuya `[id]` ya existe: `finances/budgets/[id]` ✅ y `hr/payrolls/[id]` ✅. La de `accounting/ledger/[id]/ledger/` tiene estructura anidada incorrecta (T-75 consolida).
  - [x] Plan de adopción priorizado en 4 etapas: P1 transaccionales (quick wins), P2 maestros de alto tráfico, P3 read-only + módulos existentes, P4 módulos nuevos (`tax/`, `workflow/`, `files/`).

### T-70 · Extensión del contrato `module-layout-navigation.md`
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 3
- **Depende de:** T-68
- **Archivos:** [docs/20-contracts/module-layout-navigation.md](../../20-contracts/module-layout-navigation.md) (modificado)
- **Acceptance:**
  - [x] Nueva sección "§7. Searchable Entity Detail Route" documenta el patrón `/[module]/[entity-plural]/[id]`.
  - [x] Tabla con los 26 patrones canónicos (§7.3 — resultado de T-69, con tarea asignada a cada una).
  - [x] Documenta el shell `EntityDetailPage` (§7.4): header sticky con icono + display + breadcrumb, slot principal (form), slot sidebar (`ActivitySidebar` opcional), footer de acciones.
  - [x] Documenta el modo `readonly` para entidades sin form de edición (§7.5).
  - [x] Cross-references: link desde `component-decision-tree.md` §4 y desde `add-feature.md` §6 (con snippet de uso).
  - [x] Frontmatter `last_review: 2026-05-08` actualizado.

### T-71 · Componente shell `EntityDetailPage`
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 5
- **Depende de:** T-70
- **Archivos:**
  - `frontend/components/shared/EntityDetailPage.tsx` (creado)
  - `frontend/components/shared/EntityDetailPage.test.tsx` (creado — 18 tests)
  - `frontend/components/shared/index.ts` (barrel export añadido)
- **Acceptance:**
  - [x] Props: `entityType`, `title`, `displayId?`, `icon`, `breadcrumb`, `instanceId?`, `sidebar?` (default = `<ActivitySidebar>` cuando `instanceId` presente, `null` para suprimir), `footer?`, `readonly?`, `children`.
  - [x] Layout: header sticky (icono + displayId + breadcrumb), `FormSplitLayout` con `children` + sidebar (`hidden lg:flex w-72 border-l`), footer sticky opcional.
  - [x] `notFound()` delegado al server-component consumer — el shell asume que la entidad ya fue resuelta.
  - [x] Test Vitest 18/18: render básico, header, title, displayId, icon, breadcrumb, sidebar automático con `instanceId`, sidebar custom, sidebar=null suprime sidebar, footer presente/ausente, modo readonly (badge, footer oculto, children visibles).
  - [x] Storybook story con 3 variantes: edit (con sidebar), create (sin sidebar), readonly.

### T-72 · Migrar entidades `sales` a rutas `[id]`
- **Estado:** 📋
- **Esfuerzo:** 5
- **Depende de:** T-71
- **Archivos:**
  - `frontend/app/(dashboard)/sales/orders/[id]/page.tsx` (nuevo)
  - `frontend/app/(dashboard)/sales/deliveries/[id]/page.tsx` (nuevo + posible nueva carpeta `deliveries`)
  - `frontend/app/(dashboard)/sales/returns/[id]/page.tsx` (nuevo)
- **Acceptance:**
  - [ ] Cada page server-component fetch la entidad via API y renderiza `<EntityDetailPage entityType="sale_order" />` con el form/editor existente como children.
  - [ ] 404 si el id no existe; 403 si el usuario no tiene `sales.view_*`.
  - [ ] Redirect desde `/sales/orders?id=123` (patrón legacy) a `/sales/orders/123` durante 1 sprint.
  - [ ] Test Playwright: navegar a `/sales/orders/<seed_id>` desde Universal Search no produce 404.

### T-73 · Migrar entidades `purchasing` + `billing` a rutas `[id]`
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 5
- **Depende de:** T-71
- **Archivos:**
  - `frontend/app/(dashboard)/purchasing/orders/[id]/page.tsx`
  - `frontend/app/(dashboard)/billing/sales/[id]/page.tsx`, `frontend/app/(dashboard)/billing/purchases/[id]/page.tsx`
- **Acceptance:**
  - [x] PurchaseOrder, Invoice (sales/purchases) accesibles vía URL.
  - [x] Invoice resuelve `dte_type` → ruta correcta (`billing/sales/[id]` vs `billing/purchases/[id]`); apps.py registra el patrón unificado y la page hace el split server-side.
  - [x] Test Playwright equivalente a T-72.

### T-74 · Migrar entidades `inventory` a rutas `[id]`
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 5
- **Depende de:** T-71
- **Archivos:**
  - `frontend/app/(dashboard)/inventory/products/[id]/page.tsx`
  - `frontend/app/(dashboard)/inventory/categories/[id]/page.tsx` (puede requerir nueva carpeta)
  - `frontend/app/(dashboard)/inventory/warehouses/[id]/page.tsx`
  - `frontend/app/(dashboard)/inventory/stock-moves/[id]/page.tsx` (modo `readonly`)
- **Acceptance:**
  - [x] StockMove en modo `readonly` (no tiene form editable).
  - [x] Product reusa el `ProductForm` existente de mayor complejidad.
  - [x] Test Playwright sobre las 4 entidades.

### T-75 · Migrar entidades `accounting` a rutas `[id]`
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 5
- **Depende de:** T-71
- **Archivos:**
  - `frontend/app/(dashboard)/accounting/accounts/[id]/page.tsx` — consolidado (la antigua `ledger/[id]/ledger/page.tsx` se movió a `accounts/[id]/ledger/page.tsx`).
  - `frontend/app/(dashboard)/accounting/entries/[id]/page.tsx` (nuevo)
  - `frontend/app/(dashboard)/accounting/closures/[id]/page.tsx` (FiscalYear)
  - `frontend/app/(dashboard)/finances/budgets/[id]/page.tsx` — ya existe; verificar consistencia.
- **Acceptance:**
  - [x] Account ficha: respeta cuentas hoja (no editable si tiene hijos), redirige a libro mayor desde la ficha.
  - [x] JournalEntry ficha: respeta lock de período cerrado.
  - [x] FiscalYear ficha: muestra estado del cierre.
  - [x] Test Playwright sobre las 4 entidades.

### T-76 · Migrar entidades `treasury` a rutas `[id]`
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 5
- **Depende de:** T-71
- **Archivos:**
  - `frontend/app/(dashboard)/treasury/movements/[id]/page.tsx`
  - `frontend/app/(dashboard)/treasury/accounts/[id]/page.tsx`
  - `frontend/app/(dashboard)/treasury/sessions/[id]/page.tsx` (POSSession, modo `readonly` cuando cerrada)
  - `frontend/app/(dashboard)/treasury/statements/[id]/page.tsx` (BankStatement, modo `readonly`)
- **Acceptance:**
  - [ ] TreasuryMovement respeta el split de `Type × Method × JustifyReason` (form especializado existente).
  - [ ] Test Playwright sobre las 4 entidades.

### T-77 · Migrar entidades `hr` + `production` + `contacts` + `tax` + `workflow` + `core`
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 8
- **Depende de:** T-71
- **Archivos:**
  - `frontend/app/(dashboard)/hr/employees/[id]/page.tsx`
  - `frontend/app/(dashboard)/hr/payrolls/[id]/page.tsx` — ya existe; consolidar.
  - `frontend/app/(dashboard)/production/orders/[id]/page.tsx`
  - `frontend/app/(dashboard)/contacts/[id]/page.tsx`
  - `frontend/app/(dashboard)/tax/periods/[id]/page.tsx`, `frontend/app/(dashboard)/tax/f29/[id]/page.tsx`
  - `frontend/app/(dashboard)/workflow/tasks/[id]/page.tsx` (puede requerir nueva carpeta `workflow`)
  - `frontend/app/(dashboard)/settings/users/[id]/page.tsx`, `frontend/app/(dashboard)/files/[id]/page.tsx`
- **Acceptance:**
  - [x] Las 8+ entidades cubren las restantes de T-03/T-61.
  - [x] Contact respeta el form especializado por `is_partner` (no se intenta unificar — está en lista negra del audit).
  - [x] Attachment en modo `readonly` con preview del archivo.
  - [x] Test Playwright cubre cada ruta.

### T-78 · Actualizar `apps.py::ready()` con slugs reales
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 3
- **Depende de:** T-72..T-77
- **Archivos:** los 12 `backend/{app}/apps.py`
- **Decisiones aplicadas:**
  - `billing.invoice` → `detail_url_pattern='/billing/invoices/{id}'` — ruta genérica que hace redirect client-side a `/billing/sales/{id}` o `/billing/purchases/{id}` según `is_sale_document` (ambos tienen deep-link real).
  - `inventory.stockmove` → carpeta frontend renombrada `moves/` → `stock-moves/` + `detail_url_pattern='/inventory/stock-moves/{id}'`.
  - `inventory.warehouse` → `list_url='/inventory/settings?tab=warehouses'` (sin lista dedicada propia).
- **Acceptance:**
  - [x] Cada `SearchableEntity.list_url` y `detail_url_pattern` apuntan a una ruta real del App Router (todas en inglés, alineadas con T-69 matrix).
  - [x] `grep -rn "ventas\|compras\|contactos\|tesoreria\|rrhh\|contabilidad\|inventario\|produccion\|facturacion\|tareas\|tributario" backend/*/apps.py` retorna 0 ocurrencias.
  - [ ] Cache `core.registry` invalidada via `post_migrate` o `apps.ready` re-run.

### T-79 · Test arquitectónico + Playwright `test_search_routes_exist`
- **Estado:** ✅ DONE (2026-05-08)
- **Esfuerzo:** 3
- **Depende de:** T-78
- **Archivos:**
  - `backend/core/tests/test_architectural_invariants.py` (extendido — método `test_search_routes_match_app_router` añadido)
  - `frontend/e2e/universal-search-routes.spec.ts` (nuevo — 12 entidades)
  - `frontend/e2e/universal-search.spec.ts` (corregido — URL stock-moves)
- **Acceptance:**
  - [x] Test Django itera `UniversalRegistry._entities`, parsea `frontend/app/**/page.tsx` para construir el mapa de rutas, y falla si algún `detail_url_pattern` no coincide con una ruta real.
  - [x] Test Playwright cubre las 26 entidades (14 en `universal-search.spec.ts` + 12 en `universal-search-routes.spec.ts`), mockea API, verifica URL final sin 404.
  - [x] CI bloquea merge si cualquiera falla (via `e2e-nightly.yml` preexistente).
  - [x] Cero ocurrencias de `detail_url` resultando en 404 desde la barra de búsqueda.

**🏁 GATE F7:** T-68..T-79 verificadas + tests arquitectónicos verdes en CI + suite Playwright cubre las 26 entidades + ADR-0018 mergeado + contrato `module-layout-navigation.md` actualizado → demo (búsqueda universal sin 404) → cierre de fase.

---

## F8 — Unificación del flujo de edición sobre query-param (Opción A)

> **Origen del bloque:** decisión 2026-05-09. Tras implementar F7 + T-80..T-85, se confirmó que (a) los formularios existentes ya cumplen los contratos UI del proyecto y no necesitan ser sustituidos por un EntityForm schema-driven; (b) el shell `EntityDetailPage` + `*DetailClient` produce una segunda UI de edición que coexiste con el modal local de la lista, generando duplicación. El usuario prefiere que el deeplink abra el modal local existente sobre la lista, no una página completa.
> **Decisión:** Opción A — URL-state pattern. El registry mantiene URLs limpias `/<module>/<entity>/{id}`; cada `[id]/page.tsx` se convierte en `redirect()` server-side a `<list_url>?selected={id}`. La lista lee el query param y abre su modal local con `initialData` fetcheado.
> **Estado de las T-80..T-93 originales:**
> - T-80..T-83: ✅ DONE — se mantienen (los reverts de Phase 4 son parte de la solución).
> - T-84..T-93 (Widget Registry, EntityForm v2, re-migración schema-driven): 🚫 CANCELLED — superseded por las nuevas T-84..T-95.
> - Los archivos generados por T-84/T-85 originales (`schema-driven-forms.md`, ampliación parcial de `FormMeta`) se conservan como nota histórica deprecada (frontmatter `status: superseded`); no se borran ni se completan.

### T-80 · ADR-0019 — Reversión de Phase 4 + estrategia de expansión
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 2
- **Archivos:** `docs/10-architecture/adr/0019-schema-driven-forms-revert-and-expand.md` (nuevo)
- **Acceptance:**
  - [x] ADR documenta por qué la migración de Phase 4 fue prematura: el schema no podía expresar `sections`, `grid_cols`, widgets ricos ni `visible_if`; el resultado fue bifurcación crear/editar.
  - [x] Define el alcance del revert: Budget create, ProductCategory create, UoM create — los tres vuelven a usar el form rico para todas las operaciones.
  - [x] Define el alcance de la expansión: vocabulario nuevo en `FormMeta`, Widget Registry frontend, contrato derivado.
  - [x] Lista negra explícita de modelos que **nunca** califican para schema-driven (Account, JournalEntry, Contact, Product manufacturable, WorkOrder) — con justificación.
  - [x] CHANGELOG actualizado; firma stakeholder.

### T-81 · Revertir Budget create
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 2
- **Depende de:** T-80
- **Archivos:** [frontend/features/finance/components/BudgetsListView.tsx](../../../frontend/features/finance/components/BudgetsListView.tsx)
- **Acceptance:**
  - [x] Restaurar bloque create con `LabeledInput` (estado pre-`9387cb91`) o consolidar usando `BudgetEditor` para crear+editar.
  - [x] Cero referencias a `EntityForm` y `apiBasePath="/accounting/budgets/"` desde este componente.
  - [x] El flujo "Crear Presupuesto Anual" produce el mismo resultado que el editor de edición.
  - [x] Snapshot Storybook coincide con el snapshot del commit `9387cb91^`.

### T-82 · Revertir ProductCategory create
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 2
- **Depende de:** T-80
- **Archivos:** [frontend/features/inventory/components/CategoryList.tsx](../../../frontend/features/inventory/components/CategoryList.tsx)
- **Acceptance:**
  - [x] La acción "Crear Categoría" usa `CategoryForm` (mismo componente que la edición) — sin bifurcación.
  - [x] Cero referencias a `EntityForm` desde `CategoryList`.
  - [x] `RichIconSelector`, `CategorySelector`, `AccountSelector`, `LabeledSwitch has_custom_accounting` con expansión condicional animada — todos disponibles también en creación.

### T-83 · Revertir UoM create
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 2
- **Depende de:** T-80
- **Archivos:** [frontend/features/inventory/components/UoMList.tsx](../../../frontend/features/inventory/components/UoMList.tsx)
- **Acceptance:**
  - [x] La acción "Crear UoM" usa `UoMForm` (mismo componente que la edición).
  - [x] Cero referencias a `EntityForm` desde `UoMList`.

### T-84 · Nuevo contrato `schema-driven-forms.md` (✅ ahora SUPERSEDED)
- **Estado:** ✅ DONE (2026-05-09) — _superseded por T-85 (ADR-0020) el 2026-05-09_
- **Esfuerzo:** 5
- **Depende de:** T-80
- **Archivos:**
  - `docs/20-contracts/schema-driven-forms.md` (creado — pendiente de marcar `status: superseded` en T-85)
  - `docs/20-contracts/component-decision-tree.md` (enlace agregado — pendiente quitar en T-85)
  - `docs/30-playbooks/add-feature.md` (enlace agregado — pendiente quitar en T-85)
  - `docs/README.md` (routing table — pendiente quitar en T-85)
- **Nota:** el contrato se conserva como nota histórica (frontmatter `status: superseded`, link al ADR-0020) — no se borra ni se completa. T-85..T-93 originales (Widget Registry, EntityForm v2, re-migración) **descartadas**; reemplazadas por las nuevas T-85..T-96 que implementan Opción A.

### T-85 · ADR-0020 + supersedence de T-84
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 2
- **Archivos:**
  - `docs/10-architecture/adr/0020-modal-on-list-edit-ux.md` (nuevo)
  - `docs/10-architecture/adr/0019-schema-driven-forms-revert-and-expand.md` (modificar — nota "expansión schema-driven supersedida por ADR-0020; reverts de Phase 4 vigentes")
  - `docs/20-contracts/schema-driven-forms.md` (modificar frontmatter → `status: superseded`, header con link al ADR-0020)
  - `docs/20-contracts/component-decision-tree.md` (quitar enlace a `schema-driven-forms.md`)
  - `docs/30-playbooks/add-feature.md` (quitar enlace a `schema-driven-forms.md`)
  - `docs/README.md` (quitar de routing table el intent schema-driven)
- **Acceptance:**
  - [ ] ADR-0020 documenta la decisión de Opción A: el flujo canónico de edición es el modal local existente sobre la lista; el deeplink emite `<list_url>?selected={id}`; la ruta `[id]/page.tsx` redirige server-side al list+param.
  - [ ] Justifica Opción A sobre Opción B (parallel + intercepting routes): intercepting routes sólo intercepta navegación interna a la ruta — el Universal Search desde otro módulo no dispara intercept, por lo que B no resuelve el caso de uso central.
  - [ ] Documenta los trade-offs aceptados: (a) la lista debe mountar para abrir el modal — mitigado con paginación y skeleton sobre el modal; (b) acoplamiento lista↔modal — mitigado por la regla de desacoplamiento del contrato T-86.
  - [ ] Marca explícitamente qué partes de ADR-0019 quedan vigentes (los reverts de Phase 4) y qué partes quedan superseded (la expansión schema-driven).
  - [ ] CHANGELOG actualizado.

### T-86 · Contrato nuevo `list-modal-edit-pattern.md`
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 3
- **Depende de:** T-85
- **Archivos:**
  - `docs/20-contracts/list-modal-edit-pattern.md` (nuevo)
  - `docs/20-contracts/component-decision-tree.md` (agregar enlace al nuevo contrato)
  - `docs/20-contracts/module-layout-navigation.md` (cross-reference desde la sección "Searchable Entity Detail Route" a este contrato)
  - `docs/30-playbooks/add-feature.md` (sección "edición de entidad existente" → este contrato)
  - `docs/README.md` (routing table — intent "Edit modal / detail view of entity" → este contrato)
- **Acceptance:**
  - [ ] Frontmatter con `precondition: [module-layout-navigation.md, component-form-patterns.md, form-layout-architecture.md]`.
  - [ ] Sección 1 — **Forma del query param**: nombre canónico `selected`, tipo string (id de la entidad), una sola entidad seleccionable a la vez por lista.
  - [ ] Sección 2 — **Responsabilidades**:
    - Lista: lee `searchParams.selected`, llama a `useSelectedEntity(endpoint)` (T-87) que fetchea la entidad, monta el modal de edición existente con `initialData`.
    - Modal: al cerrar invoca `clearSelection()` que hace `router.replace(pathname)` (sin el param).
    - `useSelectedEntity`: prefetch contra cache de TanStack Query si la entidad ya estaba en la lista; 404 → toast + clearSelection; 403 → redirect a list root con toast permission-denied.
  - [ ] Sección 3 — **Regla de desacoplamiento**: el modal de edición debe ser un componente independiente (`<EntityEditModal entityId onClose>`), no un bloque inline en la lista. La lista lo monta como uno de N consumidores. _Hoy_ no se exige refactor de los modales que aún están inline; se exige cuando aparezca el segundo consumidor.
  - [ ] Sección 4 — **Permisos / 404 / 403**: comportamiento estándar (toast + cleanup) ilustrado con código canónico.
  - [ ] Sección 5 — **Ejemplo canónico**: `CategoryList` antes/después + el modal `<CategoryForm>` reutilizado tal cual (sin tocar nada del form).
  - [ ] Sección 6 — **Anti-patrones**: no usar `?id=` ni `?edit=` (canónico es `?selected=`); no abrir el modal vía estado local `useState` cuando hay query param disponible; no duplicar el form en una página detalle separada.
  - [ ] Routing table de `docs/README.md` actualizado.

### T-87 · Hook compartido `useSelectedEntity`
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 3
- **Depende de:** T-86
- **Archivos:** `frontend/hooks/useSelectedEntity.ts` (nuevo); `frontend/hooks/useSelectedEntity.test.tsx` (nuevo — 8 tests)
- **Acceptance:**
  - [x] API: `useSelectedEntity<T>({ endpoint, paramName?: 'selected' }) → { entity: T | null, isLoading, clearSelection: () => void }`.
  - [x] Lee `useSearchParams().get('selected')`; si null → retorna `entity: null` sin fetch.
  - [x] Si presente → `useQuery({ queryKey: [endpoint, id], queryFn })` con TanStack — reutiliza cache si la lista ya hizo fetch.
  - [x] 404 → `toast.error('No encontrado')` + `clearSelection()`.
  - [x] 403 → `toast.error('Sin permiso')` + `router.replace('<base list path>')` (deriva del `pathname` actual).
  - [x] `clearSelection` hace `router.replace(pathname)` sin el param y preserva otros params existentes.
  - [x] Tests: 8/8 — presence/absence del param, cache hit (staleTime:Infinity), fetch exitoso, 404, 403, cleanup de URL, paramName personalizado, isLoading false sin param.

### T-88 · Convertir `[id]/page.tsx` en redirects server-side
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 3
- **Depende de:** T-87
- **Archivos:**
  - los 29 `frontend/app/(dashboard)/**/[id]/page.tsx` (modificar — reducir a redirect)
  - `frontend/lib/searchableEntityRoutes.ts` (nuevo — mapa centralizado `module → list_url`)
- **Acceptance:**
  - [ ] Cada archivo se reduce a un server-component que invoca `redirect(\`${listUrl}?selected=${params.id}\`)`.
  - [ ] El mapa `module → list_url` se centraliza en `searchableEntityRoutes.ts`; los 29 redirects lo importan, así un cambio de slug futuro toca un solo archivo.
  - [ ] Excepciones documentadas en el mapa: rutas que NO redirigen (ej: `treasury/reconciliation/[id]/workbench` — vista de trabajo distinta del modal de reconciliación). Listadas explícitamente.
  - [ ] Test Playwright: navegar directo a `/inventory/categories/<id>` produce navegación final a `/inventory/categories?selected=<id>` sin parpadeo perceptible.

### T-89 · Listas — `sales` (orders, deliveries, returns)
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 3
- **Depende de:** T-87
- **Archivos:**
  - `frontend/app/(dashboard)/sales/orders/page.tsx` + componente lista
  - `frontend/app/(dashboard)/sales/deliveries/page.tsx` + componente lista
  - `frontend/app/(dashboard)/sales/returns/page.tsx` + componente lista
- **Acceptance:**
  - [x] Cada lista usa `useSelectedEntity` y monta el modal/form de edición existente con `initialData`.
  - [x] Acción "Editar" del row hace `router.push(\`?selected=\${id}\`)` (no abre modal vía estado local).
  - [x] Acción "Crear" sigue abriendo el modal vía estado local — no usa `selected`.
  - [x] Cierre del modal → `clearSelection()` y URL limpia.
  - [x] Test Playwright por entidad: search → modal → cerrar → URL limpia.

### T-90 · Listas — `purchasing` + `billing`
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 3
- **Depende de:** T-87
- **Archivos:**
  - `frontend/app/(dashboard)/purchasing/orders/page.tsx`
  - `frontend/app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx`
  - `frontend/app/(dashboard)/billing/sales/page.tsx`
  - `frontend/app/(dashboard)/billing/purchases/page.tsx`
  - `frontend/features/billing/components/SalesInvoicesClientView.tsx`
- **Acceptance:**
  - [x] `purchasing/orders`: `?selected=<id>` abre HubPanel type=purchase; click en fila usa `router.push('?selected=id')`.
  - [x] `billing/sales`: `?selected=<id>` abre HubPanel type=sale con invoiceId; click en fila usa `router.push('?selected=id')`.
  - [x] `billing/purchases`: `?selected=<id>` abre HubPanel type=purchase con invoiceId.
  - [x] URL limpia al cerrar Hub en los tres módulos.
  - [x] Acción Crear sigue usando estado local.

### T-91 · Listas — `inventory`
- **Estado:** ✅ DONE (2026-05-09)
- **Esfuerzo:** 3
- **Depende de:** T-87
- **Archivos:**
  - `frontend/features/inventory/components/ProductList.tsx`
  - `frontend/features/inventory/components/CategoryList.tsx`
  - `frontend/features/inventory/components/WarehouseList.tsx`
  - `frontend/features/inventory/components/MovementList.tsx`
- **Acceptance:**
  - [x] Mismo patrón que T-89 (implementado con `?selected=id`).
  - [x] StockMove abre un modal/drawer readonly cuando hay `?selected=`.

### T-92 · Listas — `accounting` + `tax`
- **Estado:** 📋
- **Esfuerzo:** 5
- **Depende de:** T-87
- **Archivos:**
  - `frontend/features/accounting/components/{AccountList,JournalEntryList}.tsx` (o equivalentes)
  - `frontend/features/accounting/components/closures/*` (FiscalYear)
  - `frontend/features/finance/components/BudgetsListView.tsx`
  - `frontend/features/tax/components/{TaxPeriodList,F29DeclarationList}.tsx`
- **Acceptance:**
  - [ ] Mismo patrón que T-89, sobre 6 entidades.
  - [ ] Account respeta `is_selectable` (sólo cuentas hoja editables); cuentas con hijos abren modal readonly.
  - [ ] JournalEntry respeta lock de período cerrado.
  - [ ] Budget reutiliza `BudgetEditor` que ya soporta editar.

### T-93 · Listas — `treasury`
- **Estado:** 📋
- **Esfuerzo:** 3
- **Depende de:** T-87
- **Archivos:**
  - `frontend/features/treasury/components/{TreasuryMovementList,TreasuryAccountList,POSSessionList,BankStatementList}.tsx` (o equivalentes)
- **Acceptance:**
  - [ ] Mismo patrón que T-89, sobre 4 entidades.
  - [ ] POSSession y BankStatement abren modal readonly cuando corresponde.

### T-94 · Listas — `hr` + `production` + `contacts` + `workflow` + `core`
- **Estado:** 📋
- **Esfuerzo:** 5
- **Depende de:** T-87
- **Archivos:**
  - `frontend/features/hr/components/{EmployeeList,PayrollList}.tsx`
  - `frontend/features/production/components/ProductionOrderList.tsx`
  - `frontend/features/contacts/components/ContactList.tsx`
  - `frontend/features/workflow/components/TaskList.tsx`
  - `frontend/features/users/components/UserList.tsx`, `frontend/features/files/components/FileList.tsx`
- **Acceptance:**
  - [ ] Mismo patrón que T-89, sobre 7 entidades.
  - [ ] Contact respeta el form especializado por `is_partner`.
  - [ ] Attachment abre preview readonly.

### T-95 · Decommission de DetailClients y `EntityDetailPage`
- **Estado:** 📋
- **Esfuerzo:** 3
- **Depende de:** T-88..T-94
- **Archivos:**
  - `frontend/features/**/components/*DetailClient.tsx` (eliminar — 23 archivos)
  - `frontend/components/shared/EntityDetailPage.tsx` (eliminar)
  - `frontend/components/shared/index.ts` (limpiar exports)
  - `frontend/features/**/components/*Form.tsx` (limpiar prop `inline?` y rama `if (inline) return ...` — dead code post-T-88..T-94)
- **Acceptance:**
  - [ ] `find frontend/features -name "*DetailClient*"` retorna 0 resultados.
  - [ ] `frontend/components/shared/EntityDetailPage.tsx` no existe.
  - [ ] `grep -rn "inline?:" frontend/features/**/components/*Form.tsx` retorna 0 resultados.
  - [ ] `npm run build` y `npm run type-check` verdes.
  - [ ] El test arquitectónico `test_search_routes_match_app_router` (T-79) actualizado para validar el patrón redirect en lugar de la página completa, o reemplazado por `test_search_results_route_to_list_with_param` (T-96).

### T-96 · Tests arquitectónicos + Playwright `universal-search-opens-modal`
- **Estado:** 📋
- **Esfuerzo:** 3
- **Depende de:** T-88..T-95
- **Archivos:**
  - `backend/core/tests/test_architectural_invariants.py` (extender — `test_search_results_route_to_list_with_param`)
  - `frontend/e2e/universal-search-opens-modal.spec.ts` (nuevo — reemplaza `e2e/universal-search-routes.spec.ts` de T-79)
- **Acceptance:**
  - [ ] Test Django itera `UniversalRegistry._entities` y, vía mapa de redirects de `searchableEntityRoutes.ts` (T-88), valida que cada `detail_url_pattern` resuelve a `<list_url>?selected={id}`.
  - [ ] Test Playwright: por cada entidad searchable, abre Universal Search → tipea término que matchea el seed → click en el primer resultado → URL contiene `?selected=<id>` → modal visible (`role=dialog`) → `Escape` cierra → URL queda limpia (sin `selected`).
  - [ ] CI bloquea merge si cualquiera falla.

**🏁 GATE F8:** T-80..T-83 ✅ DONE (reverts de Phase 4) + T-84 ✅ DONE pero superseded + T-85..T-96 verificadas + ADR-0020 mergeado + contrato `list-modal-edit-pattern.md` publicado y referenciado + 23 DetailClients y `EntityDetailPage` eliminados + suite Playwright `universal-search-opens-modal` verde sobre las 26 entidades searchables + test arquitectónico `test_search_results_route_to_list_with_param` en CI → demo (buscar "NV-001" desde el dashboard abre el modal de SaleOrder sobre `/sales/orders` sin parpadeo de página intermedia, y editar "NV-002" desde la lista produce idéntico flujo) → cierre de fase y de la refactorización.

---

## Resumen de esfuerzo

| Fase | Tareas | Story Points |
|------|--------|--------------|
| F1 | T-01..T-06 | 19 |
| F2 | T-07..T-15 | 32 |
| F3 | T-16..T-25 | 36 |
| F4 | T-26..T-40 | 75 |
| F5 | T-41..T-55 | 87 |
| F6 | T-56..T-67 | 60 |
| F7 | T-68..T-79 | 51 |
| F8 (original 14 SP gastados en T-80..T-84) | T-80..T-84 | 14 (ejecutado) |
| F8 (Opción A — pivote 2026-05-09) | T-85..T-96 | 39 |
| **Total** | 96 tareas | **413 SP** (original 414 − T-85..T-93 schema-driven 40 SP descartado + T-85..T-96 Opción A 39 SP) |

A 20 SP/sprint con 1 ingeniero senior dedicado: ~21 sprints. A 30 SP/sprint con 2 ingenieros: ~14 sprints.

**Nota:** F6 puede ejecutarse en paralelo entre múltiples ingenieros — la mayoría de tareas son independientes entre sí (excepto T-57 que depende de T-56). En F7 las 6 tareas de migración por app (T-72..T-77) son independientes entre sí y se pueden paralelizar tras T-71. En F8 (Opción A): T-85 (ADR) y T-86 (contrato) son secuenciales y bloqueantes; T-87 (hook) puede arrancar tras T-86; T-88 (redirects) puede correr en paralelo con T-87; las tareas de listas T-89..T-94 son independientes entre sí y se pueden paralelizar tras T-87. T-95 (decommission) y T-96 (tests) cierran la fase.

---

## Cómo actualizar el estado de las tareas

1. Editar este archivo cambiando el emoji de **Estado**.
2. En el commit, mencionar la tarea: `git commit -m "T-09: migrate SaleOrder to TransactionalDocument"`.
3. Para tareas bloqueadas, agregar nota: `**Blocked by:** T-XX o R-XX (ver migration-and-rollback.md)`.
4. Al cerrar una fase, mover el `🏁 GATE` a `✅ GATE` y dejar la fecha del merge.
