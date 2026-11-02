import type { z } from "zod"
import type {
    commentAttachmentSchema,
    commentFormSchema,
    commentMentionSchema,
    commentSchema,
    commentThreadSchema,
    mentionableTeamSchema,
    mentionableUserSchema,
    mentionablesSchema,
} from "./schema"

export type CommentMention = z.infer<typeof commentMentionSchema>
export type CommentAttachment = z.infer<typeof commentAttachmentSchema>
export type Comment = z.infer<typeof commentSchema>
export type CommentThread = z.infer<typeof commentThreadSchema>
export type MentionableUser = z.infer<typeof mentionableUserSchema>
export type MentionableTeam = z.infer<typeof mentionableTeamSchema>
export type Mentionables = z.infer<typeof mentionablesSchema>
export type CommentFormValues = z.infer<typeof commentFormSchema>

/** Entidad comentada: label "app.model" + id (ADR-0080). */
export interface CommentTarget {
    label: string
    id: number | string
}

export interface CreateCommentPayload {
    text: string
    parentId?: number | null
    files?: File[]
}
