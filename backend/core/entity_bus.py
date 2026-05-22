"""
Entity bus — broadcasts post_save / post_delete of allow-listed models
to the `EntityBusConsumer` via Channels.

See docs/10-architecture/adr/0026-entity-bus-realtime-invalidation.md.

Payload shape (matches frontend `EntityChangedEvent`):
    {
      "event": "entity.changed",
      "app": "sales",
      "model": "saleorder",
      "id": 123,
      "op": "created" | "updated" | "deleted",
      "actor_id": 7 | None,
      "ts": "2026-05-22T12:34:56.789012+00:00"
    }

Adding a model: append to `ALLOWLIST`. Receivers are wired in `core.apps.ready()`.

Child entities (lines of a transactional document) do not get their own topic —
they broadcast `op="updated"` for the parent so listeners on the parent list /
detail invalidate. Register them in `PARENT_BROADCASTS`.
"""
from django.apps import apps
from django.db.models.signals import post_save, post_delete
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .middleware import get_current_user_id


# (app_label, model_name) — lowercase, matches Django `Model._meta.app_label` / `model_name`.
ALLOWLIST: set[tuple[str, str]] = {
    ("sales", "saleorder"),
}

# Child models that invalidate their parent instead of broadcasting their own topic.
# Key   : (child_app, child_model)
# Value : (parent_app, parent_model, fk_id_attr_on_child)
# Cascade-delete caveat: when the parent is deleted, the child's post_delete fires first
# and broadcasts a (now stale) `op="updated"` for the parent before the parent's own
# `op="deleted"` arrives. Listeners refetch twice; tolerated for simplicity.
PARENT_BROADCASTS: dict[tuple[str, str], tuple[str, str, str]] = {
    ("sales", "saleline"): ("sales", "saleorder", "order_id"),
}


def _broadcast(*, app: str, model: str, instance_id: int, op: str) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return  # CHANNEL_LAYERS not configured (e.g. minimal test settings) — no-op.

    actor_id = get_current_user_id()
    payload = {
        "event": "entity.changed",
        "app": app,
        "model": model,
        "id": instance_id,
        "op": op,
        "actor_id": actor_id,
        "ts": timezone.now().isoformat(),
    }
    message = {"type": "entity.changed", "payload": payload}

    groups = [
        f"entity.{app}.{model}",
        f"entity.{app}.{model}.{instance_id}",
    ]
    if actor_id is not None:
        groups.append(f"entity.user.{actor_id}")

    for group in groups:
        async_to_sync(channel_layer.group_send)(group, message)


def _broadcast_parent_for_child(instance) -> None:
    """Child create/update/delete all surface as `updated` on the parent — the line
    change is observable via the parent's serializer (totals, line count)."""
    meta = instance._meta
    parent = PARENT_BROADCASTS.get((meta.app_label, meta.model_name))
    if parent is None:
        return
    parent_app, parent_model, fk_attr = parent
    parent_id = getattr(instance, fk_attr, None)
    if parent_id is None:
        return  # FK already nulled (rare) — nothing meaningful to invalidate.
    _broadcast(app=parent_app, model=parent_model, instance_id=parent_id, op="updated")


def _on_post_save(sender, instance, created, **kwargs):
    meta = sender._meta
    key = (meta.app_label, meta.model_name)
    if key in ALLOWLIST:
        _broadcast(
            app=meta.app_label,
            model=meta.model_name,
            instance_id=instance.pk,
            op="created" if created else "updated",
        )
        return
    _broadcast_parent_for_child(instance)


def _on_post_delete(sender, instance, **kwargs):
    meta = sender._meta
    key = (meta.app_label, meta.model_name)
    if key in ALLOWLIST:
        _broadcast(
            app=meta.app_label,
            model=meta.model_name,
            instance_id=instance.pk,
            op="deleted",
        )
        return
    _broadcast_parent_for_child(instance)


def register_receivers() -> None:
    """
    Connect post_save / post_delete for every model in ALLOWLIST and PARENT_BROADCASTS.
    Idempotent — `dispatch_uid` prevents duplicate registration on autoreload.
    """
    targets = ALLOWLIST | set(PARENT_BROADCASTS.keys())
    for app_label, model_name in targets:
        try:
            model = apps.get_model(app_label, model_name)
        except LookupError:
            continue
        post_save.connect(
            _on_post_save,
            sender=model,
            dispatch_uid=f"entity_bus.post_save.{app_label}.{model_name}",
        )
        post_delete.connect(
            _on_post_delete,
            sender=model,
            dispatch_uid=f"entity_bus.post_delete.{app_label}.{model_name}",
        )
