"""
Tests del decorador @idempotent_endpoint y del modelo IdempotencyRecord.

Contrato: docs/20-contracts/idempotency.md.
"""

import json
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from core.idempotency import idempotent_endpoint
from core.models import IdempotencyRecord, User
from core.tasks import purge_idempotency_records

# --- Fixture: a minimal view that wraps the decorator ---------------------------

SCOPE = "test.dummy.create"
CALL_COUNT = {"n": 0}


class _DummyView(APIView):
    @idempotent_endpoint(scope=SCOPE)
    def post(self, request, *args, **kwargs):
        CALL_COUNT["n"] += 1
        return Response(
            {"created": True, "n": CALL_COUNT["n"]}, status=http_status.HTTP_201_CREATED
        )


@pytest.fixture(autouse=True)
def _reset_call_count():
    CALL_COUNT["n"] = 0


@pytest.fixture
def user(db):
    return User.objects.create_user("idemp_user", "idemp@test.com", "pass")


@pytest.fixture
def factory():
    return APIRequestFactory()


def _json_hash(body: dict) -> str:
    """Return the SHA-256 hash of body as Django/DRF would encode it (compact JSON)."""
    from hashlib import sha256
    return sha256(json.dumps(body, separators=(",", ":")).encode()).hexdigest()


def _post(factory, user, *, key=None, body=None):
    body = body or {"foo": "bar"}
    headers = {}
    if key is not None:
        headers["HTTP_IDEMPOTENCY_KEY"] = key
    request = factory.post("/dummy/", body, format="json", **headers)
    if user is not None:
        force_authenticate(request, user=user)
    return _DummyView.as_view()(request)


# --- HTTP contract --------------------------------------------------------------


@pytest.mark.django_db
class TestIdempotentEndpointDecorator:
    def test_missing_header_returns_400(self, factory, user):
        resp = _post(factory, user, key=None)
        assert resp.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "Idempotency-Key" in resp.data["detail"]
        assert CALL_COUNT["n"] == 0

    def test_anonymous_returns_401(self, factory, db):
        resp = _post(factory, user=None, key="anon-key")
        assert resp.status_code == http_status.HTTP_401_UNAUTHORIZED
        assert CALL_COUNT["n"] == 0

    def test_first_call_executes_and_persists(self, factory, user):
        resp = _post(factory, user, key="key-1")
        assert resp.status_code == http_status.HTTP_201_CREATED
        assert resp.data == {"created": True, "n": 1}
        assert CALL_COUNT["n"] == 1

        record = IdempotencyRecord.objects.get(key="key-1", scope=SCOPE)
        assert record.status == IdempotencyRecord.Status.DONE
        assert record.response_status == 201
        assert record.response_payload == {"created": True, "n": 1}
        assert record.user_id == user.id

    def test_replay_same_body_returns_cached(self, factory, user):
        first = _post(factory, user, key="key-2", body={"foo": "bar"})
        assert first.status_code == 201
        assert CALL_COUNT["n"] == 1

        second = _post(factory, user, key="key-2", body={"foo": "bar"})
        assert second.status_code == 201
        # Body cacheado, no se llamó al view una segunda vez
        assert second.data == {"created": True, "n": 1}
        assert CALL_COUNT["n"] == 1

    def test_replay_different_body_returns_409(self, factory, user):
        first = _post(factory, user, key="key-3", body={"foo": "bar"})
        assert first.status_code == 201

        second = _post(factory, user, key="key-3", body={"foo": "DIFFERENT"})
        assert second.status_code == http_status.HTTP_409_CONFLICT
        assert "different body" in second.data["detail"]
        assert CALL_COUNT["n"] == 1  # nunca se re-ejecutó

    def test_different_key_executes_independently(self, factory, user):
        _post(factory, user, key="key-A")
        _post(factory, user, key="key-B")
        assert CALL_COUNT["n"] == 2
        assert IdempotencyRecord.objects.filter(scope=SCOPE).count() == 2

    def test_view_exception_marks_record_error(self, factory, user):
        class _ExplodingView(APIView):
            @idempotent_endpoint(scope=SCOPE)
            def post(self, request, *args, **kwargs):
                raise RuntimeError("boom")

        request = factory.post("/x/", {"a": 1}, format="json", HTTP_IDEMPOTENCY_KEY="err-key")
        force_authenticate(request, user=user)
        resp = _ExplodingView.as_view()(request)
        assert resp.status_code == http_status.HTTP_500_INTERNAL_SERVER_ERROR

        record = IdempotencyRecord.objects.get(key="err-key", scope=SCOPE)
        assert record.status == IdempotencyRecord.Status.ERROR


# --- Concurrent pending ---------------------------------------------------------


@pytest.mark.django_db
class TestPendingHandling:
    def test_pending_record_recent_returns_425(self, factory, user):
        # Simular request en vuelo: registro PENDING reciente
        body = {"foo": "bar"}
        expected_hash = _json_hash(body)
        IdempotencyRecord.objects.create(
            key="pending-key",
            scope=SCOPE,
            body_hash=expected_hash,
            user=user,
            status=IdempotencyRecord.Status.PENDING,
        )

        request = factory.post("/dummy/", body, format="json", HTTP_IDEMPOTENCY_KEY="pending-key")
        force_authenticate(request, user=user)
        resp = _DummyView.as_view()(request)

        assert resp.status_code == http_status.HTTP_425_TOO_EARLY
        assert CALL_COUNT["n"] == 0

    def test_pending_record_stale_allows_retry(self, factory, user):
        # PENDING record creado hace >60s → permite re-ejecutar (asume crash del worker original)
        body = {"foo": "bar"}
        expected_hash = _json_hash(body)

        rec = IdempotencyRecord.objects.create(
            key="stale-key",
            scope=SCOPE,
            body_hash=expected_hash,
            user=user,
            status=IdempotencyRecord.Status.PENDING,
        )
        # Backdate
        IdempotencyRecord.objects.filter(pk=rec.pk).update(
            created_at=timezone.now() - timedelta(seconds=120)
        )

        request = factory.post("/dummy/", body, format="json", HTTP_IDEMPOTENCY_KEY="stale-key")
        force_authenticate(request, user=user)
        resp = _DummyView.as_view()(request)

        assert resp.status_code == http_status.HTTP_201_CREATED
        assert CALL_COUNT["n"] == 1
        rec.refresh_from_db()
        assert rec.status == IdempotencyRecord.Status.DONE


# --- Cleanup task ---------------------------------------------------------------


@pytest.mark.django_db
class TestPurgeIdempotencyRecords:
    def test_purges_records_older_than_retention(self, user):
        old = IdempotencyRecord.objects.create(
            key="old",
            scope=SCOPE,
            body_hash="x",
            user=user,
            status=IdempotencyRecord.Status.DONE,
        )
        recent = IdempotencyRecord.objects.create(
            key="recent",
            scope=SCOPE,
            body_hash="y",
            user=user,
            status=IdempotencyRecord.Status.DONE,
        )
        # Backdate "old" a 25h atrás
        IdempotencyRecord.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(hours=25)
        )

        deleted = purge_idempotency_records(retention_hours=24)
        assert deleted == 1
        assert not IdempotencyRecord.objects.filter(pk=old.pk).exists()
        assert IdempotencyRecord.objects.filter(pk=recent.pk).exists()

    def test_no_op_when_nothing_old(self, user):
        IdempotencyRecord.objects.create(
            key="fresh",
            scope=SCOPE,
            body_hash="z",
            user=user,
            status=IdempotencyRecord.Status.DONE,
        )
        deleted = purge_idempotency_records(retention_hours=24)
        assert deleted == 0
        assert IdempotencyRecord.objects.filter(key="fresh").exists()


# --- Model basics ---------------------------------------------------------------


@pytest.mark.django_db
class TestIdempotencyRecordModel:
    def test_unique_constraint_on_key_scope(self, user):
        from django.db import IntegrityError

        IdempotencyRecord.objects.create(
            key="k",
            scope=SCOPE,
            body_hash="x",
            user=user,
            status=IdempotencyRecord.Status.PENDING,
        )
        with pytest.raises(IntegrityError):
            IdempotencyRecord.objects.create(
                key="k",
                scope=SCOPE,
                body_hash="x",
                user=user,
                status=IdempotencyRecord.Status.PENDING,
            )

    def test_same_key_different_scope_allowed(self, user):
        IdempotencyRecord.objects.create(
            key="k",
            scope="a",
            body_hash="x",
            user=user,
            status=IdempotencyRecord.Status.PENDING,
        )
        # Mismo key, scope distinto → permitido
        IdempotencyRecord.objects.create(
            key="k",
            scope="b",
            body_hash="x",
            user=user,
            status=IdempotencyRecord.Status.PENDING,
        )
        assert IdempotencyRecord.objects.filter(key="k").count() == 2

    def test_str_representation(self, user):
        rec = IdempotencyRecord.objects.create(
            key="foo",
            scope="billing.invoice.create",
            body_hash="x",
            user=user,
            status=IdempotencyRecord.Status.DONE,
        )
        assert str(rec) == "billing.invoice.create:foo[done]"
