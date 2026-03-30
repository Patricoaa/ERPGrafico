from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import SaleOrder, SalesSettings, SaleDelivery, SaleReturn
from .serializers import (
    SaleOrderSerializer, 
    CreateSaleOrderSerializer, 
    SalesSettingsSerializer,
    SaleDeliverySerializer,
    SaleReturnSerializer
)
from .services import SalesService
from inventory.models import Warehouse
from django.core.exceptions import ValidationError
from decimal import Decimal

from core.mixins import BulkImportMixin
from core.mixins import AuditHistoryMixin

from rest_framework.permissions import IsAuthenticated

class SalesSettingsViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = SalesSettings.objects.all()
    serializer_class = SalesSettingsSerializer

    def get_permissions(self):
        if self.action == 'current' and self.request.method == 'GET':
            return [IsAuthenticated()]
        return super().get_permissions()

    # Fields that belong to AccountingSettings but are surfaced through this endpoint
    ACCOUNTING_SETTINGS_FIELDS = [
        'default_revenue_account',
        'default_service_revenue_account',
        'default_subscription_revenue_account',
        'pos_cash_difference_gain_account',
        'pos_cash_difference_loss_account',
        'pos_counting_error_account',
        'pos_theft_account',
        'pos_rounding_adjustment_account',
        'pos_tip_account',
        'pos_cashback_error_account',
        'pos_system_error_account',
        'pos_partner_withdrawal_account',
        'pos_other_inflow_account',
        'pos_other_outflow_account',
        'pos_default_credit_percentage',
        'terminal_commission_bridge_account',
        'terminal_iva_bridge_account',
        'credit_auto_block_days',
        'default_uncollectible_expense_account',
    ]

    def _get_accounting_settings_data(self):
        """Read account fields from AccountingSettings and return them as a plain dict."""
        from accounting.models import AccountingSettings
        acc_settings = AccountingSettings.objects.first()
        if not acc_settings:
            return {field: None for field in self.ACCOUNTING_SETTINGS_FIELDS}

        result = {}
        for field in self.ACCOUNTING_SETTINGS_FIELDS:
            value = getattr(acc_settings, field, None)
            # FK fields hold Account instances; return their PK so the frontend
            # receives the same format as when reading AccountingSettings directly.
            if hasattr(value, 'pk'):
                result[field] = value.pk
            else:
                result[field] = value
        return result

    def _update_accounting_settings(self, data):
        """Write accounting account fields back to AccountingSettings."""
        from accounting.models import AccountingSettings, Account
        acc_settings, _ = AccountingSettings.objects.get_or_create()

        changed = False
        for field in self.ACCOUNTING_SETTINGS_FIELDS:
            if field not in data:
                continue
            raw = data[field]

            # Detect if this is a FK field using Django's meta API
            try:
                model_field = AccountingSettings._meta.get_field(field)
                is_fk = model_field.is_relation
            except Exception:
                # Fallback heuristic: account fields are FKs
                is_fk = field.endswith('_account')

            if is_fk:
                if raw is None or raw == '':
                    setattr(acc_settings, field, None)
                else:
                    try:
                        account = Account.objects.get(pk=int(raw))
                        setattr(acc_settings, field, account)
                    except (Account.DoesNotExist, ValueError, TypeError):
                        continue
            else:
                setattr(acc_settings, field, raw)
            changed = True

        if changed:
            acc_settings.save()

    @action(detail=False, methods=['get', 'put', 'patch'])
    def current(self, request):
        obj = SalesSettings.objects.first()
        if not obj:
            obj = SalesSettings.objects.create()

        if request.method == 'GET':
            serializer = self.get_serializer(obj)
            data = serializer.data
            # Merge accounting settings fields so the frontend gets everything in one call
            data.update(self._get_accounting_settings_data())
            return Response(data)

        # For PUT / PATCH: split the payload between both models
        sales_fields = {k: v for k, v in request.data.items() if k not in self.ACCOUNTING_SETTINGS_FIELDS}
        accounting_fields = {k: v for k, v in request.data.items() if k in self.ACCOUNTING_SETTINGS_FIELDS}

        # Update SalesSettings (native fields)
        if sales_fields:
            serializer = self.get_serializer(obj, data=sales_fields, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        
        # Update AccountingSettings (account fields)
        if accounting_fields:
            self._update_accounting_settings(accounting_fields)

        # Return merged response
        serializer = self.get_serializer(obj)
        data = serializer.data
        data.update(self._get_accounting_settings_data())
        return Response(data)

from core.api.permissions import StandardizedModelPermissions

class SaleOrderViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = SaleOrder.objects.all()
    permission_classes = [StandardizedModelPermissions]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateSaleOrderSerializer
        return SaleOrderSerializer

    def create(self, request, *args, **kwargs):
        # Validate POS Session requirement
        # Logic: 
        # 1. If pos_session_id provided -> Check if it exists and is OPEN (allows shared sessions)
        # 2. If NOT provided -> Check if user has their OWN open session
        
        pos_session_id = request.data.get('pos_session_id')
        from treasury.models import POSSession
        
        session = None
        if pos_session_id:
            # Shared session scenario
            session = POSSession.objects.filter(id=pos_session_id, status='OPEN').first()
            if not session:
                 return Response(
                    {'error': 'La sesión de caja especificada no es válida o está cerrada.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Personal session scenario
            session = POSSession.objects.filter(user=request.user, status='OPEN').last()
            if not session:
                 return Response(
                    {'error': 'Debe tener una sesión de caja activa para crear ventas (o seleccionar una compartida).'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # PIN Validation & Context Logic
        pos_pin = request.data.get('pos_pin')
        from core.services import PINService
        
        salesperson = request.user
        
        if pos_pin:
            # If PIN is provided, the salesperson is the owner of that PIN (Action Signing)
            pin_user = PINService.validate_pin(pos_pin)
            if not pin_user:
                 return Response(
                    {'error': 'PIN de seguridad incorrecto.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            salesperson = pin_user
        else:
            # If no PIN provided, check if current user is the Host of the session
            # Rule: Host sessions are considered "Shared Terminals" and require PIN signatures.
            if request.user == session.user:
                 return Response(
                    {'error': 'Se requiere PIN de autorización para confirmar la venta en este terminal.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            # Satellite PC logic: User is already identified via JWT and is NOT the host.
            salesperson = request.user

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save(pos_session=session, salesperson=salesperson)
        
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
        print(f"DEBUG: register_note reached for order {pk}")
        order = self.get_object()
        
        # Manually handle multipart/form-data requiring json parsing for complex fields
        data = request.data.dict() if hasattr(request.data, 'dict') else request.data.copy()
        
        # If accessing via multipart, lists might be strings
        if 'return_items' in data and isinstance(data['return_items'], str):
            import json
            try:
                data['return_items'] = json.loads(data['return_items'])
            except Exception as e:
                print(f"DEBUG: Error parsing return_items: {e}")
                pass
        
        print(f"DEBUG: data['return_items'] type: {type(data.get('return_items'))}")
        print(f"DEBUG: data['return_items'] value: {data.get('return_items')}")
                
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

    @action(detail=False, methods=['get'])
    def credit_history(self, request):
        """
        Global history of credit assignments across all customers.
        """
        history = SaleOrder.objects.filter(
            credit_assignment_origin__isnull=False
        ).order_by('-date', '-created_at')
        
        page = self.paginate_queryset(history)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(history[:100], many=True)
        return Response(serializer.data)

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

    @action(detail=True, methods=['post'])
    def write_off(self, request, pk=None):
        """Castigate the debt of this specific Sale Order."""
        from accounting.models import AccountingSettings, JournalEntry, JournalItem
        from treasury.models import TreasuryMovement
        from django.db import transaction
        
        order = self.get_object()
        
        # Calculate current balance
        payments = order.payments.filter(is_pending_registration=False)
        paid_in = sum((p.amount for p in payments if p.movement_type in ['INBOUND', 'ADJUSTMENT']), Decimal('0'))
        paid_out = sum((p.amount for p in payments if p.movement_type == 'OUTBOUND'), Decimal('0'))
        balance = order.effective_total - (paid_in - paid_out)

        if balance <= 0:
            return Response({"error": "Esta orden no tiene saldo pendiente para castigar."}, status=400)

        settings = AccountingSettings.objects.first()
        if not settings or not settings.default_uncollectible_expense_account:
            return Response({"error": "No hay una cuenta de gasto por incobrabilidad configurada."}, status=400)

        contact = order.customer
        receivable_account = contact.account_receivable or settings.default_receivable_account
        if not receivable_account:
             return Response({"error": "No se encontró una cuenta por cobrar configurada."}, status=400)

        try:
            with transaction.atomic():
                entry = JournalEntry.objects.create(
                    description=f"Castigo de documento {order.number}: {contact.name}",
                    reference=f"CASTIGO-{order.number}",
                    status='POSTED'
                )
                JournalItem.objects.create(
                    entry=entry,
                    account=settings.default_uncollectible_expense_account,
                    label=f"Pérdida por incobrabilidad {order.number}",
                    debit=balance,
                    credit=0
                )
                JournalItem.objects.create(
                    entry=entry,
                    account=receivable_account,
                    partner=contact,
                    partner_name=contact.name,
                    label=f"Cierre de deuda {order.number}",
                    debit=0,
                    credit=balance
                )
                TreasuryMovement.objects.create(
                    movement_type='ADJUSTMENT',
                    payment_method='WRITE_OFF',
                    amount=balance,
                    contact=contact,
                    sale_order=order,
                    journal_entry=entry,
                    reference="CASTIGO-DOC",
                    notes=f"Castigo individual de documento (Asiento {entry.display_id})",
                    is_pending_registration=False,
                )
                
                # Block the customer's credit if not default
                if not contact.is_default_customer:
                    contact.credit_blocked = True
                    contact.credit_auto_blocked = False
                    contact.credit_risk_level = 'CRITICAL'
                    contact.save()
            return Response({
                "message": f"Documento {order.number} castigado.",
                "journal_entry": entry.display_id,
                "amount": str(balance)
            })
        except Exception as e:
            return Response({"error": f"Error interno: {str(e)}"}, status=500)

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

class SaleReturnViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = SaleReturn.objects.all()
    serializer_class = SaleReturnSerializer

    @action(detail=True, methods=['post'])
    def annul(self, request, pk=None):
        doc = self.get_object()
        try:
            from sales.return_services import ReturnService
            ReturnService.annul_return(doc.id)
            return Response(SaleReturnSerializer(doc).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
