import csv
import io
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

class BulkImportMixin:
    """
    Mixin to add bulk import functionality from CSV to a ViewSet.
    """
    @action(detail=False, methods=['post'])
    def bulk_import(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No se proporcionó ningún archivo.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded_file = file.read().decode('utf-8')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
            
            items_created = 0
            errors = []
            
            # Get the serializer for this viewset
            serializer_class = self.get_serializer_class()
            
            for i, row in enumerate(reader):
                serializer = serializer_class(data=row)
                if serializer.is_valid():
                    serializer.save()
                    items_created += 1
                else:
                    errors.append({'row': i + 1, 'errors': serializer.errors})
            
            if errors:
                return Response({
                    'message': f'Se importaron {items_created} registros con algunos errores.',
                    'errors': errors
                }, status=status.HTTP_207_MULTI_STATUS)
            
            return Response({'message': f'Se importaron {items_created} registros exitosamente.'}, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class AuditHistoryMixin:
    """Mixin to add history action to ViewSets"""
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        instance = self.get_object()
        if not hasattr(instance, 'history'):
            return Response({"detail": "History not tracked for this model."}, status=status.HTTP_400_BAD_REQUEST)
        
        from .serializers import HistoricalRecordSerializer
        history = instance.history.all()
        serializer = HistoricalRecordSerializer(history, many=True)
        return Response(serializer.data)

class TotalsCalculationMixin:
    """
    Mixin que delega el cálculo de totales a una ``TotalsStrategy`` declarada
    en la clase concreta.

    Cada subclase DEBE declarar:
        totals_strategy: type[TotalsStrategy]  # e.g. GrossFirstTotals

    Si la subclase no declara ``totals_strategy`` (modelos legacy o modelos
    sin campos total_net/total_tax/total), se usa el método legacy
    ``_legacy_recalculate_totals()`` como fallback.

    Expects:
    - a 'lines' reverse relationship.
    - fields: total_net, total_tax, total.
    """

    # Las subclases concretas sobreescriben este atributo.
    # None significa: usar _legacy_recalculate_totals() como fallback.
    totals_strategy = None

    def recalculate_totals(self, commit=True):
        """
        Calcula y persiste total_net, total_tax, total.

        Delega a ``self.totals_strategy`` si está declarada;
        de lo contrario usa la implementación legacy.
        """
        if self.totals_strategy is not None:
            from core.strategies.totals import TotalsStrategy
            return self.totals_strategy().compute(self, commit=commit)
        # Fallback: lógica legacy para modelos que no declaran strategy
        return self._legacy_recalculate_totals(commit=commit)

    def _legacy_recalculate_totals(self, commit=True):
        """
        Implementación original pre-T-17. Se mantiene mientras los modelos
        ``PurchaseReceipt`` y ``PurchaseReturn`` no tengan sus campos de
        totales estandarizados (pendiente T-14 / F2 completa).

        TODO: Eliminar cuando todos los consumidores de TotalsCalculationMixin
        declaren ``totals_strategy``. Tracking: T-17 acceptance criteria.
        """
        from decimal import Decimal

        # Antipatrón a eliminar: solo vive aquí hasta que todos los modelos
        # declaren su strategy (ver docs/50-audit/Arquitectura Django/30-patterns.md).
        is_sales = self.__class__.__name__ in ['SaleOrder', 'SaleDelivery', 'DraftCart']

        total_sum = Decimal('0.00')

        # Sum all line subtotals
        for line in self.lines.all():
            if hasattr(line, 'calculate_subtotal'):
                line.calculate_subtotal()
            subtotal = getattr(line, 'subtotal', Decimal('0.00'))
            total_sum += subtotal

        # Get tax rate from first line (all lines should have same rate)
        tax_rate = Decimal('19.00')
        first_line = self.lines.first()
        if first_line and hasattr(first_line, 'tax_rate'):
            tax_rate = getattr(first_line, 'tax_rate', Decimal('19.00'))

        if is_sales:
            # GROSS-first calculation (Sales/POS)
            total_discount = getattr(self, 'total_discount_amount', Decimal('0.00'))
            self.total = max(Decimal('0'), total_sum - total_discount)
            net_val = (self.total / (Decimal('1') + (tax_rate / Decimal('100.0'))))
            self.total_net = net_val.quantize(Decimal('1'), rounding='ROUND_HALF_UP')
            self.total_tax = self.total - self.total_net
        else:
            # NET-first calculation (Purchases)
            self.total_net = total_sum
            total_tax_calc = self.total_net * (tax_rate / Decimal('100.0'))
            self.total_tax = total_tax_calc.quantize(Decimal('1'), rounding='ROUND_HALF_UP')
            self.total = self.total_net + self.total_tax

        if commit:
            self.save(update_fields=['total_net', 'total_tax', 'total'])

        return {
            'net': self.total_net,
            'tax': self.total_tax,
            'total': self.total
        }
