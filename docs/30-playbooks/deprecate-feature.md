---
layer: 30-playbooks
doc: deprecate-feature
task: "Deprecate and remove feature / endpoint / component"
triggers: ["deprecate", "remove", "sunset", "retire"]
preconditions:
  - 10-architecture/adr/README.md
  - 20-contracts/api-contracts.md
  - 20-contracts/component-contracts.md
status: active
owner: core-team
last_review: 2026-04-21
---

# Playbook — Deprecate feature

## Phases

```
Propose → Deprecate (warn) → Remove (clean)
  ADR      release N           release N+M
```

### Phase 1 — Propose

- Open ADR with rationale, migration path, timeline.
- Identify all consumers (code + external if API).
- Get approval before any code change.

### Phase 2 — Deprecate (warn)

**Frontend component:**
```tsx
/** @deprecated use <NewThing /> — removal planned release N+2 */
export function OldThing(props) { ... }
```
- Add console warn in dev: `console.warn('[deprecated] OldThing — use NewThing')`.
- Storybook/docs marked ⚠️ deprecated.
- Contract entry moved to "Deprecated" section.

**Backend endpoint:**
- Add `Deprecation` + `Sunset` HTTP headers.
- Log every call with `deprecated_endpoint_called` metric.
- OpenAPI `@extend_schema(deprecated=True)`.
- `api-contracts.md` marks endpoint deprecated with sunset date.

**Database field:**
- Follow 2-phase rule in [add-migration.md](add-migration.md).

### Phase 3 — Monitor

- Dashboard: count of deprecated usage over time.
- Goal: zero for N consecutive days before removal.
- Contact remaining consumers directly.

### Phase 4 — Remove

- Delete code.
- Delete tests.
- Remove contract entry.
- Migration for DB columns (Phase 2 of 2-phase).
- Update playbook references.
- Mark ADR `Accepted → Superseded by (removal PR #X)`.

## Hard gates before removal

- [ ] Deprecation window elapsed (default ≥30 days; longer for external API).
- [ ] Zero usage metric confirmed.
- [ ] All consumers notified + migrated.
- [ ] ADR updated.
- [ ] No open issues referencing the feature.

## Definition of done

- [ ] Feature gone from codebase and docs.
- [ ] No dead references (grep returns nothing).
- [ ] Migration applied if DB touched.
- [ ] Changelog entry.
