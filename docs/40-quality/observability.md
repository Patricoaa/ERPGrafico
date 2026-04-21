---
layer: 40-quality
doc: observability
status: active
owner: platform-team
last_review: 2026-04-21
---

# Observability

Three pillars: **logs**, **metrics**, **traces**. Plus error tracking (Sentry) and business events.

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

### Stack
- **Prometheus** scrapes Django (`django-prometheus`) and Celery (`celery-prometheus-exporter`).
- **Grafana** dashboards — one per app + one global.

### Required metrics

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | counter | `method`, `path`, `status` |
| `http_request_duration_seconds` | histogram | `method`, `path` |
| `celery_task_total` | counter | `task`, `result` |
| `celery_task_duration_seconds` | histogram | `task` |
| `db_query_duration_seconds` | histogram | `operation` |
| `workflow_transition_total` | counter | `entity`, `from_state`, `to_state` |
| `business_events_total` | counter | `event` (e.g. invoice_issued) |

### SLOs

| Service | SLI | SLO |
|---------|-----|-----|
| API | p95 latency `/api/*` | <400ms |
| API | error rate 5xx | <0.5% |
| Celery | task success | >99% |
| Frontend | TTFB | <300ms |
| Frontend | LCP | <2.5s |

Budget burn → alert per SRE standard.

## Traces

- **OpenTelemetry** SDK both sides.
- Trace ID propagated via `traceparent` header.
- Spans: HTTP request → view → service → ORM query → external call.
- Sampling: 100% errors, 10% success in prod.
- Exported to Jaeger/Tempo (TBD in infra).

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

Every Grafana board has:
- **Golden signals**: latency, traffic, errors, saturation.
- **Business KPIs**: orders/hour, invoices/day, reconciliation lag.
- **Deploy markers**: annotations on each release.

## Alerts

| Severity | Example | Channel |
|----------|---------|---------|
| P1 (page) | 5xx >5% for 5min | PagerDuty oncall |
| P2 | Celery queue depth >1000 | Slack #alerts |
| P3 | Disk >80% | Slack #infra |

No alert without a runbook. Runbook links embedded in alert.

## For every new feature

Checklist:
- [ ] INFO log on key business event.
- [ ] Metric incremented (`business_events_total{event=...}`).
- [ ] Error path captured by Sentry.
- [ ] Dashboard updated if new KPI.
- [ ] SLO defined if user-facing.
