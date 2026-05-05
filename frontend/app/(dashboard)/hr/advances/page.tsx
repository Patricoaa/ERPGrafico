"use client"

import React, { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { AdvanceFormModal } from "@/features/hr"
import { getAdvances, createAdvance, updateAdvance, deleteAdvance, getEmployees, getPayrolls } from '@/features/hr/api/hrApi'
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { PaymentModal } from "@/features/treasury"
import type { SalaryAdvance, Employee, Payroll } from "@/types/hr"


import {
    Plus, Pencil, Trash2
} from "lucide-react"

import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ColumnDef } from "@tanstack/react-table"
import { useSearchParams } from "next/navigation"

import { ToolbarCreateButton } from "@/components/shared"

// Advance schemas and types moved to features/hr/components/AdvanceFormDialog

export default function AdvancesPage() {
    const createAction = <ToolbarCreateButton label="Nuevo Anticipo" href="/hr/advances?modal=new" />
    const searchParams = useSearchParams()
    const [advances, setAdvances] = useState<SalaryAdvance[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [payrolls, setPayrolls] = useState<Payroll[]>([])
    const [loading, setLoading] = useState(true)

    // Dialog state synchronized with URL or local edit
    const isNewModalOpen = searchParams.get("modal") === "new"
    const [editingAdvance, setEditingAdvance] = useState<SalaryAdvance | null>(null)
    const dialogOpen = isNewModalOpen || !!editingAdvance

    const [paymentModalOpen, setPaymentModalOpen] = useState(false)
    const [tempAdvanceData, setTempAdvanceData] = useState<Record<string, unknown> | null>(null)

    const setDialogOpen = (open: boolean) => {
        if (!open) {
            setEditingAdvance(null)
            if (isNewModalOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                window.history.replaceState(null, "", `?${params.toString()}`)
            }
        }
    }

    const fetchAll = useCallback(async () => {
        try {
            const [adv, emps, pays] = await Promise.all([
                getAdvances(),
                getEmployees(),
                getPayrolls() // Fetch all payrolls to support drafts
            ])
            setAdvances(adv)
            setEmployees(emps)
            setPayrolls(pays)
        } catch {
            toast.error("Error al cargar anticipos")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const handleDelete = async (id: number) => {
        try {
            await deleteAdvance(id)
            toast.success("Anticipo eliminado")
            fetchAll()
        } catch {
            toast.error("Error al eliminar anticipo")
        }
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
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge
                        status={row.original.is_discounted ? "DISCOUNTED" : "PENDING"}
                        label={row.original.is_discounted ? "Descontado" : "Pendiente"}
                    />
                </div>
            )
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
        createActionsColumn<SalaryAdvance>({
            renderActions: (advance) => (
                <>
                    {!advance.is_discounted && (
                        <DataCell.Action
                            icon={Pencil}
                            title="Editar"
                            onClick={() => { setEditingAdvance(advance); setDialogOpen(true) }}
                        />
                    )}
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                            if (confirm("¿Eliminar anticipo? Esta acción no se puede deshacer.")) {
                                handleDelete(advance.id)
                            }
                        }}
                    />
                </>
            )
        })
    ]

    return (
        <div className="space-y-4">

            {loading ? (
                <TableSkeleton columns={5} rows={10} />
            ) : (
                <DataTable
                    columns={columns}
                    data={advances}
                    cardMode
                    filterColumn="employee_name"
                    defaultPageSize={20}
                    useAdvancedFilter={true}
                    createAction={createAction}
                />
            )}

            <AdvanceFormModal
                open={dialogOpen}
                onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingAdvance(null) }}
                advance={editingAdvance}
                employees={employees}
                payrolls={payrolls}
                onSaved={(data) => {
                    if (editingAdvance) {
                        fetchAll()
                        setDialogOpen(false)
                        setEditingAdvance(null)
                    } else {
                        setTempAdvanceData(data || null)
                        setDialogOpen(false)
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
                        fetchAll()
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

