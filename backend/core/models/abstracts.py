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
    NO usar para JournalEntry (no encaja totals_*) — usar AuditedModel allí.

    Notas de subclase:
    - status: redeclarar con choices concretos y default en la subclase.
    - number: Invoice debe redeclarar con unique=False + unique_together=(number, dte_type).
    - journal_entry: usa related_name='+' para evitar colisiones; redeclarar si se necesita reverso.
    - decimal_places=0: CLP no tiene centavos (ADR-0014).
    """
    number = models.CharField(_("Número"), max_length=20, unique=True, editable=False)
    status = models.CharField(_("Estado"), max_length=20)
    notes = models.TextField(_("Notas"), blank=True)
    journal_entry = models.OneToOneField(
        'accounting.JournalEntry',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='+',
    )
    total_net = models.DecimalField(_("Neto"), max_digits=14, decimal_places=0, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=14, decimal_places=0, default=0)
    total = models.DecimalField(_("Total"), max_digits=14, decimal_places=0, default=0)

    class Meta:
        abstract = True
        ordering = ['-id']
