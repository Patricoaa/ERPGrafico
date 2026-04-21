---
layer: 30-playbooks
doc: add-migration
task: "Create Django migration"
triggers: ["migration", "alter table", "new model", "add column"]
preconditions:
  - 10-architecture/backend-apps.md
  - 40-quality/security.md
validation:
  - python manage.py makemigrations --dry-run --check
  - python manage.py migrate --plan
  - pytest
forbidden:
  - editing an applied migration
  - dropping column without deprecation period
  - data loss without explicit confirmation
status: active
owner: backend-team
last_review: 2026-04-21
---

# Playbook — Add Django migration

## Golden rules

1. **Never edit an applied migration.** Add a new one.
2. **Never drop a column in the same release that stops writing to it.** 2-phase: stop writing → deploy → drop → deploy.
3. **Large tables** (>1M rows): avoid `ALTER` that rewrites. Use `NOT NULL DEFAULT` carefully.
4. **Data migrations** always reversible (`RunPython` with reverse callable).

## Steps

### 1. Model change

Edit `apps/[app]/models.py`. Be explicit:
- `null=` and `blank=` intentional.
- `db_index=True` for query filters.
- `on_delete` matching business rule (`PROTECT` for financial refs).

### 2. Generate migration

```bash
python manage.py makemigrations [app] --name descriptive_snake_case
```

### 3. Review generated SQL

```bash
python manage.py sqlmigrate [app] 0042_add_foo_field
```

Check: locks, full-table rewrites, default value fill.

### 4. If destructive — confirm with user

Destructive = drop table, drop column, rename column, narrow type.

STOP. Ask user:
- Confirm data disposition.
- Confirm 2-phase plan if column still in use.

### 5. Data migrations

```python
from django.db import migrations

def forwards(apps, schema_editor):
    Foo = apps.get_model('[app]', 'Foo')
    for row in Foo.objects.iterator():
        row.new_field = derive(row)
        row.save(update_fields=['new_field'])

def backwards(apps, schema_editor):
    Foo = apps.get_model('[app]', 'Foo')
    Foo.objects.update(new_field=None)

class Migration(migrations.Migration):
    dependencies = [('[app]', '0041_previous')]
    operations = [migrations.RunPython(forwards, backwards)]
```

Large tables: batch with `.iterator(chunk_size=1000)` and progress log.

### 6. Test

```bash
pytest apps/[app]/tests
python manage.py migrate --plan
python manage.py migrate [app] zero  # reverse
python manage.py migrate [app]       # forward again
```

### 7. Backfill plan (prod)

If migration touches large data:
- Run during low-traffic window.
- Monitor `pg_stat_activity` for lock waits.
- Have rollback command ready.

## 2-phase column removal

**Phase 1 (release N):**
- Stop writing to column (model removes field or `editable=False`).
- App still reads column for backward compat.

**Phase 2 (release N+1):**
- Migration drops column.

Document both phases in ADR if column is public API.

## Validation

```bash
python manage.py makemigrations --dry-run --check   # no drift
python manage.py migrate --plan
pytest
python manage.py migrate                            # local apply
```

## Definition of done

- [ ] Migration file committed.
- [ ] Forward + reverse both tested.
- [ ] No edits to prior applied migrations.
- [ ] Destructive ops explicitly approved by user.
- [ ] Data migration batched if >10k rows.
- [ ] Deployment plan noted in PR description.
