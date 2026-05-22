"""
Tests del entity bus — signal genérica + ALLOWLIST + PARENT_BROADCASTS.

Contrato : docs/20-contracts/realtime-channels.md §"Entity Bus"
ADR      : docs/10-architecture/adr/0026-entity-bus-realtime-invalidation.md
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from core import entity_bus
from contacts.models import Contact
from sales.models import SaleOrder, SaleLine


# ─── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def captured_layer(monkeypatch):
    """Replace the channel layer so we can assert on `group_send` calls without
    needing Redis. AsyncMock satisfies the inner `async_to_sync(...)` wrapper."""
    layer = MagicMock()
    layer.group_send = AsyncMock(return_value=None)
    monkeypatch.setattr(entity_bus, "get_channel_layer", lambda: layer)
    return layer


@pytest.fixture
def actor_42(monkeypatch):
    monkeypatch.setattr(entity_bus, "get_current_user_id", lambda: 42)
    return 42


@pytest.fixture
def no_actor(monkeypatch):
    monkeypatch.setattr(entity_bus, "get_current_user_id", lambda: None)


@pytest.fixture
def customer(db):
    return Contact.objects.create(name="Realtime Test Customer", is_customer=True)


@pytest.fixture
def broadcast_spy(monkeypatch):
    """Spy on `_broadcast` so we can assert which (app, model, id, op) tuples the
    signal layer publishes, without going through the channel layer at all."""
    calls = []

    def fake(*, app, model, instance_id, op):
        calls.append({"app": app, "model": model, "id": instance_id, "op": op})

    monkeypatch.setattr(entity_bus, "_broadcast", fake)
    return calls


def _group_send_args(layer):
    """[(group, payload_dict), ...] from the mocked layer."""
    return [
        (call.args[0], call.args[1]["payload"])
        for call in layer.group_send.call_args_list
    ]


# ─── _broadcast — direct unit tests ────────────────────────────────────────────

def test_broadcast_emits_to_three_groups_when_actor_is_known(captured_layer, actor_42):
    entity_bus._broadcast(app="sales", model="saleorder", instance_id=7, op="updated")

    groups = [g for g, _ in _group_send_args(captured_layer)]
    assert groups == [
        "entity.sales.saleorder",
        "entity.sales.saleorder.7",
        "entity.user.42",
    ]


def test_broadcast_omits_user_group_when_no_actor(captured_layer, no_actor):
    entity_bus._broadcast(app="sales", model="saleorder", instance_id=7, op="updated")

    groups = [g for g, _ in _group_send_args(captured_layer)]
    assert groups == [
        "entity.sales.saleorder",
        "entity.sales.saleorder.7",
    ]


def test_broadcast_payload_matches_contract(captured_layer, actor_42):
    entity_bus._broadcast(app="sales", model="saleorder", instance_id=7, op="created")

    _, payload = _group_send_args(captured_layer)[0]
    assert payload["event"] == "entity.changed"
    assert payload["app"] == "sales"
    assert payload["model"] == "saleorder"
    assert payload["id"] == 7
    assert payload["op"] == "created"
    assert payload["actor_id"] == 42
    assert isinstance(payload["ts"], str) and payload["ts"]  # ISO timestamp set


def test_broadcast_noops_when_channel_layer_is_unconfigured(monkeypatch):
    # Minimal test settings sometimes have CHANNEL_LAYERS unset — must not raise.
    monkeypatch.setattr(entity_bus, "get_channel_layer", lambda: None)
    entity_bus._broadcast(app="sales", model="saleorder", instance_id=7, op="updated")


# ─── Signal handlers — ALLOWLIST (SaleOrder broadcasts own topic) ─────────────

@pytest.mark.django_db
def test_saleorder_create_broadcasts_created(broadcast_spy, customer):
    order = SaleOrder.objects.create(customer=customer, number="NV-RT-001")

    assert {
        "app": "sales", "model": "saleorder", "id": order.id, "op": "created"
    } in broadcast_spy


@pytest.mark.django_db
def test_saleorder_update_broadcasts_updated(broadcast_spy, customer):
    order = SaleOrder.objects.create(customer=customer, number="NV-RT-002")
    broadcast_spy.clear()

    order.number = "NV-RT-002-rev"
    order.save()

    assert {
        "app": "sales", "model": "saleorder", "id": order.id, "op": "updated"
    } in broadcast_spy


@pytest.mark.django_db
def test_saleorder_delete_broadcasts_deleted(broadcast_spy, customer):
    order = SaleOrder.objects.create(customer=customer, number="NV-RT-003")
    order_id = order.id
    broadcast_spy.clear()

    order.delete()

    assert {
        "app": "sales", "model": "saleorder", "id": order_id, "op": "deleted"
    } in broadcast_spy


# ─── PARENT_BROADCASTS — SaleLine fans out as parent "updated" ────────────────

@pytest.mark.django_db
def test_saleline_create_broadcasts_parent_updated_and_no_own_topic(broadcast_spy, customer):
    order = SaleOrder.objects.create(customer=customer, number="NV-RT-004")
    broadcast_spy.clear()

    SaleLine.objects.create(
        order=order, description="widget", quantity=1, unit_price=1000, subtotal=1000,
    )

    assert {
        "app": "sales", "model": "saleorder", "id": order.id, "op": "updated"
    } in broadcast_spy
    # Critical: no event for the child topic itself.
    assert all(c["model"] != "saleline" for c in broadcast_spy)


@pytest.mark.django_db
def test_saleline_update_broadcasts_parent_updated(broadcast_spy, customer):
    order = SaleOrder.objects.create(customer=customer, number="NV-RT-005")
    line = SaleLine.objects.create(
        order=order, description="widget", quantity=1, unit_price=1000, subtotal=1000,
    )
    broadcast_spy.clear()

    line.quantity = 2
    line.save()

    assert {
        "app": "sales", "model": "saleorder", "id": order.id, "op": "updated"
    } in broadcast_spy


@pytest.mark.django_db
def test_saleline_delete_broadcasts_parent_updated(broadcast_spy, customer):
    order = SaleOrder.objects.create(customer=customer, number="NV-RT-006")
    line = SaleLine.objects.create(
        order=order, description="widget", quantity=1, unit_price=1000, subtotal=1000,
    )
    broadcast_spy.clear()

    line.delete()

    assert {
        "app": "sales", "model": "saleorder", "id": order.id, "op": "updated"
    } in broadcast_spy
    assert all(c["model"] != "saleline" for c in broadcast_spy)


# ─── Allowlist gating — unlisted models never broadcast ───────────────────────

@pytest.mark.django_db
def test_unlisted_model_does_not_broadcast(broadcast_spy):
    # Contact is in neither ALLOWLIST nor PARENT_BROADCASTS.
    Contact.objects.create(name="Realtime Bystander", is_customer=True)
    assert broadcast_spy == []


# ─── PARENT_BROADCASTS configuration sanity ───────────────────────────────────

def test_parent_broadcasts_targets_exist_in_allowlist():
    """Each child's parent target must itself be in ALLOWLIST — otherwise the
    parent broadcast would land on a topic no client should subscribe to."""
    for _child, (papp, pmodel, _fk) in entity_bus.PARENT_BROADCASTS.items():
        assert (papp, pmodel) in entity_bus.ALLOWLIST, (
            f"PARENT_BROADCASTS points to ({papp}, {pmodel}) which is not in ALLOWLIST"
        )
