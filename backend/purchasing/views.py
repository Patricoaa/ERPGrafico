from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Supplier, PurchaseOrder
from .serializers import SupplierSerializer, PurchaseOrderSerializer, CreatePurchaseOrderSerializer
from .services import PurchasingService
from django.core.exceptions import ValidationError

from core.mixins import BulkImportMixin

class SupplierViewSet(BulkImportMixin, viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreatePurchaseOrderSerializer
        return PurchaseOrderSerializer

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
            PurchasingService.receive_order(order)
            return Response(PurchaseOrderSerializer(order).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # import traceback
            # traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
