"""Endpoints del modelo documental común (ADR-0080, contrato document-relations.md). Solo lectura."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from core.documents import DocumentRelationService, DocumentTypeRegistry, ref_for
from core.documents.relations import WINDOWS


def _denied(label: str, user) -> Response | None:
    if DocumentTypeRegistry.model_for(label) is None:
        return Response({"detail": f"Tipo documental desconocido: {label}"}, status=404)
    if not user.has_perm(DocumentTypeRegistry.view_permission(label)):
        return Response({"detail": "Sin permiso para ver este documento."}, status=403)
    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def document_ref(request: Request, label: str, pk: int) -> Response:
    if denied := _denied(label, request.user):
        return denied
    ref = ref_for(label, pk, request.user)
    return Response(ref, status=200 if ref["exists"] else 404)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def document_relations(request: Request, label: str, pk: int) -> Response:
    if denied := _denied(label, request.user):
        return denied
    window = request.query_params.get("window", "all")
    if window not in WINDOWS:
        return Response({"detail": f"window inválido: {window}"}, status=400)
    result = DocumentRelationService.relations(
        label, pk, request.user,
        semantic=request.query_params.get("semantic"), direction=request.query_params.get("direction"),
        window=window,
    )
    if result is None:
        return Response({"detail": "Documento no encontrado."}, status=404)
    return Response(result)
