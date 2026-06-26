import importlib
import inspect
from django.apps import apps
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from core.api.pagination import StandardResultsSetPagination
import pytest

@pytest.mark.django_db
def test_all_list_viewsets_have_pagination():
    """
    Ningún ModelViewSet o ReadOnlyModelViewSet puede carecer de pagination_class,
    a menos que esté explícitamente exento (whitelist).
    """
    
    WHITELIST = [
        # Settings / system viewsets (singletons or admin-only, no pagination)
        "AccountingSettingsViewSet",
        "SalesSettingsViewSet",
        "ReconciliationSettingsViewSet",
        "CompanySettingsViewSet",
        "WorkflowSettingsViewSet",
        "GlobalHRSettingsViewSet",
        "ActionLogViewSet",
        "BackgroundJobViewSet",
        "PricingViewSet",
        "TreasuryDashboardViewSet",
        # Master data viewsets — see pagination-contract.md §8
        "AccountViewSet",
        "AccountingPeriodViewSet",
        "AFPViewSet",
        "BankViewSet",
        "CategoryViewSet",
        "EmployeeViewSet",
        "FiscalYearViewSet",
        "GroupViewSet",
        "NotificationRuleViewSet",
        "PaymentMethodViewSet",
        "PaymentTerminalDeviceViewSet",
        "PaymentTerminalProviderViewSet",
        "PayrollConceptViewSet",
        "POSTerminalViewSet",
        "PricingRuleViewSet",
        "ProductAttributeViewSet",
        "ProductAttributeValueViewSet",
        "TaskAssignmentRuleViewSet",
        "TreasuryAccountViewSet",
        "UoMCategoryViewSet",
        "UoMViewSet",
        "WarehouseViewSet",
    ]
    
    violating_viewsets = []
    
    for app_config in apps.get_app_configs():
        # Only inspect local apps
        if app_config.name.startswith('django') or app_config.name.startswith('rest_framework'):
            continue
            
        try:
            views_module = importlib.import_module(f"{app_config.name}.views")
        except ImportError:
            continue
            
        for name, obj in inspect.getmembers(views_module):
            if inspect.isclass(obj):
                # Ensure it's defined in the module itself, not imported
                if obj.__module__ != f"{app_config.name}.views":
                    continue
                
                if issubclass(obj, (ModelViewSet, ReadOnlyModelViewSet)):
                    if name in WHITELIST:
                        continue
                    
                    # Check if pagination_class is set to StandardResultsSetPagination
                    if not hasattr(obj, 'pagination_class') or obj.pagination_class is None:
                        violating_viewsets.append(f"{name} (Sin paginación)")
                    elif obj.pagination_class != StandardResultsSetPagination:
                        # Sometimes it might be inherited or not strictly equal, but it should be exactly this class
                        if obj.pagination_class.__name__ != 'StandardResultsSetPagination':
                            violating_viewsets.append(f"{name} (Usa {obj.pagination_class.__name__})")

    assert not violating_viewsets, \
        f"Los siguientes ViewSets omiten la paginación estándar: {', '.join(violating_viewsets)}"
