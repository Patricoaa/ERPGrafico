from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Customer, SaleOrder
from .serializers import CustomerSerializer, SaleOrderSerializer, CreateSaleOrderSerializer
from .services import SalesService
from django.core.exceptions import ValidationError

from core.mixins import BulkImportMixin

class CustomerViewSet(BulkImportMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

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

    def perform_destroy(self, instance):
        SalesService.delete_sale_order(instance)

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
