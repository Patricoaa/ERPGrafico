"use client"

import React, { useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import { DataTableView, AutoEntityCard, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import type { MultiSelectOption } from '@/types/unified-search'
import { type ColumnDef } from "@tanstack/react-table"

import { ProductInsightsModal } from "@/features/inventory/components/ProductInsightsModal"
import { ProductInsightsPanel } from "@/features/inventory/components/ProductInsightsPanel"
import { stockReportActions, type StockReportActionsCtx } from './stockReportActions'
import { useStockReport } from "@/features/inventory/hooks/useStockReport"
import { useCategories, useWarehouses } from '@/features/inventory'
import { stockReportUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { stockReportFields, type StockReportItem } from "@/features/inventory/stockReportFields"

export interface StockReportExternalFilters {
    search?: string
    category?: string
    product_type?: string
    is_active?: string
}

interface StockReportProps {
    /** When provided, disables the internal toolbar and uses these filters instead (embedded mode) */
    externalFilters?: StockReportExternalFilters
    /**
     * Embedded drill-down: when the user clicks a product row in embedded mode,
     * call this instead of opening the modal. The parent controls the transition.
     */
    onSelectProduct?: (item: StockReportItem) => void
    /**
     * Embedded drill-down: currently selected product. When set, render is
     * handled by the parent — this component renders nothing in that state.
     */
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

    // Standalone: reads product_id from URL for drill-down
    const urlProductId = embedded ? null : searchParams.get('product_id')
    const urlProductName = embedded ? null : searchParams.get('product_name')

    const warehouseId = embedded ? null : (search.paramValues.warehouse_id as string | null)
    const { report, isLoading } = useStockReport(warehouseId)

    // ── Action context ────────────────────────────────────────────────────────

    const handleSelectProduct = (item: StockReportItem) => {
        if (embedded && onSelectProduct) {
            // Embedded: delegate to parent
            onSelectProduct(item)
        } else {
            // Standalone: write to URL
            const params = new URLSearchParams(searchParams.toString())
            params.set('product_id', String(item.id))
            params.set('product_name', item.name ?? '')
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleBack = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('product_id')
        params.delete('product_name')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const stockReportActionsCtx: StockReportActionsCtx = {
        onHistory: (product) => handleSelectProduct(product as StockReportItem),
    }

    // ── Filtering ─────────────────────────────────────────────────────────────

    const activeFilters = embedded
        ? { search: externalFilters?.search, category: externalFilters?.category }
        : search.filters

    const isFiltered = embedded
        ? Boolean(externalFilters?.search || externalFilters?.category)
        : search.isFiltered

    const clearAll = async () => {
        if (!embedded) await search.clearAll()
    }

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

    const columns: ColumnDef<StockReportItem>[] = useMemo(() => [
        ...stockReportFields.toColumns(),
        stockReportActions.auto(stockReportActionsCtx) as unknown as ColumnDef<StockReportItem>,
    ], [stockReportActionsCtx])

    // ── Standalone drill-down: render insights panel from URL param ───────────

    if (!embedded && urlProductId) {
        return (
            <ProductInsightsPanel
                productId={Number(urlProductId)}
                productName={urlProductName}
                onBack={handleBack}
                onProductChange={(id, name) => {
                    const params = new URLSearchParams(searchParams.toString())
                    params.set('product_id', String(id))
                    params.set('product_name', name)
                    router.push(`${pathname}?${params.toString()}`, { scroll: false })
                }}
            />
        )
    }

    // ── Embedded: if parent drives drill-down, render nothing here ───────────
    // (parent renders ProductInsightsPanel in the analytics tab content)
    if (embedded && selectedProduct !== undefined && selectedProduct !== null) {
        return null
    }

    // ── Normal table view ─────────────────────────────────────────────────────

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.stockreport"
                    columns={columns}
                    data={filteredReport}
                    isLoading={isLoading}
                    variant="embedded"
                    forceView={embedded ? "list" : undefined}
                    hideToolbar={embedded}
                    unifiedSearch={embedded ? undefined : (
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
                    )}
                    showReset={!embedded && isFiltered}
                    onReset={clearAll}
                    defaultPageSize={50}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "Sin productos para reportar",
                        description: "Cuando registres productos almacenables, su stock aparecerá aquí.",
                    }}
                    renderCard={embedded ? undefined : (item: StockReportItem) => (
                        <AutoEntityCard
                            key={item.id}
                            data={item}
                            fields={stockReportFields}
                            entityLabel="inventory.stockreport"
                            actions={stockReportActions.render(item, stockReportActionsCtx)}
                        />
                    )}
                />
            </div>

            {/* Standalone modal (kept for backward compat, won't render when product_id is in URL) */}
            {!embedded && !urlProductId && (
                <ProductInsightsModal
                    open={false}
                    onOpenChange={() => undefined}
                    productId={null}
                    productName={null}
                />
            )}
        </div>
    )
}
