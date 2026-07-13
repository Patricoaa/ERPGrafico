"use client"

import React, { useState, useMemo, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { toast } from "sonner"
import { CreatePayrollDrawer, PayrollDetailDrawer, deletePayroll, paySalary, payPrevired, createAdvance, triggerDraftPayrolls } from '@/features/hr'
import type { Payroll } from "@/types/hr"
import { type ColumnDef } from "@tanstack/react-table"
import { DataTableView, DataTableColumnHeader, DataCell, createCodeColumn, createStatusColumn, type ToolbarActionItem } from '@/components/shared'
import { FileText } from "lucide-react"
import { payrollActions, type PayrollActionsCtx } from '@/features/hr/payrollActions'
import { PaymentModal } from "@/features/treasury"
import { ToolbarCreateButton, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { usePayrolls } from "@/features/hr"
import { useServerDate } from "@/hooks/useServerDate"
import { payrollUnifiedSearchDef } from "@/features/hr/unifiedSearchDef"

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

    const [detailSheetOpen, setDetailSheetOpen] = useState(false)
    const [activePayrollId, setActivePayrollId] = useState<number | null>(null)
    const [prevSelectedFromUrl, setPrevSelectedFromUrl] = useState(selectedFromUrl)

    // Adjust state during render: sync URL-driven entity to local state
    if (selectedFromUrl && selectedFromUrl !== prevSelectedFromUrl) {
        setPrevSelectedFromUrl(selectedFromUrl)
        setActivePayrollId(selectedFromUrl.id)
        setDetailSheetOpen(true)
    }

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
        createCodeColumn<Payroll>("display_id", "Número"),
        {
            accessorFn: (row) => row.employee_name || "",
            id: "employee",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Empleado" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Text className="font-bold">{row.original.employee_name}</DataCell.Text></div>,
        },
        {
            accessorKey: "period_label",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Período" className="justify-center" />,
            cell: ({ row }) => <div className="text-sm text-muted-foreground text-center w-full">{row.getValue("period_label")}</div>,
        },
        {
            accessorKey: "total_haberes",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Haberes" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat(row.getValue("total_haberes"))} className="text-success font-medium" />
                </div>
            ),
        },
        {
            accessorKey: "legal_deductions_worker",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Desc. Legales" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat((row.original as Payroll & Record<string, string>).legal_deductions_worker || "0")} className="text-destructive text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "employer_contribution",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Aporte Patr." className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat((row.original as Payroll & Record<string, string>).employer_contribution || "0")} className="text-warning text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "other_deductions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Otros Desc." className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat((row.original as Payroll & Record<string, string>).other_deductions || "0")} className="text-muted-foreground text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "advances_total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Anticipos" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat((row.original as Payroll & Record<string, string>).advances_total || "0")} className="text-primary text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "net_salary",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Líquido" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat(row.getValue("net_salary"))} className="font-bold" />
                </div>
            ),
        },
        createStatusColumn<Payroll>("status", "Estado"),
        createStatusColumn<Payroll>("remuneration_paid_status", "Remuneración"),
        createStatusColumn<Payroll>("previred_paid_status", "Previred"),
        payrollActions.column(actionsCtx, "Acciones"),
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
                />
            </div>

            <PayrollDetailDrawer
                payrollId={activePayrollId}
                open={detailSheetOpen}
                onOpenChange={(open) => {
                    setDetailSheetOpen(open)
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
