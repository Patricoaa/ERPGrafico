import api from "@/lib/api"
import { commentSchema, commentThreadSchema, mentionablesSchema } from "../schema"
import type {
    Comment,
    CommentAttachment,
    CommentTarget,
    CommentThread,
    CreateCommentPayload,
    Mentionables,
} from "../types"

const BASE = "/workflow/comments/"

export function targetParam(target: CommentTarget): string {
    return `${target.label}:${target.id}`
}

function toFormData(target: CommentTarget, payload: CreateCommentPayload, files: File[]): FormData {
    const data = new FormData()
    data.append("target", targetParam(target))
    data.append("text", payload.text)
    if (payload.parentId != null) data.append("parent_id", String(payload.parentId))
    for (const file of files) data.append("files", file)
    return data
}

export const commentsApi = {
    list: async (target: CommentTarget, signal?: AbortSignal): Promise<CommentThread[]> => {
        const res = await api.get(BASE, { params: { target: targetParam(target) }, signal })
        return commentThreadSchema.array().parse(res.data)
    },

    create: async (target: CommentTarget, payload: CreateCommentPayload): Promise<Comment> => {
        const files = payload.files ?? []
        const res = files.length > 0
            ? await api.post(BASE, toFormData(target, payload, files), {
                headers: { "Content-Type": "multipart/form-data" },
            })
            : await api.post(BASE, {
                target: targetParam(target),
                text: payload.text,
                parent_id: payload.parentId ?? null,
            })
        return commentSchema.parse(res.data)
    },

    /** Descarga vía backend (permiso de la entidad); no expone la URL firmada del storage. */
    downloadAttachment: async (commentId: number, attachment: CommentAttachment): Promise<void> => {
        const res = await api.get<Blob>(`${BASE}${commentId}/attachments/${attachment.id}/`, {
            responseType: "blob",
        })
        const url = window.URL.createObjectURL(res.data)
        const link = document.createElement("a")
        link.href = url
        link.download = attachment.name
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
    },

    update: async (id: number, text: string): Promise<Comment> => {
        const res = await api.patch(`${BASE}${id}/`, { text })
        return commentSchema.parse(res.data)
    },

    remove: async (id: number): Promise<void> => {
        await api.delete(`${BASE}${id}/`)
    },

    mentionables: async (
        query: string,
        target: CommentTarget | null,
        signal?: AbortSignal,
    ): Promise<Mentionables> => {
        const res = await api.get(`${BASE}mentionables/`, {
            params: { q: query, ...(target ? { target: targetParam(target) } : {}) },
            signal,
        })
        return mentionablesSchema.parse(res.data)
    },
}
