# 00 — Auditoría de Modularidad y Abstracción

> **Audiencia:** stakeholders técnicos, tech leads, arquitectos.
> **Pregunta que responde:** ¿Está la base actual preparada para "Generic Form Injection" y "Universal Registry"?
> **Veredicto:** parcialmente — 60% listo, 40% son tres deudas concretas.

---

## 0. Hallazgo de partida

El planteamiento original del análisis mencionaba "UUIDs" como Common Field a abstraer. **El codebase actual no usa UUIDs.** Todos los modelos heredan de `models.Model` con PK entera autogenerada. `uuid` solo aparece para nombres de archivo en [core/models.py:131](../../../backend/core/models.py#L131).

**Decisión:** un Universal Registry funciona perfectamente con `(ContentType.id, instance.pk)`. **No se migrará a UUIDs** — sería ruptura masiva con cero ROI sobre la inyectabilidad.

---

## 1. Análisis de Inyectabilidad

### 1.1 Lo que ya juega a favor

| Patrón presente | Dónde | Por qué importa |
|---|---|---|
| `ContentType` + `GenericForeignKey` ya en producción | [core/models.py:143-170](../../../backend/core/models.py#L143-L170) (`Attachment`) | El plumbing y migrations están resueltos |
| `GenericRelation` consumida | [billing/models.py:79](../../../backend/billing/models.py#L79), [inventory/models.py:168](../../../backend/inventory/models.py#L168), [production/models.py:123](../../../backend/production/models.py#L123) | El frontend ya lee `attachments` polimórficamente |
| `simple_history.HistoricalRecords()` consistente | 11 modelos | El audit trail es universal — `AuditHistoryMixin` en [core/mixins.py:47](../../../backend/core/mixins.py#L47) ya expone `/history/` genéricamente |
| `display_id` property con prefijo por entidad | `NV-`, `OCS-`, `OT-`, `AS-`, `FAC-`, `BOL-`, `C-`, `DES-`, `DEV-` | El Universal Search puede mostrar resultados sin lógica custom |
| `Status.TextChoices` con DRAFT/CONFIRMED/CANCELLED como base recurrente | `SaleOrder`, `PurchaseOrder`, `JournalEntry`, `SaleDelivery`, `SaleReturn`, `Invoice`, `WorkOrder`, `FiscalYear` | Un `StatusBadge` genérico ya funciona (regla #7 de CLAUDE.md lo asume) |
| Singletons con `get_solo()` + Redis | [accounting/models.py:965](../../../backend/accounting/models.py#L965), [core/models.py:98](../../../backend/core/models.py#L98), [sales/models.py:315](../../../backend/sales/models.py#L315) | Patrón unificado para `*Settings` |
| `services.py` por app ya creado | 11 apps | El esqueleto para Service Layer polimórfica YA existe — falta orquestación |

### 1.2 Lo que está roto para inyectabilidad

#### 1.2.1 No hay `BaseModel` abstracto

Cada modelo redefine `created_at`, `updated_at`, `notes`, `history` desde cero. El frontend no puede asumir qué campos universales existen.

**Inconsistencias detectadas:**

| Modelo | `created_at`/`updated_at` | `decimal_places` en `total` |
|--------|---------------------------|-----------------------------|
| `SaleOrder` | ✅ | 2 |
| `PurchaseOrder` | ✅ | 0 |
| `Invoice` | ✅ | 0 |
| `TreasuryMovement` | ❌ (solo `date`) | 2 |
| `Account`, `JournalItem`, `BudgetItem` | ❌ | n/a |
| `*Settings` | ❌ | n/a |
| `ActionLog` | solo `timestamp` | n/a |

**Impacto:** auditorías financieras requieren reglas distintas por modelo, y el form genérico no puede mostrar "última modificación" universalmente.

#### 1.2.2 Lógica de negocio dentro de `Model.save()` y `Model.clean()`

Esto **rompe** un formulario genérico porque el form no sabe qué efectos secundarios va a disparar.

| Ubicación | Side-effect |
|-----------|-------------|
| [contacts/models.py:142-162](../../../backend/contacts/models.py#L142-L162) | `Contact.save` crea hasta **4 cuentas contables** automáticamente cuando `is_partner=True` |
| [accounting/models.py:161-241](../../../backend/accounting/models.py#L161-L241) | `Account.save` regenera código jerárquicamente, propaga cambios a hijos, valida contra singleton |
| [accounting/models.py:299-361](../../../backend/accounting/models.py#L299-L361) | `JournalEntry.save` resuelve `AccountingPeriod`, bloquea ediciones en periodos cerrados, autonumera, invalida cache |
| [accounting/models.py:921-963](../../../backend/accounting/models.py#L921-L963) | `AccountingSettings.save` cascadea regeneración a todas las cuentas raíz si cambia separador o prefijo |
| [core/models.py:79-96](../../../backend/core/models.py#L79-L96) | `CompanySettings.save` jala datos del Contact si está vinculado |

**Impacto:** un form genérico que llama `serializer.save()` no puede ser sorprendido con creación de filas en otra app.

#### 1.2.3 Polimorfismo implícito por campo discriminador, sin Strategy

Este es el **mayor obstáculo** para la visión "Universal".

| Modelo | Discriminador | Cardinalidad efectiva |
|--------|---------------|----------------------|
| `Invoice` | `dte_type` | 8 valores controlan validación, prefijo, código SII, semántica de `corrected_invoice` |
| `Product` | `product_type` | 5 valores activan/desactivan ~25 campos `mfg_*`, recurrencia, valoración |
| `TreasuryMovement` | `Type × Method × JustifyReason` | 4×7×14 combinaciones (~20 válidas), reglas dispersas |
| `TotalsCalculationMixin` | `self.__class__.__name__` | Antipatrón puro: `if name in ['SaleOrder', 'SaleDelivery', 'DraftCart']` ([core/mixins.py:71-72](../../../backend/core/mixins.py#L71-L72)) |
| `BaseNoteService.create_document_note` | `isinstance(order, SaleOrder)` | Mismo antipatrón ([core/services.py:73-77](../../../backend/core/services.py#L73-L77)) |
| `WorkOrder.stage_data` | JSONField sin schema | Admisión de que el modelo relacional no daba abasto |

#### 1.2.4 Auto-numeración heterogénea

`SequenceService.get_next_number` ([core/services.py:5](../../../backend/core/services.py#L5)) es centralizado, pero conviven con:
- `Account.save` con su propia lógica de numeración por jerarquía
- `JournalEntry.save` con autonumeración custom inline ([accounting/models.py:348-357](../../../backend/accounting/models.py#L348-L357))
- `Contact.save` que usa `SequenceService` con `field_name='code'`

**Impacto:** el form genérico debe declarar `number`/`code`/`internal_code` como `system-generated` sin excepciones.

#### 1.2.5 Validación cross-row no expresable en metadatos solos

| Restricción | Ubicación |
|-------------|-----------|
| Balance del asiento (debe = haber) | [accounting/models.py:292-297](../../../backend/accounting/models.py#L292-L297) |
| `tax_rate` consistente entre líneas | [core/mixins.py:86-89](../../../backend/core/mixins.py#L86-L89) |
| `Account.is_selectable` — solo cuentas hoja en `JournalItem` | [accounting/models.py:47](../../../backend/accounting/models.py#L47) |

**Impacto:** estos invariantes requieren Service Layer; no son expresables en JSON schema.

---

## 2. Puntos de Fallo — Modelos que romperán el form genérico

### 2.1 🔴 Bloqueantes — formulario especializado siempre

| # | Modelo | Razón |
|---|--------|-------|
| 1 | **`Account`** ([accounting/models.py:39](../../../backend/accounting/models.py#L39)) | Jerárquico con `parent` self-FK + cascada de códigos + 4 categorías de reporting heredadas + invariante de profundidad máxima desde singleton. No hay metadata schema que capture esto sin ramas if/else. |
| 2 | **`JournalEntry` + `JournalItem`** ([accounting/models.py:243](../../../backend/accounting/models.py#L243), [469](../../../backend/accounting/models.py#L469)) | Doble partida es un invariante multi-fila. Periodo cerrado es un guard contextual. Selección de cuenta depende de `is_selectable`. |
| 3 | **`Product` (cuando `product_type=MANUFACTURABLE`)** ([inventory/models.py:107](../../../backend/inventory/models.py#L107)) | 5 tipos × 25 flags `mfg_*` × campos de suscripción × variantes. El comentario `MANUFACTURABLE_CUSTOM (DEPRECATED)` en línea 171-176 confirma que ya se intentó resolver y se retrocedió. |
| 4 | **`Contact` (cuando `is_partner=True`)** ([contacts/models.py:17](../../../backend/contacts/models.py#L17)) | 50+ properties computadas para socios, side-effects en save (creación de cuentas), 8 FK a `Account`. El "form de Contact" en realidad es 3 forms: cliente, proveedor, socio. |

### 2.2 🟡 Dificultosos — funcionarán con metadatos avanzados

| # | Modelo | Requisito del form genérico |
|---|--------|----------------------------|
| 5 | `SaleOrder` / `PurchaseOrder` / `SaleDelivery` / `SaleReturn` | Cabecera + líneas: el JSON debe expresar **child collections**, y el cálculo de totales tiene rama Gross/Net |
| 6 | `Invoice` ([billing/models.py:14](../../../backend/billing/models.py#L14)) | `dte_type` cambia campos requeridos (boletas no tienen Razón Social, NC requieren `corrected_invoice`, PURCHASE_INV requiere `purchase_order`) — necesita schema condicional |
| 7 | `TreasuryMovement` ([treasury/models.py:76](../../../backend/treasury/models.py#L76)) | 3 dimensiones ortogonales: campos visibles dependen de `Type` |
| 8 | `WorkOrder` ([production/models.py:11](../../../backend/production/models.py#L11)) | `stage_data: JSONField` necesita sub-schema por `current_stage` |

### 2.3 🟢 Inyectables casi sin trabajo (pilotos recomendados)

`Budget`, `BudgetItem`, `ActionLog`, `Attachment`, `UoM`, `UoMCategory`, `ProductCategory`, `ProductAttribute`, `ProductAttributeValue`, todos los `*Settings`.

**Recomendación:** usa estos modelos como **pilotos** del form genérico antes de tocar los transaccionales.

---

## 3. Propuesta de Refactorización por Patrón

> Detalle de implementación en [30-patterns.md](30-patterns.md). Aquí solo el racional.

### 3.1 P-01: BaseModel abstracto (prerequisito de todo)

Crear en `core/models.py`:
- `TimeStampedModel` — `created_at` + `updated_at`
- `AuditedModel(TimeStampedModel)` — agrega `history = HistoricalRecords(inherit=True)`
- `TransactionalDocument(AuditedModel)` — `number`, `status`, `notes`, `journal_entry`, `total_net`/`total_tax`/`total`

Migrar a `TransactionalDocument`: `SaleOrder`, `PurchaseOrder`, `Invoice`, `SaleDelivery`, `SaleReturn`, `JournalEntry`. **No es migración destructiva** — los campos ya existen, solo cambia herencia.

### 3.2 P-02: Strategy Pattern — tres lugares concretos

| Strategy | Reemplaza | Prioridad |
|----------|-----------|-----------|
| `TotalsStrategy` (`GrossFirstTotals`, `NetFirstTotals`) | `TotalsCalculationMixin.recalculate_totals` con `__class__.__name__` check | Alta — deuda visible, test fácil |
| `DTEStrategy` (una por tipo) | Pirámide de `if dte_type == ...` en `services.py` y `display_id` | Media — alto acoplamiento al SII |
| `ProductTypeStrategy` | 25 flags `mfg_*` planos en `Product` | Baja — refactor riesgoso, hacer último |

### 3.3 P-03: GenericForeignKey selectivo

**SÍ aplicar GFK:**
- `JournalEntry.source_document` (reemplaza los 60 líneas de `try/hasattr` en [accounting/models.py:368-433](../../../backend/accounting/models.py#L368-L433))
- `TreasuryMovement.allocated_to` (reemplaza FKs separados a `invoice`, `sale_order`, `purchase_order`, `payroll`)
- `Invoice.source_order` (reemplaza el XOR `sale_order` / `purchase_order`)

**NO aplicar GFK** (mantener FK explícita):
- `JournalItem.account` — integridad crítica
- `Contact.account_*` — modelo contable estable
- `SaleLine.product` — performance de query
- `SaleOrder.customer` / `PurchaseOrder.supplier` — siempre `Contact`, GFK degrada `select_related`

**Heurística:** GFK cuando el conjunto de tipos crece con el tiempo, o medio campo siempre es null.

### 3.4 P-04: Service Layer polimórfica + DocumentRegistry

```python
class DocumentService(ABC):
    @abstractmethod
    def confirm(self, document, *, user) -> JournalEntry: ...
    @abstractmethod
    def cancel(self, document, *, user, reason) -> None: ...
    @abstractmethod
    def get_metadata(self) -> dict: ...

class DocumentRegistry: ...  # registra por model._meta.label
```

Endpoint único `/api/documents/<content_type_id>/<id>/confirm/`. Detalle en [30-patterns.md](30-patterns.md#p-04-document-service).

### 3.5 P-05: UniversalRegistry (búsqueda)

```python
@dataclass(frozen=True)
class SearchableEntity:
    model: type[Model]
    label: str
    icon: str
    search_fields: tuple[str, ...]
    display_template: str
    ...
```

Registro en `apps.py::ready()` por app. Backed por `Q.icontains` hasta ~20 entidades; luego migrar a `tsvector` PostgreSQL o `django-watson`.

### 3.6 P-06: Metadata Schema endpoint

`GET /api/registry/<model_label>/schema/` retorna JSON con `fields`, `ui_layout`, `actions`, `permissions`, `transitions`, `conditional_fields`. **90% se introspecciona automáticamente** desde `Model._meta.get_fields()`. El resto se declara en `class FormMeta:` por modelo.

Schema completo en [30-patterns.md#p-06-metadata-schema](30-patterns.md#p-06-metadata-schema).

---

## 4. Síntesis ejecutiva

- **La arquitectura tiene 60% de lo necesario.** Servicios por app, `simple_history` universal, `GenericRelation` ya en uso, `display_id` consistente, status choices recurrentes.
- **El 40% restante son tres deudas concretas:** falta de `BaseModel`, polimorfismo con `if class.__name__`, side-effects en `save()`.
- **No hay que migrar a UUIDs ni reescribir accounting/contacts.** Solo extraer convenciones implícitas a clases abstractas explícitas.
- **El verdadero límite del form genérico es conceptual, no técnico.** `Account`, `JournalEntry`, `Product (manufacturable)` y `WorkOrder.stage_data` representan tipos diferentes de complejidad que merecen formularios especializados. **Aceptar esto temprano** evita un "framework genérico que termina haciendo todo mal".

---

## 5. Recomendación de orden

Ver [10-roadmap.md](10-roadmap.md) para el plan de fases. La recomendación corta:

1. Empezar por **`UniversalRegistry`** (Fase 1) — bajo riesgo, valor visible, no toca modelos.
2. En paralelo, planificar la migración a **`BaseModel` abstracto** (Fase 2) — habilita todo lo demás.
3. **No** abordar Strategy ni GFK hasta tener Fase 1+2 estables y con tests.
