"use client"

import { showApiError } from "@/lib/errors"

import React, { useState, useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowRightLeft, History } from "lucide-react"


import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { BaseModal } from "@/components/shared/BaseModal"
import { CancelButton, SubmitButton, FormFooter } from "@/components/shared"
import { ProductInsightsModal } from "@/features/inventory/components/ProductInsightsModal"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { PageContainer } from "@/components/shared"
import { cn, formatCurrency } from "@/lib/utils"

import { useStockReport } from "@/features/inventory/hooks/useStockReport"

export function StockReport() {
    const { report, isLoading, refetch } = useStockReport()
    const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null)
    const [insightsProduct, setInsightsProduct] = useState<any | null>(null)
    const [isFormLoading, setIsFormLoading] = useState(false)

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
        <PageContainer className="space-y-6">
            <DataTable
                columns={columns}
                data={report}
                isLoading={isLoading}
                variant="embedded"
                searchPlaceholder="Filtrar producto, SKU o código..."
                globalFilterFields={globalFilterFields}
                useAdvancedFilter={true}
                defaultPageSize={50}
            />

            <BaseModal
                open={!!adjustingProduct}
                onOpenChange={(open) => !open && setAdjustingProduct(null)}
                size="lg"
                hideScrollArea={true}
                contentClassName="p-0"
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
                footer={
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setAdjustingProduct(null)} />
                                <SubmitButton
                                    form="adjustment-form"
                                    loading={isFormLoading}
                                    variant="primary"
                                    className="px-8"
                                >
                                    Confirmar Ajuste
                                </SubmitButton>
                            </>
                        }
                    />
                }
            >
                {adjustingProduct && (
                    <AdjustmentForm
                        onLoadingChange={setIsFormLoading}
                        preSelectedProduct={adjustingProduct.id.toString()}
                        onSuccess={() => {
                            setAdjustingProduct(null);
                            refetch();
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
        </PageContainer>
    )
}
