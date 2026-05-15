import logging
from rest_framework import viewsets, status, filters

logger = logging.getLogger(__name__)
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import WorkOrder, ProductionConsumption, BillOfMaterials, BillOfMaterialsLine, WorkOrderMaterial, WorkOrderTemplate, ScanToken
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
import django_filters

class WorkOrderFilterSet(FilterSet):
    due_date_after = django_filters.DateFilter(field_name='estimated_completion_date', lookup_expr='gte')
    due_date_before = django_filters.DateFilter(field_name='estimated_completion_date', lookup_expr='lte')
    my_tasks = django_filters.BooleanFilter(method='filter_my_tasks')

    class Meta:
        model = WorkOrder
        fields = ['status', 'due_date_after', 'due_date_before']

    def filter_my_tasks(self, queryset, name, value):
        if value and self.request and self.request.user.is_authenticated:
            from workflow.models import Task
            from django.contrib.contenttypes.models import ContentType
            from django.db.models import Q
            
            user = self.request.user
            ct = ContentType.objects.get_for_model(queryset.model)
            
            tasks = Task.objects.filter(
                content_type=ct,
                status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS]
            )
            
            q = Q(assigned_to=user)
            if user.groups.exists():
                q |= Q(assigned_group__in=user.groups.all())
                
            task_ids = tasks.filter(q).values_list('object_id', flat=True)
            return queryset.filter(id__in=task_ids)
        return queryset

from .serializers import (
    WorkOrderSerializer,
    ProductionConsumptionSerializer,
    BillOfMaterialsSerializer,
    BillOfMaterialsLineSerializer,
    WorkOrderTemplateSerializer,
)
from .services import WorkOrderService, WorkOrderPdfService, WorkOrderMetricsService
from inventory.models import Product, Warehouse, UoM
from decimal import Decimal
from django.db.models import Q, Sum
from django.http import HttpResponse
from reportlab.pdfgen import canvas
from io import BytesIO
from core.mixins import AuditHistoryMixin
from django.contrib.contenttypes.models import ContentType
from core.models import Attachment

class WorkOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = WorkOrderFilterSet
    search_fields = [
        'description', 'number',
        'product__name', 'product__code',
        'sale_order__customer__name', 'sale_order__customer__tax_id',
        'related_contact__name', 'related_contact__tax_id',
    ]
    queryset = WorkOrder.objects.select_related(
        'sale_order', 'sale_order__customer', 'related_contact', 'product', 'sale_line', 'warehouse'
    ).prefetch_related(
        'materials', 'materials__component', 'materials__uom', 'materials__purchase_line',
        'consumptions', 'stage_history', 'attachments'
    )
    serializer_class = WorkOrderSerializer

    def _build_stock_context(self, work_order):
        """
        Returns a dict {product_id: stock_float} for all storable materials in this OT,
        computed in a single aggregated query against the OT's warehouse.
        """
        from inventory.models import StockMove
        warehouse = work_order.warehouse
        if not warehouse:
            return {}

        component_ids = list(
            work_order.materials
            .exclude(component__product_type='SERVICE')
            .values_list('component_id', flat=True)
        )
        if not component_ids:
            return {}

        rows = (
            StockMove.objects
            .filter(warehouse=warehouse, product_id__in=component_ids)
            .values('product_id')
            .annotate(total=Sum('quantity'))
        )
        return {row['product_id']: float(row['total'] or 0.0) for row in rows}

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        context = self.get_serializer_context()
        context['stocks_by_product'] = self._build_stock_context(instance)
        serializer = self.get_serializer(instance, context=context)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """TASK-202: Delegate all creation logic to WorkOrderService.

        Keeps this view <= 20 LOC. Branch decisions (manual vs sale-linked vs
        fallback) live in WorkOrderService.create_from_request_payload().
        """
        try:
            work_order = WorkOrderService.create_from_request_payload(
                request.data, request.FILES, request.user
            )
            if work_order is not None:
                return Response(WorkOrderSerializer(work_order).data, status=status.HTTP_201_CREATED)
            # Fallback: no recognised payload -> standard DRF create
            return super().create(request, *args, **kwargs)
        except Exception as e:
            logger.exception("Error creating WorkOrder")
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
                        if not instance.stage_data: instance.stage_data = {}
                        instance.stage_data['approval_attachment'] = approval_file.name
                        instance.save()

                    # 3. Final Photo
                    final_photo = request.FILES.get('final_photo')
                    if final_photo:
                        Attachment.objects.create(
                            file=final_photo,
                            original_filename=f'[final_photo] {final_photo.name}',
                            content_type=content_type,
                            object_id=instance.id,
                            user=request.user
                        )
                        if not instance.stage_data: instance.stage_data = {}
                        instance.stage_data['final_photo'] = final_photo.name
                        instance.save()
                        
            except Exception as e:
                logger.exception("Error attaching files in update for WorkOrder %s", instance.pk)
            
                
        return response


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
            
        # 3. Cleanup: Delete associated Tasks and Notifications
        # Since these are GenericForeignKey, CASCADE doesn't happen automatically
        from workflow.models import Task, Notification
        content_type = ContentType.objects.get_for_model(instance)
        
        Task.objects.filter(content_type=content_type, object_id=instance.id).delete()
        Notification.objects.filter(content_type=content_type, object_id=instance.id).delete()
            
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
    def rectify(self, request, pk=None):
        """
        Declare real quantities consumed and produced before finalizing the OT.
        Must be called while the OT is in RECTIFICATION stage.
        
        Body:
            material_adjustments: list of {material_id, actual_quantity}  (optional)
            produced_quantity: number  (only for manual OTs with track_inventory=True)
            notes: string  (optional)
        """
        work_order = self.get_object()
        try:
            material_adjustments = request.data.get('material_adjustments', [])
            outsourced_adjustments = request.data.get('outsourced_adjustments', [])
            produced_quantity = request.data.get('produced_quantity')
            notes = request.data.get('notes', '')
            
            WorkOrderService.rectify_production(
                work_order=work_order,
                material_adjustments=material_adjustments,
                outsourced_adjustments=outsourced_adjustments,
                produced_quantity=produced_quantity,
                user=request.user,
                notes=notes
            )
            work_order.refresh_from_db()
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
                ctx = self.get_serializer_context()
                ctx['stocks_by_product'] = self._build_stock_context(work_order)
                serializer = WorkOrderSerializer(work_order, context=ctx)
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


    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """TASK-302: Duplicate a Work Order"""
        work_order = self.get_object()
        try:
            new_wo = WorkOrderService.duplicate(work_order=work_order, user=request.user)
            return Response(WorkOrderSerializer(new_wo).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception("Error duplicating WorkOrder")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def metrics(self, request):
        """TASK-204: Production Metrics Endpoint"""
        from_date = request.query_params.get('from')
        to_date = request.query_params.get('to')
        try:
            data = WorkOrderMetricsService.get_metrics(from_date, to_date)
            return Response(data)
        except Exception as e:
            logger.exception("Error calculating metrics")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def print_pdf(self, request, pk=None):
        """TASK-203: Generate a PDF for the Work Order using WeasyPrint"""
        work_order = self.get_object()
        
        try:
            pdf_bytes = WorkOrderPdfService.generate_pdf(work_order, request)
            filename = f"OT-{work_order.number}.pdf"
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            return response
        except Exception as e:
            logger.exception("Error generating PDF")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

    @action(detail=False, methods=['post'], url_path='bulk_transition')
    def bulk_transition(self, request):
        """TASK-306: Advance multiple OTs to the same next stage."""
        ids = request.data.get('ids', [])
        next_stage = request.data.get('next_stage')
        if not ids or not next_stage:
            return Response({'error': 'ids y next_stage son requeridos'}, status=status.HTTP_400_BAD_REQUEST)
        results = {'ok': [], 'errors': []}
        for pk in ids:
            try:
                wo = WorkOrder.objects.get(pk=pk)
                WorkOrderService.transition_to(wo, next_stage)
                results['ok'].append(pk)
            except Exception as e:
                results['errors'].append({'id': pk, 'error': str(e)})
        return Response(results)

    @action(detail=False, methods=['post'], url_path='bulk_print')
    def bulk_print(self, request):
        """TASK-306: Print a merged PDF for multiple OTs."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'ids es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        orders = WorkOrder.objects.filter(pk__in=ids).select_related('warehouse', 'sale_line__order__customer')
        if not orders.exists():
            return Response({'error': 'No se encontraron órdenes'}, status=status.HTTP_404_NOT_FOUND)
        try:
            merged = WorkOrderPdfService.generate_bulk_pdf(list(orders))
            response = HttpResponse(merged, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="ots_bulk_{len(ids)}.pdf"'
            return response
        except Exception as e:
            logger.exception("Error generating bulk PDF")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='generate_scan_token')
    def generate_scan_token(self, request, pk=None):
        """TASK-313: Generate a short-lived scan token for the QR on the printed PDF."""
        import secrets
        from django.utils import timezone
        from datetime import timedelta
        order = self.get_object()
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=24)
        scan_token = ScanToken.objects.create(work_order=order, token=token, expires_at=expires_at)
        base_url = request.build_absolute_uri('/').rstrip('/')
        scan_url = f"{base_url}/api/production/orders/scan/{token}/"
        return Response({'token': token, 'scan_url': scan_url, 'expires_at': scan_token.expires_at})

    @action(detail=False, methods=['get', 'post'], url_path=r'scan/(?P<token>[^/.]+)',
            permission_classes=[], authentication_classes=[])
    def scan(self, request, token=None):
        """TASK-313: Tokenized scan endpoint — no auth required (token is the credential)."""
        from django.utils import timezone
        try:
            scan_token = ScanToken.objects.select_related('work_order').get(token=token)
        except ScanToken.DoesNotExist:
            return Response({'error': 'Token inválido'}, status=status.HTTP_404_NOT_FOUND)
        if not scan_token.is_valid():
            return Response({'error': 'Token expirado o ya utilizado'}, status=status.HTTP_410_GONE)
        order = scan_token.work_order
        if request.method == 'GET':
            return Response({
                'order_id': order.pk,
                'number': order.number,
                'description': order.description,
                'current_stage': order.current_stage,
                'status': order.status,
            })
        next_stage = request.data.get('next_stage')
        if not next_stage:
            return Response({'error': 'next_stage es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            WorkOrderService.transition_to(order, next_stage, user=None)
            scan_token.used_at = timezone.now()
            scan_token.save(update_fields=['used_at'])
            return Response({'ok': True, 'new_stage': next_stage})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        """TASK-307: Unified comment feed for an OT (includes linked NV comments)."""
        from django.contrib.contenttypes.models import ContentType
        from workflow.models import Comment
        from workflow.serializers import CommentSerializer

        order = self.get_object()
        wo_ct = ContentType.objects.get_for_model(WorkOrder)

        if request.method == 'GET':
            qs = Comment.objects.filter(content_type=wo_ct, object_id=order.pk)
            if order.sale_order_id:
                from sales.models import SaleOrder
                so_ct = ContentType.objects.get_for_model(SaleOrder)
                so_qs = Comment.objects.filter(content_type=so_ct, object_id=order.sale_order_id)
                qs = (qs | so_qs).order_by('created_at')
            serializer = CommentSerializer(qs, many=True)
            return Response(serializer.data)

        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'text es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        comment = Comment.objects.create(
            content_type=wo_ct,
            object_id=order.pk,
            user=request.user,
            text=text,
        )
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def create_manual(self, request):
        """Create a manual OT"""
        try:
            import json
            product_id = request.data.get('product_id')
            quantity = Decimal(str(request.data.get('quantity')))
            description = request.data.get('description', '')
            warehouse_id = request.data.get('warehouse_id')
            uom_id = request.data.get('uom_id')
            stage_data = request.data.get('stage_data', {})
            
            if isinstance(stage_data, str):
                try:
                    stage_data = json.loads(stage_data)
                except (json.JSONDecodeError, TypeError):
                    stage_data = {}
            
            product = Product.objects.get(pk=product_id)
            
            # Validate BOM requirement for Express products/variants
            if product.requires_bom_validation:
                error_msg = f"El producto '{product.name}' es Express y requiere un BOM asignado antes de crear una Orden de Trabajo."
                if product.parent_template:
                    error_msg += " Por favor, asigne un BOM a esta variante desde el formulario de producto."
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)
            
            warehouse = Warehouse.objects.get(pk=warehouse_id) if warehouse_id else Warehouse.objects.first()
            if not uom_id:
                return Response({'error': 'La unidad de medida es requerida para fabricaciones manuales.'}, status=status.HTTP_400_BAD_REQUEST)
                
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
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['active']
    search_fields = ['name', 'product__name', 'product__code']

    def get_queryset(self):
        queryset = super().get_queryset()
        product_id = self.request.query_params.get('product_id')
        parent_id = self.request.query_params.get('parent_id')
        
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        elif parent_id:
            queryset = queryset.filter(Q(product_id=parent_id) | Q(product__parent_template_id=parent_id))
            
        return queryset.select_related('product', 'product__parent_template')
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
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


class WorkOrderTemplateViewSet(viewsets.ModelViewSet):
    """TASK-312: CRUD for WorkOrderTemplate + save_from_order action."""
    queryset = WorkOrderTemplate.objects.select_related('customer').all()
    serializer_class = WorkOrderTemplateSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        customer_id = self.request.query_params.get('customer_id')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        return qs

    @action(detail=False, methods=['post'], url_path='save_from_order')
    def save_from_order(self, request):
        """Create a template from an existing WorkOrder."""
        order_id = request.data.get('order_id')
        name = (request.data.get('name') or '').strip()
        if not order_id or not name:
            return Response({'error': 'order_id y name son requeridos'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            order = WorkOrder.objects.get(pk=order_id)
        except WorkOrder.DoesNotExist:
            return Response({'error': 'OT no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        default_data = {
            'description': order.description,
            'stage_data': order.stage_data or {},
            'materials': [
                {
                    'component_id': m.component_id,
                    'quantity_planned': float(m.quantity_planned),
                    'uom_id': m.uom_id,
                    'is_outsourced': m.is_outsourced,
                    'unit_price': float(m.unit_price),
                    'supplier_id': m.supplier_id,
                }
                for m in order.materials.all()
            ],
        }
        template = WorkOrderTemplate.objects.create(
            name=name,
            customer=order.sale_order.customer if order.sale_order else None,
            default_data=default_data,
        )
        return Response(WorkOrderTemplateSerializer(template).data, status=status.HTTP_201_CREATED)
