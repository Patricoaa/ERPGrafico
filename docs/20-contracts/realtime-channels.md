---
layer: 20-contracts
doc: realtime-channels
status: active
owner: core-team
last_review: 2026-05-22
stability: contract-changes-require-ADR
---

# Realtime Channels — WebSocket + SSE + Entity Bus

ERPGrafico usa **tres canales realtime complementarios**, no uno solo. La elección es por *qué viaja en el canal*, no por preferencia del autor.

| Canal | Stack backend | Stack frontend | Dirección | Cuándo usar |
|-------|---------------|----------------|-----------|-------------|
| **WebSocket por-feature** | Django Channels + Redis channel layer | `new WebSocket()` + hook propio | Bidireccional | Cliente envía y recibe — colaboración, locks, presencia (POS) |
| **SSE** | DRF `StreamingHttpResponse` (text/event-stream) | `new EventSource()` + hook propio | Server → cliente broadcast | Solo recibe — progreso de jobs largos, exports |
| **Entity Bus (WS multiplexado)** | `core.consumers.EntityBusConsumer` + signal genérica | `RealtimeProvider` + `useEntitySubscription` | Server → cliente broadcast | Refresh de listados/modales y sync cross-tab del propio usuario — ver [ADR-0026](../10-architecture/adr/0026-entity-bus-realtime-invalidation.md) |

## Árbol de decisión

```
1. ¿El cliente necesita enviar mensajes al servidor en tiempo real (no solo polling REST)?
   SÍ  → WebSocket por-feature. Punto.
   NO  → 2.

2. ¿Es "una entidad cambió, los suscriptores deben refrescar su query"
      (listado abierto, modal abierto, otro tab del mismo usuario)?
   SÍ  → Entity Bus. Suscribirse con useEntitySubscription. NO escribir un canal propio.
   NO  → 3.

3. ¿El servidor necesita pushear eventos *específicos* (notificación, progreso de export, etc.)?
   SÍ  → SSE o WS dedicado por feature (decidir por bidireccionalidad).
   NO  → No es un caso realtime. Usar REST + TanStack Query staleTime / refetch.
```

**Antipatrones:**
- WebSocket para casos puramente broadcast cuando el Entity Bus ya cubre el caso. Si lo único que necesitás es "refrescá la lista cuando algo cambió", suscribirse al bus — no escribir un consumer nuevo.
- WebSocket para casos puramente broadcast con payload propio (notificación, progreso). Sumá SSE o usá el WS por-feature; no inventar otro multiplex.
- SSE para casos donde el cliente debe responder (locks, heartbeats activos). EventSource no permite escribir.
- Polling REST cada 2s para eventos que pueden empujarse — gasta CPU del cliente y carga inútil al backend.

## Implementaciones existentes (estado al 2026-05)

| Caso | Canal | Backend | Frontend | Propósito |
|------|-------|---------|----------|-----------|
| POS draft sync multi-terminal | WebSocket por-feature | `sales.consumers.POSDraftConsumer` + `sales.signals` | `features/pos/hooks/useDraftSync.ts` | Bidireccional: cliente edita carrito, lock por sesión, broadcast a otros terminales |
| Notificaciones globales | WebSocket por-feature | `workflow.consumers.NotificationConsumer` + `workflow.signals.push_notification_to_channels` | `features/notifications/hooks/useNotifications.ts` | Solo recepción de notificaciones por usuario — bidireccionalidad reservada para read-receipts |
| **Entity Bus (refresh de listados/modales)** | **WS multiplexado** | `core.consumers.EntityBusConsumer` + `core.signals.entity_bus` (allowlist) | `RealtimeProvider` + `useEntitySubscription` | **Piloto activo en `sales` (SaleOrder + SaleLine). Ver [ADR-0026](../10-architecture/adr/0026-entity-bus-realtime-invalidation.md). Estado: Activo (piloto). Extender a otras apps requiere validar carga de WS sobre el piloto primero.** |
| Workflow transitions | (routing existente, no consumer activo) | `workflow.routing` registrado en ASGI | — | Reservado para presencia/colaboración en aprobaciones |

---

## Entity Bus — refresco de listados y modales

El bus de entidades es el canal canónico para **mantener listados y modales en sync** frente a cambios — propios (cross-tab) y remotos (otros usuarios). **Antes de escribir un canal nuevo, comprobar si el bus ya cubre el caso.**

### Cuándo NO usar el bus

- El payload no es "una entidad cambió" sino contenido propio (notificación, progreso, mensaje de chat). Usar SSE o WS dedicado.
- El cliente necesita responder (lock, heartbeat, write). Usar WS dedicado.
- La invalidación local en `onSuccess` ya basta y no hay multi-tab ni multi-usuario sobre la entidad. No hacer nada — TanStack Query ya cubre.

### Patrón canónico

**Backend** — signal genérica con allowlist en `core.signals.entity_bus`:

```python
# Llamada por post_save / post_delete sólo para modelos de la ALLOWLIST.
def _broadcast_entity_change(*, app, model, instance_id, op, actor_id):
    channel_layer = get_channel_layer()
    payload = {
        "event": "entity.changed",
        "app": app, "model": model, "id": instance_id, "op": op,
        "actor_id": actor_id, "ts": timezone.now().isoformat(),
    }
    for group in (
        f"entity.{app}.{model}",
        f"entity.{app}.{model}.{instance_id}",
        f"entity.user.{actor_id}" if actor_id else None,
    ):
        if group:
            async_to_sync(channel_layer.group_send)(group, {"type": "entity.changed", "payload": payload})
```

`actor_id` lo resuelve un middleware thread-local; si la mutación viene de Celery o management command queda `null` (todos invalidan, sin filtro).

**Frontend** — un único `RealtimeProvider` en el layout autenticado y hooks declarativos por feature:

```ts
// Listado de Sale Orders
useEntitySubscription('sales.saleorder', [['sales'], ['orders-hub']])

// Modal de detalle abierto
useEntitySubscription(`sales.saleorder.${id}`, [['sales', id]])

// El provider se suscribe automáticamente a entity.user.<currentUserId>
// → no hace falta hook explícito para cross-tab del propio usuario.
```

### Reglas estrictas

1. **`invalidateQueries` local en `onSuccess` NO se quita.** El bus es complemento, no reemplazo. El autor de la mutación ve la UI actualizada al instante; el bus cubre a los demás.
2. **Filtro `ignoreOwnActor: true` por defecto** en `useEntitySubscription`. Si el evento llega con `actor_id === currentUser.id` dentro de los 2s posteriores a una mutación local, se descarta para evitar doble refetch.
3. **Una sola conexión WS por sesión** — `RealtimeProvider` la gestiona. **Nunca** abrir `new WebSocket('/ws/entity-bus/')` desde un componente o un hook de feature.
4. **Allowlist explícita por modelo** en `core/signals/entity_bus.py`. Agregar una entidad nueva al bus es un cambio que pasa por PR — no se hace por defecto.
5. **Payload sin entidad serializada.** El bus dice "X cambió"; el cliente refetch via su query existente. Esto preserva permisos (cada GET valida) y evita serializadores caros en signals.
6. **Topic naming:**
   - Listado: `<app>.<model>` (todo en minúscula, `model_name` no `ModelName`)
   - Detalle: `<app>.<model>.<id>`
   - Usuario: `user.<id>` (gestionado por el provider, no por features)

### Alcance vigente

**Piloto activo:** `sales.SaleOrder` (broadcast propio) + `sales.SaleLine` vía `PARENT_BROADCASTS` (dispara `op="updated"` sobre el `SaleOrder` padre, sin tópico propio). Antes de extender a `billing`, `inventory`, `contacts`, `purchasing`: validar carga de WS y latencia percibida sobre el piloto.

---

## WebSocket — patrón canónico

### Backend

Cada feature que necesita WS declara un consumer y lo registra en su `routing.py`:

```python
# backend/sales/consumers.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class POSDraftConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        # self.scope["user"] viene de JWTAuthMiddleware (ya en ASGI)
        if self.scope["user"].is_anonymous:
            await self.close(code=4001); return
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        self.group = f"pos-draft.{self.session_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content):
        # validar payload con un dataclass o Pydantic; nunca tocar ORM síncrono aquí
        await self.channel_layer.group_send(self.group, {
            "type": "draft.update",
            "payload": content,
            "from_channel": self.channel_name,
        })

    async def draft_update(self, event):
        if event["from_channel"] == self.channel_name:
            return  # no eco al emisor
        await self.send_json({"event": "draft.update", "payload": event["payload"]})
```

```python
# backend/sales/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"^ws/pos/(?P<session_id>[\w-]+)/$", consumers.POSDraftConsumer.as_asgi()),
]
```

Registrado en `backend/config/asgi.py` vía `URLRouter` envuelto en `JWTAuthMiddleware` — patrón ya operativo, no se reinventa.

### Frontend

```ts
// patrón canónico (extracto simplificado de useDraftSync)
export function useDraftSync(sessionId: string, onRemoteUpdate: (p: DraftPayload) => void) {
  const tokenRef = useAccessTokenRef();
  useEffect(() => {
    const url = `${WS_BASE}/ws/pos/${sessionId}/?token=${tokenRef.current}`;
    const ws = new WebSocket(url);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "draft.update") onRemoteUpdate(msg.payload);
    };
    ws.onclose = (e) => { /* reconnect con backoff exponencial si code !== 4001 */ };
    return () => ws.close();
  }, [sessionId]);
}
```

**Reglas:**
- Hook por feature en `features/[feature]/hooks/use*Sync.ts`. **Nunca** un hook genérico `useWebSocket` global — el manejo de mensajes es siempre específico del dominio.
- Reconexión con backoff exponencial (1s, 2s, 4s, …; cap 30s). Detener si el código de cierre es 4001 (no autorizado) o 4003 (forbidden).
- Heartbeat: el cliente envía `{ "type": "ping" }` cada 30s si lleva sin recibir nada; el servidor responde `{ "type": "pong" }`. Esto detecta TCP-half-open y permite reconexión.
- **Auth:** JWT como query param `?token=<jwt>`. WebSocket no permite custom headers desde el browser. Aceptado pese a que el token queda en logs de Nginx — mitigación: tokens de vida corta (15 min, ver [security.md](../40-quality/security.md)).

---

## SSE — patrón canónico

### Backend

```python
# backend/notifications/views.py
import json, time
from django.http import StreamingHttpResponse
from rest_framework.views import APIView

class NotificationStreamView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        since = request.query_params.get("since")  # cursor opcional

        def event_stream():
            yield ":connected\n\n"
            last_seen = since
            while True:
                events = NotificationService.fetch_since(user, last_seen)
                for ev in events:
                    yield f"id: {ev.id}\n"
                    yield f"event: {ev.kind}\n"
                    yield f"data: {json.dumps(ev.payload)}\n\n"
                    last_seen = ev.id
                yield ":ping\n\n"  # heartbeat
                time.sleep(15)

        resp = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        resp["Cache-Control"] = "no-cache"
        resp["X-Accel-Buffering"] = "no"  # importante: desactiva buffering en Nginx
        return resp
```

**Nginx:** asegurarse de tener `proxy_buffering off` para las rutas `/api/realtime/*` (o respetar `X-Accel-Buffering: no` que Django setea).

**Auth:** ver §"Auth en SSE" abajo — es la única decisión no obvia.

### Frontend

```ts
// patrón canónico useEventStream
export function useEventStream<T>(url: string, onEvent: (kind: string, data: T) => void) {
  const sinceRef = useRef<string | null>(null);
  useEffect(() => {
    const es = new EventSource(buildAuthedSseUrl(url, sinceRef.current));
    es.onmessage = (e) => onEvent("message", JSON.parse(e.data));
    es.addEventListener("notification.new", (e) => onEvent("notification.new", JSON.parse((e as MessageEvent).data)));
    es.onerror = () => { /* EventSource ya reconecta solo; logging opcional */ };
    return () => es.close();
  }, [url]);
}
```

**Ventajas operacionales de SSE sobre WS para broadcast:**
- Reconexión automática nativa con `Last-Event-ID` header → cero código de reconnect.
- Funciona sobre HTTP/1.1 estándar — proxies y firewalls lo dejan pasar sin config especial.
- Sin protocolo bidireccional que mantener; menos superficie de bugs.

### Auth en SSE

`EventSource` **no soporta headers custom desde el browser** — es la limitación que define cómo auth funciona aquí. Tres opciones, una elegida:

| Opción | Cómo | Trade-off | Veredicto |
|--------|------|-----------|-----------|
| Query param `?token=<jwt>` | `new EventSource('/api/.../stream?token=...')` | Token en logs de Nginx | **Adoptada** — tokens cortos (15 min) lo hacen aceptable |
| Cookie httpOnly | Backend setea cookie en login, EventSource manda credentials | Requiere `credentials: 'include'` + CORS con `Access-Control-Allow-Credentials: true` | Descartada — duplica el mecanismo de auth (JWT vs cookie) |
| Librería polyfill | `eventsource` npm permite headers | Descartada por dependencia extra y la necesidad de mantener feature parity | Descartada |

Helper `buildAuthedSseUrl(url, lastId)` centraliza la inyección del token.

---

## Channel layer (Redis)

Tanto WS como SSE pueden necesitar broadcast multi-proceso. Hoy:

- WS: usa `channels-redis` channel layer (configurado en `CHANNEL_LAYERS`).
- SSE: el `event_stream()` arriba es por-conexión y polea DB. Para broadcast cross-worker (cuando una mutación REST debe propagar a N suscriptores SSE):
  - Opción simple: cada SSE conexión polea DB cada 15s (suficiente para PYME — latencia <15s aceptable para notificaciones).
  - Opción robusta: usar Redis pub/sub. El endpoint REST que crea la notificación hace `redis.publish("notif:<user_id>", ...)`. El generador SSE hace `redis.pubsub().subscribe(...)`. Adoptar cuando el volumen lo justifique.

**Recomendación v1:** poleo a DB cada 15s. Refactorizar a pub/sub solo si la carga sobre Postgres se vuelve notable.

---

## Tests

| Tipo | Cómo | Cobertura mínima |
|------|------|-------------------|
| Consumer WS | `channels.testing.WebsocketCommunicator` | conexión autenticada / rechazo anónimo / mensaje bidireccional |
| Endpoint SSE | DRF APIClient + parsear `text/event-stream` por líneas | conexión, primer evento, heartbeat presente |
| Hook frontend | Vitest + mock de `WebSocket` / `EventSource` | reconnect on close, parse correcto de eventos |

---

## Checklist para agregar un canal realtime nuevo

- [ ] Decidir WS vs SSE con el árbol de §"Árbol de decisión". Documentar la razón en el PR.
- [ ] Backend: consumer/endpoint en `[app]/consumers.py` o `[app]/views.py`. Auth obligatoria.
- [ ] Routing registrado: WS en `[app]/routing.py` → ASGI; SSE en `urls.py` normal.
- [ ] Frontend: hook propio `use*Sync` o `use*Stream` en `features/[feature]/hooks/`. **Nunca** importar `WebSocket`/`EventSource` directo desde un componente.
- [ ] Reconexión + heartbeat presentes.
- [ ] Tests de consumer + hook.
- [ ] Si broadcast cross-worker es necesario: documentar la estrategia (poleo DB vs Redis pub/sub).

## Referencias

- Playbook paso-a-paso: `add-realtime-channel.md` (Tier 2 — Sesión 4)
- ADR del Entity Bus: [ADR-0026](../10-architecture/adr/0026-entity-bus-realtime-invalidation.md)
- Auth JWT: [ADR-0010](../10-architecture/adr/0010-jwt-auth-via-api-token.md), [security.md](../40-quality/security.md)
- Hook conventions: [hook-contracts.md](hook-contracts.md)
- Tabla de invalidación por mutación: [data-flow.md §Cache invalidation rules](../10-architecture/data-flow.md)
