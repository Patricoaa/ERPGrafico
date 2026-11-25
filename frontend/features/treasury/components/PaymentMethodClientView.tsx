"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import React, { useState } from "react"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { paymentMethodActions, type PaymentMethodActionsCtx } from './paymentMethodActions'
import { paymentMethodEntity, paymentMethodViews } from "../entity-view/paymentMethod.entity"
import { PaymentMethodModal } from "./PaymentMethodModal"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared"
import { usePaymentMethods } from "@/features/treasury/hooks/useMasterData"
import type { PaymentMethod } from "@/features/treasury/types"

// --- Payment Method Management ---

interface PaymentMethodClientViewProps {
    externalOpen?: boolean
    onOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function PaymentMethodClientView({ externalOpen, onOpenChange, createAction }: PaymentMethodClientViewProps) {
    const { methods, isLoading, isError, refetch, archiveMethod } = usePaymentMethods()
    const query = useCollectionQuery(paymentMethodEntity, { sorting: "client" })
    const { search } = query
    const [dialogOpen, setDialogOpen] = useState(false)
    const { openEntity } = useGlobalModals()

    const archiveConfirm = useConfirmAction<PaymentMethod>(async (method) => {
        try {
            await archiveMethod({ id: method.id, is_active: !method.is_active })
        } catch {
            // Error handled by hook
        }
    })

    // ADR-0152: cada método abre su ficha en una pestaña propia; esta pestaña de página solo crea.
    const openEdit = (method: PaymentMethod) => openEntity("treasury.paymentmethod", method.id, method)

    const closeDialog = () => {
        setDialogOpen(false)
        onOpenChange?.(false)
    }

    const paymentMethodActionsCtx: PaymentMethodActionsCtx = {
        onEdit: openEdit,
        onArchive: (method) => archiveConfirm.requestConfirm(method),
    }

    // Filtered here: "Disponible para" is two row flags, which `search.filterFn` cannot express.
    const { filters } = search
    const filteredMethods = React.useMemo(() => {
        const usage = filters.usage?.split(",") ?? []
        const name = filters.name?.toLowerCase()
        return methods.filter(m =>
            (!filters.method_type || m.method_type === filters.method_type) &&
            (!filters.is_active || String(m.is_active) === filters.is_active) &&
            (!usage.includes("sales") || m.allow_for_sales) &&
            (!usage.includes("purchases") || m.allow_for_purchases) &&
            (!name || m.name.toLowerCase().includes(name)),
        )
    }, [methods, filters])
    const { view, onViewChange } = useCollectionViewMode("treasury.paymentmethod")
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        paymentMethodEntity,
        { rows: filteredMethods, isLoading, error: isError && methods.length === 0, refetch, isFiltered: search.isFiltered },
        { sorting: query.sorting },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                actions={paymentMethodActions.forCollection(paymentMethodActionsCtx)}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={paymentMethodViews.table}
                    card={paymentMethodViews.card}
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="treasury.paymentmethod" id={null} open={dialogOpen || !!externalOpen} onClose={closeDialog}>
                {(open) => (
                    <PaymentMethodModal
                        open={open}
                        onOpenChange={(open: boolean) => { if (!open) closeDialog() }}
                        method={null}
                        onSuccess={() => {
                            closeDialog()
                            refetch()
                        }}
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={archiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) archiveConfirm.cancel() }}
                onConfirm={archiveConfirm.confirm}
                title={archiveConfirm.payload?.is_active ? "Archivar Método de Pago" : "Restaurar Método de Pago"}
                description={archiveConfirm.payload?.is_active
                    ? "¿Está seguro de archivar este método de pago? Dejará de estar disponible para nuevas operaciones. Puede restaurarlo más adelante."
                    : "¿Está seguro de restaurar este método de pago?"}
                variant={archiveConfirm.payload?.is_active ? "warning" : "default"}
                confirmText={archiveConfirm.payload?.is_active ? "Archivar" : "Restaurar"}
            />
        </div>
    )
}
