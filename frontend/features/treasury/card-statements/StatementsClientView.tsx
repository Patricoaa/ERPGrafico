"use client"

import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { CreditCard, Receipt, BarChart3 } from 'lucide-react'
import type { Granularity } from '@/components/shared'
import {
    DataTableView,
    SkeletonShell, AutoEntityCard,
    UnifiedSearchBar, useUnifiedSearch, StaleDataBanner,
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

    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("costos")
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
                                    value: 'costos',
                                    label: 'Cargos y Cuotas',
                                    icon: Receipt,
                                    columns: [
                                        {
                                            id: 'col-evolution',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'payment-evolution',
                                                    content: hubData.paymentEvolutionChart[0]?.data.some(d => d.y > 0) ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Evolución de Pagos por Estado de Cuenta',
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
                                            id: 'col-cost',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'cost-breakdown-donut',
                                                    content: hubData.costBreakdownDonut.length > 0 ? {
                                                        type: 'stat-card',
                                                        config: {
                                                             label: 'Composición del Estado de Cuenta',
                                                            variant: 'chart',
                                                             chart: {
                                                                 type: 'pie-chart',
                                                                 preset: 'card',
                                                                 data: hubData.costBreakdownDonut,
                                                                 valueFormat: "currency",
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
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de costos</p>
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
                                    icon: BarChart3,
                                    columns: [
                                        {
                                            id: 'col-purchase-main',
                                            weight: 2,
                                            sections: [
                                                {
                                                    id: 'purchase-bar',
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
                                        {
                                            id: 'col-purchase-side',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'purchase-summary',
                                                    content: hubData.purchaseGroupData.length > 0 ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Resumen de Compras',
                                                            variant: 'chart',
                                                            chart: {
                                                                type: 'pie-chart',
                                                                preset: 'card',
                                                                data: [
                                                                    { id: 'Capital', value: hubData.purchaseGroupData.reduce((s, g) => s + parseFloat(g.total_amount), 0) },
                                                                    { id: 'Intereses', value: hubData.purchaseGroupData.reduce((s, g) => s + parseFloat(g.total_interest), 0) },
                                                                ],
                                                                valueFormat: 'currency',
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
