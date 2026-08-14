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
import { UnifiedSearchBar, useUnifiedSearch, StatCard, KPIWrapper, KPIValue } from "@/components/shared"
import type { AnalyticsPanelConfig, Granularity } from "@/components/shared"
import { TrendingUp, Package, Warehouse, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { chartColor } from "@/lib/chart-colors"
import { stockMoveUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { resolveStockMoveIcon } from "@/lib/movement-icons"
import { toast } from "sonner"
import React from "react"



export function MovementClientView({ createAction }: MovementClientViewProps) {
    const search = useUnifiedSearch(stockMoveUnifiedSearchDef)
    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, moves, totalCount, isLoading } = useStockMoves({
        ...search.filters,
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? 200 : pageState.pageSize,
    })

    const isOverLimit = isGrouping && totalCount > 200
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<StockMove>({
        endpoint: '/inventory/moves'
    })
    const { openView } = useEntityRouteActions()

    const viewingTransaction = selectedFromUrl ? { type: 'stock_move' as TransactionType, id: selectedFromUrl.id } : null

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
        const hasFlowData = analyticsData.flowLineChart.some(series => series.data.some(d => d.y > 0))
        const directions = analyticsData.analytics?.direction_distribution ?? []
        const inRow = directions.find(d => d.id === "IN")
        const outRow = directions.find(d => d.id === "OUT")
        const inCount = inRow?.count ?? 0
        const outCount = outRow?.count ?? 0
        const inValue = inRow ? parseFloat(inRow.amount) : 0
        const outValue = outRow ? parseFloat(outRow.amount) : 0
        const entradaColor = chartColor(0)
        const salidaColor = chartColor(1)
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
                                        id: "kpi-row",
                                        fillRemaining: false,
                                        content: {
                                            type: 'custom',
                                            render: (
                                                <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                                                    <KPIWrapper tooltip="Número de movimientos que ingresaron al inventario en el período: compras, devoluciones de clientes, transferencias entrantes y ajustes positivos.">
                                                        <StatCard
                                                            label="Cantidad de Entradas"
                                                            className="h-full rounded-sm"
                                                        >
                                                            <div className="flex items-center gap-2" style={{ color: entradaColor }}>
                                                                <ArrowDownLeft className="h-5 w-5" />
                                                                <span className="text-3xl font-black tracking-tighter">
                                                                    <KPIValue current={inCount} />
                                                                </span>
                                                            </div>
                                                        </StatCard>
                                                    </KPIWrapper>
                                                    <KPIWrapper tooltip="Valor total de las unidades que ingresaron al inventario en el período (cantidad × costo unitario).">
                                                        <StatCard
                                                            label="Valor Total de Entradas"
                                                            className="h-full rounded-sm"
                                                        >
                                                            <div className="flex items-center gap-2" style={{ color: entradaColor }}>
                                                                <ArrowDownLeft className="h-5 w-5" />
                                                                <span className="text-3xl font-black tracking-tighter">
                                                                    <KPIValue current={inValue} isCurrency />
                                                                </span>
                                                            </div>
                                                        </StatCard>
                                                    </KPIWrapper>
                                                    <KPIWrapper tooltip="Número de movimientos que salieron del inventario en el período: ventas, consumos de producción, transferencias salientes y ajustes negativos.">
                                                        <StatCard
                                                            label="Cantidad de Salidas"
                                                            className="h-full rounded-sm"
                                                        >
                                                            <div className="flex items-center gap-2" style={{ color: salidaColor }}>
                                                                <ArrowUpRight className="h-5 w-5" />
                                                                <span className="text-3xl font-black tracking-tighter">
                                                                    <KPIValue current={outCount} />
                                                                </span>
                                                            </div>
                                                        </StatCard>
                                                    </KPIWrapper>
                                                    <KPIWrapper tooltip="Valor total de las unidades que salieron del inventario en el período (cantidad × costo unitario).">
                                                        <StatCard
                                                            label="Valor Total de Salidas"
                                                            className="h-full rounded-sm"
                                                        >
                                                            <div className="flex items-center gap-2" style={{ color: salidaColor }}>
                                                                <ArrowUpRight className="h-5 w-5" />
                                                                <span className="text-3xl font-black tracking-tighter">
                                                                    <KPIValue current={outValue} isCurrency />
                                                                </span>
                                                            </div>
                                                        </StatCard>
                                                    </KPIWrapper>
                                                </div>
                                            ),
                                        },
                                    },
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
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 200 } : pageState}
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
                        const { icon, iconClassName } = resolveStockMoveIcon(move)
                        return (
                            <AutoEntityCard
                                key={move.id}
                                data={move}
                                fields={stockMoveFields}
                                entityLabel="inventory.stockmove"
                                icon={icon}
                                iconClassName={iconClassName}
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
