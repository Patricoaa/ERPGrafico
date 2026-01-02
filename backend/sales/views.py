from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Customer, SaleOrder, SalesSettings
from .serializers import CustomerSerializer, SaleOrderSerializer, CreateSaleOrderSerializer, SalesSettingsSerializer
from .services import SalesService
from django.core.exceptions import ValidationError

from core.mixins import BulkImportMixin

class CustomerViewSet(BulkImportMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

class SalesSettingsViewSet(viewsets.ModelViewSet):
    queryset = SalesSettings.objects.all()
    serializer_class = SalesSettingsSerializer

    @action(detail=False, methods=['get', 'put', 'patch'])
    def current(self, request):
        obj = SalesSettings.objects.first()
        if not obj:
            if request.method == 'GET':
                 # Create default if missing for easier frontend handling
                 obj = SalesSettings.objects.create()
            else:
                 obj = SalesSettings.objects.create()
        
        if request.method == 'GET':
            serializer = self.get_serializer(obj)
            return Response(serializer.data)
        
        serializer = self.get_serializer(obj, data=request.data, partial=(request.method == 'PATCH'))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class SaleOrderViewSet(viewsets.ModelViewSet):
    queryset = SaleOrder.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateSaleOrderSerializer
        return SaleOrderSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        # Return full data using read serializer
        return Response(SaleOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        SalesService.delete_sale_order(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        order = self.get_object()
        try:
            SalesService.confirm_sale(order)
            return Response(SaleOrderSerializer(order).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
