"""Ediciones de documentos desde el panel de ventas del POS. Spec 2026-11-10 §5.2 y §5.6."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from contacts.models import Contact
from sales.models import SaleOrder, SaleTrackingEvent
from treasury.models import POSOperatorPass
from treasury.tests.helpers import make_pos_session
from treasury.pos_operator_service import POSOperatorService

User = get_user_model()
PASS = "HTTP_X_POS_OPERATOR_PASS"
CTX = "HTTP_X_POS_DOCUMENT_CONTEXT"


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
def api(cashier):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(cashier).access_token}")
    return c


@pytest.fixture
def multi(cashier):
    return make_pos_session(cashier, "MULTI")


@pytest.fixture
def single(cashier):
    return make_pos_session(cashier, "SINGLE")


@pytest.fixture
def contact(db):
    return Contact.objects.create(name="Cliente", tax_id="11111111-1")


def _edit_pass(multi, cashier, ana, **kw):
    return POSOperatorService.identify(
        session=multi, device_user=cashier, operator_id=ana.id, tab_key="t1",
        purpose="DOCUMENT_EDIT", **kw,
    )


def _patch(api, contact, name="Nuevo", **headers):
    return api.patch(f"/api/contacts/{contact.id}/", {"name": name}, format="json", **headers)


def test_write_without_context_header_is_untouched(api, multi, contact):
    r = _patch(api, contact)
    assert r.status_code == 200, r.content
    assert SaleTrackingEvent.objects.count() == 0


def test_multi_write_with_context_and_no_pass_403(api, multi, contact):
    r = _patch(api, contact, **{CTX: str(multi.id)})
    assert r.status_code == 403
    details = r.json()["error"]["details"]
    assert details["code"] == "pos_operator_required" and details["purpose"] == "DOCUMENT_EDIT"
    contact.refresh_from_db()
    assert contact.name == "Cliente"


def test_multi_write_with_pass_records_event(api, multi, cashier, ana, contact):
    order = SaleOrder.objects.create(customer=contact)
    _, token = _edit_pass(multi, cashier, ana, target_type="sales.saleorder", target_id=order.id)
    r = _patch(api, contact, **{CTX: str(multi.id), PASS: token})
    assert r.status_code == 200, r.content
    ev = SaleTrackingEvent.objects.get()
    assert ev.step == "DOCUMENT_EDIT" and ev.operator == ana and ev.device_user == cashier
    assert ev.entity_type == "contacts.contact" and ev.entity_id == contact.id
    assert ev.sale_order_id == order.id and ev.pos_session_id == multi.id
    assert ev.operator_pass_id and "PATCH" in ev.detail


def test_failed_write_records_nothing(api, multi, cashier, ana, contact):
    _, token = _edit_pass(multi, cashier, ana)
    r = api.patch(f"/api/contacts/{contact.id}/", {"name": ""}, format="json", **{CTX: str(multi.id), PASS: token})
    assert r.status_code >= 400
    assert SaleTrackingEvent.objects.count() == 0


def test_single_write_with_context_records_event_as_user(api, single, cashier, contact):
    r = _patch(api, contact, **{CTX: str(single.id)})
    assert r.status_code == 200
    ev = SaleTrackingEvent.objects.get()
    assert ev.operator == cashier and ev.device_user == cashier and ev.operator_pass is None


def test_get_with_context_needs_no_pass(api, multi, contact):
    assert api.get(f"/api/contacts/{contact.id}/", **{CTX: str(multi.id)}).status_code == 200
    assert SaleTrackingEvent.objects.count() == 0


def test_pass_survives_multiple_edits(api, multi, cashier, ana, contact):
    _, token = _edit_pass(multi, cashier, ana)
    for name in ("Uno", "Dos"):
        assert _patch(api, contact, name, **{CTX: str(multi.id), PASS: token}).status_code == 200
    assert SaleTrackingEvent.objects.filter(step="DOCUMENT_EDIT").count() == 2
    assert POSOperatorPass.objects.get().ended_at is None


def test_wrong_purpose_pass_is_rejected(api, multi, cashier, ana, contact):
    _, token = POSOperatorService.identify(
        session=multi, device_user=cashier, operator_id=ana.id, tab_key="t1", purpose="CASH_MOVEMENT"
    )
    assert _patch(api, contact, **{CTX: str(multi.id), PASS: token}).status_code == 403


def test_draft_and_session_routes_are_exempt(api, multi):
    r = api.post("/api/sales/pos-drafts/1/heartbeat/", {"pos_session_id": multi.id, "session_key": "t"},
                 format="json", **{CTX: str(multi.id)})
    assert r.status_code != 403 or r.json()["error"]["details"].get("code") != "pos_operator_required"
    r = api.post(f"/api/treasury/pos-sessions/{multi.id}/release_operator/", **{CTX: str(multi.id)})
    assert r.status_code == 204


def test_closed_or_unknown_session_header_is_ignored(api, multi, contact):
    assert _patch(api, contact, **{CTX: "999999"}).status_code == 200
    multi.status = "CLOSED"
    multi.save()
    assert _patch(api, contact, "Otro", **{CTX: str(multi.id)}).status_code == 200
    assert SaleTrackingEvent.objects.count() == 0


def test_invalid_header_value_is_ignored(api, multi, contact):
    assert _patch(api, contact, **{CTX: "abc"}).status_code == 200


def test_unauthenticated_request_is_left_to_the_view(multi, contact):
    r = APIClient().patch(f"/api/contacts/{contact.id}/", {"name": "x"}, format="json", **{CTX: str(multi.id)})
    assert r.status_code in (401, 403)
    assert "pos_operator_required" not in r.content.decode()


def test_multi_edit_with_pass_targeting_missing_order_still_succeeds(api, multi, cashier, ana, contact):
    """El seguimiento nunca convierte una escritura ya confirmada en un 500."""
    _, token = _edit_pass(multi, cashier, ana, target_type="sales.saleorder", target_id=999999)
    r = _patch(api, contact, **{CTX: str(multi.id), PASS: token})
    assert r.status_code == 200, r.content
    row = SaleTrackingEvent.objects.get()
    assert row.sale_order_id is None
    assert row.operator_id == ana.id
