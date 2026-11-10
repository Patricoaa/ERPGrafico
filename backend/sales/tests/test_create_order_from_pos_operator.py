"""Cobro POS atribuido al operador y seguimiento heredado. Spec 2026-11-10 §5.5-5.6."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.exceptions import ValidationError
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from contacts.models import Contact
from sales.models import DraftCart, SaleOrder, SaleTrackingEvent
from sales.services import SalesService
from treasury.models import POSOperatorPass, POSSession
from treasury.pos_operator_service import Actor, POSOperatorRequired

User = get_user_model()
HEADER = "HTTP_X_POS_OPERATOR_PASS"
ITEMS = [{"product_id": 1, "quantity": 1, "unit_price_net": "100", "unit_price_gross": "119"}]


def _seller(username):
    u = User.objects.create_user(username=username, password="x")
    u.user_permissions.add(Permission.objects.get(codename="add_saleorder", content_type__app_label="sales"))
    return u


@pytest.fixture
def cashier(db):
    return User.objects.create_superuser(username="cashier", password="x")


@pytest.fixture
def ana(db):
    return _seller("ana")


@pytest.fixture
def beto(db):
    return _seller("beto")


@pytest.fixture
def customer(db):
    return Contact.objects.create(name="Cliente POS", tax_id="33333333-3")


@pytest.fixture
def api(cashier):
    c = APIClient()
    c.force_authenticate(user=cashier)
    return c


@pytest.fixture
def multi(cashier):
    return POSSession.objects.create(user=cashier, mode="MULTI")


@pytest.fixture
def single(cashier):
    return POSSession.objects.create(user=cashier, mode="SINGLE")


def _identify(api, session, operator, *, tab, target=None):
    body = {"operator_id": operator.id, "tab_key": tab, "purpose": "DRAFT"}
    if target:
        body.update(target_type="sales.draftcart", target_id=target)
    r = api.post(f"/api/treasury/pos-sessions/{session.id}/identify_operator/", body, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _draft_by(api, session, operator, tab="t1", **extra):
    p = _identify(api, session, operator, tab=tab)
    r = api.post(
        "/api/sales/pos-drafts/",
        {"pos_session_id": session.id, "items": ITEMS, "session_key": tab, **extra},
        format="json", **{HEADER: p["token"]},
    )
    assert r.status_code == 201, r.content
    return r.json()["id"], p


def _hand_over(api, session, draft_id, first_tab, second, second_tab="t2"):
    """El primer operador suelta el borrador y `second` lo toma y lo bloquea."""
    api.post(f"/api/sales/pos-drafts/{draft_id}/unlock/",
             {"pos_session_id": session.id, "session_key": first_tab}, format="json")
    p = _identify(api, session, second, tab=second_tab, target=draft_id)
    r = api.post(f"/api/sales/pos-drafts/{draft_id}/lock/",
                 {"pos_session_id": session.id, "session_key": second_tab}, format="json", **{HEADER: p["token"]})
    assert r.status_code == 200, r.content
    return p


def _request(user, session, *, token=None, draft_id=None):
    data = {"pos_session_id": session.id}
    if draft_id is not None:
        data["draft_id"] = draft_id
    return SimpleNamespace(user=user, data=data, headers={"X-POS-Operator-Pass": token} if token else {})


class FakeSerializer:
    def __init__(self, customer):
        self.customer = customer

    def is_valid(self, raise_exception=True):
        return True

    def save(self, **kwargs):
        order = SaleOrder(customer=self.customer)
        for k, v in kwargs.items():
            setattr(order, k, v)
        order.save()
        return order


def _charge(actor, session, customer, draft_id=None):
    data = {"pos_session_id": session.id, "customer": customer.id}
    if draft_id is not None:
        data["draft_id"] = draft_id
    with patch.object(SalesService, "confirm_sale"):
        return SalesService.create_sale_order_from_pos(
            actor=actor, data=data, files={}, serializer=FakeSerializer(customer)
        )


# ── resolución del actor al cobrar ──────────────────────────────────────────

def test_multi_checkout_without_pass_403(multi, cashier):
    with pytest.raises(POSOperatorRequired):
        SalesService.checkout_actor_from_request(_request(cashier, multi, draft_id=1))


def test_multi_checkout_requires_draft_id(api, multi, cashier, ana):
    _, p = _draft_by(api, multi, ana)
    with pytest.raises(ValidationError, match="draft_id"):
        SalesService.checkout_actor_from_request(_request(cashier, multi, token=p["token"]))


def test_multi_checkout_with_other_drafts_pass_403(api, multi, cashier, ana, beto):
    d1, _ = _draft_by(api, multi, ana, tab="t1")
    _, p2 = _draft_by(api, multi, beto, tab="t2")
    with pytest.raises(POSOperatorRequired):
        SalesService.checkout_actor_from_request(_request(cashier, multi, token=p2["token"], draft_id=d1))


def test_multi_checkout_after_lock_expired_403(api, multi, cashier, ana):
    from datetime import timedelta

    from django.utils import timezone

    d, p = _draft_by(api, multi, ana)
    DraftCart.objects.filter(pk=d).update(locked_at=timezone.now() - timedelta(seconds=16))
    with pytest.raises(POSOperatorRequired):
        SalesService.checkout_actor_from_request(_request(cashier, multi, token=p["token"], draft_id=d))
    assert POSOperatorPass.objects.get(pk=p["pass_id"]).end_reason == "EXPIRED"


def test_single_checkout_actor_is_request_user(single, cashier):
    a = SalesService.checkout_actor_from_request(_request(cashier, single))
    assert a == Actor(cashier, cashier, None)


# ── venta ───────────────────────────────────────────────────────────────────

def test_multi_sale_salesperson_is_operator_and_pass_consumed(api, multi, cashier, ana, customer):
    d, p = _draft_by(api, multi, ana)
    actor = SalesService.checkout_actor_from_request(_request(cashier, multi, token=p["token"], draft_id=d))
    order = _charge(actor, multi, customer, draft_id=d)
    assert order.salesperson == ana and order.pos_session_id == multi.id
    checkout = SaleTrackingEvent.objects.get(sale_order=order, step="CHECKOUT")
    assert checkout.operator == ana and checkout.device_user == cashier
    assert POSOperatorPass.objects.get(pk=p["pass_id"]).end_reason == "CONSUMED"


def test_sale_seller_is_who_charges_not_who_created(api, multi, cashier, ana, beto, customer):
    d, _ = _draft_by(api, multi, ana, tab="t1")
    pb = _hand_over(api, multi, d, "t1", beto, "t2")
    actor = SalesService.checkout_actor_from_request(_request(cashier, multi, token=pb["token"], draft_id=d))
    order = _charge(actor, multi, customer, draft_id=d)
    assert order.salesperson == beto
    rows = {e.step: e.operator for e in SaleTrackingEvent.objects.filter(sale_order=order)}
    assert rows["CART"] == ana and rows["CHECKOUT"] == beto


def test_multi_sale_transfers_tracking_and_survives_draft_deletion(api, multi, cashier, ana, customer):
    d, p = _draft_by(api, multi, ana, customer_id=customer.id)
    actor = SalesService.checkout_actor_from_request(_request(cashier, multi, token=p["token"], draft_id=d))
    order = _charge(actor, multi, customer, draft_id=d)
    DraftCart.objects.filter(pk=d).delete()
    assert {e.step for e in SaleTrackingEvent.objects.filter(sale_order=order)} == {"CART", "CUSTOMER", "CHECKOUT"}


def test_single_sale_unchanged(single, cashier, customer):
    actor = SalesService.checkout_actor_from_request(_request(cashier, single))
    order = _charge(actor, single, customer)
    assert order.salesperson == cashier
    ev = SaleTrackingEvent.objects.get(sale_order=order)
    assert ev.step == "CHECKOUT" and ev.operator == cashier and ev.operator_pass is None
    assert POSOperatorPass.objects.count() == 0


def test_checkout_without_draft_never_touches_other_untracked_rows(single, cashier, customer):
    stray = SaleTrackingEvent.objects.create(
        step="DOCUMENT_EDIT", operator=cashier, device_user=cashier, pos_session=single
    )
    _charge(SalesService.checkout_actor_from_request(_request(cashier, single)), single, customer)
    stray.refresh_from_db()
    assert stray.sale_order_id is None


# ── idempotencia ────────────────────────────────────────────────────────────

def test_idempotent_replay_with_consumed_pass_returns_same_order(api, multi, ana, customer):
    d, p = _draft_by(api, multi, ana)
    body = {"pos_session_id": multi.id, "draft_id": d, "customer": customer.id}

    def fake_create(actor, data, files, serializer):
        order = SaleOrder.objects.create(customer=customer, pos_session=multi, salesperson=actor.operator)
        POSOperatorService_end(actor)
        return order

    def POSOperatorService_end(actor):
        from treasury.pos_operator_service import POSOperatorService

        POSOperatorService.end(actor.operator_pass, "CONSUMED")

    with patch.object(SalesService, "create_sale_order_from_pos", side_effect=fake_create):
        first = api.post("/api/sales/orders/", body, format="json",
                         HTTP_IDEMPOTENCY_KEY="k-1", **{HEADER: p["token"]})
        again = api.post("/api/sales/orders/", body, format="json",
                         HTTP_IDEMPOTENCY_KEY="k-1", **{HEADER: p["token"]})
    assert first.status_code == 201, first.content
    assert again.status_code == 201 and again.json()["id"] == first.json()["id"]
    assert SaleOrder.objects.count() == 1


# ── endpoint de seguimiento ─────────────────────────────────────────────────

def test_tracking_endpoint_shape_and_query_count(api, cashier, ana, customer):
    order = SaleOrder.objects.create(customer=customer)

    def add(n):
        for _ in range(n):
            SaleTrackingEvent.objects.create(
                sale_order=order, step="DOCUMENT_EDIT", operator=ana, device_user=cashier,
                entity_type="sales.saleorder", entity_id=order.id, detail="PATCH partial_update",
            )

    def call():
        with CaptureQueriesContext(connection) as ctx:
            r = api.get(f"/api/sales/orders/{order.id}/tracking/")
        assert r.status_code == 200
        return r.json(), len(ctx)

    add(2)
    rows, few = call()
    assert set(rows[0]) == {
        "step", "step_display", "operator_name", "device_user_name",
        "entity_type", "entity_id", "detail", "occurred_at",
    }
    assert rows[0]["step"] == "DOCUMENT_EDIT" and rows[0]["operator_name"] == "ana"
    add(20)
    assert call()[1] == few
