import time
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from .partner_models import ProfitDistributionResolution
from .serializers import ProfitDistributionResolutionSerializer
from .profit_distribution_service import ProfitDistributionService

class ProfitDistributionResolutionViewSet(viewsets.ModelViewSet):
    queryset = ProfitDistributionResolution.objects.all().order_by('-fiscal_year', '-created_at')
    serializer_class = ProfitDistributionResolutionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        fiscal_year = self.request.query_params.get('fiscal_year')
        if fiscal_year:
            qs = qs.filter(fiscal_year=fiscal_year)
        return qs

    def create(self, request, *args, **kwargs):
        """Create a new draft resolution"""
        from decimal import Decimal
        
        fiscal_year = request.data.get('fiscal_year')
        net_result = request.data.get('net_result')
        resolution_date = request.data.get('resolution_date')
        acta_number = request.data.get('acta_number', '')
        notes = request.data.get('notes', '')
        
        if not all([fiscal_year, net_result, resolution_date]):
            return Response({"error": "Faltan campos (fiscal_year, net_result, resolution_date)."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            res = ProfitDistributionService.create_draft_resolution(
                fiscal_year=int(fiscal_year),
                net_result=Decimal(str(net_result)),
                resolution_date=resolution_date,
                acta_number=acta_number,
                notes=notes,
                created_by=request.user
            )
            return Response(self.get_serializer(res).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def update_destinations(self, request, pk=None):
        """Update destinations for lines in a draft resolution"""
        resolution = self.get_object()
        lines_data = request.data.get('lines', [])
        
        try:
            ProfitDistributionService.update_draft_line_destinations(resolution, lines_data)
            resolution.refresh_from_db()
            return Response(self.get_serializer(resolution).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a draft resolution"""
        resolution = self.get_object()
        try:
            ProfitDistributionService.approve_resolution(resolution, request.user)
            return Response(self.get_serializer(resolution).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Execute an approved resolution (creates journal entry & partner txs)"""
        resolution = self.get_object()
        try:
            ProfitDistributionService.execute_resolution(resolution, request.user)
            return Response(self.get_serializer(resolution).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def mass_payment(self, request, pk=None):
        """Execute mass payment for all dividend lines of this resolution"""
        resolution = self.get_object()
        treasury_account_id = request.data.get('treasury_account_id')
        
        if not treasury_account_id:
            return Response({"error": "Falta seleccionar la cuenta de tesorería (treasury_account_id)."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            ProfitDistributionService.execute_mass_payment(resolution, treasury_account_id, request.user)
            return Response(self.get_serializer(resolution).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
