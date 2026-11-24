"use client"

import { useCallback, useEffect, useReducer, useState } from "react"
import { hasEntityDrawer } from "@/lib/entity-drawers"
import { useGlobalModalActions, type NoteTabState, type OpenEntityOptions } from "@/components/providers/GlobalModalProvider"
import {
    EMPTY_STACK,
    popEntry,
    pushEntry,
    setRootEntry,
    type StackEntry,
    type StackState,
} from "../utils/documentStack"

/** Etiqueta de la entrada de pila del asistente de NC/ND (no es una entidad del registro de drawers). */
export const POS_NOTE_WIZARD_LABEL = "billing.note-wizard"

/** Duración de la salida del drawer anidado (ver `--duration-pos-exit` en globals.css) + margen. */
export const POS_OVERLAY_EXIT_MS = 480

type StackAction =
    | { type: "push"; entry: Omit<StackEntry, "key"> }
    | { type: "pop" }
    | { type: "root"; entry: Omit<StackEntry, "key"> | null }
    | { type: "reset" }

function reducer(state: StackState, action: StackAction): StackState {
    switch (action.type) {
        case "push": return pushEntry(state, action.entry)
        case "pop": return popEntry(state)
        case "root": return setRootEntry(state, action.entry)
        case "reset": return EMPTY_STACK
    }
}

/**
 * Pila de navegación del panel de ventas del POS. `open` sustituye a `openEntity` dentro del ámbito
 * `EntityNavigationScope`, así los documentos enlazados se apilan aquí y no como pestañas globales.
 * Apilar, cambiar de fila y volver pasan por la guarda de cambios sin guardar del espacio de trabajo.
 * Cerrar un drawer anidado lo deja salir con animación (`closingKey`) antes de quitarlo de la pila.
 */
export type PosCloseMode = "pop" | "clear"

export function usePosDocumentStack() {
    const { runGuarded } = useGlobalModalActions()
    const [state, dispatch] = useReducer(reducer, EMPTY_STACK)
    const [closing, setClosing] = useState<{ key: string; mode: PosCloseMode } | null>(null)

    const open = useCallback((label: string, id: number, data?: unknown, options?: OpenEntityOptions) => {
        if (!hasEntityDrawer(label)) {
            console.warn(`[PosDocumentStack] No drawer registered for entity "${label}".`)
            return
        }
        runGuarded(() => dispatch({ type: "push", entry: { label, id, data, display: options?.display } }))
    }, [runGuarded])

    /** Apila el asistente de NC/ND sobre la factura (`id` = factura origen; el tipo viaja en `data`). */
    const openNote = useCallback((note: NoteTabState) => {
        runGuarded(() => dispatch({
            type: "push",
            entry: { label: POS_NOTE_WIZARD_LABEL, id: note.invoiceId, data: { noteType: note.noteType }, display: note.noteType === "NOTA_CREDITO" ? "Nota de crédito" : "Nota de débito" },
        }))
    }, [runGuarded])

    const setRoot = useCallback(
        (entry: Omit<StackEntry, "key"> | null) => runGuarded(() => dispatch({ type: "root", entry })),
        [runGuarded],
    )

    /**
     * Cierra una entrada con su salida animada y después la quita: `pop` quita solo la cima (drawer
     * anidado); `clear` vacía la pila (documento del POS y «Volver a la lista»).
     */
    const closeEntry = useCallback(
        (key: string, mode: PosCloseMode) => runGuarded(() => setClosing({ key, mode })),
        [runGuarded],
    )

    /** «Volver» de una entrada en línea: la quita de inmediato (no hay animación de salida). */
    const back = useCallback(() => runGuarded(() => dispatch({ type: "pop" })), [runGuarded])

    useEffect(() => {
        if (closing === null) return
        const timer = setTimeout(() => {
            dispatch(closing.mode === "clear" ? { type: "root", entry: null } : { type: "pop" })
            setClosing(null)
        }, POS_OVERLAY_EXIT_MS)
        return () => clearTimeout(timer)
    }, [closing])

    const reset = useCallback(() => {
        setClosing(null)
        dispatch({ type: "reset" })
    }, [])

    return { state, open, openNote, setRoot, back, closeEntry, closingKey: closing?.key ?? null, reset }
}
