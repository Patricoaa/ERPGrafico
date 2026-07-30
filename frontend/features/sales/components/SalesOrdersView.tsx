"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { DataTableView, DataCell, DomainHubStatus, AutoEntityCard, UnifiedSearchBar, useUnifiedSearch, DataTableColumnHeader } from '@/components/shared'
import { salesOrderFields } from "@/features/sales/salesOrderFields"
import { type ColumnDef } from "@tanstack/react-table"
import { ENTITY_REGISTRY, getEntityIcon } from "@/lib/entity-registry"

import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useSalesOrders, useSalesNotes, useSalesAnalyticsData, type SaleOrder, type SaleNote } from "@/features/sales"
import type { AnalyticsPanelConfig, Granularity } from '@/components/shared'
import { assignChartColors } from '@/lib/chart-colors'
import { formatMoney, formatQuantity } from '@/lib/money'
import { BarChart3, Smartphone, Users, Package, Truck } from "lucide-react"
import { salesOrderUnifiedSearchDef, salesNoteUnifiedSearchDef } from "@/features/sales/unifiedSearchDef"
import type { SaleOrderFilters } from "@/features/sales/types"
import { toast } from "sonner"

interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    posSessionId?: number | null
    onActionSuccess?: () => void
    hideStatusInCards?: boolean
    onSelectOrder?: (id: number | null) => void
    selectedId?: number | null
}

export function SalesOrdersView({ viewMode, posSessionId, onSelectOrder, selectedId }: SalesOrdersViewProps) {
    const { hubConfig, isHubOpen } = useHubPanel()
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    const toggleSelection = (id: number) => {
        if (onSelectOrder) {
            const isSelected = selectedId === id
            onSelectOrder(isSelected ? null : id)
            return
        }
        const isSelected = viewMode === "orders" ? hubConfig?.orderId === id : hubConfig?.invoiceId === id
        const params = new URLSearchParams(searchParams.toString())

        if (isSelected && isHubOpen) {
            params.delete('selected')
        } else {
            params.set('selected', String(id))
        }

        const query = params.toString()
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    const unifiedSearchDef = viewMode === 'orders' ? salesOrderUnifiedSearchDef : salesNoteUnifiedSearchDef
    const search = useUnifiedSearch(unifiedSearchDef)
    const isFiltered = search.isFiltered
    const isGrouping = search.groupBy !== null

    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 20 })
    const [pageStateNotes, setPageStateNotes] = useState({ pageIndex: 0, pageSize: 20 })

    const { page, orders, isLoading: isLoadingOrders, isRefetching } = useSalesOrders({
        filters: {
            ...(search.filters as SaleOrderFilters),
            pos_session: posSessionId || undefined,
            page: isGrouping ? 1 : pageState.pageIndex + 1,
            page_size: isGrouping ? 5000 : pageState.pageSize,
        },
    })
    const { page: pageNotes, notes, isLoading: isLoadingNotes, isRefetching: isRefetchingNotes } = useSalesNotes({
        filters: {
            ...(search.filters as Record<string, string>),
            page: isGrouping ? 1 : pageStateNotes.pageIndex + 1,
            page_size: isGrouping ? 5000 : pageStateNotes.pageSize,
        }
    })

    const totalCount = viewMode === 'orders' ? (page?.count ?? 0) : (pageNotes?.count ?? 0)
    const isOverLimit = isGrouping && totalCount > 5000
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])

    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("resumen")
    const [granularity, setGranularity] = useState<Granularity>("month")
    const analyticsData = useSalesAnalyticsData(orders, null, granularity)

    const analyticsPanel: AnalyticsPanelConfig = useMemo(() => {
        if (viewMode !== "orders") return { screen: { entityName: "", tabs: [] } }

        const lineVolume = [
            { id: "Total", data: analyticsData.monthlyVolume.map((m) => ({ x: m.month, y: m.total })) },
        ]

        const systemPosColors = assignChartColors([
            { id: "Sistema", value: analyticsData.systemOrderCount },
            { id: "POS", value: analyticsData.posOrderCount },
        ])

        const deliveryDist = assignChartColors([
            { id: "Entregado", value: analyticsData.deliveredCount },
            { id: "Pendiente", value: analyticsData.pendingDeliveryCount },
        ])

        return {
            screen: {
                entityName: "Órdenes de Venta",
                activeTab: analyticsActiveTab,
                onTabChange: setAnalyticsActiveTab,
                granularity,
                onGranularityChange: setGranularity,
                tabs: [
                    {
                        value: "resumen",
                        label: "Resumen",
                        icon: BarChart3,
                        columns: [
                            {
                                id: "col-kpi",
                                weight: 1,
                                sections: [
                                    {
                                        id: "kpi-volume",
                                        content: { type: "stat-card", config: { label: "Volumen Total", value: formatMoney(analyticsData.totalVolume), variant: "hero", trend: analyticsData.volumeTrend } },
                                    },
                                    {
                                        id: "kpi-paid",
                                        content: { type: "stat-card", config: { label: "Cobrado", value: formatMoney(analyticsData.totalPaid), variant: "hero", trend: analyticsData.paidTrend, accent: "success" } },
                                        fillRemaining: false,
                                    },
                                    {
                                        id: "kpi-pending",
                                        content: { type: "stat-card", config: { label: "Pendiente", value: formatMoney(analyticsData.totalPending), variant: "hero", accent: "warning" } },
                                        fillRemaining: false,
                                    },
                                    {
                                        id: "kpi-orders",
                                        content: { type: "stat-card", config: { label: "Órdenes", value: formatQuantity(analyticsData.orderCount), variant: "tile", trend: analyticsData.orderCountTrend } },
                                        fillRemaining: false,
                                    },
                                    {
                                        id: "kpi-avg",
                                        content: { type: "stat-card", config: { label: "Orden Promedio", value: formatMoney(analyticsData.avgOrderValue), variant: "tile", trend: analyticsData.avgOrderValueTrend } },
                                        fillRemaining: false,
                                    },
                                    {
                                        id: "kpi-customers",
                                        content: { type: "stat-card", config: { label: "Clientes", value: formatQuantity(analyticsData.customerCount), variant: "tile" } },
                                        fillRemaining: false,
                                    },
                                ],
                            },
                            {
                                id: "col-charts",
                                weight: 2,
                                sections: [
                                    {
                                        id: "volume-trend",
                                        content: { type: "stat-card", config: { label: "Evolución del Volumen", variant: "chart", subtext: "Monto total de órdenes por período", chart: { type: "line-chart", preset: "card", data: lineVolume, valueFormat: "$,.0f" } } },
                                    },
                                ],
                            },
                            {
                                id: "col-dist",
                                weight: 1,
                                sections: [
                                    {
                                        id: "price-range",
                                        content: { type: "stat-card", config: { label: "Órdenes por Rango de Precio", variant: "chart", subtext: "Distribución del valor total de las órdenes", chart: { type: "bar-chart", preset: "card", data: analyticsData.priceRangeDistribution, keys: ["value"], indexBy: "id", valueFormat: "number", axisBottomLegend: "Rango", axisLeftLegend: "Órdenes" } } },
                                    },
                                    {
                                        id: "channel-dist",
                                        content: { type: "stat-card", config: { label: "Canal de Venta", variant: "chart", subtext: "Sistema vs Punto de Venta", chart: { type: "pie-chart", preset: "card", data: systemPosColors, valueFormat: "number", compact: true } } },
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        value: "canales",
                        label: "Canales",
                        icon: Smartphone,
                        columns: [
                            {
                                id: "col-channel-main",
                                weight: 2,
                                sections: [
                                    {
                                        id: "channel-trend",
                                        content: { type: "stat-card", config: { label: "Tendencia por Canal", variant: "chart", subtext: "Volumen mensual desglosado por canal de venta", chart: { type: "line-chart", preset: "card", data: [{ id: "Sistema", data: analyticsData.channelTrend.map(m => ({ x: m.month, y: m.system })) }, { id: "POS", data: analyticsData.channelTrend.map(m => ({ x: m.month, y: m.pos })) }], valueFormat: "$,.0f", showLegend: true } } },
                                    },
                                    {
                                        id: "payment-dist",
                                        content: { type: "stat-card", config: { label: "Método de Pago", variant: "chart", subtext: "Formas de pago más utilizadas", chart: { type: "pie-chart", preset: "card", data: analyticsData.paymentMethodDistribution, valueFormat: "number", compact: true } } },
                                    },
                                ],
                            },
                            {
                                id: "col-channel-side",
                                weight: 1,
                                sections: [
                                    {
                                        id: "channel-pie",
                                        content: { type: "stat-card", config: { label: "Distribución por Canal", variant: "chart", subtext: "Proporción Sistema vs POS", chart: { type: "pie-chart", preset: "card", data: analyticsData.channelDistribution, valueFormat: "number", compact: true } } },
                                    },
                                    {
                                        id: "delivery-status-channel",
                                        content: { type: "stat-card", config: { label: "Estado de Despachos", variant: "chart", subtext: "Órdenes entregadas vs pendientes", chart: { type: "pie-chart", preset: "card", data: deliveryDist, valueFormat: "number", compact: true } } },
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        value: "clientes",
                        label: "Clientes",
                        icon: Users,
                        columns: [
                            {
                                id: "col-customers-main",
                                weight: 2,
                                sections: [
                                    {
                                        id: "top-customers",
                                        content: { type: "stat-card", config: { label: "Top Clientes por Volumen", variant: "chart", subtext: "Clientes con mayor facturación acumulada", chart: { type: "bar-chart", preset: "card", data: analyticsData.topCustomers, keys: ["total"], indexBy: "customer", valueFormat: "$,.0f" } } },
                                    },
                                ],
                            },
                            {
                                id: "col-customers-side",
                                weight: 1,
                                sections: [
                                    {
                                        id: "customer-dist",
                                        content: { type: "stat-card", config: { label: "Concentración por Cliente", variant: "chart", subtext: "Distribución del volumen entre clientes", chart: { type: "pie-chart", preset: "card", data: analyticsData.customerDistribution, valueFormat: "currency", compact: true } } },
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
                                id: "col-products-main",
                                weight: 2,
                                sections: [
                                    {
                                        id: "top-products",
                                        content: { type: "stat-card", config: { label: "Top Productos por Volumen", variant: "chart", subtext: "Productos con mayor facturación", chart: { type: "bar-chart", preset: "card", data: analyticsData.topProducts, keys: ["total"], indexBy: "product", valueFormat: "$,.0f" } } },
                                    },
                                ],
                            },
                            {
                                id: "col-products-side",
                                weight: 1,
                                sections: [
                                    {
                                        id: "product-type-dist",
                                        content: { type: "stat-card", config: { label: "Tipo de Producto", variant: "chart", subtext: "Distribución por tipo (Almacenable, Servicio, etc.)", chart: { type: "pie-chart", preset: "card", data: analyticsData.productTypeBreakdown, valueFormat: "currency", compact: true } } },
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        value: "despachos",
                        label: "Despachos",
                        icon: Truck,
                        columns: [
                            {
                                id: "col-dispatch-main",
                                weight: 2,
                                sections: [
                                    {
                                        id: "monthly-deliveries",
                                        content: { type: "stat-card", config: { label: "Despachos por Período", variant: "chart", subtext: "Órdenes entregadas en cada período", chart: { type: "line-chart", preset: "card", data: [{ id: "Entregadas", data: analyticsData.monthlyDeliveries.map(m => ({ x: m.month, y: m.count })) }], enableArea: true } } },
                                    },
                                ],
                            },
                            {
                                id: "col-dispatch-side",
                                weight: 1,
                                sections: [
                                    {
                                        id: "dispatch-status",
                                        content: { type: "stat-card", config: { label: "Estado de Despachos", variant: "chart", subtext: "Órdenes entregadas vs pendientes", chart: { type: "pie-chart", preset: "card", data: analyticsData.deliveryStatusDistribution, valueFormat: "number", compact: true } } },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        }
    }, [analyticsData, viewMode, analyticsActiveTab, granularity])

    const columns: ColumnDef<SaleOrder>[] = [
        ...salesOrderFields.toColumns(),
    ]

    const noteColumns: ColumnDef<SaleNote>[] = [
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Documento" className="justify-center" />,
            cell: ({ row }) => <DataCell.Text className="font-normal uppercase text-[11px]">{row.original.dte_type_display}</DataCell.Text>,
        },
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Número" className="justify-center" />,
            cell: ({ row }) => <DataCell.Code>{row.original.display_id ?? row.original.number}</DataCell.Code>,
        },
        {
            accessorKey: "customer_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
            cell: ({ row }) => <DataCell.ContactLink contactId={(row.original as unknown as Record<string, unknown>).customer as number || row.original.partner}>{(row.original as unknown as Record<string, unknown>).customer_name as string || row.original.partner_name}</DataCell.ContactLink>,
        },
        {
            accessorKey: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" className="justify-center" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estados" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center items-center">
                    <DomainHubStatus label="billing.invoice" data={row.original} />
                </div>
            ),
        },
    ]

    // Determine entity label based on tab
    const entityLabel = viewMode === 'orders' ? 'sales.saleorder' : 'billing.invoice'

    const getSelectionId = (item: SaleOrder | SaleNote) => {
        const id = Number(item.id)
        if (onSelectOrder) return selectedId === id
        return viewMode === 'orders' ? hubConfig?.orderId === id : hubConfig?.invoiceId === id
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel={entityLabel}
                    columns={(viewMode === 'orders' ? columns : noteColumns) as unknown as ColumnDef<SaleOrder | SaleNote, unknown>[]}
                    data={(viewMode === 'orders' ? orders : notes) as unknown as (SaleOrder | SaleNote)[]}
                    onRowClick={(row: SaleOrder | SaleNote) => toggleSelection(row.id)}
                    variant="embedded"
                    analyticsPanel={viewMode === 'orders' ? analyticsPanel : undefined}
                    isLoading={viewMode === 'orders' ? isLoadingOrders : isLoadingNotes}
                    isRefetching={viewMode === 'orders' ? isRefetching : isRefetchingNotes}
                    renderCard={(data: SaleOrder | SaleNote) => {
                        const label = viewMode === 'orders' ? 'sales.saleorder' : 'billing.invoice'
                        const d = data as unknown as Record<string, unknown>
                        const config = ENTITY_REGISTRY[label]?.cardConfig
                        const iconClassName = typeof config?.iconClassName === 'function' ? config.iconClassName(d) : config?.iconClassName
                        return (
                            <AutoEntityCard
                                key={data.id}
                                data={data as any}
                                fields={viewMode === 'orders' ? salesOrderFields as any : undefined as any}
                                entityLabel={label}
                                onClick={() => toggleSelection(data.id)}
                                isSelected={getSelectionId(data)}
                                className={isHubOpen && getSelectionId(data) ? "accent-visible" : isHubOpen ? "opacity-40 grayscale-[0.2] blur-[0.2px]" : ""}
                                icon={getEntityIcon(label)}
                                iconClassName={iconClassName}
                                hubTrigger={{
                                    isSelected: getSelectionId(data),
                                    onToggle: () => toggleSelection(data.id),
                                }}
                            />
                        )
                    }}
                    manualPagination={!effectiveGrouping}
                    pageCount={effectiveGrouping ? 1 : viewMode === 'orders'
                        ? (page ? Math.ceil(page.count / page.pageSize) : 0)
                        : (pageNotes ? Math.ceil(pageNotes.count / pageNotes.pageSize) : 0)
                    }
                    rowCount={viewMode === 'orders' ? (page?.count ?? 0) : (pageNotes?.count ?? 0)}
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 5000 } : viewMode === 'orders' ? pageState : pageStateNotes}
                    onPaginationChange={effectiveGrouping ? undefined : (viewMode === 'orders' ? setPageState : setPageStateNotes) as unknown as React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>}
                    unifiedSearch={<UnifiedSearchBar
                        config={unifiedSearchDef}
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
                        placeholder={viewMode === 'orders' ? 'Buscar órdenes...' : 'Buscar notas...'}
                    />}
                    unifiedSearchConfig={unifiedSearchDef}
                    currentGroupBy={effectiveGrouping ? search.groupBy : null}
                    showReset={isFiltered}
                    onReset={search.clearAll}
                    defaultPageSize={20}
                    isSelected={(data: SaleOrder | SaleNote) => !!getSelectionId(data)}
                    isHubOpen={onSelectOrder ? !!selectedId : isHubOpen}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: viewMode === 'orders' ? "sale" : "finance",
                        title: viewMode === 'orders' ? "Aún no hay órdenes de venta" : "Aún no hay notas",
                        description: viewMode === 'orders'
                            ? "Crea una orden de venta o regístrala desde el punto de venta."
                            : "Las notas de crédito y débito asociadas a tus ventas aparecerán aquí.",
                    }}
                />
            </div>
        </div>
    )
}
