"use client"

import React, { useState, useMemo, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { toast } from "sonner"
import { CreatePayrollDrawer, PayrollDetailDrawer, deletePayroll, paySalary, payPrevired, createAdvance, triggerDraftPayrolls } from '@/features/hr'
import type { Payroll } from "@/types/hr"
import { type ColumnDef } from "@tanstack/react-table"
import { DataTableView, AutoEntityCard, type ToolbarActionItem } from '@/components/shared'
import { FileText } from "lucide-react"
import { payrollActions, type PayrollActionsCtx } from '@/features/hr/payrollActions'
import { PaymentModal } from "@/features/treasury"
import { ToolbarCreateButton, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { usePayrolls } from "@/features/hr"
import { useServerDate } from "@/hooks/useServerDate"
import { payrollUnifiedSearchDef } from "@/features/hr/unifiedSearchDef"
import { payrollFields } from '../payrollFields'

interface PayrollClientViewProps {
    initialPayrolls?: Payroll[]
}

export function PayrollClientView({ initialPayrolls }: PayrollClientViewProps) {
    const { dateString } = useServerDate()

    const createAction = <ToolbarCreateButton label="Generar Liquidaciones" href="/hr/payrolls?modal=new" />

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const search = useUnifiedSearch(payrollUnifiedSearchDef)
    const { payrolls, isLoading: loading, isRefetching, refetch: fetchPayrolls } = usePayrolls(search.filters, initialPayrolls)

    const handleGenerateDrafts = useCallback(async () => {
        if (!confirm("¿Generar automáticamente liquidaciones borrador para todos los empleados activos este mes?")) return
        try {
            const res = await triggerDraftPayrolls()
            toast.success(res.detail)
            fetchPayrolls()
        } catch (err) {
            console.error('[PayrollClientView] Error al generar borradores:', err)
            const apiMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            toast.error(apiMsg || "Error al iniciar tarea")
        }
    }, [fetchPayrolls])

    const toolbarActions: ToolbarActionItem[] = useMemo(() => [
        { key: 'generate_drafts', label: 'Generar borradores', icon: FileText, onClick: handleGenerateDrafts },
    ], [handleGenerateDrafts])

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Payroll>({
        endpoint: '/hr/payrolls'
    })

    const detailSheetOpen = !!selectedFromUrl
    const activePayrollId = selectedFromUrl?.id ?? null

    const isNewModalOpen = searchParams.get("modal") === "new"
    // Derive from URL directly — no useState + useEffect needed
    const dialogOpen = isNewModalOpen

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.push(`?${params.toString()}`, { scroll: false })
        }
    }

    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null)
    const [paymentMode, setPaymentMode] = useState<'SALARY' | 'PREVIRED' | 'ADVANCE' | null>(null)

    const openDetail = (id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleConfirmPayment = async (data: Record<string, unknown>) => {
        if (!selectedPayroll || !paymentMode) return

        try {
            if (paymentMode === 'SALARY') {
                await paySalary(selectedPayroll.id, data)
                toast.success("Pago de remuneración registrado")
            } else if (paymentMode === 'PREVIRED') {
                await payPrevired(selectedPayroll.id, data)
                toast.success("Pago Previred registrado")
            } else if (paymentMode === 'ADVANCE') {
                await createAdvance({
                    employee: selectedPayroll.employee,
                    payroll: selectedPayroll.id,
                    amount: data.amount as string,
                    date: (data.documentDate as string) || dateString,
                    notes: "Anticipo de sueldo",
                    ...data
                })
                toast.success("Anticipo registrado")
            }
            setPaymentMode(null)
            setSelectedPayroll(null)
            fetchPayrolls()
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al procesar")
        }
    }

    const actionsCtx: PayrollActionsCtx = {
        onViewDetail: openDetail,
        onRegisterAdvance: (p) => { setSelectedPayroll(p); setPaymentMode('ADVANCE') },
        onPaySalary: (p) => { setSelectedPayroll(p); setPaymentMode('SALARY') },
        onPayPrevired: (p) => { setSelectedPayroll(p); setPaymentMode('PREVIRED') },
        onDeleteDraft: async (id) => {
            if (confirm("¿Eliminar borrador?")) {
                try {
                    await deletePayroll(id);
                    toast.success("Borrador eliminado");
                    fetchPayrolls();
                } catch {
                    toast.error("Error al eliminar");
                }
            }
        },
    }

    const columns: ColumnDef<Payroll>[] = [
        ...payrollFields.toColumns(),
        payrollActions.auto(actionsCtx, "Acciones"),
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <CreatePayrollDrawer
                open={dialogOpen}
                onOpenChange={handleOpenChange}
                onSaved={(id) => { handleOpenChange(false); openDetail(id) }}
            />

            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={payrolls}
                    isLoading={loading}
                    isRefetching={isRefetching}
                    entityLabel="hr.payroll"
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={payrollUnifiedSearchDef}
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
                        placeholder="Buscar por empleado o período..."
                    />}
                    unifiedSearchConfig={payrollUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    defaultPageSize={20}
                    onRowClick={(row: Payroll) => openDetail(row.id)}
                    createAction={createAction}
                    toolbarActions={toolbarActions}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "finance",
                        title: "Aún no hay nóminas",
                        description: "Genera una nómina para liquidar los sueldos del período.",
                    }}
                    renderCard={(payroll: Payroll) => (
                        <AutoEntityCard
                            key={payroll.id}
                            data={payroll}
                            fields={payrollFields}

                            entityLabel="hr.payroll"

                            actions={payrollActions.render(payroll, actionsCtx)}
                            defaultAction={() => openDetail(payroll.id)}
                        />
                    )}
                />
            </div>

            <PayrollDetailDrawer
                payrollId={activePayrollId}
                open={detailSheetOpen}
                onOpenChange={(open) => {
                    if (!open) clearSelection()
                }}
                onUpdate={fetchPayrolls}
            />

            <PaymentModal
                open={!!paymentMode}
                onOpenChange={(o) => !o && setPaymentMode(null)}
                isPurchase={true}
                title={
                    paymentMode === 'SALARY' ? `Pagar Remuneración: ${selectedPayroll?.employee_name}` :
                        paymentMode === 'PREVIRED' ? `Pagar Previred: ${selectedPayroll?.employee_name}` :
                            `Registrar Anticipo: ${selectedPayroll?.employee_name}`
                }
                total={
                    paymentMode === 'SALARY' ? (selectedPayroll ? (Number((selectedPayroll as Payroll & Record<string, string>).net_salary) - Number((selectedPayroll as Payroll & Record<string, string>).advances_total || 0)) : 0) :
                        paymentMode === 'PREVIRED' ? Number((selectedPayroll as Payroll & Record<string, string>)?.total_previred || 0) :
                            Number((selectedPayroll as Payroll & Record<string, string>)?.net_salary || 0)
                }
                pendingAmount={
                    paymentMode === 'SALARY' ? (selectedPayroll ? (Number((selectedPayroll as Payroll & Record<string, string>).net_salary) - Number((selectedPayroll as Payroll & Record<string, string>).advances_total || 0)) : 0) :
                        paymentMode === 'PREVIRED' ? Number((selectedPayroll as Payroll & Record<string, string>)?.total_previred || 0) :
                            Number((selectedPayroll as Payroll & Record<string, string>)?.net_salary || 0)
                }
                onConfirm={handleConfirmPayment}
            />
        </div>
    )
}
