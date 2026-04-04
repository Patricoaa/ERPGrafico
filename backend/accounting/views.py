from rest_framework import viewsets, status
from django.http import HttpResponse
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Q
from .models import Account, JournalEntry, AccountingSettings, Budget, BudgetItem, AccountType, JournalItem
from .serializers import AccountSerializer, JournalEntrySerializer, AccountingSettingsSerializer, BudgetSerializer, BudgetItemSerializer
from .services import JournalEntryService, AccountingService, BudgetService
from django.core.exceptions import ValidationError
from core.mixins import BulkImportMixin, AuditHistoryMixin as AuditHistory

from rest_framework.permissions import IsAuthenticated

class AccountingSettingsViewSet(viewsets.ModelViewSet):
    queryset = AccountingSettings.objects.all()
    serializer_class = AccountingSettingsSerializer

    def get_permissions(self):
        if self.action == 'current' and self.request.method == 'GET':
            return [IsAuthenticated()]
        return super().get_permissions()

    @action(detail=False, methods=['get', 'put', 'patch'])
    def current(self, request):
        obj = AccountingSettings.get_solo()
        if not obj:
            if request.method == 'GET':
                 return Response({"detail": "Settings not found"}, status=status.HTTP_404_NOT_FOUND)
            obj = AccountingSettings.objects.create()
        
        if request.method == 'GET':
            serializer = self.get_serializer(obj)
            return Response(serializer.data)
        
        serializer = self.get_serializer(obj, data=request.data, partial=(request.method == 'PATCH'))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class AccountViewSet(BulkImportMixin, AuditHistory, viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer

    def get_queryset(self):
        queryset = Account.objects.all()
        is_leaf = self.request.query_params.get('is_leaf')
        if is_leaf and is_leaf.lower() == 'true':
            queryset = queryset.filter(children__isnull=True)
        return queryset

    def create(self, request, *args, **kwargs):
        print("DEBUG: ACCOUNT CREATE CALLED")
        print("Data:", request.data)
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            print(f"DEBUG: ACCOUNT CREATE ERROR: {e}")
            import traceback
            traceback.print_exc()
            raise e
    
    def destroy(self, request, *args, **kwargs):
        account = self.get_object()
        # Check if account has journal items
        if account.journal_items.filter(entry__status='POSTED').exists():
            return Response(
                {"error": "No se puede eliminar una cuenta con movimientos contables asociados."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        """
        Returns the ledger (libro mayor) for a specific account.
        Shows all posted journal items with running balance and period summary.
        """
        account = self.get_object()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        # Base queryset for posted items
        base_items = account.journal_items.filter(entry__status='POSTED').select_related('entry')

        # Calculate opening balance (all history before start_date)
        opening_balance = 0
        if start_date:
            opening_items = base_items.filter(entry__date__lt=start_date)
            totals = opening_items.aggregate(
                total_debit=Sum('debit'),
                total_credit=Sum('credit')
            )
            
            debit = totals.get('total_debit') or 0
            credit = totals.get('total_credit') or 0
            
            # Simple balance logic: Assets/Expenses (+) Debit, Others (+) Credit
            # BUT for ledger display, we usually want relative to account type
            # Or we can just return absolute debit/credit totals and let frontend handle it
            # Let's follow the model's balance logic but for the opening balance specifically
            if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                opening_balance = debit - credit
            else:
                opening_balance = credit - debit

        # Filter items for the requested period
        items = base_items.order_by('entry__date', 'entry__id')
        if start_date:
            items = items.filter(entry__date__gte=start_date)
        if end_date:
            items = items.filter(entry__date__lte=end_date)
        
        balance = float(opening_balance)
        ledger_data = []
        
        period_debit = 0
        period_credit = 0

        for item in items:
            d = float(item.debit)
            c = float(item.credit)
            period_debit += d
            period_credit += c
            
            if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                balance += (d - c)
            else:
                balance += (c - d)

            ledger_data.append({
                'id': item.id,
                'date': item.entry.date,
                'entry_id': item.entry.id,
                'reference': item.entry.reference,
                'description': item.entry.description,
                'debit': d,
                'credit': c,
                'balance': float(balance),
                'partner': item.partner.name if item.partner else '',
                'label': item.label or '',
                'source_document': item.entry.get_source_document
            })
        
        return Response({
            'account': AccountSerializer(account).data,
            'opening_balance': float(opening_balance),
            'period_debit': float(period_debit),
            'period_credit': float(period_credit),
            'closing_balance': float(balance),
            'movements': ledger_data
        })

    @action(detail=False, methods=['get'])
    def budgetable(self, request):
        """
        Returns only accounts that are suitable for budgeting.
        Optional filter: account_type (comma separated)
        """
        from .models import CFCategory
        
        account_types = request.query_params.get('account_types')
        if account_types:
            types = account_types.split(',')
            accounts = Account.objects.filter(account_type__in=types)
        else:
            # Default logic
            accounts = Account.objects.filter(
                Q(account_type__in=[AccountType.INCOME, AccountType.EXPENSE]) |
                Q(cf_category=CFCategory.INVESTING)
            )
            
        accounts = accounts.filter(children__isnull=True).order_by('code')
        
        serializer = self.get_serializer(accounts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def populate_ifrs(self, request):
        """
        Populares standard IFRS Chart of Accounts and default settings.
        """
        try:
            message = AccountingService.populate_ifrs_coa()
            return Response({'message': message})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class JournalEntryViewSet(viewsets.ModelViewSet, AuditHistory):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer
    
    @action(detail=True, methods=['post'])
    def post_entry(self, request, pk=None):
        entry = self.get_object()
        try:
            JournalEntryService.post_entry(entry)
            return Response({'status': 'posted'})
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
    def create(self, request, *args, **kwargs):
        print("DEBUG: CUSTOM CREATE CALLED")
        data = request.data.copy()
        items_data = data.pop('items', [])
        
        try:
            entry = JournalEntryService.create_entry(data, items_data)
            serializer = self.get_serializer(entry)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        # For simplicity, we might re-create items on update or implement a specific update service
        # This is a basic implementation that wipes items and re-creates them
        instance = self.get_object()
        data = request.data.copy()
        items_data = data.pop('items', None)
        
        try:
            # Standard update for Entry fields
            serializer = self.get_serializer(instance, data=data, partial=kwargs.get('partial', False))
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            
            if items_data is not None:
                # Replace items
                instance.items.all().delete()
                for item in items_data:
                    # Ensure account ID is passed correctly, might need adjustment depending on frontend payload
                    # Frontend usually sends 'account' as ID.
                    from .models import JournalItem
                    JournalItem.objects.create(entry=instance, **item)
            
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

# --- Budgeting ViewSets ---

class BudgetViewSet(viewsets.ModelViewSet):
    queryset = Budget.objects.all()
    serializer_class = BudgetSerializer

    @action(detail=True, methods=['post'])
    def set_items(self, request, pk=None):
        """
        Bulk update or replace budget items using BudgetService.
        """
        budget = self.get_object()
        items_data = request.data.get('items', [])
        
        try:
            count = BudgetService.set_budget_items(budget, items_data)
            return Response({'status': 'updated', 'count': count})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def execution(self, request, pk=None):
        """
        Calculates the execution status of the budget using BudgetService.
        """
        budget = self.get_object()
        try:
            report_data = BudgetService.get_execution_report(budget)
            report_data['budget'] = BudgetSerializer(budget).data
            return Response(report_data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def previous_year_actuals(self, request, pk=None):
        """
        Returns execution data from the previous year to pre-populate the budget.
        """
        budget = self.get_object()
        try:
            data = BudgetService.get_previous_year_actuals(budget)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def export_csv(self, request, pk=None):
        """
        Exports the execution report as a CSV file.
        """
        budget = self.get_object()
        try:
            csv_content = BudgetService.generate_execution_csv(budget)
            response = HttpResponse(csv_content, content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="ejecucion_{budget.id}.csv"'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class BudgetItemViewSet(viewsets.ModelViewSet):
    queryset = BudgetItem.objects.all()
    serializer_class = BudgetItemSerializer
