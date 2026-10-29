"""
Test de arquitectura: verifica que todo modelo de negocio hereda de TimeStampedModel.

Actualizar EXEMPT_MODELS al agregar excepciones documentadas via ADR.
"""
from django.apps import apps

from core.models.abstracts import TimeStampedModel

# Modelos explícitamente exentos con su justificación
EXEMPT_MODELS = {
    # Sistema / infraestructura Django
    "auth.Permission", "auth.Group", "auth.User",
    "contenttypes.ContentType",
    "sessions.Session",
    "admin.LogEntry",
    # simple_history genera tablas históricas que no heredan TimeStampedModel
    # (se identifican por tener "historical" en el nombre de la tabla)
    # → filtrado automático abajo
    # Terceros sin modificación posible
    "django_celery_beat.ClockedSchedule",
    "django_celery_beat.CrontabSchedule",
    "django_celery_beat.IntervalSchedule",
    "django_celery_beat.SolarSchedule",
    "django_celery_beat.PeriodicTask",
    "django_celery_beat.PeriodicTasks",
    "django_celery_results.TaskResult",
    "django_celery_results.GroupResult",
    "django_celery_results.ChordCounter",
    "authtoken.Token",
    "authtoken.TokenProxy",
    "core.ActionLog",
    "core.Attachment",
    "core.CompanySettings",
    "core.GlobalSearchIndex",
    "core.IdempotencyRecord",
    "core.PeriodReopenLog",
    "core.User",
    "core.UserPreference",
    # Proyecto — excepciones con ADR
    # (vaciar esta lista es el objetivo; cada entrada requerirá ADR-ref a menos que se migre)
    # Resto de los eximidos
}

# Ratchet: business models that predate the rule. The list may only shrink — a new
# model must inherit TimeStampedModel, and a migrated one must leave the list (the
# test fails on stale entries so the debt count never hides progress).
TIMESTAMP_DEBT = {
    "accounting.ClosingChecklistInstance",
    "accounting.ClosingChecklistTemplate",
    "accounting.FiscalYear",
    "accounting.FiscalYearAccountMapping",
    "accounting.FiscalYearClosingChecklist",
    "billing.InvoiceLine",
    "billing.NoteWorkflow",
    "contacts.Contact",
    "contacts.PartnerEquityStake",
    "contacts.PartnerTransaction",
    "contacts.ProfitDistributionLine",
    "contacts.ProfitDistributionLineDestination",
    "contacts.ProfitDistributionPayment",
    "contacts.ProfitDistributionResolution",
    "hr.Absence",
    "hr.AFP",
    "hr.Employee",
    "hr.EmployeeConceptAmount",
    "hr.Payroll",
    "hr.PayrollConcept",
    "hr.PayrollItem",
    "hr.PayrollPayment",
    "hr.SalaryAdvance",
    "inventory.InventoryCount",
    "inventory.InventoryCountLine",
    "inventory.InventoryDocumentDetail",
    "inventory.Location",
    "inventory.PricingRule",
    "inventory.Product",
    "inventory.ProductFavorite",
    "inventory.ProductManufacturingProfile",
    "inventory.ProductUoMPrice",
    "inventory.Stock",
    "inventory.StockMove",
    "inventory.Subscription",
    "inventory.Warehouse",
    "production.BillOfMaterials",
    "production.BillOfMaterialsLine",
    "production.ProductionConsumption",
    "production.ProductionSettings",
    "production.WorkOrder",
    "production.WorkOrderHistory",
    "production.WorkOrderMaterial",
    "purchasing.PurchaseLine",
    "purchasing.PurchaseReceiptLine",
    "purchasing.PurchaseReturnLine",
    "sales.DraftCart",
    "sales.SaleDeliveryLine",
    "sales.SaleLine",
    "sales.SaleReturnLine",
    "tax.AccountingPeriod",
    "tax.F29Declaration",
    "tax.F29Payment",
    "tax.TaxPeriod",
    "treasury.Bank",
    "treasury.BankLoan",
    "treasury.BankStatement",
    "treasury.BankStatementLine",
    "treasury.CardPendingCharge",
    "treasury.CardPurchaseGroup",
    "treasury.CardPurchaseInstallment",
    "treasury.Check",
    "treasury.Checkbook",
    "treasury.CreditCardStatement",
    "treasury.CreditLine",
    "treasury.LoanInstallment",
    "treasury.PaymentAllocation",
    "treasury.PaymentMethod",
    "treasury.PaymentTerminalDevice",
    "treasury.PaymentTerminalProvider",
    "treasury.POSSession",
    "treasury.POSSessionAudit",
    "treasury.POSTerminal",
    "treasury.ReconciliationMatch",
    "treasury.TerminalBatch",
    "treasury.TreasuryAccount",
    "treasury.TreasuryMovement",
    "workflow.Comment",
    "workflow.Notification",
    "workflow.NotificationRule",
    "workflow.Task",
    "workflow.TaskAssignmentRule",
    "workflow.Transition",
}

PROJECT_APPS = {
    "accounting", "billing", "contacts", "core",
    "finances", "hr", "inventory", "production",
    "purchasing", "sales", "tax", "treasury", "workflow",
}

def test_all_business_models_inherit_timestampedmodel():
    violations = []
    for model in apps.get_models():
        app_label = model._meta.app_label
        model_label = f"{app_label}.{model.__name__}"

        if app_label not in PROJECT_APPS:
            continue
        if model_label in EXEMPT_MODELS:
            continue
        # Filtrar tablas históricas de simple_history
        if model.__name__.startswith("Historical"):
            continue

        if not issubclass(model, TimeStampedModel):
            violations.append(model_label)

    new = sorted(set(violations) - TIMESTAMP_DEBT)
    assert not new, (
        "Los siguientes modelos no heredan de TimeStampedModel. "
        "Migrar o agregar a EXEMPT_MODELS con justificación ADR:\n"
        + "\n".join(f"  - {v}" for v in new)
    )
    paid_off = sorted(TIMESTAMP_DEBT - set(violations))
    assert not paid_off, (
        "Estos modelos ya heredan de TimeStampedModel (o ya no existen): "
        "quítelos de TIMESTAMP_DEBT:\n" + "\n".join(f"  - {v}" for v in paid_off)
    )
