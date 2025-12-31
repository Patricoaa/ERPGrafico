from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import WorkOrder, ProductionConsumption
from .serializers import WorkOrderSerializer, ProductionConsumptionSerializer
from .services import ProductionService
from inventory.models import Product, Warehouse
from decimal import Decimal

class WorkOrderViewSet(viewsets.ModelViewSet):
    queryset = WorkOrder.objects.all()
    serializer_class = WorkOrderSerializer

    @action(detail=True, methods=['post'])
    def consume(self, request, pk=None):
        work_order = self.get_object()
        try:
            product_id = request.data.get('product_id')
            warehouse_id = request.data.get('warehouse_id')
            quantity = Decimal(str(request.data.get('quantity')))
            
            product = Product.objects.get(pk=product_id)
            warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            consumption = ProductionService.consume_material(work_order, product, warehouse, quantity)
            
            return Response(ProductionConsumptionSerializer(consumption).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
