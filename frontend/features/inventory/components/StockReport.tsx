"use client"

import { useMemo, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import type { MultiSelectOption } from '@/types/unified-search'
import { stockReportActions, type StockReportActionsCtx } from './stockReportActions'
import { useStockReport } from "@/features/inventory/hooks/useStockReport"
import { useCategories, useWarehouses } from '@/features/inventory'
import { stockReportUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { stockReportEntity, stockReportViews, type StockReportItem } from "@/features/inventory/entity-view/stockReport.entity"
import { ProductInsightsDrawer } from "./ProductInsightsDrawer"

export interface StockReportExternalFilters {
    search?: string
    category?: string
    product_type?: string
    is_active?: string
}

interface StockReportProps {
    externalFilters?: StockReportExternalFilters
    onSelectProduct?: (item: StockReportItem) => void
    selectedProduct?: StockReportItem | null
}

export function StockReport({ externalFilters, onSelectProduct, selectedProduct }: StockReportProps = {}) {
    const embedded = externalFilters !== undefined
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { categories } = useCategories()
    const { warehouses } = useWarehouses()

    const filterOptions: Record<string, MultiSelectOption[]> = useMemo(() => ({
        category: categories.map((c) => ({ label: c.name, value: String(c.id) })),
        warehouse: warehouses.map((w) => ({ label: w.name, value: String(w.id) })),
    }), [categories, warehouses])

    const search = useUnifiedSearch(stockReportUnifiedSearchDef, filterOptions)
    const handleReset = useCallback(() => { search.clearAll() }, [search])

    const urlProductId = embedded ? null : searchParams.get('product_id')
    const urlProductName = embedded ? null : searchParams.get('product_name')

    // Standalone drill-down: the URL is the drawer's state (shareable, survives reload)
    const detailProductId = urlProductId ? Number(urlProductId) : null
    const detailProductName = urlProductName

    const warehouseId = embedded ? null : (search.paramValues.warehouse_id as string | null)
    const { report, isLoading } = useStockReport(warehouseId)

    const handleSelectProduct = (item: StockReportItem) => {
        if (embedded && onSelectProduct) {
            onSelectProduct(item)
        } else {
            const params = new URLSearchParams(searchParams.toString())
            params.set('product_id', String(item.id))
            params.set('product_name', item.name ?? '')
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleCloseDrawer = (open: boolean) => {
        if (!open && !embedded) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete('product_id')
            params.delete('product_name')
            const query = params.toString()
            router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }

    const stockReportActionsCtx: StockReportActionsCtx = {
        onHistory: (product) => handleSelectProduct(product),
    }

    const activeFilters = embedded
        ? { search: externalFilters?.search, category: externalFilters?.category }
        : search.filters

    const isFiltered = embedded
        ? Boolean(externalFilters?.search || externalFilters?.category)
        : search.isFiltered

    const filteredReport = useMemo(() => {
        const items = report as unknown as StockReportItem[]
        if (!isFiltered) return items

        return items.filter((item: StockReportItem) => {
            if (activeFilters.search) {
                const searchVal = String(activeFilters.search).toLowerCase()
                const matchesSearch =
                    item.name?.toLowerCase().includes(searchVal) ||
                    item.code?.toLowerCase().includes(searchVal) ||
                    item.internal_code?.toLowerCase().includes(searchVal)
                if (!matchesSearch) return false
            }

            if (activeFilters.category) {
                if (String(item.category_id) !== activeFilters.category) return false
            }

            if (!embedded) {
                const sf = search.filters
                if (sf.stock_qty_from && Number(item.stock_qty) < Number(sf.stock_qty_from)) return false
                if (sf.stock_qty_to && Number(item.stock_qty) > Number(sf.stock_qty_to)) return false
                if (sf.qty_available_from && Number(item.qty_available) < Number(sf.qty_available_from)) return false
                if (sf.qty_available_to && Number(item.qty_available) > Number(sf.qty_available_to)) return false
                if (sf.qty_reserved_from && Number(item.qty_reserved) < Number(sf.qty_reserved_from)) return false
                if (sf.qty_reserved_to && Number(item.qty_reserved) > Number(sf.qty_reserved_to)) return false
                if (sf.total_value_from && Number(item.total_value) < Number(sf.total_value_from)) return false
                if (sf.total_value_to && Number(item.total_value) > Number(sf.total_value_to)) return false
            }

            return true
        })
    }, [activeFilters, search.filters, report, isFiltered, embedded])

    const collection = useEntityCollection(
        stockReportEntity,
        { rows: isLoading ? [] : filteredReport },
        { pagination: { mode: "client", pageSize: 50 } },
    )

    // Embedded: if parent drives drill-down, render nothing here
    if (embedded && selectedProduct !== undefined && selectedProduct !== null) {
        return null
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col min-h-0">
                <Collection.Root
                    collection={collection}
                    onOpen={(item) => handleSelectProduct(item)}
                    actions={stockReportActions.forCollection(stockReportActionsCtx)}
                >
                    {!embedded && (
                        <Collection.Toolbar>
                            <UnifiedSearchBar
                                config={stockReportUnifiedSearchDef}
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
                                filterOptions={search.filterOptions}
                                placeholder="Buscar por producto o SKU..."
                            />
                        </Collection.Toolbar>
                    )}
                    <Collection.View
                        table={stockReportViews.table}
                        card={embedded ? undefined : stockReportViews.card}
                        emptyTitle="Sin productos para reportar"
                        emptyDescription="Cuando registres productos almacenables, su stock aparecerá aquí."
                        onResetFilters={!embedded && isFiltered ? handleReset : undefined}
                    />
                </Collection.Root>
            </div>

            {!embedded && (
                <ProductInsightsDrawer
                    productId={detailProductId}
                    productName={detailProductName}
                    open={!!detailProductId}
                    onOpenChange={handleCloseDrawer}
                    onProductChange={(id, name) => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.set('product_id', String(id))
                        params.set('product_name', name)
                        router.push(`${pathname}?${params.toString()}`, { scroll: false })
                    }}
                />
            )}
        </div>
    )
}
