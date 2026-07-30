"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import React, {useEffect, useState, useMemo} from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ActionConfirmModal, DataTableView, DocumentCompletionModal, AutoEntityCard, DomainHubStatus, UnifiedSearchBar, useUnifiedSearch, StatCard } from '@/components/shared'
import { DataTableColumnHeader, DataCell } from '@/components/shared'
import { purchaseOrderFields } from "@/features/purchasing/purchaseOrderFields"
import type { AnalyticsPanelConfig, Granularity } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowRight, ArrowLeft, BarChart3, Building2, Package, Box, Wrench, RefreshCcw, Receipt } from "lucide-react"
import { ENTITY_REGISTRY, getEntityIcon } from "@/lib/entity-registry"
import { PurchaseOrderModal, DocumentRegistrationModal, PurchaseCheckoutWizard, usePurchasingOrders, usePurchasingNotes, purchaseOrderUnifiedSearchDef, usePurchasingAnalyticsData } from "@/features/purchasing"
import { billingApi } from "@/features/billing"
import type { PurchaseOrderAPI } from "@/features/purchasing"
import type { Page } from '@/lib/pagination'
import type { PurchaseOrderInitialData } from "@/types/forms"
import { toast } from "sonner"

import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { getHubStatuses } from "@/lib/workflow-status"
import { useVatRate } from '@/hooks/useVatRate'
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { Tabs } from "@/components/ui/tabs"

import type { Order } from "@/features/orders"
import type { Invoice } from "@/features/billing"

interface PurchaseOrder extends Order {
    supplier_name: string
    date: string
    warehouse_name: string
    total_paid: number
    is_invoiced: boolean
    invoice_details?: {
        dte_type: string
        number: string
        document_attachment: string | null
    } | null
}

interface PurchasingOrdersClientViewProps {
    viewMode: 'orders' | 'notes'
    externalOpenCheckout?: boolean
    createAction?: React.ReactNode
    initialOrders?: PurchaseOrderAPI[]
    initialNotes?: Invoice[]
}

export function PurchasingOrdersClientView({ viewMode, externalOpenCheckout, createAction, initialOrders, initialNotes }: PurchasingOrdersClientViewProps) {
    const search = useUnifiedSearch(purchaseOrderUnifiedSearchDef)
    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 20 })
    const allFilters = { ...search.filters, page: isGrouping ? 1 : pageState.pageIndex + 1, page_size: isGrouping ? 5000 : pageState.pageSize } as unknown as Record<string, string> & { page: number; page_size: number }
    const { page, orders, isLoading: isLoadingOrders, isRefetching, refetch: fetchOrders, deleteOrder, annulOrder } = usePurchasingOrders(allFilters, initialOrders ? { results: initialOrders, count: initialOrders.length } as Page<PurchaseOrderAPI> : undefined)
    // TODO: migrate purchasing notes to Page<T>
    const { notes, isLoading: isLoadingNotes } = usePurchasingNotes(initialNotes)

    const totalCount = page?.count ?? 0
    const isOverLimit = isGrouping && totalCount > 5000
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])

    const { rate } = useVatRate()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
    const [invoicingOrder, setInvoicingOrder] = useState<PurchaseOrder | null>(null)
    const [completingInvoice, setCompletingInvoice] = useState<{ id: number, type: string } | null>(null)
    const [folioModalOpen, setFolioModalOpen] = useState(false)
    const [selectedInvoice] = useState<{ id: number, type: string } | null>(null)

    const { hubConfig, isHubOpen } = useHubPanel()
    const [checkoutOrderId, setCheckoutOrderId] = useState<number | null>(null)
    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("financiero")
    const [granularity, setGranularity] = useState<Granularity>("month")

    const analyticsData = usePurchasingAnalyticsData(orders as PurchaseOrderAPI[], null, granularity)

    const funnelData = useMemo(() => {
        const desiredOrder = ["DRAFT", "CONFIRMED", "RECEIVED", "INVOICED", "PAID"]
        const labelMap: Record<string, string> = {
            DRAFT: "Borrador",
            CONFIRMED: "Confirmada",
            RECEIVED: "Recibida",
            INVOICED: "Facturada",
            PAID: "Pagada"
        }
        // Colors come from statusDistribution (assigned dynamically by assignChartColors)
        return desiredOrder.map(status => {
            const item = analyticsData.statusDistribution.find(d => d.id === status)
            if (!item || item.value === 0) return null
            return {
                id: status,
                label: labelMap[status],
                value: item.value,
                color: item.color,
            }
        }).filter((d): d is NonNullable<typeof d> => d !== null)
    }, [analyticsData.statusDistribution])

    const analyticsPanel: AnalyticsPanelConfig = useMemo(() => {
        if (viewMode !== "orders") return { screen: { entityName: "", tabs: [] } }

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

        return {
            screen: {
                entityName: "Órdenes de Compra",
                activeTab: analyticsActiveTab,
                onTabChange: setAnalyticsActiveTab,
                granularity,
                onGranularityChange: setGranularity,
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
                                                    data: funnelData,
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
                                                        data: [
                                                            { id: "A tiempo", value: analyticsData.onTimeCount, color: "var(--color-success)" },
                                                            { id: "Con retraso", value: analyticsData.lateCount, color: "var(--color-destructive)" },
                                                            { id: "Pendientes", value: analyticsData.pendingReceiptCount, color: "var(--color-warning)" },
                                                        ],
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
                                                    data: [
                                                        { id: "Almacenables", value: analyticsData.storableData.totalVolume, color: "var(--color-info)" },
                                                        { id: "Resto", value: Math.max(0, analyticsData.totalLineVolume - analyticsData.storableData.totalVolume), color: "var(--color-muted)" },
                                                    ],
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
                                                    data: [
                                                        { id: "Servicios", value: analyticsData.serviceData.totalVolume, color: "var(--color-primary)" },
                                                        { id: "Resto", value: Math.max(0, analyticsData.totalLineVolume - analyticsData.serviceData.totalVolume), color: "var(--color-muted)" },
                                                    ],
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
                                                    data: [
                                                        { id: "Suscripciones", value: analyticsData.subscriptionData.totalVolume, color: "var(--color-warning)" },
                                                        { id: "Resto", value: Math.max(0, analyticsData.totalLineVolume - analyticsData.subscriptionData.totalVolume), color: "var(--color-muted)" },
                                                    ],
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
            },
        }
    }, [analyticsData, funnelData, viewMode, analyticsActiveTab])

    const toggleSelection = (id: number) => {
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

    const filteredOrders = orders
    const filteredNotes = notes

    const noteColumns: ColumnDef<Invoice>[] = [
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Documento" />
            ),
            cell: ({ row }) => (
                <DataCell.Text>{row.original.dte_type_display || '-'}</DataCell.Text>
            ),
        },
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" />
            ),
            cell: ({ row }) => <DataCell.Code>{row.original.display_id ?? row.original.number}</DataCell.Code>,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
        },
        {
            accessorKey: "partner_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Proveedor" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.original.supplier_name || row.original.partner_name}</DataCell.Text>,
        },
        {
            accessorKey: "total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estados" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DomainHubStatus label="billing.invoice" data={row.original} />
                </div>
            ),
        },
    ]

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteOrder(id)
        } catch (error: unknown) {
            console.error("Error deleting order:", error)
            showApiError(error, "Error al eliminar la orden de compra.")
        }
    })

    const forceAnnulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await annulOrder({ id, force: true })
        } catch (error: unknown) {
            toast.error(getErrorMessage(error) || "Error al anular la orden de compra.")
        }
    })

    const annulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await annulOrder({ id, force: false })
        } catch (error: unknown) {
            console.error("Error annulling order:", error)
            const errorMessage = getErrorMessage(error) || ""

            if (errorMessage.includes("Debe anular los pagos asociados")) {
                forceAnnulConfirm.requestConfirm(id)
                return
            }

            toast.error(errorMessage || "Error al anular la orden de compra.")
        }
    })

    const columns: ColumnDef<PurchaseOrder>[] = [
        ...(purchaseOrderFields.toColumns() as ColumnDef<PurchaseOrder>[]),
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Almacén" />
            ),
            cell: ({ row }) => <DataCell.Secondary>{row.getValue("warehouse_name")}</DataCell.Secondary>,
        },

        // Hidden columns for filtering only - these provide data for faceted filters
        {
            id: "reception_status",
            accessorFn: (row) => getHubStatuses(row as Record<string, unknown>).logistics,
            header: () => null,
            cell: () => null,
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },
        {
            id: "billing_status",
            accessorFn: (row) => getHubStatuses(row as Record<string, unknown>).billing,
            header: () => null,
            cell: () => null,
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },
        {
            id: "treasury_status",
            accessorFn: (row) => getHubStatuses(row as Record<string, unknown>).treasury,
            header: () => null,
            cell: () => null,
            enableSorting: false,
            enableHiding: false,
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },


    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {editingOrder && (
                <PurchaseOrderModal
                    initialData={editingOrder as unknown as PurchaseOrderInitialData}
                    open={!!editingOrder}
                    onOpenChange={(open) => {
                        if (!open) setEditingOrder(null)
                    }}
                    onSuccess={fetchOrders}
                />
            )}

            <Tabs value={viewMode} className="w-full h-full flex flex-col">
                <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel={viewMode === 'orders' ? 'purchasing.purchaseorder' : 'billing.invoice'}
                        columns={(viewMode === 'orders' ? columns : noteColumns) as unknown as ColumnDef<Record<string, unknown>>[]}
                        data={(viewMode === 'orders' ? filteredOrders : filteredNotes) as unknown as Record<string, unknown>[]}
                        onRowClick={(row: Record<string, unknown>) => toggleSelection(row.id as number)}
                        variant="embedded"
                        isLoading={viewMode === 'orders' ? isLoadingOrders : isLoadingNotes}
                        isRefetching={viewMode === 'orders' ? isRefetching : undefined}
                        renderCard={(data: Record<string, unknown>) => {
                            const label = viewMode === 'orders' ? 'purchasing.purchaseorder' : 'billing.invoice'
                            const config = ENTITY_REGISTRY[label]?.cardConfig
                            const iconClassName = typeof config?.iconClassName === 'function' ? config.iconClassName(data) : config?.iconClassName
                            return (
                                <AutoEntityCard
                                    key={data.id as number}
                                    data={data}
                                    fields={viewMode === 'orders' ? purchaseOrderFields as any : undefined as any}
                                    entityLabel={label}
                                    onClick={() => toggleSelection(data.id as number)}
                                    isSelected={viewMode === 'orders' ? hubConfig?.orderId === data.id : hubConfig?.invoiceId === data.id}
                                    className={isHubOpen && (viewMode === 'orders' ? hubConfig?.orderId === data.id : hubConfig?.invoiceId === data.id) ? "accent-visible" : isHubOpen ? "opacity-40 grayscale-[0.2] blur-[0.2px]" : ""}
                                    icon={getEntityIcon(label)}
                                    iconClassName={iconClassName}
                                    hubTrigger={{
                                        isSelected: viewMode === 'orders' ? hubConfig?.orderId === data.id : hubConfig?.invoiceId === data.id,
                                        onToggle: () => toggleSelection(data.id as number),
                                    }}
                                />
                            )
                        }}
                        unifiedSearch={<UnifiedSearchBar
                            config={purchaseOrderUnifiedSearchDef}
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
                            placeholder="Buscar por proveedor..."
                        />}
                        showReset={search.isFiltered}
                        onReset={search.clearAll}
                        manualPagination={effectiveGrouping ? false : viewMode === 'orders'}
                        pageCount={effectiveGrouping ? 1 : viewMode === 'orders' ? (page ? Math.ceil(page.count / page.pageSize) : 0) : undefined}
                        rowCount={viewMode === 'orders' ? (page?.count ?? 0) : undefined}
                        pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 5000 } : viewMode === 'orders' ? pageState : undefined}
                        onPaginationChange={effectiveGrouping ? undefined : viewMode === 'orders' ? setPageState : undefined}
                        createAction={createAction}
                        isSelected={(data: Record<string, unknown>) => viewMode === 'orders'
                            ? hubConfig?.orderId === data.id
                            : hubConfig?.invoiceId === data.id
                        }
                        isHubOpen={isHubOpen}
                        isFiltered={search.isFiltered}
                        analyticsPanel={viewMode === 'orders' ? analyticsPanel : undefined}
                        currentGroupBy={effectiveGrouping ? search.groupBy : null}
                        emptyState={{
                            context: "purchase",
                            title: viewMode === 'orders' ? "Aún no hay órdenes de compra" : "Aún no hay notas de compra",
                            description: viewMode === 'orders'
                                ? "Crea una orden de compra para registrar tus adquisiciones a proveedores."
                                : "Las notas asociadas a tus documentos de compra aparecerán aquí.",
                        }}
                    />
                </div>
            </Tabs>

            {
                invoicingOrder && (
                    <DocumentRegistrationModal
                        open={!!invoicingOrder}
                        onOpenChange={(open) => !open && setInvoicingOrder(null)}
                        orderId={invoicingOrder.id}
                        orderNumber={invoicingOrder.number}
                        supplierId={invoicingOrder.supplier_id}
                        onSuccess={fetchOrders}
                    />
                )
            }

            {
                completingInvoice && (
                    <DocumentCompletionModal
                        open={!!completingInvoice}
                        onOpenChange={(open) => !open && setCompletingInvoice(null)}
                        invoiceId={completingInvoice.id}
                        invoiceType={completingInvoice.type}
                        contactId={invoicingOrder?.supplier_id || ((orders as unknown as PurchaseOrder[]).find((o) => o.related_documents?.invoices?.some((i: Record<string, unknown>) => i.id === completingInvoice.id))?.supplier_id ?? undefined)}
                        isPurchase={true}
                        onComplete={async (invoiceId, formData) => {
                            await billingApi.confirmInvoice(invoiceId, formData)
                        }}
                        onSuccess={fetchOrders}
                    />
                )
            }

            <PurchaseCheckoutWizard
                open={!!externalOpenCheckout || !!checkoutOrderId}
                onOpenChange={(open) => {
                    if (!open) {
                        setCheckoutOrderId(null)
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete('modal')
                        const query = params.toString()
                        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
                    }
                }}
                order={null}
                orderId={checkoutOrderId}
                orderLines={[{ product: "", product_name: "", quantity: 1, uom: "", uom_name: "", unit_cost: 0, tax_rate: rate }]}
                total={0}
                onComplete={() => {
                    fetchOrders()
                    setCheckoutOrderId(null)
                    const params = new URLSearchParams(searchParams.toString())
                    params.delete('modal')
                    const query = params.toString()
                    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
                }}
            />

            {
                selectedInvoice && (
                    <DocumentCompletionModal
                        open={folioModalOpen}
                        onOpenChange={setFolioModalOpen}
                        invoiceId={selectedInvoice.id}
                        invoiceType={selectedInvoice.type}
                        contactId={invoicingOrder?.supplier_id || ((orders as unknown as PurchaseOrder[]).find((o) => o.related_documents?.invoices?.some((i: Record<string, unknown>) => i.id === selectedInvoice.id))?.supplier_id ?? undefined)}
                        isPurchase={true}
                        onComplete={async (invoiceId, formData) => {
                            await billingApi.confirmInvoice(invoiceId, formData)
                        }}
                        onSuccess={fetchOrders}
                    />
                )
            }

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Orden de Compra"
                description="¿Está seguro de que desea eliminar esta Orden de Compra? Esta acción no se puede deshacer."
                variant="destructive"
            />

            <ActionConfirmModal
                open={annulConfirm.isOpen}
                onOpenChange={(open) => { if (!open) annulConfirm.cancel() }}
                onConfirm={annulConfirm.confirm}
                title="Anular Documento"
                description="¿Está seguro de que desea ANULAR esta Orden de Compra? Esta acción generará reversos contables y liberará reservas, y no se puede deshacer."
                variant="destructive"
            />

            <ActionConfirmModal
                open={forceAnnulConfirm.isOpen}
                onOpenChange={(open) => { if (!open) forceAnnulConfirm.cancel() }}
                onConfirm={forceAnnulConfirm.confirm}
                title="Desvincular y Anular Pagos"
                description="Este documento (o sus facturas) tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?"
                variant="destructive"
            />
        </div>
    )
}
