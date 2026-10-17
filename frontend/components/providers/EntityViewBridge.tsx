"use client"

import * as React from "react"
import { EntityViewProvider, type EntityOpener } from "./EntityOpenerContext"
import { getEntityMetadata } from "@/lib/entity-registry"

/**
 * Connects the entity-view system to the app shell (ADR-0087 §4): a collection's default action
 * opens the row through `openEntity` (drawer registry, ADR-0028/0086) and its accessible name comes
 * from the registry title. Rendered by `GlobalModalProvider` around both the page and the drawer
 * host, so collections inside entity drawers can open their rows too.
 */
export function EntityViewBridge({ openEntity, children }: { openEntity: (label: string, id: number, data?: unknown) => void; children: React.ReactNode }) {
    const opener = React.useMemo<EntityOpener>(
        () => ({
            open: (label, id, row) => openEntity(label, id, row),
            labelOf: (label) => getEntityMetadata(label)?.titlePlural,
        }),
        [openEntity],
    )
    return <EntityViewProvider opener={opener}>{children}</EntityViewProvider>
}
