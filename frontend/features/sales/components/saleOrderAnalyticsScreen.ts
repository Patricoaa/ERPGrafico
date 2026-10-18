import type { AnalyticsPanelContentProps, Granularity } from "@/components/shared"
import { assignChartColors } from "@/lib/chart-colors"
import { formatMoney, formatQuantity } from "@/lib/money"
import { getDomainConceptTitle } from "@/lib/entity-registry"
import { BarChart3, Package, Smartphone, Truck, Users } from "lucide-react"
import type { SalesAnalyticsData } from "../hooks/useSalesAnalyticsData"

export interface SalesAnalyticsUi {
    activeTab: string
    onTabChange: (tab: string) => void
    granularity: Granularity
    onGranularityChange: (granularity: Granularity) => void
}

/** Analytics tabs of the sales orders screen; figures come from the server (whole filtered list). */
export function buildSalesAnalyticsScreen(analyticsData: SalesAnalyticsData, ui: SalesAnalyticsUi): AnalyticsPanelContentProps {
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
