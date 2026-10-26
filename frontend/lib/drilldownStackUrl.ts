/**
 * Serialización de la pila de drill-down en la URL (`?stack=`, ADR-0100 fase 5).
 *
 * Formato: `label:id,label:id` — de la base al tope, ambos incluidos. Solo viaja con 2 o más
 * documentos; un único documento ya lo representa `?selected` o no tiene URL.
 */
export const STACK_PARAM = "stack"

/** Mismo tope que la pila en memoria (ADR-0080). */
export const MAX_STACK_REFS = 5

export interface StackRef {
    label: string
    id: number
}

const REF_PATTERN = /^([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+):(\d+)$/

export function encodeStack(refs: readonly StackRef[]): string {
    if (refs.length < 2) return ""
    return refs.map((ref) => `${ref.label}:${ref.id}`).join(",")
}

/** Descarta los tramos mal formados; no confía en la URL. */
export function decodeStack(raw: string | null | undefined): StackRef[] {
    if (!raw) return []
    const refs: StackRef[] = []
    for (const part of raw.split(",")) {
        const match = REF_PATTERN.exec(part)
        if (!match) continue
        const id = Number(match[2])
        if (!Number.isSafeInteger(id) || id <= 0) continue
        refs.push({ label: match[1], id })
    }
    return refs.slice(-MAX_STACK_REFS)
}
