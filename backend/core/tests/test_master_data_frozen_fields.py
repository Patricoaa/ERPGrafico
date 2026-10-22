"""ADR-0091 clase C — master data keeps its history-defining fields once used."""

from decimal import Decimal

import pytest
from django.utils import timezone

from accounting.models import Account, AccountType, JournalEntry, JournalItem
from inventory.models import Location, StockMove, UoM
from treasury.models import TreasuryAccount, TreasuryMovement


def _move(product, internal_location):
    customer = Location.objects.create(name="Cliente", location_type="CUSTOMER")
    return StockMove.objects.create(
        product=product, uom=product.uom, quantity=Decimal("1"),
        source_location=internal_location, destination_location=customer, unit_cost=0,
    )


@pytest.mark.django_db
def test_account_type_frozen_once_it_has_entries(api_client, account_asset):
    url = f"/api/accounting/accounts/{account_asset.pk}/"
    assert api_client.patch(url, {"account_type": AccountType.LIABILITY}, format="json").status_code == 200
    account_asset.refresh_from_db()
    entry = JournalEntry.objects.create(date=timezone.localdate(), description="x", status="POSTED")
    JournalItem.objects.create(entry=entry, account=account_asset, debit=Decimal("10"), credit=0)

    res = api_client.patch(url, {"account_type": AccountType.ASSET}, format="json")
    assert res.status_code == 422
    assert res.data["error"]["details"]["fields"] == ["account_type"]
    assert api_client.patch(url, {"name": "Caja renombrada"}, format="json").status_code == 200


@pytest.mark.django_db
def test_product_base_uom_frozen_once_it_has_stock_moves(api_client, product, uom, internal_location):
    other = UoM.objects.create(name="Caja", category=uom.category, ratio=Decimal("12"), uom_type="BIGGER")
    _move(product, internal_location)
    res = api_client.patch(f"/api/inventory/products/{product.pk}/", {"uom": other.pk}, format="json")
    assert res.status_code == 422


@pytest.mark.django_db
def test_uom_ratio_frozen_once_used(api_client, product, internal_location):
    uom = product.uom
    url = f"/api/inventory/uoms/{uom.pk}/"
    assert api_client.patch(url, {"rounding": "0.01"}, format="json").status_code == 200
    _move(product, internal_location)
    assert api_client.patch(url, {"ratio": "2"}, format="json").status_code == 422


@pytest.mark.django_db
def test_treasury_account_gl_frozen_once_it_has_movements(api_client, account_asset):
    ta = TreasuryAccount.objects.create(
        name="Caja Chica", account=account_asset, account_type=TreasuryAccount.Type.CASH
    )
    other = Account.objects.create(name="Caja 2", code="1.1.01.950", account_type=AccountType.ASSET)
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, to_account=ta, amount=Decimal("100")
    )
    url = f"/api/treasury/accounts/{ta.pk}/"
    assert api_client.patch(url, {"account": other.pk}, format="json").status_code == 422
    assert api_client.patch(url, {"name": "Caja Chica Local"}, format="json").status_code == 200


@pytest.mark.django_db
def test_frozen_fields_exposed_for_forms(api_client, account_asset):
    url = f"/api/accounting/accounts/{account_asset.pk}/"
    assert api_client.get(url).data["frozen_fields"] == []
    entry = JournalEntry.objects.create(date=timezone.localdate(), description="x", status="POSTED")
    JournalItem.objects.create(entry=entry, account=account_asset, debit=Decimal("10"), credit=0)
    assert api_client.get(url).data["frozen_fields"] == ["account_type", "is_category", "parent"]


@pytest.mark.django_db
@pytest.mark.parametrize("model_path", [
    "accounting.models.Account", "inventory.models.Product",
    "inventory.models.UoM", "treasury.models.TreasuryAccount",
])
def test_frozen_fields_cost_no_queries_on_annotated_rows(
    model_path, product, account_asset, django_assert_num_queries
):
    import importlib

    from core.edit_policy import annotate_edit_usage, frozen_fields

    module, name = model_path.rsplit(".", 1)
    model = getattr(importlib.import_module(module), name)
    if name == "TreasuryAccount":
        model.objects.create(name="Caja", account=account_asset, account_type=model.Type.CASH)
    rows = list(annotate_edit_usage(model.objects.all()))
    assert rows
    with django_assert_num_queries(0):
        for row in rows:
            frozen_fields(row)


@pytest.mark.django_db
def test_payroll_concept_category_frozen_once_in_posted_payroll(api_client, account_asset):
    from contacts.models import Contact
    from hr.models import Employee, Payroll, PayrollConcept, PayrollItem

    concept = PayrollConcept.objects.create(
        name="Bono", category=PayrollConcept.Category.HABER_IMPONIBLE, account=account_asset,
        formula_type=PayrollConcept.FormulaType.FIXED, default_amount=1000,
    )
    url = f"/api/hr/concepts/{concept.pk}/"
    employee = Employee.objects.create(
        contact=Contact.objects.create(name="E", tax_id="99999999-9"), base_salary=1, dias_pactados=30
    )
    draft = Payroll.objects.create(employee=employee, period_year=2026, period_month=8, base_salary=1)
    PayrollItem.objects.create(payroll=draft, concept=concept, amount=Decimal("1000"))
    assert api_client.get(url).data["frozen_fields"] == []

    posted = Payroll.objects.create(
        employee=employee, period_year=2026, period_month=9, base_salary=1, status="POSTED"
    )
    PayrollItem.objects.create(payroll=posted, concept=concept, amount=Decimal("1000"))
    res = api_client.patch(url, {"category": PayrollConcept.Category.HABER_NO_IMPONIBLE}, format="json")
    assert res.status_code == 422
    assert api_client.get(url).data["frozen_fields"] == ["category"]


@pytest.mark.django_db
def test_payment_method_account_frozen_once_it_has_movements(api_client, account_asset):
    from treasury.models import PaymentMethod

    ta = TreasuryAccount.objects.create(name="Caja", account=account_asset, account_type=TreasuryAccount.Type.CASH)
    other_acc = Account.objects.create(name="Caja 3", code="1.1.01.960", account_type=AccountType.ASSET)
    other = TreasuryAccount.objects.create(name="Caja 3", account=other_acc, account_type=TreasuryAccount.Type.CASH)
    pm = PaymentMethod.objects.create(name="Efectivo", method_type="CASH", treasury_account=ta)
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, to_account=ta, amount=Decimal("5"), payment_method_new=pm
    )
    url = f"/api/treasury/payment-methods/{pm.pk}/"
    assert api_client.patch(url, {"treasury_account": other.pk}, format="json").status_code == 422
    assert api_client.patch(url, {"name": "Efectivo caja"}, format="json").status_code == 200


@pytest.mark.django_db
def test_location_type_frozen_once_it_has_moves(product, internal_location):
    from core.edit_policy import DocumentLockedError, assert_editable

    assert_editable(internal_location, {"location_type"})
    _move(product, internal_location)
    with pytest.raises(DocumentLockedError):
        assert_editable(internal_location, {"location_type"})
    assert_editable(internal_location, {"name"})
