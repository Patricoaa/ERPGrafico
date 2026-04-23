---
layer: 30-playbooks
doc: debug-workflow
task: "Debug bug, failing test, unexpected behavior"
triggers: ["bug", "failing test", "error", "unexpected", "regression"]
preconditions:
  - 40-quality/observability.md
  - 40-quality/testing.md
status: active
owner: core-team
last_review: 2026-04-21
---

# Playbook — Debug workflow

## Order of operations (do not skip)

### 1. Reproduce

- Exact steps to trigger.
- Browser, env, user role, data state.
- Capture error stack (Sentry link if prod).

### 2. Narrow layer

| Symptom | First place to look |
|---------|--------------------|
| 4xx from API | DRF serializer / permission class / rate limit |
| 5xx from API | Django logs, Sentry, stack trace |
| UI shows stale data | TanStack Query cache key, invalidation |
| Form won't submit | Zod schema, `formState.errors` |
| Wrong status color | state-map.md + StatusBadge variant |
| Celery task missing | Flower, broker logs, beat schedule |
| Celery task stuck | Worker process, Redis queue length, task state |
| Slow query | `django-debug-toolbar`, `EXPLAIN ANALYZE` |

### 2b. Celery debugging

**Step 1 — Check if task was enqueued**

```bash
# Flower UI (dev)
http://localhost:5555

# Or Redis CLI
docker exec -it redis redis-cli
> LLEN celery          # pending tasks in default queue
> KEYS celery-task-meta-*   # completed task results
```

**Step 2 — Check worker is running and received task**

```bash
# Worker logs
docker compose logs worker --tail=100 -f

# Or directly
celery -A config inspect active     # tasks currently executing
celery -A config inspect reserved   # tasks waiting in worker
celery -A config inspect scheduled  # eta/countdown tasks
```

**Step 3 — Check beat schedule (for periodic tasks)**

```bash
celery -A config inspect scheduled

# Verify task is registered in beat schedule
python manage.py shell
>>> from django_celery_beat.models import PeriodicTask
>>> PeriodicTask.objects.filter(enabled=True).values('name', 'task', 'last_run_at')
```

**Step 4 — Reproduce task failure directly**

```python
python manage.py shell
>>> from [app].tasks import my_task
>>> my_task.apply(args=[arg1, arg2])   # runs synchronously, shows full traceback
```

**Step 5 — Inspect task result**

```python
from celery.result import AsyncResult
result = AsyncResult('task-uuid-here')
print(result.state)     # PENDING / STARTED / SUCCESS / FAILURE / RETRY
print(result.info)      # exception info on FAILURE
print(result.traceback) # full traceback
```

**Step 6 — Check idempotency (task ran twice)**

Tasks must be idempotent (safe to run multiple times). Check if the service function has a guard:

```python
# Correct pattern
def process_invoice(invoice_id):
    invoice = Invoice.objects.get(pk=invoice_id)
    if invoice.status == Invoice.Status.PROCESSED:
        return  # already done
    # ... rest of logic
```

If missing, the duplicate run caused the inconsistency. Add the guard, then correct the data manually.

**Common Celery failure patterns**

| Symptom | Cause | Fix |
|---------|-------|-----|
| Task never appears in Flower | Not enqueued — service call missing | Check service layer call |
| Task FAILURE with `DoesNotExist` | Object deleted before task ran | Add `get_or_none` guard at task start |
| Task runs but no effect | Idempotency guard exits early | Check guard condition |
| Beat task not firing | Worker started without beat | Start `celery beat` separately |
| Task stuck in STARTED | Worker crashed mid-task | Restart worker; check `visibility_timeout` |
| Duplicate task results | No idempotency guard | Add status check at task entry |

### 3. Write failing test first

Reproduce in a test before fixing. This locks the regression.

```ts
// frontend
it('renders empty state when no orders', () => { ... })
```

```python
# backend
@pytest.mark.django_db
def test_foo_rejects_when_period_closed(): ...
```

### 4. Hypothesize → verify → fix

- One hypothesis at a time.
- Verify with log / test before changing code.
- Root cause, not symptom. Do not use `try/except: pass` to hide errors.

### 5. Confirm fix

- New test passes.
- All existing tests pass.
- Manual smoke test if UI.

### 6. Prevent recurrence

- Is this class of bug possible elsewhere? grep for pattern.
- Does a contract need a stricter type? Update.
- Does observability need improvement? Add log/metric.

## Anti-patterns when debugging

| Do NOT | Do instead |
|--------|-----------|
| Add `any` to silence TS | Fix the type |
| Catch and swallow exception | Handle or re-raise with context |
| Disable a failing test | Fix test or fix code |
| Force-push over a bad commit | Add corrective commit |
| Patch in UI what's wrong in data | Fix backend/service layer |

## Definition of done

- [ ] Test reproduces the bug before fix.
- [ ] Test passes after fix.
- [ ] Root cause identified in PR description.
- [ ] Related code reviewed for same pattern.
- [ ] If customer-visible: user-facing message / toast reviewed.
