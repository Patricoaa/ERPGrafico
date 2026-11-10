from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
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
    action_permissions = {
        # Edit via POST → change_*
        "restore": "sales.change_draftcart",
        "lock": "sales.change_draftcart",
        "unlock": "sales.change_draftcart",
        "heartbeat": "sales.change_draftcart",
        "withdraw": "sales.change_draftcart",
    }

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
        try:
            draft = DraftCartService.save_draft_from_request(request)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(draft)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            draft = DraftCartService.save_draft_from_request(request, draft_id=int(pk))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as e:
            msg = e.message if hasattr(e, "message") else ", ".join(e.messages)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        except DraftCart.DoesNotExist:
            return Response({"error": "Borrador no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(draft)
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        pos_session_id = request.query_params.get("pos_session_id")

        try:
            DraftCartService.validate_pos_session_id(pos_session_id)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        success = DraftCartService.delete_draft(int(pk), int(pos_session_id))

        if success:
            return Response(status=status.HTTP_204_NO_CONTENT)

        # Distinguish: protected draft (409) vs not found (404)
        try:
            draft = DraftCart.objects.get(id=int(pk), pos_session_id=int(pos_session_id))
            if draft.has_pending_approval:
                return Response(
                    {"error": "No se puede eliminar: el borrador tiene una aprobación de crédito pendiente."},
                    status=status.HTTP_409_CONFLICT,
                )
        except DraftCart.DoesNotExist:
            pass

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
        try:
            result = DraftCartService.acquire_lock_from_request(request, int(pk))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
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
            status=423,
        )

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        try:
            success = DraftCartService.release_lock_from_request(request, int(pk))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"unlocked": success})

    @action(detail=True, methods=["post"])
    def heartbeat(self, request, pk=None):
        try:
            success = DraftCartService.refresh_lock_from_request(request, int(pk))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if success:
            return Response({"refreshed": True})
        return Response(
            {"refreshed": False, "error": "Lock perdido o no existe"},
            status=status.HTTP_409_CONFLICT,
        )

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        try:
            result = DraftCartService.process_withdrawal_from_request(request, int(pk))
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except APIException:
            raise
        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response(
                {"error": f"Error interno: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        return Response(result)
