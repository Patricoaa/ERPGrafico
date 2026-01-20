"use client"

import { useState, useEffect } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { RefreshCw, ArrowRightLeft } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AdjustmentForm } from "@/components/inventory/AdjustmentForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function StockReport() {
    const [report, setReport] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isRotating, setIsRotating] = useState<number | null>(null)
    const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null)

    useEffect(() => {
        fetchReport()
    }, [])

    const fetchReport = async () => {
        setLoading(true)
        try {
            const res = await api.get('/inventory/products/stock_report/')
            setReport(res.data)
        } catch (error) {
            toast.error("Error al cargar el reporte de stock")
        } finally {
            setLoading(false)
        }
    }

    const handleRotateUom = async (product: any) => {
        setIsRotating(product.id)
        try {
            const res = await api.post(`/inventory/products/${product.id}/rotate_uom/`)
            toast.success(`Unidad de ${product.name} cambiada a ${res.data.new_uom}`)
            fetchReport()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al cambiar unidad")
        } finally {
            setIsRotating(null)
        }
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "internal_code",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cod. Int." />,
            cell: ({ row }) => <span className="font-mono text-[10px] font-bold text-primary">{row.getValue("internal_code")}</span>,
        },
        {
            accessorKey: "code",
            header: ({ column }) => <DataTableColumnHeader column={column} title="SKU/Code" />,
            cell: ({ row }) => <span className="font-mono text-[10px] text-muted-foreground">{row.getValue("code")}</span>,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.getValue("name")}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{row.original.category_name}</span>
                </div>
            ),
        },
        {
            accessorKey: "stock_qty",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Físico" className="justify-end" />,
            cell: ({ row }) => (
                <div className="text-right font-medium tabular-nums">
                    {Math.round(Number(row.getValue("stock_qty")) * 100) / 100} <span className="text-[10px] text-muted-foreground font-normal lowercase">{row.original.uom_name}</span>
                </div>
            ),
        },
        {
            accessorKey: "qty_reserved",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Reservado" className="justify-end" />,
            cell: ({ row }) => (
                <div className="text-right font-medium tabular-nums text-amber-600">
                    {Math.round((Number(row.getValue("qty_reserved")) || 0) * 100) / 100}
                </div>
            ),
        },
        {
            accessorKey: "qty_available",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Disponible" className="justify-end" />,
            cell: ({ row }) => (
                <div className="text-right font-bold tabular-nums text-emerald-600">
                    {Math.round((Number(row.getValue("qty_available")) || 0) * 100) / 100}
                </div>
            ),
        },
        {
            accessorKey: "unit_cost",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Costo Unit." className="justify-end" />,
            cell: ({ row }) => (
                <div className="text-right text-sm tabular-nums text-muted-foreground">
                    ${Math.round(Number(row.getValue("unit_cost"))).toLocaleString()}
                </div>
            ),
        },
        {
            accessorKey: "total_value",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Valorización" className="justify-end" />,
            cell: ({ row }) => (
                <div className="text-right font-black tabular-nums text-primary">
                    ${Math.round(Number(row.getValue("total_value"))).toLocaleString()}
                </div>
            ),
        },
        {
            accessorKey: "moves_in",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ent." className="justify-end" />,
            cell: ({ row }) => (
                <div className="text-right text-emerald-600 font-medium text-xs">
                    {Number(row.getValue("moves_in")) > 0 ? `+${Math.round(Number(row.getValue("moves_in")) * 100) / 100}` : '0'}
                </div>
            ),
        },
        {
            accessorKey: "moves_out",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sal." className="justify-end" />,
            cell: ({ row }) => (
                <div className="text-right text-rose-600 font-medium text-xs">
                    {Number(row.getValue("moves_out")) > 0 ? `-${Math.round(Number(row.getValue("moves_out")) * 100) / 100}` : '0'}
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex gap-1 justify-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setAdjustingProduct(row.original)}
                        title="Ajustar Stock"
                    >
                        <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleRotateUom(row.original)}
                        disabled={isRotating === row.original.id}
                        title="Rotar Unidad de Medida (Convierte Cantidades)"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRotating === row.original.id ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-lg font-semibold whitespace-nowrap">Reporte de Valorización</h3>
            </div>

            <DataTable
                columns={columns}
                data={report}
                searchPlaceholder="Buscar producto..."
                globalFilterFields={["name", "code", "internal_code"]}
                useAdvancedFilter={true}
                defaultPageSize={50}
            />

            <Dialog open={!!adjustingProduct} onOpenChange={(open) => !open && setAdjustingProduct(null)}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Ajustar Stock: {adjustingProduct?.name}
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Stock actual: <span className="font-bold">{adjustingProduct?.stock_qty} {adjustingProduct?.uom_name}</span> •
                            Costo unitario: <span className="font-bold">${adjustingProduct?.unit_cost}</span>
                        </p>
                    </DialogHeader>
                    {adjustingProduct && (
                        <AdjustmentForm
                            preSelectedProduct={adjustingProduct.id.toString()}
                            onSuccess={() => {
                                setAdjustingProduct(null);
                                fetchReport();
                            }}
                            onCancel={() => setAdjustingProduct(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
