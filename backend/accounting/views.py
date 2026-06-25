import django_filters
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend, FilterSet
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Account,
    AccountingSettings,
    Budget,
    BudgetItem,
    FiscalYear,
    JournalEntry,
)


class JournalEntryFilterSet(FilterSet):
    date_after = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_before = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = JournalEntry
        fields = ["status", "date_after", "date_before"]


from django.core.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from core.mixins import AuditHistoryMixin as AuditHistory
from core.idempotency import idempotent_endpoint
from core.mixins import BulkImportMixin

from .fiscal_year_service import FiscalYearClosingService
from .selectors import (
    balance_affecting_statuses,
    get_account_ledger,
    list_accounts,
    list_budgetable_accounts,
)
from .serializers import (
    AccountingSettingsSerializer,
    AccountSerializer,
    BudgetItemSerializer,
    BudgetSerializer,
    FiscalYearPreviewSerializer,
    FiscalYearSerializer,
    JournalEntrySerializer,
)
from .services import AccountingService, BudgetService, JournalEntryService


class AccountingSettingsViewSet(viewsets.ModelViewSet):
    queryset = AccountingSettings.objects.all()
    serializer_class = AccountingSettingsSerializer

    def get_permissions(self):
        if self.action == "current" and self.request.method == "GET":
            return [IsAuthenticated()]
        return super().get_permissions()

    @action(detail=False, methods=["get", "put", "patch"])
    def current(self, request):
        obj = AccountingSettings.get_solo()
        if not obj:
            if request.method == "GET":
                return Response({"detail": "Settings not found"}, status=status.HTTP_404_NOT_FOUND)
            obj = AccountingSettings.objects.create()

        if request.method == "GET":
            serializer = self.get_serializer(obj)
            return Response(serializer.data)

        serializer = self.get_serializer(
            obj, data=request.data, partial=(request.method == "PATCH")
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="vat", permission_classes=[IsAuthenticated])
    def vat(self, request):
        from .utils import get_default_vat_rate

        rate = get_default_vat_rate()
        rate_float = float(rate)
        return Response({"rate": rate_float, "multiplier": round(1 + rate_float / 100, 10)})


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
        # Check if account has journal items that affect balances
        if account.journal_items.filter(entry__status__in=balance_affecting_statuses()).exists():
            return Response(
                {"error": "No se puede eliminar una cuenta con movimientos contables asociados."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def ledger(self, request, pk=None):
        account = self.get_object()
        data = get_account_ledger(
            account=account,
            start_date=request.query_params.get("start_date"),
            end_date=request.query_params.get("end_date"),
        )
        return Response({"account": AccountSerializer(account).data, **data})

    @action(detail=False, methods=["get"])
    def budgetable(self, request):
        accounts = list_budgetable_accounts(account_types=request.query_params.get("account_types"))
        return Response(self.get_serializer(accounts, many=True).data)

    @action(detail=False, methods=["post"])
    def populate_ifrs(self, request):
        """
        Populares standard IFRS Chart of Accounts and default settings.
        """
        try:
            message = AccountingService.populate_ifrs_coa()
            return Response({"message": message})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class JournalEntryViewSet(viewsets.ModelViewSet, AuditHistory):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = JournalEntryFilterSet
    search_fields = ["description", "display_id", "items__partner__name", "items__partner__tax_id"]

    @action(detail=True, methods=["post"])
    def post_entry(self, request, pk=None):
        entry = self.get_object()
        try:
            JournalEntryService.post_entry(entry)
            return Response({"status": "posted"})
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def reverse_entry(self, request, pk=None):
        entry = self.get_object()
        if not entry.is_manual:
            return Response(
                {
                    "error": "No se puede revertir un asiento generado automáticamente. Use el proceso de anulación del documento origen."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            description = request.data.get("description")
            reversal = JournalEntryService.reverse_entry(entry, description=description)
            serializer = self.get_serializer(reversal)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @idempotent_endpoint(scope="accounting.entry.create")
    def create(self, request, *args, **kwargs):
        print("DEBUG: CUSTOM CREATE CALLED")
        data = request.data.copy()
        items_data = data.pop("items", [])

        try:
            entry = JournalEntryService.create_entry(data, items_data)
            serializer = self.get_serializer(entry)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        # Only DRAFT entries can be edited; POSTED/CLOSED/REVERSAL/CANCELLED are immutable
        instance = self.get_object()
        if instance.status != "DRAFT":
            return Response(
                {"error": "Solo se pueden editar asientos en estado Borrador."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        data = request.data.copy()
        items_data = data.pop("items", None)

        try:
            # We use the serializer just to validate the main data
            serializer = self.get_serializer(
                instance, data=data, partial=kwargs.get("partial", False)
            )
            serializer.is_valid(raise_exception=True)

            JournalEntryService.update_entry(instance, serializer.validated_data, items_data)

            # Re-serialize updated instance
            return Response(self.get_serializer(instance).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# --- Budgeting ViewSets ---


class BudgetViewSet(viewsets.ModelViewSet):
    queryset = Budget.objects.all()
    serializer_class = BudgetSerializer

    @action(detail=True, methods=["get"])
    def variance(self, request, pk=None):
        budget = self.get_object()
        month = request.query_params.get("month")
        year = request.query_params.get("year")

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
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def set_items(self, request, pk=None):
        """
        Bulk update or replace budget items using BudgetService.
        """
        budget = self.get_object()
        items_data = request.data.get("items", [])

        try:
            count = BudgetService.set_budget_items(budget, items_data)
            return Response({"status": "updated", "count": count})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def execution(self, request, pk=None):
        """
        Calculates the execution status of the budget using BudgetService.
        """
        budget = self.get_object()
        try:
            report_data = BudgetService.get_execution_report(budget)
            report_data["budget"] = BudgetSerializer(budget).data
            return Response(report_data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def previous_year_actuals(self, request, pk=None):
        """
        Returns execution data from the previous year to pre-populate the budget.
        """
        budget = self.get_object()
        try:
            data = BudgetService.get_previous_year_actuals(budget)
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def export_csv(self, request, pk=None):
        """
        Exports the execution report as a CSV file.
        """
        budget = self.get_object()
        try:
            csv_content = BudgetService.generate_execution_csv(budget)
            response = HttpResponse(csv_content, content_type="text/csv")
            response["Content-Disposition"] = f'attachment; filename="ejecucion_{budget.id}.csv"'
            return response
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class BudgetItemViewSet(viewsets.ModelViewSet):
    queryset = BudgetItem.objects.all()
    serializer_class = BudgetItemSerializer


class FiscalYearViewSet(viewsets.ModelViewSet):
    """
    CRUD + custom actions for Fiscal Year management and annual closing.
    """

    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer

    @action(detail=False, methods=["get"], url_path="(?P<year>[0-9]{4})/preview-closing")
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
                {"error": str(e.message if hasattr(e, "message") else e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["post"], url_path="(?P<year>[0-9]{4})/close")
    def close(self, request, year=None):
        """
        Executes the annual fiscal year closing.
        """
        if not request.user.has_perm("accounting.can_close_fiscal_year"):
            return Response(
                {"error": "No tiene permisos para cerrar el ejercicio fiscal."},
                status=status.HTTP_403_FORBIDDEN,
            )

        notes = request.data.get("notes", "")

        try:
            result = FiscalYearClosingService.close_fiscal_year(
                year=int(year), user=request.user, notes=notes
            )
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except ValidationError as e:
            return Response(
                {"error": str(e.message if hasattr(e, "message") else e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"], url_path="(?P<year>[0-9]{4})/reopen")
    def reopen(self, request, year=None):
        """
        Reopens a closed fiscal year by reversing the closing entry.
        """
        if not request.user.has_perm("accounting.can_reopen_fiscal_year"):
            return Response(
                {"error": "No tiene permisos para reabrir el ejercicio fiscal."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            result = FiscalYearClosingService.reopen_fiscal_year(year=int(year), user=request.user)
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except ValidationError as e:
            return Response(
                {"error": str(e.message if hasattr(e, "message") else e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"], url_path="(?P<year>[0-9]{4})/generate-opening")
    def generate_opening(self, request, year=None):
        """
        Generates an opening journal entry for the next fiscal year.
        """
        try:
            result = FiscalYearClosingService.generate_opening_entry(
                year=int(year), user=request.user
            )
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except ValidationError as e:
            return Response(
                {"error": str(e.message if hasattr(e, "message") else e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
