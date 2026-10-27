"use client"

import { EntityPanelTab } from "@/components/providers"
import React, { useMemo, useState } from "react"

import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { ActionConfirmModal, ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { AdvanceDrawer, createAdvance, useSalaryAdvances, salaryAdvanceActions, type SalaryAdvanceActionsCtx, useEmployees } from "@/features/hr"
import { useAdvanceMutations } from "../hooks/useAdvanceMutations"
import { PaymentModal } from "@/features/treasury"
import { salaryAdvanceUnifiedSearchDef } from "@/features/hr/unifiedSearchDef"
import type { SalaryAdvance } from "@/types/hr"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { salaryAdvanceEntity, salaryAdvanceViews } from "../entity-view/salaryAdvance.entity"

interface SalaryAdvanceClientViewProps {
    initialAdvances?: SalaryAdvance[]
}

export function SalaryAdvanceClientView({ initialAdvances }: SalaryAdvanceClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nuevo Anticipo" href="/hr/advances?modal=new" />
    const search = useUnifiedSearch(salaryAdvanceUnifiedSearchDef)
    const { advances, isLoading: loading, isRefetching, isError, refetch: refetchAdvances } = useSalaryAdvances(search.filters, initialAdvances)
    const { filterFn } = search
    const rows = useMemo(() => filterFn(advances), [filterFn, advances])
    const { view, onViewChange } = useCollectionViewMode("hr.salaryadvance")
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        salaryAdvanceEntity,
        { rows, isLoading: loading, isRefetching, error: isError && advances.length === 0, refetch: refetchAdvances, isFiltered: search.isFiltered },
        { pagination: { mode: "client", pageSize: 20 }, defaultSort: salaryAdvanceViews.table.defaultSort },
    )
    const { employees } = useEmployees()

    const panel = useEntityPanelRoute<SalaryAdvance>({ endpoint: '/hr/advances' })
    const selectedFromUrl = panel.entity
    const { openSelected } = useEntityRouteActions()

    const [paymentModalOpen, setPaymentModalOpen] = useState(false)
    const [tempAdvanceData, setTempAdvanceData] = useState<Record<string, unknown> | null>(null)
    const [toDelete, setToDelete] = useState<SalaryAdvance | null>(null)
    const [toAnnul, setToAnnul] = useState<SalaryAdvance | null>(null)
    const { deleteAdvance, annulAdvance } = useAdvanceMutations()

    const salaryAdvanceActionsCtx: SalaryAdvanceActionsCtx = {
        onEdit: (advance) => openSelected(advance.id),
        onDelete: setToDelete,
        onAnnul: setToAnnul,
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(advance) => openSelected(advance.id)}
                actions={salaryAdvanceActions.forCollection(salaryAdvanceActionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={salaryAdvanceUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar anticipo..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={salaryAdvanceViews.table}
                    card={salaryAdvanceViews.card}
                    emptyTitle="Aún no hay anticipos"
                    emptyDescription="Registra anticipos de sueldo para descontarlos en la nómina."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="hr.salaryadvance" {...panel.tab}>
                {(open) => (
                    <AdvanceDrawer
                        open={open}
                        onOpenChange={(o) => { if (!o) panel.close() }}
                        advance={selectedFromUrl}
                        employees={employees}
                        onSaved={(data) => {
                            if (selectedFromUrl) {
                                refetchAdvances()
                                panel.close()
                            } else {
                                setTempAdvanceData(data || null)
                                panel.close()
                                setPaymentModalOpen(true)
                            }
                        }}
                    />
                )}
            </EntityPanelTab>

            <PaymentModal
                open={paymentModalOpen}
                onOpenChange={setPaymentModalOpen}
                title="Registrar Pago de Anticipo"
                total={tempAdvanceData ? parseFloat(String(tempAdvanceData.amount)) : 0}
                pendingAmount={tempAdvanceData ? parseFloat(String(tempAdvanceData.amount)) : 0}
                isPurchase={true}
                hideDteFields={true}
                onConfirm={async (paymentData) => {
                    try {
                        await createAdvance({
                            ...tempAdvanceData,
                            ...paymentData,
                            amount: String(paymentData.amount || tempAdvanceData?.amount),
                            date: String(paymentData.documentDate || tempAdvanceData?.date),
                        } as Parameters<typeof createAdvance>[0])
                        toast.success("Anticipo registrado y pago contabilizado")
                        refetchAdvances()
                        setPaymentModalOpen(false)
                        setTempAdvanceData(null)
                    } catch (e: unknown) {
                        toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al registrar anticipo")
                    }
                }}
            />

            <ActionConfirmModal
                open={!!toDelete}
                onOpenChange={(o) => { if (!o) setToDelete(null) }}
                title="Eliminar anticipo"
                description="El anticipo no tiene pago registrado. ¿Eliminarlo? Esta acción no se puede deshacer."
                variant="destructive"
                confirmText="Eliminar"
                onConfirm={async () => {
                    if (!toDelete) return
                    try {
                        await deleteAdvance(toDelete.id)
                        setToDelete(null)
                    } catch (e: unknown) {
                        showApiError(e, "Error al eliminar anticipo")
                    }
                }}
            />

            <ActionConfirmModal
                open={!!toAnnul}
                onOpenChange={(o) => { if (!o) setToAnnul(null) }}
                title="Anular anticipo"
                description="Se anulará el pago del anticipo en tesorería con su asiento de reversa. Para corregir un monto, anule y registre un anticipo nuevo."
                variant="destructive"
                confirmText="Anular"
                requireReason
                onConfirm={async (reason) => {
                    if (!toAnnul || !reason) return
                    try {
                        await annulAdvance({ id: toAnnul.id, reason })
                        setToAnnul(null)
                    } catch (e: unknown) {
                        showApiError(e, "Error al anular anticipo")
                    }
                }}
            />
        </div>
    )
}
