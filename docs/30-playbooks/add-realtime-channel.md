---
layer: 30-playbooks
doc: add-realtime-channel
task: add realtime channel
triggers: [realtime, websocket, sse, channels, eventsource, notifications, push, live update]
preconditions: [realtime-channels, hook-contracts, add-endpoint]
validation: [pytest backend/{app}/tests, vitest hook test]
forbidden: [WebSocket o EventSource importado directo en componente, hook genérico useWebSocket global, polling REST <5s como sustituto]
status: active
owner: core-team
last_review: 2026-05-21
---

# Add a realtime channel

Receta para agregar **un canal realtime nuevo** (WebSocket o SSE) siguiendo los patrones canónicos. El contrato vive en [realtime-channels.md](../20-contracts/realtime-channels.md) — léelo antes.

## When to use

- Hay un cambio de estado en backend que el frontend necesita ver sin esperar al próximo refetch.
- O dos clientes editando el mismo recurso necesitan coordinarse.

Si el caso resuelve con TanStack Query `staleTime` corto o `refetchInterval`: **no uses realtime**. Suma complejidad sin valor.

## Step 0 — Elegir WS o SSE

Aplica el árbol de [realtime-channels.md#árbol-de-decisión](../20-contracts/realtime-channels.md#árbol-de-decisión). Si dudás: SSE por default — es más simple operacionalmente.

| Necesidad | Canal | Por qué |
|-----------|-------|---------|
| Cliente envía mensajes (locks, presencia, edición colaborativa) | WebSocket | Bidireccional nativo |
| Solo recibe (notificaciones, progreso, refresh signals) | SSE | Reconexión automática, sin protocolo de envío |

**Documentá la decisión en el PR.** "Elegí WS porque..." o "Elegí SSE porque...".

---

## A. Agregar WebSocket Consumer

### Step 1 — Consumer en `backend/{app}/consumers.py`

Si el archivo no existe, crearlo. Patrón canónico (basado en `sales/consumers.py::POSDraftConsumer`):

```python
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class MyFeatureConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        if self.scope["user"].is_anonymous:
            await self.close(code=4001)
            return
        self.resource_id = self.scope["url_route"]["kwargs"]["resource_id"]
        self.group = f"myfeature.{self.resource_id}"
        # (Opcional) verificar permisos sobre el recurso
        # if not await self._has_permission():
        #     await self.close(code=4003); return
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content):
        # Validar payload con dataclass/pydantic — nunca raw dict
        # No tocar el ORM síncrono aquí; si necesitás, usá database_sync_to_async
        await self.channel_layer.group_send(self.group, {
            "type": "myfeature.update",
            "payload": content,
            "from_channel": self.channel_name,
        })

    async def myfeature_update(self, event):
        if event["from_channel"] == self.channel_name:
            return  # no eco al emisor
        await self.send_json({"event": "update", "payload": event["payload"]})
```

### Step 2 — Routing en `backend/{app}/routing.py`

```python
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"^ws/myfeature/(?P<resource_id>[\w-]+)/$", consumers.MyFeatureConsumer.as_asgi()),
]
```

### Step 3 — Registrar en `backend/config/asgi.py`

Agregar el import + concat de patterns:

```python
from sales import routing as sales_routing
from myapp import routing as myapp_routing  # ← agregar

websocket_urlpatterns = (
    sales_routing.websocket_urlpatterns +
    myapp_routing.websocket_urlpatterns      # ← agregar
)
```

### Step 4 — Hook frontend

Crear `frontend/features/{feature}/hooks/useMyFeatureSync.ts`:

```ts
"use client";
import { useEffect, useRef } from "react";
import { useAccessTokenRef } from "@/hooks/useAccessTokenRef";

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE!; // ws://localhost:8100 en dev

type Payload = { /* shape específica del dominio */ };

export function useMyFeatureSync(resourceId: string, onRemote: (p: Payload) => void) {
  const tokenRef = useAccessTokenRef();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      const url = `${WS_BASE}/ws/myfeature/${resourceId}/?token=${tokenRef.current}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => { attemptRef.current = 0; };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as { event: string; payload: Payload };
        if (msg.event === "update") onRemote(msg.payload);
      };
      ws.onclose = (e) => {
        if (cancelled || e.code === 4001 || e.code === 4003) return;
        const delay = Math.min(1000 * 2 ** attemptRef.current, 30_000);
        attemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [resourceId]);

  const send = (payload: Payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  return { send };
}
```

### Step 5 — Tests

Consumer:

```python
# backend/{app}/tests/test_consumers.py
import pytest
from channels.testing import WebsocketCommunicator
from config.asgi import application

@pytest.mark.asyncio
async def test_anonymous_rejected():
    comm = WebsocketCommunicator(application, "/ws/myfeature/abc/")
    connected, code = await comm.connect()
    assert not connected and code == 4001

@pytest.mark.asyncio
async def test_authed_round_trip(authed_user_scope):
    comm = WebsocketCommunicator(application, "/ws/myfeature/abc/?token=...")
    connected, _ = await comm.connect()
    assert connected
    await comm.send_json_to({"foo": "bar"})
    # ... assert lo que se broadcastea via channel_layer
    await comm.disconnect()
```

Hook: Vitest + mock global `WebSocket`.

---

## B. Agregar endpoint SSE

### Step 1 — Service que genera los eventos

`backend/{app}/services/{feature}_stream.py`:

```python
import time, json
from typing import Iterator

def event_stream_for_user(user, since: str | None) -> Iterator[bytes]:
    yield b":connected\n\n"
    last_seen = since
    while True:
        events = NotificationService.fetch_since(user, last_seen)
        for ev in events:
            yield f"id: {ev.id}\nevent: {ev.kind}\ndata: {json.dumps(ev.payload)}\n\n".encode()
            last_seen = ev.id
        yield b":ping\n\n"
        time.sleep(15)
```

> **Volumen alto / cross-worker:** si el caso requiere broadcast desde un POST REST hacia N suscriptores SSE, reemplazar el `time.sleep(15)` + DB polling por Redis pub/sub. Ver [realtime-channels.md#channel-layer-redis](../20-contracts/realtime-channels.md#channel-layer-redis).

### Step 2 — View en `backend/{app}/views.py`

```python
from django.http import StreamingHttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from .services.myfeature_stream import event_stream_for_user

class MyFeatureStreamView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        since = request.query_params.get("since")
        resp = StreamingHttpResponse(
            event_stream_for_user(request.user, since),
            content_type="text/event-stream",
        )
        resp["Cache-Control"] = "no-cache"
        resp["X-Accel-Buffering"] = "no"  # Nginx no debe bufferear
        return resp
```

### Step 3 — Routing en `backend/{app}/urls.py`

```python
path("stream/", MyFeatureStreamView.as_view(), name="myfeature-stream"),
```

### Step 4 — Hook frontend

```ts
// frontend/features/{feature}/hooks/useMyFeatureStream.ts
import { useEffect, useRef } from "react";
import { buildAuthedSseUrl } from "@/lib/sse";

export function useMyFeatureStream(onEvent: (kind: string, data: unknown) => void) {
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    const es = new EventSource(buildAuthedSseUrl("/api/myfeature/stream/", lastIdRef.current));
    es.addEventListener("notification.new", (e) => {
      const ev = e as MessageEvent;
      lastIdRef.current = ev.lastEventId || lastIdRef.current;
      onEvent("notification.new", JSON.parse(ev.data));
    });
    es.onerror = () => { /* EventSource reconecta solo; nada que hacer */ };
    return () => es.close();
  }, []);
}
```

`lib/sse.ts::buildAuthedSseUrl` centraliza la inyección del JWT como `?token=...`.

### Step 5 — Tests

```python
# backend/{app}/tests/test_views.py
def test_stream_emits_initial_connected(authed_client):
    resp = authed_client.get("/api/myfeature/stream/", stream=True)
    assert resp.status_code == 200
    assert resp["content-type"].startswith("text/event-stream")
    first_chunk = next(resp.streaming_content)
    assert b":connected" in first_chunk
```

---

## Validation (ambos canales)

```bash
# Backend
pytest backend/{app}/tests/

# Frontend
cd frontend && npm run test -- features/{feature}/hooks
cd frontend && npm run type-check
```

Smoke manual:
1. Abrir 2 pestañas del navegador autenticadas.
2. Disparar un evento en una.
3. La otra debe verlo en <2s.

## Common pitfalls

- **Olvidar `JWTAuthMiddleware` en ASGI** → `scope["user"]` es siempre `AnonymousUser` y el `close(4001)` corta todo. Ya está configurado, no se toca, pero verificá si agregás nuevos middlewares.
- **EventSource con header `Authorization`** → no funciona desde browser. Usar `?token=` query param (helper `buildAuthedSseUrl`).
- **Nginx que buffera SSE** → la respuesta no fluye al cliente hasta que se llena el buffer. Setear `proxy_buffering off` o respetar `X-Accel-Buffering: no` (Django ya lo manda).
- **Hook genérico `useWebSocket`** → tentación de over-engineering. Cada feature tiene reglas de mensajería propias; el hook por feature es más legible y testeable.
- **No implementar reconnect** → en WS, el browser no reconecta solo. Sin backoff exponencial, el primer hiccup de red mata la feature hasta refresh manual.

## Definition of done

- [ ] Decisión WS vs SSE documentada en el PR description.
- [ ] Consumer/endpoint + routing + ASGI registrado (si WS).
- [ ] Hook frontend en `features/{feature}/hooks/`, sin `WebSocket`/`EventSource` directo en componentes.
- [ ] Reconexión + heartbeat (WS) o test del `:ping` (SSE).
- [ ] Tests backend de consumer/view.
- [ ] Tests frontend del hook con `WebSocket`/`EventSource` mockeados.
- [ ] Validación 2-pestañas pasa.

## Referencias

- Contrato: [realtime-channels.md](../20-contracts/realtime-channels.md)
- Hook conventions: [hook-contracts.md](../20-contracts/hook-contracts.md)
- Auth JWT: [ADR-0010](../10-architecture/adr/0010-jwt-auth-via-api-token.md)
