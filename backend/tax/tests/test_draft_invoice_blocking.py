"""Facturas en borrador del mes bloquean registrar el F29 y cerrar el período contable."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from billing.models import Invoice
from tax.models import AccountingPeriod, TaxPeriod
from tax.services import AccountingPeriodService, F29CalculationService


def _draft_invoice(year=2026, month=8, day=10):
    return Invoice.objects.create(
        dte_type=Invoice.DTEType.FACTURA,
        number="900",
        status=Invoice.Status.DRAFT,
        date=date(year, month, day),
        total=Decimal("1190"),
        total_net=Decimal("1000"),
        total_tax=Decimal("190"),
    )


@pytest.mark.django_db
def test_register_declaration_blocked_by_draft_invoice():
    _draft_invoice()
    declaration = F29CalculationService.create_or_update_declaration(2026, 8, {})

    with pytest.raises(ValidationError, match="factura"):
        F29CalculationService.register_declaration(declaration.id)


@pytest.mark.django_db
def test_register_declaration_ignores_draft_invoice_of_other_month():
    _draft_invoice(month=7)
    declaration = F29CalculationService.create_or_update_declaration(2026, 8, {})

    # Sin borradores en agosto no debe fallar por facturas (puede fallar por otra
    # configuración contable, nunca por borradores).
    try:
        F29CalculationService.register_declaration(declaration.id)
    except ValidationError as exc:
        assert "borrador" not in str(exc)


@pytest.mark.django_db
def test_close_accounting_period_blocked_by_draft_invoice():
    tax_period = TaxPeriod.objects.create(year=2026, month=8, status=TaxPeriod.Status.CLOSED)
    AccountingPeriod.objects.update_or_create(year=2026, month=8, defaults={"tax_period": tax_period})
    _draft_invoice()
    user = get_user_model().objects.create(username="closer")

    with pytest.raises(ValidationError, match="factura"):
        AccountingPeriodService.close_period(2026, 8, user)
