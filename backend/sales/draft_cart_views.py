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
    Incluye sincronización en vivo y bloqueo optimista.
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
        
        return DraftCart.objects.filter(
            pos_session_id=pos_session_id
        ).select_related('customer', 'created_by', 'last_modified_by', 'pos_session', 'locked_by')
    
    def create(self, request):
        """
        POST /api/sales/pos-drafts/ - Guardar nuevo borrador
        """
        pos_session_id = request.data.get('pos_session_id')
        items = request.data.get('items', [])
        customer_id = request.data.get('customer_id')
        name = request.data.get('name', '')
        notes = request.data.get('notes', '')
        wizard_state = request.data.get('wizard_state')
        session_key = request.data.get('session_key', '')
        
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
                notes=notes,
                wizard_state=wizard_state,
                session_key=session_key,
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
        PUT/PATCH /api/sales/pos-drafts/{id}/ - Actualizar borrador existente
        """
        pos_session_id = request.data.get('pos_session_id')
        items = request.data.get('items', [])
        customer_id = request.data.get('customer_id')
        name = request.data.get('name', '')
        notes = request.data.get('notes', '')
        wizard_state = request.data.get('wizard_state')
        session_key = request.data.get('session_key', '')
        
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
                wizard_state=wizard_state,
                draft_id=int(pk),
                session_key=session_key,
            )
            
            serializer = self.get_serializer(draft)
            return Response(serializer.data)
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except DraftCart.DoesNotExist:
            return Response(
                {"error": "Borrador no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    def destroy(self, request, pk=None):
        """
        DELETE /api/sales/pos-drafts/{id}/ - Eliminar borrador
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
        POST /api/sales/pos-drafts/{id}/restore/ - Restaurar borrador al carrito activo
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

    # ── Sync Endpoint ────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def sync(self, request):
        """
        GET /api/sales/pos-drafts/sync/?pos_session_id=X
        
        Endpoint ligero para polling. Retorna estado de todos los borradores
        de la sesión sin incluir los items del carrito (solo metadatos + locks).
        Limpia automáticamente locks expirados.
        """
        pos_session_id = request.query_params.get('pos_session_id')
        
        if not pos_session_id:
            return Response(
                {"error": "Se requiere pos_session_id"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = DraftCartService.get_sync_data(
            pos_session_id=int(pos_session_id),
        )
        
        return Response(data)

    # ── Lock Endpoints ───────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        """
        POST /api/sales/pos-drafts/{id}/lock/
        Body: { "pos_session_id": X, "session_key": "uuid-browser-tab" }
        
        Adquiere el lock del borrador. Si ya está lockeado por otro,
        retorna 423 Locked con información del holder.
        """
        pos_session_id = request.data.get('pos_session_id')
        session_key = request.data.get('session_key', '')
        
        if not pos_session_id or not session_key:
            return Response(
                {"error": "Se requiere pos_session_id y session_key"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = DraftCartService.acquire_lock(
            draft_id=int(pk),
            pos_session_id=int(pos_session_id),
            user=request.user,
            session_key=session_key,
        )
        
        if result.get('acquired'):
            return Response({"locked": True})
        
        return Response(
            {
                "locked": False,
                "locked_by_name": result.get('locked_by_name'),
                "locked_at": result.get('locked_at'),
                "error": result.get('error', f"Borrador en uso por {result.get('locked_by_name', 'otro usuario')}"),
            },
            status=423  # HTTP 423 Locked
        )

    @action(detail=True, methods=['post'])
    def unlock(self, request, pk=None):
        """
        POST /api/sales/pos-drafts/{id}/unlock/
        Body: { "pos_session_id": X, "session_key": "uuid-browser-tab" }
        
        Libera el lock del borrador.
        """
        pos_session_id = request.data.get('pos_session_id')
        session_key = request.data.get('session_key', '')
        
        if not pos_session_id:
            return Response(
                {"error": "Se requiere pos_session_id"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success = DraftCartService.release_lock(
            draft_id=int(pk),
            pos_session_id=int(pos_session_id),
            user=request.user,
            session_key=session_key,
        )
        
        return Response({"unlocked": success})

    @action(detail=True, methods=['post'])
    def heartbeat(self, request, pk=None):
        """
        POST /api/sales/pos-drafts/{id}/heartbeat/
        Body: { "pos_session_id": X, "session_key": "uuid-browser-tab" }
        
        Renueva el lock (heartbeat). Debe llamarse periódicamente
        para mantener el lock activo.
        """
        pos_session_id = request.data.get('pos_session_id')
        session_key = request.data.get('session_key', '')
        
        if not pos_session_id or not session_key:
            return Response(
                {"error": "Se requiere pos_session_id y session_key"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success = DraftCartService.refresh_lock(
            draft_id=int(pk),
            pos_session_id=int(pos_session_id),
            user=request.user,
            session_key=session_key,
        )
        
        if success:
            return Response({"refreshed": True})
        
        return Response(
            {"refreshed": False, "error": "Lock perdido o no existe"},
            status=status.HTTP_409_CONFLICT
        )
