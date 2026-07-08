"""
Tests del EntityBusConsumer — protocolo wire del entity bus.

ADR      : docs/10-architecture/adr/0026-entity-bus-realtime-invalidation.md
Contrato : docs/20-contracts/realtime-channels.md §"Entity Bus"

`pytest-asyncio` no está instalado en este repo: cada test envuelve su cuerpo
async con `asyncio.run()`. El cache del channel layer se resetea entre tests
para garantizar aislamiento (las colas in-memory son por-event-loop).
"""

import asyncio
from unittest.mock import MagicMock

import pytest
from channels.layers import channel_layers, get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import override_settings

from core.consumers import EntityBusConsumer

CHANNEL_LAYERS_INMEMORY = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}


@pytest.fixture(autouse=True)
def _isolated_channel_layer():
    """Force a fresh InMemoryChannelLayer per test — queues are bound to the
    event loop created by asyncio.run(), so reusing a cached layer leaks state."""
    channel_layers.backends.pop("default", None)
    with override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_INMEMORY):
        yield
    channel_layers.backends.pop("default", None)


def _fake_user(uid: int = 42):
    """The consumer only reads `user.id` and `user.is_anonymous` — no DB needed."""
    u = MagicMock()
    u.is_anonymous = False
    u.id = uid
    return u


async def _open(user) -> WebsocketCommunicator:
    """Build a communicator with `user` pre-set in scope (skipping JWTAuthMiddleware)."""
    comm = WebsocketCommunicator(EntityBusConsumer.as_asgi(), "/ws/entity-bus/")
    if user is not None:
        comm.scope["user"] = user
    return comm


# ─── Auth gate ────────────────────────────────────────────────────────────────


def test_anonymous_user_is_rejected_with_4001():
    async def go():
        anon = MagicMock(is_anonymous=True)
        comm = await _open(anon)
        connected, code = await comm.connect()
        assert connected is False
        assert code == 4001

    asyncio.run(go())


def test_missing_user_in_scope_is_rejected_with_4001():
    async def go():
        comm = await _open(user=None)
        connected, code = await comm.connect()
        assert connected is False
        assert code == 4001

    asyncio.run(go())


def test_authenticated_user_is_accepted():
    async def go():
        comm = await _open(_fake_user(uid=7))
        connected, _ = await comm.connect()
        assert connected is True
        await comm.disconnect()

    asyncio.run(go())


# ─── Auto-join al grupo de usuario (cross-tab del propio usuario) ─────────────


def test_authenticated_user_receives_broadcasts_on_their_user_group():
    """Connect → server group_send a `entity.user.<id>` → cliente recibe el payload
    sin haber hecho `subscribe`. Esto garantiza el cross-tab del propio usuario."""

    async def go():
        comm = await _open(_fake_user(uid=42))
        connected, _ = await comm.connect()
        assert connected is True

        payload = {
            "event": "entity.changed",
            "app": "sales",
            "model": "saleorder",
            "id": 9,
            "op": "updated",
            "actor_id": 42,
            "ts": "2026-05-22T00:00:00Z",
        }
        layer = get_channel_layer()
        await layer.group_send("entity.user.42", {"type": "entity.changed", "payload": payload})

        received = await comm.receive_json_from(timeout=2)
        assert received == payload
        await comm.disconnect()

    asyncio.run(go())


# ─── Subscribe / unsubscribe protocol ─────────────────────────────────────────


def test_subscribe_acks_and_then_forwards_topic_broadcast():
    async def go():
        comm = await _open(_fake_user())
        await comm.connect()

        await comm.send_json_to({"op": "subscribe", "topic": "sales.saleorder"})
        ack = await comm.receive_json_from(timeout=2)
        assert ack == {"event": "subscribed", "topic": "sales.saleorder"}

        payload = {
            "event": "entity.changed",
            "app": "sales",
            "model": "saleorder",
            "id": 1,
            "op": "created",
            "actor_id": 99,
            "ts": "2026-05-22T00:00:00Z",
        }
        layer = get_channel_layer()
        await layer.group_send(
            "entity.sales.saleorder",
            {"type": "entity.changed", "payload": payload},
        )

        received = await comm.receive_json_from(timeout=2)
        assert received == payload
        await comm.disconnect()

    asyncio.run(go())


def test_unsubscribe_stops_delivery_to_that_topic():
    async def go():
        comm = await _open(_fake_user())
        await comm.connect()

        await comm.send_json_to({"op": "subscribe", "topic": "sales.saleorder.123"})
        await comm.receive_json_from(timeout=2)  # subscribed ack

        await comm.send_json_to({"op": "unsubscribe", "topic": "sales.saleorder.123"})
        ack = await comm.receive_json_from(timeout=2)
        assert ack == {"event": "unsubscribed", "topic": "sales.saleorder.123"}

        # After unsubscribe, broadcasts on that topic must NOT arrive.
        layer = get_channel_layer()
        await layer.group_send(
            "entity.sales.saleorder.123",
            {
                "type": "entity.changed",
                "payload": {
                    "event": "entity.changed",
                    "app": "sales",
                    "model": "saleorder",
                    "id": 123,
                    "op": "updated",
                    "actor_id": None,
                    "ts": "...",
                },
            },
        )
        assert await comm.receive_nothing(timeout=0.4) is True
        await comm.disconnect()

    asyncio.run(go())


# ─── Validation ───────────────────────────────────────────────────────────────


def test_malformed_topic_returns_invalid_topic_error():
    async def go():
        comm = await _open(_fake_user())
        await comm.connect()

        await comm.send_json_to({"op": "subscribe", "topic": "Sales.SaleOrder"})  # uppercase
        msg = await comm.receive_json_from(timeout=2)
        assert msg["event"] == "error"
        assert msg["code"] == "invalid_topic"
        await comm.disconnect()

    asyncio.run(go())


def test_invalid_command_returns_invalid_command_error():
    async def go():
        comm = await _open(_fake_user())
        await comm.connect()

        await comm.send_json_to({"op": "lol", "topic": "sales.saleorder"})
        msg = await comm.receive_json_from(timeout=2)
        assert msg["event"] == "error"
        assert msg["code"] == "invalid_command"
        await comm.disconnect()

    asyncio.run(go())
