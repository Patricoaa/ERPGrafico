import type { AnalyticsPanelContentProps, Granularity } from "@/components/shared"
import { assignChartColors } from "@/lib/chart-colors"
import { BarChart3, Box, Building2, Package, Receipt, RefreshCcw, Wrench } from "lucide-react"
import type { PurchasingAnalyticsData } from "../hooks/usePurchaseOrderAnalytics"

export interface PurchaseAnalyticsUi {
    activeTab: string
    onTabChange: (tab: string) => void
    granularity: Granularity
    onGranularityChange: (granularity: Granularity) => void
}

/** Analytics tabs of the purchase orders screen; figures come from the server (whole filtered list). */
export function buildPurchaseAnalyticsScreen(analyticsData: PurchasingAnalyticsData, ui: PurchaseAnalyticsUi): AnalyticsPanelContentProps {
        const lineData = [
            {
                id: "Total",
                data: analyticsData.monthlyVolume.map((m) => ({ x: m.month, y: m.total })),
            },
            {
                id: "Promedio",
                data: analyticsData.monthlyAvg.map((m) => ({ x: m.month, y: m.avg })),
            },
        ]

        const receivingDist = assignChartColors([
            { id: "A tiempo", value: analyticsData.onTimeCount },
            { id: "Con retraso", value: analyticsData.lateCount },
            { id: "Pendientes", value: analyticsData.pendingReceiptCount },
        ])
        const storableVsTotal = assignChartColors([
            { id: "Almacenables", value: analyticsData.storableData.totalVolume },
            { id: "Resto", value: Math.max(0, analyticsData.totalLineVolume - analyticsData.storableData.totalVolume) },
        ])
        const serviceVsTotal = assignChartColors([
            { id: "Servicios", value: analyticsData.serviceData.totalVolume },
            { id: "Resto", value: Math.max(0, analyticsData.totalLineVolume - analyticsData.serviceData.totalVolume) },
        ])
        const subscriptionVsTotal = assignChartColors([
            { id: "Suscripciones", value: analyticsData.subscriptionData.totalVolume },
            { id: "Resto", value: Math.max(0, analyticsData.totalLineVolume - analyticsData.subscriptionData.totalVolume) },
        ])


        return {
                entityName: "Órdenes de Compra",
                activeTab: ui.activeTab,
                onTabChange: ui.onTabChange,
                granularity: ui.granularity,
                onGranularityChange: ui.onGranularityChange,
                tabs: [
                    // ── Tab 1: Financiero ──────────────────────────────
                    {
                        value: "financiero",
                        label: "Financiero",
                        icon: BarChart3,
                        columns: [
                            {
                                id: "col-main",
                                weight: 1,
                                sections: [
                                    {
                                        id: "combo-chart",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Volumen de Órdenes",
                                                variant: "chart",
                                                subtext: "Evolución histórica del monto total y cantidad de órdenes por mes",
                                                chart: {
                                                        type: "line-chart",
                                                        preset: "card",
                                                        data: lineData,
                                                        valueFormat: "$,.0f",
                                                    },
                                            },
                                        },
                                    },
                                ],
                            },
                            {
                                id: "col-payment",
                                weight: 1,
                                sections: [
                                    {
                                        id: "payment-chart",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Forma de Pago",
                                                variant: "chart",
                                                subtext: "Distribución de los medios de pago utilizados",
                                                chart: {
                                                        type: "pie-chart",
                                                        preset: "card",
                                                        data: analyticsData.paymentMethodDistribution,
                                                        valueFormat: "number",
                                                    },
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },

                    // ── Tab 2: Abastecimiento ──────────────────────────
                    {
                        value: "abastecimiento",
                        label: "Abastecimiento",
                        icon: Building2,
                        columns: [
                            {
                                id: "col-main",
                                weight: 2,
                                sections: [
                                    {
                                        id: "funnel-workflow",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Flujo de Vida (Órdenes)",
                                                variant: "chart",
                                                subtext: "Volumen de órdenes por estado del proceso",
                                                chart: {
                                                    type: "funnel-chart",
                                                    preset: "card",
                                                    data: analyticsData.funnel,
                                                    direction: "horizontal",
                                                    enableLabel: true,
                                                },
                                            }
                                        }
                                    }
                                ],
                            },
                            {
                                id: "col-logistics",
                                weight: 1,
                                sections: [
                                    {
                                        id: "receiving-status",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Entregas a Tiempo",
                                                variant: "metric-chart",
                                                value: `${analyticsData.onTimeCount}`,
                                                subtext: `${analyticsData.lateCount} con retraso · ${analyticsData.pendingReceiptCount} pendientes · ${analyticsData.overdueCount} vencidas`,
                                                chart: {
                                                        type: "pie-chart",
                                                        preset: "card",
                                                        data: receivingDist,
                                                        valueFormat: "number",
                                                        compact: true,
                                                        enableLabels: true,
                                                        arcLabel: (d: { id: string; value: number }) => {
                                                            const total = analyticsData.onTimeCount + analyticsData.lateCount + analyticsData.pendingReceiptCount
                                                            return total > 0 ? `${Math.round((d.value / total) * 100)}%` : d.id
                                                        },
                                                    },
                                            },
                                        },
                                    },
                                ],
                            },
                            {
                                id: "col-almacen",
                                weight: 1,
                                sections: [
                                    {
                                        id: "warehouse-bar",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Órdenes por Almacén",
                                                variant: "chart",
                                                subtext: "Destino de recepción logística de las órdenes",
                                                chart: {
                                                        type: "bar-chart",
                                                        preset: "card",
                                                        data: analyticsData.ordersByWarehouse,
                                                        keys: ["count"],
                                                        indexBy: "warehouse",
                                                    },
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },

                    // ── Tab 3: Productos ──────────────────────────────
                    {
                        value: "productos",
                        label: "Productos",
                        icon: Package,
                        columns: [
                            {
                                id: "col-left",
                                weight: 2,
                                sections: [
                                    {
                                        id: "top-suppliers-prod",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Top Proveedores",
                                                variant: "chart",
                                                subtext: "Proveedores con mayor volumen de compras y recurrencia",
                                                chart: {
                                                    type: "bar-chart",
                                                    preset: "card",
                                                    data: analyticsData.topSuppliers,
                                                    keys: ["total"],
                                                    indexBy: "supplier",
                                                    valueFormat: "~s",
                                                    lineOverlay: {
                                                        dataKey: "orderCount",
                                                        label: "Cantidad Órdenes",
                                                        color: "var(--color-success)",
                                                    },
                                                },
                                            }
                                        }
                                    },
                                    {
                                        id: "top-products-bar",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Top Productos por Gasto",
                                                variant: "chart",
                                                subtext: "Principales productos del presupuesto de compras",
                                                chart: {
                                                    type: "bar-chart",
                                                    preset: "card",
                                                    data: analyticsData.topProductsByVolume,
                                                    keys: ["total"],
                                                    indexBy: "product",
                                                    valueFormat: "$,.0f",
                                                },
                                            }
                                        }
                                    },
                                ]
                            },
                            {
                                id: "col-right",
                                weight: 1,
                                sections: [
                                    {
                                        id: "category-pie",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Gasto por Tipo de Producto",
                                                variant: "chart",
                                                subtext: "Distribución del gasto entre las categorías de producto",
                                                chart: {
                                                    type: "pie-chart",
                                                    preset: "card",
                                                    data: analyticsData.categoryDistribution,
                                                    valueFormat: "currency",
                                                },
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },

                    // ── Tab 4: Almacenables ──────────────────────────
                    {
                        value: "almacenables",
                        label: "Almacenables",
                        icon: Box,
                        columns: [
                            {
                                id: "col-storable-left",
                                weight: 2,
                                sections: [
                                    {
                                        id: "storable-top",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Top Productos Físicos por Gasto",
                                                variant: "chart",
                                                subtext: "Almacenables, Consumibles y Fabricables más comprados",
                                                chart: {
                                                    type: "bar-chart",
                                                    preset: "card",
                                                    data: analyticsData.storableData.topProducts,
                                                    keys: ["total"],
                                                    indexBy: "product",
                                                    valueFormat: "$,.0f",
                                                },
                                            }
                                        }
                                    },
                                    {
                                        id: "storable-trend",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Tendencia de Compras Físicas",
                                                variant: "chart",
                                                subtext: "Evolución mensual del gasto en productos físicos",
                                                chart: {
                                                    type: "line-chart",
                                                    preset: "card",
                                                    data: [{ id: "Gasto", data: analyticsData.storableData.monthlyTrend.map(m => ({ x: m.month, y: m.total })) }],
                                                    valueFormat: "$,.0f",
                                                },
                                            }
                                        }
                                    },
                                ]
                            },
                            {
                                id: "col-storable-right",
                                weight: 1,
                                sections: [
                                    {
                                        id: "storable-vs-total",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Almacenables vs Total",
                                                variant: "metric-chart",
                                                value: analyticsData.storableData.totalVolume > 0
                                                    ? `${Math.round((analyticsData.storableData.totalVolume / (analyticsData.totalLineVolume || 1)) * 100)}%`
                                                    : "0%",
                                                subtext: `del total de compras · ${analyticsData.storableData.orderCount} órdenes con físicos`,
                                                chart: {
                                                    type: "pie-chart",
                                                    preset: "card",
                                                data: storableVsTotal,
                                                     valueFormat: "currency",
                                                     compact: true,
                                                     innerRadius: 0.6,
                                                 },
                                             }
                                         }
                                     },
                                     {
                                         id: "storable-category",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Gasto por Categoría",
                                                variant: "chart",
                                                subtext: "Categorías de productos almacenables",
                                                chart: {
                                                    type: "pie-chart",
                                                    preset: "card",
                                                    data: analyticsData.storableData.categoryDistribution,
                                                    valueFormat: "currency",
                                                },
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },

                    // ── Tab 5: Servicios ────────────────────────────
                    {
                        value: "servicios",
                        label: "Servicios",
                        icon: Wrench,
                        columns: [
                            {
                                id: "col-service-left",
                                weight: 2,
                                sections: [
                                    {
                                        id: "service-top",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Top Servicios por Gasto",
                                                variant: "chart",
                                                subtext: "Servicios únicos con mayor gasto acumulado",
                                                chart: {
                                                    type: "bar-chart",
                                                    preset: "card",
                                                    data: analyticsData.serviceData.topProducts,
                                                    keys: ["total"],
                                                    indexBy: "product",
                                                    valueFormat: "$,.0f",
                                                },
                                            }
                                        }
                                    },
                                    {
                                        id: "service-trend",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Tendencia Gasto en Servicios",
                                                variant: "chart",
                                                subtext: "Evolución mensual del gasto en servicios externos",
                                                chart: {
                                                    type: "line-chart",
                                                    preset: "card",
                                                    data: [{ id: "Servicios", data: analyticsData.serviceData.monthlyTrend.map(m => ({ x: m.month, y: m.total })) }],
                                                    valueFormat: "$,.0f",
                                                },
                                            }
                                        }
                                    },
                                ]
                            },
                            {
                                id: "col-service-right",
                                weight: 1,
                                sections: [
                                    {
                                        id: "service-vs-total",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Servicios vs Total",
                                                variant: "metric-chart",
                                                value: analyticsData.serviceData.totalVolume > 0
                                                    ? `${Math.round((analyticsData.serviceData.totalVolume / (analyticsData.totalLineVolume || 1)) * 100)}%`
                                                    : "0%",
                                                subtext: `del total de compras · ${analyticsData.serviceData.orderCount} órdenes con servicios`,
                                                chart: {
                                                    type: "pie-chart",
                                                    preset: "card",
                                                    data: serviceVsTotal,
                                                     valueFormat: "currency",
                                                     compact: true,
                                                     innerRadius: 0.6,
                                                 },
                                             }
                                         }
                                     },
                                     {
                                         id: "service-category",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Gasto por Categoría",
                                                variant: "chart",
                                                subtext: "Categorías de servicios externos",
                                                chart: {
                                                    type: "pie-chart",
                                                    preset: "card",
                                                    data: analyticsData.serviceData.categoryDistribution,
                                                    valueFormat: "currency",
                                                },
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },

                    // ── Tab 6: Suscripciones ────────────────────────
                    {
                        value: "suscripciones",
                        label: "Suscripciones",
                        icon: RefreshCcw,
                        columns: [
                            {
                                id: "col-sub-left",
                                weight: 2,
                                sections: [
                                    {
                                        id: "sub-top",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Top Suscripciones por Gasto Anual",
                                                variant: "chart",
                                                subtext: "Servicios recurrentes con mayor impacto en el presupuesto",
                                                chart: {
                                                    type: "bar-chart",
                                                    preset: "card",
                                                    data: analyticsData.subscriptionData.topProducts,
                                                    keys: ["total"],
                                                    indexBy: "product",
                                                    valueFormat: "$,.0f",
                                                },
                                            }
                                        }
                                    },
                                    {
                                        id: "sub-trend",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Recurrencia Mensual de Suscripciones",
                                                variant: "chart",
                                                subtext: "Gasto recurrente mensual en suscripciones activas",
                                                chart: {
                                                    type: "line-chart",
                                                    preset: "card",
                                                    data: [{ id: "Suscripciones", data: analyticsData.subscriptionData.monthlyTrend.map(m => ({ x: m.month, y: m.total })) }],
                                                    valueFormat: "$,.0f",
                                                },
                                            }
                                        }
                                    },
                                ]
                            },
                            {
                                id: "col-sub-right",
                                weight: 1,
                                sections: [
                                    {
                                        id: "sub-vs-total",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Suscripciones vs Total",
                                                variant: "metric-chart",
                                                value: analyticsData.subscriptionData.totalVolume > 0
                                                    ? `${Math.round((analyticsData.subscriptionData.totalVolume / (analyticsData.totalLineVolume || 1)) * 100)}%`
                                                    : "0%",
                                                subtext: `del total de compras · ${analyticsData.subscriptionData.orderCount} órdenes con suscripciones`,
                                                chart: {
                                                    type: "pie-chart",
                                                    preset: "card",
                                                    data: subscriptionVsTotal,
                                                     valueFormat: "currency",
                                                     compact: true,
                                                     innerRadius: 0.6,
                                                 },
                                             }
                                         }
                                     },
                                     {
                                         id: "sub-category",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Gasto por Categoría",
                                                variant: "chart",
                                                subtext: "Categorías de suscripciones",
                                                chart: {
                                                    type: "pie-chart",
                                                    preset: "card",
                                                    data: analyticsData.subscriptionData.categoryDistribution,
                                                    valueFormat: "currency",
                                                },
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },

                    // ── Tab 7: DTE ──────────────────────────────────
                    {
                        value: "dte",
                        label: "DTE",
                        icon: Receipt,
                        columns: [
                            {
                                id: "col-dte-left",
                                weight: 2,
                                sections: [
                                    {
                                        id: "dte-type-distribution",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Tipos de Documentos Recibidos",
                                                variant: "chart",
                                                subtext: "Distribución de los DTEs registrados en compras",
                                                chart: {
                                                    type: "bar-chart",
                                                    preset: "card",
                                                    data: analyticsData.dteDistribution,
                                                    keys: ["value"],
                                                    indexBy: "id",
                                                },
                                            }
                                        }
                                    },
                                ]
                            },
                            {
                                id: "col-dte-right",
                                weight: 1,
                                sections: [
                                    {
                                        id: "dte-vs-total",
                                        content: {
                                            type: "stat-card",
                                            config: {
                                                label: "Facturado vs Pendiente",
                                                variant: "metric-chart",
                                                value: analyticsData.invoicedStatusSummary.invoicedVolume > 0
                                                    ? `${Math.round((analyticsData.invoicedStatusSummary.invoicedVolume / (analyticsData.totalVolume || 1)) * 100)}%`
                                                    : "0%",
                                                subtext: `${analyticsData.invoicedStatusSummary.invoicedCount} órdenes con DTE de ${analyticsData.orderCount}`,
                                                chart: {
                                                    type: "pie-chart",
                                                    preset: "card",
                                                    data: analyticsData.invoicedVolumeData,
                                                    valueFormat: "currency",
                                                    compact: true,
                                                    innerRadius: 0.6,
                                                },
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                ],
        }
}
