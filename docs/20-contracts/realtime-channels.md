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

## Implementaciones existentes (estado al 2026-08-04 — reconciliado con código)

| Caso | Canal | Backend | Frontend | Propósito |
|------|-------|---------|----------|-----------|
| POS draft sync multi-terminal | WebSocket por-feature | `sales.consumers.POSDraftConsumer` + `sales.signals` | `features/pos/hooks/useDraftSync.ts` | Bidireccional: cliente renueva lock (`HEARTBEAT`), server broadcast de cambios a otros terminales |
| Notificaciones globales | WebSocket por-feature | `workflow.consumers.NotificationConsumer` + `workflow.signals.push_notification_to_channels` | `features/notifications/hooks/useNotifications.ts` | Solo recepción de notificaciones por usuario — ruta `ws/notifications/` |
| **Entity Bus (refresh de listados/modales)** | **WS multiplexado** | `core.entity_bus` (`ALLOWLIST` + `PARENT_BROADCASTS`) + `core.consumers.EntityBusConsumer` | `RealtimeProvider` + `useEntitySubscription` | **Activo** en `sales.SaleOrder` e `inventory.Product/ProductCategory/UoM`. Ver [ADR-0026](../10-architecture/adr/0026-entity-bus-realtime-invalidation.md) |
| **SSE** | — | **NO implementado** (ninguna ruta `text/event-stream` en el codebase) | — | Especificación canónica §SSE disponible para el futuro; hoy todo broadcast va por WS |

---

## Entity Bus — refresco de listados y modales

El bus de entidades es el canal canónico para **mantener listados y modales en sync** frente a cambios — propios (cross-tab) y remotos (otros usuarios). **Antes de escribir un canal nuevo, comprobar si el bus ya cubre el caso.**

### Cuándo NO usar el bus

- El payload no es "una entidad cambió" sino contenido propio (notificación, progreso, mensaje de chat). Usar SSE o WS dedicado.
- El cliente necesita responder (lock, heartbeat, write). Usar WS dedicado.
- La invalidación local en `onSuccess` ya basta y no hay multi-tab ni multi-usuario sobre la entidad. No hacer nada — TanStack Query ya cubre.

### Patrón canónico

**Backend** — signal genérica con allowlist en `core.entity_bus.py` (los receivers se conectan en `core.apps.ready()`, no hay `signals.py` de entity bus):

```python
# core/entity_bus.py — ALLOWLIST real al 2026-08-04
ALLOWLIST: set[tuple[str, str]] = {
    ("sales", "saleorder"),
    ("inventory", "product"),
    ("inventory", "productcategory"),
    ("inventory", "uom"),
}

# Child models que invalidan a su padre en vez de tener tópico propio.
# (child_app, child_model) → (parent_app, parent_model, fk_id_attr_on_child)
PARENT_BROADCASTS: dict[tuple[str, str], tuple[str, str, str]] = {
    ("sales", "saleline"): ("sales", "saleorder", "order_id"),
}

def _broadcast(*, app: str, model: str, instance_id: int, op: str) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return  # CHANNEL_LAYERS no configurado — no-op (tests minimales)
    actor_id = get_current_user_id()   # thread-local (core.middleware); None en Celery/commands
    payload = {
        "event": "entity.changed",
        "app": app, "model": model, "id": instance_id, "op": op,
        "actor_id": actor_id, "ts": timezone.now().isoformat(),
    }
    message = {"type": "entity.changed", "payload": payload}
    groups = [f"entity.{app}.{model}", f"entity.{app}.{model}.{instance_id}"]
    if actor_id is not None:
        groups.append(f"entity.user.{actor_id}")
    for group in groups:
        async_to_sync(channel_layer.group_send)(group, message)
```

`actor_id` lo resuelve un middleware thread-local; si la mutación viene de Celery o management command queda `null` (todos invalidan, sin filtro).

> **Caveat de cascade-delete:** cuando se borra el padre, el `post_delete` del child dispara primero y hace broadcast de un `op="updated"` (ya obsoleto) para el padre antes del `op="deleted"` propio. Los listeners refetchean dos veces; tolerado por simplicidad.

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
4. **Allowlist explícita por modelo** en `core/entity_bus.py` (`ALLOWLIST`). Agregar una entidad nueva al bus es un cambio que pasa por PR — no se hace por defecto.
5. **Payload sin entidad serializada.** El bus dice "X cambió"; el cliente refetch via su query existente. Esto preserva permisos (cada GET valida) y evita serializadores caros en signals.
6. **Topic naming:**
   - Listado: `<app>.<model>` (todo en minúscula, `model_name` no `ModelName`)
   - Detalle: `<app>.<model>.<id>`
   - Usuario: `user.<id>` (gestionado por el provider, no por features)

### Alcance vigente (2026-08-04)

**Allowlist activa:** `sales.SaleOrder` (broadcast propio) + `inventory.Product`, `inventory.ProductCategory`, `inventory.UoM`. `sales.SaleLine` vía `PARENT_BROADCASTS` (dispara `op="updated"` sobre el `SaleOrder` padre, sin tópico propio). Agregar modelos al bus = editar `ALLOWLIST` en `core/entity_bus.py` (cambio que pasa por PR). Antes de extender a `billing`, `purchasing`, `contacts`: validar carga de WS y latencia percibida.

---

## WebSocket — patrón canónico

### Backend

Cada feature que necesita WS declara un consumer y lo registra en su `routing.py`. Consumer real de POS (extracto fiel de `sales/consumers.py`):

```python
# backend/sales/consumers.py
from channels.generic.websocket import AsyncWebsocketConsumer

class POSDraftConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if not self.scope["user"].is_authenticated:
            await self.close(code=4001)
            return
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        self.group_name = f"pos_session_{self.session_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Protocolo: {"event": "HEARTBEAT", "draft_id", "session_key"}
        # → renueva el lock vía DraftCartService.refresh_lock; si falla responde LOCK_LOST.
        ...

    async def pos_draft_update(self, event):
        # Broadcast del grupo → cliente
        await self.send(text_data=json.dumps(event["data"]))
```

```python
# backend/sales/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/sales/pos/(?P<session_id>\d+)/$", consumers.POSDraftConsumer.as_asgi()),
]
```

Los tres `routing.py` (`core`, `sales`, `workflow`) se concatenan en `backend/config/asgi.py` vía `URLRouter` envuelto en `JWTAuthMiddleware` (`core/ws_auth.py`) — patrón ya operativo, no se reinventa.

### Frontend

```ts
// patrón real de useDraftSync (extracto)
const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws'
const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '')
const wsUrl = `${wsProtocol}://${wsHost}/ws/sales/pos/${posSessionId}/?token=${encodeURIComponent(getClientToken() ?? '')}`

const socket = new WebSocket(wsUrl)
socket.onmessage = (event) => { /* parsea msg.event / msg.data */ }
```

**Reglas:**
- Hook por feature en `features/[feature]/hooks/use*Sync.ts`. **Nunca** un hook genérico `useWebSocket` global — el manejo de mensajes es siempre específico del dominio.
- Reconexión con backoff exponencial (1s, 2s, 4s, …; cap 30s). Detener si el código de cierre es 4001 (no autorizado) o 4003 (forbidden).
- Heartbeat: el cliente envía `{ "event": "HEARTBEAT", "draft_id, session_key }` (protocolo real de POS — renueva el lock de sesión). Detectar TCP-half-open y reconectar.
- **Auth:** JWT como query param `?token=<jwt>` — mecanismo implementado por `core/ws_auth.JWTAuthMiddleware` y usado por `ws/notifications/` y `ws/entity-bus/`. **POS incluido desde 2026-08-04:** `POSDraftConsumer.connect` rechaza anónimos con `close(code=4001)` y el cliente agrega `?token=` (vía `getClientToken()`); la autorización previa dentro de `receive` se mantiene. El token queda en logs de Nginx — mitigación: tokens de vida corta (15 min, ver [security.md](../40-quality/security.md)).

---

## SSE — patrón canónico

> **Estado 2026-08-04: NO implementado en el codebase.** Ninguna ruta sirve `text/event-stream`; no existe `features/*/hooks/use*Stream.ts` ni `buildAuthedSseUrl`. Esta sección es **especificación canónica** para cuando se necesite (progreso de jobs largos, exports). Mientras tanto, todo broadcast va por WebSocket. Si se implementa, actualizar este banner y la tabla de §"Implementaciones existentes".

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
