---
id: 0112
title: Bank statement lifecycle — draft-only edit and delete, original download, and the reconciliation workbench as a workspace tab
status: Proposed
date: 2026-11-05
author: treasury-team
---

# 0112 — Bank statement lifecycle and workbench tab

## Context

The bank statement list (`StatementsClientView`) exposed only "Reconciliar". Editing, viewing the detail, deleting and downloading the imported file were missing or lived in ad-hoc drawers. The detail was a bespoke drawer with no activity or comments, and the reconciliation workbench opened in a full-height drawer, not in the workspace tab bar (ADR-0101) used for every other entity.

Two backend facts shaped the decision:

- `BankStatementViewSet` was a plain `ModelViewSet`. A `DELETE` removed the statement and its lines with no state check, and a `PATCH` could change the account and the file.
- The serializer returned `file` as the signed URL of the private storage (30 min). The frontend read `state` and `state_display`, which the API never returned.

## Decision

1. **No statement edit.** The statement is not editable after import: the endpoint does not accept `PUT`/`PATCH` (405). The file and the balances come from the import, and editing them would desynchronise the parsed lines. A wrong import is corrected by deleting the draft (rule 2) and importing again.
2. **Delete only an untouched `DRAFT`.** A statement can be deleted only while it is `DRAFT` and every line is `UNRECONCILED`. Any `EXCLUDED`, `MATCHED`, `RECONCILED` or `DISPUTED` line blocks deletion, because those lines hold operator decisions. The original file is removed from storage on commit. This matches the "draft without value" precedent (`DraftCart`), since a draft statement has no accounting effect.
3. **The original file is downloaded through the API.** `GET /treasury/statements/{id}/download/` checks view permission through `get_object` and returns an attachment. The detail and list expose `has_file` and `file_name`, never the storage URL.
4. **The statement detail is an entity drawer.** `treasury.bankstatement` opens as a workspace tab through `openEntity`. Its sheet has the tabs Resumen · Líneas · Relaciones and a rail with `EntitySidebar` (comments and activity). The model has history, so `AuditHistoryMixin` is enabled.
5. **The reconciliation workbench is a workspace tab.** `openWorkbench(statementId)` adds a `workbench` tab (ADR-0101). The old bottom drawer and the `?workbench=` drawer are retired. Deep links (`?workbench=`, `?selected=`) open their tab once per value.
6b. **Excluded lines can be included again in bulk.** `POST /treasury/statement-lines/bulk_restore/` with `line_ids` moves the `EXCLUDED` lines of the selection back to `UNRECONCILED`. Other statuses are not touched, and confirmed statements are rejected (400). The workbench dock exposes it as "Volver a incluir (N)".
6. **Row actions follow the rules above.** "Reconciliar" shows while the statement is open and below 100 %. "Eliminar" shows for `DRAFT` and is disabled when it has worked lines. "Descargar original" shows when the file exists. The rules live in `lib/statementRules.ts`, which mirrors `BankStatementService`. The UI hides or disables, and the backend validates.

## Consequences

- Positive: one surface per entity (ficha as tab, mesa as tab), the same activity and comments on the statement as on other documents, and no broken `state` in the list.
- Positive: the list is no longer N+1 for the delete rule, because the selector annotates `touched_lines_count`.
- Negative: deleting a draft is irreversible. The UI asks for confirmation, and the rule forbids it once any line is worked.
- Neutral: `BankStatement.status` remains the single state field, and `CANCELLED` still has no transition. The rule covers it as read-only.

## Alternatives considered

- **Soft-cancel (`CANCELLED`) instead of deleting a draft.** Rejected for now: the import is re-runnable, and `file_hash` uniqueness would block re-importing a cancelled file.
- **Edit balances or dates in place.** Rejected and removed: balances come from the file, and an edit would not match the parsed lines. Re-importing a draft covers the same need.
- **Open the mesa in a browser tab (new route).** Rejected: the app's document model is the workspace tab (ADR-0101), and the mesa needs the same unsaved-changes guard and tab bar.

## References

- [ADR-0101](0101-workspace-tab-bar.md) — workspace tabs
- [ADR-0083](0083-document-sheet-replaces-order-hub.md) — document sheet
- [ADR-0111](0111-entity-comments.md) — comments on any entity
- [state-map.md](../../20-contracts/state-map.md) · [deletion-policy.md](../../20-contracts/deletion-policy.md)
