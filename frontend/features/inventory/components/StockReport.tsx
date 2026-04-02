"use client"

import { useState, useEffect } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { RefreshCw, ArrowRightLeft, History, Download } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { BaseModal } from "@/components/shared/BaseModal"
import { ProductInsightsDialog } from "@/features/inventory/components/ProductInsightsDialog"
import { Badge } from "@/components/ui/badge"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { cn, formatCurrency } from "@/lib/utils"

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
                        <span className="font-black text-[12px] uppercase tracking-tight text-foreground/80">{item.name}</span>
                        <div className="flex gap-2 items-center">
                            {item.internal_code && (
                                <span className="font-mono text-[9px] font-black uppercase text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-[0.125rem]">
                                    {item.internal_code}
                                </span>
                            )}
                            {item.code && item.code !== item.internal_code && (
                                <Badge variant="secondary" className="text-[8px] h-3.5 px-1 font-black uppercase tracking-tighter opacity-60">
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
            cell: ({ row }) => (
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">
                    {row.getValue("category_name")}
                </span>
            ),
        },
        {
            accessorKey: "stock_qty",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Físico" className="justify-center" />,
            cell: ({ row }) => {
                const qty = Number(row.getValue("stock_qty"))
                return (
                    <div className="flex flex-col items-center group cursor-help">
                        <span className={cn(
                            "font-mono font-black text-[14px] tracking-tighter",
                            qty <= 0 ? "text-rose-600" : qty < 10 ? "text-amber-600" : "text-foreground/80"
                        )}>
                            {qty.toFixed(2)}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 transition-opacity">
                            {row.original.uom_name}
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "qty_reserved",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Res." className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center opacity-40">
                    <span className="font-mono font-bold text-[12px] tracking-tighter">
                        {Number(row.getValue("qty_reserved")).toFixed(2)}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest">Lote</span>
                </div>
            ),
        },
        {
            accessorKey: "qty_available",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Disp." className="justify-center" />,
            cell: ({ row }) => {
                const qty = Number(row.getValue("qty_available"))
                return (
                    <div className="flex flex-col items-center">
                        <span className={cn(
                            "font-mono font-black text-[14px] tracking-tighter",
                            qty <= 0 ? "text-rose-600" : "text-primary group-hover:scale-110 transition-transform"
                        )}>
                            {qty.toFixed(2)}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary/40">Disponible</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "total_value",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Valorización" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-end">
                    <span className="font-mono font-black text-[13px] tracking-tighter text-primary">
                        {formatCurrency(Number(row.getValue("total_value")))}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-30">PMP Actual</span>
                </div>
            ),
        },
        {
            accessorKey: "moves_in",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Flujo" className="justify-center" />,
            cell: ({ row }) => {
                const movesIn = Number(row.getValue("moves_in"))
                const movesOut = Number(row.getValue("moves_out"))
                return (
                    <div className="flex items-center gap-2 justify-center">
                        <div className="flex flex-col items-end opacity-60">
                            <span className="font-mono font-bold text-[10px] text-emerald-700">+{movesIn.toFixed(0)}</span>
                            <span className="font-mono font-bold text-[10px] text-rose-700">-{movesOut.toFixed(0)}</span>
                        </div>
                        <div className="h-6 w-px bg-border/40" />
                        <span className={cn(
                            "font-mono font-black text-[12px] tracking-tighter",
                            (movesIn - movesOut) >= 0 ? "text-emerald-700" : "text-rose-700"
                        )}>
                            {(movesIn - movesOut).toFixed(0)}
                        </span>
                    </div>
                )
            },
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex gap-1 justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110"
                        onClick={() => setAdjustingProduct(row.original)}
                    >
                        <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110"
                        onClick={() => setInsightsProduct(row.original)}
                    >
                        <History className="h-4 w-4" />
                    </Button>
                </div>
            ),
            size: 80,
        },
    ]

    const handleExport = () => {
        toast.info("Exportando reporte consolidado...")
    }

    return (
        <div className={cn(LAYOUT_TOKENS.view, "space-y-6")}>
            <DataTable
                columns={columns}
                data={report}
                cardMode
                title="Reporte Global de Stock"
                searchPlaceholder="Filtrar producto, SKU o código..."
                globalFilterFields={["name", "code", "internal_code"]}
                toolbarAction={
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={fetchReport} 
                            className="h-9 px-4 font-black uppercase tracking-widest text-[10px] rounded-[0.25rem] border-border/60 hover:bg-muted/50"
                        >
                             <RefreshCw className={cn("h-3.5 w-3.5 mr-2", loading && "animate-spin")} /> 
                             Recargar datos
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleExport}
                            className="h-9 px-4 font-black uppercase tracking-widest text-[10px] rounded-[0.25rem] border-border/60 hover:bg-muted/50"
                        >
                             <Download className="h-3.5 w-3.5 mr-2" /> 
                             Excel
                        </Button>
                    </div>
                }
                useAdvancedFilter={true}
                defaultPageSize={50}
                isLoading={loading}
            />

            <BaseModal
                open={!!adjustingProduct}
                onOpenChange={(open) => !open && setAdjustingProduct(null)}
                size="lg"
                title={
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                            <ArrowRightLeft className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-black uppercase tracking-tight">Ajuste de Stock</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {adjustingProduct?.name} • SKU: {adjustingProduct?.internal_code || 'N/A'}
                            </span>
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
