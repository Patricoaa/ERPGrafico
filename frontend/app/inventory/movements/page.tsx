"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

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

export default function MovementsPage() {
    const [moves, setMoves] = useState<StockMove[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)

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

    const columns: ColumnDef<StockMove>[] = [
        {
            accessorKey: "id",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => <div className="font-mono text-xs">MOV-{row.original.id.toString().padStart(6, '0')}</div>,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <div>{new Date(row.getValue("date")).toLocaleDateString()}</div>,
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
        },
        {
            accessorKey: "quantity",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cant." />
            ),
            cell: ({ row }) => {
                const qty = parseFloat(row.getValue("quantity"))
                return (
                    <div className={qty > 0 ? "text-green-600 font-medium" : "text-red-600 font-bold"}>
                        {Math.round(Math.abs(qty))}
                    </div>
                )
            },
        },
        {
            accessorKey: "uom_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Unidad" />
            ),
            cell: ({ row }) => <div className="text-muted-foreground text-xs">{row.getValue("uom_name")}</div>,
        },
        {
            accessorKey: "move_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => {
                const type = row.getValue("move_type") as string
                return (
                    <Badge variant={type === 'IN' ? 'default' : type === 'OUT' ? 'destructive' : 'outline'}>
                        {type === 'IN' ? 'Entrada' : type === 'OUT' ? 'Salida' : 'Ajuste'}
                    </Badge>
                )
            },
        },
        {
            id: "related_documents",
            header: "Documentos",
            cell: ({ row }) => {
                const move = row.original
                const docs = move.related_documents?.filter(d => d.type !== 'inventory') || []

                if (docs.length === 0) return <span className="text-muted-foreground text-xs">-</span>

                return (
                    <div className="flex flex-col gap-1">
                        {docs.map((doc, idx) => (
                            <button
                                key={idx}
                                onClick={() => setViewingTransaction({ type: doc.type, id: doc.id })}
                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                            >
                                <span className="font-semibold uppercase text-[8px] text-muted-foreground whitespace-nowrap">
                                    {doc.type === 'invoice' ? (doc.name.includes('BOL') ? 'Boleta' :
                                        doc.name.includes('NC') ? 'Nota de Crédito' :
                                            doc.name.includes('ND') ? 'Nota de Débito' : 'Factura') :
                                        doc.type === 'purchase_order' ? 'Orden de Compra' :
                                            doc.type === 'sale_order' ? 'Nota de Venta' : doc.type}
                                </span>
                                {doc.name}
                            </button>
                        ))}
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Acciones" className="text-right" />
            ),
            cell: ({ row }) => (
                <div className="text-right">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingTransaction({ type: 'inventory', id: row.original.id })}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    useEffect(() => {
        fetchMoves()
    }, [])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Movimientos de Inventario</h2>
            </div>

            <div className="rounded-md border bg-white dark:bg-slate-950 px-1">
                <DataTable columns={columns} data={moves} />
            </div>

            {viewingTransaction && (
                <TransactionViewModal
                    open={!!viewingTransaction}
                    onOpenChange={(open) => !open && setViewingTransaction(null)}
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                    view={viewingTransaction.view}
                />
            )}
        </div>
    )
}
