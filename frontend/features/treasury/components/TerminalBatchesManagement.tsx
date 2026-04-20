"use client"

import React, { useState, useEffect, lazy, Suspense, useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, CreditCard, Calendar, Building2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { format, subDays } from "date-fns"
import { es } from "date-fns/locale"
import { BaseModal } from "@/components/shared/BaseModal"
import { useTerminalBatches } from "@/features/treasury"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import type { DateRange } from "react-day-picker"

// Lazy load feature components
const TerminalBatchForm = lazy(() => import("./TerminalBatchForm"))
const MonthlyInvoiceDialog = lazy(() => import("./MonthlyInvoiceDialog"))

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
    const { batches, refetch, isLoading } = useTerminalBatches()
    const [openCreate, setOpenCreate] = useState(false)
    const [openInvoice, setOpenInvoice] = useState(false)
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date()
    })
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        if (isMounted && externalOpenBatch) {
            setOpenCreate(true)
        }
    }, [isMounted, externalOpenBatch])

    useEffect(() => {
        if (isMounted && externalOpenInvoice) {
            setOpenInvoice(true)
        }
    }, [isMounted, externalOpenInvoice])

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "sales_date",
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Fecha Ventas" className="justify-center" />,
            cell: ({ row }: any) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.original.sales_date} />
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
                isLoading={!isMounted || isLoading}
                cardMode
                useAdvancedFilter={true}
                facetedFilters={[
                    {
                        column: "status",
                        title: "Estado",
                        options: [
                            { label: "Pendiente", value: "PENDING" },
                            { label: "Liquidado", value: "SETTLED" },
                            { label: "Conciliado", value: "RECONCILED" },
                        ]
                    }
                ]}
                customFilters={
                    <DateRangeFilter onRangeChange={setDateRange} label="Fecha de Ventas" className="bg-transparent border-none w-full" />
                }
                isCustomFiltered={!!dateRange}
                customFilterCount={dateRange ? 1 : 0}
                onReset={() => setDateRange(undefined)}
                createAction={createAction}
            />

            <Suspense fallback={<LoadingFallback />}>
                <TerminalBatchDialog
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

            <Suspense fallback={<LoadingFallback />}>
                <MonthlyInvoiceDialog
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

function TerminalBatchDialog({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={
                <div className="flex items-center gap-3">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                    <span>Registrar Liquidación de Terminal</span>
                </div>
            }
            description="Ingrese los datos de la liquidación diaria informada por el proveedor del terminal."
        >
            <TerminalBatchForm onSuccess={onSuccess} onCancel={() => onOpenChange(false)} />
        </BaseModal>
    )
}

export default TerminalBatchesManagement



