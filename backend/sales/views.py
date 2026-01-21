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
from core.views import AuditHistoryMixin

class SalesSettingsViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
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

class SaleOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = SaleOrder.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateSaleOrderSerializer
        return SaleOrderSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        
        # Parse files for lines if any
        line_files = {}
        if request.FILES:
            for key, file_obj in request.FILES.items():
                parts = key.split('_')
                if len(parts) >= 3 and parts[0] == 'line':
                    try:
                        line_idx = int(parts[1])
                        file_type = parts[2]
                        if line_idx not in line_files:
                            line_files[line_idx] = {'design': [], 'approval': None}
                        if file_type == 'design':
                            line_files[line_idx]['design'].append(file_obj)
                        elif file_type == 'approval':
                            line_files[line_idx]['approval'] = file_obj
                    except ValueError:
                        continue
        
        # Explicitly confirm sale (this creates OTs and attaches files)
        SalesService.confirm_sale(order, line_files=line_files)
        
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
            # Support both old and new format for safer transition
            line_quantities = request.data.get('line_quantities')
            if line_quantities and isinstance(line_quantities, dict):
                line_data = [{'line_id': int(k), 'quantity': v} for k, v in line_quantities.items()]
            else:
                line_data = request.data.get('line_data', [])
            
            warehouse = Warehouse.objects.get(pk=warehouse_id)
            
            delivery = SalesService.partial_dispatch(
                order=order,
                warehouse=warehouse,
                line_data=line_data,
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

    @action(detail=True, methods=['post'])
    def register_note(self, request, pk=None):
        order = self.get_object()
        
        # Manually handle multipart/form-data requiring json parsing for complex fields
        data = request.data.dict() if hasattr(request.data, 'dict') else request.data.copy()
        
        # If accessing via multipart, lists might be strings
        if 'return_items' in data and isinstance(data['return_items'], str):
            import json
            try:
                data['return_items'] = json.loads(data['return_items'])
            except:
                pass
                
        from purchasing.serializers import NoteCreationSerializer
        serializer = NoteCreationSerializer(data=data)
        
        if serializer.is_valid():
            try:
                val = serializer.validated_data
                invoice = SalesService.create_note(
                    order=order,
                    note_type=val['note_type'],
                    amount_net=val['amount_net'],
                    amount_tax=val['amount_tax'],
                    document_number=val['document_number'],
                    document_attachment=request.FILES.get('document_attachment'),
                    return_items=val.get('return_items'),
                    original_invoice_id=val.get('original_invoice_id')
                )
                
                from billing.serializers import InvoiceSerializer
                return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def register_merchandise_return(self, request, pk=None):
        """
        Register merchandise return for a sale order.
        Only available for DRAFT invoices.
        """
        order = self.get_object()
        
        return_items = request.data.get('return_items', [])
        warehouse_id = request.data.get('warehouse_id')
        notes = request.data.get('notes', '')
        
        if not warehouse_id:
            return Response(
                {'error': 'Se requiere especificar la bodega.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not return_items:
            return Response(
                {'error': 'Debe especificar al menos un producto a devolver.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from sales.return_services import SalesReturnService
            warehouse = Warehouse.objects.get(id=warehouse_id)
            
            return_delivery = SalesReturnService.register_merchandise_return(
                order, return_items, warehouse, notes
            )
            
            return Response({
                'message': 'Devolución registrada exitosamente',
                'return_delivery_id': return_delivery.id,
                'return_delivery': SaleDeliverySerializer(return_delivery).data
            }, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        order = self.get_object()
        force = request.data.get('force', False)
        try:
            SalesService.annul_sale_order(order, force=force)
            return Response(SaleOrderSerializer(order).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SaleDeliveryViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = SaleDelivery.objects.all()
    serializer_class = SaleDeliverySerializer

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        delivery = self.get_object()
        try:
            SalesService.annul_delivery(delivery)
            return Response(SaleDeliverySerializer(delivery).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
