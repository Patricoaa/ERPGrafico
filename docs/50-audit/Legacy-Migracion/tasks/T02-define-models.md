# T02 — Define 6 models

> **Phase**: 1
> **Tiempo estimado**: 60 min
> **Complejidad**: media

## Precondiciones

- [ ] T01 cerrada.

## Archivos a tocar/crear

- `backend/legacy/models.py` (los 6 modelos).

## Implementación

Ver `03-backend-models.md` para el detalle completo de cada modelo. Resumen aquí:

```python
# backend/legacy/models.py
from django.db import models
from django.conf import settings
from core.models.abstracts import TimeStampedModel


class ContactLegacyOrigin(TimeStampedModel):
    contact = models.OneToOneField('contacts.Contact', on_delete=models.CASCADE, related_name='legacy_origin')
    source_table = models.CharField(max_length=32, default='clientes')
    legacy_external_id = models.IntegerField()
    raw_tax_id = models.CharField(max_length=20)
    tax_id_exception = models.BooleanField(default=False)

    class Meta:
        unique_together = (('source_table', 'legacy_external_id'),)
        indexes = [models.Index(fields=['legacy_external_id'])]


class LegacyVendor(TimeStampedModel):
    INTERNAL = 'interno'
    EXTERNAL = 'externo'
    CATEGORY_CHOICES = [(INTERNAL, 'Interno'), (EXTERNAL, 'Externo')]

    legacy_external_id = models.IntegerField(unique=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=16, choices=CATEGORY_CHOICES, default=EXTERNAL)


class LegacySaleNote(TimeStampedModel):
    DRAFT = 'DRAFT'; CONFIRMED = 'CONFIRMED'; IN_PRODUCTION = 'IN_PRODUCTION'
    DISPATCHED = 'DISPATCHED'; PENDING = 'PENDING'; CANCELLED = 'CANCELLED'
    STATUS_CHOICES = [
        (DRAFT, 'Borrador'), (CONFIRMED, 'Confirmada'),
        (IN_PRODUCTION, 'En producción'), (DISPATCHED, 'Despachada'),
        (PENDING, 'Pendiente'), (CANCELLED, 'Anulada'),
    ]

    legacy_external_id = models.IntegerField(unique=True)
    legacy_number = models.CharField(max_length=20)
    issue_date = models.DateField()
    customer = models.ForeignKey('contacts.Contact', on_delete=models.PROTECT, related_name='legacy_sale_notes')
    related_contact = models.ForeignKey('contacts.Contact', on_delete=models.PROTECT, null=True, blank=True, related_name='legacy_sale_notes_as_related')
    vendor = models.ForeignKey(LegacyVendor, on_delete=models.PROTECT)
    category_snapshot = models.CharField(max_length=64)
    description = models.TextField()
    quantity = models.PositiveIntegerField()
    net_price = models.DecimalField(max_digits=12, decimal_places=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=0)
    total_price = models.DecimalField(max_digits=12, decimal_places=0)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES)
    dispatched_at = models.DateField(null=True, blank=True)
    is_pending = models.BooleanField(default=False)
    work_order = models.OneToOneField('production.WorkOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='legacy_sale_note')

    class Meta:
        indexes = [models.Index(fields=['issue_date']), models.Index(fields=['status']), models.Index(fields=['customer'])]
        ordering = ['-issue_date', '-legacy_external_id']


class LegacyPayment(TimeStampedModel):
    EFECTIVO = 'efectivo'; TRANSFERENCIA = 'transferencia'; CHEQUE = 'cheque'
    METHOD_CHOICES = [(EFECTIVO, 'Efectivo'), (TRANSFERENCIA, 'Transferencia'), (CHEQUE, 'Cheque')]

    sale_note = models.ForeignKey(LegacySaleNote, on_delete=models.CASCADE, related_name='legacy_payments')
    legacy_external_id = models.IntegerField(unique=True)
    paid_at = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=0)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)

    class Meta:
        indexes = [models.Index(fields=['sale_note', 'paid_at'])]


class LegacyPaymentRegistration(TimeStampedModel):
    sale_note = models.ForeignKey(LegacySaleNote, on_delete=models.CASCADE, related_name='registrations')
    registered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    paid_at = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=0)
    method = models.CharField(max_length=20, choices=LegacyPayment.METHOD_CHOICES)
    notes = models.TextField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=64, null=True, blank=True, unique=True)


class LegacyImport(TimeStampedModel):
    CONTACTS = 'contacts'; VENDORS = 'vendors'; ORDERS = 'orders'; PAYMENTS = 'payments'; ALL = 'all'
    STAGE_CHOICES = [(CONTACTS, 'Contacts'), (VENDORS, 'Vendors'), (ORDERS, 'Orders'), (PAYMENTS, 'Payments'), (ALL, 'All')]
    RUNNING = 'RUNNING'; COMPLETED = 'COMPLETED'; FAILED = 'FAILED'
    STATUS_CHOICES = [(RUNNING, 'Running'), (COMPLETED, 'Completed'), (FAILED, 'Failed')]

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    started_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    rows_processed = models.IntegerField(default=0)
    rows_created = models.IntegerField(default=0)
    rows_skipped = models.IntegerField(default=0)
    rows_failed = models.IntegerField(default=0)
    error_log = models.TextField(null=True, blank=True)
    dry_run = models.BooleanField(default=False)
    legacy_dsn = models.CharField(max_length=255)
    idempotency_key = models.CharField(max_length=64, null=True, blank=True, unique=True)
```

## DoD

- [ ] `python manage.py makemigrations legacy` genera `0001_initial.py` con los 6 modelos.
- [ ] `python manage.py check` no reporta errores.
- [ ] Ningún modelo tiene `class Meta: abstract = True` (todos son concretos).
- [ ] `decimal_places=0` en todos los campos monetarios.

## Comandos de verificación

```bash
python manage.py makemigrations legacy
python manage.py check
```

## Riesgos

- **`WorkOrder` aún no tiene `related_name='legacy_sale_note'`** (se agrega en T12). Si falla, ajustar orden: T12 antes de T02.
- **`TimeStampedModel`**: si no existe la base abstracta, se reemplaza por `models.Model` + `created_at`/`updated_at` manuales.
