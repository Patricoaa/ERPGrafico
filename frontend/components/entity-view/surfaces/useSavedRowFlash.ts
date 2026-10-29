"use client"

import * as React from "react"
import { useRecentSave } from "./EntityViewProvider"

/** Lo que dura el resalte de la fila guardada antes de desvanecerse. */
const FLASH_MS = 2400
/** Tras crear, espera máxima a que la fila nueva llegue con el refetch de la lista. */
const PENDING_MS = 8000

/**
 * Id de la fila recién guardada desde una pestaña (ADR-0101), mientras dura su resalte; si no, null.
 *
 * Edición: la señal trae el id. Creación: el id no se conoce, así que mientras el panel de creación de
 * la entidad está abierto se guarda una foto de las filas, y tras guardar se resalta la fila que no estaba.
 */
export function useSavedRowFlash(label: string | undefined, rowIds: readonly string[]): string | null {
    const { saved, creating } = useRecentSave()
    const isCreating = label !== undefined && creating.includes(label)

    // Las señales anteriores al montaje no son de esta lista.
    const [handledAt, setHandledAt] = React.useState(() => saved?.at ?? 0)
    const [baseline, setBaseline] = React.useState<ReadonlySet<string> | null>(null)
    const [flashId, setFlashId] = React.useState<string | null>(null)

    const pending = saved !== null && saved.label === label && saved.at !== handledAt
    if (isCreating && baseline === null) setBaseline(new Set(rowIds))
    // Creación cancelada (el panel se cerró sin guardar): la foto ya no sirve. El guardado llega en el
    // mismo render que el cierre del panel, así que `pending` la conserva.
    else if (!isCreating && !pending && baseline !== null) setBaseline(null)

    if (pending) {
        if (saved.id !== null) {
            setFlashId(String(saved.id))
            setHandledAt(saved.at)
            setBaseline(null)
        } else if (baseline === null) {
            setHandledAt(saved.at)
        } else {
            const created = rowIds.find((id) => id !== "" && !baseline.has(id))
            if (created !== undefined) {
                setFlashId(created)
                setHandledAt(saved.at)
                setBaseline(null)
            }
        }
    }

    // La fila creada puede no llegar nunca (filtrada, en otra página): se deja de esperar.
    const waitingAt = pending && saved.id === null && baseline !== null ? saved.at : null
    React.useEffect(() => {
        if (waitingAt === null) return
        const timer = setTimeout(() => { setHandledAt(waitingAt); setBaseline(null) }, PENDING_MS)
        return () => clearTimeout(timer)
    }, [waitingAt])

    React.useEffect(() => {
        if (flashId === null) return
        const timer = setTimeout(() => setFlashId(null), FLASH_MS)
        return () => clearTimeout(timer)
    }, [flashId])

    return flashId
}
