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
        contact = self.get_object()

        today = timezone.now().date()
        payment_term = contact.credit_days or 30

        # Get all non-draft, non-cancelled orders
        orders = contact.sale_orders.exclude(status__in=['DRAFT', 'CANCELLED']).order_by('-date')

        from sales.serializers import SaleOrderSerializer
        ledger_data = []
        for order in orders:
            payments = order.payments.filter(is_pending_registration=False)
            paid_in = sum((p.amount for p in payments if p.movement_type == 'INBOUND'), Decimal('0'))
            paid_out = sum((p.amount for p in payments if p.movement_type == 'OUTBOUND'), Decimal('0'))
            payments_net = paid_in - paid_out
            balance = order.effective_total - payments_net

            if balance > 0:
                order_date = order.date
                if hasattr(order_date, 'date'):
                    order_date = order_date.date()
                due_date = order_date + timedelta(days=payment_term)
                days_overdue = (today - due_date).days

                if days_overdue <= 0:
                    aging_bucket = 'current'
                elif days_overdue <= 30:
                    aging_bucket = 'overdue_30'
                elif days_overdue <= 60:
                    aging_bucket = 'overdue_60'
                elif days_overdue <= 90:
                    aging_bucket = 'overdue_90'
                else:
                    aging_bucket = 'overdue_90plus'

                order_data = SaleOrderSerializer(order).data
                order_data['paid_amount'] = str(payments_net)
                order_data['balance'] = str(balance)
                order_data['due_date'] = str(due_date)
                order_data['days_overdue'] = days_overdue
                order_data['aging_bucket'] = aging_bucket
                ledger_data.append(order_data)

        return Response(ledger_data)

    @action(detail=False, methods=['get'])
    def credit_portfolio(self, request):
        """
        Returns a cartera view: all contacts with active credit or outstanding balance.
        Includes per-contact aging breakdown and aggregate summary KPIs.
        """
        from decimal import Decimal

        # Fetch contacts that have credit enabled OR have any credit balance used (sale orders)
        contacts = Contact.objects.filter(
            models.Q(credit_enabled=True) | 
            models.Q(credit_limit__isnull=False) |
            models.Q(sale_orders__isnull=False)
        ).distinct()

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
            
            # Include contacts that have credit configured OR have an actual balance
            if balance_used > 0 or contact.credit_enabled or contact.credit_limit:
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
                    if overdue > 0:
                        summary['count_overdue'] += 1

                data = ContactSerializer(contact).data
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
            paid_in = sum((p.amount for p in payments if p.movement_type == 'INBOUND'), Decimal('0'))
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
                    state='POSTED'
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
                        movement_type='INBOUND',
                        amount=amount,
                        contact=contact,
                        sale_order=order,
                        journal_entry=entry,
                        reference="AJUSTE CASTIGO",
                        notes=f"Ajuste técnico por castigo de deuda (Asiento {entry.display_id})",
                        is_pending_registration=False,
                    )
                
                # 3. Permanently block and mark as critical
                contact.credit_blocked = True
                contact.credit_auto_blocked = False
                contact.credit_risk_level = 'CRITICAL'
                contact.save()
                
            return Response({
                "message": f"Castigo procesado. Se han regularizado {total_balance} a pérdidas.",
                "journal_entry": entry.display_id,
                "amount": str(total_balance)
            })
        except Exception as e:
            return Response({"error": f"Error interno al procesar castigo: {str(e)}"}, status=500)
