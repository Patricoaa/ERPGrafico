"use client"

import React, { useState, useEffect, lazy, Suspense, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BaseModal, DataTableView, EntityCard, StatusBadge } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import type { ColumnDef } from "@tanstack/react-table"
import { Plus, Building2 } from "lucide-react"
import { format } from "date-fns"

import { useTerminalBatches } from "@/features/treasury"
import type { TerminalBatch } from "@/features/treasury/types"
import { DataCell, createActionsColumn } from '@/components/shared'
import { SkeletonShell, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { terminalBatchSearchDef } from "@/features/treasury/searchDef"

// Lazy load feature components
const LazyTerminalBatchForm = lazy(() => import("./TerminalBatchForm"))
const MonthlyInvoiceModal = lazy(() => import("./MonthlyInvoiceModal"))

interface TerminalBatchesManagementProps {
    showTitle?: boolean
    externalOpenBatch?: boolean
    externalOpenInvoice?: boolean
    createAction?: React.ReactNode
}

export function TerminalBatchesManagement({
    showTitle = true,
    externalOpenBatch,
    externalOpenInvoice,
    createAction
}: TerminalBatchesManagementProps) {
    const router = useRouter()
    const { filters, isFiltered } = useSmartSearch(terminalBatchSearchDef)
    const { batches, isLoading, refetch } = useTerminalBatches(filters)
    const [openCreate, setOpenCreate] = useState(false)
    const [openInvoice, setOpenInvoice] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    const clearModalParam = useCallback(() => {
        const searchParams = new URLSearchParams(window.location.search)
        if (searchParams.has('modal')) {
            searchParams.delete('modal')
            const query = searchParams.toString()
            router.replace(query ? `?${query}` : window.location.pathname, { scroll: false })
        }
    }, [router])

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

    const columns = useMemo<ColumnDef<TerminalBatch>[]>(() => [
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
            cell: ({ row }: any) =>
                <DataCell.Status status={row.original.status} />,
            meta: {
                title: "Estado"
            }
        },
        createActionsColumn<TerminalBatch>({
            renderActions: () => null
        })
    ], [])

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.terminalbatch"
                    columns={columns}
                    data={batches}
                    isLoading={isLoading}
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={terminalBatchSearchDef} placeholder="Buscar liquidaciones..." className="w-full" />}
                    createAction={createAction}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "treasury",
                        title: "Aún no hay liquidaciones",
                        description: "Las liquidaciones de terminales de pago aparecerán aquí.",
                    }}
                    renderCard={(batch: TerminalBatch) => (
                        <EntityCard onClick={() => setOpenCreate(true)}>
                            <EntityCard.Header
                                title={batch.batch_number}
                                subtitle={batch.provider_name ?? 'Sin proveedor'}
                                trailing={
                                    <StatusBadge
                                        status={batch.is_settled ? 'settled' : 'pending'}
                                        label={batch.is_settled ? 'Liquidado' : 'Pendiente'}
                                        size="sm"
                                    />
                                }
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Transacciones" value={<DataCell.Number value={batch.transaction_count} />} />
                                <EntityCard.Field label="Neto" value={<DataCell.Currency value={batch.net_amount} />} />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                />
            </div>

             <SkeletonShell isLoading={isLoading} ariaLabel="Cargando modal de lote de terminal">
                 <Suspense fallback={<div />}>
                     <TerminalBatchModal
                     open={openCreate}
                     onOpenChange={(open: boolean) => {
                         setOpenCreate(open)
                         if (!open) clearModalParam()
                     }}
                     onSuccess={() => {
                         setOpenCreate(false)
                         clearModalParam()
                         refetch()
                     }}
                 />
                 </Suspense>
             </SkeletonShell>

             <SkeletonShell isLoading={isLoading} ariaLabel="Cargando modal de factura mensual">
                 <Suspense fallback={<div />}>
                     <MonthlyInvoiceModal
                     open={openInvoice}
                     onOpenChange={(open: boolean) => {
                         setOpenInvoice(open)
                         if (!open) clearModalParam()
                     }}
                 />
                 </Suspense>
             </SkeletonShell>
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
             <SkeletonShell isLoading={true} ariaLabel="Cargando formulario de lote de terminal">
                 <Suspense fallback={<div />}>
                     <LazyTerminalBatchForm onSuccess={onSuccess} onCancel={() => onOpenChange(false)} />
                 </Suspense>
             </SkeletonShell>
         </BaseModal>
    )
}

export default TerminalBatchesManagement

