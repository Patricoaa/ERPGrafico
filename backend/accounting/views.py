from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Q
from .models import Account, JournalEntry, AccountingSettings, Budget, BudgetItem, AccountType, JournalItem
from .serializers import AccountSerializer, JournalEntrySerializer, AccountingSettingsSerializer, BudgetSerializer, BudgetItemSerializer
from .services import JournalEntryService, AccountingService
from django.core.exceptions import ValidationError
from core.mixins import BulkImportMixin

class AccountingSettingsViewSet(viewsets.ModelViewSet):
    queryset = AccountingSettings.objects.all()
    serializer_class = AccountingSettingsSerializer

    @action(detail=False, methods=['get', 'put', 'patch'])
    def current(self, request):
        obj = AccountingSettings.objects.first()
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

class AccountViewSet(BulkImportMixin, viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer

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
        if account.journal_items.filter(entry__state='POSTED').exists():
            return Response(
                {"error": "No se puede eliminar una cuenta con movimientos contables asociados."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        """
        Returns the ledger (libro mayor) for a specific account.
        Shows all posted journal items with running balance.
        """
        account = self.get_object()
        items = account.journal_items.filter(entry__state='POSTED').select_related('entry').order_by('entry__date', 'entry__id')
        
        balance = 0
        ledger_data = []
        
        for item in items:
            balance += (item.debit - item.credit)
            ledger_data.append({
                'id': item.id,
                'date': item.entry.date,
                'entry_id': item.entry.id,
                'reference': item.entry.reference,
                'description': item.entry.description,
                'debit': float(item.debit),
                'credit': float(item.credit),
                'balance': float(balance),
                'partner': item.partner or '',
                'label': item.label or '',
                'source_document': item.entry.get_source_document
            })
        
        return Response({
            'account': AccountSerializer(account).data,
            'movements': ledger_data
        })

    @action(detail=False, methods=['post'])
    def populate_ifrs(self, request):
        msg = AccountingService.populate_ifrs_coa()
        return Response({'message': msg})

class JournalEntryViewSet(viewsets.ModelViewSet):
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

    @action(detail=True, methods=['get'])
    def execution(self, request, pk=None):
        """
        Calculates the execution status of the budget.
        Compares budgeted amounts vs actual journal items for the period.
        """
        budget = self.get_object()
        items = budget.items.all().select_related('account')
        
        report = []
        total_budgeted = 0
        total_actual = 0
        
        for item in items:
            account = item.account
            
            # Filter actual items
            filters = Q(entry__state='POSTED', 
                        entry__date__gte=budget.start_date, 
                        entry__date__lte=budget.end_date,
                        account=account)
            
            # Calculate balance for the period (movement)
            result = JournalItem.objects.filter(filters).aggregate(
                debit=Sum('debit'),
                credit=Sum('credit')
            )
            
            debit = result['debit'] or 0
            credit = result['credit'] or 0
            
            # Determine actual based on account type
            # Income/Liability/Equity: Credit (positive effect) - Debit
            # Expense/Asset: Debit (positive effect usually for expense) - Credit
            
            # For Budgeting, usually we budget Expenses (Debit) and Income (Credit).
            if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                actual = float(debit - credit)
            else:
                actual = float(credit - debit)
                
            report.append({
                'account_id': account.id,
                'account_code': account.code,
                'account_name': account.name,
                'budgeted': float(item.amount),
                'actual': actual,
                'variance': actual - float(item.amount),
                'percentage': (actual / float(item.amount) * 100) if float(item.amount) != 0 else 0
            })
            
            total_budgeted += float(item.amount)
            total_actual += actual
            
        return Response({
            'budget': BudgetSerializer(budget).data,
            'items': report,
            'summary': {
                'total_budgeted': total_budgeted,
                'total_actual': total_actual,
                'total_variance': total_actual - total_budgeted
            }
        })

class BudgetItemViewSet(viewsets.ModelViewSet):
    queryset = BudgetItem.objects.all()
    serializer_class = BudgetItemSerializer
