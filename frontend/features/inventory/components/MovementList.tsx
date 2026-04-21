"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Eye, ArrowRightLeft, Plus } from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { BaseModal } from "@/components/shared/BaseModal"
import { cn } from "@/lib/utils"
import { TransactionType } from "@/types/transactions"

interface StockMove {
    id: number
    date: string
    product_name: string
    product_internal_code?: string
    product_code?: string
    warehouse_name: string
    quantity: string
    uom_name: string
    move_type: string
    description: string
    related_documents: Array<{
        type: string
        id: number | string
        name: string
    }>
}

interface MovementListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function MovementList({ externalOpen, onExternalOpenChange, createAction }: MovementListProps) {
    const [moves, setMoves] = useState<StockMove[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: TransactionType, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setShowAdjustmentModal(false)
        onExternalOpenChange?.(false)
        
        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const fetchMoves = async () => {
        setLoading(true)
        try {
            const response = await api.get('/inventory/moves/')
            setMoves(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch stock moves", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMoves()
    }, [])

    const columns = useMemo<ColumnDef<StockMove>[]>(() => [
        {
            id: "folio",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center gap-0.5">
                    <DataCell.Code className="text-primary font-black uppercase">MOV-{row.original.id}</DataCell.Code>
                    <DataCell.Date value={row.original.date} className="text-[10px] opacity-50" />
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: "product_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center py-1 w-full">
                    <DataCell.Text className="text-center">{row.original.product_name}</DataCell.Text>
                    <div className="flex gap-2 items-center justify-center">
                        {row.original.product_internal_code && (
                            <DataCell.Code>{row.original.product_internal_code}</DataCell.Code>
                        )}
                        {row.original.product_code && row.original.product_code !== row.original.product_internal_code && (
                            <DataCell.Secondary className="text-[9px] font-mono opacity-50">
                                {row.original.product_code}
                            </DataCell.Secondary>
                        )}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Almacén" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Secondary className="font-bold opacity-80 text-center">
                    {row.getValue("warehouse_name")}
                </DataCell.Secondary>
            ),
        },
        {
            accessorKey: "quantity",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cantidad" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.NumericFlow 
                    value={row.getValue("quantity")} 
                    unit={row.original.uom_name} 
                    showSign={true} 
                />
            ),
            size: 100,
        },
        {
            accessorKey: "move_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const type = row.original.move_type
                const statusMap: Record<string, { status: string, label: string }> = {
                    'IN': { status: 'SUCCESS', label: 'Entrada' },
                    'OUT': { status: 'DESTRUCTIVE', label: 'Salida' },
                    'ADJ': { status: 'WARNING', label: 'Ajuste' }
                }
                const config = statusMap[type] || { status: 'NEUTRAL', label: type }
                return (
                    <div className="flex justify-center w-full">
                        <StatusBadge status={config.status} label={config.label} size="sm" />
                    </div>
                )
            },
            size: 100,
        },
        createActionsColumn<StockMove>({
            renderActions: (item) => (
                <DataCell.Action
                    icon={Eye}
                    title="Ver Detalles"
                    color="text-primary"
                    onClick={() => setViewingTransaction({ type: 'inventory', id: item.id })}
                />
            ),
        }),
    ], [])

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={moves}
                cardMode
                isLoading={loading}
                filterColumn="product_name"
                searchPlaceholder="Filtrar por producto o almacén..."
                useAdvancedFilter={true}
                facetedFilters={[
                    {
                        column: "move_type",
                        title: "Tipo",
                        options: [
                            { label: "Entrada", value: "IN" },
                            { label: "Salida", value: "OUT" },
                            { label: "Ajuste", value: "ADJ" },
                        ],
                    },
                ]}
                createAction={createAction}
            />

            {viewingTransaction && (
                <TransactionViewModal
                    open={!!viewingTransaction}
                    onOpenChange={(open) => !open && setViewingTransaction(null)}
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                    view={viewingTransaction.view}
                />
            )}

            <BaseModal
                open={showAdjustmentModal || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setShowAdjustmentModal(true)
                    }
                }}
                size="lg"
                title={
                    <div className="flex items-center gap-4">
                        <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
                        <div className="flex flex-col">
                            <span className="text-xl font-black uppercase tracking-tight">Nuevo Ajuste de Inventario</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Procedimiento táctico de rectificación</span>
                        </div>
                    </div>
                }
            >
                <AdjustmentForm
                    onSuccess={() => {
                        setShowAdjustmentModal(false);
                        onExternalOpenChange?.(false);
                        handleCloseModal();
                        fetchMoves();
                    }}
                    onCancel={() => {
                        setShowAdjustmentModal(false);
                        onExternalOpenChange?.(false);
                        handleCloseModal();
                    }}
                />
            </BaseModal>
        </div>
    )
}
