"use client"
import { formatCurrency } from "@/lib/money"

import React, { useState, useMemo } from "react"
import { ArrowRightLeft } from "lucide-react"

import { BaseModal, DataCell, DataTableView, EntityCard, PageContainer, DataTableColumnHeader, SmartSearchBar, useSmartSearch, CancelButton, SubmitButton, FormFooter } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { stockReportSearchDef } from "@/features/inventory/searchDef"
import { ProductInsightsModal } from "@/features/inventory/components/ProductInsightsModal"
import { stockReportActions, type StockReportActionsCtx } from './stockReportActions'
import { useStockReport } from "@/features/inventory/hooks/useStockReport"

interface StockReportItem {
    id: number | string
    name?: string
    code?: string
    internal_code?: string
    category_name?: string
    stock_qty?: number | string
    qty_reserved?: number | string
    qty_available?: number | string
    uom_name?: string
    unit_cost?: number | string
    total_value?: number | string
}

export function StockReport() {
    const { report, isLoading, refetch } = useStockReport()
    const { filters: smartFilters, isFiltered, clearAll } = useSmartSearch(stockReportSearchDef)
    const [adjustingProduct, setAdjustingProduct] = useState<StockReportItem | null>(null)
    const [insightsProduct, setInsightsProduct] = useState<StockReportItem | null>(null)
    const [isFormLoading, setIsFormLoading] = useState(false)

    const stockReportActionsCtx: StockReportActionsCtx = {
        onAdjust: (product) => setAdjustingProduct(product as StockReportItem | null),
        onHistory: (product) => setInsightsProduct(product as StockReportItem | null),
    }

    const filteredReport = (() => {
        const items = report as unknown as StockReportItem[]
        if (!smartFilters || Object.keys(smartFilters).length === 0) return items;

        return items.filter((item: StockReportItem) => {
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
    })();

    const columns = useMemo<ColumnDef<StockReportItem>[]>(() => [
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
                        <DataCell.Currency value={item.total_value} className="text-sm text-primary" />
                        <DataCell.Secondary className="text-[9px] opacity-40 uppercase tracking-tighter">
                            {formatCurrency(item.unit_cost)} c/{item.uom_name}
                        </DataCell.Secondary>
                    </div>
                )
            },
        },

        stockReportActions.column(stockReportActionsCtx) as unknown as ColumnDef<StockReportItem>,
    ], [setAdjustingProduct, setInsightsProduct])

    return (
        <PageContainer className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.stockreport"
                    columns={columns}
                    data={filteredReport}
                    isLoading={isLoading}
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={stockReportSearchDef} placeholder="Buscar por producto, SKU o categoría..." className="w-full" />}
                    showReset={isFiltered}
                    onReset={clearAll}
                    defaultPageSize={50}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "Sin productos para reportar",
                        description: "Cuando registres productos almacenables, su stock aparecerá aquí.",
                    }}
                    renderCard={(item: StockReportItem) => (
                        <EntityCard key={item.id}>
                            <EntityCard.Header
                                title={item.name}
                                subtitle={item.category_name}
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Stock" value={`${item.stock_qty ?? 0} ${item.uom_name ?? ''}`} />
                                <EntityCard.Field label="Disponible" value={`${item.qty_available ?? 0} ${item.uom_name ?? ''}`} />
                                <EntityCard.Field label="Valorización" value={<DataCell.Currency value={item.total_value} />} />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
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
                productId={(insightsProduct?.id as number) ?? null}
                productName={insightsProduct?.name ?? null}
            />
        </PageContainer>
    )
}
