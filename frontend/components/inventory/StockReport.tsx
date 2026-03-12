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
import { BaseModal } from "@/components/shared/BaseModal"
import { ProductInsightsDialog } from "@/components/inventory/ProductInsightsDialog"
import { Badge } from "@/components/ui/badge"
import { LAYOUT_TOKENS } from "@/lib/styles"

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
                        <DataCell.Text>{item.name}</DataCell.Text>
                        <div className="flex gap-1">
                            {item.internal_code && <DataCell.Code>{item.internal_code}</DataCell.Code>}
                            {item.code && item.code !== item.internal_code && (
                                <DataCell.Badge variant="secondary" className="text-[10px] h-4">{item.code}</DataCell.Badge>
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
                    suffix={row.original.uom_name}
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
                    suffix={row.original.uom_name}
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
                <div className="flex justify-end">
                    <Badge variant="success" className="text-[10px] h-5 px-2">
                        +{Number(row.getValue("moves_in")).toFixed(2)}
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: "moves_out",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sal." className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <Badge variant="warning" className="text-[10px] h-5 px-2">
                        -{Number(row.getValue("moves_out")).toFixed(2)}
                    </Badge>
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
                        onClick={() => setInsightsProduct(row.original)}
                        title="Ver Panel de Insights"
                    >
                        <History className="h-4 w-4" />
                    </Button>

                </div>
            ),
        },
    ]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <DataTable
                columns={columns}
                data={report}
                searchPlaceholder="Buscar producto..."
                globalFilterFields={["name", "code", "internal_code"]}
                useAdvancedFilter={true}
                defaultPageSize={50}
            />

            <BaseModal
                open={!!adjustingProduct}
                onOpenChange={(open) => !open && setAdjustingProduct(null)}
                size="lg"
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <ArrowRightLeft className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <div className="text-xl font-bold">Ajustar Stock: {adjustingProduct?.name}</div>
                            <p className="text-xs text-muted-foreground font-normal mt-0.5">
                                Stock actual: <span className="font-bold">{adjustingProduct?.stock_qty} {adjustingProduct?.uom_name}</span> •
                                Costo: <span className="font-bold">${adjustingProduct?.unit_cost}</span>
                            </p>
                        </div>
                    </div>
                }
            >
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
            </BaseModal>
            <ProductInsightsDialog
                open={!!insightsProduct}
                onOpenChange={(open) => !open && setInsightsProduct(null)}
                productId={insightsProduct?.id}
                productName={insightsProduct?.name}
            />
        </div>
    )
}
