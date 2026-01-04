from django.utils import timezone

class Invoice(models.Model):
    # ... (enums remains)

    dte_type = models.CharField(_("Tipo DTE"), max_length=20, choices=DTEType.choices)
    number = models.CharField(_("Folio"), max_length=20, blank=True)
    document_attachment = models.FileField(_("Adjunto de Documento"), upload_to='invoices/', null=True, blank=True)
    date = models.DateField(_("Fecha"), default=timezone.now)
    
    # Links
    sale_order = models.ForeignKey(SaleOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT)
    payment_method = models.CharField(_("Método de Pago"), max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CREDIT)

    # Totals
    total_net = models.DecimalField(_("Neto"), max_digits=12, decimal_places=2, default=0)
    total_tax = models.DecimalField(_("Impuesto"), max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(_("Total"), max_digits=12, decimal_places=2, default=0)

    # Accounting
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='invoice'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Factura/Boleta")
        verbose_name_plural = _("Facturas y Boletas")

    def __str__(self):
        return f"{self.dte_type} {self.number or 'Draft'}"
