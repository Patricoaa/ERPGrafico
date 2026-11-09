"use client"

import { POSSessionSheet } from "./POSSessionSheet"

/**
 * Entrada del registro de entidades (`ENTITY_DRAWERS["treasury.possession"]`): delega en la
 * ficha documental `POSSessionSheet`, que es la única superficie de la sesión POS.
 */
export interface POSSessionDrawerProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function POSSessionDrawer({ id, open, onOpenChange }: POSSessionDrawerProps) {
    return (
        <POSSessionSheet
            id={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    )
}
