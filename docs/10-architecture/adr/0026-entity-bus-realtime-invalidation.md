---
id: 0026
title: Entity-bus WebSocket for realtime query invalidation
status: Accepted
date: 2026-05-22
author: core-team
---

# 0026 — Entity-bus WebSocket for realtime query invalidation

## Context

Hoy la actualización de listados y modales frente a cambios depende exclusivamente de TanStack Query (`invalidateQueries` en `onSuccess` + `staleTime: 5min` + `refetchOnWindowFocus` default). Esto cubre **un solo escenario**: cambio propio en el mismo tab.

Gaps verificados sobre el código:

| Escenario | Hoy | Falla observable |
|-----------|-----|------------------|
| Cambio propio, mismo tab | ✅ inmediato vía `invalidateQueries` | — |
| Cambio propio, otro tab del mismo usuario | ❌ | El segundo tab muestra datos obsoletos hasta refetch por focus o 5 min |
| Cambio remoto de otro usuario sobre una entidad de negocio | ❌ | Lista/modal no reflejan hasta refetch por focus o 5 min |
| Notificación one-way | ✅ vía WS `NotificationConsumer` | — |
| POS draft sync multi-terminal | ✅ vía WS `POSDraftConsumer` | — |

La infraestructura para resolver los dos gaps ya existe en el repo:
- ASGI + Channels + JWTAuthMiddleware activos ([backend/config/asgi.py](../../../backend/config/asgi.py), [backend/core/ws_auth.py](../../../backend/core/ws_auth.py)).
- Patrón "ORM signal → `group_send` → consumer → cliente" ya operativo en [backend/workflow/signals.py](../../../backend/workflow/signals.py) y [backend/sales/signals.py](../../../backend/sales/signals.py).
- Cliente con reconexión exponencial probado en [useNotifications.ts](../../../frontend/features/notifications/hooks/useNotifications.ts).

Falta el bus genérico de invalidación. Sin él, el contrato [realtime-channels.md](../../20-contracts/realtime-channels.md) cubre canales por-feature (POS, notifications) pero no resuelve el caso transversal "una entidad cambió → suscriptores invalidan su query".

## Decision

Introducir un **bus de entidades** sobre WebSocket, multiplexado por suscripciones, como complemento (no reemplazo) de la invalidación local en `onSuccess`.

### Backend

1. **Canal único** `/ws/entity-bus/` servido por `core.consumers.EntityBusConsumer`. Auth JWT vía query param (mismo `JWTAuthMiddleware` existente).
2. El consumer acepta dos comandos del cliente:
   - `{op: "subscribe", topic: "<app>.<model>" | "<app>.<model>.<id>" | "user.<id>"}`
   - `{op: "unsubscribe", topic: ...}`
3. **Signal genérica** `core.signals.entity_bus` enganchada a `post_save`/`post_delete` con **allowlist explícita**. Publica payload mínimo:
   ```python
   {
     "event": "entity.changed",
     "app": "sales", "model": "saleorder",
     "id": 123, "op": "updated" | "created" | "deleted",
     "actor_id": 7,           # usuario que originó la mutación
     "ts": "2026-05-22T..."
   }
   ```
4. **Broadcast a tres grupos** por cada cambio:
   - `entity.<app>.<model>` — listados globales
   - `entity.<app>.<model>.<id>` — detalle / modal abierto
   - `entity.user.<actor_id>` — eco a otros tabs del mismo usuario
5. **`actor_id`** se resuelve por thread-local (middleware `core.middleware.CurrentUserMiddleware`) o, si no hay request (Celery), se omite.
6. El payload **no incluye la entidad serializada** — el cliente invalida y `TanStack Query` refetch. Razones: contrato uniforme, evita serializadores caros en signals, permisos siempre resueltos en el GET.

### Frontend

1. **Provider raíz** `RealtimeProvider` (montado en el layout autenticado) abre **una sola** conexión WS al bus.
2. **Hook** `useEntitySubscription(topic, queryKeys[], opts?)` declarativo:
   ```ts
   useEntitySubscription('sales.saleorder', [['sales'], ['orders-hub']])
   useEntitySubscription('sales.saleorder.123', [['sales', 123]])  // modal abierto
   ```
3. **Filtro `ignoreOwnActor: true` por defecto**: el mensaje se descarta si `actor_id === currentUser.id` y el evento llegó <2s después de una mutación local. Esto mantiene `invalidateQueries` en `onSuccess` como fuente primaria (UX instantánea sin esperar round-trip) y deja al bus el rol de cubrir cambios remotos y cross-tab.
4. **Cross-tab del mismo usuario**: cada tab está suscrito a `user.<id>`. Una mutación en tab A → signal → broadcast a `user.<userId>` → tab B invalida (mismo flujo, sin BroadcastChannel local).

### Alcance del piloto

**Solo `sales` en la primera iteración.** Allowlist inicial:
- `sales.SaleOrder` — broadcast normal (`created`/`updated`/`deleted`).
- `sales.SaleLine` — registrado en `PARENT_BROADCASTS`; cualquier `post_save`/`post_delete` se traduce a `op="updated"` sobre el `SaleOrder` padre vía `order_id`. No emite tópico propio.

Validar carga de WS, latencia percibida y comportamiento del filtro `ignoreOwnActor` antes de extender a `billing`, `inventory`, `contacts`, `purchasing`.

## Consequences

**Positivas**
- Cubre los dos gaps (cambios remotos + cross-tab del mismo usuario) con **un solo mecanismo** y sin tocar los ~40 hooks de mutación existentes.
- Reutiliza la infra Channels/Redis ya operativa; no introduce dependencias nuevas.
- Coste cero adicional para PYME single-node (Redis ya corriendo, sin nuevos workers).
- `invalidateQueries` local sigue siendo la fuente instantánea — la UX percibida del autor no degrada si el WS está caído.
- Allowlist explícita evita ruido (logs, tokens, tablas internas).

**Negativas**
- Una conexión WS persistente extra por sesión activa. Esperado: <50 sesiones simultáneas en escenario PYME → trivial.
- Allowlist a mantener cuando se agreguen entidades nuevas — requiere disciplina (cubierto por playbook).
- El payload sin entidad implica un GET adicional por invalidación; aceptado por el contrato uniforme. Mitigación: `staleTime` por hook ya controla.
- Si signals dispara fuera de request (Celery, management commands), `actor_id` es `null` → el filtro `ignoreOwnActor` no aplica y todos los clientes invalidan. Correcto pero ligeramente más ruidoso.

**Neutras**
- Degradación elegante: si el WS está caído, el sistema vuelve al comportamiento actual (`staleTime` + focus refetch). No hay regresión.

## Alternatives considered

| Alternativa | Razón de descarte |
|-------------|-------------------|
| SSE por feature (uno por dominio) | Mantener dos protocolos (WS para POS/notifs, SSE para bus) duplica reconexión, auth y testing. Ganancia marginal — no necesitamos `EventSource` aquí. |
| WS por feature (`/ws/sales/`, `/ws/billing/`, ...) | N conexiones por sesión, fan-out lineal con módulos. Multiplexar en un solo canal es estándar (Discord, Slack, Linear). |
| Postgres `LISTEN/NOTIFY` con worker puente | Requiere proceso dedicado de polling-en-listen y conexión PG extra. Sobre-ingeniería para single-node. |
| `BroadcastChannel` local para cross-tab | Sí resuelve cross-tab del mismo usuario sin servidor, pero no resuelve cambios remotos — necesitaríamos los dos. Eco vía WS unifica. Reconsiderar si la latencia ~100ms del eco resulta molesta. |
| Quitar `invalidateQueries` local y depender solo del WS | Latencia visible para el propio autor + rompe sin red. Rechazado. |
| Payload con entidad serializada (cliente `setQueryData` sin refetch) | Acopla signal a serializador, complica permisos por suscriptor y rompe si los serializadores cambian. Rechazado. |

## References

- Contrato actualizado: [realtime-channels.md](../../20-contracts/realtime-channels.md)
- Patrones de signals existentes: [backend/workflow/signals.py](../../../backend/workflow/signals.py), [backend/sales/signals.py](../../../backend/sales/signals.py)
- Hook de referencia: [useNotifications.ts](../../../frontend/features/notifications/hooks/useNotifications.ts)
- Auth WS: [ADR-0010](0010-jwt-auth-via-api-token.md), [core/ws_auth.py](../../../backend/core/ws_auth.py)
- Tabla de invalidación: [data-flow.md §Cache invalidation rules](../data-flow.md)
- Restricción operativa: PYME single-node, presupuesto ~$0 (memoria auto-cargada)
