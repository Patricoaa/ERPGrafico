import type { ReactNode } from "react"
import type { AnalyticsPanelContentProps } from "@/components/shared"
import { BarChart3, Boxes, Package, Store, ShoppingCart, ShoppingBag, Warehouse } from "lucide-react"
import { formatQuantity } from "@/lib/money"
import type { ProductAnalyticsData } from "../hooks/useProductAnalytics"

export interface ProductAnalyticsSet {
    resumen: ProductAnalyticsData
    ventas: ProductAnalyticsData
    compras: ProductAnalyticsData
}

export interface ProductAnalyticsUi {
    activeTab: string
    onTabChange: (tab: string) => void
    /** Embedded stock report of the "Existencias" tab (owns its own query and selection). */
    stockReport: ReactNode
}

/** Analytics tabs of the products screen; figures come from the server (whole filtered catalog). */
export function buildProductAnalyticsScreen(data: ProductAnalyticsSet, ui: ProductAnalyticsUi): AnalyticsPanelContentProps {
    return {
        entityName: "Inventario de Productos",
        activeTab: ui.activeTab,
        onTabChange: ui.onTabChange,
        tabs: [
            {
                value: "resumen",
                label: "Resumen",
                icon: BarChart3,
                gridRows: "max-content 1fr",
                columns: [
                    {
                        id: "col-resumen-1",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-total-products",
                                colSpan: 1,
                                fillRemaining: false,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Total Productos",
                                        value: formatQuantity(data.resumen.summary.totalProducts),
                                        icon: Package,
                                        accent: "primary",
                                        valueSize: "xl",
                                        loading: data.resumen.analyticsLoading,
                                    },
                                },
                            },
                            {
                                id: "type-distribution",
                                colSpan: 1,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Distribución por Tipo",
                                        variant: "chart",
                                        loading: data.resumen.analyticsLoading,
                                        subtext: "Proporción del catálogo por tipo de producto",
                                        chart: { type: "pie-chart", preset: "card", data: data.resumen.typePie, valueFormat: "number", compact: true },
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-resumen-2",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-with-stock",
                                colSpan: 1,
                                fillRemaining: false,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Con Stock",
                                        value: formatQuantity(data.resumen.summary.withStock),
                                        icon: Boxes,
                                        accent: "success",
                                        valueSize: "xl",
                                        loading: data.resumen.analyticsLoading,
                                    },
                                },
                            },
                            {
                                id: "availability-distribution",
                                colSpan: 1,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Disponibilidad",
                                        variant: "chart",
                                        loading: data.resumen.analyticsLoading,
                                        subtext: "Productos para ventas vs compras",
                                        chart: { type: "pie-chart", preset: "card", data: data.resumen.availabilityPie, valueFormat: "number", compact: true },
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-resumen-3",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-out-of-stock",
                                colSpan: 1,
                                fillRemaining: false,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Agotados",
                                        value: formatQuantity(data.resumen.summary.outOfStock),
                                        icon: Store,
                                        accent: "warning",
                                        valueSize: "xl",
                                        loading: data.resumen.analyticsLoading,
                                    },
                                },
                            },
                            {
                                id: "category-distribution",
                                colSpan: 1,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Distribución por Categoría",
                                        variant: "chart",
                                        loading: data.resumen.analyticsLoading,
                                        subtext: "Productos por categoría",
                                        chart: { type: "pie-chart", preset: "card", data: data.resumen.categoryPie, valueFormat: "number", compact: true },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            {
                value: "ventas",
                label: "Ventas",
                icon: ShoppingCart,
                gridRows: "max-content 1fr",
                columns: [
                    {
                        id: "col-ventas-1",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-sellable",
                                colSpan: 2,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Disponibles para Venta",
                                        value: formatQuantity(data.ventas.summary.totalProducts),
                                        icon: ShoppingCart,
                                        accent: "primary",
                                        valueSize: "xl",
                                        loading: data.ventas.analyticsLoading,
                                    },
                                },
                            },
                            {
                                id: "ventas-type-distribution",
                                colSpan: 1,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Distribución por Tipo",
                                        variant: "chart",
                                        loading: data.ventas.analyticsLoading,
                                        subtext: "Tipos de producto vendibles",
                                        chart: { type: "pie-chart", preset: "card", data: data.ventas.typePie, valueFormat: "number", compact: true },
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-ventas-2",
                        weight: 1,
                        sections: [
                            {
                                id: "ventas-price-range",
                                colSpan: 1,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Rango de Precio de Venta",
                                        variant: "chart",
                                        loading: data.ventas.analyticsLoading,
                                        subtext: "Productos vendibles por rango de precio de lista",
                                        chart: { type: "bar-chart", preset: "card", data: data.ventas.priceRangeBar, keys: ["productos"], indexBy: "rango", axisBottomLegend: "Rango", axisLeftLegend: "Productos" },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            {
                value: "compras",
                label: "Compras",
                icon: ShoppingBag,
                gridRows: "max-content 1fr",
                columns: [
                    {
                        id: "col-compras-1",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-purchasable",
                                colSpan: 2,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Disponibles para Compra",
                                        value: formatQuantity(data.compras.summary.totalProducts),
                                        icon: ShoppingBag,
                                        accent: "primary",
                                        valueSize: "xl",
                                        loading: data.compras.analyticsLoading,
                                    },
                                },
                            },
                            {
                                id: "compras-type-distribution",
                                colSpan: 1,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Distribución por Tipo",
                                        variant: "chart",
                                        loading: data.compras.analyticsLoading,
                                        subtext: "Tipos de producto comprables",
                                        chart: { type: "pie-chart", preset: "card", data: data.compras.typePie, valueFormat: "number", compact: true },
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-compras-2",
                        weight: 1,
                        sections: [
                            {
                                id: "compras-price-range",
                                colSpan: 1,
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Rango de Precio de Compra",
                                        variant: "chart",
                                        loading: data.compras.analyticsLoading,
                                        subtext: "Productos comprables por rango de costo ponderado",
                                        chart: { type: "bar-chart", preset: "card", data: data.compras.priceRangeBar, keys: ["productos"], indexBy: "rango", axisBottomLegend: "Rango", axisLeftLegend: "Productos" },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            {
                value: "existencias",
                label: "Existencias",
                icon: Warehouse,
                gridRows: "1fr",
                columns: [
                    {
                        id: "col-existencias-1",
                        weight: 1,
                        sections: [
                            {
                                id: "stock-report-embedded",
                                colSpan: 1,
                                fillRemaining: true,
                                content: {
                                    type: "custom",
                                    render: ui.stockReport,
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    }
}
