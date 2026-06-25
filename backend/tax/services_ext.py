class TaxServiceExt:
    @staticmethod
    def create_declaration_from_request(request):
        from django.utils import timezone
        from .f29_services import F29CalculationService
        y, m = request.data.get('tax_period_year'), request.data.get('tax_period_month')
        if not y or not m:
            now = timezone.now()
            y, m = y or now.year, m or now.month
        return F29CalculationService.create_or_update_declaration(year=int(y), month=int(m), manual_fields=request.data)
