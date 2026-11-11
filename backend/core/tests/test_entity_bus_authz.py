"""
Authorization tests for EntityBusConsumer — subscribe handler permission gate.

A user must hold `<app>.view_<model>` to subscribe to a topic.
Users without the permission receive an error event with code "forbidden".

Follows the same asyncio.run() pattern as test_consumers.py (no pytest-asyncio).
"""

import asyncio
from unittest.mock import MagicMock

import pytest
from channels.layers import channel_layers
from channels.testing import WebsocketCommunicator
from django.test import override_settings

from core.consumers import EntityBusConsumer

CHANNEL_LAYERS_INMEMORY = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}


@pytest.fixture(autouse=True)
def _isolated_channel_layer():
    """Fresh InMemoryChannelLayer per test — queues are bound to the event loop."""
    channel_layers.backends.pop("default", None)
    with override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_INMEMORY):
        yield
    channel_layers.backends.pop("default", None)


def _make_user(*, has_perm_result: bool, uid: int = 99) -> MagicMock:
    u = MagicMock()
    u.is_anonymous = False
    u.id = uid
    u.has_perm.return_value = has_perm_result
    return u


async def _open(user) -> WebsocketCommunicator:
    comm = WebsocketCommunicator(EntityBusConsumer.as_asgi(), "/ws/entity-bus/")
    comm.scope["user"] = user
    return comm


# ─── Forbidden path ────────────────────────────────────────────────────────────


def test_subscribe_without_permission_returns_forbidden():
    """User without hr.view_payroll gets an error event with code 'forbidden'."""

    async def go():
        user = _make_user(has_perm_result=False)
        comm = await _open(user)
        connected, _ = await comm.connect()
        assert connected is True

        await comm.send_json_to({"op": "subscribe", "topic": "hr.payroll"})
        msg = await comm.receive_json_from(timeout=2)

        assert msg["event"] == "error"
        assert msg["code"] == "forbidden"
        assert msg["topic"] == "hr.payroll"
        await comm.disconnect()

    asyncio.run(go())


def test_forbidden_subscribe_does_not_join_the_group():
    """After a forbidden subscribe, no messages arrive on that topic."""

    async def go():
        from channels.layers import get_channel_layer

        user = _make_user(has_perm_result=False)
        comm = await _open(user)
        await comm.connect()

        await comm.send_json_to({"op": "subscribe", "topic": "hr.payroll"})
        await comm.receive_json_from(timeout=2)  # consume the error

        # Broadcast to the forbidden topic — client must NOT receive it.
        layer = get_channel_layer()
        await layer.group_send(
            "entity.hr.payroll",
            {
                "type": "entity.changed",
                "payload": {
                    "event": "entity.changed",
                    "app": "hr",
                    "model": "payroll",
                    "id": 1,
                    "op": "updated",
                    "actor_id": None,
                    "ts": "...",
                },
            },
        )
        assert await comm.receive_nothing(timeout=0.4) is True
        await comm.disconnect()

    asyncio.run(go())


# ─── Allowed path ──────────────────────────────────────────────────────────────


def test_subscribe_with_permission_succeeds():
    """User with hr.view_payroll can subscribe and receives the 'subscribed' ack."""

    async def go():
        user = _make_user(has_perm_result=True)
        comm = await _open(user)
        connected, _ = await comm.connect()
        assert connected is True

        await comm.send_json_to({"op": "subscribe", "topic": "hr.payroll"})
        msg = await comm.receive_json_from(timeout=2)
        assert msg == {"event": "subscribed", "topic": "hr.payroll"}
        await comm.disconnect()

    asyncio.run(go())


def test_subscribe_with_permission_topic_with_id():
    """Permission check also works for topic format <app>.<model>.<id>."""

    async def go():
        user = _make_user(has_perm_result=True)
        comm = await _open(user)
        await comm.connect()

        await comm.send_json_to({"op": "subscribe", "topic": "hr.payroll.7"})
        msg = await comm.receive_json_from(timeout=2)
        assert msg == {"event": "subscribed", "topic": "hr.payroll.7"}
        await comm.disconnect()

    asyncio.run(go())


def test_subscribe_forbidden_with_id_topic():
    """Permission check applies regardless of topic having an id suffix."""

    async def go():
        user = _make_user(has_perm_result=False)
        comm = await _open(user)
        await comm.connect()

        await comm.send_json_to({"op": "subscribe", "topic": "hr.payroll.7"})
        msg = await comm.receive_json_from(timeout=2)
        assert msg["event"] == "error"
        assert msg["code"] == "forbidden"
        assert msg["topic"] == "hr.payroll.7"
        await comm.disconnect()

    asyncio.run(go())


# ─── Comment threads subtopic (ADR-0111) ───────────────────────────────────────


def test_comments_subtopic_requires_view_of_commented_entity():
    """`<app>.<model>.<id>.comments` is gated by the entity's view permission and
    delivers `comments.changed` events broadcast for that record."""

    async def go():
        from channels.layers import get_channel_layer

        user = _make_user(has_perm_result=True)
        comm = await _open(user)
        await comm.connect()

        topic = "contacts.contact.7.comments"
        await comm.send_json_to({"op": "subscribe", "topic": topic})
        assert await comm.receive_json_from(timeout=2) == {"event": "subscribed", "topic": topic}
        user.has_perm.assert_called_with("contacts.view_contact")

        payload = {"event": "comments.changed", "app": "contacts", "model": "contact", "id": 7}
        await get_channel_layer().group_send(
            f"entity.{topic}", {"type": "entity.changed", "payload": payload}
        )
        assert await comm.receive_json_from(timeout=2) == payload
        await comm.disconnect()

    asyncio.run(go())


def test_comments_suffix_without_id_is_malformed():
    async def go():
        comm = await _open(_make_user(has_perm_result=True))
        await comm.connect()
        await comm.send_json_to({"op": "subscribe", "topic": "contacts.contact.comments"})
        msg = await comm.receive_json_from(timeout=2)
        assert msg["code"] == "invalid_topic"
        await comm.disconnect()

    asyncio.run(go())


# ─── Comentarios de tarea: permiso heredado de la entidad dueña (ADR-0111) ─────


@pytest.mark.django_db(transaction=True)
def test_task_comments_subtopic_uses_parent_permission():
    from contacts.models import Contact
    from workflow.models import Task

    contact = Contact.objects.create(name="Dueña", tax_id="76888888-8")
    user = _make_user(has_perm_result=False)
    task = Task.objects.create(
        title="t", description="", task_type="TEST_BUS", status=Task.Status.PENDING,
        created_by=None, content_object=contact,
    )
    seen = []
    user.has_perm.side_effect = lambda perm: seen.append(perm) or False

    async def go():
        comm = await _open(user)
        await comm.connect()
        await comm.send_json_to({"op": "subscribe", "topic": f"workflow.task.{task.pk}.comments"})
        msg = await comm.receive_json_from(timeout=2)
        assert msg["code"] == "forbidden"
        await comm.disconnect()

    asyncio.run(go())
    # Se exige el permiso de la entidad dueña, no workflow.view_task.
    assert seen == ["contacts.view_contact"]


# ─── Sesión POS: solo autenticación (ADR-0126) ────────────────────────────────


def test_pos_session_topic_only_requires_authentication():
    """El cajero no tiene `treasury.view_possession` pero sí lee sus sesiones: puede suscribirse."""

    async def go():
        user = _make_user(has_perm_result=False)
        comm = await _open(user)
        await comm.connect()

        await comm.send_json_to({"op": "subscribe", "topic": "treasury.possession.7"})
        msg = await comm.receive_json_from(timeout=2)

        assert msg == {"event": "subscribed", "topic": "treasury.possession.7"}
        user.has_perm.assert_not_called()
        await comm.disconnect()

    asyncio.run(go())
