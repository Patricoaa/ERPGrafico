"""Borradores POS atribuidos al operador en cajas MULTI. Spec 2026-11-10 §5.2, §5.4, §5.5."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from sales.models import DraftCart, SaleTrackingEvent
from treasury.models import POSOperatorPass, POSSession

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


def _identify(api, session, operator, *, tab="tab1", target=None, purpose="DRAFT"):
    body = {"operator_id": operator.id, "tab_key": tab, "purpose": purpose}
    if target:
        body.update(target_type="sales.draftcart", target_id=target)
    r = api.post(f"/api/treasury/pos-sessions/{session.id}/identify_operator/", body, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def _create(api, session, tab="tab1", token=None, **extra):
    body = {"pos_session_id": session.id, "items": ITEMS, "session_key": tab, **extra}
    kw = {HEADER: token} if token else {}
    return api.post("/api/sales/pos-drafts/", body, format="json", **kw)


def _update(api, session, draft_id, token=None, tab="tab1", **extra):
    body = {"pos_session_id": session.id, "items": ITEMS, "session_key": tab, **extra}
    kw = {HEADER: token} if token else {}
    return api.put(f"/api/sales/pos-drafts/{draft_id}/", body, format="json", **kw)


def _lock(api, session, draft_id, token=None, tab="tab1"):
    kw = {HEADER: token} if token else {}
    return api.post(
        f"/api/sales/pos-drafts/{draft_id}/lock/",
        {"pos_session_id": session.id, "session_key": tab}, format="json", **kw,
    )


def _code(r):
    return r.json()["error"]["details"]


def test_multi_create_draft_without_pass_403(api, multi):
    r = _create(api, multi)
    assert r.status_code == 403
    assert _code(r) == {"detail": "Debe identificar al operador para esta acción.", "code": "pos_operator_required", "purpose": "DRAFT"}
    assert DraftCart.objects.count() == 0


def test_multi_create_binds_pass_to_draft(api, multi, ana, cashier):
    p = _identify(api, multi, ana)
    r = _create(api, multi, token=p["token"])
    assert r.status_code == 201, r.content
    d = DraftCart.objects.get()
    assert d.created_by == ana and d.last_modified_by == ana and d.locked_by == ana
    stored = POSOperatorPass.objects.get(pk=p["pass_id"])
    assert stored.target_id == d.id and stored.target_type == "sales.draftcart" and stored.expires_at is None
    assert stored.device_user == cashier


def test_multi_bound_pass_cannot_create_another_draft(api, multi, ana):
    p = _identify(api, multi, ana)
    assert _create(api, multi, token=p["token"]).status_code == 201
    assert _create(api, multi, token=p["token"]).status_code == 403


def test_multi_update_after_create_uses_same_pass(api, multi, ana):
    p = _identify(api, multi, ana)
    d_id = _create(api, multi, token=p["token"]).json()["id"]
    assert _update(api, multi, d_id, token=p["token"], name="X").status_code == 200


def test_multi_update_with_other_drafts_pass_403(api, multi, ana, beto):
    p1 = _identify(api, multi, ana, tab="t1")
    d1 = _create(api, multi, tab="t1", token=p1["token"]).json()["id"]
    p2 = _identify(api, multi, beto, tab="t2")
    d2 = _create(api, multi, tab="t2", token=p2["token"]).json()["id"]
    r = _update(api, multi, d1, token=p2["token"], tab="t2")
    assert r.status_code == 403 and _code(r)["code"] == "pos_operator_required"
    assert d1 != d2


def test_multi_update_after_lock_expired_403_and_pass_expired(api, multi, ana):
    p = _identify(api, multi, ana)
    d_id = _create(api, multi, token=p["token"]).json()["id"]
    DraftCart.objects.filter(pk=d_id).update(locked_at=timezone.now() - timedelta(seconds=16))
    r = _update(api, multi, d_id, token=p["token"])
    assert r.status_code == 403 and _code(r)["purpose"] == "DRAFT"
    assert POSOperatorPass.objects.get(pk=p["pass_id"]).end_reason == "EXPIRED"
    assert DraftCart.objects.get(pk=d_id).last_modified_by == ana


def test_multi_lock_sets_locked_by_operator(api, multi, ana, beto):
    p = _identify(api, multi, ana, tab="t1")
    d_id = _create(api, multi, tab="t1", token=p["token"]).json()["id"]
    api.post(f"/api/sales/pos-drafts/{d_id}/unlock/", {"pos_session_id": multi.id, "session_key": "t1"},
             format="json", **{HEADER: p["token"]})
    assert DraftCart.objects.get(pk=d_id).locked_by is None
    pb = _identify(api, multi, beto, tab="t2", target=d_id)
    assert _lock(api, multi, d_id, token=pb["token"], tab="t2").status_code == 200
    assert DraftCart.objects.get(pk=d_id).locked_by == beto


def test_multi_lock_without_pass_403(api, multi, ana):
    p = _identify(api, multi, ana)
    d_id = _create(api, multi, token=p["token"]).json()["id"]
    assert _lock(api, multi, d_id, tab="t9").status_code == 403


def test_multi_unlock_releases_pass_and_lock(api, multi, ana):
    p = _identify(api, multi, ana)
    d_id = _create(api, multi, token=p["token"]).json()["id"]
    r = api.post(f"/api/sales/pos-drafts/{d_id}/unlock/", {"pos_session_id": multi.id, "session_key": "tab1"},
                 format="json", **{HEADER: p["token"]})
    assert r.status_code == 200 and r.json() == {"unlocked": True}
    assert DraftCart.objects.get(pk=d_id).locked_by is None
    assert POSOperatorPass.objects.get(pk=p["pass_id"]).end_reason == "RELEASED"


def test_multi_sync_heartbeat_and_reads_need_no_pass(api, multi, ana):
    p = _identify(api, multi, ana)
    d_id = _create(api, multi, token=p["token"]).json()["id"]
    assert api.get("/api/sales/pos-drafts/sync/", {"pos_session_id": multi.id}).status_code == 200
    hb = api.post(f"/api/sales/pos-drafts/{d_id}/heartbeat/", {"pos_session_id": multi.id, "session_key": "tab1"}, format="json")
    assert hb.status_code in (200, 409)
    assert hb.status_code != 403
    assert api.get(f"/api/sales/pos-drafts/{d_id}/").status_code == 200
    assert api.get("/api/sales/pos-drafts/", {"pos_session_id": multi.id}).status_code == 200
    assert api.post(f"/api/sales/pos-drafts/{d_id}/restore/", {"pos_session_id": multi.id}, format="json").status_code == 200


def test_multi_destroy_needs_no_pass(api, multi, ana):
    p = _identify(api, multi, ana)
    d_id = _create(api, multi, token=p["token"]).json()["id"]
    r = api.delete(f"/api/sales/pos-drafts/{d_id}/?pos_session_id={multi.id}")
    assert r.status_code == 204


def test_two_operators_same_draft_tracked_per_step(api, multi, ana, beto):
    pa = _identify(api, multi, ana, tab="t1")
    d_id = _create(api, multi, tab="t1", token=pa["token"]).json()["id"]
    api.post(f"/api/sales/pos-drafts/{d_id}/unlock/", {"pos_session_id": multi.id, "session_key": "t1"},
             format="json", **{HEADER: pa["token"]})
    pb = _identify(api, multi, beto, tab="t2", target=d_id)
    assert _lock(api, multi, d_id, token=pb["token"], tab="t2").status_code == 200
    r = _update(api, multi, d_id, token=pb["token"], tab="t2", wizard_state={"paymentData": {"m": 1}})
    assert r.status_code == 200, r.content
    steps = {e.step: e.operator for e in SaleTrackingEvent.objects.filter(draft_ref=d_id)}
    assert steps["CART"] == ana and steps["PAYMENT"] == beto
    assert DraftCart.objects.get(pk=d_id).last_modified_by == beto


def test_single_mode_draft_flow_unchanged(api, single, cashier):
    r = _create(api, single)
    assert r.status_code == 201, r.content
    d = DraftCart.objects.get()
    assert d.created_by == cashier and d.locked_by == cashier
    assert _update(api, single, d.id, name="Y").status_code == 200
    ev = SaleTrackingEvent.objects.get(draft_ref=d.id, step="CART")
    assert ev.operator == cashier and ev.device_user == cashier and ev.operator_pass is None
    assert POSOperatorPass.objects.count() == 0


def test_multi_withdraw_without_pass_403(api, multi, ana):
    p = _identify(api, multi, ana)
    d_id = _create(api, multi, token=p["token"]).json()["id"]
    r = api.post(f"/api/sales/pos-drafts/{d_id}/withdraw/", {"pos_session_id": multi.id}, format="json")
    assert r.status_code == 403 and _code(r)["code"] == "pos_operator_required"
    assert DraftCart.objects.filter(pk=d_id).exists()
