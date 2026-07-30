"use client"

import { Button } from "@/components/ui/button"
import { useMemo, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    Receipt, CreditCard,
    Gauge,
    TrendingUp, Building2, Activity,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import {
    DataTableView,
    DataTableColumnHeader,
    DataCell,
    MoneyDisplay,
    AutoEntityCard,
    StatusBadge,
    UnifiedSearchBar,
    useUnifiedSearch,
    StatCard,
    SummaryTable,
    SkeletonShell,
    EmptyState,
    ToolbarCreateButton,
    type ToolbarActionItem,
} from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useBankOverview } from '../hooks/useBankOverview'
import type { BankOverviewData } from '../hooks/useBankOverview'
import type { PendingChargeRow, UpcomingInstallment, UnbilledItemRow } from '../types'
import { mapToUnbilledItemRows } from './utils'
import { CardPendingChargeDrawer } from './CardPendingChargeDrawer'
import { BillChargesModal } from './BillChargesModal'
import { PieChart } from "@/components/shared"
import { useHubPanel } from '@/components/providers'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { useEntityRouteActions } from '@/hooks/useEntityRouteActions'
import { useUnbilledCharges } from '../hooks/useUnbilledCharges'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'
import { useUnbilledAnalyticsData } from "@/features/treasury/hooks/useUnbilledAnalyticsData"
import type { Granularity } from "@/lib/analytics-helpers"
import { unbilledChargeFields } from './unbilledChargeFields'

interface UnbilledChargesClientViewProps {
    bankId: number
}

const chargeTypeColorMap: Record<string, string> = {
    COMMISSION: 'bg-warning text-warning-foreground',
    TAX: 'bg-destructive text-destructive-foreground',
    FEE: 'bg-info text-info-foreground',
    INSURANCE: 'bg-accent text-accent-foreground',
    INTEREST: 'bg-success text-success-foreground',
    OTHER: 'bg-muted text-muted-foreground',
}

interface UnbilledSummary {
    total: number
    count: number
    charges: number
    installments: number
}

export function UnbilledChargesClientView({
    bankId,
}: UnbilledChargesClientViewProps) {

    const [showBillCharges, setShowBillCharges] = useState(false)
    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("cupo")
    const [granularity, setGranularity] = useState<Granularity>("month")
    const queryClient = useQueryClient()
    const { openHub } = useHubPanel()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const { selectedId, openSelected, clearActions } = useEntityRouteActions()
    const isNewModal = searchParams.get('modal') === 'new'

    const { data: overview, isLoading: overviewLoading } = useBankOverview(bankId)
    const overviewData = (overview && !overviewLoading ? overview : null) as BankOverviewData | null

    const creditCardAccounts = useMemo(
        () => (overviewData?.accounts?.filter(
            (acc) => acc.account_type === 'CREDIT_CARD'
        ).map(a => ({ id: a.id, name: a.name, currency: a.currency })) ?? []),
        [overviewData],
    )

    const unifiedConfig: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'contact', label: 'Contacto / OC', type: 'text', serverParam: 'search', clientKey: ['partnerName', 'purchaseOrderDisplayId', 'reference'] },
            { key: 'amount', label: 'Monto', type: 'text', serverParam: 'search' },
        ],
        filters: [
            {
                type: 'single',
                key: 'scope',
                label: 'Alcance',
                serverParam: 'scope',
                defaultValue: 'month',
                options: [
                    { label: 'Cargos del mes', value: 'month' },
                    { label: 'Todos los cargos', value: 'all' },
                ],
            },
            {
                type: 'single',
                key: 'card',
                label: 'Tarjeta',
                serverParam: 'card',
                defaultValue: String(creditCardAccounts[0]?.id ?? ''),
                options: creditCardAccounts.map(a => ({ label: a.name, value: String(a.id) })),
            },
        ],
        dateFilters: [
            {
                type: 'date',
                key: 'charge_date',
                label: 'Fecha del cargo',
                options: [
                    { label: 'Hoy', serverParamFrom: 'charge_date_from', serverParamTo: 'charge_date_to', getValue: today },
                    { label: 'Esta semana', serverParamFrom: 'charge_date_from', serverParamTo: 'charge_date_to', getValue: thisWeek },
                    { label: 'Este mes', serverParamFrom: 'charge_date_from', serverParamTo: 'charge_date_to', getValue: thisMonth },
                    { label: 'Este trimestre', serverParamFrom: 'charge_date_from', serverParamTo: 'charge_date_to', getValue: thisQuarter },
                    { label: 'Este año', serverParamFrom: 'charge_date_from', serverParamTo: 'charge_date_to', getValue: thisYear },
                ],
            },
        ],
        basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
    }), [creditCardAccounts])

    const search = useUnifiedSearch(unifiedConfig)

    const selectedCardAccount = search.filters.card ? Number(search.filters.card) : (creditCardAccounts[0]?.id ?? 0)
    const currentAccount = creditCardAccounts.find(a => a.id === selectedCardAccount)
    const cardAccountName = currentAccount?.name ?? ''
    const currency = currentAccount?.currency ?? 'CLP'

    const cutOffDate = (search.filters.scope ?? 'month') !== 'all' ? new Date().toISOString().split('T')[0] : undefined

    const { data: result, isLoading } = useUnbilledCharges(selectedCardAccount, cutOffDate)

    const charges: PendingChargeRow[] = result?.charges ?? []
    // ── Derive chargeToEdit from URL param (selectedId) ───────────
    const chargeToEdit = useMemo(
        () => selectedId ? charges.find(c => String(c.id) === selectedId) ?? null : null,
        [selectedId, charges],
    )
    const upcomingInstallments: UpcomingInstallment[] = result?.upcoming_installments ?? []
    const summary: UnbilledSummary | undefined = result?.summary
    const forecast = result?.forecast

    const analyticsData = useUnbilledAnalyticsData(charges, upcomingInstallments, forecast, summary, null, granularity)

    const mergedRows = useMemo(
        () => mapToUnbilledItemRows(charges, upcomingInstallments),
        [charges, upcomingInstallments],
    )

    const filteredRows = useMemo(() => {
        let result = search.filterFn(mergedRows)
        const { charge_date_from, charge_date_to } = search.filters
        if (charge_date_from) {
            result = result.filter(r => r.date >= charge_date_from)
        }
        if (charge_date_to) {
            result = result.filter(r => r.date <= charge_date_to)
        }
        return result
    }, [mergedRows, search.filterFn, search.filters])

    const chargeDrawerOpen = isNewModal || !!(selectedId && chargeToEdit)

    // Side effect only: clear URL when selectedId points to a missing charge
    useEffect(() => {
        if (selectedId && !chargeToEdit) {
            clearActions()
        }
    }, [selectedId, chargeToEdit, clearActions])

    const handleChargeDrawerOpenChange = (open: boolean) => {
        if (!open) {
            clearActions()
            if (isNewModal) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete('modal')
                const q = params.toString()
                router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
            }
        }
    }

    const handleChargeDrawerSuccess = () => {
        handleChargeDrawerOpenChange(false)
        invalidateCrossFeature(queryClient, [['unbilled-charges', selectedCardAccount]])
    }

    const handleAddChargeClick = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('modal', 'new')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleBillChargesSuccess = () => {
        setShowBillCharges(false)
        invalidateCrossFeature(queryClient, [['unbilled-charges', selectedCardAccount], ['card-statements']])
        toast.success('Cargos facturados exitosamente')
    }

    const [dateCol, amountCol, cuotaCol] = unbilledChargeFields.toColumns()

    const columns: ColumnDef<UnbilledItemRow, unknown>[] = [
        dateCol,
        cuotaCol,
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
                    <div className="flex flex-col items-center gap-0.5 w-full">
                        {inst.partner_name && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[140px] leading-tight">
                                {inst.partner_name}
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                if (inst.purchase_order_id) {
                                    openHub({ orderId: inst.purchase_order_id, type: 'purchase' })
                                }
                            }}
                            className="inline-block outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md transition-shadow h-auto w-auto p-0 border-none bg-transparent hover:bg-transparent shadow-none"
                        >
                            <StatusBadge
                                status={inst.purchase_order_display_id ? 'info' : 'muted'}
                                label={inst.purchase_order_display_id || 'Sin OC'}
                            />
                        </Button>
                    </div>
                )
            },
            enableSorting: false,
        },
        {
            ...amountCol,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency
                        value={row.original.amount}
                        currency={currency}
                        weight="bold"
                    />
                </div>
            ),
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

    const toolbarActions: ToolbarActionItem[] = [
        ...(summary && summary.count > 0 ? [{
            key: 'bill',
            label: 'Facturar Cargos',
            icon: Receipt,
            onClick: () => setShowBillCharges(true),
        }] : []),
    ]

    const fmt = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n)

    // ── Charge type helpers for hub (from hook) ──
    const chargeTypeDisplayMap = useMemo(() => {
        const map = new Map<string, string>()
        for (const c of charges) {
            const key = c.charge_type || 'OTHER'
            if (!map.has(key)) map.set(key, c.charge_type_display || key)
        }
        return map
    }, [charges])

    const chargeTypeSummary = useMemo(() => {
        const colorMap = new Map(analyticsData.chargeTypeDistribution.map(d => [d.id, d.color]))
        const countMap = new Map(analyticsData.chargeTypeDistribution.map(d => [d.id, d.value]))
        return analyticsData.chargeTypeTotal
            .map(d => ({
                id: d.id,
                display: chargeTypeDisplayMap.get(d.id) || d.id,
                count: countMap.get(d.id) ?? 0,
                amount: d.value,
                color: colorMap.get(d.id) ?? '#6b7280',
            }))
            .sort((a, b) => b.amount - a.amount)
    }, [analyticsData, chargeTypeDisplayMap])

    const totalInstAmount = useMemo(
        () => analyticsData.upcomingInstallments.reduce((s, i) => s + Number(i.principal_amount), 0),
        [analyticsData.upcomingInstallments],
    )
    const totalInstCount = analyticsData.upcomingInstallments.length

    const usedPercent = forecast?.credit_limit ? (parseFloat(forecast.total_used) / parseFloat(forecast.credit_limit)) * 100 : 0

    if (creditCardAccounts.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState
                    title="No hay tarjetas de crédito"
                    description="Cree una cuenta de tipo Tarjeta de Crédito."
                    icon={CreditCard}
                />
            </div>
        )
    }

    return (
        <SkeletonShell isLoading={overviewLoading} ariaLabel="Cargando resumen de tarjeta">
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.unbilled-charge"
                    columns={columns}
                    data={filteredRows}
                    isLoading={isLoading}
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={unifiedConfig}
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
                        placeholder="Buscar por contacto, OC o monto..."
                    />}
                    unifiedSearchConfig={unifiedConfig}
                    showReset={search.isFiltered}
                    isFiltered={search.isFiltered}
                    onReset={search.clearAll}
                    onRowClick={(row: UnbilledItemRow) => {
                        if (row.source === 'pending' && row.originalPendingCharge) {
                            openSelected(row.originalPendingCharge.id)
                        }
                    }}
                    analyticsPanel={{
                        screen: {
                            entityName: "Gestión TC",
                            activeTab: analyticsActiveTab,
                            onTabChange: setAnalyticsActiveTab,
                            granularity,
                            onGranularityChange: setGranularity,
                            tabs: [
                                {
                                    value: 'cupo',
                                    label: 'Cupo y Cargos',
                                    icon: Gauge,
                                    columns: [
                                        {
                                            id: 'cupo-col',
                                            weight: 2,
                                            sections: [
                                                {
                                                    id: 'cupo-unified',
                                                    content: {
                                                        type: 'custom',
                                                         render: forecast?.credit_limit ? (
                                                            <StatCard
                                                                label="Cupo"
                                                                variant="chart"
                                                                className="flex-1"
                                                                chart={
                                                                    <div className="flex flex-col gap-4">
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <div className="flex justify-between items-center text-xs">
                                                                                <span className="font-bold text-foreground">
                                                                                    <MoneyDisplay amount={parseFloat(forecast.total_used)} inline /> usado
                                                                                </span>
                                                                                <span className="font-bold text-muted-foreground">
                                                                                    <MoneyDisplay amount={parseFloat(forecast.available_credit ?? '0')} inline /> disp.
                                                                                </span>
                                                                            </div>
                                                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                                                <div
                                                                                    className="h-full rounded-full bg-warning transition-all"
                                                                                    style={{ width: `${Math.min(usedPercent, 100)}%` }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <SummaryTable
                                                                            rows={[
                                                                                { label: 'Límite de Crédito', value: <MoneyDisplay amount={parseFloat(forecast.credit_limit)} inline /> },
                                                                                { label: 'Total Usado', value: <MoneyDisplay amount={parseFloat(forecast.total_used)} inline /> },
                                                                                { label: 'Disponible', value: <MoneyDisplay amount={parseFloat(forecast.available_credit ?? '0')} inline /> },
                                                                                { label: '% Usado', value: `${usedPercent.toFixed(1)}%` },
                                                                            ]}
                                                                        />
                                                                    </div>
                                                                }
                                                            />
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de cupo</p>
                                                        ),
                                                    },
                                                },
                                            ],
                                        },
                                        {
                                            id: 'cargos-col',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'charge-types-pie',
                                                    content: chargeTypeSummary.length > 0 || totalInstCount > 0 ? {
                                                        type: 'custom',
                                                        render: (
                                                            <StatCard label="Distribución de Cargos" variant="chart" className="flex-1" chart={
                                                                <div className="flex flex-col gap-3">
                                                                    <div className="flex-1 min-h-0" style={{ minHeight: 160 }}>
                                                                        <PieChart
                                                                            data={[...chargeTypeSummary.map((d) => ({ id: d.display, value: d.amount })), ...(totalInstCount > 0 ? [{ id: 'Cuotas', value: totalInstAmount }] : [])]}
                                                                            tooltipFormat="currency"
                                                                            legends={[{
                                                                                anchor: "bottom",
                                                                                direction: "row",
                                                                                translateY: 28,
                                                                                itemWidth: 100,
                                                                                itemHeight: 14,
                                                                                itemsSpacing: 8,
                                                                                symbolSize: 8,
                                                                            }]}
                                                                        />
                                                                    </div>
                                                                    <div className="shrink-0">
                                                                        <SummaryTable
                                                                            rows={[
                                                                                ...chargeTypeSummary.map(ct => ({
                                                                                    label: ct.display,
                                                                                    value: <span className="text-xs font-bold">${fmt(ct.amount)} ({ct.count} cargos)</span>,
                                                                                })),
                                                                                ...(totalInstCount > 0 ? [{
                                                                                    label: 'Cuotas',
                                                                                    value: <span className="text-xs font-bold">${fmt(totalInstAmount)} ({totalInstCount} cuotas)</span>,
                                                                                }] : []),
                                                                            ]}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            } />
                                                        ),
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin cargos ni cuotas</p>
                                                        ),
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    value: 'proyeccion',
                                    label: 'Proyección',
                                    icon: TrendingUp,
                                    columns: [
                                        {
                                            id: 'proy-main',
                                            weight: 2,
                                            sections: [
                                                {
                                                    id: 'monthly-new',
                                                    content: analyticsData.monthlyNewCharges.length > 0 ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Cargos vs Cuotas',
                                                            variant: 'chart',
                                                            chart: {
                                                                type: 'bar-chart',
                                                                preset: 'card',
                                                                data: analyticsData.monthlyNewCharges,
                                                                keys: ['charges', 'installments'],
                                                                indexBy: 'month',
                                                                valueFormat: '$,.0f',
                                                            },
                                                        },
                                                    } : {
                                                        type: 'custom',
                                                        render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos mensuales</p>,
                                                    },
                                                },
                                            ],
                                        },
                                        {
                                            id: 'proy-side',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'monthly-proj',
                                                    content: analyticsData.monthlyProjection.length > 0 ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Proyección Mensual',
                                                            variant: 'chart',
                                                            chart: {
                                                                type: 'line-chart',
                                                                preset: 'card',
                                                                data: [{
                                                                    id: 'Proyectado',
                                                                    data: analyticsData.monthlyProjection.map(m => ({ x: m.month, y: m.total })),
                                                                }],
                                                                valueFormat: '$,.0f',
                                                            },
                                                        },
                                                    } : {
                                                        type: 'custom',
                                                        render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin proyección disponible</p>,
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    value: 'proveedores',
                                    label: 'Proveedores',
                                    icon: Building2,
                                    columns: [
                                        {
                                            id: 'prov-main',
                                            weight: 3,
                                            sections: [
                                                {
                                                    id: 'partner-bar',
                                                    content: analyticsData.topPartners.length > 0 ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Top Proveedores por Monto',
                                                            variant: 'chart',
                                                            chart: {
                                                                type: 'bar-chart',
                                                                preset: 'card',
                                                                data: analyticsData.topPartners.map(p => ({ partner: p.partner, total: p.total })),
                                                                keys: ['total'],
                                                                indexBy: 'partner',
                                                                valueFormat: '$,.0f',
                                                            },
                                                        },
                                                    } : {
                                                        type: 'custom',
                                                        render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de proveedores</p>,
                                                    },
                                                },
                                            ],
                                        },
                                        {
                                            id: 'prov-side',
                                            weight: 2,
                                            sections: [
                                                {
                                                    id: 'partner-dist',
                                                    content: analyticsData.partnerDistribution.length > 0 ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Distribución por Proveedor',
                                                            variant: 'chart',
                                                            chart: {
                                                                type: 'pie-chart',
                                                                preset: 'card',
                                                                data: analyticsData.partnerDistribution,
                                                                valueFormat: 'currency',
                                                            },
                                                        },
                                                    } : {
                                                        type: 'custom',
                                                        render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de proveedores</p>,
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    value: 'actividad',
                                    label: 'Actividad',
                                    icon: Activity,
                                    columns: [
                                        {
                                            id: 'act-main',
                                            weight: 2,
                                            sections: [
                                                {
                                                    id: 'daily-accum',
                                                    content: analyticsData.dailyAccumulation.length > 0 ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Acumulado Diario',
                                                            variant: 'chart',
                                                            chart: {
                                                                type: 'line-chart',
                                                                preset: 'card',
                                                                data: [{
                                                                    id: 'Acumulado',
                                                                    data: analyticsData.dailyAccumulation.map(d => ({ x: d.date, y: d.total })),
                                                                }],
                                                                enableArea: true,
                                                                valueFormat: '$,.0f',
                                                            },
                                                        },
                                                    } : {
                                                        type: 'custom',
                                                        render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin actividad registrada</p>,
                                                    },
                                                },
                                            ],
                                        },
                                        {
                                            id: 'act-side',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'radar-categories',
                                                    content: analyticsData.radarData.length > 0 ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Categorías de Gasto',
                                                            variant: 'chart',
                                                            chart: {
                                                                type: 'bar-chart',
                                                                preset: 'card',
                                                                data: analyticsData.radarData,
                                                                keys: ['value'],
                                                                indexBy: 'category',
                                                                valueFormat: '$,.0f',
                                                            },
                                                        },
                                                    } : {
                                                        type: 'custom',
                                                        render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin categorías</p>,
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    }}
                    createAction={<ToolbarCreateButton label="Agregar Cargo" onClick={handleAddChargeClick} />}
                    toolbarActions={toolbarActions}
                    emptyState={{
                        context: 'treasury',
                        icon: CreditCard,
                        title: 'No hay cargos no facturados',
                        description: 'Los cargos de esta tarjeta de crédito aparecerán aquí antes de ser facturados.',
                    }}
                    renderCard={(item: UnbilledItemRow) => (
                        <AutoEntityCard 
                            key={item.id || item.date + item.amount}
                            data={item}
                            fields={unbilledChargeFields}

                            entityLabel="treasury.unbilledcharge"
                        />
                    )}
                />
            </div>

            <CardPendingChargeDrawer
                open={chargeDrawerOpen}
                onOpenChange={handleChargeDrawerOpenChange}
                cardAccountId={selectedCardAccount}
                cardAccountName={cardAccountName}
                currency={currency}
                charge={chargeToEdit}
                onSuccess={handleChargeDrawerSuccess}
            />

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
        </SkeletonShell>
    )
}
