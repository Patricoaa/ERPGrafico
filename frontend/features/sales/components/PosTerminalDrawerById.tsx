"use client"

import { usePosTerminals } from "../hooks/usePosTerminals"
import { PosTerminalDrawer } from "./PosTerminalDrawer"

interface PosTerminalDrawerByIdProps {
    id: number
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Abre la ficha de una Caja POS conociendo solo su id (relaciones documentales, EntityBadge):
 * el drawer necesita la caja completa, que se toma de la lista de cajas.
 */
export function PosTerminalDrawerById({ id, open, onOpenChange, onSuccess }: PosTerminalDrawerByIdProps) {
    const { terminals } = usePosTerminals()
    const terminal = terminals.find((t) => t.id === id) ?? null
    if (!terminal) return null
    return <PosTerminalDrawer open={open} onOpenChange={onOpenChange} terminal={terminal} onSuccess={onSuccess} />
}
