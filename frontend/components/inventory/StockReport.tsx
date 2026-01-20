"use client"

import { useState, useEffect } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { RefreshCw, ArrowRightLeft, History } from "lucide-react"
import { DataCell } from "@/components/ui/data-table-cells"
import api from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AdjustmentForm } from "@/components/inventory/AdjustmentForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProductInsightsDialog } from "@/components/inventory/ProductInsightsDialog"
import { Badge } from "@/components/ui/badge"

export function StockReport() {
    const [report, setReport] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null)
    const [insightsProduct, setInsightsProduct] = useState<any | null>(null)

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


    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex flex-col gap-1 py-1">
                        <span className="font-medium text-xs leading-tight">{item.name}</span>
                        <div className="flex flex-wrap gap-1">
                            {item.internal_code && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase">
                                    {item.internal_code}
                                </Badge>
                            )}
                            {item.code && item.code !== item.internal_code && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase">
                                    {item.code}
                                </Badge>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría" />,
            cell: ({ row }) => <DataCell.Text className="text-xs">{row.getValue("category_name")}</DataCell.Text>,
        },
        {
            accessorKey: "stock_qty",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Físico" className="justify-end" />,
            cell: ({ row }) => (
                <DataCell.Number
                    value={row.getValue("stock_qty")}
                    decimals={2}
                    suffix={row.original.uom_name}
                />
            ),
        },
        {
            accessorKey: "qty_reserved",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Reservado" className="justify-end" />,
            cell: ({ row }) => (
                <DataCell.Number
                    value={row.getValue("qty_reserved")}
                    decimals={2}
                    className="text-amber-600"
                />
            ),
        },
        {
            accessorKey: "qty_available",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Disponible" className="justify-end" />,
            cell: ({ row }) => (
                <DataCell.Number
                    value={row.getValue("qty_available")}
                    decimals={2}
                    className="text-emerald-600 font-bold"
                />
            ),
        },
        {
            accessorKey: "unit_cost",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Costo Unit." className="justify-end" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("unit_cost")} className="text-sm font-normal text-muted-foreground" />,
        },
        {
            accessorKey: "total_value",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Valorización" className="justify-end" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total_value")} className="font-black text-primary" />,
        },
        {
            accessorKey: "moves_in",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ent." className="justify-end" />,
            cell: ({ row }) => (
                <DataCell.Variance
                    value={Number(row.getValue("moves_in"))}
                    decimals={2}
                    className="text-xs"
                />
            ),
        },
        {
            accessorKey: "moves_out",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sal." className="justify-end" />,
            cell: ({ row }) => (
                <DataCell.Variance
                    value={-Number(row.getValue("moves_out"))}
                    decimals={2}
                    className="text-xs"
                />
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
                        onClick={() => setInsightsProduct(row.original)}
                        title="Ver Panel de Insights (Precios, Kardex, Margen)"
                    >
                        <History className="h-4 w-4" />
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
            <ProductInsightsDialog
                open={!!insightsProduct}
                onOpenChange={(open) => !open && setInsightsProduct(null)}
                productId={insightsProduct?.id}
                productName={insightsProduct?.name}
            />
        </div>
    )
}
