# Sprint 2 — Setup de Sentry + Healthchecks.io

Implementación del Sprint 2 de [strategy.md](strategy.md): observabilidad técnica (errores) + verificación de uptime. **Todo opt-in por variables de entorno**: sin configurarlas, el sistema se comporta exactamente como antes.

## Resumen de cambios

### Backend ([backend/](../../../backend/))

| Archivo | Cambio |
|---|---|
| [requirements.txt](../../../backend/requirements.txt) | `+ sentry-sdk[django]>=2.18.0` |
| [config/settings.py](../../../backend/config/settings.py) | Bloque condicional `if SENTRY_DSN: sentry_sdk.init(...)` al final, con integraciones Django + Celery + Redis. Trace sample rate bajo (0.05) por defecto. `send_default_pii=False`. |
| [config/settings.py](../../../backend/config/settings.py) | Nueva entrada `observability_healthcheck_ping` en `CELERY_BEAT_SCHEDULE` que corre cada 5 min. |
| [core/tasks.py](../../../backend/core/tasks.py) | Nueva tarea `ping_healthcheck` — hace `GET` a `HEALTHCHECK_PING_URL`. No-op si la URL no está definida. |

### Frontend ([frontend/](../../../frontend/))

| Archivo | Cambio |
|---|---|
| [package.json](../../../frontend/package.json) | `+ @sentry/nextjs ^10.0.0` (v10 es la primera línea compatible con Next 16) |
| [sentry.server.config.ts](../../../frontend/sentry.server.config.ts) | Init server-side (runtime Node). Gated por `SENTRY_DSN`. |
| [sentry.edge.config.ts](../../../frontend/sentry.edge.config.ts) | Init edge runtime. Gated por `SENTRY_DSN`. |
| [instrumentation-client.ts](../../../frontend/instrumentation-client.ts) | Init browser. Gated por `NEXT_PUBLIC_SENTRY_DSN`. Replay desactivado. Expone `onRouterTransitionStart`. |
| [instrumentation.ts](../../../frontend/instrumentation.ts) | Hook de Next.js que carga `sentry.server.config` o `sentry.edge.config` según runtime. Expone `onRequestError`. |
| [next.config.ts](../../../frontend/next.config.ts) | Envoltorio `applySentry` async: solo aplica `withSentryConfig` si están `SENTRY_DSN + SENTRY_ORG + SENTRY_PROJECT`. Sin esas vars, build estándar sin tocar nada. |

## Instalación

```bash
# Backend
cd backend && venv/bin/pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

## Configuración (todo opcional)

### Sentry — backend

| Variable | Default | Descripción |
|---|---|---|
| `SENTRY_DSN` | *(vacío)* | DSN del proyecto Sentry. **Si está vacío, Sentry no se inicializa.** |
| `SENTRY_ENVIRONMENT` | `production` o `development` (según `DEBUG`) | Etiqueta del environment en Sentry. |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.05` | 5% de las transacciones se envían como traces. Subir solo si se justifica vs cuota free. |
| `GIT_HASH` | `unknown` | Se reusa el GIT_HASH del despliegue como release. |

### Sentry — frontend

| Variable | Default | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | *(vacío)* | DSN. Sin ella el SDK no inicializa en el browser. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `process.env.NODE_ENV` | Etiqueta de environment. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0.05` | Trace sampling browser-side. |
| `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` | *(vacíos)* | Para subir sourcemaps en `next build`. **Sin las tres, el build no toca `withSentryConfig`.** |
| `SENTRY_AUTH_TOKEN` | *(vacío)* | Token con scope `project:releases`. Solo requerido en CI. |

### Healthchecks.io

| Variable | Default | Descripción |
|---|---|---|
| `HEALTHCHECK_PING_URL` | *(vacío)* | URL del check en healthchecks.io. Sin ella, la tarea retorna `disabled` y no hace nada. |

Recomendación: en healthchecks.io crear un check con período de 10 min y grace 5 min — la tarea pinga cada 5 min, así un fallo se detecta a los 15 min máx.

## Cómo verificar localmente

Sin DSN ni URL configurados:

```bash
cd backend && venv/bin/python manage.py check
# System check identified no issues (0 silenced).

venv/bin/python manage.py shell -c "from core.tasks import ping_healthcheck; print(ping_healthcheck())"
# disabled
```

Con `SENTRY_DSN` configurado, lanzar una excepción de prueba:

```python
# en algún view temporal
1 / 0
```

Debe aparecer en el dashboard de Sentry en <1 minuto.

## Privacidad y opt-out por cliente

Para clientes que no permitan telemetría saliente: **no setear** `SENTRY_DSN` ni `HEALTHCHECK_PING_URL` en su `.env`. El sistema funciona idéntico, sin enviar nada externo. Si el cliente exige *todo local*, reemplazar Sentry SaaS por GlitchTip self-hosted apuntando el mismo `SENTRY_DSN` a la URL local — sin cambios de código.

## Decisiones de diseño

- **Sample rate de traces 0.05**: 5% es suficiente para detectar regresiones de p95 sin agotar el free tier de Sentry (10k transactions/mes). Subir solo si el negocio crece.
- **`send_default_pii=False`**: Sentry no captura emails, IPs ni headers de auth por defecto. Si en el futuro se necesita IP para debugging, activar puntualmente y documentar.
- **Replay desactivado en frontend**: consume cuota agresivamente y aporta poco en un ERP B2B. Mantener en 0 hasta tener un caso de uso claro.
- **Healthcheck cada 5 min**: balance entre detección rápida y carga (288 pings/día por instancia, holgado en el free tier de healthchecks.io que permite 20 checks).

## Próximos pasos (no incluidos en este sprint)

- **PostHog** (analítica de producto) — diferido hasta tracción según [strategy.md §5](strategy.md#5-plan-de-adopción-incremental).
- **fail2ban** en plantilla de despliegue.
- Documentar runbook: qué hacer cuando Sentry alerta un spike de errores.
