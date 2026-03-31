"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, ArrowRightLeft } from "lucide-react"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { BaseModal } from "@/components/shared/BaseModal"
import { formatPlainDate } from "@/lib/utils"

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

    const columns: ColumnDef<StockMove>[] = [
        {
            id: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.DocumentId type="MOV" number={row.original.id} />
                </div>
            ),
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />
            ),
            cell: ({ row }) => <div className="text-sm whitespace-nowrap text-center">{formatPlainDate(row.getValue("date"))}</div>,
        },
        {
            accessorKey: "product_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Producto" className="justify-center" />
            ),
            cell: ({ row }) => {
                const move = row.original;
                return (
                    <div className="flex flex-col items-center gap-1 py-1">
                        <span className="font-medium text-xs leading-tight text-center">{move.product_name}</span>
                        <div className="flex flex-wrap justify-center gap-1">
                            {move.product_internal_code && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase text-center">
                                    {move.product_internal_code}
                                </Badge>
                            )}
                            {move.product_code && move.product_code !== move.product_internal_code && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase text-center">
                                    {move.product_code}
                                </Badge>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Almacén" className="justify-center" />
            ),
            cell: ({ row }) => <div className="text-sm text-center">{row.getValue("warehouse_name")}</div>,
        },
        {
            accessorKey: "quantity",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cant." className="justify-center" />
            ),
            cell: ({ row }) => {
                const qty = parseFloat(row.getValue("quantity"))
                return (
                    <div className={`text-center font-bold tabular-nums ${qty > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {Math.abs(qty)}
                    </div>
                )
            },
        },
        {
            accessorKey: "uom_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Unidad" className="justify-center" />
            ),
            cell: ({ row }) => <div className="text-[10px] text-muted-foreground font-medium uppercase text-center">{row.getValue("uom_name")}</div>,
        },
        {
            accessorKey: "move_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />
            ),
            cell: ({ row }) => {
                const type = row.getValue("move_type")
                return (
                    <div className="flex justify-center">
                        <Badge
                            variant={type === 'IN' ? 'default' : type === 'OUT' ? 'destructive' : 'secondary'}
                            className={`text-[10px] gap-1 ${type === 'ADJ' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200' : ''}`}
                        >
                            {type === 'ADJ' && <span className="text-[8px]">🔄</span>}
                            {type === 'IN' ? 'Entrada' : type === 'OUT' ? 'Salida' : 'Ajuste'}
                        </Badge>
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Ver" className="text-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewingTransaction({ type: 'inventory', id: row.original.id })}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            <div className="">
                <DataTable
                    columns={columns}
                    data={moves}
                    cardMode
                    isLoading={loading}
                    filterColumn="product_name"
                    searchPlaceholder="Buscar por producto..."
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
            </div>

            {
                viewingTransaction && (
                    <TransactionViewModal
                        open={!!viewingTransaction}
                        onOpenChange={(open) => !open && setViewingTransaction(null)}
                        type={viewingTransaction.type}
                        id={viewingTransaction.id}
                        view={viewingTransaction.view}
                    />
                )
            }

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
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <ArrowRightLeft className="h-5 w-5 text-primary" />
                        </div>
                        <span>Nuevo Ajuste de Stock</span>
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
        </div >
    )
}
