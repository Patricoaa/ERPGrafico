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
