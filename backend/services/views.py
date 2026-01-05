from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import ServiceCategory, ServiceContract, ServiceObligation
from .services import ServiceContractService, ServiceObligationService
from .serializers import (
    ServiceCategorySerializer, 
    ServiceContractSerializer, 
    ServiceObligationSerializer,
    ServiceInvoiceRegistrationSerializer,
    ServicePaymentRegistrationSerializer
)

class ServiceCategoryViewSet(viewsets.ModelViewSet):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    filterset_fields = ['code']
    search_fields = ['name', 'code']

class ServiceContractViewSet(viewsets.ModelViewSet):
    queryset = ServiceContract.objects.all()
    serializer_class = ServiceContractSerializer
    filterset_fields = ['supplier', 'category', 'status', 'recurrence_type']
    search_fields = ['name', 'contract_number', 'description']
    ordering_fields = ['start_date', 'name', 'contract_number']

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        contract = self.get_object()
        try:
            ServiceContractService.activate_contract(contract)
            return Response(self.get_serializer(contract).data)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        contract = self.get_object()
        contract.status = ServiceContract.Status.SUSPENDED
        contract.save()
        return Response(self.get_serializer(contract).data)

    @action(detail=True, methods=['get'])
    def obligations(self, request, pk=None):
        contract = self.get_object()
        obligations = contract.obligations.all().order_by('due_date')
        serializer = ServiceObligationSerializer(obligations, many=True)
        return Response(serializer.data)

class ServiceObligationViewSet(viewsets.ModelViewSet):
    queryset = ServiceObligation.objects.all()
    serializer_class = ServiceObligationSerializer
    filterset_fields = ['contract', 'status', 'contract__category']
    ordering_fields = ['due_date', 'amount']

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        overdue = self.queryset.filter(
            status=ServiceObligation.Status.OVERDUE
        ).order_by('due_date')
        serializer = self.get_serializer(overdue, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        today = timezone.now().date()
        date_limit = today + timezone.timedelta(days=30)
        upcoming = self.queryset.filter(
            status=ServiceObligation.Status.PENDING,
            due_date__lte=date_limit
        ).order_by('due_date')
        serializer = self.get_serializer(upcoming, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def register_invoice(self, request, pk=None):
        obligation = self.get_object()
        serializer = ServiceInvoiceRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            try:
                ServiceObligationService.register_invoice(obligation, serializer.validated_data)
                return Response(self.get_serializer(obligation).data)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def register_payment(self, request, pk=None):
        obligation = self.get_object()
        serializer = ServicePaymentRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            try:
                ServiceObligationService.register_payment(obligation, serializer.validated_data)
                return Response(self.get_serializer(obligation).data)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
