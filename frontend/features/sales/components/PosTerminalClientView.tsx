"use client"

import { useMemo } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { usePosTerminals } from "@/features/sales"
import type { Terminal } from "@/features/treasury"
import { Button } from "@/components/ui/button"

import { ActionConfirmModal, DataTableView, AutoEntityCard, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { posTerminalActions, type PosTerminalActionsCtx } from "@/features/sales/posTerminalActions"
import { terminalPosUnifiedSearchDef } from "@/features/pos/unifiedSearchDef"
import { type ColumnDef } from "@tanstack/react-table"
import { posTerminalFields } from "../posTerminalFields"
import { Plus } from "lucide-react"

import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { PosTerminalDrawer } from "./PosTerminalDrawer"

interface PosTerminalClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function PosTerminalClientView({ externalOpen, onExternalOpenChange, createAction }: PosTerminalClientViewProps) {
    const { terminals, toggleActive, deleteTerminal, refetch, isLoading } = usePosTerminals()
    const search = useUnifiedSearch(terminalPosUnifiedSearchDef)
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    const isCreateModal = searchParams.get("modal") === "new"
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Terminal>({ endpoint: '/treasury/pos-terminals' })
    const { openSelected } = useEntityRouteActions()
    const dialogOpen = isCreateModal || !!selectedFromUrl || !!externalOpen

    const handleCloseDialog = () => {
        clearSelection()
        onExternalOpenChange?.(false)
        if (searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

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

    const columns: ColumnDef<Terminal>[] = [
        ...posTerminalFields.toColumns(),
        posTerminalActions.auto(actionsCtx),
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.terminal"
                    columns={columns}
                    data={filteredTerminals}
                    isLoading={isLoading}
                    variant="embedded"
                    defaultPageSize={20}
                    unifiedSearch={<UnifiedSearchBar
                        config={terminalPosUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                    />}
                    unifiedSearchConfig={terminalPosUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    createAction={createAction || (
                        <Button onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set("modal", "new")
                            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
                        }} className="h-9">
                            <Plus className="mr-2 h-4 w-4" /> Crear Punto de Venta
                        </Button>
                    )}
                    renderCard={(terminal: Terminal) => (
                            <AutoEntityCard 
                                key={terminal.id} 
                                data={terminal}
                                fields={posTerminalFields}

                                entityLabel="sales.posterminal"
                                onClick={() => openSelected(terminal.id)} 
                                defaultAction={posTerminalActions.defaultAction(actionsCtx)?.(terminal) ?? null} 
                                className={!terminal.is_active ? "grayscale bg-muted/20" : ""}
                                actions={posTerminalActions.render(terminal, actionsCtx)}
                            />
                        )}
                />
            </div>

            <PosTerminalDrawer
                open={dialogOpen}
                onOpenChange={(open: boolean) => {
                    if (!open) handleCloseDialog()
                }}
                terminal={isCreateModal ? null : selectedFromUrl}
                onSuccess={() => { handleCloseDialog(); refetch() }}
            />

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
