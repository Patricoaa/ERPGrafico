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

class TotalsCalculationMixin:
    """
    Mixin to automatically calculate totals based on related lines.
    Expects:
    - a 'lines' reverse relationship.
    - fields: total_net, total_tax, total.
    """
    def recalculate_totals(self, commit=True):
        from decimal import Decimal
        import math
        
        # Check if this document uses Gross-first logic (Sales)
        is_sales = self.__class__.__name__ in ['SaleOrder', 'SaleDelivery']
        
        total_sum = Decimal('0.00')
        
        # Sum all line subtotals
        for line in self.lines.all():
            # If line has its own calculation logic, trigger it
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
            # total_sum is already GROSS (Quantity * UnitPriceGross)
            self.total = total_sum
            # Extract Net: Net = Gross / 1.19
            # Using str(round(...)) to ensure we get an integer-like decimal if needed
            net_val = (self.total / (Decimal('1') + (tax_rate / Decimal('100.0'))))
            self.total_net = net_val.quantize(Decimal('1'), rounding='ROUND_HALF_UP')
            # IVA is the difference
            self.total_tax = self.total - self.total_net
        else:
            # NET-first calculation (Purchases)
            # total_sum is NET (Quantity * UnitCostNet)
            self.total_net = total_sum
            # Calculate VAT on total net amount (Chilean DTE requirement)
            total_tax_calc = self.total_net * (tax_rate / Decimal('100.0'))
            # Round up to nearest peso (Chilean tax regulation for DTE)
            self.total_tax = Decimal(str(math.ceil(total_tax_calc)))
            self.total = self.total_net + self.total_tax
        
        if commit:
            # We only update total fields to avoid recursion or side effects
            self.save(update_fields=['total_net', 'total_tax', 'total'])
        
        return {
            'net': self.total_net,
            'tax': self.total_tax,
            'total': self.total
        }
