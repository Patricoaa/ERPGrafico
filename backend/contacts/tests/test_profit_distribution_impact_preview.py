"""Vista previa de impactos de una distribución: absorción de retiros provisorios y cambio de %."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from contacts.models import Contact
from contacts.partner_models import (
    PartnerTransaction,
    ProfitDistributionLine,
    ProfitDistributionLineDestination,
    ProfitDistributionResolution,
)

User = get_user_model()
PROV = PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL
CASH = PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH


def _partner(name, capital, provisional=0):
    p = Contact.objects.create(name=name, is_partner=True, tax_id=f"{abs(hash(name)) % 10**7}-0")
    PartnerTransaction.objects.create(partner=p, transaction_type=CASH, amount=Decimal(capital), date=date(2025, 1, 1))
    if provisional:
        PartnerTransaction.objects.create(
            partner=p, transaction_type=PROV, amount=Decimal(provisional), date=date(2025, 6, 1)
        )
    return p


@pytest.mark.django_db
def test_preview_projects_offset_reinvestment_and_percentages():
    client = APIClient()
    client.force_authenticate(User.objects.create_superuser("prev", "p@x.cl", "x"))
    a = _partner("Ana", "500000", provisional="100000")
    b = _partner("Beto", "500000")
    res = ProfitDistributionResolution.objects.create(
        fiscal_year=2025, resolution_date=date(2026, 4, 30), net_result=Decimal("200000"), status="DRAFT"
    )
    la = ProfitDistributionLine.objects.create(
        resolution=res, partner=a, percentage_at_date=Decimal("50"), gross_amount=Decimal("100000"),
        provisional_withdrawals_offset=Decimal("100000"), net_amount=Decimal("0"),
    )
    lb = ProfitDistributionLine.objects.create(
        resolution=res, partner=b, percentage_at_date=Decimal("50"), gross_amount=Decimal("100000"),
        net_amount=Decimal("100000"),
    )
    ProfitDistributionLineDestination.objects.create(line=lb, destination="REINVEST", amount=Decimal("100000"))

    data = client.get(f"/api/contacts/profit-distributions/{res.pk}/impact_preview/").json()
    rows = {r["partner_name"]: r for r in data["partners"]}

    assert Decimal(data["totals"]["provisional_offset"]) == Decimal("100000")
    assert Decimal(rows["Ana"]["provisional_balance_after"]) == 0
    # Ana: 400.000 -> 500.000 (se libera el retiro); Beto: 500.000 -> 600.000 (reinversión)
    assert Decimal(rows["Ana"]["equity_after"]) == Decimal("500000")
    assert Decimal(rows["Beto"]["equity_after"]) == Decimal("600000")
    assert Decimal(rows["Ana"]["percentage_after"]) == Decimal("45.45")
    assert Decimal(rows["Beto"]["percentage_after"]) == Decimal("54.55")
    assert data["percentages_change"] is True
    assert la.pk and lb.pk


@pytest.mark.django_db
def test_preview_rejects_executed_resolution():
    client = APIClient()
    client.force_authenticate(User.objects.create_superuser("prev2", "p@x.cl", "x"))
    res = ProfitDistributionResolution.objects.create(
        fiscal_year=2024, resolution_date=date(2026, 4, 30), net_result=Decimal("1"), status="EXECUTED"
    )
    assert client.get(f"/api/contacts/profit-distributions/{res.pk}/impact_preview/").status_code == 400


@pytest.mark.django_db
def test_executed_lines_expose_percentage_after():
    from contacts.partner_models import PartnerEquityStake

    client = APIClient()
    client.force_authenticate(User.objects.create_superuser("prev3", "p@x.cl", "x"))
    a = _partner("Ana2", "500000")
    b = _partner("Beto2", "500000")
    res = ProfitDistributionResolution.objects.create(
        fiscal_year=2023, resolution_date=date(2026, 4, 30), net_result=Decimal("100000"), status="EXECUTED"
    )
    for p, pct in ((a, "50"), (b, "50")):
        ProfitDistributionLine.objects.create(
            resolution=res, partner=p, percentage_at_date=Decimal(pct), gross_amount=Decimal("50000"), net_amount=Decimal("50000"),
        )
    PartnerEquityStake.objects.create(partner=b, percentage=Decimal("54.55"), effective_from=date(2026, 4, 30))

    data = client.get(f"/api/contacts/profit-distributions/{res.pk}/").json()
    by_name = {line["partner_name"]: line["percentage_after"] for line in data["lines"]}
    assert by_name == {"Ana2": None, "Beto2": "54.55"}
