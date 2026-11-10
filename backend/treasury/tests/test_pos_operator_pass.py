"""Pase de operador y resolución del actor. Spec 2026-11-10 §5.3-5.5."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone

from treasury.models import POSOperatorPass, POSSession
from treasury.pos_operator_service import POSOperatorRequired, POSOperatorService

User = get_user_model()


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
def multi_session(cashier):
    return POSSession.objects.create(user=cashier, mode="MULTI")


@pytest.fixture
def single_session(cashier):
    return POSSession.objects.create(user=cashier, mode="SINGLE")


def _identify(session, cashier, operator, tab="t1", purpose="CASH_MOVEMENT", **kw):
    return POSOperatorService.identify(
        session=session, device_user=cashier, operator_id=operator.id,
        tab_key=tab, purpose=purpose, **kw,
    )


def _resolve(session, cashier, token, purpose="CASH_MOVEMENT", **kw):
    return POSOperatorService.resolve_actor(
        session=session, device_user=cashier, raw_token=token, purpose=purpose, **kw
    )


def test_single_mode_returns_device_user_without_token(single_session, cashier):
    a = _resolve(single_session, cashier, None)
    assert a.operator == cashier and a.device_user == cashier and a.operator_pass is None


def test_multi_requires_pass(multi_session, cashier):
    with pytest.raises(POSOperatorRequired) as exc:
        _resolve(multi_session, cashier, None)
    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "pos_operator_required"
    assert exc.value.detail["purpose"] == "CASH_MOVEMENT"


def test_identify_then_resolve(multi_session, cashier, ana):
    p, token = _identify(multi_session, cashier, ana)
    a = _resolve(multi_session, cashier, token)
    assert a.operator == ana and a.device_user == cashier and a.operator_pass == p
    assert p.token_hash != token and len(p.token_hash) == 64


def test_new_pass_supersedes_previous_same_tab(multi_session, cashier, ana, beto):
    p1, t1 = _identify(multi_session, cashier, ana)
    _identify(multi_session, cashier, beto, purpose="SESSION_CLOSE")
    with pytest.raises(POSOperatorRequired):
        _resolve(multi_session, cashier, t1)
    p1.refresh_from_db()
    assert p1.end_reason == POSOperatorPass.EndReason.SUPERSEDED


def test_other_tab_is_not_superseded(multi_session, cashier, ana, beto):
    _, t1 = _identify(multi_session, cashier, ana, tab="t1")
    _identify(multi_session, cashier, beto, tab="t2")
    assert _resolve(multi_session, cashier, t1).operator == ana


@pytest.mark.parametrize(
    "case", ["wrong_purpose", "other_session", "other_device_user", "ended", "expired", "unknown_token"]
)
def test_pass_rejections(case, multi_session, cashier, ana, beto):
    p, token = _identify(multi_session, cashier, ana)
    session, device, purpose = multi_session, cashier, "CASH_MOVEMENT"
    if case == "wrong_purpose":
        purpose = "SESSION_CLOSE"
    elif case == "other_session":
        session = POSSession.objects.create(user=beto, mode="MULTI")
    elif case == "other_device_user":
        device = beto
    elif case == "ended":
        POSOperatorService.end(p, "RELEASED")
    elif case == "expired":
        p.expires_at = timezone.now() - timedelta(seconds=1)
        p.save()
    elif case == "unknown_token":
        token = "nope"
    with pytest.raises(POSOperatorRequired):
        _resolve(session, device, token, purpose=purpose)
    if case == "expired":
        p.refresh_from_db()
        assert p.end_reason == POSOperatorPass.EndReason.EXPIRED


def test_deactivated_operator_is_rejected(multi_session, cashier, ana):
    _, t = _identify(multi_session, cashier, ana)
    ana.is_active = False
    ana.save()
    with pytest.raises(POSOperatorRequired):
        _resolve(multi_session, cashier, t)


def test_identify_rejected_on_single_session(single_session, cashier, ana):
    with pytest.raises(ValidationError):
        _identify(single_session, cashier, ana)


def test_identify_rejected_on_closed_session(multi_session, cashier, ana):
    multi_session.status = "CLOSED"
    multi_session.save()
    with pytest.raises(ValidationError):
        _identify(multi_session, cashier, ana)


def test_identify_rejects_inactive_or_unknown_operator(multi_session, cashier, ana):
    ana.is_active = False
    ana.save()
    with pytest.raises(ValidationError):
        _identify(multi_session, cashier, ana)
    with pytest.raises(ValidationError):
        POSOperatorService.identify(
            session=multi_session, device_user=cashier, operator_id=999999,
            tab_key="t1", purpose="CASH_MOVEMENT",
        )


def test_credential_is_accepted_and_ignored(multi_session, cashier, ana):
    p, token = _identify(multi_session, cashier, ana, credential={"pin": "1234"})
    assert _resolve(multi_session, cashier, token).operator == ana


def test_expiry_by_purpose(multi_session, cashier, ana):
    now = timezone.now()
    cash, _ = _identify(multi_session, cashier, ana, tab="a", purpose="CASH_MOVEMENT")
    close, _ = _identify(multi_session, cashier, ana, tab="b", purpose="SESSION_CLOSE")
    unbound, _ = _identify(multi_session, cashier, ana, tab="c", purpose="DRAFT")
    bound, _ = _identify(
        multi_session, cashier, ana, tab="d", purpose="DRAFT",
        target_type="sales.draftcart", target_id=7,
    )
    edit, _ = _identify(multi_session, cashier, ana, tab="e", purpose="DOCUMENT_EDIT")
    assert timedelta(minutes=4) < cash.expires_at - now <= timedelta(minutes=5, seconds=5)
    assert timedelta(minutes=4) < close.expires_at - now <= timedelta(minutes=5, seconds=5)
    assert timedelta(minutes=29) < unbound.expires_at - now <= timedelta(minutes=30, seconds=5)
    assert bound.expires_at is None and edit.expires_at is None


def test_bound_pass_requires_matching_target(multi_session, cashier, ana):
    _, token = _identify(
        multi_session, cashier, ana, purpose="DRAFT", target_type="sales.draftcart", target_id=7
    )
    assert _resolve(multi_session, cashier, token, purpose="DRAFT", target_id=7).operator == ana
    with pytest.raises(POSOperatorRequired):
        _resolve(multi_session, cashier, token, purpose="DRAFT", target_id=8)


def test_bind_target_clears_expiry(multi_session, cashier, ana):
    p, token = _identify(multi_session, cashier, ana, purpose="DRAFT")
    assert p.expires_at is not None
    POSOperatorService.bind_target(p, "sales.draftcart", 11)
    p.refresh_from_db()
    assert p.target_id == 11 and p.target_type == "sales.draftcart" and p.expires_at is None
    assert _resolve(multi_session, cashier, token, purpose="DRAFT", target_id=11).operator == ana


def test_end_is_idempotent(multi_session, cashier, ana):
    p, _ = _identify(multi_session, cashier, ana)
    POSOperatorService.end(p, "CONSUMED")
    first = POSOperatorPass.objects.get(pk=p.pk)
    POSOperatorService.end(p, "RELEASED")
    again = POSOperatorPass.objects.get(pk=p.pk)
    assert again.end_reason == "CONSUMED" and again.ended_at == first.ended_at


def test_actor_from_request_reads_header(multi_session, cashier, ana):
    _, token = _identify(multi_session, cashier, ana)

    class Req:
        user = cashier
        headers = {"X-POS-Operator-Pass": token}

    a = POSOperatorService.actor_from_request(Req, multi_session, "CASH_MOVEMENT")
    assert a.operator == ana
