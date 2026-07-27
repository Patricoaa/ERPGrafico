"use client"

import React, { useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AdvanceDrawer } from "@/features/hr"
import { createAdvance, deleteAdvance } from "@/features/hr"
import { PaymentModal } from "@/features/treasury"
import type { SalaryAdvance } from "@/types/hr"
import { DataTableView } from '@/components/shared'
import { AutoEntityCard } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"

import { ToolbarCreateButton, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { useSalaryAdvances, salaryAdvanceActions, type SalaryAdvanceActionsCtx, useEmployees, usePayrolls } from "@/features/hr"
import { salaryAdvanceUnifiedSearchDef } from "@/features/hr/unifiedSearchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { salaryAdvanceFields } from '../salaryAdvanceFields'

interface SalaryAdvanceClientViewProps {
    initialAdvances?: SalaryAdvance[]
}

export function SalaryAdvanceClientView({ initialAdvances }: SalaryAdvanceClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nuevo Anticipo" href="/hr/advances?modal=new" />
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const search = useUnifiedSearch(salaryAdvanceUnifiedSearchDef)
    const { advances, isLoading: loading, isRefetching, refetch: refetchAdvances } = useSalaryAdvances(search.filters, initialAdvances)
    const filteredAdvances = search.filterFn(advances)
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

    const columns: ColumnDef<SalaryAdvance>[] = [
        ...salaryAdvanceFields.toColumns(),
        salaryAdvanceActions.auto(salaryAdvanceActionsCtx)
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={filteredAdvances}
                    isLoading={loading}
                    isRefetching={isRefetching}
                    entityLabel="hr.salaryadvance"
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={salaryAdvanceUnifiedSearchDef}
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
                        placeholder="Buscar anticipo..."
                    />}
                    unifiedSearchConfig={salaryAdvanceUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    defaultPageSize={20}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "finance",
                        title: "Aún no hay anticipos",
                        description: "Registra anticipos de sueldo para descontarlos en la nómina.",
                    }}
                    cardGroupBy={{ field: 'date', sort: 'desc' }}
                    renderCard={(advance) => (
                        <AutoEntityCard
                            key={advance.id}
                            data={advance}
                            fields={salaryAdvanceFields}
                            entityLabel="hr.salaryadvance"
                            actions={salaryAdvanceActions.render(advance, salaryAdvanceActionsCtx)}
                            defaultAction={salaryAdvanceActions.defaultAction(salaryAdvanceActionsCtx)?.(advance) ?? (() => openSelected(advance.id))}

                        />
                    )}
                />
            </div>

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
