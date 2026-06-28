from core.api.pagination import StandardResultsSetPagination
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .partner_models import ProfitDistributionResolution
from .profit_distribution_service import ProfitDistributionService
from .serializers import ProfitDistributionResolutionSerializer


class ProfitDistributionResolutionViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = ProfitDistributionResolution.objects.all().order_by("-fiscal_year", "-created_at")
    serializer_class = ProfitDistributionResolutionSerializer

    def get_queryset(self):
        qs = super().get_queryset().prefetch_related(
            "lines", "lines__partner", "lines__destinations", "payments"
        )
        fiscal_year = self.request.query_params.get("fiscal_year")
        if fiscal_year:
            qs = qs.filter(fiscal_year=fiscal_year)
        return qs

    def create(self, request, *args, **kwargs):
        from decimal import Decimal

        fiscal_year_id = request.data.get("fiscal_year_id") or request.data.get("fiscal_year")
        net_result = request.data.get("net_result")
        resolution_date = request.data.get("resolution_date")

        try:
            ProfitDistributionService.validate_create_data(fiscal_year_id, net_result, resolution_date)
            res = ProfitDistributionService.create_draft_resolution(
                fiscal_year_id=int(fiscal_year_id),
                net_result=Decimal(str(net_result)),
                resolution_date=resolution_date,
                acta_number=request.data.get("acta_number", ""),
                notes=request.data.get("notes", ""),
                created_by=request.user,
            )
            return Response(self.get_serializer(res).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["patch"])
    def update_destinations(self, request, pk=None):
        """Update destinations for lines in a draft resolution"""
        resolution = self.get_object()
        lines_data = request.data.get("lines", [])

        try:
            ProfitDistributionService.update_draft_line_destinations(resolution, lines_data)
            resolution.refresh_from_db()
            return Response(self.get_serializer(resolution).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a draft resolution"""
        resolution = self.get_object()
        try:
            ProfitDistributionService.approve_resolution(resolution, request.user)
            return Response(self.get_serializer(resolution).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def execute(self, request, pk=None):
        """Execute an approved resolution (creates journal entry & partner txs)"""
        resolution = self.get_object()
        try:
            ProfitDistributionService.execute_resolution(resolution, request.user)
            return Response(self.get_serializer(resolution).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        """Recalculate lines for a draft resolution with fresh data"""
        resolution = self.get_object()
        try:
            ProfitDistributionService.recalculate_draft_resolution(resolution)
            return Response(self.get_serializer(resolution).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            ProfitDistributionService.validate_can_delete(instance)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def mass_payment(self, request, pk=None):
        resolution = self.get_object()
        treasury_account_id = request.data.get("treasury_account_id")
        payments_data = request.data.get("payments_data", [])

        try:
            ProfitDistributionService.execute_mass_payment(
                resolution, treasury_account_id, payments_data, request.user
            )
            return Response(self.get_serializer(resolution).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
