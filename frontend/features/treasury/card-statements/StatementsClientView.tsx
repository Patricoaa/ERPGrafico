"use client"

import { useState, useMemo, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { CreditCard, AlertTriangle, Receipt } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    StatusBadge, MoneyDisplay, Skeleton, EmptyState, EntityCard,
    SegmentationBar, useSegmentation, SmartSearchBar, useClientSearch,
} from '@/components/shared'
import type { SegmentationDefinition } from '@/types/segmentation'
import type { SearchDefinition } from '@/types/search'
import { useCardStatements } from '../hooks/useCardStatements'
import { useBankOverview } from '../hooks/useBankOverview'
import type { BankOverviewData } from '../hooks/useBankOverview'
import { StatementDetailModal } from './StatementDetailModal'
import { PayStatementModal } from './PayStatementModal'
import { statementActions, type StatementActionsCtx } from './statementActions'
import type { CreditCardStatement } from './types'
import { useStatementsAnalyticsData } from '../hooks/useStatementsAnalyticsData'
import { parseDateOnly } from '@/lib/utils'

interface StatementsClientViewProps {
    bankId: number
}

const statementsSearchDef: SearchDefinition = {
    fields: [
        { key: 'display_id', label: 'N° Estado', type: 'text', serverParam: 'display_id' },
        { key: 'billed_amount', label: 'Monto facturado', type: 'text', serverParam: 'billed_amount' },
    ],
}

export function StatementsClientView({ bankId }: StatementsClientViewProps) {
    const router = useRouter()
    const pathname = usePathname()
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

    const segDef: SegmentationDefinition = useMemo(() => ({
        segments: [
            {
                key: 'card',
                label: 'Tarjeta',
                type: 'tabs',
                serverParam: 'card',
                variant: 'dropdown',
                defaultValue: String(creditCardAccounts[0]?.id ?? ''),
                options: creditCardAccounts.map(a => ({ label: a.name, value: String(a.id) })),
            },
            {
                key: 'cutoff_date',
                label: 'Fecha de corte',
                type: 'date',
                serverParamDate: 'cutoff_date',
                serverParamFrom: 'cutoff_from',
                serverParamTo: 'cutoff_to',
            },
        ],
    }), [creditCardAccounts])

    const basePeriod = { serverParamFrom: 'date_from', serverParamTo: 'date_to' }
    const { filters: segFilters, isFiltered: isSegFiltered, apply, clearAll: clearSeg } = useSegmentation(segDef, basePeriod)
    const { filterFn, isFiltered: isTextFiltered, clearAll: clearText } = useClientSearch<CreditCardStatement>(statementsSearchDef)

    const cardAccountId = segFilters.card ? Number(segFilters.card) : (creditCardAccounts[0]?.id ?? null)

    const params: Record<string, string> = {}
    if (bankId) params.bank = String(bankId)
    if (cardAccountId) params.card_account = String(cardAccountId)
    const [granularity, setGranularity] = useState<'day' | 'month' | 'year'>('month')
    const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)

    const months = useMemo(() => dateRange === null
        ? 24
        : Math.max(1, Math.ceil((parseDateOnly(dateRange.to).getTime() - parseDateOnly(dateRange.from).getTime()) / (30 * 24 * 60 * 60 * 1000))),
    [dateRange])

    const hubData = useStatementsAnalyticsData(cardAccountId, months, granularity)

    const { data: statements = [], isLoading, isError } = useCardStatements(
        Object.keys(params).length > 0 ? params : undefined,
    )

    const filteredStatements = useMemo(() => {
        let result = filterFn(statements)
        const { cutoff_date, cutoff_from, cutoff_to } = segFilters
        if (cutoff_date) {
            result = result.filter(s => s.cut_off_date === cutoff_date)
        }
        if (cutoff_from) {
            result = result.filter(s => s.cut_off_date >= cutoff_from)
        }
        if (cutoff_to) {
            result = result.filter(s => s.cut_off_date <= cutoff_to)
        }
        return result
    }, [statements, filterFn, segFilters])

    const clearAll = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        const changed = params.has("selected") || params.has("action")
        params.delete("selected")
        params.delete("action")
        if (changed) {
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [router, pathname, searchParams])

    const openStatement = useCallback((id: number, actionType: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        params.set("action", actionType)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const selectedStatement = useMemo(
        () => selectedId ? statements.find(s => s.id === selectedId) ?? null : null,
        [selectedId, statements],
    )

    if (isLoading) {
        return <Skeleton className="h-full" />
    }

    if (isError) {
        return (
            <EmptyState
                title="Error al cargar estados de cuenta"
                description="Intente nuevamente más tarde."
                icon={AlertTriangle}
            />
        )
    }

    const actionsCtx: StatementActionsCtx = {
        onPay: (stmt) => openStatement(stmt.id, "pay"),
        onViewDetail: (id) => openStatement(id, "detail"),
    }

    const columns: ColumnDef<CreditCardStatement>[] = [
        {
            accessorKey: 'display_id',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center">
                    <DataCell.Code>{row.original.display_id}</DataCell.Code>
                    <DataCell.Secondary>{row.original.card_account_name}</DataCell.Secondary>
                </div>
            ),
        },
        {
            accessorKey: 'period',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Período" />,
            cell: ({ row }) => (
                <DataCell.Text>
                    {String(row.original.period_month).padStart(2, '0')}/{row.original.period_year}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: 'billed_amount',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Facturado" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={parseFloat(row.original.billed_amount)} />
                </div>
            ),
        },
        {
            accessorKey: 'due_date',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Vencimiento" />,
            cell: ({ row }) => (
                <DataCell.Text>
                    {parseDateOnly(row.original.due_date).toLocaleDateString('es-CL')}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => <StatusBadge status={row.original.status} />,
        },
        statementActions.column(actionsCtx),
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.creditcardstatement"
                    columns={columns}
                    data={filteredStatements}
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={statementsSearchDef} placeholder="Buscar por N° de estado o monto..." className="w-full" />}
                    showReset={isTextFiltered || isSegFiltered}
                    isFiltered={isTextFiltered || isSegFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    analyticsPanel={{
                        screen: {
                            entityName: "Gestión TC",
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
                                                                data: hubData.paymentEvolutionChart,
                                                                enableArea: true,
                                                                showLegend: true,
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
                                                                data: hubData.costBreakdownDonut,
                                                                innerRadius: 0.6,
                                                                showLegend: true,
                                                                enableLabels: true,
                                                                enableArcLinkLabels: false,
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
                            ],
                            cardAccounts: creditCardAccounts,
                            cardAccountId: cardAccountId,
                            onCardAccountChange: (id) => apply('card', String(id)),
                            granularity,
                            onGranularityChange: setGranularity,
                            dateRange,
                            onDateRangeChange: setDateRange,
                        },
                    }}
                    segmentation={<SegmentationBar def={segDef} basePeriod={basePeriod} />}
                    emptyState={{
                        context: 'treasury',
                        icon: CreditCard,
                        title: 'No hay estados de cuenta',
                        description: 'Los estados de cuenta de la tarjeta de crédito aparecerán aquí.',
                    }}
                    renderCard={(stmt: CreditCardStatement) => (
                        <EntityCard onClick={() => openStatement(stmt.id, "detail")}>
                            <EntityCard.Header
                                title={stmt.display_id}
                                subtitle={stmt.card_account_name}
                                trailing={<StatusBadge status={stmt.status} />}
                            />
                            <EntityCard.Body actions={statementActions.render(stmt, actionsCtx)}>
                                <EntityCard.Field
                                    label="Período"
                                    value={`${String(stmt.period_month).padStart(2, '0')}/${stmt.period_year}`}
                                />
                                <EntityCard.Field
                                    label="Facturado"
                                    value={<MoneyDisplay amount={parseFloat(stmt.billed_amount)} />}
                                />
                                <EntityCard.Field
                                    label="Vencimiento"
                                    value={parseDateOnly(stmt.due_date).toLocaleDateString('es-CL')}
                                />
                            </EntityCard.Body>
                        </EntityCard>
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
    )
}
