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
