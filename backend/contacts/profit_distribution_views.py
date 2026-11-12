from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.idempotency import idempotent_endpoint
from core.mixins import AuditHistoryMixin, EditPolicyMixin

from .partner_models import ProfitDistributionResolution
from .profit_distribution_service import ProfitDistributionService
from .serializers import ProfitDistributionResolutionSerializer


class ProfitDistributionResolutionViewSet(EditPolicyMixin, viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    queryset = ProfitDistributionResolution.objects.all().order_by("-fiscal_year", "-created_at")
    serializer_class = ProfitDistributionResolutionSerializer
    action_permissions = {
        "approve": "contacts.approve_profitdistributionresolution",
        "execute": "contacts.pay_profitdistributionresolution",
        "mass_payment": "contacts.pay_profitdistributionresolution",
        # Edit via POST → change_*
        "update_destinations": "contacts.change_profitdistributionresolution",
        "recalculate": "contacts.change_profitdistributionresolution",
    }

    def get_queryset(self):
        qs = super().get_queryset().prefetch_related(
            "lines", "lines__partner", "lines__destinations", "payments"
        )
        fiscal_year = self.request.query_params.get("fiscal_year")
        if fiscal_year:
            qs = qs.filter(fiscal_year=fiscal_year)
        return qs

    def create(self, request, *args, **kwargs):
        res = ProfitDistributionService.create_draft_from_request(request)
        return Response(self.get_serializer(res).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"])
    def update_destinations(self, request, pk=None):
        """Update destinations for lines in a draft resolution"""
        resolution = self.get_object()
        ProfitDistributionService.update_draft_line_destinations(resolution, request.data.get("lines", []))
        resolution.refresh_from_db()
        return Response(self.get_serializer(resolution).data)

    @idempotent_endpoint(scope="contacts.distribution.approve")
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a draft resolution"""
        resolution = self.get_object()
        ProfitDistributionService.approve_resolution(resolution, request.user)
        return Response(self.get_serializer(resolution).data)

    @idempotent_endpoint(scope="contacts.distribution.execute")
    @action(detail=True, methods=["post"])
    def execute(self, request, pk=None):
        """Execute an approved resolution (creates journal entry & partner txs)"""
        resolution = self.get_object()
        ProfitDistributionService.execute_resolution(resolution, request.user)
        return Response(self.get_serializer(resolution).data)

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        """Recalculate lines for a draft resolution with fresh data"""
        resolution = self.get_object()
        ProfitDistributionService.recalculate_draft_resolution(resolution)
        return Response(self.get_serializer(resolution).data)

    def destroy(self, request, *args, **kwargs):
        ProfitDistributionService.validate_can_delete(self.get_object())
        return super().destroy(request, *args, **kwargs)

    @idempotent_endpoint(scope="contacts.dividend.mass_payment")
    @action(detail=True, methods=["post"])
    def mass_payment(self, request, pk=None):
        resolution = self.get_object()
        treasury_account_id = request.data.get("treasury_account_id")
        payments_data = request.data.get("payments_data", [])

        ProfitDistributionService.execute_mass_payment(
            resolution, treasury_account_id, payments_data, request.user
        )
        # Reload: the instance above holds its payments as prefetched before this one.
        return Response(self.get_serializer(self.get_object()).data)
