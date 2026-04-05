"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, ArrowRightLeft, Plus } from "lucide-react"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { BaseModal } from "@/components/shared/BaseModal"
import { cn, formatPlainDate } from "@/lib/utils"

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
}

export function MovementList({ externalOpen, onExternalOpenChange }: MovementListProps) {
    const [moves, setMoves] = useState<StockMove[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)
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
                <DataCell.Secondary className="flex flex-col gap-0.5">
                    <span className="font-mono font-black text-[12px] text-primary tracking-tighter">MOV-{row.original.id}</span>
                    <span className="text-[9px] font-black uppercase text-muted-foreground opacity-50 tracking-widest leading-none">
                        {formatPlainDate(row.original.date)}
                    </span>
                </DataCell.Secondary>
            ),
            size: 100,
        },
        {
            accessorKey: "product_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
            cell: ({ row }) => (
                <div className="flex flex-col gap-1 py-1">
                    <span className="font-black text-[12px] uppercase tracking-tight text-foreground/80">{row.original.product_name}</span>
                    <div className="flex gap-2 items-center">
                        {row.original.product_internal_code && (
                            <span className="font-mono text-[9px] font-black uppercase text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-[0.125rem]">
                                {row.original.product_internal_code}
                            </span>
                        )}
                        {row.original.product_code && row.original.product_code !== row.original.product_internal_code && (
                            <Badge variant="secondary" className="text-[8px] h-3.5 px-1 font-black uppercase tracking-tighter opacity-60">
                                {row.original.product_code}
                            </Badge>
                        )}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Almacén" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Secondary className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-80">
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
                return (
                    <DataCell.Secondary className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-80 border rounded-[0.125rem] bg-secondary/30 px-2 py-0 border-border/50 h-5">
                            {type === 'IN' ? 'Entrada' : type === 'OUT' ? 'Salida' : 'Ajuste'}
                    </DataCell.Secondary>
                )
            },
            size: 100,
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary transition-all duration-300 hover:rotate-12"
                        onClick={() => setViewingTransaction({ type: 'inventory', id: row.original.id })}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            ),
            size: 60,
        },
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
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                            <ArrowRightLeft className="h-6 w-6 text-primary" />
                        </div>
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
