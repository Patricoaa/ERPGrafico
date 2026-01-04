from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import SaleOrder, SalesSettings, SaleDelivery
from .serializers import (
    SaleOrderSerializer, 
    CreateSaleOrderSerializer, 
    SalesSettingsSerializer,
    SaleDeliverySerializer
)
from .services import SalesService
from inventory.models import Warehouse
from django.core.exceptions import ValidationError
from decimal import Decimal

from core.mixins import BulkImportMixin

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
    
    @action(detail=True, methods=['post'], url_path='dispatch')
    def dispatch_order(self, request, pk=None):
        """Dispatch complete order"""
        order = self.get_object()
        try:
            warehouse_id = request.data.get('warehouse_id')
            delivery_date = request.data.get('delivery_date')
            
            warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            delivery = SalesService.dispatch_order(
                order=order,
                warehouse=warehouse,
                delivery_date=delivery_date
            )
            
            return Response(
                SaleDeliverySerializer(delivery).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def partial_dispatch(self, request, pk=None):
        """Dispatch specific quantities of products"""
        order = self.get_object()
        try:
            warehouse_id = request.data.get('warehouse_id')
            delivery_date = request.data.get('delivery_date')
            line_quantities = request.data.get('line_quantities', {})  # {sale_line_id: quantity}
            
            warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            delivery = SalesService.partial_dispatch(
                order=order,
                warehouse=warehouse,
                line_quantities=line_quantities,
                delivery_date=delivery_date
            )
            
            return Response(
                SaleDeliverySerializer(delivery).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def deliveries(self, request, pk=None):
        """List all deliveries for this order"""
        order = self.get_object()
        deliveries = order.deliveries.all()
        return Response(SaleDeliverySerializer(deliveries, many=True).data)

class SaleDeliveryViewSet(viewsets.ModelViewSet):
    queryset = SaleDelivery.objects.all()
    serializer_class = SaleDeliverySerializer
