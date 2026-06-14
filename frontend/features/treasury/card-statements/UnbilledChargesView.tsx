"use client"

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    Plus, Receipt, CreditCard, Wallet, ReceiptText, DollarSign, TrendingUp, Timer,
    Gauge, ArrowUpRight, Activity, Store, AlertTriangle, BarChart3, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ColumnDef } from '@tanstack/react-table'
import {
    DataTableView,
    DataTableColumnHeader,
    DataCell,
    MoneyDisplay,
    EntityCard,
    StatusBadge,
    SmartSearchBar,
    useSmartSearch,
    UnderlineTabs,
    StatCard,
    TimelineView,
    SummaryTable,
} from '@/components/shared'
import type { SearchDefinition } from '@/types/search'
import { treasuryApi } from '../api/treasuryApi'
import type { PendingChargeRow, UpcomingInstallment, UnbilledItemRow } from '../types'
import { mapToUnbilledItemRows } from './utils'
import { AddChargeModal } from './AddChargeModal'
import { BillChargesModal } from './BillChargesModal'
import { CreditUtilizationRing } from './CreditUtilizationRing'
import { UpcomingCalendar } from './UpcomingCalendar'
import { useHubPanel } from '@/components/providers'
import { useTcHubData } from './useTcHubData'

interface UnbilledChargesViewProps {
    creditCardAccounts: Array<{ id: number; name: string; currency: string }>
}

const chargeTypeColorMap: Record<string, string> = {
    COMMISSION: 'bg-warning text-warning-foreground',
    TAX: 'bg-destructive text-destructive-foreground',
    FEE: 'bg-info text-info-foreground',
    INSURANCE: 'bg-accent text-accent-foreground',
    OTHER: 'bg-muted text-muted-foreground',
}

const CHARGE_TYPE_COLORS: Record<string, string> = {
    COMMISSION: "#f59e0b",
    TAX: "#ef4444",
    FEE: "#3b82f6",
    INSURANCE: "#8b5cf6",
    OTHER: "#6b7280",
}

interface UnbilledSummary {
    total: number
    count: number
    charges: number
    installments: number
}

export function UnbilledChargesView({
    creditCardAccounts,
}: UnbilledChargesViewProps) {
    const [showAddCharge, setShowAddCharge] = useState(false)
    const [showBillCharges, setShowBillCharges] = useState(false)
    const queryClient = useQueryClient()
    const { openHub } = useHubPanel()

    const searchDef: SearchDefinition = useMemo(() => ({
        fields: [
            {
                key: 'scope',
                label: 'Alcance',
                type: 'enum',
                serverParam: 'scope',
                defaultValue: 'month',
                options: [
                    { label: 'Cargos del mes', value: 'month' },
                    { label: 'Todos los cargos', value: 'all' },
                ],
            },
            {
                key: 'card',
                label: 'Tarjeta',
                type: 'enum',
                serverParam: 'card',
                defaultValue: String(creditCardAccounts[0]?.id ?? ''),
                options: creditCardAccounts.map(a => ({ label: a.name, value: String(a.id) })),
            },
        ],
    }), [creditCardAccounts])

    const { filters, applyFilter } = useSmartSearch(searchDef)

    const selectedCardAccount = filters.card ? Number(filters.card) : (creditCardAccounts[0]?.id ?? 0)
    const currentAccount = creditCardAccounts.find(a => a.id === selectedCardAccount)
    const cardAccountName = currentAccount?.name ?? ''
    const currency = currentAccount?.currency ?? 'CLP'

    const today = new Date().toISOString().split('T')[0]
    const cutOffDate = filters.scope !== 'all' ? today : undefined

    const { data: result, isLoading } = useQuery({
        queryKey: ['unbilled-charges', selectedCardAccount, cutOffDate ?? 'all'],
        queryFn: () => treasuryApi.getUnbilledCharges(selectedCardAccount, cutOffDate),
        enabled: !!selectedCardAccount,
    })

    const charges: PendingChargeRow[] = result?.charges ?? []
    const upcomingInstallments: UpcomingInstallment[] = result?.upcoming_installments ?? []
    const summary: UnbilledSummary | undefined = result?.summary
    const forecast = result?.forecast

    const mergedRows = useMemo(
        () => mapToUnbilledItemRows(charges, upcomingInstallments),
        [charges, upcomingInstallments],
    )

    // ── Hub segmentation state ───────────────────────────────────
    const [granularity, setGranularity] = useState<"day" | "month" | "year">("month")
    const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)

    const hubData = useTcHubData(selectedCardAccount, granularity, dateRange)

    const handleAddChargeSuccess = () => {
        setShowAddCharge(false)
        queryClient.invalidateQueries({ queryKey: ['unbilled-charges', selectedCardAccount] })
        toast.success('Cargo agregado exitosamente')
    }

    const handleBillChargesSuccess = () => {
        setShowBillCharges(false)
        queryClient.invalidateQueries({ queryKey: ['unbilled-charges', selectedCardAccount] })
        queryClient.invalidateQueries({ queryKey: ['card-statements'] })
        toast.success('Cargos facturados exitosamente')
    }

    const columns: ColumnDef<UnbilledItemRow, any>[] = [
        {
            accessorKey: 'date',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.original.date} />
                </div>
            ),
            sortingFn: 'datetime',
        },
        {
            id: 'cuota',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cuota" className="justify-center" />
            ),
            cell: ({ row }) => {
                const item = row.original
                if (item.source === 'pending') {
                    return (
                        <div className="flex justify-center w-full">
                            <span className="text-xs text-muted-foreground">N/A</span>
                        </div>
                    )
                }
                if (!item.installmentNumber || !item.totalInstallments) return null
                return (
                    <div className="flex justify-center w-full">
                        <span className="text-xs font-medium tabular-nums">
                            {item.installmentNumber}/{item.totalInstallments}
                        </span>
                    </div>
                )
            },
            enableSorting: false,
        },
        {
            id: 'compra',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Compra asociada" className="justify-center" />
            ),
            cell: ({ row }) => {
                const item = row.original
                if (item.source !== 'installment' || !item.originalInstallment) return null
                const inst = item.originalInstallment
                return (
                    <div className="flex justify-center w-full">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                if (inst.purchase_order_id) {
                                    openHub({ orderId: inst.purchase_order_id, type: 'purchase' })
                                }
                            }}
                            className="inline-block outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md transition-shadow"
                        >
                            <StatusBadge
                                status={inst.purchase_order_display_id ? 'info' : 'muted'}
                                label={inst.purchase_order_display_id || 'Sin OC'}
                            />
                        </button>
                    </div>
                )
            },
            enableSorting: false,
        },
        {
            accessorKey: 'amount',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Monto" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency
                        value={row.original.amount}
                        currency={currency}
                        className="font-bold"
                    />
                </div>
            ),
            sortingFn: 'basic',
        },
        {
            id: 'tipo',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />
            ),
            cell: ({ row }) => {
                const item = row.original
                const colorClass = item.source === 'pending'
                    ? (chargeTypeColorMap[item.chargeType ?? ''] || 'bg-muted text-muted-foreground')
                    : 'bg-info text-info-foreground'
                const label = item.chargeTypeDisplay || item.chargeType || (item.source === 'installment' ? 'Cuota' : '')
                return (
                    <div className="flex justify-center w-full">
                        <StatusBadge
                            status={item.chargeType || item.source}
                            label={label}
                        />
                    </div>
                )
            },
        },
    ]

    const actionButtons = (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                className="rounded-md border-0 h-10 text-[10px] font-black uppercase tracking-widest"
                disabled={!summary || summary.count === 0}
                onClick={() => setShowBillCharges(true)}
            >
                <Receipt className="h-3.5 w-3.5 mr-2" />
                Facturar Cargos
            </Button>
            <Button className="rounded-md h-10 text-[10px] font-black uppercase tracking-widest" onClick={() => setShowAddCharge(true)}>
                <Plus className="h-3.5 w-3.5 mr-2" />
                Agregar Cargo
            </Button>
        </div>
    )

    const fmt = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n)

    // ── Charge type helpers for hub ──
    const chargeTypeDistribution = useMemo(() => {
        const groups: Record<string, { count: number; amount: number }> = {}
        for (const c of charges) {
            const t = c.charge_type || 'OTHER'
            if (!groups[t]) groups[t] = { count: 0, amount: 0 }
            groups[t].count++
            groups[t].amount += Number(c.amount)
        }
        return Object.entries(groups)
            .map(([id, v]) => ({ id, count: v.count, amount: v.amount, color: CHARGE_TYPE_COLORS[id] ?? CHARGE_TYPE_COLORS.OTHER }))
            .sort((a, b) => b.amount - a.amount)
    }, [charges])

    const partnerDistribution = useMemo(() => {
        const groups: Record<string, number> = {}
        for (const i of upcomingInstallments) {
            const p = i.partner_name || 'Desconocido'
            groups[p] = (groups[p] ?? 0) + Number(i.principal_amount)
        }
        return Object.entries(groups)
            .map(([id, value]) => ({ id, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
    }, [upcomingInstallments])

    const topPartners = useMemo(() => {
        const groups: Record<string, { total: number; count: number }> = {}
        for (const i of upcomingInstallments) {
            const p = i.partner_name || 'Desconocido'
            if (!groups[p]) groups[p] = { total: 0, count: 0 }
            groups[p].total += Number(i.principal_amount)
            groups[p].count++
        }
        return Object.entries(groups)
            .map(([partner, v]) => ({ partner, total: v.total, count: v.count }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8)
    }, [upcomingInstallments])

    const creditComposition = useMemo(() => forecast ? [
        { id: "Deuda Facturada", value: parseFloat(forecast.current_debt), color: "#ef4444" },
        { id: "No Facturado", value: parseFloat(forecast.total_unbilled), color: "#f59e0b" },
        { id: "Disponible", value: parseFloat(forecast.available_credit ?? "0"), color: "#22c55e" },
    ].filter(d => d.value > 0) : [], [forecast])

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.unbilled-charge"
                    columns={columns}
                    data={mergedRows}
                    isLoading={isLoading}
                    variant="embedded"
                    analyticsPanel={{
                        screen: {
                            entityName: "Gestión TC",
                            granularity,
                            onGranularityChange: setGranularity,
                            dateRange,
                            onDateRangeChange: setDateRange,
                            tabs: [
                                // ── Tab 1: Resumen Ejecutivo ──
                                {
                                    value: 'resumen',
                                    label: 'Resumen',
                                    icon: Activity,
                                    columns: [
                                        { id: 'res-col-main', weight: 2, sections: [
                                            {
                                                id: 'hero-kpis',
                                                colSpan: 3,
                                                content: {
                                                    type: 'custom',
                                                    render: (
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                            <StatCard
                                                                label="Deuda Consolidada"
                                                                value={<MoneyDisplay amount={hubData.totalCombined} inline />}
                                                                icon={DollarSign}
                                                                accent="warning"
                                                                variant="fill"
                                                                valueSize="lg"
                                                            />
                                                            <StatCard
                                                                label="No Facturado"
                                                                value={<MoneyDisplay amount={hubData.totalUnbilled} inline />}
                                                                icon={Wallet}
                                                                accent="primary"
                                                                variant="fill"
                                                            />
                                                            <StatCard
                                                                label="Facturado Pendiente"
                                                                value={<MoneyDisplay amount={hubData.totalDebt} inline />}
                                                                icon={CreditCard}
                                                                accent="destructive"
                                                                variant="fill"
                                                            />
                                                        </div>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'debt-trend',
                                                colSpan: 3,
                                                content: hubData.paymentPerformanceChart[0]?.data.length ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Evolución de Deuda (Facturado + No Facturado)',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'line-chart',
                                                            config: {
                                                                data: hubData.paymentPerformanceChart,
                                                                enableArea: true,
                                                                showLegend: false,
                                                                valueFormat: ' >-$s',
                                                            },
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos históricos</p>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'cost-summary-section',
                                                colSpan: 2,
                                                content: hubData.financialCostsChart.length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Costo Financiero Últimos Períodos',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'bar-chart',
                                                            config: {
                                                                data: hubData.financialCostsChart.slice(-6).map(c => ({
                                                                    period: c.period,
                                                                    Intereses: c.interest,
                                                                    Comisiones: c.fees,
                                                                })),
                                                                keys: ['Intereses', 'Comisiones'],
                                                                indexBy: 'period',
                                                                valueFormat: ' >-$s',
                                                                showLegend: true,
                                                                enableGridY: true,
                                                                compact: true,
                                                            },
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de costos</p>
                                                    ),
                                                },
                                            },
                                        ]},
                                        { id: 'res-col-side', weight: 1, sections: [
                                            {
                                                id: 'alerts',
                                                content: {
                                                    type: 'custom',
                                                    render: (
                                                        <div className="space-y-2">
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                                                                Alertas
                                                            </h4>
                                                            {hubData.overdueCount > 0 ? (
                                                                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs font-bold">
                                                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                                    {hubData.overdueCount} estado(s) vencido(s)
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-success/10 text-success text-xs font-bold">
                                                                    <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                                                                    Sin estados vencidos
                                                                </div>
                                                            )}
                                                            {forecast?.credit_limit && (parseFloat(forecast.total_used) / parseFloat(forecast.credit_limit)) > 0.8 && (
                                                                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-warning/10 text-warning text-xs font-bold">
                                                                    <Gauge className="h-3.5 w-3.5 shrink-0" />
                                                                    Cupo cercano al límite ({Math.round((parseFloat(forecast.total_used) / parseFloat(forecast.credit_limit)) * 100)}%)
                                                                </div>
                                                            )}
                                                        </div>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'next-payments',
                                                content: hubData.nextUpcomingPayments.length > 0 ? {
                                                    type: 'custom',
                                                    render: (
                                                        <div>
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                                                                Próximos Vencimientos
                                                            </h4>
                                                            <TimelineView events={hubData.nextUpcomingPayments.slice(0, 6)} />
                                                        </div>
                                                    ),
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin próximos eventos</p>
                                                    ),
                                                },
                                            },
                                        ]},
                                    ],
                                },
                                // ── Tab 2: Pagos y Flujo ──
                                {
                                    value: 'flujo',
                                    label: 'Flujo',
                                    icon: TrendingUp,
                                    columns: [
                                        { id: 'flujo-col-main', weight: 2, sections: [
                                            {
                                                id: 'projection-hero',
                                                colSpan: 4,
                                                content: {
                                                    type: 'custom',
                                                    render: (
                                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                                            <StatCard
                                                                label="Total a Facturar (Próx. Cierre)"
                                                                value={<MoneyDisplay amount={parseFloat(forecast?.next_statement_total ?? '0')} inline />}
                                                                icon={DollarSign}
                                                                accent="warning"
                                                                valueSize="lg"
                                                                variant="fill"
                                                            />
                                                            <StatCard
                                                                label="Próximo Cierre"
                                                                value={forecast?.next_statement_date ? new Date(forecast.next_statement_date).toLocaleDateString('es-CL') : '—'}
                                                                icon={Timer}
                                                                accent="info"
                                                                variant="fill"
                                                                subtext={forecast ? `en ${forecast.days_to_next_statement} días` : undefined}
                                                            />
                                                            <StatCard
                                                                label="Cuotas a Facturar"
                                                                value={forecast ? String(Object.values(forecast.by_month).reduce((s, m) => s + m.count, 0)) : '0'}
                                                                icon={Wallet}
                                                                accent="primary"
                                                                variant="fill"
                                                                subtext={`$${fmt(parseFloat(forecast?.installments_until_next_statement ?? '0'))} en cuotas`}
                                                            />
                                                            <StatCard
                                                                label="Cargos a Facturar"
                                                                value={`$${fmt(parseFloat(forecast?.pending_until_next_statement ?? '0'))}`}
                                                                icon={ReceiptText}
                                                                accent="success"
                                                                variant="fill"
                                                            />
                                                        </div>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'monthly-projection',
                                                colSpan: 4,
                                                content: forecast?.by_month && Object.keys(forecast.by_month).length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Proyección Mensual de Cuotas',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'bar-chart',
                                                            config: {
                                                                data: Object.entries(forecast.by_month)
                                                                    .sort(([a], [b]) => a.localeCompare(b))
                                                                    .map(([key, val]) => {
                                                                        const d = new Date(key + "-02")
                                                                        return {
                                                                            month: d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }),
                                                                            total: parseFloat(val.total),
                                                                            count: val.count,
                                                                        }
                                                                    }),
                                                                keys: ['total'],
                                                                indexBy: 'month',
                                                                valueFormat: ' >-$s',
                                                                showLegend: false,
                                                                lineOverlay: {
                                                                    dataKey: 'count',
                                                                    label: 'Cant. Cuotas',
                                                                    color: '#22c55e',
                                                                },
                                                            },
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin proyección disponible</p>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'calendar-upcoming',
                                                colSpan: 2,
                                                content: {
                                                    type: 'custom',
                                                    render: (
                                                        <UpcomingCalendar
                                                            byMonth={forecast?.by_month ?? {}}
                                                            currency={currency}
                                                        />
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'timeline-events',
                                                colSpan: 2,
                                                content: hubData.nextUpcomingPayments.length > 0 ? {
                                                    type: 'custom',
                                                    render: <TimelineView events={hubData.nextUpcomingPayments} />,
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin cuotas futuras</p>
                                                    ),
                                                },
                                            },
                                        ]},
                                        { id: 'flujo-col-side', weight: 1, sections: [
                                            {
                                                id: 'payment-summary-table',
                                                content: hubData.analytics?.payment_performance?.length ? {
                                                    type: 'custom',
                                                    render: (
                                                        <SummaryTable
                                                            rows={hubData.analytics.payment_performance.slice(0, 8).map(p => ({
                                                                label: `${p.display_id} · ${new Date(p.due_date).toLocaleDateString('es-CL')}`,
                                                                value: (
                                                                    <StatusBadge
                                                                        status={p.status === 'PAID' ? 'success' : p.status === 'OVERDUE' ? 'destructive' : 'warning'}
                                                                        label={p.status === 'PAID' ? `Pagado $${fmt(parseFloat(p.amount_paid))}` : `Pendiente $${fmt(parseFloat(p.outstanding))}`}
                                                                    />
                                                                ),
                                                            }))}
                                                        />
                                                    ),
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin pagos registrados</p>
                                                    ),
                                                },
                                            },
                                        ]},
                                    ],
                                },
                                // ── Tab 3: Costos Financieros ──
                                {
                                    value: 'costos',
                                    label: 'Costos',
                                    icon: Receipt,
                                    columns: [
                                        { id: 'cost-col-main', weight: 2, sections: [
                                            {
                                                id: 'costs-bar',
                                                colSpan: 3,
                                                content: hubData.financialCostsChart.length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Intereses y Comisiones por Período',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'bar-chart',
                                                            config: {
                                                                data: hubData.financialCostsChart.map(c => ({
                                                                    period: c.period,
                                                                    Intereses: c.interest,
                                                                    Comisiones: c.fees,
                                                                })),
                                                                keys: ['Intereses', 'Comisiones'],
                                                                indexBy: 'period',
                                                                valueFormat: ' >-$s',
                                                                showLegend: true,
                                                                enableGridY: true,
                                                            },
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de costos financieros históricos</p>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'charge-types-pie',
                                                colSpan: 1,
                                                content: chargeTypeDistribution.length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Distribución por Tipo de Cargo',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'pie-chart',
                                                            config: {
                                                                data: chargeTypeDistribution.map(d => ({ id: d.id, value: d.amount })),
                                                                innerRadius: 0.6,
                                                                showLegend: true,
                                                                legendDataFrom: 'indexes',
                                                                enableLabels: true,
                                                                arcLabel: (d: any) => `${Math.round((d.value / chargeTypeDistribution.reduce((s, c) => s + c.amount, 0)) * 100)}%`,
                                                            },
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin cargos</p>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'charge-types-stream',
                                                colSpan: 2,
                                                content: {
                                                    type: 'custom',
                                                    render: (
                                                        <SummaryTable
                                                            rows={chargeTypeDistribution.map(ct => ({
                                                                label: ct.id,
                                                                value: <span className="text-xs font-bold">${fmt(ct.amount)} ({ct.count} cargos)</span>,
                                                            }))}
                                                        />
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'purchase-costs',
                                                colSpan: 3,
                                                content: hubData.analytics?.purchase_group_analysis?.length ? {
                                                    type: 'custom',
                                                    render: (
                                                        <div>
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                                                                Costo de Compras en Cuotas
                                                            </h4>
                                                            <SummaryTable
                                                                rows={hubData.analytics.purchase_group_analysis.slice(0, 6).map(g => ({
                                                                    label: `${g.display_id} · ${g.partner_name ?? 'Sin proveedor'} (${g.installments} cuotas)`,
                                                                    value: (
                                                                        <div className="flex flex-col items-end gap-0.5">
                                                                            <span className="text-xs font-bold">${fmt(parseFloat(g.total_payable))}</span>
                                                                            {g.effective_cost_pct != null && (
                                                                                <span className="text-[10px] text-muted-foreground">
                                                                                    Interés: ${fmt(parseFloat(g.total_interest))} ({g.effective_cost_pct.toFixed(2)}%)
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ),
                                                                }))}
                                                            />
                                                        </div>
                                                    ),
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin compras en cuotas</p>
                                                    ),
                                                },
                                            },
                                        ]},
                                        { id: 'cost-col-side', weight: 1, sections: [
                                            {
                                                id: 'cost-trend-badge',
                                                content: {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Tendencia Costos Financieros',
                                                        value: hubData.financialCostsTrend.value,
                                                        icon: Activity,
                                                        accent: hubData.financialCostsTrend.direction === 'up' ? 'destructive' : 'success',
                                                        variant: 'compact',
                                                        trend: hubData.financialCostsTrend,
                                                    },
                                                },
                                            },
                                            {
                                                id: 'charge-type-stacked',
                                                content: chargeTypeDistribution.length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Tipos de Cargo (Cantidad)',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'pie-chart',
                                                            config: {
                                                                data: chargeTypeDistribution.map(d => ({ id: d.id, value: d.count, color: d.color })),
                                                                innerRadius: 0.5,
                                                                showLegend: true,
                                                                legendDataFrom: 'indexes',
                                                                enableLabels: true,
                                                                arcLabel: (d: any) => `${d.value}`,
                                                            },
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin cargos</p>
                                                    ),
                                                },
                                            },
                                        ]},
                                    ],
                                },
                                // ── Tab 4: Cupo y Riesgo ──
                                {
                                    value: 'cupo',
                                    label: 'Cupo',
                                    icon: Gauge,
                                    columns: [
                                        { id: 'cupo-col-main', weight: 2, sections: [
                                            {
                                                id: 'cupo-hero',
                                                colSpan: 3,
                                                content: {
                                                    type: 'custom',
                                                    render: (
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                            <StatCard
                                                                label="Deuda Actual (Facturada)"
                                                                value={<MoneyDisplay amount={parseFloat(forecast?.current_debt ?? '0')} inline />}
                                                                icon={CreditCard}
                                                                accent="destructive"
                                                                variant="fill"
                                                            />
                                                            <StatCard
                                                                label="No Facturado"
                                                                value={<MoneyDisplay amount={hubData.totalUnbilled} inline />}
                                                                icon={TrendingUp}
                                                                accent="warning"
                                                                variant="fill"
                                                            />
                                                            <StatCard
                                                                label="Disponible"
                                                                value={<MoneyDisplay amount={parseFloat(forecast?.available_credit ?? '0')} inline />}
                                                                icon={ArrowUpRight}
                                                                accent="success"
                                                                variant="fill"
                                                            />
                                                        </div>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'credit-composition-donut',
                                                colSpan: 3,
                                                content: creditComposition.length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Composición del Cupo',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'pie-chart',
                                                            config: {
                                                                data: creditComposition.map(d => ({ ...d, color: undefined })),
                                                                innerRadius: 0.6,
                                                                showLegend: true,
                                                                legendDataFrom: 'indexes',
                                                                enableLabels: false,
                                                            },
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de cupo</p>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'utilization-trend',
                                                colSpan: 3,
                                                content: hubData.creditUtilizationHistory.length >= 2 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Proyección de Uso del Cupo',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'line-chart',
                                                            config: {
                                                                data: [
                                                                    { id: 'Usado', data: hubData.creditUtilizationHistory.map(d => ({ x: d.period, y: d.used })) },
                                                                    ...(forecast?.credit_limit ? [{
                                                                        id: 'Límite',
                                                                        data: hubData.creditUtilizationHistory.map(d => ({ x: d.period, y: d.limit })),
                                                                    }] : []),
                                                                ],
                                                                showLegend: true,
                                                                enableArea: false,
                                                                valueFormat: ' >-$s',
                                                                enableGridY: true,
                                                            },
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Datos insuficientes para proyección</p>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'partner-concentration',
                                                colSpan: 3,
                                                content: topPartners.length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Concentración por Proveedor (No Facturado)',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'bar-chart',
                                                            config: {
                                                                data: topPartners,
                                                                keys: ['total'],
                                                                indexBy: 'partner',
                                                                valueFormat: ' >-$s',
                                                                showLegend: false,
                                                                lineOverlay: {
                                                                    dataKey: 'count',
                                                                    label: 'Cant. Cuotas',
                                                                    color: '#22c55e',
                                                                },
                                                            },
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin concentración por proveedor</p>
                                                    ),
                                                },
                                            },
                                        ]},
                                        { id: 'cupo-col-side', weight: 1, sections: [
                                            {
                                                id: 'ring-utilization',
                                                content: forecast?.credit_limit ? {
                                                    type: 'custom',
                                                    render: (
                                                        <CreditUtilizationRing
                                                            limit={parseFloat(forecast.credit_limit)}
                                                            unbilled={hubData.totalUnbilled}
                                                        />
                                                    ),
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de cupo</p>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'cupo-detalle',
                                                content: forecast?.credit_limit ? {
                                                    type: 'custom',
                                                    render: (
                                                        <SummaryTable
                                                            rows={[
                                                                { label: 'Límite de Crédito', value: <MoneyDisplay amount={parseFloat(forecast.credit_limit)} inline /> },
                                                                { label: 'Total Usado', value: <MoneyDisplay amount={parseFloat(forecast.total_used)} inline /> },
                                                                { label: 'Disponible', value: <MoneyDisplay amount={parseFloat(forecast.available_credit ?? '0')} inline /> },
                                                                { label: '% Usado', value: `${((parseFloat(forecast.total_used) / parseFloat(forecast.credit_limit ?? '1')) * 100).toFixed(1)}%` },
                                                                { label: 'Deuda Facturada', value: <MoneyDisplay amount={parseFloat(forecast.current_debt)} inline /> },
                                                                { label: 'Comprometido (No Facturado)', value: <MoneyDisplay amount={hubData.totalUnbilled} inline /> },
                                                            ]}
                                                        />
                                                    ),
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de cupo</p>
                                                    ),
                                                },
                                            },
                                            {
                                                id: 'alert-concentration',
                                                content: partnerDistribution.length > 0 ? {
                                                    type: 'custom',
                                                    render: (
                                                        <div>
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                                                                Share por Proveedor
                                                            </h4>
                                                            <SummaryTable
                                                                rows={partnerDistribution.slice(0, 5).map(p => ({
                                                                    label: p.id,
                                                                    value: <span className="text-xs font-bold">${fmt(p.value)}</span>,
                                                                }))}
                                                            />
                                                        </div>
                                                    ),
                                                } : {
                                                    type: 'custom',
                                                    render: (
                                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin proveedores</p>
                                                    ),
                                                },
                                            },
                                        ]},
                                    ],
                                },
                            ],
                            cardAccounts: creditCardAccounts,
                            cardAccountId: selectedCardAccount,
                            onCardAccountChange: (id) => applyFilter('card', String(id)),
                        },
                    }}
                    leftAction={
                        <div className="flex items-center gap-1 w-full">
                            {creditCardAccounts.length > 1 && (
                                <UnderlineTabs
                                    items={creditCardAccounts.map(a => ({ value: String(a.id), label: a.name }))}
                                    value={String(filters.card ?? creditCardAccounts[0]?.id ?? '')}
                                    onValueChange={(v) => applyFilter('card', v)}
                                    orientation="horizontal"
                                    variant="underline"
                                    className="w-auto shrink-0"
                                    headerClassName="h-9 px-0 bg-transparent"
                                    contentClassName="hidden"
                                >
                                    <div />
                                </UnderlineTabs>
                            )}
                            <SmartSearchBar searchDef={searchDef} placeholder="Buscar cargos..." className="flex-1" />
                        </div>
                    }
                    createAction={actionButtons}
                    emptyState={{
                        context: 'treasury',
                        icon: CreditCard,
                        title: 'No hay cargos no facturados',
                        description: 'Los cargos de esta tarjeta de crédito aparecerán aquí antes de ser facturados.',
                    }}
                    renderCard={(item: UnbilledItemRow) => (
                        <EntityCard>
                            <EntityCard.Header
                                title={item.reference || (item.source === 'pending' ? (item.chargeTypeDisplay || 'Cargo') : `Cuota ${item.installmentNumber}/${item.totalInstallments}`)}
                                subtitle={item.date}
                                trailing={
                                    <StatusBadge
                                        status={item.chargeType || item.source}
                                        label={item.chargeTypeDisplay || item.source}
                                    />
                                }
                            />
                            <EntityCard.Body>
                                {item.source === 'pending' && item.notes && (
                                    <EntityCard.Field label="Descripción" value={item.notes} full />
                                )}
                            </EntityCard.Body>
                            <EntityCard.Footer className="justify-between items-center border-t bg-muted/10 py-2 px-4">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    Monto
                                </span>
                                <DataCell.Currency
                                    value={item.amount}
                                    currency={currency}
                                    className="font-bold text-base"
                                />
                            </EntityCard.Footer>
                        </EntityCard>
                    )}
                />
            </div>

            {showAddCharge && (
                <AddChargeModal
                    cardAccountId={selectedCardAccount}
                    cardAccountName={cardAccountName}
                    currency={currency}
                    onSuccess={handleAddChargeSuccess}
                    onCancel={() => setShowAddCharge(false)}
                />
            )}

            {showBillCharges && (
                <BillChargesModal
                    cardAccountId={selectedCardAccount}
                    cardAccountName={cardAccountName}
                    total={summary?.total || 0}
                    charges={charges}
                    installments={upcomingInstallments}
                    currency={currency}
                    onSuccess={handleBillChargesSuccess}
                    onCancel={() => setShowBillCharges(false)}
                />
            )}

        </div>
    )
}
