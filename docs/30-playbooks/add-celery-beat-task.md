---
layer: 30-playbooks
doc: add-celery-beat-task
task: "Add scheduled recurring task (Celery BEAT)"
triggers: ["celery beat", "cron", "scheduled task", "recurring job"]
preconditions:
  - 10-architecture/backend-apps.md
validation:
  - pytest apps/[app]/tests/test_tasks.py
forbidden:
  - overriding `django_celery_beat` DB-backed schedule for system-level immutable crons
  - scheduled tasks without concurrency locks (deduplication)
status: active
owner: backend-team
last_review: 2026-06-25
---

# Playbook — Add Celery BEAT task

## When

- You need a task to run automatically on a recurring schedule (e.g., nightly, hourly, every 15 minutes).
- Examples: mark loan installments as overdue, purge old exports, check subscription renewals.

## 1. Concurrency and Deduplication (Crucial)

Celery BEAT tasks fire based on the clock. If a task takes longer than its interval to complete, or if the server restarts and fires the task again, you can end up with concurrent executions of the same task. **All BEAT tasks must use a concurrency lock or strict DB-level state checking.**

**Pattern A: State checking (Idempotency)**
```python
from celery import shared_task
from django.utils import timezone

@shared_task
def mark_overdue_loan_installments():
    # Solo procesa las que están PENDING y vencieron ayer o antes
    installments = LoanInstallment.objects.filter(
        status='PENDING',
        due_date__lt=timezone.now().date()
    )
    for inst in installments:
        # Se puede usar atomic y un lock de fila (select_for_update) si es necesario
        inst.mark_overdue()
```

**Pattern B: Distributed Lock (Redis)**
If the task does heavy computation or external API calls where state checking isn't enough, use a Redis lock (cache) to prevent overlap.
```python
from celery import shared_task
from django.core.cache import cache

@shared_task
def sync_exchange_rates():
    lock_id = "lock_sync_exchange_rates"
    # Adquirir lock por 10 minutos
    if not cache.add(lock_id, "true", timeout=600):
        return "Already running"
    
    try:
        # Hacer fetch de API externa
        pass
    finally:
        cache.delete(lock_id)
```

## 2. Registering the Schedule

**Standard Code-First approach (Recommended):**
Most system-level tasks should be version-controlled in `backend/config/settings.py` inside `CELERY_BEAT_SCHEDULE`.

```python
# backend/config/settings.py
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'mark-overdue-loans-nightly': {
        'task': 'treasury.tasks.mark_overdue_loan_installments',
        'schedule': crontab(hour=2, minute=0),
    },
    'purge-old-exports-weekly': {
        'task': 'core.tasks.purge_old_exports',
        'schedule': crontab(day_of_week='sun', hour=3, minute=0),
    },
}
```

**DB-Backed approach (`django_celery_beat`):**
Use `django_celery_beat.models.PeriodicTask` *only* if the schedule must be configurable by an administrator via the Django Admin at runtime. 
Do not mix: if a task is in `CELERY_BEAT_SCHEDULE`, do not create a DB record for it.

## 3. Reference BEAT Tasks

Before adding a new task, check existing ones to understand the domain conventions:
- `treasury.tasks.mark_overdue_loan_installments`
- `treasury.tasks.mark_overdue_card_statements`
- `core.tasks.purge_old_exports`
- `inventory.tasks.check_subscription_renewals`

## Definition of done

- [ ] Task logic handles deduplication safely (locks or state idempotency).
- [ ] Registered in `CELERY_BEAT_SCHEDULE`.
- [ ] Uses `crontab` carefully respecting server timezone constraints.
- [ ] Doesn't pass complex objects as arguments (use empty args for BEAT, let the task fetch what it needs).
