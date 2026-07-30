"use client"

import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { CreditCard, Receipt, Gauge, TrendingUp, ShoppingCart } from 'lucide-react'
import type { Granularity } from '@/components/shared'
import {
    DataTableView,
    SkeletonShell, AutoEntityCard,
    UnifiedSearchBar, useUnifiedSearch, StaleDataBanner,
    SummaryTable, MoneyDisplay,
} from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useCardStatements } from '../hooks/useCardStatements'
import { useBankOverview } from '../hooks/useBankOverview'
import type { BankOverviewData } from '../hooks/useBankOverview'
import { StatementDetailModal } from './StatementDetailModal'
import { PayStatementModal } from './PayStatementModal'
import { statementActions, type StatementActionsCtx } from './statementActions'
import type { CreditCardStatement } from './types'
import { useStatementsAnalyticsData } from '../hooks/useStatementsAnalyticsData'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'
import { cardStatementFields } from './cardStatementFields'
import { useEntityRouteActions } from '@/hooks/useEntityRouteActions'

interface StatementsClientViewProps {
    bankId: number
}

export function StatementsClientView({ bankId }: StatementsClientViewProps) {
    const searchParams = useSearchParams()
    const { data: overview, isLoading: overviewLoading } = useBankOverview(bankId)
    const overviewData = (overview && !overviewLoading ? overview : null) as BankOverviewData | null
    const creditCardAccounts = useMemo(
        () => (overviewData?.accounts?.filter(
            (acc) => acc.account_type === 'CREDIT_CARD'
        ).map(a => ({ id: a.id, name: a.name, currency: a.currency })) ?? []),
        [overviewData],
    )

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
                defaultValue: String(creditCardAccounts[0]?.id ?? ''),
                options: creditCardAccounts.map(a => ({ label: a.name, value: String(a.id) })),
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
    }), [creditCardAccounts])

    const search = useUnifiedSearch(unifiedConfig)

    const cardAccountId = search.filters.card ? Number(search.filters.card) : (creditCardAccounts[0]?.id ?? null)

    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("rendimiento")
    const [granularity, setGranularity] = useState<Granularity>("month")

    const params: Record<string, string> = {}
    if (bankId) params.bank = String(bankId)
    if (cardAccountId) params.card_account = String(cardAccountId)

    const hubData = useStatementsAnalyticsData(cardAccountId, 24, granularity)

    const { data: statements = [], isLoading, isError } = useCardStatements(
        Object.keys(params).length > 0 ? params : undefined,
    )

    const filteredStatements = useMemo(() => {
        let result = search.filterFn(statements)
        const { cutoff_from, cutoff_to } = search.filters
        if (cutoff_from) {
            result = result.filter(s => s.cut_off_date >= cutoff_from)
        }
        if (cutoff_to) {
            result = result.filter(s => s.cut_off_date <= cutoff_to)
        }
        return result
    }, [statements, search.filterFn, search.filters])

    const { openAction, clearActions } = useEntityRouteActions()

    const clearAll = useCallback(() => {
        clearActions()
    }, [clearActions])

    const openStatement = useCallback((id: number, actionType: string) => {
        openAction(id, actionType)
    }, [openAction])

    const selectedStatement = useMemo(
        () => selectedId ? statements.find(s => s.id === selectedId) ?? null : null,
        [selectedId, statements],
    )

    const actionsCtx: StatementActionsCtx = {
        onPay: (stmt) => openStatement(stmt.id, "pay"),
        onViewDetail: (id) => openStatement(id, "detail"),
    }

    const columns: ColumnDef<CreditCardStatement>[] = [
        ...cardStatementFields.toColumns(),
        statementActions.auto(actionsCtx),
    ]

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando estados de cuenta">
        {isError && <StaleDataBanner className="mx-4 mt-2" />}
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.creditcardstatement"
                    columns={columns}
                    data={filteredStatements}
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
                        placeholder="Buscar por N° de estado o monto..."
                    />}
                    unifiedSearchConfig={unifiedConfig}
                    showReset={search.isFiltered}
                    isFiltered={search.isFiltered}
                    onReset={search.clearAll}
                    analyticsPanel={{
                        screen: {
                            entityName: "Gestión TC",
                            activeTab: analyticsActiveTab,
                            onTabChange: setAnalyticsActiveTab,
                            granularity,
                            onGranularityChange: setGranularity,
                            tabs: [
                                {
                                    value: 'rendimiento',
                                    label: 'Rendimiento',
                                    icon: TrendingUp,
                                    columns: [
                                        {
                                            id: 'col-evolution',
                                            weight: 2,
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
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos históricos de pagos</p>
                                                        ),
                                                    },
                                                },
                                            ],
                                        },
                                        {
                                            id: 'col-kpis',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'payment-kpis',
                                                    content: hubData.summary ? {
                                                        type: 'custom',
                                                        render: (
                                                            <div>
                                                                <h4 className="text-xs text-muted-foreground mb-2 font-semibold">Resumen</h4>
                                                                <SummaryTable
                                                                    rows={[
                                                                        { label: 'Deuda Total', value: <MoneyDisplay amount={parseFloat(hubData.summary.total_debt)} inline /> },
                                                                        { label: 'No Facturado', value: <MoneyDisplay amount={parseFloat(hubData.summary.total_unbilled)} inline /> },
                                                                        ...(hubData.summary.total_past_due ? [{ label: 'Vencido', value: <MoneyDisplay amount={parseFloat(hubData.summary.total_past_due)} inline /> }] : []),
                                                                        { label: 'Estados Abiertos', value: String(hubData.summary.open_statements) },
                                                                        { label: 'Estados Vencidos', value: String(hubData.summary.overdue_statements) },
                                                                    ]}
                                                                />
                                                            </div>
                                                        ),
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin KPIs disponibles</p>
                                                        ),
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
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin costos financieros</p>
                                                        ),
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
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de compras</p>
                                                        ),
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
                                                                    const total = hubData.costBreakdownDonut.reduce((s, item) => s + item.value, 0);
                                                                    return total > 0 ? `${Math.round((d.value / total) * 100)}%` : '';
                                                                },
                                                            },
                                                        },
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de compras</p>
                                                        ),
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
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de compras</p>
                                                        ),
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
                                                    id: 'utilization-gauge',
                                                    content: hubData.creditUtilization.length > 0 ? {
                                                        type: 'custom',
                                                        render: (
                                                            <div>
                                                                <h4 className="text-xs text-muted-foreground mb-2 font-semibold">Utilización del Cupo</h4>
                                                                {hubData.creditUtilization.map(cu => (
                                                                    <SummaryTable
                                                                        key={cu.card_account_id}
                                                                        rows={[
                                                                            { label: 'Tarjeta', value: cu.card_name },
                                                                            { label: 'Límite', value: <MoneyDisplay amount={parseFloat(cu.credit_limit ?? '0')} inline /> },
                                                                            { label: 'Deuda Actual', value: <MoneyDisplay amount={parseFloat(cu.current_debt)} inline /> },
                                                                            { label: 'No Facturado', value: <MoneyDisplay amount={parseFloat(cu.total_unbilled)} inline /> },
                                                                            { label: 'Disponible', value: <MoneyDisplay amount={parseFloat(cu.available_credit ?? '0')} inline /> },
                                                                            { label: '% Utilizado', value: `${cu.utilization_pct.toFixed(1)}%` },
                                                                        ]}
                                                                    />
                                                                ))}
                                                            </div>
                                                        ),
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de cupo</p>
                                                        ),
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
                                                            <div>
                                                                <h4 className="text-xs text-muted-foreground mb-2 font-semibold">Deuda Consolidada</h4>
                                                                <SummaryTable
                                                                    rows={[
                                                                        { label: 'Deuda Total', value: <MoneyDisplay amount={parseFloat(hubData.summary.total_debt)} inline /> },
                                                                        { label: 'Total Facturado', value: <MoneyDisplay amount={parseFloat(hubData.summary.total_billed ?? '0')} inline /> },
                                                                        { label: 'Total Vencido', value: <MoneyDisplay amount={parseFloat(hubData.summary.total_past_due)} inline /> },
                                                                    ]}
                                                                />
                                                            </div>
                                                        ),
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de deuda</p>
                                                        ),
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    }}
                    emptyState={{
                        context: 'treasury',
                        icon: CreditCard,
                        title: 'No hay estados de cuenta',
                        description: 'Los estados de cuenta de la tarjeta de crédito aparecerán aquí.',
                    }}
                    renderCard={(stmt: CreditCardStatement) => (
                        <AutoEntityCard 
                            key={stmt.id} 
                            data={stmt}
                            fields={cardStatementFields}

                            entityLabel="treasury.cardstatement"
                            onClick={() => openStatement(stmt.id, "detail")} 
                            defaultAction={statementActions.defaultAction(actionsCtx)?.(stmt) ?? null}

                            actions={statementActions.render(stmt, actionsCtx)}
                        />
                    )}
                />
            </div>

            <StatementDetailModal
                statementId={selectedId}
                open={isDetailOpen}
                onOpenChange={(open) => { if (!open) clearAll() }}
            />
            <PayStatementModal
                statement={selectedStatement}
                open={isPayOpen}
                onOpenChange={(open) => { if (!open) clearAll() }}
            />
        </div>
        </SkeletonShell>
    )
}
