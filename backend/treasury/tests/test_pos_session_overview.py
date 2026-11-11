"""Resumen, ventas, cobros netos, cierre y actividad de una sesión POS."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext

from contacts.models import Contact
from inventory.models import Warehouse
from sales.models import SaleOrder, SaleReturn, SaleTrackingEvent
from treasury.models import POSSessionAudit, POSTerminal, TreasuryMovement
from treasury.pos_session_overview import build_activity, build_overview
from treasury.tests.helpers import make_pos_session

User = get_user_model()


@pytest.fixture
def scene(db):
    user = User.objects.create_user(username="ana", password="x", first_name="Ana", last_name="Pérez")
    terminal = POSTerminal.objects.create(name="Mostrador", code="T-1")
    session = make_pos_session(user, terminal=terminal, opening_balance=Decimal("10000"))
    walk_in = Contact.objects.create(name="Cliente ocasional", tax_id="1-9", is_default_customer=True)
    named = Contact.objects.create(name="Imprenta Norte", tax_id="12345678-9")
    sale_a = SaleOrder.objects.create(
        customer=walk_in, date=date(2026, 11, 1), status=SaleOrder.Status.CONFIRMED,
        pos_session=session, total=Decimal("10000"),
    )
    sale_b = SaleOrder.objects.create(
        customer=named, date=date(2026, 11, 1), status=SaleOrder.Status.CONFIRMED,
        pos_session=session, total=Decimal("5000"),
    )
    warehouse = Warehouse.objects.create(name="Bodega", code="WH-OV")
    ret = SaleReturn.objects.create(sale_order=sale_a, warehouse=warehouse, date=date(2026, 11, 1))
    SaleReturn.objects.filter(pk=ret.pk).update(total=Decimal("2000"))
    SaleOrder.objects.filter(pk__in=[sale_a.pk, sale_b.pk]).update(total=Decimal("10000"))
    SaleOrder.objects.filter(pk=sale_b.pk).update(total=Decimal("5000"))
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, payment_method="CASH", amount=Decimal("10000"),
        sale_order=sale_a, pos_session=session, created_by=user, date=date(2026, 11, 1),
    )
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.OUTBOUND, payment_method="CASH", amount=Decimal("2000"),
        sale_order=sale_a, pos_session=session, created_by=user, date=date(2026, 11, 1),
    )
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, payment_method="TRANSFER", amount=Decimal("5000"),
        sale_order=sale_b, pos_session=session, created_by=user, date=date(2026, 11, 1),
    )
    return session, ret


@pytest.mark.django_db
def test_sales_balance_separates_sales_from_returns(scene):
    session, _ = scene
    sales = build_overview(session)["sales"]

    assert (sales["sale_count"], sales["return_count"]) == (2, 1)
    assert (sales["gross"], sales["returns_total"], sales["net"]) == (Decimal("15000"), Decimal("2000"), Decimal("13000"))
    assert sales["average_ticket"] == Decimal("7500")
    amounts = {r["display_id"]: r["amount"] for r in sales["rows"]}
    assert sorted(amounts.values()) == [Decimal("-2000"), Decimal("5000"), Decimal("10000")]
    assert {r["is_walk_in"] for r in sales["rows"] if r["kind"] == "SALE"} == {True, False}


@pytest.mark.django_db
def test_net_collections_discount_refunds(scene):
    session, _ = scene
    collections = {c["label"]: c for c in build_overview(session)["collections"]}

    # Sin métodos configurados en la caja, se agrupa por tipo (datos antiguos) y se marca no habilitado.
    assert collections["Efectivo"]["amount"] == Decimal("8000")
    assert collections["Transferencia"]["amount"] == Decimal("5000")
    assert round(collections["Efectivo"]["share"]) == 62
    assert collections["Efectivo"]["enabled"] is False


@pytest.mark.django_db
def test_collections_follow_the_methods_enabled_for_the_terminal(scene):
    from treasury.models import PaymentMethod, TreasuryAccount

    session, _ = scene
    account = TreasuryAccount.objects.create(name="Caja digital", account_type=TreasuryAccount.Type.CASH)
    enabled = PaymentMethod.objects.create(name="Redcompra Banco", method_type="CASH", treasury_account=account)
    unused = PaymentMethod.objects.create(name="Transferencia Banco", method_type="CASH", treasury_account=account)
    PaymentMethod.objects.create(name="Deshabilitado", method_type="CASH", treasury_account=account, is_active=False)
    session.terminal.allowed_payment_methods.add(enabled, unused)
    TreasuryMovement.objects.filter(payment_method="TRANSFER").update(payment_method_new=unused)

    by_label = {c["label"]: c for c in build_overview(session)["collections"]}

    assert by_label["Redcompra Banco"]["amount"] == Decimal("0") and by_label["Redcompra Banco"]["enabled"]
    assert by_label["Transferencia Banco"]["amount"] == Decimal("5000") and by_label["Transferencia Banco"]["enabled"]
    assert "Deshabilitado" not in by_label


@pytest.mark.django_db
def test_closed_session_reports_difference_alert(scene):
    session, _ = scene
    POSSessionAudit.objects.create(
        session=session, expected_amount=Decimal("18000"), actual_amount=Decimal("16000"),
        difference=Decimal("-2000"), notes="Faltante tras recuento",
    )
    from django.utils import timezone

    session.status = "CLOSED"
    session.closed_at = timezone.now()
    session.closed_by = session.user
    session.save()

    overview = build_overview(session)

    assert overview["closing"]["result"] == "DIFFERENCE"
    assert overview["closing"]["counted_cash"] == Decimal("16000")
    assert overview["alerts"][0]["code"] == "CASH_DIFFERENCE"
    kinds = [e["kind"] for e in build_activity(session)]
    assert kinds[0] in {"SESSION_CLOSED", "CASH_DIFFERENCE"} and "SESSION_OPENED" in kinds


@pytest.mark.django_db
def test_query_count_does_not_grow_with_rows(scene):
    session, _ = scene
    build_overview(session), build_activity(session)  # calienta cachés de una sola vez (p. ej. tipos de contenido)
    with CaptureQueriesContext(connection) as small:
        build_overview(session)
        build_activity(session)
    customer = Contact.objects.create(name="Otro", tax_id="7-7")
    for _ in range(6):
        SaleOrder.objects.create(
            customer=customer, date=date(2026, 11, 1), status=SaleOrder.Status.CONFIRMED,
            pos_session=session, total=Decimal("100"),
        )
    with CaptureQueriesContext(connection) as large:
        build_overview(session)
        build_activity(session)
    extra = [q['sql'][:160] for q in large.captured_queries if q['sql'] not in {x['sql'] for x in small.captured_queries}]
    assert len(large) == len(small), extra


@pytest.mark.django_db
def test_activity_is_in_spanish_with_linkable_references(scene):
    session, _ = scene
    order = SaleOrder.objects.filter(pos_session=session).first()
    user = session.user
    Step = SaleTrackingEvent.Step
    SaleTrackingEvent.objects.create(
        pos_session=session, sale_order=order, step=Step.DOCUMENT_EDIT, operator=user, device_user=user,
        entity_type="sales.saleorder", entity_id=order.pk, detail="PATCH partial_update",
    )
    SaleTrackingEvent.objects.create(
        pos_session=session, step=Step.PARTNER_WITHDRAWAL, operator=user, device_user=user, detail="Socio Uno: 2 producto(s)",
    )
    SaleTrackingEvent.objects.create(pos_session=session, draft_ref=9, step=Step.CART, operator=user, device_user=user)

    events = {e["kind"]: e for e in build_activity(session)}

    assert events["SESSION_OPENED"]["description"] == "Apertura de la sesión con fondo inicial de $10.000"
    assert events["STEP_DOCUMENT_EDIT"]["description"].startswith("Edición de ")
    assert events["STEP_DOCUMENT_EDIT"]["reference"] == {"label": "sales.saleorder", "id": order.pk, "display_id": order.display_id}
    assert events["STEP_PARTNER_WITHDRAWAL"]["description"] == "Retiro de socio procesado — Socio Uno: 2 producto(s)"
    assert events["STEP_CART"]["description"] == "Borrador #9: carrito actualizado"
    assert "PATCH" not in " ".join(e["description"] for e in events.values())


@pytest.mark.django_db
def test_sale_collected_in_session_but_born_elsewhere_is_listed(scene):
    session, _ = scene
    credit = Contact.objects.create(name="Cliente a crédito", tax_id="9-9")
    elsewhere = SaleOrder.objects.create(
        customer=credit, date=date(2026, 11, 1), status=SaleOrder.Status.CONFIRMED, total=Decimal("120000"),
    )
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, payment_method="CASH", amount=Decimal("120000"),
        sale_order=elsewhere, pos_session=session, created_by=session.user, date=date(2026, 11, 1),
    )

    overview = build_overview(session)
    rows = {r["display_id"]: r for r in overview["sales"]["rows"]}

    assert rows[elsewhere.display_id]["kind"] == "COLLECTION"
    assert rows[elsewhere.display_id]["amount"] == Decimal("120000")
    assert rows[elsewhere.display_id]["payment_method"] == "Efectivo"
    # No cuenta como venta de la sesión, pero sí como cobro (los cobros por método la incluyen).
    assert overview["sales"]["sale_count"] == 2
    assert overview["sales"]["gross"] == Decimal("15000")
    assert overview["sales"]["collection_count"] == 1
    assert {c["method"]: c["amount"] for c in overview["collections"]}["CASH"] == Decimal("128000")
    assert any(e["kind"] == "SALE_COLLECTION" and e["reference"]["id"] == elsewhere.pk for e in build_activity(session))


# ─── Cobrado / pendiente, actividad por venta y cierre (spec 2026-11-11) ────────


@pytest.mark.django_db
def test_sales_rows_report_collected_and_pending_net_of_returns(scene):
    session, _ = scene
    sales = build_overview(session)["sales"]
    rows = {r["display_id"]: r for r in sales["rows"] if r["kind"] == "SALE"}

    # La venta de $10.000 tuvo una devolución de $2.000 reembolsada: nada queda por cobrar.
    big = next(r for r in rows.values() if r["amount"] == Decimal("10000"))
    assert (big["collected"], big["pending"]) == (Decimal("8000"), Decimal("0"))
    assert sales["pending"] == Decimal("0")
    assert sales["collected"] == Decimal("13000")


@pytest.mark.django_db
def test_partial_payment_shows_pending_in_rows_and_activity(scene):
    session, _ = scene
    user = session.user
    order = SaleOrder.objects.create(
        customer=Contact.objects.get(is_default_customer=True), date=date(2026, 11, 1),
        status=SaleOrder.Status.CONFIRMED, pos_session=session, total=Decimal("26180"),
    )
    SaleOrder.objects.filter(pk=order.pk).update(total=Decimal("26180"))
    TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.INBOUND, payment_method="CASH", amount=Decimal("20000"),
        sale_order=order, pos_session=session, created_by=user, date=date(2026, 11, 1),
    )

    overview = build_overview(session)
    row = next(r for r in overview["sales"]["rows"] if r["id"] == order.pk)
    assert (row["collected"], row["pending"]) == (Decimal("20000"), Decimal("6180"))
    assert overview["sales"]["pending"] == Decimal("6180")

    sale_event = next(e for e in build_activity(session) if e["key"] == f"sale-{order.pk}")
    assert sale_event["amount"] == Decimal("26180")
    assert "pendiente $6.180" in sale_event["description"]
    assert sale_event["reference"]["display_id"] == order.display_id


@pytest.mark.django_db
def test_closing_difference_is_one_event_with_reason_and_adjustment_link(scene):
    from django.utils import timezone

    from core.prefix_registry import EntityPrefix

    session, _ = scene
    adjust = TreasuryMovement.objects.create(
        movement_type=TreasuryMovement.Type.OUTBOUND, payment_method="CASH", amount=Decimal("500"),
        pos_session=session, created_by=session.user, date=date(2026, 11, 1),
        justify_reason="COUNTING_ERROR", reference=f"{EntityPrefix.POS_SESSION}-EXCEDENTE-{session.id}",
    )
    POSSessionAudit.objects.create(
        session=session, expected_amount=Decimal("1000"), actual_amount=Decimal("500"), difference=Decimal("-500"),
    )
    session.status, session.closed_at, session.closed_by = "CLOSED", timezone.now(), session.user
    session.save()

    closing = build_overview(session)["closing"]
    assert closing["adjustment"]["id"] == adjust.pk
    assert closing["adjustment"]["reason"] == "COUNTING_ERROR"

    events = build_activity(session)
    diff = [e for e in events if e["kind"] == "CASH_DIFFERENCE"]
    assert len(diff) == 1 and diff[0]["description"].startswith("Faltante de caja de $500")
    assert diff[0]["amount"] == Decimal("-500")
    assert diff[0]["reference"]["id"] == adjust.pk
    assert all(e["key"] != f"mov-{adjust.pk}" for e in events)  # no se repite como movimiento
