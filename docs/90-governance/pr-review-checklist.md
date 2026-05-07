---
layer: 90-governance
doc: pr-review-checklist
status: active
owner: core-team
last_review: 2026-05-07
---

# PR Review Checklist

Reviewer pastes or ticks before approving. Author self-reviews first.

## Scope

- [ ] PR does one thing. No bundled refactor + feature + bugfix.
- [ ] Title follows Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- [ ] Description links the playbook used and any ADR.

## Types and contracts

- [ ] Zero `any` (see `zero-any-policy.md`).
- [ ] Zod schemas match backend serializers.
- [ ] No contract (`docs/20-contracts/*`) changed without ADR.
- [ ] API docs updated if endpoint added/changed.

## Architecture

- [ ] Feature boundaries respected (no deep cross-feature imports).
- [ ] `@/lib/api` not imported in components.
- [ ] Views ≤20 lines per action; logic in services.
- [ ] Multi-table writes wrapped in `transaction.atomic()`.

## Visual / UI

- [ ] Semantic tokens only (no `bg-red-500` etc).
- [ ] 8pt grid respected.
- [ ] `h-10` minimum interactive height.
- [ ] `StatusBadge` only for statuses.
- [ ] Three states handled (loading / empty / error).

## Loading states (skeletons)

- [ ] `loading.tsx` for new routes uses `PageLayoutSkeleton` or `AppShellSkeleton` — no raw `<Skeleton>` primitives.
- [ ] Refetch / filter / pagination uses `SkeletonShell` + typed placeholder data — not an early-return skeleton that dismounts the table.
- [ ] No direct import of `@/components/ui/skeleton` in `features/**` or `app/**` (ESLint enforces this).
- [ ] New feature skeleton added as `Component.Skeleton` static property co-located in the same file.
- [ ] Every skeleton container has `role="status"` + `aria-label` (provided automatically by the shared wrappers).

## Tests

- [ ] New code covered at thresholds in `testing.md`.
- [ ] Happy path + permission denied + validation error tests for new endpoints.
- [ ] Hook tests assert query key + invalidation.
- [ ] No skipped / disabled tests without linked issue.

## Security

- [ ] Permission class on new viewsets.
- [ ] No secrets in code or logs.
- [ ] File uploads validated (size + MIME + content).
- [ ] PII not logged.

## Observability

- [ ] INFO log on new business event.
- [ ] Metric emitted for new KPI.
- [ ] Error path reaches Sentry.

## Performance

- [ ] No new N+1 (assert query count test).
- [ ] Indexes on new filter/sort fields.
- [ ] Bundle delta <target; dynamic import if heavy.
- [ ] Nothing >300ms sync in request path.

## Migrations

- [ ] One migration per change.
- [ ] Reversible (or documented as forward-only).
- [ ] No edit to applied migrations.
- [ ] 2-phase plan if dropping used column.

## Docs

- [ ] Playbook updated if process changed.
- [ ] Contract docs updated if API / component / hook changed.
- [ ] `last_review` bumped on any doc edited.
