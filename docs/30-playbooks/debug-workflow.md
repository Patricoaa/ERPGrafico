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
| Slow query | `django-debug-toolbar`, `EXPLAIN ANALYZE` |

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
