"use client"

import { EntityPanelTab } from "@/components/providers"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useMemo, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    Receipt, CreditCard,
    Gauge,
    TrendingUp, Building2,
} from 'lucide-react'
import {
    AnalyticsPanelContent,
    MoneyDisplay,
    UnifiedSearchBar, useUnifiedSearch,
    StatCard,
    EmptyState,
    ToolbarCreateButton,
    bindUnifiedSearch,
} from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { Collection, useEntityCollection } from '@/components/entity-view'
import { unbilledChargeEntity, unbilledChargeViews } from '../entity-view/unbilledCharge.entity'
import { useCardAccounts } from '../hooks/useCardAccounts'
import { useBanks } from '../hooks/useMasterData'
import type { PendingChargeRow, UpcomingInstallment, UnbilledItemRow } from '../types'
import { mapToUnbilledItemRows } from './utils'
import { CardPendingChargeDrawer } from './CardPendingChargeDrawer'
import { BillChargesModal } from './BillChargesModal'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { useEntityRouteActions } from '@/hooks/useEntityRouteActions'
import { useUnbilledCharges } from '../hooks/useUnbilledCharges'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'
import { useUnbilledAnalyticsData } from "@/features/treasury/hooks/useUnbilledAnalyticsData"
import type { Granularity } from "@/lib/analytics-helpers"

interface UnbilledChargesClientViewProps {
    /** Banco específico. Si se omite, agrega las tarjetas de todos los bancos. */
    bankId?: number
}

interface UnbilledSummary {
    total: number
    count: number
    charges: number
    installments: number
}

export function UnbilledChargesClientView({
    bankId,
}: UnbilledChargesClientViewProps = {}) {

    const [showBillCharges, setShowBillCharges] = useState(false)
    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("cupo")
    const [granularity, setGranularity] = useState<Granularity>("month")
    const queryClient = useQueryClient()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const { selectedId, openSelected, clearActions } = useEntityRouteActions()

    const bankParam = searchParams.get('bank')
    const selectedBankId = bankParam && !isNaN(Number(bankParam)) ? Number(bankParam) : undefined
    const effectiveBankId = bankId ?? selectedBankId
    const { banks } = useBanks()
    const filterOptions = useMemo(
        () => ({ bank: banks.map((bank) => ({ label: bank.name, value: String(bank.id) })) }),
        [banks],
    )

    const { cardAccounts: creditCardAccounts, isLoading: overviewLoading } = useCardAccounts(effectiveBankId)
    const isAggregate = !bankId

    const unifiedConfig: UnifiedSearchConfig = useMemo(() => {
        const filters: NonNullable<UnifiedSearchConfig['filters']> = [
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
                defaultValue: isAggregate ? 'all' : String(creditCardAccounts[0]?.id ?? ''),
                options: [
                    ...(isAggregate ? [{ label: 'Todas las tarjetas', value: 'all' }] : []),
                    ...creditCardAccounts.map(a => ({ label: a.name, value: String(a.id) })),
                ],
            },
        ]
        if (isAggregate) {
            filters.unshift({ type: 'single', key: 'bank', label: 'Banco', serverParam: 'bank', dynamic: true })
        }
        return {
            searchFields: [
                { key: 'contact', label: 'Contacto / OC', type: 'text', serverParam: 'search', clientKey: ['partnerName', 'purchaseOrderDisplayId', 'reference'] },
                { key: 'amount', label: 'Monto', type: 'text', serverParam: 'search' },
            ],
            filters,
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
        }
    }, [creditCardAccounts, isAggregate])

    const search = useUnifiedSearch(unifiedConfig, filterOptions)

    const cardFilter = search.filters.card
    const selectedCardId = cardFilter && cardFilter !== 'all' ? Number(cardFilter) : null
    const selectedCardAccount = selectedCardId !== null && creditCardAccounts.some((account) => account.id === selectedCardId)
        ? selectedCardId
        : (bankId ? (creditCardAccounts[0]?.id ?? null) : null)
    const isAllCards = isAggregate && selectedCardAccount === null
    const currentAccount = creditCardAccounts.find(a => a.id === selectedCardAccount)
    const cardAccountName = currentAccount?.name ?? ''
    const currency = currentAccount?.currency ?? 'CLP'

    const cutOffDate = (search.filters.scope ?? 'month') !== 'all' ? new Date().toISOString().split('T')[0] : undefined

    const { data: result, isLoading } = useUnbilledCharges({
        cardAccountId: selectedCardAccount ?? undefined,
        bankId: selectedCardAccount ? undefined : effectiveBankId,
        cutOffDate,
        enabled: creditCardAccounts.length > 0,
    })

    const charges: PendingChargeRow[] = result?.charges ?? []
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
        if (charge_date_from) result = result.filter(r => r.date >= charge_date_from)
        if (charge_date_to) result = result.filter(r => r.date <= charge_date_to)
        return result
    }, [mergedRows, search.filterFn, search.filters])

    // Inject currency so f.money per-row accessor can read it
    const rows: UnbilledItemRow[] = useMemo(
        () => filteredRows.map(r => ({ ...r, currency })),
        [filteredRows, currency],
    )

    const chargePanel = useEntityPanelRoute({ enabled: !isAllCards, resolved: !!chargeToEdit })

    useEffect(() => {
        if (selectedId && !chargeToEdit) clearActions()
    }, [selectedId, chargeToEdit, clearActions])

    const handleChargeDrawerSuccess = () => {
        chargePanel.close()
        invalidateCrossFeature(queryClient, [['unbilled-charges']])
    }

    const handleAddChargeClick = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('modal', 'new')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleBillChargesSuccess = () => {
        setShowBillCharges(false)
        invalidateCrossFeature(queryClient, [['unbilled-charges'], ['card-statements']])
        toast.success('Cargos facturados exitosamente')
    }

    const toolbarActions = [
        ...(summary && summary.count > 0 ? [{
            key: 'bill',
            label: 'Facturar Cargos',
            icon: Receipt,
            onClick: () => setShowBillCharges(true),
        }] : []),
    ]

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
                color: colorMap.get(d.id) ?? 'var(--color-muted-foreground)',
            }))
            .sort((a, b) => b.amount - a.amount)
    }, [analyticsData, chargeTypeDisplayMap])

    const totalInstAmount = useMemo(
        () => analyticsData.upcomingInstallments.reduce((s, i) => s + Number(i.principal_amount), 0),
        [analyticsData.upcomingInstallments],
    )
    const totalInstCount = analyticsData.upcomingInstallments.length

    const usedPercent = forecast?.credit_limit ? (parseFloat(forecast.total_used) / parseFloat(forecast.credit_limit)) * 100 : 0

    const collection = useEntityCollection(
        unbilledChargeEntity,
        { rows, isLoading, isFiltered: search.isFiltered },
        { pagination: { mode: "client" } },
    )

    if (creditCardAccounts.length === 0 && !overviewLoading) {
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
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                onOpen={(row: UnbilledItemRow) => {
                    if (isAllCards) return
                    if (row.source === 'pending' && row.originalPendingCharge) {
                        openSelected(row.originalPendingCharge.id)
                    }
                }}
            >
                <Collection.Toolbar
                    action={isAllCards ? undefined : (
                        <div className="flex items-center gap-2">
                            <ToolbarCreateButton label="Agregar Cargo" onClick={handleAddChargeClick} />
                            {toolbarActions.map(a => (
                                <button
                                    key={a.key}
                                    type="button"
                                    onClick={a.onClick}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                                >
                                    {a.icon && <a.icon className="h-3.5 w-3.5" />}
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    )}
                >
                    <UnifiedSearchBar
                        config={unifiedConfig}
                        {...bindUnifiedSearch(search)}
                        filterOptions={search.filterOptions}
                        placeholder="Buscar por contacto, OC o monto..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={unbilledChargeViews.table}
                    card={unbilledChargeViews.card}
                    emptyTitle="No hay cargos no facturados"
                    emptyDescription={
                        isAggregate
                            ? 'Los cargos de todas las tarjetas aparecerán aquí antes de ser facturados.'
                            : 'Los cargos de esta tarjeta de crédito aparecerán aquí antes de ser facturados.'
                    }
                    onResetFilters={search.clearAll}
                />
                <Collection.Analytics>
                    <AnalyticsPanelContent
                        entityName="Gestión TC"
                        activeTab={analyticsActiveTab}
                        onTabChange={setAnalyticsActiveTab}
                        granularity={granularity}
                        onGranularityChange={setGranularity}
                        tabs={[
                            {
                                value: 'cupo',
                                label: 'Cupo y Cargos',
                                icon: Gauge,
                                columns: [
                                    {
                                        id: 'cupo-col',
                                        weight: 3,
                                        sections: [
                                            {
                                                id: 'cupo-kpis',
                                                fillRemaining: false,
                                                content: forecast?.credit_limit ? {
                                                    type: 'custom',
                                                    render: (
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                                            <StatCard label="Límite de Crédito" value={<MoneyDisplay amount={parseFloat(forecast.credit_limit)} inline />} variant="default" accent="primary" />
                                                            <StatCard label="Total Usado" value={<MoneyDisplay amount={parseFloat(forecast.total_used)} inline />} variant="default" accent="warning" />
                                                            <StatCard label="Disponible" value={<MoneyDisplay amount={parseFloat(forecast.available_credit ?? '0')} inline />} variant="default" accent="success" />
                                                            <StatCard label="% Usado" value={`${usedPercent.toFixed(1)}%`} variant="default" accent="destructive" />
                                                        </div>
                                                    ),
                                                } : {
                                                    type: 'custom',
                                                    render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de cupo</p>,
                                                },
                                            },
                                            {
                                                id: 'cupo-chart',
                                                content: chargeTypeSummary.length > 0 || totalInstCount > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Distribución de Cargos',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'pie-chart',
                                                            preset: 'card',
                                                            data: [
                                                                ...chargeTypeSummary.map(d => ({ id: d.display, value: d.amount })),
                                                                ...(totalInstCount > 0 ? [{ id: 'Cuotas', value: totalInstAmount }] : []),
                                                            ],
                                                            valueFormat: 'currency',
                                                            showLegend: true,
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin cargos ni cuotas</p>,
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
                                                            data: [{ id: 'Proyectado', data: analyticsData.monthlyProjection.map(m => ({ x: m.month, y: m.total })) }],
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
                        ]}
                    />
                </Collection.Analytics>
            </Collection.Root>

            <EntityPanelTab label="treasury.cardpendingcharge" {...chargePanel.tab}>
                {(open) => (
                    <CardPendingChargeDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) chargePanel.close() }}
                        cardAccountId={selectedCardAccount ?? 0}
                        cardAccountName={cardAccountName}
                        currency={currency}
                        charge={chargeToEdit}
                        onSuccess={handleChargeDrawerSuccess}
                    />
                )}
            </EntityPanelTab>

            {showBillCharges && (
                <BillChargesModal
                    cardAccountId={selectedCardAccount ?? 0}
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
