"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { CreatePayrollDrawer, PayrollDetailDrawer, deletePayroll, paySalary, payPrevired, createAdvance } from '@/features/hr'
import type { Payroll } from "@/types/hr"
import { ColumnDef } from "@tanstack/react-table"
import { DataTableView, DataTableColumnHeader } from '@/components/shared'
import { createActionsColumn, DataCell } from '@/components/shared'
import { Eye, Trash2, Coins, CreditCard, Wallet, FileText } from "lucide-react"
import { PaymentModal } from "@/features/treasury"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { ToolbarCreateButton, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { usePayrolls, payrollSearchDef } from "@/features/hr"

interface PayrollsPageClientProps {
    initialPayrolls?: Payroll[]
}

export default function PayrollsPageClient({ initialPayrolls }: PayrollsPageClientProps) {
    const createAction = (
        <div className="flex items-center gap-2">
            <ToolbarCreateButton label="Generar Liquidaciones" href="/hr/payrolls?modal=new" />
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Link href="/hr/payrolls?action=generate_drafts" scroll={false}>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 p-0 bg-background hover:bg-muted"
                            >
                                <FileText className="h-4 w-4" />
                            </Button>
                        </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        Generar borradores
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { filters, isFiltered } = useSmartSearch(payrollSearchDef)
    const { payrolls, isLoading: loading, isRefetching, refetch: fetchPayrolls } = usePayrolls(filters, initialPayrolls)

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Payroll>({
        endpoint: '/hr/payrolls'
    })

    const [detailSheetOpen, setDetailSheetOpen] = useState(false)
    const [activePayrollId, setActivePayrollId] = useState<number | null>(null)

    useEffect(() => {
        if (selectedFromUrl) {
            setActivePayrollId(selectedFromUrl.id)
            setDetailSheetOpen(true)
        }
    }, [selectedFromUrl])

    const isNewModalOpen = searchParams.get("modal") === "new"
    const [dialogOpen, setDialogOpen] = useState(isNewModalOpen)

    useEffect(() => {
        setDialogOpen(isNewModalOpen)
    }, [isNewModalOpen])

    useEffect(() => {
        const action = searchParams.get("action")
        if (action === "generate_drafts") {
            const executeAction = async () => {
                if (confirm("¿Generar automáticamente liquidaciones borrador para todos los empleados activos este mes?")) {
                    try {
                        const { triggerDraftPayrolls } = await import('@/features/hr')
                        const res = await triggerDraftPayrolls()
                        toast.success(res.detail)
                        fetchPayrolls()
                    } catch {
                        toast.error("Error al iniciar tarea")
                    } finally {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete("action")
                        router.push(`?${params.toString()}`, { scroll: false })
                    }
                } else {
                    const params = new URLSearchParams(searchParams.toString())
                    params.delete("action")
                    router.push(`?${params.toString()}`, { scroll: false })
                }
            }
            executeAction()
        }
    }, [searchParams, router, fetchPayrolls])

    const handleOpenChange = (open: boolean) => {
        if (!open && isNewModalOpen) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.push(`?${params.toString()}`, { scroll: false })
        }
        setDialogOpen(open)
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
                    date: (data.documentDate as string) || new Date().toISOString().split('T')[0],
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

    const columns: ColumnDef<Payroll>[] = [
        {
            accessorKey: "display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Número" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Code>{row.getValue("display_id")}</DataCell.Code></div>,
        },
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
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) =>
                <DataCell.Status status={row.getValue("status") as string} />
        },
        {
            accessorKey: "remuneration_paid_status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Remuneración" className="justify-center" />,
            cell: ({ row }) =>
                <DataCell.Status status={(row.original as Payroll & Record<string, string>).remuneration_paid_status || ""} />
        },
        {
            accessorKey: "previred_paid_status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Previred" className="justify-center" />,
            cell: ({ row }) =>
                <DataCell.Status status={(row.original as Payroll & Record<string, string>).previred_paid_status || ""} />
        },
        createActionsColumn<Payroll>({
            headerLabel: "Acciones",
            renderActions: (p) => (
                <>
                    <DataCell.Action
                        icon={Eye}
                        title="Ver Detalle"
                        onClick={(e) => { e.stopPropagation(); openDetail(p.id) }}
                    />

                    {p.status === 'DRAFT' && (
                        <DataCell.Action
                            icon={Wallet}
                            title="Registrar Anticipo"
                            className="text-primary hover:text-primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPayroll(p);
                                setPaymentMode('ADVANCE');
                            }}
                        />
                    )}

                    {p.status === 'POSTED' && (p as Payroll & Record<string, string>).remuneration_paid_status !== 'PAID' && (
                        <DataCell.Action
                            icon={Coins}
                            title="Registrar Pago Sueldo"
                            className="text-success hover:text-success"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPayroll(p);
                                setPaymentMode('SALARY');
                            }}
                        />
                    )}

                    {p.status === 'POSTED' && (p as Payroll & Record<string, string>).previred_paid_status !== 'PAID' && (
                        <DataCell.Action
                            icon={CreditCard}
                            title="Pagar Previred"
                            className="text-warning hover:text-warning"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPayroll(p);
                                setPaymentMode('PREVIRED');
                            }}
                        />
                    )}

                    {p.status === 'DRAFT' && (
                        <DataCell.Action
                            icon={Trash2}
                            title="Eliminar borrador"
                            className="text-destructive hover:text-destructive"
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm("¿Eliminar borrador?")) {
                                    try {
                                        await deletePayroll(p.id);
                                        toast.success("Borrador eliminado");
                                        fetchPayrolls();
                                    } catch {
                                        toast.error("Error al eliminar");
                                    }
                                }
                            }}
                        />
                    )}
                </>
            )
        }),
    ]

    return (
        <div className="h-full flex flex-col">
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
                smartSearch={<SmartSearchBar searchDef={payrollSearchDef} placeholder="Buscar por empleado o período..." className="w-full" />}
                defaultPageSize={20}
                onRowClick={(row: Payroll) => openDetail(row.id)}
                createAction={createAction}
                isFiltered={isFiltered}
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
