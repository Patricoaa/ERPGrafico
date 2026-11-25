"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import React, { useMemo, useState } from "react"

import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { ActionConfirmModal, ToolbarCreateButton } from "@/components/shared"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { PaymentModal } from "@/features/treasury"
import type { EmployeeMovement } from "@/types/hr"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { employeeMovementEntity, employeeMovementViews } from "../entity-view/employeeMovement.entity"
import { employeeMovementActions, type EmployeeMovementActionsCtx } from "../employeeMovementActions"
import { useEmployeeMovements } from "../hooks/useEmployeeMovements"
import { useEmployeeMovementMutations } from "../hooks/useEmployeeMovementMutations"
import { useEmployees } from "../hooks/useEmployees"
import { EmployeeMovementDrawer } from "./EmployeeMovementDrawer"

interface EmployeeMovementClientViewProps {
    initialMovements?: EmployeeMovement[]
}

export function EmployeeMovementClientView({ initialMovements }: EmployeeMovementClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nuevo movimiento" href="/hr/movements?modal=new" />
    const query = useCollectionQuery(employeeMovementEntity, { sorting: "client" })
    const { search } = query
    const { movements, isLoading: loading, isRefetching, isError, refetch } = useEmployeeMovements(query.params, initialMovements)
    const { filterFn } = search
    const rows = useMemo(() => filterFn(movements), [filterFn, movements])
    const { view, onViewChange } = useCollectionViewMode("hr.employeemovement")
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        employeeMovementEntity,
        { rows, isLoading: loading, isRefetching, error: isError && movements.length === 0, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "client", pageSize: 20 }, sorting: query.sorting },
    )
    const { employees } = useEmployees()

    const panel = useCreatePanelRoute({ resolved: false })
    const { openEntity } = useGlobalModals()
    // ADR-0152: cada registro abre su propia pestaña; `?selected` solo es enlace profundo.
    useDeepLinkEntity("hr.employeemovement")

    const [paymentModalOpen, setPaymentModalOpen] = useState(false)
    const [draftPayload, setDraftPayload] = useState<Record<string, unknown> | null>(null)
    const [toDelete, setToDelete] = useState<EmployeeMovement | null>(null)
    const [toAnnul, setToAnnul] = useState<EmployeeMovement | null>(null)
    const { createMovement, deleteMovement, annulMovement } = useEmployeeMovementMutations()

    const actionsCtx: EmployeeMovementActionsCtx = {
        onEdit: (movement) => openEntity("hr.employeemovement", movement.id, movement),
        onDelete: setToDelete,
        onAnnul: setToAnnul,
    }
    const draftAmount = draftPayload ? parseFloat(String(draftPayload.amount)) : 0

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                actions={employeeMovementActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={employeeMovementViews.table}
                    card={employeeMovementViews.card}
                    emptyTitle="Aún no hay movimientos"
                    emptyDescription="Registre anticipos y préstamos para descontarlos en la liquidación."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="hr.employeemovement" {...panel.tab}>
                {(open) => (
                    <EmployeeMovementDrawer
                        open={open}
                        onOpenChange={(o) => { if (!o) panel.close() }}
                        movement={null}
                        employees={employees}
                        onSaved={(payload) => {
                            // Esta pestaña solo crea (editar abre la pestaña del movimiento por `openEntity`).
                            setDraftPayload(payload ?? null)
                            panel.close()
                            setPaymentModalOpen(true)
                        }}
                    />
                )}
            </EntityPanelTab>

            <PaymentModal
                open={paymentModalOpen}
                onOpenChange={setPaymentModalOpen}
                title="Registrar desembolso"
                total={draftAmount}
                pendingAmount={draftAmount}
                isPurchase={true}
                hideDteFields={true}
                onConfirm={async (paymentData) => {
                    try {
                        await createMovement({
                            id: null,
                            payload: {
                                ...draftPayload,
                                ...paymentData,
                                amount: String(draftPayload?.amount ?? paymentData.amount),
                                date: String(paymentData.documentDate || draftPayload?.date),
                            },
                        })
                        setPaymentModalOpen(false)
                        setDraftPayload(null)
                    } catch (e: unknown) {
                        toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al registrar el movimiento")
                    }
                }}
            />

            <ActionConfirmModal
                open={!!toDelete}
                onOpenChange={(o) => { if (!o) setToDelete(null) }}
                title="Eliminar movimiento"
                description="El movimiento no tiene desembolso registrado. ¿Eliminarlo? Esta acción no se puede deshacer."
                variant="destructive"
                confirmText="Eliminar"
                onConfirm={async () => {
                    if (!toDelete) return
                    try {
                        await deleteMovement(toDelete.id)
                        setToDelete(null)
                    } catch (e: unknown) {
                        showApiError(e, "Error al eliminar el movimiento")
                    }
                }}
            />

            <ActionConfirmModal
                open={!!toAnnul}
                onOpenChange={(o) => { if (!o) setToAnnul(null) }}
                title="Anular movimiento"
                description="Se anulará el desembolso en tesorería con su asiento de reversa. Para corregir un monto, anule y registre uno nuevo."
                variant="destructive"
                confirmText="Anular"
                requireReason
                onConfirm={async (reason) => {
                    if (!toAnnul || !reason) return
                    try {
                        await annulMovement({ id: toAnnul.id, reason })
                        setToAnnul(null)
                    } catch (e: unknown) {
                        showApiError(e, "Error al anular el movimiento")
                    }
                }}
            />
        </div>
    )
}
