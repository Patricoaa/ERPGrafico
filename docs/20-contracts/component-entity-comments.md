---
layer: 20-contracts
doc: component-entity-comments
status: active
owner: fullstack-team
last_review: 2026-11-02
stability: contract-changes-require-ADR
---

# Entity Comments Contract

Comments, one-level threads, @mentions of users and teams, and notifications on **any** ERP entity. Decision: [ADR-0111](../10-architecture/adr/0111-entity-comments.md).

## Frontend

```tsx
import { EntitySidebar, CommentsPanel } from "@/features/comments"

// Drawer right rail: comments (top) + activity (bottom). Same props as ActivitySidebar.
<DrawerLayout
    rightRail={entity?.id ? <EntitySidebar entityType="contact" entityId={entity.id} /> : undefined}
    rightRailCollapsible
/>

// Comments alone, in any other surface
<CommentsPanel target={{ label: "sales.saleorder", id: order.id }} />
```

| Export | Purpose |
|--------|---------|
| `EntitySidebar` | Drawer rail. Same props as `ActivitySidebar` (`entityType`, `entityId`, `title?`). The commentable label comes from `COMMENT_LABEL_BY_AUDIT_TYPE` (`features/comments/lib/entityLabels.ts`). Keys without a model show activity only. Activity starts **collapsed** when the comments panel is present (`ActivitySidebar defaultOpen={false}`) and expanded otherwise. **Use it instead of `ActivitySidebar` in drawer rails.** |
| `CommentsPanel` | `CollapsibleSection` with threads, replies, edit/delete and composer. Handles loading/empty/error. |
| `MentionTextView` | Renders stored text, resolving `@[u:id]`/`@[g:id]` tokens to names. |
| `useEntityComments(target)` | `{ threads, count, loading, error }`. |
| `useCommentMutations(target)` | `createComment({ text, parentId? })`, `updateComment({ id, text })`, `deleteComment(id)`. |

Rules:
- A new entity type for the rail = add its `ActivitySidebar` key and its `"app.model"` label to `COMMENT_LABEL_BY_AUDIT_TYPE`.
- `label` (for `CommentsPanel`) is the canonical `"app.model"` label used by `openEntity` / `DocumentTypeRegistry`, not the `ActivitySidebar` snake_case key.
- The composer writes `@Nombre` for the user and sends tokens (`@[u:12]`) to the API. Never post display names as mentions.
- `can_edit` / `can_delete` come from the API. Do not re-derive them on the client.
- Never wrap `EntitySidebar` / `CommentsPanel` in a `<fieldset disabled>`: comments must stay usable in view mode. For drawer view mode use `DrawerLayout contentDisabled`, which disables only the central workspace.
- The composer renders no native `<form>`, because rails can sit inside a drawer's `<form>` and nested forms are invalid. Its buttons are `type="button"`, so they never submit the host form.

## API

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/api/workflow/comments/` | `?target=app.model:id` | `CommentThread[]` (chronological roots, `replies[]` chronological) |
| POST | `/api/workflow/comments/` | JSON `{ target, text, parent_id? }`, or multipart with `files` repeated (max 5) | `Comment` (201) |
| GET | `/api/workflow/comments/{id}/attachments/{attachment_id}/` | — | File download (`Content-Disposition: attachment`) |
| PATCH | `/api/workflow/comments/{id}/` | `{ text }` | `Comment` |
| DELETE | `/api/workflow/comments/{id}/` | — | 204 (soft delete) |
| GET | `/api/workflow/comments/mentionables/` | `?q=&target=` | `{ users: [{id,name,username,has_access}], teams: [{id,name,member_count}] }` |

`Comment = { id, parent_id, author: {id,name}|null, text, mentions: [{kind:"user"|"team", id, name}], attachments: [{id, name, size, mime_type}], created_at, edited_at, is_deleted, can_edit, can_delete }`. A deleted root with live replies returns `is_deleted: true`, an empty `text` and no attachments.

Attachments:
- They are `core.Attachment` rows linked to the comment through a `GenericRelation`, stored in `PrivateMediaStorage`.
- The API never exposes the storage's signed URL. Download goes through the endpoint above, which requires the entity's view permission. The frontend fetches the blob (`commentsApi.downloadAttachment`).
- Limits mirror `core.validators`: at most 5 files of 10 MB each, with extensions `.pdf .doc(x) .jpg/.jpeg .png .xls(x) .csv .zip .rar`. The service validates them explicitly, because `Attachment.objects.create` skips field validators.
- A comment may have attachments and no text. Attachments are added only on creation; editing changes the text only.

Permissions:
- Every action requires `view_permission(label)` of the target. Without it the response is 403.
- `PATCH` is for the author only.
- `DELETE` is for the author, or a user with `workflow.delete_comment`.
- `parent_id` must belong to the same target. A reply to a reply is stored under the thread root.
- Text is at most 5000 characters. Mention tokens must reference active users or TEAM groups; otherwise the response is 400.

## Notifications

`workflow.Notification` is pushed over `ws/notifications/`:

| `notification_type` | Recipients |
|---------------------|------------|
| `comment_mention` | Mentioned users and active members of mentioned teams |
| `comment_reply` | Thread participants: root author + repliers |

- The author is excluded, and so is any recipient without view permission on the target.
- Editing a comment notifies only newly added mentions.
- `title` = the entity's display id (`core.documents.refs.display_id_for`, e.g. `OV-000123`). `message` = `"<author> te mencionó|respondió: <preview>"`.
- `data = { label, id, comment_id, thread_id }` and `link = canonical_url`. The TaskInbox opens `openEntity(label, id)`. The card icon depends on the type: `AtSign` for mentions, `MessageSquareReply` for replies, `Bell` for anything else.

## Live refresh

Every create, edit and delete broadcasts `comments.changed` on the entity-bus subtopic `<app>.<model>.<id>.comments` after commit. `useEntityComments` subscribes to it, so open panels refresh when someone else comments. The author's own echo is dropped by `ignoreOwnActor`. See [realtime-channels.md](realtime-channels.md).

## Backend extension points

- Service: `workflow.comments.services.CommentService` (`create`, `edit`, `delete`).
- Selectors: `workflow.comments.selectors` (`thread_roots` loads everything with prefetches; zero N+1).
- Legacy `comments` actions on `SaleOrderViewSet` / `WorkOrderViewSet` are deprecated; do not add new ones.
