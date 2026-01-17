"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { AdjustmentForm } from "@/components/inventory/AdjustmentForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus } from "lucide-react"

interface StockMove {
    id: number
    date: string
    product_name: string
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

export function MovementList() {
    const [moves, setMoves] = useState<StockMove[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)

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

    const columns: ColumnDef<StockMove>[] = [
        {
            id: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => <div className="font-mono text-[10px] text-muted-foreground">MOV-{row.original.id.toString().padStart(6, '0')}</div>,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <div className="text-sm whitespace-nowrap">{new Date(row.getValue("date")).toLocaleDateString()}</div>,
        },
        {
            accessorKey: "product_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Producto" />
            ),
            cell: ({ row }) => <div className="font-medium">{row.getValue("product_name")}</div>,
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Almacén" />
            ),
            cell: ({ row }) => <div className="text-sm">{row.getValue("warehouse_name")}</div>,
        },
        {
            accessorKey: "quantity",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cant." className="justify-end" />
            ),
            cell: ({ row }) => {
                const qty = parseFloat(row.getValue("quantity"))
                return (
                    <div className={`text-right font-bold tabular-nums ${qty > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {Math.abs(qty)}
                    </div>
                )
            },
        },
        {
            accessorKey: "uom_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Unidad" />
            ),
            cell: ({ row }) => <div className="text-[10px] text-muted-foreground font-medium uppercase">{row.getValue("uom_name")}</div>,
        },
        {
            accessorKey: "move_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => {
                const type = row.getValue("move_type")
                return (
                    <Badge
                        variant={type === 'IN' ? 'default' : type === 'OUT' ? 'destructive' : 'secondary'}
                        className={`text-[10px] gap-1 ${type === 'ADJ' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200' : ''}`}
                    >
                        {type === 'ADJ' && <span className="text-[8px]">🔄</span>}
                        {type === 'IN' ? 'Entrada' : type === 'OUT' ? 'Salida' : 'Ajuste'}
                    </Badge>
                )
            },
        },
        {
            id: "documents",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Documentos" />
            ),
            cell: ({ row }) => {
                const move = row.original
                return (
                    <div className="flex flex-col gap-1 max-w-[200px]">
                        {move.related_documents && move.related_documents.filter(d => d.type !== 'inventory').length > 0 ? (
                            move.related_documents
                                .filter(d => d.type !== 'inventory')
                                .map((doc, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setViewingTransaction({ type: doc.type, id: doc.id })}
                                        className="text-primary hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                    >
                                        <span className="font-bold uppercase text-[7px] text-muted-foreground/70">
                                            {doc.type === 'invoice' ? (doc.name.includes('BOL') ? 'Boleta' :
                                                doc.name.includes('NC') ? 'Nota de Crédito' :
                                                    doc.name.includes('ND') ? 'Nota de Débito' : 'Factura') :
                                                doc.type === 'purchase_order' ? 'Orden de Compra' :
                                                    doc.type === 'sale_order' ? 'Nota de Venta' : doc.type}
                                        </span>
                                        <span className="truncate w-full">{doc.name}</span>
                                    </button>
                                ))
                        ) : (
                            <span className="text-muted-foreground text-xs italic opacity-50">-</span>
                        )}
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
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Historial de Movimientos</h3>
                <Button onClick={() => setShowAdjustmentModal(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Ajuste
                </Button>
            </div>

            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <DataTable
                    columns={columns}
                    data={moves}
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

            <Dialog open={showAdjustmentModal} onOpenChange={setShowAdjustmentModal}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Nuevo Ajuste de Stock</DialogTitle>
                    </DialogHeader>
                    <AdjustmentForm onSuccess={() => { setShowAdjustmentModal(false); fetchMoves(); }} onCancel={() => setShowAdjustmentModal(false)} />
                </DialogContent>
            </Dialog>
        </div >
    )
}
