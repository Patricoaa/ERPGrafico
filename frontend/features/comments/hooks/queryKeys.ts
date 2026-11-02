import type { CommentTarget } from "../types"

export const COMMENT_KEYS = {
    all: ["entity_comments"] as const,
    target: (target: CommentTarget) => [...COMMENT_KEYS.all, target.label, String(target.id)] as const,
    mentionables: (query: string, target: CommentTarget | null) =>
        [...COMMENT_KEYS.all, "mentionables", query, target?.label ?? null, target ? String(target.id) : null] as const,
}
