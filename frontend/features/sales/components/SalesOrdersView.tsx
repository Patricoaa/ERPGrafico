"use client"

import React, { useMemo, useState } from "react"
import { AnalyticsPanelContent, EmptyState, SkeletonShell, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, type AnalyticsPanelContentProps, type Granularity } from '@/components/shared'
import { Button } from "@/components/ui/button"
import {
    Collection,
    GROUP_ROW_LIMIT,
    orderingParam,
    useCollectionViewMode,
    useEntityCollection,
    useServerPage,
    type FieldId,
    type SortSpec,
} from "@/components/entity-view"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { EMPTY_SALES_ANALYTICS, useSaleOrderAnalytics, useSalesNotes, useSalesOrders, type SalesAnalyticsData } from "@/features/sales"
import { assignChartColors } from '@/lib/chart-colors'
import { formatMoney, formatQuantity } from '@/lib/money'
import { AlertTriangle, BarChart3, Smartphone, Users, Package, Truck } from "lucide-react"
import { salesOrderUnifiedSearchDef, salesNoteUnifiedSearchDef } from "@/features/sales/unifiedSearchDef"
import type { SaleOrderFilters } from "@/features/sales/types"
import { getDomainConceptTitle } from "@/lib/entity-registry"
import { saleOrderEntity, saleOrderViews } from "../entity-view/saleOrder.entity"
import { saleNoteEntity, saleNoteViews } from "../entity-view/saleNote.entity"

interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    posSessionId?: number | null
    onSelectOrder?: (id: number | null) => void
    selectedId?: number | null
}

/** Shared selection: the document sheet (?selected, ADR-0083) or, in POS, the host's own selection. */
interface SheetSelection {
    selectedId: number | null
    toggle: (id: number) => void
}

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const ORDER_GROUPS: Record<string, FieldId<typeof saleOrderEntity.fields>> = { date: "date", customer: "customer", status: "hub", channel: "channel" }
const NOTE_GROUPS: Record<string, FieldId<typeof saleNoteEntity.fields>> = { date: "date", customer: "customer", status: "hub" }

export function SalesOrdersView({ viewMode, posSessionId, onSelectOrder, selectedId }: SalesOrdersViewProps) {
    // ?selected abre la ficha documental en la pila (ADR-0083): OV en "orders", factura/nota
    // en "notes". Con onSelectOrder (POS) la lista solo selecciona; el panel lo pone el host.
    const sheet = useDocumentSheetRoute(onSelectOrder ? null : (viewMode === "orders" ? "sales.saleorder" : "billing.invoice"))
    const selection: SheetSelection = onSelectOrder
        ? { selectedId: selectedId ?? null, toggle: (id) => onSelectOrder(selectedId === id ? null : id) }
        : { selectedId: sheet.selectedId ?? null, toggle: (id) => sheet.toggle(id) }

    // One collection per mode, each with its own hook: the hidden mode no longer fetches.
    return viewMode === "orders"
        ? <SaleOrderCollection posSessionId={posSessionId} selection={selection} />
        : <SaleNoteCollection selection={selection} />
}

function SaleOrderCollection({ posSessionId, selection }: { posSessionId?: number | null; selection: SheetSelection }) {
    const search = useUnifiedSearch(salesOrderUnifiedSearchDef)
    const groupBy = search.groupBy ? ORDER_GROUPS[search.groupBy] ?? null : null
    const [sort, setSort] = useState<SortSpec<FieldId<typeof saleOrderEntity.fields>> | null>(null)
    const filters = useMemo<SaleOrderFilters>(
        () => ({ ...(search.filters as SaleOrderFilters), pos_session: posSessionId || undefined }),
        [search.filters, posSessionId],
    )
    const [pageState, setPageState] = useServerPage([filters, sort, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("sales.saleorder")

    const { page, orders, isLoading, isRefetching, isError, refetch } = useSalesOrders({
        filters: {
            ...filters,
            ordering: orderingParam(saleOrderEntity, sort),
            page: groupBy ? 1 : pageState.pageIndex + 1,
            page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
        },
    })

    // Figures over the whole filtered list, fetched only while the analytics view is open.
    const [activeTab, setActiveTab] = useState("resumen")
    const [granularity, setGranularity] = useState<Granularity>("month")
    const { analytics, isLoading: isLoadingAnalytics, isError: isAnalyticsError, refetch: refetchAnalytics } = useSaleOrderAnalytics({ filters, granularity, enabled: view === "analytics" })
    const analyticsScreen = useMemo(
        () => buildSalesAnalyticsScreen(analytics ?? EMPTY_SALES_ANALYTICS, { activeTab, onTabChange: setActiveTab, granularity, onGranularityChange: setGranularity }),
        [analytics, activeTab, granularity],
    )

    const collection = useEntityCollection(
        saleOrderEntity,
        { rows: orders, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            sorting: { mode: "server", state: sort, onChange: setSort },
            groupBy,
        },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={selection.selectedId}
                onOpen={(order) => selection.toggle(order.id)}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={salesOrderUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar órdenes..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={saleOrderViews.table}
                    card={saleOrderViews.card}
                    emptyTitle="Aún no hay órdenes de venta"
                    emptyDescription="Crea una orden de venta o regístrala desde el punto de venta."
                    onResetFilters={search.clearAll}
                />
                <Collection.Analytics>
                    {isAnalyticsError ? (
                        <EmptyState
                            icon={AlertTriangle}
                            context="generic"
                            title="No pudimos cargar la analítica"
                            description="Revisa tu conexión e intenta nuevamente."
                            action={<Button variant="outline" size="sm" onClick={() => void refetchAnalytics()}>Reintentar</Button>}
                        />
                    ) : (
                        // Zeros under a shimmer while loading: never shown as real figures.
                        <SkeletonShell isLoading={isLoadingAnalytics} ariaLabel="Cargando analítica" className="flex min-h-0 flex-1 flex-col">
                            <AnalyticsPanelContent {...analyticsScreen} />
                        </SkeletonShell>
                    )}
                </Collection.Analytics>
            </Collection.Root>
        </div>
    )
}

function SaleNoteCollection({ selection }: { selection: SheetSelection }) {
    const search = useUnifiedSearch(salesNoteUnifiedSearchDef)
    const groupBy = search.groupBy ? NOTE_GROUPS[search.groupBy] ?? null : null
    const filters = search.filters as Record<string, string>
    const [pageState, setPageState] = useServerPage([filters, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("billing.invoice")

    const { page, notes, isLoading, isRefetching, isError, refetch } = useSalesNotes({
        filters: {
            ...filters,
            page: groupBy ? 1 : pageState.pageIndex + 1,
            page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
        },
    })

    const collection = useEntityCollection(
        saleNoteEntity,
        { rows: notes, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            // No `sorting`: with server pagination the core disables sorting (invoices have no server ordering yet).
            groupBy,
        },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={selection.selectedId}
                onOpen={(note) => selection.toggle(note.id)}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={salesNoteUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar notas..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={saleNoteViews.table}
                    card={saleNoteViews.card}
                    emptyTitle="Aún no hay notas"
                    emptyDescription="Las notas de crédito y débito asociadas a tus ventas aparecerán aquí."
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}

interface AnalyticsUi {
    activeTab: string
    onTabChange: (tab: string) => void
    granularity: Granularity
    onGranularityChange: (granularity: Granularity) => void
}

/** Analytics tabs of the sales orders screen; figures come from the server (whole filtered list). */
function buildSalesAnalyticsScreen(analyticsData: SalesAnalyticsData, ui: AnalyticsUi): AnalyticsPanelContentProps {
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
                entityName: getDomainConceptTitle('ov', true),
                activeTab: ui.activeTab,
                onTabChange: ui.onTabChange,
                granularity: ui.granularity,
                onGranularityChange: ui.onGranularityChange,
                tabs: [
                    {
                        value: "resumen",
                        label: "Resumen",
                        icon: BarChart3,
                        gridRows: "max-content 1fr",
                        columns: [
                            {
                                id: "col-1",
                                weight: 1,
                                sections: [
                                    {
                                        id: "kpi-volume",
                                        colSpan: 1,
                                        content: { type: "stat-card", config: { label: "Volumen Total", value: formatMoney(analyticsData.totalVolume), variant: "hero", trend: analyticsData.volumeTrend } },
                                    },
                                ],
                            },
                            {
                                id: "col-2",
                                weight: 1,
                                sections: [
                                    {
                                        id: "kpi-paid",
                                        colSpan: 1,
                                        content: { type: "stat-card", config: { label: "Cobrado", value: formatMoney(analyticsData.totalPaid), variant: "hero", trend: analyticsData.paidTrend, accent: "success" } },
                                    },
                                ],
                            },
                            {
                                id: "col-3",
                                weight: 1,
                                sections: [
                                    {
                                        id: "kpi-pending",
                                        colSpan: 1,
                                        content: { type: "stat-card", config: { label: "Pendiente", value: formatMoney(analyticsData.totalPending), variant: "hero", accent: "warning" } },
                                    },
                                ],
                            },
                            {
                                id: "col-4",
                                weight: 1,
                                sections: [
                                    {
                                        id: "kpi-orders",
                                        colSpan: 1,
                                        content: { type: "stat-card", config: { label: "Órdenes", value: formatQuantity(analyticsData.orderCount), variant: "tile", trend: analyticsData.orderCountTrend } },
                                    },
                                ],
                            },
                            {
                                id: "col-5",
                                weight: 1,
                                sections: [
                                    {
                                        id: "kpi-avg",
                                        colSpan: 1,
                                        content: { type: "stat-card", config: { label: "Orden Promedio", value: formatMoney(analyticsData.avgOrderValue), variant: "tile", trend: analyticsData.avgOrderValueTrend } },
                                    },
                                ],
                            },
                            {
                                id: "col-6",
                                weight: 1,
                                sections: [
                                    {
                                        id: "kpi-customers",
                                        colSpan: 1,
                                        content: { type: "stat-card", config: { label: "Clientes", value: formatQuantity(analyticsData.customerCount), variant: "tile" } },
                                    },
                                    {
                                        id: "volume-trend",
                                        colSpan: 3,
                                        content: { type: "stat-card", config: { label: "Evolución del Volumen", variant: "chart", subtext: "Monto total de órdenes por período", chart: { type: "line-chart", preset: "card", data: lineVolume, valueFormat: "$,.0f" } } },
                                    },
                                    {
                                        id: "price-range",
                                        colSpan: 2,
                                        content: { type: "stat-card", config: { label: "Órdenes por Rango de Precio", variant: "chart", subtext: "Distribución del valor total de las órdenes", chart: { type: "bar-chart", preset: "card", data: analyticsData.priceRangeDistribution, keys: ["value"], indexBy: "id", axisBottomLegend: "Rango", axisLeftLegend: "Órdenes" } } },
                                    },
                                    {
                                        id: "channel-dist",
                                        colSpan: 1,
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
        }
}
