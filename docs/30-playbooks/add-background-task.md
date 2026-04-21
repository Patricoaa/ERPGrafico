---
layer: 30-playbooks
doc: add-background-task
task: "Add Celery task (async or scheduled)"
triggers: ["celery task", "background job", "async", "scheduled", "cron"]
preconditions:
  - 10-architecture/backend-apps.md
  - 40-quality/observability.md
  - 40-quality/security.md
validation:
  - pytest apps/[app]/tests/test_tasks.py
forbidden:
  - long-running sync work in views
  - non-idempotent tasks without idempotency key
  - secrets in task args
status: active
owner: backend-team
last_review: 2026-04-21
---

# Playbook — Add Celery task

## When

- Work >300ms that doesn't need to block the HTTP response.
- Side effects: email, PDF, webhook, import, report.
- Scheduled recurring: `celery beat`.

## Steps

### 1. Place task in `apps/[app]/tasks.py`

```python
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=5,
    acks_late=True,
)
def generate_invoice_pdf(self, invoice_id: str) -> None:
    logger.info("generate_invoice_pdf.start", extra={"invoice_id": invoice_id})
    # idempotency — do not regenerate if already exists
    # fetch, render, upload to MinIO
    logger.info("generate_invoice_pdf.done", extra={"invoice_id": invoice_id})
```

### 2. Idempotency

- Task must be safe to retry. Key off entity id.
- Check if side effect already done before doing it again.
- For external calls: use idempotency header or store sent log.

### 3. Enqueue from service (never from view)

```python
# apps/billing/services/invoice_service.py
def issue(...):
    invoice = Invoice.objects.create(...)
    generate_invoice_pdf.delay(str(invoice.id))
    return invoice
```

### 4. Scheduled task (beat)

```python
# config/celery.py
app.conf.beat_schedule = {
    'close-fiscal-period-nightly': {
        'task': 'apps.accounting.tasks.close_period_if_due',
        'schedule': crontab(hour=2, minute=0),
    },
}
```

DB-backed scheduler already configured (`django_celery_beat`).

### 5. Logging and metrics

- Structured logs with task name + entity id.
- Emit Prometheus counter `celery_task_total{task, result}`.
- Sentry auto-captures unhandled exceptions.

See [observability.md](../40-quality/observability.md).

### 6. Security

- Never pass passwords, tokens, PII in args — args logged by broker.
- Pass entity id, task fetches current state.
- Rate-limit externally-callable tasks.

### 7. Tests

```python
@pytest.mark.django_db
def test_generate_invoice_pdf_idempotent(invoice):
    generate_invoice_pdf(str(invoice.id))
    size1 = storage.size(invoice.pdf_key)
    generate_invoice_pdf(str(invoice.id))
    size2 = storage.size(invoice.pdf_key)
    assert size1 == size2  # did not regenerate
```

Use `CELERY_TASK_ALWAYS_EAGER = True` in test settings for sync execution.

## Validation

```bash
pytest apps/[app]/tests/test_tasks.py
celery -A config worker --loglevel=info   # local smoke
celery -A config beat --loglevel=info     # if scheduled
```

## Definition of done

- [ ] Task is idempotent.
- [ ] Retries configured with backoff.
- [ ] Structured logging present.
- [ ] No sensitive data in args.
- [ ] Tests cover happy path + retry scenario.
- [ ] Scheduled entry added to `beat_schedule` if periodic.
- [ ] Flower shows task execution in staging.
