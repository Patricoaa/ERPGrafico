import type { CommentMention } from "../types"

/**
 * Las menciones viajan al backend como tokens `@[u:12]` / `@[g:3]`; en el textarea el
 * usuario ve `@Nombre`. Estas funciones convierten entre ambas representaciones.
 */

const TOKEN_RE = /@\[(u|g):(\d+)\]/g

const KIND_TO_TOKEN = { user: "u", team: "g" } as const
const TOKEN_TO_KIND = { u: "user", g: "team" } as const

export type MentionSegment =
    | { type: "text"; text: string }
    | { type: "mention"; kind: CommentMention["kind"]; id: number }

export function mentionToken(mention: Pick<CommentMention, "kind" | "id">): string {
    return `@[${KIND_TO_TOKEN[mention.kind]}:${mention.id}]`
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function displayPattern(name: string): RegExp {
    // `@Nombre` no seguido de letra/dígito, para no confundir "@Ana" con "@Anabel".
    return new RegExp(`@${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`, "gu")
}

/** `@Nombre` → token, solo para las menciones elegidas en el autocomplete. */
export function encodeMentions(text: string, mentions: CommentMention[]): string {
    const byLongestName = [...mentions].sort((a, b) => b.name.length - a.name.length)
    return byLongestName.reduce(
        (acc, mention) => acc.replace(displayPattern(mention.name), mentionToken(mention)),
        text,
    )
}

/** Token → `@Nombre` (para editar un comentario existente). */
export function decodeMentions(text: string, mentions: CommentMention[]): string {
    return text.replace(TOKEN_RE, (raw, kind: "u" | "g", id: string) => {
        const match = mentions.find(m => m.kind === TOKEN_TO_KIND[kind] && m.id === Number(id))
        return match ? `@${match.name}` : raw
    })
}

/** Menciones elegidas que siguen presentes en el texto. */
export function presentMentions(text: string, mentions: CommentMention[]): CommentMention[] {
    return mentions.filter(m => displayPattern(m.name).test(text))
}

export function splitMentions(text: string): MentionSegment[] {
    const segments: MentionSegment[] = []
    let last = 0
    for (const match of text.matchAll(TOKEN_RE)) {
        const index = match.index ?? 0
        if (index > last) segments.push({ type: "text", text: text.slice(last, index) })
        segments.push({
            type: "mention",
            kind: TOKEN_TO_KIND[match[1] as "u" | "g"],
            id: Number(match[2]),
        })
        last = index + match[0].length
    }
    if (last < text.length) segments.push({ type: "text", text: text.slice(last) })
    return segments
}

export interface ActiveMentionQuery {
    /** Posición del `@` en el texto. */
    start: number
    query: string
}

/** `@consulta` que el usuario está escribiendo justo antes del cursor, o null. */
export function activeMentionQuery(text: string, caret: number): ActiveMentionQuery | null {
    const before = text.slice(0, caret)
    const match = /(^|\s)@([\p{L}\p{N}_.-]{0,30})$/u.exec(before)
    if (!match) return null
    return { start: caret - match[2].length - 1, query: match[2] }
}

/** Reemplaza el `@consulta` activo por `@Nombre ` y devuelve el texto + nuevo cursor. */
export function insertMention(
    text: string,
    active: ActiveMentionQuery,
    name: string,
): { text: string; caret: number } {
    const end = active.start + 1 + active.query.length
    const inserted = `@${name} `
    return {
        text: text.slice(0, active.start) + inserted + text.slice(end),
        caret: active.start + inserted.length,
    }
}
