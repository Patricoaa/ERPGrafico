---
id: 0108
title: Workflow approval decisions are server-owned
status: Proposed
date: 2026-11-01
author: core-team
---

# 0108 — Workflow approval decisions are server-owned

## Context

`Task.status` was writable through the generic task `PATCH` endpoint. That path did
not enforce task assignment, approval policies, evidence requirements, or append-only
decision history. The POS inbox used that path for approve/reject. At the same time,
group assignment rules changed to a `Group` foreign key while the frontend and API
contract still exchanged group names.

## Decision

- Task reads remain authenticated and row-filtered for the personal inbox. Task writes
  use `StandardizedModelPermissions` plus row-level service authorization.
- `Task.status` is server-owned. Generic create/update requests cannot set it; approval
  and rejection use explicit `POST .../complete/` and `POST .../reject/` actions.
- Every decision is appended to `TaskEvent`. A rejection is terminal. A completed task
  can be reopened only through the existing workflow service, which records `REOPENED`.
- `ApprovalPolicy.approvals_required` means distinct user approvals on the same task in
  the current cycle (after its latest `REOPENED` event). The task stays pending until
  the required count is reached. More than one approval requires a group-assigned task;
  a single-user assignment cannot supply distinct approvers.
- `TaskAssignmentRule.assigned_group` is represented by the Django `Group` primary key
  on writes and in the `assigned_group` response field. `assigned_group_data` carries
  display metadata.
- Approval-policy document keys use canonical lower-case Django labels (`app_label.model`).
  Legacy aliases are normalized during lookup; new frontend edits offer canonical choices.
- Explicit POS credit approval (`sales.approve_credit`) still provides the direct path,
  but it must satisfy the same applicable document policy. A multi-person policy requires
  a task request and cannot be bypassed by direct approval.

## Consequences

- Client-side buttons can no longer bypass decision checks by PATCHing a status.
- APIs and the contract documentation must keep task status read-only and use decision
  actions for state changes.
- Multi-approval tasks need a group assignment and retain individual decision events.
- Existing group-name policy values require a data-state check before migration/deploy;
  do not rewrite already-applied migrations.

## Alternatives considered

- Keep `PATCH` and duplicate the complete/reject checks in `perform_update`: rejected
  because it leaves a second business-rule path.
- Count approvals across document task types: rejected because the policy is attached to
  a document type but no approval-sequence/grouping contract exists across tasks.
- Continue sending group names: rejected because the persisted field is a foreign key
  and names are mutable/non-unique identifiers.

## References

- [ADR-0104 — RBAC](0104-rbac-action-permissions-roles-teams.md)
- [Security contract](../../40-quality/security.md)
- [Workflow API contract](../../20-contracts/api-contracts.md#workflow)