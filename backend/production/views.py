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
from .services import WorkOrderService
from inventory.models import Product, Warehouse
from decimal import Decimal
from django.http import HttpResponse
from reportlab.pdfgen import canvas
from io import BytesIO

class WorkOrderViewSet(viewsets.ModelViewSet):
    queryset = WorkOrder.objects.all()
    serializer_class = WorkOrderSerializer

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        """Transition OT to next stage with optional data"""
        work_order = self.get_object()
        try:
            next_stage = request.data.get('next_stage')
            notes = request.data.get('notes', '')
            data = request.data.get('data', {})
            
            # Find the stage choice
            stage_match = None
            for choice, label in WorkOrder.Stage.choices:
                if choice == next_stage:
                    stage_match = choice
                    break
            
            if not stage_match:
                return Response({'error': f'Etapa inválida: {next_stage}'}, status=status.HTTP_400_BAD_REQUEST)

            WorkOrderService.transition_to(
                work_order=work_order,
                next_stage=stage_match,
                user=request.user,
                notes=notes,
                data=data
            )
            
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def print_pdf(self, request, pk=None):
        """Generate a basic PDF for the Work Order"""
        work_order = self.get_object()
        
        buffer = BytesIO()
        p = canvas.Canvas(buffer)
        
        # Simple PDF generation logic
        p.drawString(100, 800, f"ORDEN DE TRABAJO: OT-{work_order.number}")
        p.drawString(100, 780, f"Descripción: {work_order.description}")
        p.drawString(100, 760, f"Estado: {work_order.get_status_display()}")
        p.drawString(100, 740, f"Etapa Actual: {work_order.get_current_stage_display()}")
        
        if work_order.sale_order:
            p.drawString(100, 720, f"Nota de Venta: NV-{work_order.sale_order.number}")
            p.drawString(100, 700, f"Cliente: {work_order.sale_order.customer.name}")

        y = 660
        p.drawString(100, y, "MATERIALES ASIGNADOS:")
        y -= 20
        for mat in work_order.materials.all():
            p.drawString(120, y, f"- {mat.component.name} ({mat.component.code}): {mat.quantity_planned} {mat.uom.name}")
            y -= 15
        
        p.showPage()
        p.save()
        
        buffer.seek(0)
        filename = f"OT-{work_order.number}.pdf"
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=['post'])
    def create_manual(self, request):
        """Create a manual OT"""
        try:
            product_id = request.data.get('product_id')
            quantity = Decimal(str(request.data.get('quantity')))
            description = request.data.get('description', '')
            warehouse_id = request.data.get('warehouse_id')
            
            product = Product.objects.get(pk=product_id)
            warehouse = Warehouse.objects.get(pk=warehouse_id) if warehouse_id else None
            
            work_order = WorkOrderService.create_manual(
                product=product,
                quantity=quantity,
                description=description,
                warehouse=warehouse
            )
            
            return Response(WorkOrderSerializer(work_order).data, status=status.HTTP_201_CREATED)
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
