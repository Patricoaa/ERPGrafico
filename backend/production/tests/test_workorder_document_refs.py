"""ADR-0086: el serializer de Orden de Trabajo expone la OV asociada como DocumentRef
(`sale_order_document`) con `url` canónica para que el frontend navegue al módulo de
ventas en el drilldown, en vez de apilar el drawer. La URL la decide el
`DocumentTypeRegistry` (ADR-0080 §6)."""

import pytest

from production.serializers import WorkOrderListSerializer, WorkOrderSerializer


def test_workorder_serializer_exposes_sale_order_document_ref(work_order_factory, sale_order_factory):
    order = sale_order_factory()
    wo = work_order_factory(sale_order=order)

    data = WorkOrderSerializer(wo).data

    ref = data["sale_order_document"]
    assert ref["label"] == "sales.saleorder"
    assert ref["id"] == order.id
    assert ref["url"] == f"/sales/dtes/orders?selected={order.id}"


def test_workorder_list_serializer_exposes_sale_order_document_ref(work_order_factory, sale_order_factory):
    order = sale_order_factory()
    wo = work_order_factory(sale_order=order)

    data = WorkOrderListSerializer(wo).data

    ref = data["sale_order_document"]
    assert ref["label"] == "sales.saleorder"
    assert ref["id"] == order.id
    assert ref["url"] == f"/sales/dtes/orders?selected={order.id}"


@pytest.mark.django_db
def test_workorder_serializer_sale_order_document_null_without_order(work_order_factory):
    wo = work_order_factory()

    data = WorkOrderSerializer(wo).data

    assert data["sale_order_document"] is None
