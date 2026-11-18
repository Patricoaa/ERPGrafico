"""API del cuadre por grupo: lista, conteos, ficha y guardado de la unión manual (spec §5.3, §5.7)."""

from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.idempotency import idempotent_endpoint
from tax.fiscal_match import feeding, services
from tax.fiscal_match.selectors import (
    fiscal_match_counts,
    fiscal_match_detail_queryset,
    fiscal_matches_queryset,
)
from tax.fiscal_match.serializers import (
    ApplySerializer,
    ConfirmDraftSerializer,
    CreateDraftSerializer,
    FiscalMatchDetailSerializer,
    FiscalMatchFilterSerializer,
    FiscalMatchListSerializer,
    InvoiceCandidateSerializer,
    PurchaseOrderOptionSerializer,
)
from tax.models import FiscalMatch

_VIEW = "tax.view_taxperiod"
_CHANGE = "tax.change_taxperiod"


def _valid(serializer_class, data) -> dict:
    body = serializer_class(data=data)
    body.is_valid(raise_exception=True)
    return body.validated_data


def _filters(params) -> dict:
    data = {k: v for k, v in params.items() if k != "status"}
    if statuses := params.getlist("status"):
        data["status"] = statuses
    return _valid(FiscalMatchFilterSerializer, data)


def _detail(group: FiscalMatch) -> Response:
    return Response(
        FiscalMatchDetailSerializer(fiscal_match_detail_queryset().get(pk=group.pk)).data
    )


class FiscalMatchViewSet(viewsets.ReadOnlyModelViewSet):
    pagination_class = StandardResultsSetPagination
    filter_backends: list = []
    action_permissions = {
        **dict.fromkeys(
            (
                "list",
                "retrieve",
                "counts",
                "draft_suggestions",
                "purchase_orders",
            ),
            _VIEW,
        ),
        **dict.fromkeys(
            ("apply", "release", "retry_issue", "confirm_draft", "create_draft"), _CHANGE
        ),
    }

    def get_queryset(self):
        if self.action == "list":
            return fiscal_matches_queryset(_filters(self.request.query_params))
        return fiscal_match_detail_queryset()

    def get_serializer_class(self):
        return FiscalMatchListSerializer if self.action == "list" else FiscalMatchDetailSerializer

    def _group(self, pk) -> FiscalMatch:
        return get_object_or_404(FiscalMatch, pk=pk)

    @action(detail=False, methods=["get"])
    def counts(self, request):
        return Response(fiscal_match_counts(_filters(request.query_params)))

    @idempotent_endpoint(scope="tax.fiscal_match.apply")
    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        body = _valid(ApplySerializer, request.data)
        return _detail(services.apply_changes(self._group(pk), body["changes"]))

    @idempotent_endpoint(scope="tax.fiscal_match.release")
    @action(detail=True, methods=["post"])
    def release(self, request, pk=None):
        return _detail(services.release(self._group(pk)))

    @idempotent_endpoint(scope="tax.fiscal_match.retry_issue")
    @action(detail=True, methods=["post"], url_path="retry-issue")
    def retry_issue(self, request, pk=None):
        group = self._group(pk)
        services.retry_issue(group)
        return _detail(group)

    @action(detail=True, methods=["get"], url_path="draft-suggestions")
    def draft_suggestions(self, request, pk=None):
        return Response(
            InvoiceCandidateSerializer(feeding.draft_suggestions(self._group(pk)), many=True).data
        )

    @action(detail=True, methods=["get"], url_path="purchase-orders")
    def purchase_orders(self, request, pk=None):
        return Response(
            PurchaseOrderOptionSerializer(
                feeding.supplier_purchase_orders(self._group(pk)), many=True
            ).data
        )

    @idempotent_endpoint(scope="tax.fiscal_match.confirm_draft")
    @action(detail=True, methods=["post"], url_path="confirm-draft")
    def confirm_draft(self, request, pk=None):
        body = _valid(ConfirmDraftSerializer, request.data)
        return _detail(
            feeding.confirm_draft_from_rcv(self._group(pk), body["invoice"], body.get("attachment"))
        )

    @idempotent_endpoint(scope="tax.fiscal_match.create_draft")
    @action(detail=True, methods=["post"], url_path="create-draft")
    def create_draft(self, request, pk=None):
        body = _valid(CreateDraftSerializer, request.data)
        response = _detail(feeding.create_draft_from_rcv(self._group(pk), body["purchase_order"]))
        response.status_code = 201
        return response
