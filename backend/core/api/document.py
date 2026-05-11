from django.contrib.contenttypes.models import ContentType
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from core.services.document import DocumentRegistry

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def document_action_view(request, content_type_id, object_id, action):
    """
    Endpoint genérico para ejecutar acciones polimórficas (confirm, cancel, etc.) 
    sobre cualquier documento transaccional del ERP.
    """
    try:
        ct = ContentType.objects.get_for_id(content_type_id)
        ModelClass = ct.model_class()
        instance = ModelClass.objects.get(pk=object_id)
    except Exception as e:
        return Response({'error': 'Documento no encontrado', 'detail': str(e)}, status=404)
    
    try:
        service = DocumentRegistry.for_instance(instance)
    except NotImplementedError as e:
        return Response({'error': str(e)}, status=400)
    
    # Validar que la acción existe (ej: 'confirm', 'cancel')
    method = getattr(service, action, None)
    if not method:
        return Response({'error': f'Acción "{action}" no soportada para este documento'}, status=400)
    
    try:
        # Pasa los parámetros incluyendo kwargs desde request.data
        result = method(instance, user=request.user, **request.data)
        return Response({'status': 'ok'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)
