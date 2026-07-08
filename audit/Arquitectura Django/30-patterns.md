# 30 — Guía de Implementación de Patrones

> **Audiencia:** ingenieros ejecutando tareas concretas.
> **Pregunta que responde:** ¿Cómo se implementa cada patrón propuesto, con código real?
> **Convención:** Cada patrón tiene ID `P-NN`. Los snippets están listos para adaptar; contrasta con los archivos referenciados antes de copiar.

---

## Índice de patrones

| ID | Patrón | Fase | Tareas |
|----|--------|------|--------|
| [P-01](#p-01-basemodel) | BaseModel abstractos | F2 | T-08..T-15 |
| [P-02](#p-02-strategy-pattern) | Strategy Pattern (Totals, DTE, ProductType) | F3, F5 | T-16..T-21, T-44..T-49 |
| [P-03](#p-03-generic-foreignkey) | GenericForeignKey selectivo | F5 | T-41..T-43 |
| [P-04](#p-04-document-service) | DocumentService + DocumentRegistry | F4 | T-26..T-29 |
| [P-05](#p-05-universal-registry) | UniversalRegistry (búsqueda) | F1 | T-01..T-03 |
| [P-06](#p-06-metadata-schema) | Metadata Schema endpoint | F4 | T-30..T-32 |

---

## P-01 · BaseModel

### Problema actual

Cada modelo redefine `created_at`/`updated_at`/`history` desde cero. Inconsistencias en `decimal_places`. Sin `AbstractBaseUser`-style abstracción para documentos transaccionales.

### Diseño

Tres niveles abstractos en `core/models/abstracts.py`:

```python
# backend/core/models/abstracts.py
from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class TimeStampedModel(models.Model):
    """Cualquier entidad que necesite saber cuándo se creó/modificó."""
    created_at = models.DateTimeField(_("Creado el"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Actualizado el"), auto_now=True)

    class Meta:
        abstract = True


class AuditedModel(TimeStampedModel):
    """Entidad con historial completo (simple_history). Hereda timestamps."""
    history = HistoricalRecords(inherit=True)

    class Meta:
        abstract = True


class TransactionalDocument(AuditedModel):
    """
    Cabecera de documento de negocio: número, estado, totales, journal entry.
    Usar para: SaleOrder, PurchaseOrder, Invoice, SaleDelivery, SaleReturn.
    NO usar para JournalEntry (no encaja totals_*).
    """
    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False)
    status = models.CharField(_("Estado"), max_length=20)  # subclase define choices
    notes = models.TextField(_("Notas"), blank=True)
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='+',
    )
    total_net = models.DecimalField(_("Neto"), max_digits=14, decimal_places=2, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(_("Total"), max_digits=14, decimal_places=2, default=0)

    class Meta:
        abstract = True
        ordering = ['-id']
```

### Cómo migrar un modelo concreto

**Antes:**
```python
class SaleOrder(models.Model, TotalsCalculationMixin):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        ...
    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False)
    customer = models.ForeignKey('contacts.Contact', on_delete=models.PROTECT, related_name='sale_orders')
    date = models.DateField(_("Fecha"), default=get_current_date)
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(_("Notas"), blank=True)
    total_net = models.DecimalField(_("Neto"), max_digits=12, decimal_places=2, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(_("Total"), max_digits=12, decimal_places=2, default=0)
    journal_entry = models.OneToOneField(...)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()
    # ... resto de campos específicos
```

**Después:**
```python
from core.models.abstracts import TransactionalDocument

class SaleOrder(TransactionalDocument, TotalsCalculationMixin):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        ...
    # No redeclarar: number, status (solo override choices), notes, journal_entry,
    # total_net, total_tax, total, created_at, updated_at, history.
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    customer = models.ForeignKey('contacts.Contact', on_delete=models.PROTECT, related_name='sale_orders')
    date = models.DateField(_("Fecha"), default=get_current_date)
    # ... resto de campos específicos
```

### Gotchas

- **`simple_history` con `inherit=True`** crea una `HistoricalSaleOrder` automáticamente. Verificar que no se duplique generando dos veces.
- **Override de `journal_entry.related_name`**: el abstracto usa `'+'` para evitar colisión. Si la subclase necesita reverso (ej: `journal_entry.sale_order`), redefinir el campo.
- **`number` con `unique=True`** en abstracta: `Invoice.number` no es unique en la DB actual (puede haber misma serie en diferentes `dte_type`). Para `Invoice`, **no heredar de `TransactionalDocument` directamente** o redefinir `number = models.CharField(..., unique=False)` con un `unique_together = [('number', 'dte_type')]`.

### Tests requeridos

```python
def test_transactional_document_provides_universal_fields():
    order = SaleOrderFactory()
    assert hasattr(order, 'created_at')
    assert hasattr(order, 'updated_at')
    assert hasattr(order, 'number')
    assert hasattr(order, 'status')
    assert hasattr(order, 'total')
    assert order.history.count() >= 1
```

---

## P-02 · Strategy Pattern

### P-02.A · TotalsStrategy

#### Problema actual

[core/mixins.py:71-72](../../../backend/core/mixins.py#L71-L72):
```python
is_sales = self.__class__.__name__ in ['SaleOrder', 'SaleDelivery', 'DraftCart']
```

Antipatrón puro. Si agregas `SaleQuotation`, hay que recordar editar la lista. La regla está fuera del modelo.

#### Diseño

```python
# backend/core/strategies/totals.py
from abc import ABC, abstractmethod
from decimal import Decimal


class TotalsStrategy(ABC):
    """Estrategia de cálculo de totales para documentos cabecera+líneas."""

    @abstractmethod
    def compute(self, document) -> dict:
        """
        Recibe un documento con `lines` reverse manager. Calcula y persiste:
            total_net, total_tax, total
        Retorna dict con los valores calculados.
        """
        ...


class GrossFirstTotals(TotalsStrategy):
    """
    Para SaleOrder, SaleDelivery, DraftCart.
    Las líneas vienen con precio bruto; se extrae el neto/IVA.
    """
    def compute(self, doc) -> dict:
        total_sum = Decimal('0.00')
        tax_rate = Decimal('19.00')
        for line in doc.lines.all():
            if hasattr(line, 'calculate_subtotal'):
                line.calculate_subtotal()
            total_sum += getattr(line, 'subtotal', Decimal('0.00'))
            tax_rate = getattr(line, 'tax_rate', tax_rate)

        total_discount = getattr(doc, 'total_discount_amount', Decimal('0.00'))
        doc.total = max(Decimal('0'), total_sum - total_discount)
        net = doc.total / (Decimal('1') + tax_rate / Decimal('100'))
        doc.total_net = net.quantize(Decimal('1'), rounding='ROUND_HALF_UP')
        doc.total_tax = doc.total - doc.total_net

        doc.save(update_fields=['total_net', 'total_tax', 'total'])
        return {'net': doc.total_net, 'tax': doc.total_tax, 'total': doc.total}


class NetFirstTotals(TotalsStrategy):
    """
    Para PurchaseOrder, etc.
    Las líneas vienen con precio neto; se calcula IVA encima.
    """
    def compute(self, doc) -> dict:
        total_sum = Decimal('0.00')
        tax_rate = Decimal('19.00')
        for line in doc.lines.all():
            if hasattr(line, 'calculate_subtotal'):
                line.calculate_subtotal()
            total_sum += getattr(line, 'subtotal', Decimal('0.00'))
            tax_rate = getattr(line, 'tax_rate', tax_rate)

        doc.total_net = total_sum
        tax = doc.total_net * (tax_rate / Decimal('100'))
        doc.total_tax = tax.quantize(Decimal('1'), rounding='ROUND_HALF_UP')
        doc.total = doc.total_net + doc.total_tax

        doc.save(update_fields=['total_net', 'total_tax', 'total'])
        return {'net': doc.total_net, 'tax': doc.total_tax, 'total': doc.total}
```

#### Wiring

```python
# Cada modelo declara su strategy como atributo de clase:
class SaleOrder(TransactionalDocument):
    totals_strategy = GrossFirstTotals
    # ...

class PurchaseOrder(TransactionalDocument):
    totals_strategy = NetFirstTotals
    # ...

# El mixin queda mucho más simple:
class TotalsCalculationMixin:
    def recalculate_totals(self) -> dict:
        return self.totals_strategy().compute(self)
```

### P-02.B · DTEStrategy

#### Problema actual

`Invoice.dte_type` (8 valores) controla validación, prefijo display, código SII, semántica del documento. Hoy disperso en `display_id` ([billing/models.py:142-152](../../../backend/billing/models.py#L142-L152)) y en `services.py` con cadenas de `if`.

#### Diseño

```python
# backend/billing/strategies/dte.py
from abc import ABC, abstractmethod
from decimal import Decimal


class DTEStrategy(ABC):
    """Estrategia por tipo de documento tributario electrónico (Chile)."""

    sii_code: int  # ej: 33 para Factura
    display_prefix: str  # ej: 'FAC'
    is_tax_exempt: bool = False
    requires_corrected_invoice: bool = False  # NC/ND requieren documento original

    @abstractmethod
    def expected_fields(self) -> list[str]:
        """Campos que el form debe pedir para este tipo (drives metadata schema)."""
        ...

    @abstractmethod
    def validate(self, invoice) -> None:
        """Valida invariantes pre-POSTED. Lanza ValidationError si falla."""
        ...

    @abstractmethod
    def make_journal_entry(self, invoice) -> 'JournalEntry':
        """Genera el asiento contable correspondiente."""
        ...

    def display_id(self, invoice) -> str:
        return f"{self.display_prefix}-{invoice.number or 'Draft'}"


class FacturaStrategy(DTEStrategy):
    sii_code = 33
    display_prefix = 'FAC'

    def expected_fields(self) -> list[str]:
        return ['contact', 'date', 'total_net', 'total_tax', 'total', 'sale_order_or_purchase_order']

    def validate(self, invoice) -> None:
        if not invoice.contact:
            raise ValidationError("Factura requiere Contact (Razón Social).")
        if invoice.total_tax <= 0:
            raise ValidationError("Factura afecta requiere IVA.")

    def make_journal_entry(self, invoice):
        # Lógica actual de billing/services.py para Factura, encapsulada aquí.
        ...


class BoletaStrategy(DTEStrategy):
    sii_code = 39
    display_prefix = 'BOL'

    def expected_fields(self) -> list[str]:
        return ['date', 'total', 'payment_method']  # boleta no requiere contact

    def validate(self, invoice) -> None:
        # Boletas pueden no tener contact (consumidor final).
        pass

    def make_journal_entry(self, invoice):
        ...


class NotaCreditoStrategy(DTEStrategy):
    sii_code = 61
    display_prefix = 'NC'
    requires_corrected_invoice = True

    def expected_fields(self) -> list[str]:
        return ['contact', 'date', 'corrected_invoice', 'total_net', 'total_tax', 'reason']

    def validate(self, invoice) -> None:
        if not invoice.corrected_invoice:
            raise ValidationError("NC requiere documento original (corrected_invoice).")

    def make_journal_entry(self, invoice):
        # Asiento inverso al original.
        ...


# Registry para resolver strategy por tipo:
DTE_STRATEGIES: dict[str, DTEStrategy] = {
    'FACTURA': FacturaStrategy(),
    'FACTURA_EXENTA': FacturaExentaStrategy(),
    'BOLETA': BoletaStrategy(),
    'BOLETA_EXENTA': BoletaExentaStrategy(),
    'PURCHASE_INV': PurchaseInvoiceStrategy(),
    'NOTA_CREDITO': NotaCreditoStrategy(),
    'NOTA_DEBITO': NotaDebitoStrategy(),
    'COMPROBANTE_PAGO': ComprobantePagoStrategy(),
}


def get_strategy(dte_type: str) -> DTEStrategy:
    return DTE_STRATEGIES[dte_type]
```

#### Refactor de `Invoice`

```python
class Invoice(TransactionalDocument):
    @property
    def strategy(self) -> DTEStrategy:
        return get_strategy(self.dte_type)

    @property
    def display_id(self) -> str:
        return self.strategy.display_id(self)

    @property
    def sii_code(self) -> int:
        return self.strategy.sii_code

    @property
    def is_tax_exempt(self) -> bool:
        return self.strategy.is_tax_exempt
```

### P-02.C · ProductTypeStrategy (F5)

Mismo patrón aplicado a `Product.product_type`. Ver T-44..T-49.

---

## P-03 · GenericForeignKey selectivo

### Cuándo SÍ aplicar (heurística)

- El conjunto de tipos crece con el tiempo (nuevos `JournalEntry.source_document`, nuevos `TreasuryMovement.allocated_to`).
- Medio campo siempre es `null` por diseño (XOR de `Invoice.sale_order` / `Invoice.purchase_order`).

### Cuándo NO aplicar

- FK siempre apunta al mismo modelo (`SaleOrder.customer → Contact` siempre).
- Performance crítica con `select_related` (GFK no soporta select_related cross-type).
- Integridad referencial estricta requerida (no podemos perder referencias huérfanas).

### Patrón aplicado: `JournalEntry.source_document`

#### Antes ([accounting/models.py:368-433](../../../backend/accounting/models.py#L368-L433))

```python
@property
def get_source_documents(self):
    docs = []
    try:
        if hasattr(self, 'invoice') and self.invoice:
            docs.append({'type': 'invoice', 'id': self.invoice.id, ...})
    except (ObjectDoesNotExist, AttributeError):
        pass

    try:
        if hasattr(self, 'payment') and self.payment:
            docs.append({'type': 'payment', ...})
    except (ObjectDoesNotExist, AttributeError):
        pass

    # ... 6 más bloques try/except idénticos
```

#### Después

```python
# accounting/models.py
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class JournalEntry(AuditedModel):
    # ... campos existentes ...
    source_content_type = models.ForeignKey(
        ContentType, null=True, blank=True, on_delete=models.SET_NULL
    )
    source_object_id = models.PositiveIntegerField(null=True, blank=True)
    source_document = GenericForeignKey('source_content_type', 'source_object_id')

    @property
    def get_source_document(self):
        return self.source_document

    @property
    def source_info(self) -> dict | None:
        if not self.source_document:
            return None
        from core.registry import UniversalRegistry
        entity = UniversalRegistry.get_for_model(type(self.source_document))
        return {
            'type': entity.label,
            'id': self.source_document.pk,
            'name': str(self.source_document),
            'url': entity.detail_url_pattern.format(id=self.source_document.pk),
        }
```

#### Migración de datos

```python
# accounting/migrations/00XX_journal_entry_gfk_source.py
from django.db import migrations
from django.contrib.contenttypes.models import ContentType


def forwards(apps, schema_editor):
    JournalEntry = apps.get_model('accounting', 'JournalEntry')
    Invoice = apps.get_model('billing', 'Invoice')
    TreasuryMovement = apps.get_model('treasury', 'TreasuryMovement')
    SaleOrder = apps.get_model('sales', 'SaleOrder')
    PurchaseOrder = apps.get_model('purchasing', 'PurchaseOrder')

    invoice_ct = ContentType.objects.get_for_model(Invoice)
    treasury_ct = ContentType.objects.get_for_model(TreasuryMovement)
    sale_ct = ContentType.objects.get_for_model(SaleOrder)
    purchase_ct = ContentType.objects.get_for_model(PurchaseOrder)

    # Recorrer relaciones inversas existentes
    for inv in Invoice.objects.exclude(journal_entry__isnull=True):
        je = inv.journal_entry
        je.source_content_type_id = invoice_ct.id
        je.source_object_id = inv.id
        je.save(update_fields=['source_content_type', 'source_object_id'])

    for mov in TreasuryMovement.objects.exclude(journal_entry__isnull=True):
        je = mov.journal_entry
        je.source_content_type_id = treasury_ct.id
        je.source_object_id = mov.id
        je.save(update_fields=['source_content_type', 'source_object_id'])

    # ... idem para SaleOrder, PurchaseOrder, StockMove


def backwards(apps, schema_editor):
    JournalEntry = apps.get_model('accounting', 'JournalEntry')
    JournalEntry.objects.update(source_content_type=None, source_object_id=None)


class Migration(migrations.Migration):
    dependencies = [('accounting', '00XX_previous')]
    operations = [migrations.RunPython(forwards, backwards)]
```

#### Verificación post-migración

```python
# tests de migración
def test_all_journal_entries_have_source_document_after_migration():
    # Excepto entries sistema (cierre fiscal, apertura)
    orphans = JournalEntry.objects.filter(
        source_content_type__isnull=True,
        fiscal_year_closing__isnull=True,
        fiscal_year_opening__isnull=True,
    ).count()
    assert orphans == 0, f"Found {orphans} orphan journal entries"
```

---

## P-04 · Document Service

### Diseño

```python
# backend/core/services/document.py
from abc import ABC, abstractmethod
from typing import ClassVar


class DocumentService(ABC):
    """Servicio polimórfico para procesar cualquier documento transaccional."""

    @abstractmethod
    def confirm(self, document, *, user) -> 'JournalEntry':
        """Confirma el documento (DRAFT → CONFIRMED). Genera asiento."""
        ...

    @abstractmethod
    def cancel(self, document, *, user, reason: str = '') -> None:
        """Anula el documento. Genera asiento de reverso si aplica."""
        ...

    def get_metadata(self) -> dict:
        """Override opcional para extender el schema (ver P-06)."""
        return {}


class DocumentRegistry:
    _services: ClassVar[dict[str, type[DocumentService]]] = {}

    @classmethod
    def register(cls, model_label: str):
        def decorator(service_cls):
            cls._services[model_label.lower()] = service_cls
            return service_cls
        return decorator

    @classmethod
    def for_instance(cls, instance) -> DocumentService:
        label = instance._meta.label_lower
        try:
            return cls._services[label]()
        except KeyError:
            raise NotImplementedError(f"No DocumentService registered for {label}")

    @classmethod
    def for_label(cls, label: str) -> DocumentService:
        return cls._services[label.lower()]()
```

### Uso

```python
# sales/services.py
from core.services.document import DocumentService, DocumentRegistry


@DocumentRegistry.register('sales.saleorder')
class SaleOrderService(DocumentService):
    def confirm(self, order, *, user):
        # Mover aquí la lógica que hoy vive en sales/views.py o en SaleOrder.save
        order.totals_strategy().compute(order)
        order.status = order.Status.CONFIRMED
        # Generar journal entry...
        order.save()
        return order.journal_entry

    def cancel(self, order, *, user, reason=''):
        # ...
        order.status = order.Status.CANCELLED
        order.notes += f"\nAnulado: {reason}"
        order.save()
```

### Endpoint genérico

```python
# core/api/document.py
from django.contrib.contenttypes.models import ContentType
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.services.document import DocumentRegistry


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def document_action(request, content_type_id: int, object_id: int, action: str):
    ct = ContentType.objects.get(id=content_type_id)
    instance = ct.get_object_for_this_type(pk=object_id)

    perm = f"{ct.app_label}.change_{ct.model}"
    if not request.user.has_perm(perm, instance):
        return Response({'error': 'Permission denied'}, status=403)

    service = DocumentRegistry.for_instance(instance)
    method = getattr(service, action, None)
    if not callable(method):
        return Response({'error': f'Unknown action: {action}'}, status=400)

    try:
        result = method(instance, user=request.user, **request.data)
        return Response({'ok': True, 'result_id': getattr(result, 'pk', None)})
    except ValidationError as e:
        return Response({'error': str(e)}, status=400)
```

### URL

```python
# core/urls.py
path('api/documents/<int:content_type_id>/<int:object_id>/<str:action>/', document_action),
```

### Ventajas

- **Un solo endpoint** para `confirm`, `cancel`, `recalculate`, etc.
- **El frontend no necesita saber** qué app expone qué acción.
- **Permisos centralizados** y consistentes.

---

## P-05 · Universal Registry

### Diseño

```python
# backend/core/registry.py
from dataclasses import dataclass, field
from typing import ClassVar
from django.db import models
from django.db.models import Q


@dataclass(frozen=True)
class SearchableEntity:
    model: type[models.Model]
    label: str                          # 'sales.saleorder'
    icon: str                           # nombre Lucide
    search_fields: tuple[str, ...]      # ('number', 'customer__name', ...)
    display_template: str               # 'NV-{number} · {customer.name}'
    list_url: str                       # '/sales/orders'
    detail_url_pattern: str             # '/sales/orders/{id}'
    permission: str | None = None       # 'sales.view_saleorder'
    extra_filters: dict = field(default_factory=dict)


class UniversalRegistry:
    _entities: ClassVar[dict[str, SearchableEntity]] = {}
    _by_model: ClassVar[dict[type[models.Model], SearchableEntity]] = {}

    @classmethod
    def register(cls, entity: SearchableEntity) -> None:
        cls._entities[entity.label] = entity
        cls._by_model[entity.model] = entity

    @classmethod
    def get(cls, label: str) -> SearchableEntity | None:
        return cls._entities.get(label)

    @classmethod
    def get_for_model(cls, model: type[models.Model]) -> SearchableEntity | None:
        return cls._by_model.get(model)

    @classmethod
    def search(cls, query: str, *, user, limit: int = 20) -> list[dict]:
        results: list[dict] = []
        if not query or len(query) < 2:
            return results

        for entity in cls._entities.values():
            if entity.permission and not user.has_perm(entity.permission):
                continue

            q = Q()
            for field_path in entity.search_fields:
                q |= Q(**{f"{field_path}__icontains": query})

            qs = entity.model.objects.filter(q, **entity.extra_filters)[:limit]
            for obj in qs:
                try:
                    display = cls._render(entity.display_template, obj)
                except Exception:
                    display = str(obj)
                results.append({
                    'label': entity.label,
                    'icon': entity.icon,
                    'display': display,
                    'url': entity.detail_url_pattern.format(id=obj.pk),
                })
                if len(results) >= limit:
                    return results

        return results

    @staticmethod
    def _render(template: str, obj) -> str:
        """Resolve dotted attributes in template: '{customer.name}'."""
        import re
        def replace(m):
            path = m.group(1)
            value = obj
            for part in path.split('.'):
                value = getattr(value, part, '')
                if value is None:
                    return ''
            return str(value)
        return re.sub(r'\{([^}]+)\}', replace, template)
```

### Registro en `apps.py::ready()`

```python
# backend/sales/apps.py
from django.apps import AppConfig


class SalesConfig(AppConfig):
    name = 'sales'

    def ready(self):
        from core.registry import UniversalRegistry, SearchableEntity
        from .models import SaleOrder, SaleDelivery, SaleReturn

        UniversalRegistry.register(SearchableEntity(
            model=SaleOrder,
            label='sales.saleorder',
            icon='receipt-text',
            search_fields=('number', 'customer__name', 'customer__tax_id'),
            display_template='NV-{number} · {customer.name}',
            list_url='/sales/orders',
            detail_url_pattern='/sales/orders/{id}',
            permission='sales.view_saleorder',
        ))

        UniversalRegistry.register(SearchableEntity(
            model=SaleDelivery,
            label='sales.saledelivery',
            icon='truck',
            search_fields=('number', 'sale_order__number', 'sale_order__customer__name'),
            display_template='DES-{number} · NV-{sale_order.number}',
            list_url='/sales/deliveries',
            detail_url_pattern='/sales/deliveries/{id}',
            permission='sales.view_saledelivery',
        ))

        # ... etc
```

### Endpoint

```python
# backend/core/api/search.py
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.registry import UniversalRegistry


class SearchThrottle(UserRateThrottle):
    rate = '60/min'


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@throttle_classes([SearchThrottle])
def universal_search(request):
    q = request.GET.get('q', '').strip()
    limit = min(int(request.GET.get('limit', 20)), 50)
    results = UniversalRegistry.search(q, user=request.user, limit=limit)
    return Response({'results': results, 'count': len(results)})
```

### Performance

- Iteración con `Q.icontains` por modelo: OK hasta ~20 entidades + datasets <100k filas.
- Cuando degrade: migrar a PostgreSQL `tsvector` con un único índice invertido. **No optimizar prematuramente** — primero medir (T-06).

---

## P-06 · Metadata Schema

### Diseño del JSON

Schema completo en [00-audit-report.md §4](00-audit-report.md#4-síntesis-ejecutiva). Resumen:

```json
{
  "label": "sales.saleorder",
  "verbose_name": "Nota de Venta",
  "display_id_prefix": "NV-",
  "icon": "receipt-text",
  "search_fields": ["number", "customer.name"],
  "list_url": "/sales/orders",
  "ui_layout": {
    "tabs": [
      { "id": "main", "label": "General", "fields": ["customer", "date", "payment_method", "notes"] }
    ]
  },
  "fields": {
    "customer": {
      "type": "fk",
      "label": "Cliente",
      "target": "contacts.contact",
      "required": true,
      "search_endpoint": "/api/contacts/?q=",
      "display_field": "name"
    }
  },
  "actions": [
    { "id": "confirm", "method": "POST", "endpoint": "/api/documents/.../confirm/", "available_when": "status == 'DRAFT'" }
  ],
  "permissions": { "view": "sales.view_saleorder", "add": "sales.add_saleorder" }
}
```

### Generación: 90% introspección automática

```python
# backend/core/serializers/metadata.py
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey


def field_to_json(field) -> dict:
    """Convierte un Django field a su descriptor JSON."""
    base = {
        'label': str(field.verbose_name) if hasattr(field, 'verbose_name') else field.name,
        'help_text': str(field.help_text) if getattr(field, 'help_text', None) else '',
        'required': not field.blank if hasattr(field, 'blank') else True,
        'readonly': not field.editable if hasattr(field, 'editable') else False,
    }

    if isinstance(field, models.CharField) and field.choices:
        return {**base, 'type': 'enum', 'choices': [
            {'value': v, 'label': str(l)} for v, l in field.choices
        ]}
    if isinstance(field, models.CharField):
        return {**base, 'type': 'string', 'max_length': field.max_length}
    if isinstance(field, models.TextField):
        return {**base, 'type': 'text'}
    if isinstance(field, models.IntegerField):
        return {**base, 'type': 'integer'}
    if isinstance(field, models.DecimalField):
        return {**base, 'type': 'decimal',
                'max_digits': field.max_digits, 'decimal_places': field.decimal_places}
    if isinstance(field, models.BooleanField):
        return {**base, 'type': 'boolean'}
    if isinstance(field, models.DateField):
        return {**base, 'type': 'date'}
    if isinstance(field, models.DateTimeField):
        return {**base, 'type': 'datetime'}
    if isinstance(field, models.JSONField):
        return {**base, 'type': 'json'}
    if isinstance(field, models.ForeignKey):
        return {
            **base,
            'type': 'fk',
            'target': field.related_model._meta.label_lower,
            'limit_choices_to': field.remote_field.limit_choices_to or {},
        }
    if isinstance(field, models.ManyToManyField):
        return {**base, 'type': 'm2m', 'target': field.related_model._meta.label_lower}
    if isinstance(field, models.FileField):
        return {**base, 'type': 'image' if isinstance(field, models.ImageField) else 'file'}
    return {**base, 'type': 'unknown'}


def build_schema(model: type[models.Model], user=None) -> dict:
    from core.registry import UniversalRegistry

    entity = UniversalRegistry.get_for_model(model)
    form_meta = getattr(model, 'FormMeta', None)

    fields_dict = {}
    excluded = set(getattr(form_meta, 'exclude_fields', ()))
    for field in model._meta.get_fields():
        if isinstance(field, GenericForeignKey):
            continue  # GFK handled separately
        if field.name in excluded:
            continue
        if hasattr(field, 'attname'):  # excluye reverse relations
            fields_dict[field.name] = field_to_json(field)

    schema = {
        'label': model._meta.label_lower,
        'verbose_name': str(model._meta.verbose_name),
        'verbose_name_plural': str(model._meta.verbose_name_plural),
        'fields': fields_dict,
        'permissions': {
            'view': f'{model._meta.app_label}.view_{model._meta.model_name}',
            'add': f'{model._meta.app_label}.add_{model._meta.model_name}',
            'change': f'{model._meta.app_label}.change_{model._meta.model_name}',
            'delete': f'{model._meta.app_label}.delete_{model._meta.model_name}',
        },
    }

    if entity:
        schema.update({
            'icon': entity.icon,
            'list_url': entity.list_url,
            'detail_url_pattern': entity.detail_url_pattern,
        })

    if form_meta:
        schema['ui_layout'] = getattr(form_meta, 'ui_layout', {'tabs': [{'id': 'main', 'label': 'General', 'fields': list(fields_dict.keys())}]})
        schema['actions'] = getattr(form_meta, 'actions', [])
        schema['transitions'] = getattr(form_meta, 'transitions', {})

    return schema
```

### Declaración explícita en el modelo

```python
class SaleOrder(TransactionalDocument):
    # ... campos ...

    class FormMeta:
        exclude_fields = ('history',)
        ui_layout = {
            'tabs': [
                {'id': 'main', 'label': 'General', 'fields': ['customer', 'date', 'payment_method', 'notes']},
                {'id': 'lines', 'label': 'Productos', 'fields': ['lines']},
                {'id': 'delivery', 'label': 'Despacho', 'fields': ['delivery_status', 'delivery_date']},
            ]
        }
        transitions = {
            'DRAFT': ['CONFIRMED', 'CANCELLED'],
            'CONFIRMED': ['PAYMENT_PENDING', 'INVOICED', 'CANCELLED'],
            'PAYMENT_PENDING': ['INVOICED', 'CANCELLED'],
            'INVOICED': ['PAID', 'CANCELLED'],
        }
        actions = [
            {'id': 'confirm', 'label': 'Confirmar', 'available_when': 'status == "DRAFT"'},
            {'id': 'cancel', 'label': 'Anular', 'available_when': 'status != "CANCELLED"'},
        ]
```

### Endpoint

```python
# backend/core/api/registry.py
from django.apps import apps
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.serializers.metadata import build_schema


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def model_schema(request, model_label: str):
    cache_key = f"schema:{model_label}:{request.user.id}"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    try:
        app_label, model_name = model_label.split('.')
        model = apps.get_model(app_label, model_name)
    except (ValueError, LookupError):
        return Response({'error': 'Unknown model'}, status=404)

    perm = f"{app_label}.view_{model_name}"
    if not request.user.has_perm(perm):
        return Response({'error': 'Permission denied'}, status=403)

    schema = build_schema(model, user=request.user)
    cache.set(cache_key, schema, timeout=300)  # 5 min
    return Response(schema)
```

### Frontend `<EntityForm />` (esqueleto conceptual)

```tsx
// frontend/components/shared/EntityForm/index.tsx
import { useEntitySchema } from './hooks/useEntitySchema';
import { buildZodSchema } from './lib/buildZodSchema';
import { renderField } from './lib/renderField';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export function EntityForm({ modelLabel, instanceId, onSuccess }: Props) {
  const { schema, isLoading } = useEntitySchema(modelLabel);
  const zodSchema = useMemo(() => schema ? buildZodSchema(schema) : null, [schema]);

  const form = useForm({ resolver: zodSchema ? zodResolver(zodSchema) : undefined });

  if (isLoading || !schema) return <Skeleton />;

  return (
    <Tabs>
      {schema.ui_layout.tabs.map(tab => (
        <TabsContent key={tab.id} value={tab.id}>
          {tab.fields.map(name => renderField(name, schema.fields[name], form))}
        </TabsContent>
      ))}
      <Actions schema={schema} instance={instance} onSuccess={onSuccess} />
    </Tabs>
  );
}
```

---

## Cómo elegir qué patrón aplicar primero

```
¿Necesitas búsqueda universal sin tocar nada?
  → P-05 (UniversalRegistry) — empieza aquí
¿Cada modelo redefine timestamps/history desde cero?
  → P-01 (BaseModel) — antes de cualquier otro refactor
¿Hay if class.__name__ == 'X' o isinstance(x, X) en lógica?
  → P-02 (Strategy)
¿Hay try/hasattr/except para encontrar relación inversa?
  → P-03 (GenericFK)
¿El frontend hardcodea schemas que el backend ya conoce?
  → P-06 (Metadata Schema)
¿Querés un endpoint único para `confirm/cancel/...` sobre cualquier doc?
  → P-04 (DocumentService)
```
