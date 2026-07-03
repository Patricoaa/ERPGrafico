from core.api.pagination import StandardResultsSetPagination
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
    ClosingChecklistInstance,
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
    get_account_ledger,
    list_accounts,
    list_budgetable_accounts,
)
from .serializers import (
    AccountingSettingsSerializer,
    AccountSerializer,
    BudgetItemSerializer,
    BudgetSerializer,
    ClosingChecklistInstanceSerializer,
    FiscalYearMappingSerializer,
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
        obj = AccountingService.get_or_create_current_settings()

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
    pagination_class = None  # Master data

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
        try:
            AccountingService.validate_account_deletion(account)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
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
    pagination_class = StandardResultsSetPagination
    def get_queryset(self):
        return JournalEntry.objects.select_related("reversal_of", "source_content_type").prefetch_related("items", "items__account", "items__partner", "source_document").all()
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
        inst = self.get_object()
        try:
            JournalEntryService.validate_editable(inst)
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)
        data = request.data.copy()
        items = data.pop('items', None)
        try:
            ser = self.get_serializer(inst, data=data, partial=kwargs.get('partial', False))
            ser.is_valid(raise_exception=True)
            JournalEntryService.update_entry(inst, ser.validated_data, items)
            return Response(self.get_serializer(inst).data)
        except Exception as e: return Response({'error': str(e)}, status=400)

    def destroy(self, request, *args, **kwargs):
        entry = self.get_object()
        if entry.status != 'DRAFT':
            return Response(
                {"error": "Solo se pueden eliminar asientos en estado Borrador."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


# --- Budgeting ViewSets ---


class BudgetViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    def get_queryset(self):
        return Budget.objects.prefetch_related("items", "items__account").all()
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
    pagination_class = StandardResultsSetPagination
    def get_queryset(self):
        return BudgetItem.objects.select_related("account").all()
    serializer_class = BudgetItemSerializer


class FiscalYearViewSet(viewsets.ModelViewSet):
    """
    CRUD + custom actions for Fiscal Year management and annual closing.
    """

    def get_queryset(self):
        return FiscalYear.objects.select_related("closing_entry", "opening_entry", "closed_by").all()
    serializer_class = FiscalYearSerializer
    pagination_class = None  # Master data

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

    @action(detail=False, methods=['post'], url_path='(?P<year>[0-9]{4})/close')
    def close(self, request, year=None):
        try:
            FiscalYearClosingService.validate_can_close(request.user, year)
            return Response(self.get_serializer(FiscalYearClosingService.close_fiscal_year(year=int(year), user=request.user, notes=request.data.get('notes', ''))).data)
        except ValidationError as e:
            return Response({'error': str(e.message if hasattr(e, 'message') else e)}, status=400)

    @action(detail=False, methods=["post"], url_path="(?P<year>[0-9]{4})/reopen")
    def reopen(self, request, year=None):
        try:
            FiscalYearClosingService.validate_can_reopen(request.user, year)
            result = FiscalYearClosingService.reopen_fiscal_year(year=int(year), user=request.user)
            serializer = self.get_serializer(result)
            return Response(serializer.data)
        except ValidationError as e:
            return Response(
                {"error": str(e.message if hasattr(e, "message") else e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"], url_path="(?P<year>[0-9]{4})/mappings")
    def list_mappings(self, request, year=None):
        from .models import FiscalYear
        try:
            fy = FiscalYear.objects.get(year=year)
        except FiscalYear.DoesNotExist:
            return Response({"error": f"No existe el ejercicio fiscal {year}."}, status=404)
        mappings = fy.account_mappings.select_related("account").all()
        return Response(FiscalYearMappingSerializer(mappings, many=True).data)

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

    @action(detail=False, methods=["get"], url_path="(?P<year>[0-9]{4})/checklist")
    def checklist(self, request, year=None):
        """List all ClosingChecklistInstance items for the fiscal year."""
        try:
            fy = FiscalYear.objects.get(year=year)
        except FiscalYear.DoesNotExist:
            return Response(
                {"error": f"No existe el ejercicio fiscal {year}."}, status=404
            )
        instances = fy.checklist_instances.select_related("template").order_by("template__order")
        serializer = ClosingChecklistInstanceSerializer(instances, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["patch"], url_path="(?P<year>[0-9]{4})/checklist/(?P<item_pk>[0-9]+)")
    def complete_checklist_item(self, request, year=None, item_pk=None):
        """Mark a checklist item as completed or incomplete."""
        try:
            fy = FiscalYear.objects.get(year=year)
        except FiscalYear.DoesNotExist:
            return Response(
                {"error": f"No existe el ejercicio fiscal {year}."}, status=404
            )
        try:
            instance = fy.checklist_instances.get(pk=item_pk)
        except ClosingChecklistInstance.DoesNotExist:
            return Response(
                {"error": "Item de checklist no encontrado."}, status=404
            )

        is_completed = request.data.get("is_completed")
        if is_completed is None:
            return Response(
                {"error": "El campo 'is_completed' es requerido."}, status=400
            )

        import django.utils.timezone as timezone

        instance.is_completed = bool(is_completed)
        instance.completed_at = timezone.now() if instance.is_completed else None
        instance.completed_by = request.user if instance.is_completed else None
        instance.notes = request.data.get("notes", instance.notes)
        instance.save()

        serializer = ClosingChecklistInstanceSerializer(instance)
        return Response(serializer.data)
