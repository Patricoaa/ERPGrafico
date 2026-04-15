import re

with open('backend/treasury/models.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Make a precise replacement for the legacy terminal config
# Just replacing the text directly to avoid regex complexity
target1 = """    is_terminal = models.BooleanField(
        _("Es Terminal de Cobro"), default=False, 
        help_text=_("P.ej. Máquina Transbank, TUU. Genera lotes y retiene comisión en liquidación.")
    )
    supplier = models.ForeignKey(
        'contacts.Contact', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='provided_payment_methods', verbose_name=_("Proveedor de Terminal"),
        help_text=_("Sólo si es terminal de cobro (Ej: Transbank S.A.)")
    )"""

target2 = """    # Terminal specific config (old)
    terminal_receivable_account = models.ForeignKey(
        'accounting.Account', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='terminal_receivable_methods', verbose_name=_("Cuenta Por Cobrar Terminal"),
        help_text=_("Cuenta puente donde cae la venta antes de ser liquidada (ej. Transbank por Cobrar)")
    )
    commission_expense_account = models.ForeignKey(
        'accounting.Account', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='commission_expense_methods', verbose_name=_("Cuenta Gasto por Comisión"),
        help_text=_("Cuenta de resultado pérdida para la comisión retenida")
    )
    commission_product = models.ForeignKey(
        'inventory.Product', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='commission_methods', verbose_name=_("Servicio Comisión"),
        help_text=_("Producto/Servicio para la factura de compra de la comisión")
    )"""

target3 = """    payment_method = models.ForeignKey(
        PaymentMethod, on_delete=models.PROTECT, related_name='terminal_batches',
        verbose_name=_("Método de Pago")
    )
    supplier = models.ForeignKey(
        'contacts.Contact', on_delete=models.PROTECT, related_name='terminal_batches',
        verbose_name=_("Proveedor")
    )"""

content = content.replace(target1, "")
content = content.replace(target2, "")
content = content.replace(target3, "")

with open('backend/treasury/models.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done removing legacy fields")
