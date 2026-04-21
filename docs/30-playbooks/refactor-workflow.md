---
layer: 30-playbooks
doc: refactor-workflow
task: "Refactor, rename, extract, restructure"
triggers: ["refactor", "rename", "extract", "restructure"]
preconditions:
  - 10-architecture/frontend-fsd.md
  - 10-architecture/backend-apps.md
  - 40-quality/testing.md
forbidden:
  - refactor + behavior change in same PR
  - contract change without ADR
status: active
owner: core-team
last_review: 2026-04-21
---

# Playbook — Refactor

## Rule zero

**Refactor = zero behavior change.** If tests need updating for new behavior, it is NOT a refactor. Split into two PRs.

## Decision flow

```
Does it cross a contract in /docs/20-contracts/?
├─ Yes → ADR required first
└─ No  → continue

Is it a mass change (≥3 features/apps)?
├─ Yes → ADR + staged PRs
└─ No  → single PR OK

Is behavior changing?
├─ Yes → this is NOT a refactor — use add-feature or debug-workflow
└─ No  → proceed
```

## Steps

### 1. Ensure coverage before touching

```bash
# frontend
npm run test -- --coverage features/[x]
# backend
pytest apps/[app] --cov=apps/[app]
```

Coverage must be ≥80% on the code you plan to move. If not → write tests first.

### 2. Mechanical refactor

- Rename: IDE rename across repo.
- Extract: move code, update imports, keep public API identical.
- Inline: opposite direction; same constraint.

### 3. Run full test suite

Every test must still pass with zero changes. If any test needed to change, you changed behavior — stop, split the PR.

### 4. Update documentation

- Path changes → update playbook references.
- Contract unchanged → no doc change.

### 5. Single-concern PR

One refactor per PR. Do not bundle:
- Refactor + bugfix
- Refactor + feature
- Refactor + dependency upgrade

## Validation

```bash
# Frontend
npx tsc --noEmit
npm run lint
npm run test

# Backend
pytest
python manage.py check --deploy
python manage.py makemigrations --dry-run --check
```

## Definition of done

- [ ] All tests pass without modification.
- [ ] Public API unchanged (or ADR in place).
- [ ] PR diff shows only moves/renames when possible.
- [ ] No unrelated changes bundled.
