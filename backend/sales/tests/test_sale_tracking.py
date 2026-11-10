"""Seguimiento por paso del borrador / orden. Spec 2026-11-10 §5.6."""

import pytest
from django.contrib.auth import get_user_model

from contacts.models import Contact
from sales.draft_cart_service import DraftCartService
from sales.models import DraftCart, SaleOrder, SaleTrackingEvent
from sales.tracking_service import SaleTrackingService
from treasury.models import POSSession
from treasury.pos_operator_service import Actor

User = get_user_model()
Step = SaleTrackingEvent.Step
ITEM = {"product_id": 1, "quantity": 1, "unit_price_net": "100", "unit_price_gross": "119"}


@pytest.fixture
def cashier(db):
    return User.objects.create_user(username="cashier", password="x")


@pytest.fixture
def ana(db):
    return User.objects.create_user(username="ana", password="x")


@pytest.fixture
def beto(db):
    return User.objects.create_user(username="beto", password="x")


@pytest.fixture
def session(cashier):
    return POSSession.objects.create(user=cashier, mode="MULTI")


@pytest.fixture
def customer(db):
    return Contact.objects.create(name="Cliente", tax_id="11111111-1")


def _actor(op, device):
    return Actor(op, device, None)


def _save(session, actor, **kw):
    kw.setdefault("items", [dict(ITEM)])
    return DraftCartService.save_draft(
        pos_session_id=session.id, user=actor.operator, actor=actor, **kw
    )


def _row(draft, step):
    return SaleTrackingEvent.objects.get(draft_ref=draft.id, step=step, sale_order__isnull=True)


# ── changed_steps (función pura) ────────────────────────────────────────────

def test_changed_steps_new_draft():
    steps = SaleTrackingService.changed_steps(
        None, items=[ITEM], customer_id=5, wizard_state={"paymentData": {"m": 1}}
    )
    assert steps == {Step.CART, Step.CUSTOMER, Step.PAYMENT}


def test_changed_steps_noise_keys_are_ignored():
    old = DraftCart(items=[ITEM], customer_id=5, wizard_state={"step": 1, "isLoading": False})
    new_ws = {"step": 2, "isLoading": True, "isWaitingPayment": True, "phaseId": "x"}
    assert SaleTrackingService.changed_steps(old, items=[ITEM], customer_id=5, wizard_state=new_ws) == set()


def test_changed_steps_maps_each_wizard_key():
    old = DraftCart(items=[ITEM], customer_id=5, wizard_state={})
    ws = {"dteData": {"a": 1}, "paymentData": {"b": 1}, "deliveryData": {"c": 1}}
    assert SaleTrackingService.changed_steps(old, items=[ITEM], customer_id=5, wizard_state=ws) == {
        Step.DTE, Step.PAYMENT, Step.DELIVERY,
    }


def test_changed_steps_manufacturing_vs_cart():
    old = DraftCart(items=[dict(ITEM)], customer_id=None, wizard_state={})
    mfg = [{**ITEM, "manufacturing_data": {"k": 1}}]
    assert SaleTrackingService.changed_steps(old, items=mfg, customer_id=None, wizard_state={}) == {Step.MANUFACTURING}
    qty = [{**ITEM, "quantity": 2}]
    assert SaleTrackingService.changed_steps(old, items=qty, customer_id=None, wizard_state={}) == {Step.CART}
    both = [{**ITEM, "quantity": 2, "manufacturing_data": {"k": 1}}]
    assert SaleTrackingService.changed_steps(old, items=both, customer_id=None, wizard_state={}) == {Step.CART, Step.MANUFACTURING}
    assert SaleTrackingService.changed_steps(old, items=[ITEM, ITEM], customer_id=None, wizard_state={}) == {Step.CART}


# ── registro por guardado ───────────────────────────────────────────────────

def test_new_draft_records_cart_and_customer(session, cashier, ana, customer):
    d = _save(session, _actor(ana, cashier), customer_id=customer.id)
    assert _row(d, Step.CART).operator == ana
    assert _row(d, Step.CUSTOMER).device_user == cashier
    assert SaleTrackingEvent.objects.filter(draft_ref=d.id).count() == 2


def test_step_row_is_upserted_not_appended(session, cashier, ana, beto):
    d = _save(session, _actor(ana, cashier))
    _save(session, _actor(ana, cashier), draft_id=d.id, wizard_state={"paymentData": {"m": 1}})
    _save(session, _actor(beto, cashier), draft_id=d.id, wizard_state={"paymentData": {"m": 2}})
    assert SaleTrackingEvent.objects.filter(draft_ref=d.id, step=Step.PAYMENT).count() == 1
    assert _row(d, Step.PAYMENT).operator == beto


def test_untouched_steps_keep_their_operator(session, cashier, ana, beto):
    d = _save(session, _actor(ana, cashier))
    _save(session, _actor(beto, cashier), draft_id=d.id, wizard_state={"paymentData": {"m": 1}})
    assert _row(d, Step.CART).operator == ana
    assert _row(d, Step.PAYMENT).operator == beto


def test_wizard_noise_records_nothing(session, cashier, ana, beto):
    d = _save(session, _actor(ana, cashier), wizard_state={"step": 1})
    before = _row(d, Step.CART).occurred_at
    _save(session, _actor(beto, cashier), draft_id=d.id, wizard_state={"step": 2, "isLoading": True})
    assert SaleTrackingEvent.objects.filter(draft_ref=d.id).count() == 1
    row = _row(d, Step.CART)
    assert row.operator == ana and row.occurred_at == before


# ── traspaso a la orden ─────────────────────────────────────────────────────

def test_transfer_links_rows_and_adds_checkout(session, cashier, ana, beto, customer):
    d = _save(session, _actor(ana, cashier), customer_id=customer.id)
    order = SaleOrder.objects.create(customer=customer)
    SaleTrackingService.transfer_to_order(draft_id=d.id, order=order, actor=_actor(beto, cashier))
    rows = SaleTrackingEvent.objects.filter(sale_order=order)
    assert {r.step for r in rows} == {Step.CART, Step.CUSTOMER, Step.CHECKOUT}
    assert rows.get(step=Step.CART).operator == ana
    assert rows.get(step=Step.CHECKOUT).operator == beto
    assert not SaleTrackingEvent.objects.filter(draft_ref=d.id, sale_order__isnull=True).exists()


def test_tracking_survives_draft_deletion(session, cashier, ana, customer):
    d = _save(session, _actor(ana, cashier))
    order = SaleOrder.objects.create(customer=customer)
    SaleTrackingService.transfer_to_order(draft_id=d.id, order=order, actor=_actor(ana, cashier))
    d.delete()
    assert SaleTrackingEvent.objects.filter(sale_order=order, step=Step.CART).exists()


def test_session_close_cleanup_discards_untransferred_rows(session, cashier, ana):
    d = _save(session, _actor(ana, cashier))
    assert SaleTrackingEvent.objects.filter(draft_ref=d.id).exists()
    DraftCartService.cleanup_on_session_close(session.id)
    assert not SaleTrackingEvent.objects.filter(draft_ref=d.id).exists()


def test_delete_draft_discards_untransferred_rows(session, cashier, ana):
    d = _save(session, _actor(ana, cashier))
    assert DraftCartService.delete_draft(d.id, session.id) is True
    assert not SaleTrackingEvent.objects.filter(draft_ref=d.id).exists()


def test_document_edit_always_inserts(session, cashier, ana, customer):
    order = SaleOrder.objects.create(customer=customer)
    for _ in range(2):
        SaleTrackingService.record_document_edit(
            actor=_actor(ana, cashier), pos_session=session, entity_type="sales.saleorder",
            entity_id=order.id, detail="PATCH partial_update", sale_order=order,
        )
    rows = SaleTrackingEvent.objects.filter(sale_order=order, step=Step.DOCUMENT_EDIT)
    assert rows.count() == 2 and rows.first().entity_id == order.id


def test_transfer_ignores_draft_rows_of_another_session(session, cashier, ana, customer):
    """Un draft_id enviado por el cliente no puede adoptar el seguimiento de otra sesión."""
    other = POSSession.objects.create(user=ana, mode="SINGLE")
    foreign = _save(other, _actor(ana, ana))
    order = SaleOrder.objects.create(customer=customer, pos_session=session)
    SaleTrackingService.transfer_to_order(draft_id=foreign.id, order=order, actor=_actor(ana, cashier))
    assert not SaleTrackingEvent.objects.filter(draft_ref=foreign.id, step=Step.CART, sale_order=order).exists()
    assert SaleTrackingEvent.objects.filter(sale_order=order, step=Step.CHECKOUT).count() == 1
