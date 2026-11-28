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

    return { activePanel, hasOpenedCalculator, togglePanel, closePanel }
}
