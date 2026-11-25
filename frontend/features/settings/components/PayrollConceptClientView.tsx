"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { EntityPanelTab } from "@/components/providers"
import { ActionConfirmModal, ToolbarCreateButton } from "@/components/shared"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { useHrSettings } from "@/features/hr"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import type { PayrollConcept } from "@/types/hr"
import { payrollConceptEntity, payrollConceptViews } from "../entity-view/payrollConcept.entity"
import { payrollConceptActions, type PayrollConceptActionsCtx } from "./payrollConceptActions"
import { PayrollConceptDrawer } from "./PayrollConceptDrawer"

/** Catálogo de conceptos de nómina (/hr/settings/concepts): tabla/tarjetas, buscador y drawer de mantenimiento. */
export function PayrollConceptClientView() {
    const { concepts, isLoading, refetch, deleteConcept } = useHrSettings()
    const query = useCollectionQuery(payrollConceptEntity, { sorting: "client" })
    const { search, groupBy } = query
    const { filterFn } = search
    const rows = useMemo(() => filterFn(concepts), [filterFn, concepts])
    const { view, onViewChange } = useCollectionViewMode("hr.payrollconcept")
    const collection = useEntityCollection(
        payrollConceptEntity,
        { rows, isLoading, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "none" }, sorting: query.sorting, groupBy },
    )
    const [editing, setEditing] = useState<PayrollConcept | null>(null)
    const [creating, setCreating] = useState(false)

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteConcept(id)
            toast.success("Concepto eliminado")
        } catch {
            toast.error("Error al eliminar concepto")
        }
    })

    const ctx: PayrollConceptActionsCtx = {
        onEdit: (concept) => setEditing(concept),
        onDelete: (id) => deleteConfirm.requestConfirm(id),
    }
    const createAction = <ToolbarCreateButton label="Nuevo Concepto" onClick={() => setCreating(true)} />

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                label="Conceptos de nómina"
                view={view}
                onViewChange={onViewChange}
                onOpen={(concept) => setEditing(concept)}
                actions={payrollConceptActions.forCollection(ctx)}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={payrollConceptViews.table}
                    card={payrollConceptViews.card}
                    emptyTitle="Sin conceptos"
                    emptyDescription="Cree el primer concepto de nómina."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="hr.payrollconcept" id={null} open={creating} onClose={() => setCreating(false)}>
                {(open) => (
                    <PayrollConceptDrawer open={open} onOpenChange={(o) => { if (!o) setCreating(false) }} concept={null} onSuccess={() => { setCreating(false); refetch() }} />
                )}
            </EntityPanelTab>
            <EntityPanelTab label="hr.payrollconcept" id={editing?.id ?? null} open={!!editing} onClose={() => setEditing(null)}>
                {(open) => (
                    <PayrollConceptDrawer open={open} onOpenChange={(o) => { if (!o) setEditing(null) }} concept={editing} onSuccess={() => { setEditing(null); refetch() }} />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(o) => { if (!o) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Concepto"
                description="¿Está seguro de que desea eliminar este concepto de nómina? Esta acción no se puede deshacer."
                variant="destructive"
                confirmText="Eliminar"
            />
        </div>
    )
}
