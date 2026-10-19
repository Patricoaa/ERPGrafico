"use client"

import { useState, useEffect } from "react"
import { useDrawerMode } from "@/features/_shared/drawer/useDrawerMode"
import { JournalEntrySheet } from "./JournalEntrySheet"
import { JournalEntryFormDrawer } from "./JournalEntryFormDrawer"
import type { JournalEntryInitialData } from "@/types/forms"
import type { DrawerMode } from "@/features/_shared/drawer/types"
import { useJournalEntry } from "@/features/accounting/hooks/useJournalEntries"

/**
 * Wrapper fino para JournalEntryDrawer que delega a:
 * - JournalEntrySheet (modo view) — ficha documental canónica
 * - JournalEntryFormDrawer (modo create/edit) — formulario CRUD
 *
 * Mantiene compatibilidad con ENTITY_DRAWERS registry.
 */
export interface JournalEntryDrawerProps {
    auditSidebar?: React.ReactNode
    accounts?: Record<string, unknown>[]
    onSuccess?: () => void
    initialData?: JournalEntryInitialData
    triggerText?: string
    triggerVariant?: "default" | "circular"
    open?: boolean
    onOpenChange?: (open: boolean) => void
    inline?: boolean
    onLoadingChange?: (loading: boolean) => void
    mode?: DrawerMode
    journalEntryId?: number
}

export function JournalEntryDrawer({
    onSuccess,
    initialData,
    triggerText = "Nuevo Asiento",
    triggerVariant = "default",
    open: openProp,
    onOpenChange,
    inline = false,
    onLoadingChange,
    mode: modeProp,
    journalEntryId,
}: JournalEntryDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const entityId = (journalEntryId ?? initialData?.id) ?? null

    // Fetch entry data when we have an ID but no initialData (for ENTITY_DRAWERS)
    const { data: fetchedEntry, isLoading: isFetching } = useJournalEntry(
        entityId && !initialData ? entityId : undefined
    )

    // Derive mode using canonical hook
    const { mode, isView } = useDrawerMode({
        mode: modeProp,
        initialData: initialData ?? (fetchedEntry as JournalEntryInitialData | undefined),
    })

    // Sync loading state
    useEffect(() => {
        if (onLoadingChange) {
            onLoadingChange(isFetching)
        }
    }, [isFetching, onLoadingChange])

    // Show skeleton while fetching for view mode
    if (isView && entityId && isFetching) {
        return <JournalEntrySheet id={entityId} open={open} onOpenChange={setOpen} onActionSuccess={onSuccess} />
    }

    // Delegate based on mode
    if (isView) {
        return (
            <JournalEntrySheet
                id={entityId}
                open={open}
                onOpenChange={setOpen}
                onActionSuccess={onSuccess}
            />
        )
    }

    return (
        <JournalEntryFormDrawer
            onSuccess={onSuccess}
            initialData={initialData ?? (fetchedEntry as JournalEntryInitialData | undefined)}
            triggerText={triggerText}
            triggerVariant={triggerVariant}
            open={open}
            onOpenChange={setOpen}
            inline={inline}
            onLoadingChange={onLoadingChange}
            mode={mode}
            journalEntryId={journalEntryId}
        />
    )
}