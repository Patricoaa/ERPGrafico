"use client"

import React, { useMemo, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { AdvanceDrawer, createAdvance, deleteAdvance, useSalaryAdvances, salaryAdvanceActions, type SalaryAdvanceActionsCtx, useEmployees, usePayrolls } from "@/features/hr"
import { PaymentModal } from "@/features/treasury"
import { salaryAdvanceUnifiedSearchDef } from "@/features/hr/unifiedSearchDef"
import type { SalaryAdvance } from "@/types/hr"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { salaryAdvanceEntity, salaryAdvanceViews } from "../entity-view/salaryAdvance.entity"

interface SalaryAdvanceClientViewProps {
    initialAdvances?: SalaryAdvance[]
}

export function SalaryAdvanceClientView({ initialAdvances }: SalaryAdvanceClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nuevo Anticipo" href="/hr/advances?modal=new" />
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
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
    const { payrolls } = usePayrolls()

    const isNewModalOpen = searchParams.get("modal") === "new"
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<SalaryAdvance>({ endpoint: '/hr/advances' })
    const { openSelected } = useEntityRouteActions()
    const dialogOpen = isNewModalOpen || !!selectedFromUrl

    const [paymentModalOpen, setPaymentModalOpen] = useState(false)
    const [tempAdvanceData, setTempAdvanceData] = useState<Record<string, unknown> | null>(null)

    const handleClose = () => {
        clearSelection()
        if (isNewModalOpen) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const salaryAdvanceActionsCtx: SalaryAdvanceActionsCtx = {
        onEdit: (advance) => openSelected(advance.id),
        onDelete: async (id) => {
            try {
                await deleteAdvance(id)
                toast.success("Anticipo eliminado")
                refetchAdvances()
            } catch {
                toast.error("Error al eliminar anticipo")
            }
        },
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

            <AdvanceDrawer
                open={dialogOpen}
                onOpenChange={(o) => { if (!o) handleClose() }}
                advance={selectedFromUrl}
                employees={employees}
                payrolls={payrolls}
                onSaved={(data) => {
                    if (selectedFromUrl) {
                        refetchAdvances()
                        handleClose()
                    } else {
                        setTempAdvanceData(data || null)
                        handleClose()
                        setPaymentModalOpen(true)
                    }
                }}
            />

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
        </div>
    )
}
