"use client"
import { formatCurrency } from "@/lib/money"

import React, { useState, useMemo } from "react"
import { ArrowRightLeft } from "lucide-react"
import { useQueryState, parseAsString } from 'nuqs'

import { BaseModal, DataCell, DataTableView, EntityCard, DataTableColumnHeader, UnifiedSearchBar, useUnifiedSearch, CancelButton, SubmitButton, FormFooter } from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { type ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { ProductInsightsModal } from "@/features/inventory/components/ProductInsightsModal"
import { stockReportActions, type StockReportActionsCtx } from './stockReportActions'
import { useStockReport } from "@/features/inventory/hooks/useStockReport"
import { StockReportCategoryFilter, StockReportWarehouseFilter } from './stockReportFilters'

interface StockReportItem {
    id: number | string
    name?: string
    code?: string
    internal_code?: string
    category_id?: number | string
    category_name?: string
    stock_qty?: number | string
    qty_reserved?: number | string
    qty_available?: number | string
    uom_name?: string
    unit_cost?: number | string
    total_value?: number | string
}

export function StockReport() {
    const [categoryValue, setCategoryValue] = useQueryState('category', parseAsString)
    const [warehouseId, setWarehouseId] = useQueryState('warehouse_id', parseAsString)

    const { report, isLoading, refetch } = useStockReport(warehouseId)

    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'Producto / SKU', serverParam: 'search', clientKey: ['name', 'code', 'internal_code'] },
        ],
        filters: [
            { key: 'stock_qty', label: 'Stock (Físico)', type: 'range', serverParamFrom: 'stock_qty_from', serverParamTo: 'stock_qty_to' },
            { key: 'qty_available', label: 'Disponible', type: 'range', serverParamFrom: 'qty_available_from', serverParamTo: 'qty_available_to' },
            { key: 'qty_reserved', label: 'Reservado', type: 'range', serverParamFrom: 'qty_reserved_from', serverParamTo: 'qty_reserved_to' },
            { key: 'total_value', label: 'Valorización', type: 'range', serverParamFrom: 'total_value_from', serverParamTo: 'total_value_to' },
        ],
    }), [])
    const search = useUnifiedSearch(config)

    const [adjustingProduct, setAdjustingProduct] = useState<StockReportItem | null>(null)
    const [insightsProduct, setInsightsProduct] = useState<StockReportItem | null>(null)
    const [isFormLoading, setIsFormLoading] = useState(false)

    const stockReportActionsCtx: StockReportActionsCtx = {
        onAdjust: (product) => setAdjustingProduct(product as StockReportItem | null),
        onHistory: (product) => setInsightsProduct(product as StockReportItem | null),
    }

    const isFiltered = search.isFiltered || categoryValue !== null || warehouseId !== null

    const clearAll = async () => {
        await search.clearAll()
        await setCategoryValue(null)
        await setWarehouseId(null)
    }

    const filteredReport = useMemo(() => {
        const items = report as unknown as StockReportItem[]
        if (!isFiltered) return items;

        return items.filter((item: StockReportItem) => {
            // Text search (Product/SKU)
            if (search.filters.search) {
                const searchVal = String(search.filters.search).toLowerCase();
                const matchesSearch =
                    item.name?.toLowerCase().includes(searchVal) ||
                    item.code?.toLowerCase().includes(searchVal) ||
                    item.internal_code?.toLowerCase().includes(searchVal);
                if (!matchesSearch) return false;
            }

            // Category filter
            if (categoryValue) {
                if (String(item.category_id) !== categoryValue) return false;
            }

            // Stock qty range
            if (search.filters.stock_qty_from) {
                if (Number(item.stock_qty) < Number(search.filters.stock_qty_from)) return false;
            }
            if (search.filters.stock_qty_to) {
                if (Number(item.stock_qty) > Number(search.filters.stock_qty_to)) return false;
            }

            // Available qty range
            if (search.filters.qty_available_from) {
                if (Number(item.qty_available) < Number(search.filters.qty_available_from)) return false;
            }
            if (search.filters.qty_available_to) {
                if (Number(item.qty_available) > Number(search.filters.qty_available_to)) return false;
            }

            // Reserved qty range
            if (search.filters.qty_reserved_from) {
                if (Number(item.qty_reserved) < Number(search.filters.qty_reserved_from)) return false;
            }
            if (search.filters.qty_reserved_to) {
                if (Number(item.qty_reserved) > Number(search.filters.qty_reserved_to)) return false;
            }

            // Valuation range
            if (search.filters.total_value_from) {
                if (Number(item.total_value) < Number(search.filters.total_value_from)) return false;
            }
            if (search.filters.total_value_to) {
                if (Number(item.total_value) > Number(search.filters.total_value_to)) return false;
            }

            return true;
        });
    }, [search.filters, report, categoryValue, warehouseId, isFiltered])

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
    ], [setAdjustingProduct, setInsightsProduct, stockReportActionsCtx])

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.stockreport"
                    columns={columns}
                    data={filteredReport}
                    isLoading={isLoading}
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={config}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar por producto o SKU..."
                        prefix={
                            <div className="flex items-center gap-0">
                                <StockReportCategoryFilter />
                                <StockReportWarehouseFilter />
                            </div>
                        }
                    />}
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
        </div>
    )
}
