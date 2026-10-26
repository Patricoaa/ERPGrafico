"use client"

import { createContext, useContext } from "react"

/**
 * `true` dentro del panel de una pestaña de la barra de trabajo (ADR-0101): el `Drawer` no se cierra
 * con un clic fuera (riel, lista), solo con su X, Escape o la × de la pestaña. Cada `Drawer` lo
 * restablece a `false` para sus hijos, así un drawer anidado se comporta como siempre.
 */
export const PersistentPanelContext = createContext(false)

export const usePersistentPanel = () => useContext(PersistentPanelContext)
