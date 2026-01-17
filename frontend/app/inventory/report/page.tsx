"use client"

import { useState, useEffect } from "react"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

interface StockReportItem {
    id: number
    code: string
    name: string
    category_name: string
    stock_qty: number
    uom_name: string
    unit_cost: number
    total_value: number
    moves_in: number
    moves_out: number
}

export default function StockReportPage() {
    const [report, setReport] = useState<StockReportItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchReport()
    }, [])

    const fetchReport = async () => {
        try {
            const res = await api.get('/inventory/products/stock_report/')
            setReport(res.data)
        } catch (error) {
            toast.error("Error al cargar el reporte de stock")
        } finally {
            setLoading(false)
        }
    }

    const columns: ColumnDef<StockReportItem>[] = [
        {
            accessorKey: "code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Código" />
            ),
            cell: ({ row }) => <div className="font-mono">{row.getValue("code")}</div>,
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Producto" />
            ),
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Categoría" />
            ),
        },
        {
            accessorKey: "stock_qty",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Stock Actual" />
            ),
            cell: ({ row }) => {
                const stock = row.getValue("stock_qty") as number
                return <div className="text-right font-bold">{Math.round(stock).toLocaleString()}</div>
            },
        },
        {
            accessorKey: "uom_name",
            header: "Unidad",
            cell: ({ row }) => (
                <div className="text-muted-foreground text-xs">{row.getValue("uom_name")}</div>
            ),
        },
        {
            accessorKey: "unit_cost",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Costo Unit." />
            ),
            cell: ({ row }) => {
                const cost = row.getValue("unit_cost") as number
                return <div className="text-right">${Math.round(cost).toLocaleString()}</div>
            },
        },
        {
            accessorKey: "total_value",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Valorización" />
            ),
            cell: ({ row }) => {
                const value = row.getValue("total_value") as number
                return <div className="text-right font-medium">${Math.round(value).toLocaleString()}</div>
            },
        },
        {
            accessorKey: "moves_in",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Entradas" />
            ),
            cell: ({ row }) => {
                const movesIn = row.getValue("moves_in") as number
                return (
                    <div className="text-right text-green-600">
                        {movesIn > 0 ? `+${Math.round(movesIn).toLocaleString()}` : '0'}
                    </div>
                )
            },
        },
        {
            accessorKey: "moves_out",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Salidas" />
            ),
            cell: ({ row }) => {
                const movesOut = row.getValue("moves_out") as number
                return (
                    <div className="text-right text-red-600">
                        {movesOut > 0 ? `-${Math.round(movesOut).toLocaleString()}` : '0'}
                    </div>
                )
            },
        },
    ]

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Reporte de Stock</h1>
            </div>

            {loading ? (
                <div className="rounded-xl border shadow-sm overflow-hidden bg-card p-10 text-center">
                    Cargando reporte...
                </div>
            ) : (
                <DataTable columns={columns} data={report} defaultPageSize={50} />
            )}
        </div>
    )
}
