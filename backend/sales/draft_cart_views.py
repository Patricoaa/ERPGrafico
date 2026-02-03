from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import DraftCart
from .draft_cart_serializers import DraftCartSerializer
from .draft_cart_service import DraftCartService
from core.api.permissions import StandardizedModelPermissions


class DraftCartViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar borradores de carrito POS por sesión.
    Todos los usuarios de una sesión ven los mismos borradores (multi-usuario).
    """
    serializer_class = DraftCartSerializer
    permission_classes = [StandardizedModelPermissions]
    
    def get_queryset(self):
        """
        Filtrar por sesión activa (no por usuario individual).
        Requiere pos_session_id como query param.
        """
        pos_session_id = self.request.query_params.get('pos_session_id')
        
        if not pos_session_id:
            return DraftCart.objects.none()
        
        # TODO: Validar que el usuario tiene acceso a esta sesión
        # Por ahora, confiamos en que el frontend solo envía sesiones válidas
        return DraftCart.objects.filter(
            pos_session_id=pos_session_id
        ).select_related('customer', 'created_by', 'last_modified_by', 'pos_session')
    
    def create(self, request):
        """
        POST /api/sales/draft-carts/ - Guardar nuevo borrador
        
        Body:
        {
            "pos_session_id": 1,
            "items": [...],
            "customer_id": 123,  # opcional
            "name": "Mi borrador",  # opcional
            "notes": "notas"  # opcional
        }
        """
        pos_session_id = request.data.get('pos_session_id')
        items = request.data.get('items', [])
        customer_id = request.data.get('customer_id')
        name = request.data.get('name', '')
        notes = request.data.get('notes', '')
        
        if not pos_session_id:
            return Response(
                {"error": "Se requiere una sesión POS activa (pos_session_id)"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not items:
            return Response(
                {"error": "El carrito está vacío"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            draft = DraftCartService.save_draft(
                pos_session_id=int(pos_session_id),
                user=request.user,
                items=items,
                customer_id=customer_id,
                name=name,
                notes=notes
            )
            
            serializer = self.get_serializer(draft)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def update(self, request, pk=None):
        """
        PUT/PATCH /api/sales/draft-carts/{id}/ - Actualizar borrador existente
        """
        pos_session_id = request.data.get('pos_session_id')
        items = request.data.get('items', [])
        customer_id = request.data.get('customer_id')
        name = request.data.get('name', '')
        notes = request.data.get('notes', '')
        
        if not pos_session_id:
            return Response(
                {"error": "Se requiere pos_session_id"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            draft = DraftCartService.save_draft(
                pos_session_id=int(pos_session_id),
                user=request.user,
                items=items,
                customer_id=customer_id,
                name=name,
                notes=notes,
                draft_id=int(pk)
            )
            
            serializer = self.get_serializer(draft)
            return Response(serializer.data)
        except (ValueError, DraftCart.DoesNotExist) as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def destroy(self, request, pk=None):
        """
        DELETE /api/sales/draft-carts/{id}/ - Eliminar borrador
        """
        pos_session_id = request.query_params.get('pos_session_id')
        
        if not pos_session_id:
            return Response(
                {"error": "Se requiere pos_session_id"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success = DraftCartService.delete_draft(
            int(pk),
            int(pos_session_id)
        )
        
        if success:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(
            {"error": "Borrador no encontrado"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """
        POST /api/sales/draft-carts/{id}/restore/ - Restaurar borrador al carrito activo
        
        Returns:
            Datos completos del borrador para cargar en el carrito
        """
        pos_session_id = request.data.get('pos_session_id')  
        
        if not pos_session_id:
            return Response(
                {"error": "Se requiere pos_session_id"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        draft = DraftCartService.load_draft(int(pk), int(pos_session_id))
        
        if not draft:
            return Response(
                {"error": "Borrador no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = self.get_serializer(draft)
        return Response(serializer.data)
