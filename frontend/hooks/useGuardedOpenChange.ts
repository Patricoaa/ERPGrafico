"use client"

import { useCallback } from "react"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"

/**
 * `onOpenChange` de un drawer montado por su página: el cierre iniciado por el usuario (X, Escape,
 * Cancelar) pasa por la guarda de cambios sin guardar. Los cierres tras guardar deben usar el
 * `onOpenChange` original, no este. Sin provider se comporta igual que el original.
 */
export function useGuardedOpenChange(onOpenChange: (open: boolean) => void): (open: boolean) => void {
    const modals = useOptionalGlobalModalActions()
    const runGuarded = modals?.runGuarded
    return useCallback((open: boolean) => {
        if (!open && runGuarded) runGuarded(() => onOpenChange(false))
        else onOpenChange(open)
    }, [runGuarded, onOpenChange])
}
