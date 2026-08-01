"use client"
import { Chip, SkeletonShell, StatusBadge } from '@/components/shared'

import { useState } from "react"

import { DataTable, StatCard } from "@/components/shared"
import {
    History,
    TrendingUp,
    BarChart3,
    ArrowRightLeft,
    Factory,
    ArrowUpRight,
    ArrowDownRight,
    LayoutDashboard,
    ChevronLeft,
    ShoppingCart,
    Banknote,
    CircleDollarSign,
    Percent,
} from "lucide-react"
import { useProductInsights } from "../hooks/useProducts"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from '@/components/shared'
import { formatEntityDisplay } from "@/lib/entity-registry"
import { parseDateOnly, cn } from "@/lib/utils"
import { formatCurrency, formatQuantity } from "@/lib/money"
import { ProductSelector } from "@/components/selectors"

import { LazyDrawer, type TransactionType } from "@/features/_shared"
import { WorkOrderWizard } from "@/features/production"
import type { ColumnDef } from "@tanstack/react-table"
import { LineChart } from "@/components/shared"

interface PriceHistoryEntry {
    date: string
    sale_price: number
    cost_price: number
    user: string
}

interface KardexEntry {
    id: number
    display_id: string
    related_id: number
    related_type: string
    date: string
    type: string
    quantity: number
    unit_price?: number
    total_price?: number
    warehouse: string
    description: string
    uom: string
}

interface ProductionUsage {
    date: string
    ot_id: number
    ot_number: string
    quantity: number
    description: string
}

interface SalesAnalysis {
    avg_price: number
    avg_cost: number
    total_sold: number
    total_revenue: number
    total_cost_basis: number
}

interface ProductInsights {
    price_history: PriceHistoryEntry[]
    kardex: KardexEntry[]
    sales_analysis: SalesAnalysis
    production_usage: ProductionUsage[]
}

interface ProductInsightsPanelProps {
    productId: number | null
    productName: string | null
    /** If provided, renders a back button and calls this when clicked */
    onBack?: () => void
    /** If provided, renders a product selector and calls this when changed */
    onProductChange?: (productId: number, productName: string) => void
}

export function ProductInsightsPanel({ productId, productName, onBack, onProductChange }: ProductInsightsPanelProps) {
    const { insights: data, isLoading: loading, refetch: refetchInsights } = useProductInsights<ProductInsights>(productId)
    const [activeTab, setActiveTab] = useState("overview")

    const [selectedTransaction, setSelectedTransaction] = useState<{ id: number | string, type: TransactionType } | null>(null)
    const [activeWorkOrderId, setActiveWorkOrderId] = useState<number | null>(null)

    const openTransaction = (id: number | string, type: string) => {
        setSelectedTransaction({ id, type: type as TransactionType })
    }

    const closeTransaction = () => setSelectedTransaction(null)
    const openWorkOrder = (id: number) => setActiveWorkOrderId(id)
    const closeWorkOrder = () => setActiveWorkOrderId(null)

    const margin = data ? data.sales_analysis.total_revenue - data.sales_analysis.total_cost_basis : 0
    const marginPercent = data && data.sales_analysis.total_revenue > 0
        ? (margin / data.sales_analysis.total_revenue) * 100
        : 0

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full">
            {/* Content */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {loading || !data ? (
                    <SkeletonShell isLoading={loading || !data} ariaLabel="Cargando insights del producto">
                        <div className="p-6" />
                    </SkeletonShell>
                ) : (
                    <div className="flex-1 flex flex-row gap-4 w-full h-full min-h-0 overflow-hidden bg-transparent">
                        <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto bg-transparent pb-4">
                            {/* Back header */}
                            {onBack && (
                                <div className="flex flex-col gap-2 mb-2 pb-4 border-b border-border/60">
                                    <button
                                        onClick={onBack}
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                                    >
                                        <ChevronLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
                                        Volver a Existencias
                                    </button>
                                    {productName && !onProductChange && (
                                        <div className="flex items-start gap-2 mt-1">
                                            <BarChart3 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                            <span className="text-sm font-semibold leading-tight break-words">{productName}</span>
                                        </div>
                                    )}
                                    {onProductChange && (
                                        <div className="mt-1 w-full">
                                            <ProductSelector
                                                value={productId ?? undefined}
                                                onChange={() => {}}
                                                onSelect={(p) => onProductChange(p.id as number, p.name)}
                                                placeholder="Buscar producto..."
                                                variant="inline"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                            {[
                                { value: "overview", label: "Resumen", icon: LayoutDashboard },
                                { value: "history", label: "Precios", icon: History },
                                { value: "kardex", label: "Kardex", icon: ArrowRightLeft },
                                { value: "production", label: "Producción", icon: Factory }
                            ].map((t) => {
                                const Icon = t.icon
                                const isActive = t.value === activeTab
                                return (
                                    <button
                                        key={t.value}
                                        onClick={() => setActiveTab(t.value)}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-all duration-200",
                                            isActive 
                                                ? "bg-primary text-primary-foreground shadow-md" 
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{t.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                        <div className="flex-1 flex flex-col min-w-0 h-full overflow-auto scrollbar-thin">

                            {/* OVERVIEW TAB */}
                            <div className={cn("space-y-6", activeTab !== "overview" && "hidden")}>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <StatCard
                                        label="Ventas Totales"
                                        value={<>{formatQuantity(data.sales_analysis.total_sold)} <span className="text-sm font-normal text-muted-foreground ml-1">uds</span></>}
                                        icon={ShoppingCart}
                                        valueSize="xl"
                                        accent="success"
                                    />
                                    <StatCard
                                        label="Ingresos (Neto)"
                                        value={formatCurrency(data.sales_analysis.total_revenue)}
                                        icon={Banknote}
                                        valueSize="xl"
                                        accent="primary"
                                    />
                                    <StatCard
                                        label="Margen Bruto"
                                        value={formatCurrency(margin)}
                                        icon={CircleDollarSign}
                                        valueSize="xl"
                                        accent="warning"
                                    />
                                    <StatCard
                                        label="% de Margen"
                                        value={`${marginPercent.toFixed(1)}%`}
                                        icon={Percent}
                                        valueSize="xl"
                                        accent={marginPercent >= 20 ? "info" : "destructive"}
                                        trend={{
                                            direction: marginPercent >= 20 ? "up" : "down",
                                            value: marginPercent >= 20 ? "Saludable" : "Crítico",
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-primary" />
                                            Análisis de Precios Unitarios
                                        </h4>
                                        <div className="rounded-md border p-4 space-y-3 bg-muted/50">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">Precio Promedio de Venta:</span>
                                                <DataCell.Currency value={data.sales_analysis.avg_price} className="font-bold" />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">Costo Promedio Real:</span>
                                                <DataCell.Currency value={data.sales_analysis.avg_cost} className="font-bold" />
                                            </div>
                                            <div className="h-px bg-border pt-2" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold">Ganancia por Unidad:</span>
                                                <DataCell.Currency value={data.sales_analysis.avg_price - data.sales_analysis.avg_cost} className="font-black text-primary" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Factory className="h-4 w-4 text-primary" />
                                            Consumo en Producción
                                        </h4>
                                        <div className="rounded-md border p-4 bg-muted/50">
                                            {data.production_usage.length > 0 ? (
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-muted-foreground">Total OTs que usaron este producto:</span>
                                                        <span className="font-bold text-lg">{data.production_usage.length}</span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground italic">
                                                        * Muestra las últimas 20 utilizaciones en el taller.
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-2 text-center text-xs text-muted-foreground italic">
                                                    No se ha registrado uso en producción.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* HISTORY TAB */}
                            <div className={cn("space-y-6", activeTab !== "history" && "hidden")}>
                                <div className="h-[250px] w-full bg-card rounded-md border p-4">
                                    <LineChart
                                        data={[
                                            {
                                                id: "Precio Venta",
                                                data: [...data.price_history].reverse().map((d) => ({ x: d.date, y: d.sale_price })),
                                            },
                                            {
                                                id: "Costo",
                                                data: [...data.price_history].reverse().map((d) => ({ x: d.date, y: d.cost_price })),
                                            },
                                        ]}
                                        tooltipFormat="currency"
                                        axisBottom={{
                                            tickSize: 0,
                                            tickPadding: 10,
                                            format: (v: string) => format(parseDateOnly(v.split('T')[0]), 'MMM d', { locale: es }),
                                        }}
                                        axisLeft={{
                                            tickSize: 0,
                                            tickPadding: 10,
                                        }}
                                        legends={[
                                            {
                                                anchor: "top",
                                                direction: "row",
                                                translateY: -30,
                                                itemWidth: 120,
                                                itemHeight: 20,
                                                symbolSize: 10,
                                                symbolShape: "circle",
                                            },
                                        ]}
                                    />
                                </div>
                                <div className="rounded-md border">
                                    <PriceHistoryTable entries={data.price_history} />
                                </div>
                            </div>

                            {/* KARDEX TAB */}
                            <div className={cn("mt-0", activeTab !== "kardex" && "hidden")}>
                                <div className="rounded-md border">
                                    <KardexTable
                                        entries={data.kardex}
                                        onOpenWorkOrder={openWorkOrder}
                                        onOpenTransaction={openTransaction}
                                    />
                                </div>
                            </div>

                            {/* PRODUCTION TAB */}
                            <div className={cn("mt-0", activeTab !== "production" && "hidden")}>
                                <div className="rounded-md border">
                                    <ProductionUsageTable
                                        entries={data.production_usage}
                                        onOpenWorkOrder={openWorkOrder}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {selectedTransaction && (
                <LazyDrawer
                    type={selectedTransaction.type}
                    id={Number(selectedTransaction.id)}
                    open={!!selectedTransaction}
                    onOpenChange={(open) => !open && closeTransaction()}
                />
            )}

            {activeWorkOrderId && (
                <WorkOrderWizard
                    mode={{ kind: 'manage', orderId: activeWorkOrderId }}
                    open={!!activeWorkOrderId}
                    onOpenChange={(open) => !open && closeWorkOrder()}
                    onSuccess={() => refetchInsights()}
                />
            )}
        </div>
    )
}

// ── Sub-tables (same as ProductInsightsModal) ─────────────────────────────────

function PriceHistoryTable({ entries }: { entries: PriceHistoryEntry[] }) {
    const columns: ColumnDef<PriceHistoryEntry>[] = [
        {
            header: "Fecha",
            cell: ({ row }) => (
                <span className="text-xs">{format(new Date(row.original.date), "dd/MM/yyyy HH:mm", { locale: es })}</span>
            ),
        },
        {
            header: "Usuario",
            cell: ({ row }) => (
                <Chip size="xs" className="whitespace-nowrap">{row.original.user}</Chip>
            ),
        },
        {
            header: "Precio de Venta",
            cell: ({ row }) => (
                <DataCell.Currency value={row.original.sale_price} className="text-left font-bold" />
            ),
        },
        {
            header: "Costo Ponderado",
            cell: ({ row }) => (
                <DataCell.Currency value={row.original.cost_price} className="text-left text-muted-foreground" />
            ),
        },
    ]

    return (
        <DataTable
            columns={columns}
            data={entries}
            variant="embedded"
            hidePagination
            emptyState={{
                context: "search",
                title: "Sin historial de precios",
                description: "No hay cambios de precio registrados para este producto.",
            }}
        />
    )
}

function KardexTable({ entries, onOpenWorkOrder, onOpenTransaction }: {
    entries: KardexEntry[]
    onOpenWorkOrder: (id: number) => void
    onOpenTransaction: (id: number | string, type: string) => void
}) {
    const columns: ColumnDef<KardexEntry>[] = [
        {
            header: "Fecha",
            cell: ({ row }) => (
                <span className="text-xs">{format(parseDateOnly(row.original.date), "dd/MM/yyyy")}</span>
            ),
        },
        {
            header: "N°",
            cell: ({ row }) => (
                <span className="font-mono text-[10px] font-bold">{row.original.display_id}</span>
            ),
        },
        {
            header: "Tipo",
            cell: ({ row }) => {
                const m = row.original
                return (
                    <StatusBadge
                        status={m.type === 'IN' ? 'SUCCESS' : m.type === 'OUT' ? 'DESTRUCTIVE' : 'WARNING'}
                        label={m.type === 'IN' ? 'Entrada' : m.type === 'OUT' ? 'Salida' : 'Ajuste'}
                        variant="badge"
                    />
                )
            },
        },
        {
            header: "Cantidad",
            cell: ({ row }) => {
                const m = row.original
                return <DataCell.Number value={m.quantity} className="text-left" suffix={m.uom} />
            },
        },
        {
            header: "P. Unitario",
            cell: ({ row }) => (
                <DataCell.Currency value={row.original.unit_price || 0} className="text-left" />
            ),
        },
        {
            header: "Total",
            cell: ({ row }) => (
                <DataCell.Currency value={row.original.total_price || 0} className="text-left" />
            ),
        },
        {
            header: "Bodega",
            cell: ({ row }) => (
                <span className="text-xs">{row.original.warehouse}</span>
            ),
        },
        {
            header: "Acciones",
            cell: ({ row }) => {
                const m = row.original
                return (
                    <div className="text-right">
                        <DataCell.ActionGroup>
                            <DataCell.Action
                                action="detail"
                                onClick={() => {
                                    if (m.related_type === 'work_order') {
                                        onOpenWorkOrder(m.related_id)
                                    } else {
                                        onOpenTransaction(m.related_id, m.related_type)
                                    }
                                }}
                            />
                        </DataCell.ActionGroup>
                    </div>
                )
            },
        },
    ]

    return (
        <DataTable
            columns={columns}
            data={entries}
            variant="embedded"
            hidePagination
            emptyState={{
                context: "search",
                title: "Sin movimientos",
                description: "Sin movimientos registrados para este producto.",
            }}
        />
    )
}

function ProductionUsageTable({ entries, onOpenWorkOrder }: {
    entries: ProductionUsage[]
    onOpenWorkOrder: (id: number) => void
}) {
    const columns: ColumnDef<ProductionUsage>[] = [
        {
            header: "Fecha",
            cell: ({ row }) => (
                <span className="text-xs">{format(parseDateOnly(row.original.date), "dd/MM/yyyy")}</span>
            ),
        },
        {
            header: "N° OT",
            cell: ({ row }) => (
                <Chip size="xs" className="whitespace-nowrap">
                    {formatEntityDisplay('production.workorder', { number: row.original.ot_number })}
                </Chip>
            ),
        },
        {
            header: "Cantidad Consumida",
            cell: ({ row }) => (
                <DataCell.Number value={row.original.quantity} className="text-left" />
            ),
        },
        {
            header: "Acciones",
            cell: ({ row }) => (
                <div className="text-right">
                    <DataCell.ActionGroup>
                        <DataCell.Action
                            action="detail"
                            onClick={() => onOpenWorkOrder(row.original.ot_id)}
                        />
                    </DataCell.ActionGroup>
                </div>
            ),
        },
    ]

    return (
        <DataTable
            columns={columns}
            data={entries}
            variant="embedded"
            hidePagination
            emptyState={{
                context: "search",
                title: "Sin uso en producción",
                description: "Este producto no ha sido utilizado como material en producción.",
            }}
        />
    )
}
