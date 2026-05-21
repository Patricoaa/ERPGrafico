"use client"
import { formatCurrency } from "@/lib/money"

import { showApiError } from "@/lib/errors"

import React, { useState, useMemo } from "react"
import { DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { ArrowRightLeft, History } from "lucide-react"


import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { BaseModal } from "@/components/shared/BaseModal"
import { CancelButton, SubmitButton, FormFooter, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { stockReportSearchDef } from "@/features/inventory/searchDef"
import { ProductInsightsModal } from "@/features/inventory/components/ProductInsightsModal"
import { DataCell, createActionsColumn } from '@/components/shared'
import { PageContainer } from "@/components/shared"
import { cn } from "@/lib/utils"

import { useStockReport } from "@/features/inventory/hooks/useStockReport"

export function StockReport() {
    const { report, isLoading, refetch } = useStockReport()
    const { filters: smartFilters } = useSmartSearch(stockReportSearchDef)
    const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null)
    const [insightsProduct, setInsightsProduct] = useState<any | null>(null)
    const [isFormLoading, setIsFormLoading] = useState(false)

    const filteredReport = useMemo(() => {
        if (!smartFilters || Object.keys(smartFilters).length === 0) return report;

        return report.filter((item: any) => {
            // Text search (Product/SKU/Code)
            if (smartFilters.search) {
                const search = String(smartFilters.search).toLowerCase();
                const matchesSearch =
                    item.name?.toLowerCase().includes(search) ||
                    item.code?.toLowerCase().includes(search) ||
                    item.internal_code?.toLowerCase().includes(search);
                if (!matchesSearch) return false;
            }

            // Category filter
            if (smartFilters.category_name) {
                const cat = String(smartFilters.category_name).toLowerCase();
                if (!item.category_name?.toLowerCase().includes(cat)) return false;
            }

            return true;
        });
    }, [report, smartFilters]);

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
                            <DataCell.Code>
                                {row.original.code}
                            </DataCell.Code>
                        )}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text>
                    {row.getValue("category_name")}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: "stock_qty",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Físico" className="justify-center" />,
            cell: ({ row }) => {
                const qty = Number(row.getValue("stock_qty"))
                return (
                    <div className="flex flex-col items-center">
                        <DataCell.Number
                            value={qty}
                            decimals={2}
                            className={cn(
                                "text-[14px]",
                                qty <= 0 ? "text-destructive" : qty < 10 ? "text-warning" : "text-foreground/80"
                            )}
                        />
                        <DataCell.Secondary className="text-[10px] opacity-50 uppercase tracking-tighter">
                            {row.original.uom_name}
                        </DataCell.Secondary>
                    </div>
                )
            },
        },
        {
            accessorKey: "qty_reserved",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Reservado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center">
                    <DataCell.Number
                        value={row.getValue("qty_reserved")}
                        decimals={2}
                    />
                    <DataCell.Secondary className="text-[10px] opacity-50 uppercase tracking-tighter">
                        {row.original.uom_name}
                    </DataCell.Secondary>
                </div>
            ),
        },
        {
            accessorKey: "qty_available",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Disponible" className="justify-center" />,
            cell: ({ row }) => {
                const qty = Number(row.getValue("qty_available"))
                return (
                    <div className="flex flex-col items-center">
                        <DataCell.Number
                            value={qty}
                            decimals={2}
                            className={cn(
                                "text-[14px]",
                                qty <= 0 ? "text-destructive" : "text-primary font-black"
                            )}
                        />
                        <DataCell.Secondary className="text-[10px] opacity-50 uppercase tracking-tighter">
                            {row.original.uom_name}
                        </DataCell.Secondary>
                    </div>
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
                            {formatCurrency(item.unit_cost)} c/{item.uom_name}
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


    return (
        <PageContainer className="space-y-6 h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    data={filteredReport}
                    isLoading={isLoading}
                    variant="embedded"
                    leftAction={<SmartSearchBar searchDef={stockReportSearchDef} placeholder="Buscar por producto, SKU o categoría..." className="w-full" />}
                    useAdvancedFilter={true}
                    defaultPageSize={50}
                />
            </div>

            <BaseModal
                open={!!adjustingProduct}
                onOpenChange={(open) => !open && setAdjustingProduct(null)}
                size="lg"
                hideScrollArea={true}
                contentClassName="p-0"
                icon={ArrowRightLeft}
                title="Ajuste de Stock"
                description={adjustingProduct ? `${adjustingProduct.name} • SKU: ${adjustingProduct.internal_code || 'N/A'}` : undefined}
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
