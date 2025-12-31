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
