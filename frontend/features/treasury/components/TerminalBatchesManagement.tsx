"use client"

import React, { useState, useEffect, lazy, Suspense, useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import { Plus, Building2 } from "lucide-react"
import { format } from "date-fns"
import { BaseModal } from "@/components/shared/BaseModal"
import { useTerminalBatches } from "@/features/treasury"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { FormSkeleton, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { terminalBatchSearchDef } from "@/features/treasury/searchDef"

// Lazy load feature components
const LazyTerminalBatchForm = lazy(() => import("./TerminalBatchForm"))
const MonthlyInvoiceModal = lazy(() => import("./MonthlyInvoiceModal"))

interface TerminalBatchesManagementProps {
    showTitle?: boolean
    externalOpenBatch?: boolean
    onExternalOpenBatchChange?: (open: boolean) => void
    externalOpenInvoice?: boolean
    onExternalOpenInvoiceChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function TerminalBatchesManagement({
    showTitle = true,
    externalOpenBatch,
    onExternalOpenBatchChange,
    externalOpenInvoice,
    onExternalOpenInvoiceChange,
    createAction
}: TerminalBatchesManagementProps) {
    const { filters } = useSmartSearch(terminalBatchSearchDef)
    const { batches, isLoading, refetch } = useTerminalBatches(filters)
    const [openCreate, setOpenCreate] = useState(false)
    const [openInvoice, setOpenInvoice] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        requestAnimationFrame(() => setIsMounted(true))
    }, [])

    useEffect(() => {
        if (isMounted && externalOpenBatch) {
            requestAnimationFrame(() => setOpenCreate(true))
        }
    }, [isMounted, externalOpenBatch])

    useEffect(() => {
        if (isMounted && externalOpenInvoice) {
            requestAnimationFrame(() => setOpenInvoice(true))
        }
    }, [isMounted, externalOpenInvoice])

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "sales_date",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Fecha Ventas" className="justify-center" />,
            cell: ({ row }: any) => (
                <div className="flex flex-col justify-center w-full items-center text-xs">
                    <DataCell.Date value={row.original.sales_date} />
                    {row.original.sales_date_end && row.original.sales_date_end !== row.original.sales_date && (
                        <span className="text-[10px] text-muted-foreground leading-none mt-1">
                            al {format(new Date(row.original.sales_date_end + "T12:00:00"), "dd/MM/yyyy")}
                        </span>
                    )}
                </div>
            )
        },
        {
            accessorKey: "provider_name",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Proveedor" className="justify-center" />,
            cell: ({ row }: any) => (
                <div className="flex flex-col items-center">
                    <span className="font-bold flex items-center justify-center gap-1.5 text-center w-full">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        {row.original.provider_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide text-center">
                        {row.original.payment_method_name} (Depósito)
                    </span>
                </div>
            )
        },
        {
            accessorKey: "net_amount",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Depósito Neto" className="justify-center" />,
            cell: ({ row }: any) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={row.getValue("net_amount")} />
                </div>
            )
        },
        {
            accessorKey: "commission_total",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Comisión (Total)" className="justify-center" />,
            cell: ({ row }: any) => {
                const amount = row.original.commission_total
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Currency 
                            value={amount ? -Math.abs(parseFloat(amount)) : 0} 
                        />
                    </div>
                )
            }
        },
        {
            accessorKey: "status",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }: any) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={row.original.status} />
                </div>
            ),
            meta: {
                title: "Estado"
            }
        },
        createActionsColumn<any>({
            renderActions: () => null // Vacío como en el original
        })
    ], [])

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={batches}
                isLoading={isLoading}
                variant="embedded"
                leftAction={<SmartSearchBar searchDef={terminalBatchSearchDef} placeholder="Filtrar liquidaciones..." className="w-80" />}
                createAction={createAction}
            />

            <Suspense fallback={<FormSkeleton />}>
                <TerminalBatchModal
                    open={openCreate}
                    onOpenChange={(open: boolean) => {
                        setOpenCreate(open)
                        if (!open) onExternalOpenBatchChange?.(false)
                    }}
                    onSuccess={() => {
                        setOpenCreate(false)
                        onExternalOpenBatchChange?.(false)
                        refetch()
                    }}
                />
            </Suspense>

            <Suspense fallback={<FormSkeleton />}>
                <MonthlyInvoiceModal
                    open={openInvoice}
                    onOpenChange={(open: boolean) => {
                        setOpenInvoice(open)
                        if (!open) onExternalOpenInvoiceChange?.(false)
                    }}
                />
            </Suspense>
        </div>
    )
}

function TerminalBatchModal({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={
                <div className="flex items-center gap-3">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                    <span>Registrar Liquidación de Terminal de Cobro</span>
                </div>
            }
            description="Ingrese los datos de la liquidación diaria informada por el proveedor del terminal de cobro."
        >
            <Suspense fallback={<FormSkeleton />}>
                <LazyTerminalBatchForm onSuccess={onSuccess} onCancel={() => onOpenChange(false)} />
            </Suspense>
        </BaseModal>
    )
}

export default TerminalBatchesManagement



