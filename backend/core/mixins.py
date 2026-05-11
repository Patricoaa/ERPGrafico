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
    # Es OBLIGATORIO declarar una estrategia.
    totals_strategy = None

    def recalculate_totals(self, commit=True):
        """
        Calcula y persiste total_net, total_tax, total.

        Delega a ``self.totals_strategy``, que debe estar declarada en la subclase.
        """
        if self.totals_strategy is None:
            raise NotImplementedError(
                f"{self.__class__.__name__} debe definir 'totals_strategy'."
            )
            
        from core.strategies.totals import TotalsStrategy
        return self.totals_strategy().compute(self, commit=commit)
