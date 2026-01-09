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
        
        total_net = Decimal('0.00')
        total_tax = Decimal('0.00')
        
        # We use .all() but be aware of prefetch/selection if called frequently
        for line in self.lines.all():
            # If line has it's own calculation logic, trigger it
            if hasattr(line, 'calculate_subtotal'):
                line.calculate_subtotal()
            
            line_net = getattr(line, 'subtotal', Decimal('0.00'))
            line_tax_rate = getattr(line, 'tax_rate', Decimal('0.00'))
            
            # Tax calculation (Chilean style: round up)
            line_tax = line_net * (line_tax_rate / Decimal('100.0'))
            
            total_net += line_net
            total_tax += line_tax
            
        self.total_net = total_net
        self.total_tax = Decimal(str(math.ceil(total_tax)))
        self.total = self.total_net + self.total_tax
        
        if commit:
            # We only update total fields to avoids recursion or side effects
            self.save(update_fields=['total_net', 'total_tax', 'total'])
        
        return {
            'net': self.total_net,
            'tax': self.total_tax,
            'total': self.total
        }
