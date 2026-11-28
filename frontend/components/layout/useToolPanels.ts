"use client"

import { useCallback, useState } from "react"
import type { ToolPanel } from "./ToolRail"

/** Panel abierto desde el riel: uno a la vez; clic en el activo lo cierra. */
export function useToolPanels() {
    const [activePanel, setActivePanel] = useState<ToolPanel | null>(null)
    // La calculadora conserva lo cargado: una vez abierta, el shell la deja montada.
    const [hasOpenedCalculator, setHasOpenedCalculator] = useState(false)

    const togglePanel = useCallback((panel: ToolPanel) => {
        if (panel === "calculator") setHasOpenedCalculator(true)
        setActivePanel(current => (current === panel ? null : panel))
    }, [])

    const closePanel = useCallback(() => setActivePanel(null), [])

    // Los diálogos (buscador, configuración) viven en z 50: abrir uno cierra el overlay del riel (z 110)
    const [isSearchOpen, setIsSearchOpenState] = useState(false)
    const setSearchOpen = useCallback((open: boolean) => {
        if (open) setActivePanel(null)
        setIsSearchOpenState(open)
    }, [])

    return { activePanel, hasOpenedCalculator, togglePanel, closePanel, isSearchOpen, setSearchOpen }
}
