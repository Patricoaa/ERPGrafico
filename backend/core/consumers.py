"""
EntityBusConsumer — single multiplexed WebSocket for query-invalidation events.

See docs/20-contracts/realtime-channels.md §"Entity Bus" and
docs/10-architecture/adr/0026-entity-bus-realtime-invalidation.md.

Wire protocol (client → server):
    {"op": "subscribe",   "topic": "<app>.<model>" | "<app>.<model>.<id>"}
    {"op": "unsubscribe", "topic": "..."}

Wire protocol (server → client):
    {
      "event": "entity.changed",
      "app": "...", "model": "...", "id": ..., "op": "created|updated|deleted",
      "actor_id": ... | null, "ts": "..."
    }

The user-scoped group `entity.user.<id>` is joined automatically on connect,
so a feature does NOT need to subscribe to it explicitly to get cross-tab sync.
"""
import json
import re
from channels.generic.websocket import AsyncJsonWebsocketConsumer


# Matches `<app>.<model>` or `<app>.<model>.<int_id>` with lowercase identifiers.
_TOPIC_RE = re.compile(r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*(\.[0-9]+)?$")


class EntityBusConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or user.is_anonymous:
            await self.close(code=4001)
            return

        self.user_id = user.id
        self.user_group = f"entity.user.{self.user_id}"
        self.subscriptions: set[str] = set()

        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "user_group"):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
        for topic in list(getattr(self, "subscriptions", set())):
            await self.channel_layer.group_discard(f"entity.{topic}", self.channel_name)

    async def receive_json(self, content, **kwargs):
        op = content.get("op")
        topic = content.get("topic")

        if op not in ("subscribe", "unsubscribe") or not isinstance(topic, str):
            await self._send_error("invalid_command", "Expected {op, topic}.")
            return

        if not _TOPIC_RE.match(topic):
            await self._send_error("invalid_topic", f"Topic '{topic}' is malformed.")
            return

        group = f"entity.{topic}"
        if op == "subscribe":
            if topic not in self.subscriptions:
                await self.channel_layer.group_add(group, self.channel_name)
                self.subscriptions.add(topic)
            await self.send_json({"event": "subscribed", "topic": topic})
        else:
            if topic in self.subscriptions:
                await self.channel_layer.group_discard(group, self.channel_name)
                self.subscriptions.discard(topic)
            await self.send_json({"event": "unsubscribed", "topic": topic})

    async def entity_changed(self, event):
        """Receives the `{type: 'entity.changed', payload: {...}}` group message."""
        await self.send_json(event["payload"])

    async def _send_error(self, code: str, detail: str) -> None:
        await self.send_json({"event": "error", "code": code, "detail": detail})

    @classmethod
    async def decode_json(cls, text_data):
        return json.loads(text_data)

    @classmethod
    async def encode_json(cls, content):
        return json.dumps(content)
