"use client"

import { EntityPanelTab } from "@/components/providers"
import { useMemo } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { usePosTerminals } from "@/features/sales"
import type { Terminal } from "@/features/treasury"
import { posTerminalActions, type PosTerminalActionsCtx } from "@/features/sales/posTerminalActions"
import { terminalPosUnifiedSearchDef } from "@/features/pos/unifiedSearchDef"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { posTerminalEntity, posTerminalViews } from "../entity-view/posTerminal.entity"
import { PosTerminalDrawer } from "./PosTerminalDrawer"

interface PosTerminalClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function PosTerminalClientView({ externalOpen, onExternalOpenChange, createAction }: PosTerminalClientViewProps) {
    const { terminals, toggleActive, deleteTerminal, refetch, isLoading, isError } = usePosTerminals()
    const search = useUnifiedSearch(terminalPosUnifiedSearchDef)
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    const panel = useEntityPanelRoute<Terminal>({ endpoint: '/treasury/pos-terminals', external: { open: externalOpen, onOpenChange: onExternalOpenChange } })
    const selectedFromUrl = panel.entity
    const { openSelected } = useEntityRouteActions()

    const handleToggleActive = async (terminal: Terminal) => {
        try {
            await toggleActive(terminal)
        } catch {
            // Error already handled by hook
        }
    }

    const deleteConfirm = useConfirmAction<Terminal>(async (terminal: Terminal) => {
        try {
            await deleteTerminal(terminal)
        } catch {
            // Error already handled by hook
        }
   })

    const handleDelete = (terminal: Terminal) => {
        deleteConfirm.requestConfirm(terminal)
    }

    const filteredTerminals = useMemo(() => {
        if (!search.filters.status) return terminals
        return terminals.filter(t =>
            search.filters.status === "ACTIVE" ? t.is_active : !t.is_active
        )
    }, [terminals, search.filters.status])

    const actionsCtx: PosTerminalActionsCtx = {
        onEdit: (terminal) => openSelected(terminal.id),
        onToggleActive: (terminal) => handleToggleActive(terminal),
        onDelete: (terminal) => handleDelete(terminal),
    }

    const { view, onViewChange } = useCollectionViewMode("treasury.terminal")
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        posTerminalEntity,
        { rows: filteredTerminals, isLoading, error: isError && terminals.length === 0, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "client", pageSize: 20 } },
    )
    const toolbarAction = createAction || (
        <Button onClick={() => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("modal", "new")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }} className="h-9">
            <Plus className="mr-2 h-4 w-4" /> Crear Punto de Venta
        </Button>
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(terminal) => openSelected(terminal.id)}
                actions={posTerminalActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={toolbarAction}>
                    <UnifiedSearchBar config={terminalPosUnifiedSearchDef} {...bindUnifiedSearch(search)} />
                </Collection.Toolbar>
                <Collection.View
                    table={posTerminalViews.table}
                    card={posTerminalViews.card}
                    emptyAction={toolbarAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="treasury.terminal" {...panel.tab}>
                {(open) => (
                    <PosTerminalDrawer
                        open={open}
                        onOpenChange={(open: boolean) => {
                            if (!open) panel.close()
                        }}
                        terminal={panel.isCreate ? null : selectedFromUrl}
                        onSuccess={() => { panel.close(); refetch() }}
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open: boolean) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Punto de Venta"
                description={`¿Está seguro de eliminar el punto de venta "${deleteConfirm.payload?.name || ''}"? Esta acción no se puede deshacer.`}
                variant="destructive"
            />
        </div>
    )
}

export default PosTerminalClientView
