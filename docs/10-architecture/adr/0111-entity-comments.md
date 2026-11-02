---
id: 0111
title: Entity comments — threads, mentions and notifications on any entity
status: Proposed
date: 2026-11-02
author: fullstack-team
---

# 0111 — Entity comments

## Context

The ERP needs contextual collaboration attached to any record: comments, replies, @mentions of users and teams, and notifications in the TaskInbox. `workflow.Comment` already existed as a generic (ContentType + GenericFK) model, but it was only exposed through ad-hoc `comments` actions on `SaleOrderViewSet` and `WorkOrderViewSet`. The frontend `CommentSystem` that consumed them was never mounted. There were no mentions, threads, edit or delete, and no generic endpoint.

## Decision

1. **Single generic model.** Extend `workflow.Comment` with `parent` (FK self, PROTECT), `edited_at`, `deleted_at` and `deleted_by`, and add `CommentMention` (comment + user XOR group). The migration is additive.
2. **Identity = `"app.model"` label + id** (ADR-0080). It is resolved with `DocumentTypeRegistry.model_for` / `label_for`. Any model resolvable that way can be commented.
3. **One-level threads (Slack style).** A reply to a reply is attached to the thread root by the service.
4. **Mentions are tokens in plain text.** `@[u:<id>]` is a user and `@[g:<id>]` is a group. Only active users and `GroupProfile.kind == TEAM` groups are mentionable. ROLE groups are for permissions, not communication. Invalid tokens are rejected with 400.
5. **Visibility is inherited from the entity.** There are no object-level permissions. Whoever has `DocumentTypeRegistry.view_permission(label)` can list and create comments on the entity. Only the author can edit. The author or a moderator (`workflow.delete_comment`, included in `workflow.manage`) can delete.
6. **Soft delete.** Deleted comments disappear from the list. A deleted root with live replies is kept as a "Comentario eliminado" placeholder so the thread does not break (deletion-policy.md).
7. **Notifications reuse `workflow.Notification`** and its WebSocket push.
   - `comment_mention` goes to mentioned users and to active members of mentioned teams. `comment_reply` goes to thread participants (root author + repliers).
   - The author is excluded, and so is any recipient **without view permission on the entity**. Those users are not notified, so the content is not leaked. The autocomplete warns about them.
   - Editing notifies only newly added mentions.
   - `data = {label, id, comment_id, thread_id}`, and the TaskInbox opens the entity with `openEntity(label, id)`.
8. **Endpoints** (`workflow/comments/`):
   - `GET|POST /api/workflow/comments/?target=<label>:<id>`
   - `PATCH|DELETE /api/workflow/comments/{id}/`
   - `GET /api/workflow/comments/mentionables/?q=&target=`
9. **Frontend feature `features/comments`.**
   - `CommentsPanel` is a collapsible section with threads and a composer.
   - `EntitySidebar` is the drawer right rail: comments above, `ActivitySidebar` below. It has the same props as `ActivitySidebar`.
   - The composer is a `Textarea` with a mention popover. No new dependencies.
10. **Live refresh** uses an entity-bus subtopic, `<app>.<model>.<id>.comments`, with event `comments.changed`.
    - It works for any commentable entity without joining `ALLOWLIST`, and it does not invalidate the entity's own detail queries.
    - Subscribing requires the entity's view permission.
11. **Attachments** reuse `core.Attachment` (`GenericRelation` on `Comment`, private storage). Downloads go through a permission-checked endpoint instead of a signed URL, so links never expire inside an open panel and the storage is never exposed. There are at most 5 files of 10 MB each, using the `core.validators` extension list.
12. **No idempotency key.** Comments are not in the closed list of `idempotency.md`. The composer is disabled while submitting.

## Consequences

- `EntitySidebar` keeps the `ActivitySidebar` API (`entityType`, `entityId`, `title`). It resolves the commentable label from `COMMENT_LABEL_BY_AUDIT_TYPE`. Every drawer and sheet rail has been migrated. Keys without a model of their own (`bank_journal`, `reordering_rule`, `company_settings`, `attachment`) show activity only.
- The legacy `comments` actions on SaleOrder and WorkOrder stay for compatibility and hide soft-deleted comments. They are deprecated in favour of the generic endpoint. The unused `CommentSystem.tsx`, `SaleOrderSidebar.tsx`, `useSaleOrderComments` and `useWorkOrderComments` were removed.
- The composer uses react-hook-form without a native `<form>` element, and submits explicitly (Enter or the send button, `type="button"`). Some drawers wrap their whole `DrawerLayout`, rail included, in their own `<form>`, so a nested form would be invalid HTML and could submit the host form.
- View mode must not disable the rail. `DrawerLayout` gained `contentDisabled`, which wraps only the central workspace in `<fieldset disabled>`. ContactDrawer, ProductDrawer, UserDrawer and EmployeeDrawer moved from an outer fieldset to this prop.
- Listing a target runs a constant number of queries. Notification fan-out does one permission query per comment.
- Deferred: tags or classification labels, follow/mute of threads, private comments, and migration of the work-order stage JSON comments (TASK-307).

## Alternatives considered

- **New `collaboration` app with its own model.** Rejected: it would duplicate `workflow.Comment` and `Notification`.
- **Unlimited nesting.** Rejected: it is not legible in a 288 px rail.
- **Rich-text editor (tiptap/lexical).** Rejected for phase 1: a heavy dependency for a feature that only needs mentions.
- **Notify mentioned users without access.** Rejected: it leaks comment content to people who cannot see the entity.
