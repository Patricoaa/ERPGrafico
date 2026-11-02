import { z } from "zod"

/** Espejo de workflow/comments/serializers.py (ADR-0111). */

export const mentionKindSchema = z.enum(["user", "team"])

export const commentMentionSchema = z.object({
    kind: mentionKindSchema,
    id: z.number(),
    name: z.string(),
})

export const commentAuthorSchema = z.object({
    id: z.number(),
    name: z.string(),
})

export const commentAttachmentSchema = z.object({
    id: z.number(),
    name: z.string(),
    size: z.number(),
    mime_type: z.string().nullable(),
})

export const commentSchema = z.object({
    id: z.number(),
    parent_id: z.number().nullable(),
    author: commentAuthorSchema.nullable(),
    text: z.string(),
    mentions: z.array(commentMentionSchema),
    attachments: z.array(commentAttachmentSchema),
    created_at: z.string(),
    edited_at: z.string().nullable(),
    is_deleted: z.boolean(),
    can_edit: z.boolean(),
    can_delete: z.boolean(),
})

export const commentThreadSchema = commentSchema.extend({
    replies: z.array(commentSchema),
})

export const mentionableUserSchema = z.object({
    id: z.number(),
    name: z.string(),
    username: z.string(),
    /** null cuando la búsqueda no se hizo contra una entidad. */
    has_access: z.boolean().nullable(),
})

export const mentionableTeamSchema = z.object({
    id: z.number(),
    name: z.string(),
    member_count: z.number(),
})

export const mentionablesSchema = z.object({
    users: z.array(mentionableUserSchema),
    teams: z.array(mentionableTeamSchema),
})

export const COMMENT_MAX_LENGTH = 5000
/** Espejo de MAX_ATTACHMENTS y validate_file_size / validate_file_extension del backend. */
export const COMMENT_MAX_FILES = 5
export const COMMENT_MAX_FILE_BYTES = 10 * 1024 * 1024
export const COMMENT_FILE_EXTENSIONS = [
    ".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".xls", ".xlsx", ".csv", ".zip", ".rar",
] as const

const fileSchema = z
    .custom<File>(value => typeof File !== "undefined" && value instanceof File, "Archivo inválido")
    .refine(file => file.size <= COMMENT_MAX_FILE_BYTES, "Cada archivo debe pesar 10 MB o menos")
    .refine(
        file => COMMENT_FILE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext)),
        "Tipo de archivo no permitido",
    )

export const commentFormSchema = z
    .object({
        text: z.string().trim().max(COMMENT_MAX_LENGTH, `Máximo ${COMMENT_MAX_LENGTH} caracteres`),
        files: z.array(fileSchema).max(COMMENT_MAX_FILES, `Máximo ${COMMENT_MAX_FILES} archivos`),
    })
    // Un comentario solo con adjuntos es válido (ADR-0111).
    .refine(values => values.text.length > 0 || values.files.length > 0, {
        message: "Escribe un comentario o adjunta un archivo",
        path: ["text"],
    })
