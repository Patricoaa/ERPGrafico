from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import WorkOrder, ProductionConsumption, BillOfMaterials, BillOfMaterialsLine
from .serializers import (
    WorkOrderSerializer, 
    ProductionConsumptionSerializer,
    BillOfMaterialsSerializer,
    BillOfMaterialsLineSerializer
)
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
    
    @action(detail=True, methods=['post'])
    def consume_from_bom(self, request, pk=None):
        """Consume materials based on the BOM of the associated product"""
        work_order = self.get_object()
        try:
            warehouse_id = request.data.get('warehouse_id')
            multiplier = Decimal(str(request.data.get('multiplier', '1.0')))
            
            warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            consumptions = ProductionService.consume_materials_from_bom(
                work_order, 
                warehouse, 
                multiplier
            )
            
            return Response(
                ProductionConsumptionSerializer(consumptions, many=True).data, 
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class BillOfMaterialsViewSet(viewsets.ModelViewSet):
    queryset = BillOfMaterials.objects.all()
    serializer_class = BillOfMaterialsSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        product_id = self.request.query_params.get('product_id')
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        return queryset
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("ERROR VALIDATING BOM:", serializer.errors)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

class BillOfMaterialsLineViewSet(viewsets.ModelViewSet):
    queryset = BillOfMaterialsLine.objects.all()
    serializer_class = BillOfMaterialsLineSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        bom_id = self.request.query_params.get('bom_id')
        if bom_id:
            queryset = queryset.filter(bom_id=bom_id)
        return queryset
