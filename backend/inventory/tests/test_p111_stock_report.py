import pytest

from inventory.selectors import get_stock_report_data
from inventory.services import ProductService


@pytest.fixture
def stock_report_setup(db):
    from decimal import Decimal

    from inventory.models import (
        Location,
        Product,
        ProductCategory,
        Stock,
        StockMove,
        UoM,
        UoMCategory,
        Warehouse,
    )
    from production.models import BillOfMaterials, BillOfMaterialsLine

    uom_category = UoMCategory.objects.create(name="Unit")
    uom = UoM.objects.create(name="Unidad", category=uom_category, uom_type="REFERENCE")
    category = ProductCategory.objects.create(name="Categoría")

    warehouse_a = Warehouse.objects.create(name="Bodega A", code="WA")
    warehouse_b = Warehouse.objects.create(name="Bodega B", code="WB")
    loc_a = Location.objects.create(name="Ubicación A", warehouse=warehouse_a)
    loc_b = Location.objects.create(name="Ubicación B", warehouse=warehouse_b)

    products = []
    for i in range(4):
        product = Product.objects.create(
            name=f"Producto {i}",
            code=f"P{i}",
            category=category,
            uom=uom,
            sale_uom=uom,
            purchase_uom=uom,
            product_type="STORABLE",
            cost_price=Decimal("100"),
        )
        products.append(product)

    Stock.objects.create(product=products[0], warehouse=warehouse_a, quantity=Decimal("10"))
    Stock.objects.create(product=products[0], warehouse=warehouse_b, quantity=Decimal("5"))
    Stock.objects.create(product=products[1], warehouse=warehouse_a, quantity=Decimal("3"))

    StockMove.objects.create(product=products[0], quantity=Decimal("20"), source_location=loc_b, destination_location=loc_a)
    StockMove.objects.create(product=products[1], quantity=Decimal("-7"), source_location=loc_a, destination_location=loc_b)
    StockMove.objects.create(product=products[0], quantity=Decimal("2"), source_location=loc_b, destination_location=loc_a)

    component = Product.objects.create(
        name="Tela",
        code="TELA",
        category=category,
        uom=uom,
        sale_uom=uom,
        purchase_uom=uom,
        product_type="STORABLE",
    )
    Stock.objects.create(product=component, warehouse=warehouse_a, quantity=Decimal("10"))

    manufactured = Product.objects.create(
        name="Polera",
        code="POLERA",
        category=category,
        uom=uom,
        sale_uom=uom,
        purchase_uom=uom,
        product_type="MANUFACTURABLE",
        track_inventory=True,
    )
    bom = BillOfMaterials.objects.create(product=manufactured, active=True, yield_quantity=1)
    BillOfMaterialsLine.objects.create(bom=bom, component=component, quantity=Decimal("4"), uom=uom)

    return {
        "products": products,
        "component": component,
        "manufactured": manufactured,
        "warehouse_a": warehouse_a,
        "warehouse_b": warehouse_b,
        "uom": uom,
    }


@pytest.mark.django_db
def test_stock_report_bounded_queries(stock_report_setup, django_assert_max_num_queries):
    with django_assert_max_num_queries(8):
        report = get_stock_report_data()

    by_code = {row["code"]: row for row in report}
    p0 = by_code[stock_report_setup["products"][0].code]
    assert p0["stock_qty"] == 15.0
    assert p0["moves_in"] == 22.0
    assert p0["moves_out"] == 0.0
    assert p0["qty_reserved"] == 0.0
    assert p0["qty_available"] == 15.0
    assert p0["unit_cost"] == 100.0
    assert p0["total_value"] == 1500.0

    p1 = by_code[stock_report_setup["products"][1].code]
    assert p1["stock_qty"] == 3.0
    assert p1["moves_in"] == 0.0
    assert p1["moves_out"] == 7.0

    assert by_code[stock_report_setup["products"][2].code]["stock_qty"] == 0.0
    assert by_code[stock_report_setup["products"][3].code]["qty_available"] == 0.0


@pytest.mark.django_db
def test_stock_report_warehouse_scoped(stock_report_setup, django_assert_max_num_queries):
    with django_assert_max_num_queries(8):
        report_a = get_stock_report_data(warehouse_id=stock_report_setup["warehouse_a"].id)

    by_code_a = {row["code"]: row for row in report_a}
    assert by_code_a[stock_report_setup["products"][0].code]["stock_qty"] == 10.0
    assert by_code_a[stock_report_setup["products"][1].code]["stock_qty"] == 3.0

    with django_assert_max_num_queries(8):
        report_b = get_stock_report_data(warehouse_id=stock_report_setup["warehouse_b"].id)
    by_code_b = {row["code"]: row for row in report_b}
    assert by_code_b[stock_report_setup["products"][0].code]["stock_qty"] == 5.0
    assert by_code_b[stock_report_setup["products"][1].code]["stock_qty"] == 0.0


@pytest.mark.django_db
def test_check_availability_bounded_queries(stock_report_setup, django_assert_max_num_queries):
    product = stock_report_setup["products"][0]
    lines = [{"product_id": product.id, "quantity": 3, "uom_id": stock_report_setup["uom"].id}]

    with django_assert_max_num_queries(10):
        result = ProductService.check_availability(lines)

    assert result["available"] is True
    assert result["details"][0]["available_qty"] == 15.0
    assert result["details"][0]["is_available"] is True


@pytest.mark.django_db
def test_check_availability_bom_manufacturable(stock_report_setup, django_assert_max_num_queries):
    manufactured = stock_report_setup["manufactured"]
    lines = [{"product_id": manufactured.id, "quantity": 2}]

    with django_assert_max_num_queries(10):
        result = ProductService.check_availability(lines)

    detail = result["details"][0]
    assert detail["manufacturable_qty"] == 2.0
    assert detail["is_available"] is True


@pytest.mark.django_db
def test_check_availability_bom_missing_components(stock_report_setup, django_assert_max_num_queries):
    manufactured = stock_report_setup["manufactured"]
    lines = [{"product_id": manufactured.id, "quantity": 5}]

    with django_assert_max_num_queries(10):
        result = ProductService.check_availability(lines)

    detail = result["details"][0]
    assert detail["is_available"] is False
    assert result["available"] is False
    component = stock_report_setup["component"]
    assert len(detail["missing_components"]) == 1
    missing = detail["missing_components"][0]
    assert missing["component_id"] == component.id
    assert missing["required_qty"] == 20.0
    assert missing["available_qty"] == 10.0
    assert missing["missing_qty"] == 10.0
