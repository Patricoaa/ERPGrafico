from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models
from core.mixins import AuditHistoryMixin
from .models import Contact
from .serializers import ContactSerializer, ContactListSerializer


class ContactViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    """
    ViewSet for managing contacts.
    Supports filtering by type (customer/supplier/both/none).
    """
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_default_customer', 'is_default_vendor']
    search_fields = ['name', 'tax_id', 'email', 'contact_name', 'code']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def destroy(self, request, *args, **kwargs):
        contact = self.get_object()
        if contact.is_default_customer or contact.is_default_vendor:
            from rest_framework import status
            return Response(
                {"error": "No se puede eliminar un cliente o proveedor por defecto del sistema."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)
    
    def get_serializer_class(self):
        """Use lightweight serializer for list action"""
        if self.action == 'list':
            return ContactListSerializer
        return ContactSerializer
    
    def get_queryset(self):
        """
        Filter contacts by type if requested.
        ?type=customer - only contacts with sale orders
        ?type=supplier - only contacts with purchase orders
        ?type=both - contacts with both sale and purchase orders
        ?type=none - contacts without any orders
        
        Also implements custom RUT search normalization.
        """
        queryset = super().get_queryset()
        
        # Custom RUT normalization for search
        search_param = self.request.query_params.get('search', None)
        if search_param:
            # Normalize the search term by removing dots, hyphens, and spaces
            normalized_search = search_param.replace('.', '').replace('-', '').replace(' ', '')
            
            # Build a complex query that searches in multiple fields
            # For tax_id, we use a database function to normalize it for comparison
            from django.db.models.functions import Replace
            
            queryset = queryset.annotate(
                normalized_tax_id=Replace(
                    Replace(
                        Replace('tax_id', models.Value('.'), models.Value('')),
                        models.Value('-'), models.Value('')
                    ),
                    models.Value(' '), models.Value('')
                )
            ).filter(
                models.Q(name__icontains=search_param) |
                models.Q(email__icontains=search_param) |
                models.Q(contact_name__icontains=search_param) |
                models.Q(code__icontains=search_param) |
                models.Q(normalized_tax_id__icontains=normalized_search)
            )
        
        # Type filtering
        contact_type = self.request.query_params.get('type', None)
        
        if contact_type:
            contact_type = contact_type.upper()
            if contact_type == 'CUSTOMER':
                # Include contacts that are customers or have no role yet (potential)
                # Exclude only those who are strictly suppliers
                queryset = queryset.filter(
                    models.Q(sale_orders__isnull=False) | 
                    models.Q(sale_orders__isnull=True, purchase_orders__isnull=True)
                ).distinct()
            elif contact_type == 'SUPPLIER':
                # Include contacts that are suppliers or have no role yet
                # Exclude only those who are strictly customers
                queryset = queryset.filter(
                    models.Q(purchase_orders__isnull=False) | 
                    models.Q(sale_orders__isnull=True, purchase_orders__isnull=True)
                ).distinct()
            elif contact_type == 'BOTH':
                # Has both sale and purchase orders
                queryset = queryset.filter(sale_orders__isnull=False, purchase_orders__isnull=False).distinct()
            elif contact_type == 'NONE':
                queryset = queryset.filter(sale_orders__isnull=True, purchase_orders__isnull=True)

        has_terminal_payment_method = self.request.query_params.get('has_terminal_payment_method', None)
        if has_terminal_payment_method == 'true':
            queryset = queryset.filter(
                terminal_payment_methods__is_terminal=True,
                terminal_payment_methods__is_active=True
            ).distinct()
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def customers(self, request):
        """Get all contacts that are customers (have sale orders)"""
        contacts = Contact.objects.filter(sale_orders__isnull=False).distinct()
        serializer = self.get_serializer(contacts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def suppliers(self, request):
        """Get all contacts that are suppliers (have purchase orders)"""
        contacts = Contact.objects.filter(purchase_orders__isnull=False).distinct()
        serializer = self.get_serializer(contacts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def insights(self, request, pk=None):
        """
        Get insights for a specific contact including:
        - Sales summary (invoices, sale orders)
        - Purchases summary (purchase orders)
        - Work orders summary (as customer or related contact)
        """
        contact = self.get_object()
        
        # Sales data (NV)
        sale_orders = contact.sale_orders.all().order_by('-date')
        
        # Purchase data (PO)
        purchase_orders = contact.purchase_orders.all().order_by('-date')
        
        # Work orders Strictly as related contact (NOT as sale customer)
        # These are the ones for the "Contacto Relacionado" tab
        work_orders_as_related = contact.related_work_orders.exclude(
            sale_order__customer=contact
        ).order_by('-created_at')
        
        # Serialize data
        from purchasing.serializers import PurchaseOrderSerializer
        from production.serializers import WorkOrderSerializer
        from sales.serializers import SaleOrderSerializer
        
        return Response({
            'contact': ContactSerializer(contact).data,
            'sales': {
                'count': sale_orders.count(),
                'orders': SaleOrderSerializer(sale_orders[:50], many=True).data
            },
            'purchases': {
                'count': purchase_orders.count(),
                'orders': PurchaseOrderSerializer(purchase_orders[:50], many=True).data
            },
            'work_orders': {
                'count': work_orders_as_related.count(),
                'orders': WorkOrderSerializer(work_orders_as_related[:50], many=True).data
            }
        })

    @action(detail=True, methods=['get'])
    def credit_ledger(self, request, pk=None):
        """
        Returns a list of unpaid credit orders for the contact,
        enriched with due_date and aging_bucket.
        """
        from decimal import Decimal
        from datetime import timedelta
        from django.utils import timezone
        from sales.serializers import SaleOrderSerializer
        
        contact = self.get_object()

        today = timezone.now().date()
        payment_term = contact.credit_days or 30

        # Get all non-draft, non-cancelled orders
        orders = contact.sale_orders.exclude(status__in=['DRAFT', 'CANCELLED']).order_by('-date')

        ledger_data = []
        for order in orders:
            payments = order.payments.filter(is_pending_registration=False)
            paid_in = sum((p.amount for p in payments if p.movement_type in ['INBOUND', 'ADJUSTMENT']), Decimal('0'))
            paid_out = sum((p.amount for p in payments if p.movement_type == 'OUTBOUND'), Decimal('0'))
            payments_net = paid_in - paid_out
            balance = order.effective_total - payments_net

            # Include if balance > 0 OR if specifically written off (Blacklist case)
            is_written_off = payments.filter(payment_method='WRITE_OFF').exists()
            include_all = request.query_params.get('include_all', 'false') == 'true'

            if balance > 0 or (is_written_off and include_all):
                order_date = order.date
                if hasattr(order_date, 'date'):
                    order_date = order_date.date()
                due_date = order_date + timedelta(days=payment_term)
                days_overdue = (today - due_date).days

                if balance <= 0 and is_written_off:
                    aging_bucket = 'written_off' # Special bucket for blacklist view
                elif days_overdue <= 0:
                    aging_bucket = 'current'
                elif days_overdue <= 30:
                    aging_bucket = 'overdue_30'
                elif days_overdue <= 60:
                    aging_bucket = 'overdue_60'
                elif days_overdue <= 90:
                    aging_bucket = 'overdue_90'
                else:
                    aging_bucket = 'overdue_90plus'

                ledger_data.append({
                    **SaleOrderSerializer(order).data,
                    'due_date': due_date,
                    'days_overdue': max(0, days_overdue),
                    'aging_bucket': aging_bucket,
                    'balance': str(balance),
                    'paid_amount': str(payments_net),
                })

        return Response(ledger_data)


    @action(detail=False, methods=['get'])
    def credit_portfolio(self, request):
        """
        Returns a cartera view: all contacts with active credit or outstanding balance.
        Includes per-contact aging breakdown and aggregate summary KPIs.
        """
        from decimal import Decimal

        # Fetch contacts based on blacklist filter
        is_blacklist = request.query_params.get('blacklist', 'false') == 'true'
        
        if is_blacklist:
            contacts = Contact.objects.filter(credit_blocked=True).distinct()
        else:
            # Fetch contacts that have credit enabled OR have any credit balance used (sale orders)
            contacts = Contact.objects.filter(
                models.Q(credit_enabled=True) | 
                models.Q(credit_limit__isnull=False) |
                models.Q(sale_orders__isnull=False)
            ).filter(credit_blocked=False).distinct()

        from .serializers import ContactSerializer
        contact_list = []
        
        summary = {
            'total_debt': Decimal('0'),
            'total_exposure': Decimal('0'),
            'potential_loss': Decimal('0'),
            'current': Decimal('0'),
            'overdue_30': Decimal('0'),
            'overdue_60': Decimal('0'),
            'overdue_90': Decimal('0'),
            'overdue_90plus': Decimal('0'),
            'count_with_credit': 0,
            'count_debtors': 0,
            'count_overdue': 0,
            'risk_distribution': {
                'LOW': 0,
                'MEDIUM': 0,
                'HIGH': 0,
                'CRITICAL': 0,
            }
        }

        for contact in contacts:
            balance_used = contact.credit_balance_used
            aging = contact.credit_aging
            
            if is_blacklist:
                # For blacklisted clients, the active balance is 0 because the debt was castigada,
                # but we still want to show the castigado amount as the risk amount minus any recoveries.
                from django.db.models import Sum
                write_offs = contact.treasury_movements.filter(
                    payment_method='WRITE_OFF', 
                    is_pending_registration=False
                ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
                recoveries = contact.treasury_movements.filter(
                    reference='RECUPERACION',
                    is_pending_registration=False
                ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
                balance_used = write_offs - recoveries
            
            # Include contacts that have credit configured OR have an actual balance OR are blacklisted
            if balance_used > 0 or contact.credit_enabled or contact.credit_limit or is_blacklist:
                summary['count_with_credit'] += 1
                
                # Analytics
                if contact.credit_limit:
                    summary['total_exposure'] += contact.credit_limit
                
                # Risk level tracking
                risk_level = contact.credit_risk_level
                summary['risk_distribution'][risk_level] += 1
                
                if risk_level == 'CRITICAL':
                    summary['potential_loss'] += balance_used

                if balance_used > 0:
                    summary['count_debtors'] += 1
                    summary['total_debt'] += balance_used
                    summary['current'] += aging['current']
                    summary['overdue_30'] += aging['overdue_30']
                    summary['overdue_60'] += aging['overdue_60']
                    summary['overdue_90'] += aging['overdue_90']
                    summary['overdue_90plus'] += aging['overdue_90plus']

                    overdue = aging['overdue_30'] + aging['overdue_60'] + aging['overdue_90'] + aging['overdue_90plus']
                    # In blacklist, `overdue` will be 0 because it's paid, but that's fine.
                    if overdue > 0:
                        summary['count_overdue'] += 1

                data = ContactSerializer(contact).data
                if is_blacklist:
                    data['credit_balance_used'] = str(balance_used)
                contact_list.append(data)

        # Utilization Rate
        summary['utilization_rate'] = '0.00'
        if summary['total_exposure'] > 0:
            rate = (summary['total_debt'] / summary['total_exposure']) * 100
            summary['utilization_rate'] = f"{rate:.2f}"

        # Convert Decimals to strings for JSON serialization
        for key in ['total_debt', 'total_exposure', 'potential_loss', 'current', 'overdue_30', 'overdue_60', 'overdue_90', 'overdue_90plus']:
            summary[key] = str(summary[key])

        return Response({
            'contacts': contact_list,
            'summary': summary,
        })
    @action(detail=True, methods=['post'])
    def write_off_debt(self, request, pk=None):
        """
        Record the contact's current debt as an uncollectible loss.
        Creates a Journal Entry and technical movements to clear the balance.
        """
        from accounting.models import AccountingSettings, JournalEntry, JournalItem
        from treasury.models import TreasuryMovement
        from decimal import Decimal
        from django.db import transaction
        
        contact = self.get_object()
        orders_with_balance = []
        total_balance = Decimal('0')
        
        # We must carefully re-calculate using the logic from Contact.credit_aging/used
        orders = contact.sale_orders.exclude(status__in=['DRAFT', 'CANCELLED'])
        for order in orders:
            payments = order.payments.filter(is_pending_registration=False)
            paid_in = sum((p.amount for p in payments if p.movement_type in ['INBOUND', 'ADJUSTMENT']), Decimal('0'))
            paid_out = sum((p.amount for p in payments if p.movement_type == 'OUTBOUND'), Decimal('0'))
            payments_net = paid_in - paid_out
            order_balance = order.effective_total - payments_net
            if order_balance > 0:
                orders_with_balance.append((order, order_balance))
                total_balance += order_balance
        
        if total_balance <= 0:
            return Response({"error": "El contacto no tiene deuda activa para castigar."}, status=400)
            
        settings = AccountingSettings.objects.first()
        if not settings or not settings.default_uncollectible_expense_account:
            return Response({"error": "No hay una cuenta de gasto por incobrabilidad configurada en Contabilidad."}, status=400)
            
        receivable_account = contact.account_receivable or settings.default_receivable_account
        if not receivable_account:
             return Response({"error": "No se encontró una cuenta por cobrar configurada para este contacto o sistema."}, status=400)

        try:
            with transaction.atomic():
                # 1. Create Journal Entry
                entry = JournalEntry.objects.create(
                    description=f"Castigo de deuda incobrable: {contact.name}",
                    reference=f"CASTIGO-{contact.code}",
                    status='POSTED'
                )
                
                # Debit: Expense (Loss)
                JournalItem.objects.create(
                    entry=entry,
                    account=settings.default_uncollectible_expense_account,
                    label=f"Pérdida por incobrabilidad RUT {contact.tax_id}",
                    debit=total_balance,
                    credit=0
                )
                
                # Credit: Asset (Receivable)
                JournalItem.objects.create(
                    entry=entry,
                    account=receivable_account,
                    partner=contact.name,
                    label=f"Cierre de deuda incobrable RUT {contact.tax_id}",
                    debit=0,
                    credit=total_balance
                )
                
                # 2. Create technical movements to clear the sale orders balance
                for order, amount in orders_with_balance:
                    TreasuryMovement.objects.create(
                        movement_type='ADJUSTMENT',
                        payment_method='WRITE_OFF',
                        amount=amount,
                        contact=contact,
                        sale_order=order,
                        journal_entry=entry,
                        reference="CASTIGO",
                        notes=f"Ajuste por castigo de deuda (Asiento {entry.display_id})",
                        is_pending_registration=False,
                    )
                
                # 3. Permanently block and mark as critical
                if not contact.is_default_customer:
                    contact.credit_blocked = True
                    contact.credit_auto_blocked = False
                    contact.credit_risk_level = 'CRITICAL'
                from django.utils import timezone
                contact.credit_last_evaluated = timezone.now()
                contact.save()
                
            return Response({
                "message": f"Castigo procesado. Se han regularizado {total_balance} a pérdidas.",
                "journal_entry": entry.display_id,
                "amount": str(total_balance)
            })
        except Exception as e:
            return Response({"error": f"Error interno al procesar castigo: {str(e)}"}, status=500)

    @action(detail=True, methods=['get'])
    def credit_history(self, request, pk=None):
        """
        Returns the history of credit assignments for this contact.
        Includes manual approvals, fallback assignments, and contact file limit uses.
        """
        contact = self.get_object()
        from sales.models import SaleOrder
        from sales.serializers import SaleOrderSerializer
        
        # Get orders with credit assignment origin tracked
        history = SaleOrder.objects.filter(
            customer=contact,
            credit_assignment_origin__isnull=False
        ).order_by('-date', '-created_at')
        
        # Reuse SaleOrderSerializer which now includes the new credit fields
        serializer = SaleOrderSerializer(history, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def unblock_credit(self, request, pk=None):
        """Re-enables credit for a manually blocked contact"""
        contact = self.get_object()
        contact.credit_blocked = False
        contact.credit_auto_blocked = False
        contact.credit_risk_level = 'LOW' # Reset to LOW as a gesture of fresh start
        contact.save()
        
        from workflow.services import WorkflowService
        WorkflowService.send_notification(
            notification_type='CREDIT_UNBLOCK',
            title=f"Crédito Rehabilitado: {contact.name}",
            message=f"El cliente ha sido desbloqueado manualmente por {request.user.get_full_name() or request.user.username}.",
            link=f"/credits/portfolio?search={contact.tax_id}",
            content_object=contact,
            level='SUCCESS'
        )
        
        return Response({"message": "Crédito rehabilitado correctamente."})

    @action(detail=True, methods=['post'])
    def recover_written_off_debt(self, request, pk=None):
        """
        Records a recovery payment for debt that was previously written off.
        This doesn't re-open the debt, but records the income as 'Other Income / Recovery'.
        """
        from accounting.models import AccountingSettings, JournalEntry, JournalItem
        from treasury.models import TreasuryMovement
        from decimal import Decimal
        from django.db import transaction
        
        contact = self.get_object()
        amount_str = request.data.get('amount')
        if not amount_str:
            return Response({"error": "Debe especificar el monto recuperado."}, status=400)
            
        amount = Decimal(amount_str)
        settings = AccountingSettings.objects.first()
        
        # We need a recovery account. If not set, use uncollectible expense as negative (reversal)
        # or a generic other income account.
        recovery_account = getattr(settings, 'default_recovery_income_account', None) or settings.default_uncollectible_expense_account
        
        if not recovery_account:
            return Response({"error": "No hay una cuenta de recuperación configurada."}, status=400)

        # We assume the money goes to the default bank/cash account
        from treasury.models import TreasuryAccount
        target_account = TreasuryAccount.objects.filter(is_active=True).first() if hasattr(TreasuryAccount, 'is_active') else TreasuryAccount.objects.first()
        if not target_account:
            return Response({"error": "No hay una cuenta de tesorería activa para recibir el pago."}, status=400)

        try:
            with transaction.atomic():
                entry = JournalEntry.objects.create(
                    description=f"Recuperación de deuda castigada: {contact.name}",
                    reference=f"RECUP-{contact.code}",
                    status='POSTED'
                )
                
                # Debit: Cash/Bank
                JournalItem.objects.create(
                    entry=entry,
                    account=target_account.account,
                    label=f"Ingreso por recuperación de deuda RUT {contact.tax_id}",
                    debit=amount,
                    credit=0
                )
                
                # Credit: Recovery Income / Expense Reversal
                JournalItem.objects.create(
                    entry=entry,
                    account=recovery_account,
                    label=f"Recuperación de incobrable RUT {contact.tax_id}",
                    debit=0,
                    credit=amount
                )
                
                # Record the movement
                TreasuryMovement.objects.create(
                    movement_type='INBOUND',
                    payment_method='OTHER',  # Using OTHER with RECUPERACION reference
                    amount=amount,
                    contact=contact,
                    journal_entry=entry,
                    reference="RECUPERACION",
                    notes=f"Recuperación de deuda castigada (Asiento {entry.display_id})",
                    is_pending_registration=False,
                    to_account=target_account
                )
                
            return Response({
                "message": f"Recuperación procesada por {amount}.",
                "journal_entry": entry.display_id
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)
