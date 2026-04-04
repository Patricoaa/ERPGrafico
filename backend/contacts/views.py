from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models, transaction
from django.utils import timezone
from decimal import Decimal
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
        
        # Partner filtering
        is_partner_param = self.request.query_params.get('is_partner', None)
        if is_partner_param:
            is_partner_val = is_partner_param.lower() == 'true'
            queryset = queryset.filter(is_partner=is_partner_val)
        
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
        Cached in Redis for 120s — invalidated by payment/credit events.
        """
        from core.cache import cache_report
        from core.api.throttles import HeavyReportThrottle
        
        throttle = HeavyReportThrottle()
        if not throttle.allow_request(request, self):
            from rest_framework.exceptions import Throttled
            raise Throttled(detail="Demasiadas solicitudes al reporte de crédito. Intente en un momento.")

        is_blacklist = request.query_params.get('blacklist', 'false') == 'true'
        
        def _generate():
            from decimal import Decimal

            if is_blacklist:
                contacts = Contact.objects.filter(credit_blocked=True).distinct()
            else:
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
                
                if balance_used > 0 or contact.credit_enabled or contact.credit_limit or is_blacklist:
                    summary['count_with_credit'] += 1
                    
                    if contact.credit_limit:
                        summary['total_exposure'] += contact.credit_limit
                    
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
                    if is_blacklist:
                        data['credit_balance_used'] = str(balance_used)
                    contact_list.append(data)

            summary['utilization_rate'] = '0.00'
            if summary['total_exposure'] > 0:
                rate = (summary['total_debt'] / summary['total_exposure']) * 100
                summary['utilization_rate'] = f"{rate:.2f}"

            for key in ['total_debt', 'total_exposure', 'potential_loss', 'current', 'overdue_30', 'overdue_60', 'overdue_90', 'overdue_90plus']:
                summary[key] = str(summary[key])

            return {
                'contacts': contact_list,
                'summary': summary,
            }

        data = cache_report(
            module='contacts',
            endpoint='credit_portfolio',
            params={'blacklist': str(is_blacklist)},
            timeout=120,
            generator=_generate,
        )
        return Response(data)
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
            
        settings = AccountingSettings.get_solo()
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
                    partner=contact,
                    partner_name=contact.name,
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
        settings = AccountingSettings.get_solo()
        
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

    # ==========================================================
    # PARTNERS (SOCIOS) ENDPOINTS
    # ==========================================================
    
    @action(detail=False, methods=['get'])
    def partners(self, request):
        """Get all contacts that are partners"""
        contacts = Contact.objects.filter(is_partner=True).distinct()
        serializer = self.get_serializer(contacts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def partner_statement(self, request, pk=None):
        """Get statement of account for a specific partner"""
        contact = self.get_object()
        if not contact.is_partner:
            from rest_framework import status
            return Response({"error": "El contacto no está marcado como socio."}, status=status.HTTP_400_BAD_REQUEST)
            
        from .partner_models import PartnerTransaction
        from .serializers import PartnerTransactionSerializer
        
        transactions = PartnerTransaction.objects.filter(partner=contact).order_by('-date', '-created_at')
        serializer = PartnerTransactionSerializer(transactions, many=True)
        
        return Response({
            'contact': self.get_serializer(contact).data,
            'summary': {
                'equity_percentage': str(contact.partner_equity_percentage or 0),
                'balance': str(contact.partner_balance),
                'total_contributions': str(contact.partner_total_contributions),
                'total_paid_in': str(contact.partner_total_paid_in),
                'pending_capital': str(contact.partner_pending_capital),
                'provisional_withdrawals': str(contact.partner_provisional_withdrawals_balance),
                'total_formal_withdrawals': str(contact.partner_total_withdrawals),
            },
            'transactions': serializer.data
        })

    @action(detail=False, methods=['get'])
    def partners_summary(self, request):
        """Calculates global metrics for the partner dashboard."""
        from .partner_service import PartnerService
        summary = PartnerService.get_global_summary()
        # Convert Decimal values to strings for JSON serialization
        for key in ['total_capital', 'total_provisional_withdrawals']:
            summary[key] = str(summary[key])
        return Response(summary)

    @action(detail=True, methods=['post', 'put', 'patch'])
    def setup_partner(self, request, pk=None):
        """Enable or update partner specific settings for a contact"""
        contact = self.get_object()
        from accounting.models import Account
        
        is_partner = request.data.get('is_partner', contact.is_partner)
        equity_percentage = request.data.get('partner_equity_percentage')
        
        # New accounts
        contribution_id = request.data.get('partner_contribution_account_id')
        withdrawal_id = request.data.get('partner_provisional_withdrawal_account_id')
        earnings_id = request.data.get('partner_earnings_account_id')
        
        contact.is_partner = is_partner
        if equity_percentage is not None:
            contact.partner_equity_percentage = equity_percentage
            
        def get_acc(vid):
            if not vid: return None
            try:
                return Account.objects.get(id=vid)
            except Account.DoesNotExist:
                return None

        # Update accounts if provided in request
        if 'partner_contribution_account_id' in request.data:
            contact.partner_contribution_account = get_acc(contribution_id)
        if 'partner_provisional_withdrawal_account_id' in request.data:
            contact.partner_provisional_withdrawal_account = get_acc(withdrawal_id)
        if 'partner_earnings_account_id' in request.data:
            contact.partner_earnings_account = get_acc(earnings_id)
            
        contact.save()
        return Response(self.get_serializer(contact).data)

    @action(detail=True, methods=['post'])
    def partner_transactions(self, request, pk=None):
        """
        Register a new partner transaction using PartnerService.
        Supports: CAPITAL_CASH, PROV_WITHDRAWAL
        """
        contact = self.get_object()
        if not contact.is_partner:
            from rest_framework import status
            return Response({"error": "El contacto no está marcado como socio."}, status=status.HTTP_400_BAD_REQUEST)
            
        transaction_type = request.data.get('transaction_type')
        amount_str = request.data.get('amount')
        date = request.data.get('date')
        description = request.data.get('description', '')
        treasury_account_id = request.data.get('treasury_account_id')
        
        if not all([transaction_type, amount_str, date]):
            from rest_framework import status
            return Response({"error": "Faltan campos obligatorios (transaction_type, amount, date)."}, status=status.HTTP_400_BAD_REQUEST)
             
        try:
            amount = Decimal(amount_str)
        except:
            return Response({"error": "Monto inválido."}, status=400)
        
        from .partner_service import PartnerService
        from .serializers import PartnerTransactionSerializer
        
        try:
            if transaction_type in ['CAPITAL_CASH']:
                ptx = PartnerService.record_capital_contribution(
                    partner=contact,
                    amount=amount,
                    date=date,
                    description=description,
                    treasury_account_id=treasury_account_id,
                    created_by=request.user,
                )
            elif transaction_type in ['PROV_WITHDRAWAL']:
                ptx = PartnerService.record_provisional_withdrawal(
                    partner=contact,
                    amount=amount,
                    date=date,
                    description=description,
                    treasury_account_id=treasury_account_id,
                    created_by=request.user,
                )
            else:
                return Response(
                    {"error": f"Tipo de transacción '{transaction_type}' no soportado en este endpoint. "
                     "Use los endpoints específicos para suscripción, transferencia, etc."},
                    status=400
                )
            
            return Response(PartnerTransactionSerializer(ptx).data)

        except Exception as e:
            return Response({"error": f"Error al procesar la transacción: {str(e)}"}, status=500)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def equity_subscription(self, request):
        """
        Records a formal capital subscription or reduction.
        Uses PartnerService for proper accounting separation.
        """
        from .partner_service import PartnerService

        contact_id = request.data.get('contact_id')
        amount = Decimal(str(request.data.get('amount', '0')))
        move_type = request.data.get('type')  # 'SUBSCRIPTION' or 'REDUCTION'
        date = request.data.get('date', timezone.now().date())
        description = request.data.get('description', '')

        if amount <= 0:
            return Response({"error": "El monto debe ser mayor a cero."}, status=400)

        try:
            contact = Contact.objects.get(id=contact_id)
            
            # Ensure partner setup
            if not contact.is_partner:
                contact.is_partner = True
                if not contact.partner_since:
                    try:
                        from datetime import datetime
                        contact.partner_since = datetime.strptime(str(date), '%Y-%m-%d').date() if isinstance(date, str) else date
                    except (ValueError, TypeError):
                        contact.partner_since = timezone.now().date()
                contact.save()

            if move_type == 'SUBSCRIPTION':
                ptx = PartnerService.record_equity_subscription(
                    partner=contact,
                    amount=amount,
                    date=date,
                    description=description,
                    created_by=request.user,
                )
            elif move_type == 'REDUCTION':
                ptx = PartnerService.record_equity_reduction(
                    partner=contact,
                    amount=amount,
                    date=date,
                    description=description,
                    created_by=request.user,
                )
            else:
                return Response({"error": "Tipo de movimiento inválido. Use 'SUBSCRIPTION' o 'REDUCTION'."}, status=400)

            return Response({
                "message": "Movimiento de capital registrado.",
                "journal_entry": ptx.journal_entry.display_id if ptx.journal_entry else None,
            })

        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def equity_transfer(self, request):
        """Records a transfer of participation between two partners."""
        from .partner_service import PartnerService

        from_id = request.data.get('from_contact_id')
        to_id = request.data.get('to_contact_id')
        amount = Decimal(str(request.data.get('amount', '0')))
        date = request.data.get('date', timezone.now().date())
        description = request.data.get('description', '')

        if amount <= 0 or from_id == to_id:
            return Response({"error": "Datos de transferencia inválidos."}, status=400)

        try:
            seller = Contact.objects.get(id=from_id)
            buyer = Contact.objects.get(id=to_id)
        except Contact.DoesNotExist:
            return Response({"error": "Uno o ambos contactos no existen."}, status=400)

        try:
            seller_tx, buyer_tx = PartnerService.record_equity_transfer(
                seller=seller,
                buyer=buyer,
                amount=amount,
                date=date,
                description=description,
                created_by=request.user,
            )
            return Response({
                "message": "Transferencia completada.",
                "journal_entry": seller_tx.journal_entry.display_id if seller_tx.journal_entry else None,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def all_partner_transactions(self, request):
        """Returns all transactions for all partners."""
        from .partner_models import PartnerTransaction
        from .serializers import PartnerTransactionSerializer
        
        txs = PartnerTransaction.objects.all().select_related('partner', 'journal_entry')
        return Response(PartnerTransactionSerializer(txs, many=True).data)

    @action(detail=False, methods=['get'])
    def equity_stakes_history(self, request):
        """Returns the full history of equity participation changes."""
        from .partner_models import PartnerEquityStake
        from .serializers import PartnerEquityStakeSerializer
        
        partner_id = request.query_params.get('partner_id')
        qs = PartnerEquityStake.objects.all().select_related('partner', 'source_transaction')
        
        if partner_id:
            qs = qs.filter(partner_id=partner_id)
        
        return Response(PartnerEquityStakeSerializer(qs, many=True).data)

    @action(detail=False, methods=['post'])
    def initial_setup(self, request):
        """Bulk setup for partners and initial capital subscription."""
        from .partner_service import PartnerService

        partners_data = request.data.get('partners', [])
        if not partners_data or not isinstance(partners_data, list):
            return Response({"error": "Debe proporcionar una lista de socios con sus montos."}, status=400)

        try:
            result = PartnerService.initial_setup(
                partners_data=partners_data,
                created_by=request.user,
            )
            return Response({
                "message": "Configuración inicial completada con éxito.",
                "total_capital": str(result['total_capital']),
                "journal_entry": result['journal_entry'].display_id,
                "partners_updated": result['partners_updated'],
            })
        except Exception as e:
            return Response({"error": f"Error durante la configuración inicial: {str(e)}"}, status=500)


