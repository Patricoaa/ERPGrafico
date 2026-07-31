"use client"

import { useState, useMemo, useEffect } from "react"
import { DataTableView } from '@/components/shared'
import { AutoEntityCard } from '@/components/shared'
import { stockMoveActions, type StockMoveActionsCtx } from "@/features/inventory/stockMoveActions"
import { type ColumnDef } from "@tanstack/react-table"

import { LazyDrawer, type TransactionType } from "@/features/_shared"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { stockMoveFields, type StockMove } from "@/features/inventory/stockMoveFields"
interface MovementClientViewProps {
    createAction?: React.ReactNode
}

import { useStockMoves } from "@/features/inventory/hooks/useStockMoves"
import { useStockMoveAnalytics } from "@/features/inventory/hooks/useStockMoveAnalytics"
import { UnifiedSearchBar, useUnifiedSearch, MoneyDisplay, StatCard } from "@/components/shared"
import type { AnalyticsPanelConfig, Granularity } from "@/components/shared"
import { TrendingUp, Coins, Package, Warehouse, ArrowLeftRight } from "lucide-react"
import { stockMoveUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { toast } from "sonner"
import React from "react"



export function MovementClientView({ createAction }: MovementClientViewProps) {
    const search = useUnifiedSearch(stockMoveUnifiedSearchDef)
    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, moves, totalCount, isLoading } = useStockMoves({
        ...search.filters,
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? 5000 : pageState.pageSize,
    })

    const isOverLimit = isGrouping && totalCount > 5000
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<StockMove>({
        endpoint: '/inventory/stock-moves'
    })
    const { openView } = useEntityRouteActions()

    const viewingTransaction = selectedFromUrl ? { type: 'inventory' as TransactionType, id: selectedFromUrl.id } : null

    const actionsCtx: StockMoveActionsCtx = {
        onViewDetails: (id) => openView(id),
    }

    const columns = useMemo<ColumnDef<StockMove>[]>(() => [
        ...stockMoveFields.toColumns(),
        stockMoveActions.auto(actionsCtx),
    ], [actionsCtx])

    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("flujo")
    const [granularity, setGranularity] = useState<Granularity>("month")

    const analyticsData = useStockMoveAnalytics({
        months: 12,
        granularity,
        product_name: search.filters.product_name ?? null,
        date_from: search.filters.date_from ?? null,
        date_to: search.filters.date_to ?? null,
    })

    const analyticsPanel = useMemo<AnalyticsPanelConfig>(() => {
        const summary = analyticsData.summary
        const hasFlowData = analyticsData.flowLineChart.some(series => series.data.some(d => d.y > 0))
        const hasValueData = analyticsData.valueBarData.length > 0
        const hasProducts = analyticsData.topProductsBar.length > 0
        const hasLocations = analyticsData.locationBar.length > 0

        return {
            screen: {
                entityName: "Kardex",
                activeTab: analyticsActiveTab,
                onTabChange: setAnalyticsActiveTab,
                granularity,
                onGranularityChange: setGranularity,
                tabs: [
                    {
                        value: "flujo",
                        label: "Flujo",
                        icon: TrendingUp,
                        columns: [
                            {
                                id: "col-evolution",
                                weight: 3,
                                sections: [
                                    {
                                        id: "flow-evolution",
                                        content: hasFlowData ? {
                                            type: 'stat-card',
                                            config: {
                                                label: 'Evolución de Movimientos',
                                                variant: 'chart',
                                                chart: {
                                                    type: 'line-chart',
                                                    preset: 'card',
                                                    data: analyticsData.flowLineChart,
                                                    showLegend: true,
                                                    enableArea: true,
                                                    valueFormat: ',.1f',
                                                },
                                            },
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin movimientos en el período</p>
                                            ),
                                        },
                                    },
                                    {
                                        id: 'kpi-cards',
                                        content: summary ? {
                                            type: 'custom',
                                            render: (
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                                                    <StatCard
                                                        label="Movimientos"
                                                        value={String(summary.total_movements)}
                                                        variant="fill"
                                                        accent="primary"
                                                        icon={ArrowLeftRight}
                                                    />
                                                    <StatCard
                                                        label="Entradas"
                                                        value={`${summary.total_in_qty}`}
                                                        subtext="unidades"
                                                        variant="fill"
                                                        accent="success"
                                                        icon={TrendingUp}
                                                    />
                                                    <StatCard
                                                        label="Salidas"
                                                        value={`${summary.total_out_qty}`}
                                                        subtext="unidades"
                                                        variant="fill"
                                                        accent="warning"
                                                        icon={TrendingUp}
                                                    />
                                                    <StatCard
                                                        label="Valor Total"
                                                        value={<MoneyDisplay amount={parseFloat(summary.total_value)} inline />}
                                                        variant="fill"
                                                        accent="info"
                                                        icon={Coins}
                                                    />
                                                </div>
                                            ),
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin KPIs disponibles</p>
                                            ),
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        value: "valor",
                        label: "Valor",
                        icon: Coins,
                        columns: [
                            {
                                id: "col-value-trend",
                                weight: 2,
                                sections: [
                                    {
                                        id: 'value-bar',
                                        content: hasValueData ? {
                                            type: 'stat-card',
                                            config: {
                                                label: 'Valorización por Período',
                                                variant: 'chart',
                                                chart: {
                                                    type: 'bar-chart',
                                                    preset: 'card',
                                                    data: analyticsData.valueBarData,
                                                    keys: ['entradas', 'salidas', 'ajustes'],
                                                    indexBy: 'period',
                                                    valueFormat: '$,.0f',
                                                    showLegend: true,
                                                },
                                            },
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de valorización</p>
                                            ),
                                        },
                                    },
                                ],
                            },
                            {
                                id: "col-direction-value",
                                weight: 1,
                                sections: [
                                    {
                                        id: 'direction-value-donut',
                                        content: analyticsData.directionAmountPie.length > 0 ? {
                                            type: 'stat-card',
                                            config: {
                                                label: 'Valor por Tipo de Movimiento',
                                                variant: 'chart',
                                                chart: {
                                                    type: 'pie-chart',
                                                    preset: 'card',
                                                    data: analyticsData.directionAmountPie,
                                                    valueFormat: 'currency',
                                                    enableLabels: true,
                                                    arcLabel: (d: { value: number }) => {
                                                        const total = analyticsData.directionAmountPie.reduce((s, item) => s + item.value, 0);
                                                        return total > 0 ? `${Math.round((d.value / total) * 100)}%` : '';
                                                    },
                                                },
                                            },
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de valor</p>
                                            ),
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        value: "productos",
                        label: "Productos",
                        icon: Package,
                        columns: [
                            {
                                id: "col-top-products",
                                weight: 2,
                                sections: [
                                    {
                                        id: 'top-products-bar',
                                        content: hasProducts ? {
                                            type: 'stat-card',
                                            config: {
                                                label: 'Top Productos por Valor',
                                                variant: 'chart',
                                                chart: {
                                                    type: 'bar-chart',
                                                    preset: 'card',
                                                    data: analyticsData.topProductsBar,
                                                    keys: ['valor'],
                                                    indexBy: 'producto',
                                                    valueFormat: '$,.0f',
                                                },
                                            },
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de productos</p>
                                            ),
                                        },
                                    },
                                ],
                            },
                            {
                                id: "col-categories",
                                weight: 1,
                                sections: [
                                    {
                                        id: 'category-pie',
                                        content: analyticsData.categoryPie.length > 0 ? {
                                            type: 'stat-card',
                                            config: {
                                                label: 'Valor por Categoría',
                                                variant: 'chart',
                                                chart: {
                                                    type: 'pie-chart',
                                                    preset: 'card',
                                                    data: analyticsData.categoryPie,
                                                    valueFormat: 'currency',
                                                    enableLabels: true,
                                                },
                                            },
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de categorías</p>
                                            ),
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        value: "bodegas",
                        label: "Bodegas",
                        icon: Warehouse,
                        columns: [
                            {
                                id: "col-locations",
                                weight: 2,
                                sections: [
                                    {
                                        id: 'locations-bar',
                                        content: hasLocations ? {
                                            type: 'stat-card',
                                            config: {
                                                label: 'Movimientos por Ubicación',
                                                variant: 'chart',
                                                chart: {
                                                    type: 'bar-chart',
                                                    preset: 'card',
                                                    data: analyticsData.locationBar,
                                                    keys: ['entradas', 'salidas'],
                                                    indexBy: 'ubicacion',
                                                    valueFormat: ',.0f',
                                                    showLegend: true,
                                                },
                                            },
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de ubicaciones</p>
                                            ),
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        }
    }, [analyticsActiveTab, granularity, analyticsData])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.stockmove"
                    columns={columns}
                    data={moves}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination={!effectiveGrouping}
                    pageCount={effectiveGrouping ? 1 : page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 5000 } : pageState}
                    onPaginationChange={effectiveGrouping ? undefined : setPageState}
                    unifiedSearch={<UnifiedSearchBar
                        config={stockMoveUnifiedSearchDef}
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
                        placeholder="Buscar movimientos..."
                    />}
                    unifiedSearchConfig={stockMoveUnifiedSearchDef}
                    currentGroupBy={effectiveGrouping ? search.groupBy : null}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    analyticsPanel={analyticsPanel}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay movimientos de stock",
                        description: "Los movimientos se registran al recibir, despachar o ajustar inventario.",
                    }}
                    renderCard={(move: StockMove) => {
                        return (
                            <AutoEntityCard
                                key={move.id}
                                data={move}
                                fields={stockMoveFields}
                                entityLabel="inventory.stockmove"
                                actions={stockMoveActions.render(move, actionsCtx)}
                                defaultAction={stockMoveActions.defaultAction(actionsCtx)?.(move) ?? (() => openView(move.id))}

                            />
                        )
                    }}
                />
            </div>

            {viewingTransaction && (
                <LazyDrawer
                    type={viewingTransaction.type}
                    id={Number(viewingTransaction.id)}
                    open={!!viewingTransaction}
                    onOpenChange={(open) => {
                        if (!open) {
                            clearSelection()
                        }
                    }}
                />
            )}
        </div>
    )
}
