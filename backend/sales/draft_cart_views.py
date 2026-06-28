from core.api.pagination import StandardResultsSetPagination
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.permissions import StandardizedModelPermissions
from treasury.api.permissions import IsPOSSessionActive

from .draft_cart_serializers import DraftCartSerializer
from .draft_cart_service import DraftCartService
from .models import DraftCart
from .selectors import DraftCartSelector


class DraftCartViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    """
    ViewSet para gestionar borradores de carrito POS por sesión.
    Todos los usuarios de una sesión ven los mismos borradores (multi-usuario).
    Incluye sincronización en vivo y bloqueo optimista.
    """

    serializer_class = DraftCartSerializer
    permission_classes = [StandardizedModelPermissions, IsPOSSessionActive]

    def retrieve(self, request, pk=None):
        try:
            draft = DraftCartSelector.get_draft_by_id(int(pk))
        except DraftCart.DoesNotExist:
            return Response({"error": "Borrador no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(draft)
        return Response(serializer.data)

    def get_queryset(self):
        pos_session_id = self.request.query_params.get("pos_session_id")
        return DraftCartSelector.get_queryset_for_session(pos_session_id)

    def create(self, request):
        pos_session_id = request.data.get("pos_session_id")
        items = request.data.get("items", [])
        customer_id = request.data.get("customer_id")
        name = request.data.get("name", "")
        notes = request.data.get("notes", "")
        wizard_state = request.data.get("wizard_state")
        session_key = request.data.get("session_key", "")

        try:
            DraftCartService.validate_pos_session_id(pos_session_id)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if not items:
            return Response({"error": "El carrito está vacío"}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        pos_session_id = request.data.get("pos_session_id")
        items = request.data.get("items", [])
        customer_id = request.data.get("customer_id")
        name = request.data.get("name", "")
        notes = request.data.get("notes", "")
        wizard_state = request.data.get("wizard_state")
        session_key = request.data.get("session_key", "")

        try:
            DraftCartService.validate_pos_session_id(pos_session_id)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except DraftCart.DoesNotExist:
            return Response({"error": "Borrador no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    def destroy(self, request, pk=None):
        pos_session_id = request.query_params.get("pos_session_id")

        try:
            DraftCartService.validate_pos_session_id(pos_session_id)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        success = DraftCartService.delete_draft(int(pk), int(pos_session_id))

        if success:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response({"error": "Borrador no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        pos_session_id = request.data.get("pos_session_id")

        try:
            DraftCartService.validate_pos_session_id(pos_session_id)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        draft = DraftCartService.load_draft(int(pk), int(pos_session_id))

        if not draft:
            return Response({"error": "Borrador no encontrado"}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(draft)
        return Response(serializer.data)

    # ── Sync Endpoint ────────────────────────────────────────────────

    @action(detail=False, methods=["get"])
    def sync(self, request):
        pos_session_id = request.query_params.get("pos_session_id")

        try:
            DraftCartService.validate_pos_session_id(pos_session_id)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        data = DraftCartService.get_sync_data(
            pos_session_id=int(pos_session_id),
        )

        return Response(data)

    # ── Lock Endpoints ───────────────────────────────────────────────

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        pos_session_id = request.data.get("pos_session_id")
        session_key = request.data.get("session_key", "")

        try:
            DraftCartService.validate_pos_session_id(pos_session_id)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if not session_key:
            return Response(
                {"error": "Se requiere session_key"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = DraftCartService.acquire_lock(
            draft_id=int(pk),
            pos_session_id=int(pos_session_id),
            user=request.user,
            session_key=session_key,
        )

        if result.get("acquired"):
            return Response({"locked": True})

        return Response(
            {
                "locked": False,
                "locked_by_name": result.get("locked_by_name"),
                "locked_at": result.get("locked_at"),
                "error": result.get(
                    "error", f"Borrador en uso por {result.get('locked_by_name', 'otro usuario')}"
                ),
            },
            status=423,  # HTTP 423 Locked
        )

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        pos_session_id = request.data.get("pos_session_id")
        session_key = request.data.get("session_key", "")

        try:
            DraftCartService.validate_pos_session_id(pos_session_id)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        success = DraftCartService.release_lock(
            draft_id=int(pk),
            pos_session_id=int(pos_session_id),
            user=request.user,
            session_key=session_key,
        )

        return Response({"unlocked": success})

    @action(detail=True, methods=["post"])
    def heartbeat(self, request, pk=None):
        pos_session_id = request.data.get("pos_session_id")
        session_key = request.data.get("session_key", "")

        try:
            DraftCartService.validate_pos_session_id(pos_session_id)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if not session_key:
            return Response(
                {"error": "Se requiere session_key"},
                status=status.HTTP_400_BAD_REQUEST,
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
            status=status.HTTP_409_CONFLICT,
        )

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        pos_session_id = request.data.get("pos_session_id")
        partner_id = request.data.get("partner_id")

        try:
            DraftCartService.validate_pos_session_id(pos_session_id)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = DraftCartService.process_withdrawal(
                draft_id=int(pk),
                pos_session_id=int(pos_session_id),
                user=request.user,
                partner_id=partner_id,
            )
            return Response(result)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response(
                {"error": f"Error interno: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
