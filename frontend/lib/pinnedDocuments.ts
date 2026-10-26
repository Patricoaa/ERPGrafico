"use client"

import { useSyncExternalStore } from "react"

/**
 * Documentos fijados del drill-down (ADR-0100 fase 5): atajos que sobreviven al cierre de la pila
 * y se muestran como chips en las migas. Por navegador (`localStorage`), máximo 5.
 */
export const PINNED_DOCUMENTS_STORAGE_KEY = "erp.pinnedDocuments"
export const MAX_PINNED_DOCUMENTS = 5

export interface PinnedDocument {
    label: string
    id: number
    display: string
}

const listeners = new Set<() => void>()
const EMPTY: readonly PinnedDocument[] = []
let cache: { raw: string | null; value: readonly PinnedDocument[] } = { raw: null, value: EMPTY }

function parse(raw: string | null): readonly PinnedDocument[] {
    if (!raw) return EMPTY
    try {
        const data: unknown = JSON.parse(raw)
        if (!Array.isArray(data)) return EMPTY
        return data.filter((item): item is PinnedDocument => (
            !!item && typeof item === "object"
            && typeof (item as PinnedDocument).label === "string"
            && Number.isSafeInteger((item as PinnedDocument).id)
            && typeof (item as PinnedDocument).display === "string"
        )).slice(0, MAX_PINNED_DOCUMENTS)
    } catch {
        return EMPTY
    }
}

function readRaw(): string | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage.getItem(PINNED_DOCUMENTS_STORAGE_KEY)
    } catch {
        return null
    }
}

/** Instantánea estable: misma referencia mientras el contenido guardado no cambie. */
export function getPinnedDocuments(): readonly PinnedDocument[] {
    const raw = readRaw()
    if (raw !== cache.raw) cache = { raw, value: parse(raw) }
    return cache.value
}

function write(next: readonly PinnedDocument[]) {
    try {
        window.localStorage.setItem(PINNED_DOCUMENTS_STORAGE_KEY, JSON.stringify(next))
    } catch {
        return // sin almacenamiento (modo privado): no se puede fijar
    }
    listeners.forEach((listener) => listener())
}

export const isPinned = (label: string, id: number) =>
    getPinnedDocuments().some((doc) => doc.label === label && doc.id === id)

/** Fija o suelta. Al llegar al tope reemplaza el más antiguo. */
export function togglePinnedDocument(doc: PinnedDocument): void {
    const current = getPinnedDocuments()
    if (current.some((d) => d.label === doc.label && d.id === doc.id)) {
        write(current.filter((d) => !(d.label === doc.label && d.id === doc.id)))
        return
    }
    write([...current, doc].slice(-MAX_PINNED_DOCUMENTS))
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    window.addEventListener("storage", listener)
    return () => {
        listeners.delete(listener)
        window.removeEventListener("storage", listener)
    }
}

export function usePinnedDocuments(): readonly PinnedDocument[] {
    return useSyncExternalStore(subscribe, getPinnedDocuments, () => EMPTY)
}
