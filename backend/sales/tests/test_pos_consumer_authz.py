"""
Authorization tests for POSDraftConsumer — connect() permission gate.

A user must hold `sales.view_draftcart` to connect to a POS session WebSocket.
Users without the permission are rejected with close code 4003.

Follows the same asyncio.run() pattern as core/tests/test_consumers.py (no pytest-asyncio).
"""

import asyncio
from unittest.mock import MagicMock

import pytest
from channels.layers import channel_layers
from channels.testing import WebsocketCommunicator
from django.test import override_settings

from sales.consumers import POSDraftConsumer

CHANNEL_LAYERS_INMEMORY = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}


@pytest.fixture(autouse=True)
def _isolated_channel_layer():
    """Fresh InMemoryChannelLayer per test."""
    channel_layers.backends.pop("default", None)
    with override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_INMEMORY):
        yield
    channel_layers.backends.pop("default", None)


def _make_user(*, has_perm_result: bool, uid: int = 77) -> MagicMock:
    u = MagicMock()
    u.is_authenticated = True
    u.is_anonymous = False
    u.id = uid
    u.has_perm.return_value = has_perm_result
    return u


def _pos_communicator(session_id: str = "1") -> WebsocketCommunicator:
    """Build a communicator for the POS consumer with url_route pre-set."""
    comm = WebsocketCommunicator(
        POSDraftConsumer.as_asgi(),
        f"ws/sales/pos/{session_id}/",
    )
    comm.scope["url_route"] = {"kwargs": {"session_id": session_id}}
    return comm


# ─── Forbidden path ────────────────────────────────────────────────────────────


def test_pos_session_without_view_draftcart_is_rejected_with_4003():
    """User without sales.view_draftcart cannot connect — receives close code 4003."""

    async def go():
        comm = _pos_communicator()
        comm.scope["user"] = _make_user(has_perm_result=False)
        connected, code = await comm.connect()
        assert connected is False
        assert code == 4003

    asyncio.run(go())


# ─── Allowed path ──────────────────────────────────────────────────────────────


def test_pos_session_with_view_draftcart_connects_successfully():
    """User with sales.view_draftcart can connect to the POS session."""

    async def go():
        comm = _pos_communicator()
        comm.scope["user"] = _make_user(has_perm_result=True)
        connected, _ = await comm.connect()
        assert connected is True
        await comm.disconnect()

    asyncio.run(go())


def test_unauthenticated_user_is_still_rejected_with_4001():
    """Unauthenticated users are still rejected with code 4001 (existing behavior)."""

    async def go():
        comm = _pos_communicator()
        u = MagicMock()
        u.is_authenticated = False
        comm.scope["user"] = u
        connected, code = await comm.connect()
        assert connected is False
        assert code == 4001

    asyncio.run(go())
