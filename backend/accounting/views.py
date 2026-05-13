from rest_framework import viewsets, status, filters
from django.http import HttpResponse
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Q
from .models import Account, JournalEntry, AccountingSettings, Budget, BudgetItem, AccountType, JournalItem, FiscalYear
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
import django_filters

class JournalEntryFilterSet(FilterSet):
    date_after = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    date_before = django_filters.DateFilter(field_name='date', lookup_expr='lte')

    class Meta:
        model = JournalEntry
        fields = ['status', 'date_after', 'date_before']

from .serializers import (
    AccountSerializer, JournalEntrySerializer, AccountingSettingsSerializer,
    BudgetSerializer, BudgetItemSerializer, FiscalYearSerializer, FiscalYearPreviewSerializer
)
from .services import JournalEntryService, AccountingService, BudgetService
from .fiscal_year_service import FiscalYearClosingService
from .selectors import list_accounts, list_budgetable_accounts, get_account_ledger
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
        return list_accounts(params=self.request.query_params)

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
        account = self.get_object()
        data = get_account_ledger(
            account=account,
            start_date=request.query_params.get('start_date'),
            end_date=request.query_params.get('end_date'),
        )
        return Response({'account': AccountSerializer(account).data, **data})

    @action(detail=False, methods=['get'])
    def budgetable(self, request):
        accounts = list_budgetable_accounts(
            account_types=request.query_params.get('account_types')
        )
        return Response(self.get_serializer(accounts, many=True).data)

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
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = JournalEntryFilterSet
    search_fields = ['description', 'reference', 'display_id']

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
    def variance(self, request, pk=None):
        budget = self.get_object()
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        
        if not month or not year:
            # Default to current month/year if not specified, 
            # as long as they are within budget bounds
            from django.utils import timezone
            now = timezone.now()
            month = int(month) if month else now.month
            year = int(year) if year else now.year
            
        try:
            tree = BudgetService.get_variance_report(budget, int(year), int(month))
            return Response(tree)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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


class FiscalYearViewSet(viewsets.ModelViewSet):
    """
    CRUD + custom actions for Fiscal Year management and annual closing.
    """
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer

    @action(detail=False, methods=['get'], url_path='(?P<year>[0-9]{4})/preview-closing')
    def preview_closing(self, request, year=None):
        """
        Returns a preview of the fiscal year closing: P&L account balances,
        net result, and pre-closing validations.
        """
        try:
            data = FiscalYearClosingService.preview_closing(int(year))
            serializer = FiscalYearPreviewSerializer(data)
            return Response(serializer.data)
        except ValidationError as e:
            return Response(
                {'error': str(e.message if hasattr(e, 'message') else e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], url_path='(?P<year>[0-9]{4})/close')
    def close(self, request, year=None):
        """
        Executes the annual fiscal year closing.
        """
        if not request.user.has_perm('accounting.can_close_fiscal_year'):
            return Response(
                {'error': 'No tiene permisos para cerrar el ejercicio fiscal.'},
                status=status.HTTP_403_FORBIDDEN
            )

        notes = request.data.get('notes', '')

        try:
            result = FiscalYearClosingService.close_fiscal_year(
                year=int(year),
                user=request.user,
                notes=notes
            )
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except ValidationError as e:
            return Response(
                {'error': str(e.message if hasattr(e, 'message') else e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], url_path='(?P<year>[0-9]{4})/reopen')
    def reopen(self, request, year=None):
        """
        Reopens a closed fiscal year by reversing the closing entry.
        """
        if not request.user.has_perm('accounting.can_reopen_fiscal_year'):
            return Response(
                {'error': 'No tiene permisos para reabrir el ejercicio fiscal.'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            result = FiscalYearClosingService.reopen_fiscal_year(
                year=int(year),
                user=request.user
            )
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except ValidationError as e:
            return Response(
                {'error': str(e.message if hasattr(e, 'message') else e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], url_path='(?P<year>[0-9]{4})/generate-opening')
    def generate_opening(self, request, year=None):
        """
        Generates an opening journal entry for the next fiscal year.
        """
        try:
            result = FiscalYearClosingService.generate_opening_entry(
                year=int(year),
                user=request.user
            )
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except ValidationError as e:
            return Response(
                {'error': str(e.message if hasattr(e, 'message') else e)},
                status=status.HTTP_400_BAD_REQUEST
            )
