"use client"

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { CreditCard, Receipt, Gauge, TrendingUp, ShoppingCart } from 'lucide-react'
import type { Granularity } from '@/components/shared'
import {
    AnalyticsPanelContent,
    UnifiedSearchBar, useUnifiedSearch,
    MoneyDisplay, StatCard, bindUnifiedSearch,
} from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { Collection, useEntityCollection, type FieldId } from '@/components/entity-view'
import { creditCardStatementEntity, creditCardStatementViews } from '../entity-view/creditCardStatement.entity'
import { useCardStatements } from '../hooks/useCardStatements'
import { useCardAccounts } from '../hooks/useCardAccounts'
import { StatementDetailModal } from './StatementDetailModal'
import { PayStatementModal } from './PayStatementModal'
import { statementActions, type StatementActionsCtx } from './statementActions'
import type { CreditCardStatement } from './types'
import { useStatementsAnalyticsData } from '../hooks/useStatementsAnalyticsData'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'
import { useEntityRouteActions } from '@/hooks/useEntityRouteActions'

interface StatementsClientViewProps {
    /** Banco específico. Si se omite, agrega las tarjetas de todos los bancos. */
    bankId?: number
}

const STATEMENT_GROUPS: Record<string, FieldId<typeof creditCardStatementEntity.fields>> = {
    status: "status",
    period_month: "period",
}

export function StatementsClientView({ bankId }: StatementsClientViewProps) {
    const searchParams = useSearchParams()
    const { cardAccounts: creditCardAccounts } = useCardAccounts(bankId)
    const isAggregate = !bankId

    const selectedId = searchParams.get("selected") ? Number(searchParams.get("selected")) : null
    const action = searchParams.get("action")
    const isDetailOpen = !!selectedId && (action === "detail" || !action)
    const isPayOpen = !!selectedId && action === "pay"

    const unifiedConfig: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'display_id', label: 'N° Estado', type: 'text', serverParam: 'search', clientKey: 'display_id' },
            { key: 'billed_amount', label: 'Monto facturado', type: 'text', serverParam: 'search' },
        ],
        filters: [
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
        ],
        dateFilters: [
            {
                type: 'date',
                key: 'cutoff_date',
                label: 'Fecha de corte',
                options: [
                    { label: 'Hoy', serverParamFrom: 'cutoff_from', serverParamTo: 'cutoff_to', getValue: today },
                    { label: 'Esta semana', serverParamFrom: 'cutoff_from', serverParamTo: 'cutoff_to', getValue: thisWeek },
                    { label: 'Este mes', serverParamFrom: 'cutoff_from', serverParamTo: 'cutoff_to', getValue: thisMonth },
                    { label: 'Este trimestre', serverParamFrom: 'cutoff_from', serverParamTo: 'cutoff_to', getValue: thisQuarter },
                    { label: 'Este año', serverParamFrom: 'cutoff_from', serverParamTo: 'cutoff_to', getValue: thisYear },
                ],
            },
        ],
        basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
        groupBy: [
            { key: 'status', label: 'Estado', field: 'status' },
            { key: 'period_month', label: 'Mes', field: 'period_month' },
        ],
    }), [creditCardAccounts, isAggregate])

    const search = useUnifiedSearch(unifiedConfig)

    const cardFilter = search.filters.card
    const selectedCardId = cardFilter && cardFilter !== 'all' ? Number(cardFilter) : null
    const cardAccountId = selectedCardId ?? (bankId ? (creditCardAccounts[0]?.id ?? null) : null)

    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("rendimiento")
    const [granularity, setGranularity] = useState<Granularity>("month")

    const params: Record<string, string> = {}
    if (bankId) params.bank = String(bankId)
    if (cardAccountId) params.card_account = String(cardAccountId)

    const analyticsCardId: number | null | undefined = bankId
        ? (cardAccountId ?? undefined)
        : cardAccountId
    const hubData = useStatementsAnalyticsData(analyticsCardId, 24, granularity)

    const { data: statements = [], isLoading, isError } = useCardStatements(
        Object.keys(params).length > 0 ? params : undefined,
    )

    const filteredStatements = useMemo(() => {
        let result = search.filterFn(statements)
        const { cutoff_from, cutoff_to } = search.filters
        if (cutoff_from) result = result.filter(s => s.cut_off_date >= cutoff_from)
        if (cutoff_to) result = result.filter(s => s.cut_off_date <= cutoff_to)
        return result
    }, [statements, search.filterFn, search.filters])

    const { openAction, clearActions } = useEntityRouteActions()

    const openStatement = (id: number, actionType: string) => openAction(id, actionType)

    const selectedStatement = useMemo(
        () => selectedId ? statements.find(s => s.id === selectedId) ?? null : null,
        [selectedId, statements],
    )

    const actionsCtx: StatementActionsCtx = {
        onPay: (stmt) => openStatement(stmt.id, "pay"),
        onViewDetail: (id) => openStatement(id, "detail"),
    }

    const groupBy = search.groupBy ? STATEMENT_GROUPS[search.groupBy] ?? null : null

    const collection = useEntityCollection(
        creditCardStatementEntity,
        { rows: filteredStatements, isLoading, error: isError, isFiltered: search.isFiltered },
        {
            pagination: { mode: "client" },
            groupBy,
        },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                actions={statementActions.forCollection(actionsCtx)}
                onOpen={(stmt: CreditCardStatement) => openStatement(stmt.id, "detail")}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={unifiedConfig}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar por N° de estado o monto..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={creditCardStatementViews.table}
                    card={creditCardStatementViews.card}
                    emptyTitle="No hay estados de cuenta"
                    emptyDescription="Los estados de cuenta de la tarjeta de crédito aparecerán aquí."
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
                                value: 'rendimiento',
                                label: 'Rendimiento',
                                icon: TrendingUp,
                                columns: [
                                    {
                                        id: 'col-evolution',
                                        weight: 3,
                                        sections: [
                                            {
                                                id: 'payment-evolution',
                                                content: hubData.paymentEvolutionChart[0]?.data.some(d => d.y > 0) ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Evolución de Pagos',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'line-chart',
                                                            preset: 'card',
                                                            data: hubData.paymentEvolutionChart,
                                                            valueFormat: '$,.0f',
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos históricos de pagos</p>,
                                                },
                                            },
                                            {
                                                id: 'kpi-cards',
                                                content: hubData.summary ? {
                                                    type: 'custom',
                                                    render: (
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                                                            <StatCard label="Deuda Total" value={<MoneyDisplay amount={parseFloat(hubData.summary.total_debt)} inline />} variant="fill" accent="primary" icon={CreditCard} />
                                                            <StatCard label="No Facturado" value={<MoneyDisplay amount={parseFloat(hubData.summary.total_unbilled)} inline />} variant="fill" accent="info" icon={Receipt} />
                                                            {hubData.summary.total_past_due ? (
                                                                <StatCard label="Vencido" value={<MoneyDisplay amount={parseFloat(hubData.summary.total_past_due)} inline />} variant="fill" accent="destructive" icon={TrendingUp} />
                                                            ) : null}
                                                            <StatCard label="Estados Abiertos" value={String(hubData.summary.open_statements)} subtext={`${hubData.summary.overdue_statements} vencidos`} variant="fill" accent="warning" icon={Gauge} />
                                                        </div>
                                                    ),
                                                } : {
                                                    type: 'custom',
                                                    render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin KPIs disponibles</p>,
                                                },
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                value: 'costos',
                                label: 'Costos',
                                icon: Receipt,
                                columns: [
                                    {
                                        id: 'col-costs-timeline',
                                        weight: 1,
                                        sections: [
                                            {
                                                id: 'costs-bar',
                                                content: hubData.financialCosts.length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Costos Financieros por Período',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'bar-chart',
                                                            preset: 'card',
                                                            data: hubData.financialCosts.map(c => ({
                                                                period: c.period,
                                                                intereses: parseFloat(c.interest),
                                                                comisiones: parseFloat(c.fees),
                                                            })),
                                                            keys: ['intereses', 'comisiones'],
                                                            indexBy: 'period',
                                                            valueFormat: '$,.0f',
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin costos financieros</p>,
                                                },
                                            },
                                        ],
                                    },
                                    {
                                        id: 'col-effective-cost',
                                        weight: 1,
                                        sections: [
                                            {
                                                id: 'effective-cost-bar',
                                                content: hubData.purchaseGroupData.length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Costo Efectivo por Compra',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'bar-chart',
                                                            preset: 'card',
                                                            data: hubData.purchaseGroupData.slice(0, 12).map(g => ({
                                                                group: g.display_id,
                                                                costPct: g.effective_cost_pct ?? 0,
                                                            })),
                                                            keys: ['costPct'],
                                                            indexBy: 'group',
                                                            axisLeftLegend: '%',
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de compras</p>,
                                                },
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                value: 'compras',
                                label: 'Compras',
                                icon: ShoppingCart,
                                columns: [
                                    {
                                        id: 'col-purchase-breakdown',
                                        weight: 1,
                                        sections: [
                                            {
                                                id: 'purchase-pie',
                                                content: hubData.costBreakdownDonut.length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Capital vs Intereses',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'pie-chart',
                                                            preset: 'card',
                                                            data: hubData.costBreakdownDonut,
                                                            valueFormat: 'currency',
                                                            enableLabels: true,
                                                            arcLabel: (d: { value: number }) => {
                                                                const total = hubData.costBreakdownDonut.reduce((s, item) => s + item.value, 0)
                                                                return total > 0 ? `${Math.round((d.value / total) * 100)}%` : ''
                                                            },
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de compras</p>,
                                                },
                                            },
                                        ],
                                    },
                                    {
                                        id: 'col-top-purchases',
                                        weight: 1,
                                        sections: [
                                            {
                                                id: 'top-purchases-bar',
                                                content: hubData.purchaseGroupData.length > 0 ? {
                                                    type: 'stat-card',
                                                    config: {
                                                        label: 'Top Compras por Monto',
                                                        variant: 'chart',
                                                        chart: {
                                                            type: 'bar-chart',
                                                            preset: 'card',
                                                            data: [...hubData.purchaseGroupData]
                                                                .sort((a, b) => parseFloat(b.total_amount) - parseFloat(a.total_amount))
                                                                .slice(0, 8)
                                                                .map(g => ({ compra: g.display_id, total: parseFloat(g.total_amount) })),
                                                            keys: ['total'],
                                                            indexBy: 'compra',
                                                            valueFormat: '$,.0f',
                                                        },
                                                    },
                                                } : {
                                                    type: 'custom',
                                                    render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de compras</p>,
                                                },
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                value: 'cupo',
                                label: 'Cupo',
                                icon: Gauge,
                                columns: [
                                    {
                                        id: 'col-utilization',
                                        weight: 2,
                                        sections: [
                                            {
                                                id: 'utilization-kpis',
                                                content: hubData.creditUtilization.length > 0 ? {
                                                    type: 'custom',
                                                    render: (
                                                        <div className="space-y-4">
                                                            {hubData.creditUtilization.map(cu => (
                                                                <div key={cu.card_account_id} className="space-y-3">
                                                                    <h4 className="text-xs text-muted-foreground font-semibold">{cu.card_name}</h4>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <StatCard label="Límite" value={<MoneyDisplay amount={parseFloat(cu.credit_limit ?? '0')} inline />} variant="fill" accent="primary" />
                                                                        <StatCard label="Deuda Actual" value={<MoneyDisplay amount={parseFloat(cu.current_debt)} inline />} variant="fill" accent="warning" />
                                                                        <StatCard label="No Facturado" value={<MoneyDisplay amount={parseFloat(cu.total_unbilled)} inline />} variant="fill" accent="info" />
                                                                        <StatCard label="Disponible" value={<MoneyDisplay amount={parseFloat(cu.available_credit ?? '0')} inline />} variant="fill" accent="success" />
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                                            <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${Math.min(cu.utilization_pct, 100)}%` }} />
                                                                        </div>
                                                                        <span className="text-xs font-bold text-muted-foreground">{cu.utilization_pct.toFixed(1)}% usado</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ),
                                                } : {
                                                    type: 'custom',
                                                    render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de cupo</p>,
                                                },
                                            },
                                        ],
                                    },
                                    {
                                        id: 'col-debt-summary',
                                        weight: 1,
                                        sections: [
                                            {
                                                id: 'debt-kpis',
                                                content: hubData.summary ? {
                                                    type: 'custom',
                                                    render: (
                                                        <div className="space-y-3">
                                                            <h4 className="text-xs text-muted-foreground mb-2 font-semibold">Deuda Consolidada</h4>
                                                            <StatCard label="Deuda Total" value={<MoneyDisplay amount={parseFloat(hubData.summary.total_debt)} inline />} variant="fill" accent="primary" />
                                                            <StatCard label="Total Facturado" value={<MoneyDisplay amount={parseFloat(hubData.summary.total_billed ?? '0')} inline />} variant="fill" accent="info" />
                                                            <StatCard label="Total Vencido" value={<MoneyDisplay amount={parseFloat(hubData.summary.total_past_due)} inline />} variant="fill" accent="destructive" />
                                                        </div>
                                                    ),
                                                } : {
                                                    type: 'custom',
                                                    render: <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de deuda</p>,
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

            <StatementDetailModal
                statementId={selectedId}
                open={isDetailOpen}
                onOpenChange={(open) => { if (!open) clearActions() }}
            />
            <PayStatementModal
                statement={selectedStatement}
                open={isPayOpen}
                onOpenChange={(open) => { if (!open) clearActions() }}
            />
        </div>
    )
}
