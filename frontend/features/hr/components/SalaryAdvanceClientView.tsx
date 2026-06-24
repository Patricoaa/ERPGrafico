"use client"

import React, { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AdvanceDrawer } from "@/features/hr"
import { createAdvance, deleteAdvance, getEmployees, getPayrolls } from "@/features/hr"
import { PaymentModal } from "@/features/treasury"
import type { SalaryAdvance, Employee, Payroll } from "@/types/hr"
import { DataTableView, DataTableColumnHeader } from '@/components/shared'
import { DataCell, EntityCard } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"

import { ToolbarCreateButton, SegmentationBar, useSegmentation, SmartSearchBar, useClientSearch } from "@/components/shared"
import { useSalaryAdvances, salaryAdvanceActions, type SalaryAdvanceActionsCtx } from "@/features/hr"
import { salaryAdvanceSegDef } from "../segmentationDef"
import { salaryAdvanceSearchDef } from "../searchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

interface SalaryAdvanceClientViewProps {
    initialAdvances?: SalaryAdvance[]
}

export function SalaryAdvanceClientView({ initialAdvances }: SalaryAdvanceClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nuevo Anticipo" href="/hr/advances?modal=new" />
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { filterFn: filterAdvances, isFiltered: isTextFiltered, clearAll: clearText } = useClientSearch<SalaryAdvance>(salaryAdvanceSearchDef)
    const basePeriod = { serverParamFrom: 'date_from', serverParamTo: 'date_to' }
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(salaryAdvanceSegDef, basePeriod)
    const isFiltered = isTextFiltered || isSegFiltered
    const { advances, isLoading: loading, isRefetching, refetch: refetchAdvances } = useSalaryAdvances(segFilters, initialAdvances)
    const filteredAdvances = filterAdvances(advances)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [payrolls, setPayrolls] = useState<Payroll[]>([])

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

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const [emps, pays] = await Promise.all([getEmployees(), getPayrolls()])
                if (!cancelled) {
                    setEmployees(emps)
                    setPayrolls(pays)
                }
            } catch {
                if (!cancelled) toast.error("Error al cargar datos")
            }
        })()
        return () => { cancelled = true }
    }, [])

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
        {
            accessorKey: "employee_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Empleado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center justify-center w-full">
                    <DataCell.Text className="font-bold">{row.original.employee_name}</DataCell.Text>
                    <DataCell.Secondary>{row.original.employee_display_id}</DataCell.Secondary>
                </div>
            )
        },
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.original.date} />
                </div>
            )
        },
        {
            accessorKey: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat(row.original.amount)} className="text-warning font-bold" />
                </div>
            )
        },
        {
            accessorKey: "is_discounted",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) =>
                <DataCell.Status
                    status={row.original.is_discounted ? "DISCOUNTED" : "PENDING"}
                    label={row.original.is_discounted ? "Descontado" : "Pendiente"}
                />,
        },
        {
            accessorKey: "payroll_display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Liquidación" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    {row.original.payroll_display_id
                        ? <DataCell.Code>{row.original.payroll_display_id}</DataCell.Code>
                        : <span className="text-xs text-muted-foreground italic">—</span>
                    }
                </div>
            )
        },
        salaryAdvanceActions.column(salaryAdvanceActionsCtx)
    ]

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={filteredAdvances}
                    isLoading={loading}
                    isRefetching={isRefetching}
                    entityLabel="hr.salaryadvance"
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={salaryAdvanceSearchDef} placeholder="Buscar anticipo..." className="w-full" />}
                    segmentation={<SegmentationBar def={salaryAdvanceSegDef} basePeriod={basePeriod} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    defaultPageSize={20}
                    createAction={createAction}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "finance",
                        title: "Aún no hay anticipos",
                        description: "Registra anticipos de sueldo para descontarlos en la nómina.",
                    }}
                    cardGroupBy={{ field: 'date', sort: 'desc', aggregators: [{ key: 'total', label: 'Total', field: 'amount', fn: 'sum', format: 'money' }, { key: 'count', label: 'Items', fn: 'count', format: 'integer' }] }}
                    renderCard={(advance) => (
                        <EntityCard key={advance.id} onClick={() => openSelected(advance.id)}>
                            <EntityCard.Header
                                title={advance.employee_name || '---'}
                                subtitle={`Anticipo ${advance.employee_display_id || ''}`}
                                trailing={
                                    <DataCell.Status
                                        status={advance.is_discounted ? "DISCOUNTED" : "PENDING"}
                                        label={advance.is_discounted ? "Descontado" : "Pendiente"}
                                    />
                                }
                            />
                            <EntityCard.Body actions={salaryAdvanceActions.render(advance, salaryAdvanceActionsCtx)}>
                                <EntityCard.Field label="Fecha" value={<DataCell.Date value={advance.date} />} />
                                <EntityCard.Field label="Monto" value={<DataCell.Currency value={parseFloat(advance.amount)} className="text-warning font-bold" />} />
                            </EntityCard.Body>
                        </EntityCard>
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
