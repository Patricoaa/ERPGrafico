---
layer: 40-quality
doc: observability
status: active
owner: platform-team
last_review: 2026-05-21
---

# Observability

ERPGrafico opera como deployment single-node en home-server con presupuesto operativo ~$0. La stack de observability se apoya en **Sentry + logs estructurados + endpoint `/healthz` + uptime monitoring externo gratuito**. NO se opera Prometheus, Grafana, Jaeger/Tempo, OpenTelemetry ni PagerDuty.

Cuando el proyecto migre a multi-servicio o presupuesto SRE dedicado, esta doc debe revisarse — ver §“Roadmap” al final.

## Logs

### Structure
- JSON structured (backend: `python-json-logger`; frontend: `pino`).
- Fields always present: `timestamp`, `level`, `service`, `request_id`, `user_id` (if auth), `event`.
- Domain context via `extra={...}`.

```python
logger.info(
    "sale_order.created",
    extra={"sale_order_id": order.id, "customer_id": order.customer_id, "total_cents": order.total_cents},
)
```

### Levels

| Level | Use |
|-------|-----|
| `DEBUG` | Dev only. Not shipped to prod aggregator |
| `INFO` | Business events, task start/end |
| `WARNING` | Recoverable anomaly (retry, fallback) |
| `ERROR` | Unhandled exception (also → Sentry) |
| `CRITICAL` | System-level (DB down, disk full) — pages oncall |

### Request ID propagation

- Nginx injects `X-Request-ID`.
- Django middleware extracts → `contextvars`.
- Celery tasks receive via headers.
- Frontend attaches same ID on follow-up requests.

### PII redaction

Never log: password, JWT, full email (mask), phone, card numbers. Redaction filter in logging config.

## Metrics

### Stack PYME — sin Prometheus/Grafana

- **Sentry Performance** (free tier — 10k transactions/mes) captura latencia HTTP y Celery automáticamente vía SDK. Sustituye Prometheus para el caso single-node.
- **Endpoint `/api/healthz/`** (Django) devuelve `{"status":"ok"}` si DB + Redis + MinIO responden. Lo pingea Healthchecks.io/UptimeRobot cada N minutos desde fuera del home-server.
- **Logs estructurados (sección anterior)** llevan el `event` field — sirven como métricas low-volume vía grep/Loki-self-hosted si en el futuro se necesita.

**NO se instala** `django-prometheus`, `celery-prometheus-exporter`, exporters de cualquier tipo, ni se levanta Prometheus/Grafana. La complejidad operativa de ese stack es enemigo del presupuesto PYME.

### SLOs como targets (verificados a mano vía Sentry, no automatizado)

Las metas siguen siendo válidas y deben tenerse en mente; el chequeo es semanal vía Sentry Performance, no continuo vía alertas.

| Service | SLI | Target | Verificación |
|---------|-----|--------|--------------|
| API | p95 latency `/api/*` | <400ms | Sentry → Performance → group by transaction |
| API | error rate 5xx | <0.5% | Sentry → Issues → últimos 7 días |
| Celery | task success | >99% | Sentry → Performance → tasks |
| Frontend | TTFB | <300ms | Sentry Browser SDK Web Vitals |
| Frontend | LCP | <2.5s | Sentry Browser SDK Web Vitals |

Si un SLO se rompe persistentemente: abrir incidente, documentar en `99-walkthroughs/`, decidir si vale escalar infra o refactorizar el endpoint caliente.

## Traces

- **No hay distributed tracing dedicado.** Sentry breadcrumbs + transacciones taggeadas cubren causalidad para nuestro stack monolítico (1 Django + 1 Celery + 1 Postgres).
- Cuando el sistema migre a >1 servicio backend con llamadas RPC entre ellos, evaluar OpenTelemetry + Tempo/Jaeger. Hasta entonces, sumar OTel sería overhead operativo sin retorno.
- Las trazas existentes vía Sentry son suficientes para reproducir un error: `Sentry issue → breadcrumbs → request payload → stack trace`.

## Error tracking

- **Sentry** on both frontend and backend.
- DSN via env var, never committed.
- Source maps uploaded per release.
- PII scrubbing enabled (Sentry config).
- Releases tagged → regression attribution.

## Business event tracking (frontend)

```ts
// lib/analytics.ts
trackEvent('sale_order.created', { customer_id, total_cents })
```

- Not PII. Product-analytics oriented.
- Same event names as backend `logger.info` `event` field when possible — single source of truth for dashboards.

## Dashboards

No hay Grafana. Las vistas que funcionan como “dashboards” para el proyecto:

- **Sentry → Performance** — vista de latencia por transacción HTTP y tarea Celery.
- **Sentry → Issues** — errores agrupados por fingerprint, deploy-tagged.
- **Sentry → Releases** — diff de errores antes/después de cada release (sustituye los “deploy markers”).
- **`/admin/`** (Django) — para KPIs de negocio low-fidelity (counts, listados). Si un KPI lo amerita, se construye un widget en `app/(dashboard)/` con el dato real desde el backend.

## Alerts

Tier único — todo va a email y a un canal de Telegram opcional. Sin PagerDuty.

| Origen | Trigger | Canal |
|--------|---------|-------|
| Sentry | Error nuevo (issue alert) o spike en issue existente | Email del owner + Telegram (vía Sentry webhook → bot) |
| Healthchecks.io / UptimeRobot | `/api/healthz/` no responde 5 min | Email + Telegram |
| Healthchecks.io | Cron Celery beat no pingea en su ventana esperada (backup nocturno, reconciliación, etc.) | Email |
| Disco home-server | `df` cron → si >85%, escribe a log y mailx | Email manual |

**No se exige runbook por alerta** en PYME, pero sí un acuerdo: cualquier alerta repetida 3 veces en una semana fuerza abrir incidente y documentar fix o silenciar formalmente.

## For every new feature

Checklist:
- [ ] INFO log estructurado en el evento de negocio clave (`logger.info("evento", extra={...})`).
- [ ] Error path llega a Sentry (sin `try/except: pass` silencioso).
- [ ] Si la feature toca un endpoint nuevo crítico, agregarlo a `smoke.sh` (ver [ci-cd.md](ci-cd.md#smoke-tests)).
- [ ] Si la feature corre un cron Celery nuevo, registrarlo en Healthchecks.io con su ventana esperada.

## Roadmap (cuando deje de aplicar PYME)

Migrar a stack pleno solo si **dos** de estas tres condiciones se cumplen:
1. Arquitectura pasa a >1 servicio backend (microservicios o split).
2. Equipo dedicado de ops/SRE (≥1 persona).
3. Compromisos contractuales de SLA con clientes externos.

En ese momento: introducir Prometheus + Grafana, OpenTelemetry + Tempo, PagerDuty/Opsgenie, y separar este doc en `observability-runtime.md` (lo de ahora) + `observability-platform.md` (lo nuevo).
