"""Confirming an inventory document must reach the materialized account balances (ADR-0115)."""

from decimal import Decimal

import pytest

from accounting.models import Account, AccountType
from inventory.models import (
    InventoryDocument,
    InventoryDocumentDetail,
    Location,
    Product,
    ProductCategory,
    UoM,
    UoMCategory,
    Warehouse,
)
from inventory.services import InventoryService


@pytest.mark.django_db
def test_confirmed_document_updates_account_balances():
    inventory_account = Account.objects.create(name="Inventario", code="1.1.05.900", account_type=AccountType.ASSET)
    supplier_account = Account.objects.create(name="Recepciones", code="2.1.09.900", account_type=AccountType.LIABILITY)
    uom = UoM.objects.create(name="unidad", ratio=Decimal("1"), category=UoMCategory.objects.create(name="Unidades"))
    product = Product.objects.create(
        name="Papel",
        internal_code="P-900",
        product_type=Product.Type.STORABLE,
        uom=uom,
        category=ProductCategory.objects.create(name="Papeles", prefix="PPL", asset_account=inventory_account),
    )
    warehouse = Warehouse.objects.create(name="Central", code="WH-900")
    source = Location.objects.create(name="Proveedor", location_type="VENDOR", account=supplier_account)
    destination = Location.objects.create(name="Stock", location_type="INTERNAL", warehouse=warehouse)
    document = InventoryDocument.objects.create(
        document_type=InventoryDocument.Type.RECEIPT, status=InventoryDocument.Status.DRAFT, reference="REC-900"
    )
    InventoryDocumentDetail.objects.create(
        document=document,
        product=product,
        source_location=source,
        destination_location=destination,
        quantity=Decimal("5"),
        unit_cost=Decimal("100"),
    )

    InventoryService.confirmar_documento(document, generate_accounting=True)

    inventory_account.refresh_from_db()
    supplier_account.refresh_from_db()
    assert inventory_account.balance == Decimal("500")
    assert supplier_account.balance == Decimal("500")
