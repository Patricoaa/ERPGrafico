"use client"
import { formatCurrency } from "@/lib/money";

import { SkeletonShell } from "@/components/shared"

import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { BaseModal } from "@/components/shared/BaseModal"
import { DataTable, StatCard } from "@/components/shared"
import {
    History,
    TrendingUp,
    BarChart3,
    ArrowRightLeft,
    Factory,
    ArrowUpRight,
    ArrowDownRight,
    LayoutDashboard
} from "lucide-react"
import { useProductInsights } from "../hooks/useProducts"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from '@/components/shared'
import { formatEntityDisplay } from "@/lib/entity-registry"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { FormTabs, FormTabsContent } from "@/components/shared"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { WorkOrderWizard } from "@/features/production"
import type { ColumnDef } from "@tanstack/react-table"
import {
    ResponsiveContainer,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    AreaChart,
    Area
} from 'recharts'
import { Button } from "@/components/ui/button"

interface ProductInsightsModalProps {
    productId: number | null
    productName: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

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

export function ProductInsightsModal({ productId, productName, open, onOpenChange }: ProductInsightsModalProps) {
    // useProductInsights cachea por PRODUCTS_KEYS.detail(id) + 'insights'.
    // Cualquier mutación del producto invalida también este bundle vía
    // prefix match en PRODUCTS_KEYS.all.
    const { data, isLoading: loading, refetch: refetchInsights } = useProductInsights<ProductInsights>(open ? productId : null)
    const [activeTab, setActiveTab] = useState("overview")

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const transactionId = searchParams.get('transaction')
    const transactionType = searchParams.get('transactionType') as import("@/types/transactions").TransactionType | null
    const workOrderId = searchParams.get('workOrder')

    const [selectedTransaction, setSelectedTransaction] = useState<{ id: number | string, type: import("@/types/transactions").TransactionType } | null>(null)
    const [activeWorkOrderId, setActiveWorkOrderId] = useState<number | null>(null)

    useEffect(() => {
        if (transactionId && transactionType && !selectedTransaction) {
            setSelectedTransaction({ id: transactionId, type: transactionType })
        }
        if (workOrderId && !activeWorkOrderId) {
            setActiveWorkOrderId(Number(workOrderId))
        }
    }, [transactionId, transactionType, workOrderId, selectedTransaction, activeWorkOrderId])

    const openTransaction = (id: number | string, type: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('transaction', String(id))
        params.set('transactionType', type)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const closeTransaction = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('transaction')
        params.delete('transactionType')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        setSelectedTransaction(null)
    }

    const openWorkOrder = (id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('workOrder', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const closeWorkOrder = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('workOrder')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        setActiveWorkOrderId(null)
    }

    if (!open) return null

    const margin = data ? data.sales_analysis.total_revenue - data.sales_analysis.total_cost_basis : 0
    const marginPercent = data && data.sales_analysis.total_revenue > 0
        ? (margin / data.sales_analysis.total_revenue) * 100
        : 0

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="full"
            hideScrollArea={true}
            allowOverflow={true}
            className="max-w-5xl"
            variant="form-tabs"
            icon={BarChart3}
            title="Insights del Producto"
            description={productName || undefined}
        >
            <div className="flex flex-col h-full overflow-visible">
                 {loading || !data ? (
                     <SkeletonShell isLoading={loading || !data} ariaLabel="Cargando insights del producto">
                         <div className="p-6">
                             {/* Content will be rendered by SkeletonShell when loading */}
                         </div>
                     </SkeletonShell>
                 ) : (
                    <FormTabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        orientation="horizontal"
                        variant="underline"
                        items={[
                            { value: "overview", label: "Resumen", icon: LayoutDashboard },
                            { value: "history", label: "Precios", icon: History },
                            { value: "kardex", label: "Kardex", icon: ArrowRightLeft },
                            { value: "production", label: "Producción", icon: Factory }
                        ]}
                        className="flex-1 overflow-visible"
                    >
                        <div className="flex-1 overflow-auto p-6 scrollbar-thin">

                            {/* OVERVIEW TAB */}
                            <FormTabsContent value="overview" className="mt-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <StatCard
                                        label="Ventas Totales"
                                        value={<>{data.sales_analysis.total_sold} <span className="text-xs">uds</span></>}
                                        variant="compact"
                                        accent="success"
                                    />
                                    <StatCard
                                        label="Ingresos (Neto)"
                                        value={<DataCell.Currency value={data.sales_analysis.total_revenue} className="text-2xl font-black text-left" />}
                                        variant="compact"
                                        accent="primary"
                                    />
                                    <StatCard
                                        label="Margen Bruto"
                                        value={<DataCell.Currency value={margin} className="text-2xl font-black text-left" />}
                                        variant="compact"
                                        accent="warning"
                                    />
                                    <StatCard
                                        label="% de Margen"
                                        value={`${marginPercent.toFixed(1)}%`}
                                        variant="compact"
                                        accent={marginPercent >= 20 ? "info" : "destructive"}
                                    >
                                        <div className="flex items-center gap-2 mt-1">
                                            {marginPercent >= 20 ? <ArrowUpRight className="h-4 w-4 text-primary" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                                        </div>
                                    </StatCard>
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
                            </FormTabsContent>

                            {/* HISTORY TAB */}
                            <FormTabsContent value="history" className="mt-0 space-y-6">
                                <div className="h-[250px] w-full bg-card rounded-md border p-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={[...data.price_history].reverse()}>
                                            <defs>
                                                <linearGradient id="colorSale" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(str) => format(new Date(str), 'MMM d')}
                                                fontSize={10}
                                                tickMargin={10}
                                            />
                                            <YAxis fontSize={10} />
                                            <RechartsTooltip
                                                labelFormatter={(val) => format(new Date(val), 'PPP', { locale: es })}
                                                formatter={(val) => [formatCurrency(Number(val || 0)), '']}
                                            />
                                            <Legend verticalAlign="top" height={36} />
                                            <Area type="monotone" name="Precio Venta" dataKey="sale_price" stroke="var(--primary)" fillOpacity={1} fill="url(#colorSale)" strokeWidth={2} />
                                            <Area type="monotone" name="Costo" dataKey="cost_price" stroke="var(--destructive)" fillOpacity={1} fill="url(#colorCost)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="rounded-md border">
                                    <PriceHistoryTable entries={data.price_history} />
                                </div>
                            </FormTabsContent>

                            {/* KARDEX TAB */}
                            <FormTabsContent value="kardex" className="mt-0">
                                <div className="rounded-md border">
                                    <KardexTable
                                        entries={data.kardex}
                                        onOpenWorkOrder={openWorkOrder}
                                        onOpenTransaction={openTransaction}
                                    />
                                </div>
                            </FormTabsContent>

                            {/* PRODUCTION TAB */}
                            <FormTabsContent value="production" className="mt-0">
                                <div className="rounded-md border">
                                    <ProductionUsageTable
                                        entries={data.production_usage}
                                        onOpenWorkOrder={openWorkOrder}
                                    />
                                </div>
                            </FormTabsContent>
                        </div>
                    </FormTabs>
                )}
            </div>

            {selectedTransaction && (
                <TransactionViewModal
                    open={!!selectedTransaction}
                    onOpenChange={(open) => !open && closeTransaction()}
                    type={selectedTransaction.type}
                    id={selectedTransaction.id}
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
        </BaseModal>
    )
}

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
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[0.25rem] border border-border bg-muted/50 text-muted-foreground whitespace-nowrap">
                    {row.original.user}
                </span>
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
                <span className="text-xs">{format(new Date(row.original.date), "dd/MM/yyyy")}</span>
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
                    />
                )
            },
        },
        {
            header: "Cantidad",
            cell: ({ row }) => {
                const m = row.original
                return <DataCell.Number value={m.quantity} className="text-left" suffix={m.uom} decimals={2} />
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
                                action="view"
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
                <span className="text-xs">{format(new Date(row.original.date), "dd/MM/yyyy")}</span>
            ),
        },
        {
            header: "N° OT",
            cell: ({ row }) => (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[0.25rem] border border-border bg-muted/50 text-muted-foreground whitespace-nowrap">
                    {formatEntityDisplay('production.workorder', { number: row.original.ot_number })}
                </span>
            ),
        },
        {
            header: "Cantidad Consumida",
            cell: ({ row }) => (
                <DataCell.Number value={row.original.quantity} className="text-left" decimals={2} />
            ),
        },
        {
            header: "Acciones",
            cell: ({ row }) => (
                <div className="text-right">
                    <DataCell.ActionGroup>
                        <DataCell.Action
                            action="view"
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
