from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Supplier, PurchaseOrder, PurchaseReceipt
from .serializers import SupplierSerializer, PurchaseOrderSerializer, WritePurchaseOrderSerializer, PurchaseReceiptSerializer
from .services import PurchasingService
from inventory.models import Warehouse
from django.core.exceptions import ValidationError
from decimal import Decimal

from core.mixins import BulkImportMixin

class SupplierViewSet(BulkImportMixin, viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all()
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return WritePurchaseOrderSerializer
        return PurchaseOrderSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        PurchasingService.delete_purchase_order(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        order = self.get_object()
        if order.status == 'DRAFT':
            order.status = 'CONFIRMED'
            order.save()
            return Response({'status': 'confirmed'})
        return Response({'error': 'Order not in draft'}, status=400)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        order = self.get_object()
        try:
            warehouse_id = request.data.get('warehouse_id')
            receipt_date = request.data.get('receipt_date')
            
            warehouse = order.warehouse
            if warehouse_id:
                warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            receipt = PurchasingService.receive_order(
                order=order,
                warehouse=warehouse,
                receipt_date=receipt_date
            )
            
            return Response(
                PurchaseReceiptSerializer(receipt).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def partial_receive(self, request, pk=None):
        order = self.get_object()
        try:
            warehouse_id = request.data.get('warehouse_id')
            receipt_date = request.data.get('receipt_date')
            line_data = request.data.get('line_data', []) # List of dicts
            
            warehouse = order.warehouse
            if warehouse_id:
                warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            receipt = PurchasingService.partial_receive(
                order=order,
                warehouse=warehouse,
                line_data=line_data,
                receipt_date=receipt_date
            )
            
            return Response(
                PurchaseReceiptSerializer(receipt).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def receipts(self, request, pk=None):
        order = self.get_object()
        receipts = order.receipts.all()
        return Response(PurchaseReceiptSerializer(receipts, many=True).data)

class PurchaseReceiptViewSet(viewsets.ModelViewSet):
    queryset = PurchaseReceipt.objects.all()
    serializer_class = PurchaseReceiptSerializer

