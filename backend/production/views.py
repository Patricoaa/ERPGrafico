from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import WorkOrder, ProductionConsumption, BillOfMaterials, BillOfMaterialsLine, WorkOrderMaterial
from .serializers import (
    WorkOrderSerializer, 
    ProductionConsumptionSerializer,
    BillOfMaterialsSerializer,
    BillOfMaterialsLineSerializer
)
from .services import WorkOrderService
from inventory.models import Product, Warehouse, UoM
from decimal import Decimal
from django.http import HttpResponse
from reportlab.pdfgen import canvas
from io import BytesIO
from core.views import AuditHistoryMixin
from django.contrib.contenttypes.models import ContentType
from core.models import Attachment

class WorkOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = WorkOrder.objects.all()
    serializer_class = WorkOrderSerializer

    def create(self, request, *args, **kwargs):
        """
        Overridden create to handle Manual and Sale-Linked OTs via Service.
        """
        try:
            data = request.data
            product_id = data.get('product_id')
            sale_line_id = data.get('sale_line')
            
            # 1. Manual Creation Flow (Product ID present, No Sale Line)
            if product_id and (not sale_line_id or sale_line_id in ['none', '__none__', '']):
                return self.create_manual(request)

            # 2. Sale Linked Flow (Sale Line present)
            elif sale_line_id and sale_line_id not in ['none', '__none__', '']:
                from sales.models import SaleLine
                sale_line = SaleLine.objects.get(pk=sale_line_id)
                
                # Check if we should enforce uniqueness or allow duplicates?
                # Service check usually handles duplicates if auto-finalize is on or check existence.
                # But here the user explicitly clicked "Create" (or Save), so we should allow it or return existing?
                # Usually standard CRUD allows creation.
                
                # Extract files from request
                files = {}
                if request.FILES:
                    # Group files by key patterns if needed, or pass as is
                    # The service expects 'design' (list) and 'approval' (single)
                    # We assume frontend sends 'design_files[]' or 'design' and 'approval_file' or 'approval'
                    
                    design_files = request.FILES.getlist('design_files') or request.FILES.getlist('design')
                    approval_file = request.FILES.get('approval_file') or request.FILES.get('approval')
                    
                    if design_files:
                        files['design'] = design_files
                    if approval_file:
                        files['approval'] = approval_file
                
                work_order = WorkOrderService.create_from_sale_line(sale_line, files=files)
                
                if work_order:
                    # Apply updates from form (dates, description override, stage_data)
                    serializer = WorkOrderSerializer(work_order, data=data, partial=True)
                    if serializer.is_valid():
                        work_order = serializer.save()
                        # Sync related_contact from stage_data if present
                        self._sync_related_contact(work_order)
                    return Response(WorkOrderSerializer(work_order).data, status=status.HTTP_201_CREATED)
            
            # 3. Fallback to standard (e.g. if sending nothing special)
            response = super().create(request, *args, **kwargs)
            if response.status_code == 201:
                # Sync related_contact for standard creation
                work_order = WorkOrder.objects.get(pk=response.data['id'])
                self._sync_related_contact(work_order)
            return response
            
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        """
        Overridden update to handle file attachments.
        """
        response = super().update(request, *args, **kwargs)
        
        if response.status_code == 200:
            try:
                # Handle file attachments
                if request.FILES:
                    instance = self.get_object()
                    content_type = ContentType.objects.get_for_model(instance)
                    
                    # 1. Design Files (design_file_0, design_file_1, etc.)
                    # We look for keys starting with 'design_file_'
                    for key, file_obj in request.FILES.items():
                        if key.startswith('design_file_'):
                            Attachment.objects.create(
                                file=file_obj,
                                original_filename=file_obj.name,
                                content_type=content_type,
                                object_id=instance.id,
                                user=request.user
                            )
                    
                    # 2. Approval File
                    approval_file = request.FILES.get('approval_file')
                    if approval_file:
                        Attachment.objects.create(
                            file=approval_file,
                            original_filename=approval_file.name,
                            content_type=content_type,
                            object_id=instance.id,
                            user=request.user
                        )
                        # Ensure stage_data is updated with the filename for legacy support
                        # Although super().update() likely handled stage_data from body, 
                        # ensure the filename matches what was uploaded.
                        if not instance.stage_data: instance.stage_data = {}
                        instance.stage_data['approval_attachment'] = approval_file.name
                        instance.save()
                        
            except Exception as e:
                print(f"Error attaching files in update: {e}")
                # We don't fail the request if just attachment failed, but good to know
            
            # Sync related_contact from stage_data
            instance = self.get_object()
            self._sync_related_contact(instance)
                
        return response

    def _sync_related_contact(self, work_order):
        """
        Sync related_contact field from stage_data['contact_id'].
        This ensures backward compatibility with the checkout flow.
        """
        if work_order.stage_data and isinstance(work_order.stage_data, dict):
            contact_id = work_order.stage_data.get('contact_id')
            if contact_id:
                from contacts.models import Contact
                try:
                    contact = Contact.objects.get(id=contact_id)
                    if work_order.related_contact != contact:
                        work_order.related_contact = contact
                        work_order.save(update_fields=['related_contact'])
                except Contact.DoesNotExist:
                    pass

    def destroy(self, request, *args, **kwargs):
        """
        Overridden to allow deletion only in early stages and without linked documents.
        """
        instance = self.get_object()
        
        # 1. Stage restriction: Only allow in MATERIAL_ASSIGNMENT
        if instance.current_stage != WorkOrder.Stage.MATERIAL_ASSIGNMENT:
            return Response({
                'error': 'Solo se pueden eliminar órdenes en etapa de Asignación de Materiales. Para otras etapas, use la opción Anular.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # 2. Document restriction: Check for linked POs
        if instance.purchase_orders.exists():
            return Response({
                'error': 'No se puede eliminar una orden con Órdenes de Compra generadas. Anule la OT en su lugar.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        """Annul an OT and reverse its effects"""
        work_order = self.get_object()
        try:
            notes = request.data.get('notes', '')
            WorkOrderService.annul_work_order(
                work_order=work_order,
                user=request.user,
                notes=notes
            )
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        """Transition OT to next stage with optional data"""
        work_order = self.get_object()
        try:
            next_stage = request.data.get('next_stage')
            notes = request.data.get('notes', '')
            data = request.data.get('data', {})
            
            # If data is a string (due to multipart/form-data), parse it as JSON
            if isinstance(data, str):
                import json
                try:
                    data = json.loads(data)
                except:
                    data = {}
            
            # Find the stage choice
            stage_match = None
            for choice, label in WorkOrder.Stage.choices:
                if choice == next_stage:
                    stage_match = choice
                    break
            
            if not stage_match:
                return Response({'error': f'Etapa inválida: {next_stage}'}, status=status.HTTP_400_BAD_REQUEST)

            # Validation: Stock Availability for Stage Transition
            if work_order.current_stage == 'MATERIAL_APPROVAL' and next_stage not in ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'CANCELLED']:
                # The user is trying to move forward from Stock Approval
                serializer = WorkOrderSerializer(work_order)
                materials = serializer.data.get('materials', [])
                for m in materials:
                    if not m.get('is_available', False):
                        return Response({
                            'error': f"No hay suficiente stock para el componente: {m.get('component_name')}. "
                                     f"Requerido: {m.get('quantity_planned')} {m.get('uom_name')}, "
                                     f"Disponible: {m.get('stock_available')}."
                        }, status=status.HTTP_400_BAD_REQUEST)

            WorkOrderService.transition_to(
                work_order=work_order,
                next_stage=stage_match,
                user=request.user,
                notes=notes,
                data=data,
                files=request.FILES
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

    @action(detail=True, methods=['post'])
    def add_material(self, request, pk=None):
        """Add a material manually to the Work Order"""
        work_order = self.get_object()
        try:
            product_id = request.data.get('product_id')
            quantity = Decimal(str(request.data.get('quantity')))
            uom_id = request.data.get('uom_id')
            
            # New fields
            is_outsourced = request.data.get('is_outsourced', False)
            supplier_id = request.data.get('supplier_id')
            unit_price = Decimal(str(request.data.get('unit_price', 0)))
            document_type = request.data.get('document_type', 'FACTURA')
            
            product = Product.objects.get(pk=product_id)
            uom = UoM.objects.get(pk=uom_id) if uom_id else None
            
            from contacts.models import Contact
            supplier = Contact.objects.get(pk=supplier_id) if supplier_id else None
            
            WorkOrderService.add_material(
                work_order=work_order,
                component=product,
                quantity=quantity,
                uom=uom,
                is_outsourced=is_outsourced,
                supplier=supplier,
                unit_price=unit_price,
                document_type=document_type
            )
            
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_material(self, request, pk=None):
        """Update a manually added material"""
        work_order = self.get_object()
        try:
            material_id = request.data.get('material_id')
            quantity = Decimal(str(request.data.get('quantity')))
            uom_id = request.data.get('uom_id')
            
            material = WorkOrderMaterial.objects.get(pk=material_id, work_order=work_order)
            material.quantity_planned = quantity
            if uom_id:
                material.uom_id = uom_id
            
            # New fields
            if 'is_outsourced' in request.data:
                material.is_outsourced = request.data.get('is_outsourced')
            if 'supplier_id' in request.data:
                material.supplier_id = request.data.get('supplier_id')
            if 'unit_price' in request.data:
                material.unit_price = Decimal(str(request.data.get('unit_price', 0)))
            if 'document_type' in request.data:
                material.document_type = request.data.get('document_type')
                
            material.save()
            
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def remove_material(self, request, pk=None):
        """Remove a manually added material"""
        work_order = self.get_object()
        try:
            material_id = request.data.get('material_id')
            material = WorkOrderMaterial.objects.get(pk=material_id, work_order=work_order)
            
            if material.source != 'MANUAL':
                return Response({'error': 'Solo se pueden eliminar materiales agregados manualmente.'}, status=status.HTTP_400_BAD_REQUEST)
                
            material.delete()
            return Response(WorkOrderSerializer(work_order).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_manual(self, request):
        """Create a manual OT"""
        try:
            product_id = request.data.get('product_id')
            quantity = Decimal(str(request.data.get('quantity')))
            description = request.data.get('description', '')
            warehouse_id = request.data.get('warehouse_id')
            uom_id = request.data.get('uom_id')
            stage_data = request.data.get('stage_data', {})
            
            product = Product.objects.get(pk=product_id)
            warehouse = Warehouse.objects.get(pk=warehouse_id) if warehouse_id else Warehouse.objects.first()
            uom = UoM.objects.get(pk=uom_id) if uom_id else None
            
            work_order = WorkOrderService.create_manual(
                product=product,
                quantity=quantity,
                description=description,
                warehouse=warehouse,
                uom=uom,
                stage_data=stage_data
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
