"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
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
        const params = new URLSearchParams(searchParams.toString())
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`)
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

    useEffect(() => {
        if (externalOpen) {
            setShowAdjustmentModal(true)
        }
    }, [externalOpen])

    const columns = useMemo<ColumnDef<StockMove>[]>(() => [
        {
            id: "folio",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" />,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-mono font-black text-[12px] text-primary tracking-tighter">MOV-{row.original.id}</span>
                    <span className="text-[9px] font-black uppercase text-muted-foreground opacity-50 tracking-widest">
                        {formatPlainDate(row.original.date)}
                    </span>
                </div>
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
            header: ({ column }) => <DataTableColumnHeader column={column} title="Almacén" />,
            cell: ({ row }) => (
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-80">
                    {row.getValue("warehouse_name")}
                </span>
            ),
        },
        {
            accessorKey: "quantity",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cantidad" className="justify-end" />,
            cell: ({ row }) => {
                const qty = parseFloat(row.getValue("quantity"))
                return (
                    <div className="flex flex-col items-end group">
                        <span className={cn(
                            "font-mono font-black text-[14px] tracking-tighter transition-all group-hover:scale-110",
                            qty > 0 ? "text-emerald-700" : "text-rose-700"
                        )}>
                            {qty > 0 ? '+' : ''}{qty.toFixed(2)}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100">
                            {row.original.uom_name}
                        </span>
                    </div>
                )
            },
            size: 100,
        },
        {
            accessorKey: "move_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const type = row.original.move_type
                return (
                    <div className="flex justify-center">
                        <Badge
                            className={cn(
                                "text-[9px] font-black uppercase h-5 px-2 tracking-tight rounded-[0.125rem]",
                                type === 'IN' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                type === 'OUT' ? "bg-rose-50 text-rose-700 border-rose-200" :
                                "bg-amber-50 text-amber-700 border-amber-200"
                            )}
                        >
                            {type === 'IN' ? 'Entrada' : type === 'OUT' ? 'Salida' : 'Ajuste'}
                        </Badge>
                    </div>
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
                title="Movimientos de Stock"
                isLoading={loading}
                filterColumn="product_name"
                searchPlaceholder="Filtrar por producto o almacén..."
                toolbarAction={
                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => setShowAdjustmentModal(true)}
                            className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-[0.25rem] shadow-lg shadow-primary/20 group"
                        >
                             <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" /> 
                             Nuevo ajuste de stock
                        </Button>
                    </div>
                }
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
                useAdvancedFilter={true}
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
                open={showAdjustmentModal}
                onOpenChange={(open) => {
                    setShowAdjustmentModal(open)
                    if (!open) {
                        onExternalOpenChange?.(false)
                        handleCloseModal()
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
