"""Endpoints de operador de la sesión POS. Spec 2026-11-10 §5.3."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from treasury.models import POSOperatorPass, POSSession
from treasury.selectors import POSSelector

User = get_user_model()


def _user(username, *, perm=True, active=True, superuser=False):
    u = User.objects.create_user(
        username=username, password="x", first_name=username.title(), last_name="Prueba",
        is_active=active, is_superuser=superuser,
    )
    if perm:
        u.user_permissions.add(
            Permission.objects.get(codename="add_saleorder", content_type__app_label="sales")
        )
    return u


@pytest.fixture
def cashier(db):
    return _user("cashier", perm=False)


@pytest.fixture
def api(cashier):
    c = APIClient()
    c.force_authenticate(user=cashier)
    return c


@pytest.fixture
def multi_session(cashier):
    return POSSession.objects.create(user=cashier, mode="MULTI")


@pytest.fixture
def single_session(cashier):
    return POSSession.objects.create(user=cashier, mode="SINGLE")


def _url(session, action):
    return f"/api/treasury/pos-sessions/{session.id}/{action}/"


def _identify(api, session, operator, **extra):
    body = {"operator_id": operator.id, "tab_key": "t1", "purpose": "CASH_MOVEMENT", **extra}
    return api.post(_url(session, "identify_operator"), body, format="json")


def test_operators_lists_only_active_sellers(api, multi_session):
    seller = _user("ana")
    _user("inactiva", active=False)
    _user("sinpermiso", perm=False)
    boss = _user("jefe", perm=False, superuser=True)
    r = api.get(_url(multi_session, "operators"))
    assert r.status_code == 200
    ids = [o["id"] for o in r.json()]
    assert set(ids) == {seller.id, boss.id}
    first = next(o for o in r.json() if o["id"] == seller.id)
    assert first["full_name"] == "Ana Prueba" and first["initials"] == "AP"
    assert first["username"] == "ana"  # el blobatar se genera a partir del usuario


def test_operators_includes_ventas_group(api, multi_session):
    call_command("sync_permissions", verbosity=0)
    u = User.objects.create_user(username="vendedora", password="x")
    u.groups.add(Group.objects.get(name="Ventas"))
    assert u in POSSelector.list_operators()


def test_operators_query_count_is_constant(api, multi_session):
    def count():
        with CaptureQueriesContext(connection) as ctx:
            assert api.get(_url(multi_session, "operators")).status_code == 200
        return len(ctx)

    for i in range(3):
        _user(f"v{i}")
    few = count()
    for i in range(3, 33):
        _user(f"v{i}")
    assert count() == few


def test_identify_returns_token_once(api, multi_session):
    seller = _user("ana")
    r = _identify(api, multi_session, seller)
    assert r.status_code == 201
    body = r.json()
    assert body["token"] and body["operator"] == {"id": seller.id, "full_name": "Ana Prueba"}
    assert body["purpose"] == "CASH_MOVEMENT" and body["expires_at"]
    stored = POSOperatorPass.objects.get(pk=body["pass_id"])
    assert stored.token_hash != body["token"]


def test_identify_rejects_non_operator(api, multi_session):
    r = _identify(api, multi_session, _user("sinpermiso", perm=False))
    assert r.status_code == 400


def test_identify_rejects_single_session(api, single_session):
    assert _identify(api, single_session, _user("ana")).status_code == 400


def test_identify_rejects_invalid_purpose(api, multi_session):
    assert _identify(api, multi_session, _user("ana"), purpose="NOPE").status_code == 400


def test_identify_accepts_credential_and_target(api, multi_session):
    r = _identify(
        api, multi_session, _user("ana"), purpose="DRAFT",
        target_type="sales.draftcart", target_id=5, credential={"pin": "1234"},
    )
    assert r.status_code == 201
    assert POSOperatorPass.objects.get(pk=r.json()["pass_id"]).target_id == 5


def test_release_ends_pass(api, multi_session):
    r = _identify(api, multi_session, _user("ana"))
    out = api.post(_url(multi_session, "release_operator"), HTTP_X_POS_OPERATOR_PASS=r.json()["token"])
    assert out.status_code == 204
    p = POSOperatorPass.objects.get(pk=r.json()["pass_id"])
    assert p.end_reason == "RELEASED" and p.ended_at is not None


def test_release_without_pass_is_204(api, multi_session):
    assert api.post(_url(multi_session, "release_operator")).status_code == 204


def test_release_unknown_pass_is_204(api, multi_session):
    r = api.post(_url(multi_session, "release_operator"), HTTP_X_POS_OPERATOR_PASS="nope")
    assert r.status_code == 204


def test_anonymous_cannot_list_operators(multi_session):
    assert APIClient().get(_url(multi_session, "operators")).status_code in (401, 403)
