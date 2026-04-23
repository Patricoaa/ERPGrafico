"use client"

import { showApiError } from "@/lib/errors"

import React, { useState, useEffect, useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowRightLeft, History } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { BaseModal } from "@/components/shared/BaseModal"
import { ProductInsightsModal } from "@/features/inventory/components/ProductInsightsModal"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { cn, formatCurrency } from "@/lib/utils"

export function StockReport() {
    const [report, setReport] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null)
    const [insightsProduct, setInsightsProduct] = useState<any | null>(null)

    const fetchReport = React.useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/inventory/products/stock_report/')
            setReport(res.data)
        } catch (error) {
            showApiError(error, "Error al cargar el reporte de stock")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        let isMounted = true

        const load = async () => {
            if (isMounted) await fetchReport()
        }

        load()

        return () => {
            isMounted = false
        }
    }, [fetchReport])

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center py-1">
                    <DataCell.Text className="text-center">{row.original.name}</DataCell.Text>
                    <div className="flex gap-2 items-center justify-center">
                        {row.original.internal_code && (
                            <DataCell.Code>{row.original.internal_code}</DataCell.Code>
                        )}
                        {row.original.code && row.original.code !== row.original.internal_code && (
                            <DataCell.Secondary className="text-[9px] font-mono opacity-50">
                                {row.original.code}
                            </DataCell.Secondary>
                        )}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Secondary className="font-bold opacity-70">
                    {row.getValue("category_name")}
                </DataCell.Secondary>
            ),
        },
        {
            accessorKey: "stock_qty",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Físico" className="justify-center" />,
            cell: ({ row }) => {
                const qty = Number(row.getValue("stock_qty"))
                return (
                    <DataCell.Number 
                        value={qty} 
                        suffix={row.original.uom_name} 
                        decimals={2}
                        className={cn(
                            "text-[14px]",
                            qty <= 0 ? "text-destructive" : qty < 10 ? "text-warning" : "text-foreground/80"
                        )}
                    />
                )
            },
        },
        {
            accessorKey: "qty_reserved",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Reservado" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Number 
                    value={row.getValue("qty_reserved")} 
                    suffix={row.original.uom_name} 
                    decimals={2}
                    className="opacity-40"
                />
            ),
        },
        {
            accessorKey: "qty_available",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Disponible" className="justify-center" />,
            cell: ({ row }) => {
                const qty = Number(row.getValue("qty_available"))
                return (
                    <DataCell.Number 
                        value={qty} 
                        suffix={row.original.uom_name} 
                        decimals={2}
                        className={cn(
                            "text-[14px]",
                            qty <= 0 ? "text-destructive" : "text-primary font-black"
                        )}
                    />
                )
            },
        },
        {
            accessorKey: "total_value",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Valorización" className="justify-center" />,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex flex-col items-center w-full">
                        <DataCell.Currency value={item.total_value} className="text-[13px] text-primary" />
                        <DataCell.Secondary className="text-[9px] opacity-40 uppercase tracking-tighter">
                            {formatCurrency(item.unit_cost)} / {item.uom_name} Total
                        </DataCell.Secondary>
                    </div>
                )
            },
        },

        createActionsColumn<any>({
            renderActions: (item) => (
                <>
                    <DataCell.Action icon={ArrowRightLeft} title="Ajustar Stock" onClick={() => setAdjustingProduct(item)} />
                    <DataCell.Action icon={History} title="Ver Historial" onClick={() => setInsightsProduct(item)} />
                </>
            ),
        }),
    ], [setAdjustingProduct, setInsightsProduct])

    const globalFilterFields = useMemo(() => ["name", "code", "internal_code"], [])

    return (
        <div className={cn(LAYOUT_TOKENS.view, "space-y-6")}>
            <DataTable
                columns={columns}
                data={report}
                cardMode
                searchPlaceholder="Filtrar producto, SKU o código..."
                globalFilterFields={globalFilterFields}
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
                        <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
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

            <ProductInsightsModal
                open={!!insightsProduct}
                onOpenChange={(open) => !open && setInsightsProduct(null)}
                productId={insightsProduct?.id}
                productName={insightsProduct?.name}
            />
        </div>
    )
}
