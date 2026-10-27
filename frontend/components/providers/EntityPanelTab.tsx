"use client"

import type { ReactNode } from "react"
import { PersistentPanelContext } from "@/components/shared"
import { useEntityPanelTab, type UseEntityPanelTabOptions } from "@/hooks/useEntityPanelTab"

interface EntityPanelTabProps extends UseEntityPanelTabOptions {
    /** Renderiza el drawer de la página con el `open` ya resuelto por la pestaña. */
    children: (open: boolean) => ReactNode
}

/**
 * Pone el drawer de una entidad en la barra de pestañas y a tamaño completo (ADR-0101 §10):
 *
 * ```tsx
 * <EntityPanelTab label="contacts.contact" id={selected?.id ?? null} open={drawerOpen} onClose={clearSelection}>
 *   {(open) => <ContactDrawer open={open} … />}
 * </EntityPanelTab>
 * ```
 */
export function EntityPanelTab({ children, ...options }: EntityPanelTabProps) {
    const visible = useEntityPanelTab(options)
    return <PersistentPanelContext.Provider value={true}>{children(visible)}</PersistentPanelContext.Provider>
}
