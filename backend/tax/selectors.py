class TaxSelectorExt:
    @staticmethod
    def get_declaration_summary(obj):
        d = obj.declarations.first()
        if not d: return None
        pays = d.payments.all()
        paid = sum(p.amount for p in pays)
        due = d.total_amount_due
        return {
            'id': d.id, 'vat_to_pay': due, 'total_paid': paid,
            'is_fully_paid': paid >= due and due > 0 or due == 0,
            'folio_number': d.folio_number,
            'document': d.document.url if d.document else None,
            'payments': [{'id': p.id, 'payment_date': p.payment_date, 'amount': p.amount, 'payment_method_display': p.get_payment_method_display()} for p in pays]
        }

    @staticmethod
    def get_declaration_documents(declaration):
        from datetime import date
        from billing.serializers import InvoiceSerializer
        from billing.models import Invoice
        p = declaration.tax_period
        sd = date(p.year, p.month, 1)
        ed = date(p.year + 1, 1, 1) if p.month == 12 else date(p.year, p.month + 1, 1)
        invoices = Invoice.objects.filter(date__gte=sd, date__lt=ed, status=Invoice.Status.POSTED).order_by('date', 'id')
        return InvoiceSerializer(invoices, many=True).data
