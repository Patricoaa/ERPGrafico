"use client"

import { useState, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CreditCard, AlertTriangle, Eye, Receipt, Wallet } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    createActionsColumn, StatusBadge, MoneyDisplay, Skeleton, EmptyState, EntityCard,
    SmartSearchBar,
    useSmartSearch,
    UnderlineTabs,
} from '@/components/shared'
import type { SearchDefinition } from '@/types/search'
import { useCardStatements } from './hooks'
import { useBankOverview } from '../hooks/useBankOverview'
import type { BankOverviewData } from '../hooks/useBankOverview'
import { StatementDetailModal } from './StatementDetailModal'
import { PayStatementModal } from './PayStatementModal'
import type { CreditCardStatement } from './types'
import { useStatementsAnalyticsData } from './useStatementsAnalyticsData'

interface StatementsViewProps {
    bankId: number
}

export function StatementsView({ bankId }: StatementsViewProps) {
    const { data: overview, isLoading: overviewLoading } = useBankOverview(bankId)
    const overviewData = (overview && !overviewLoading ? overview : null) as BankOverviewData | null
    const creditCardAccounts = useMemo(
        () => (overviewData?.accounts?.filter(
            (acc) => acc.account_type === 'CREDIT_CARD'
        ).map(a => ({ id: a.id, name: a.name, currency: a.currency })) ?? []),
        [overviewData],
    )
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [payingStatement, setPayingStatement] = useState<CreditCardStatement | null>(null)

    const searchDef: SearchDefinition = useMemo(() => ({
        fields: [
            {
                key: 'card',
                label: 'Tarjeta',
                type: 'identity-enum',
                serverParam: 'card',
                defaultValue: String(creditCardAccounts[0]?.id ?? ''),
                options: creditCardAccounts.map(a => ({ label: a.name, value: String(a.id) })),
            },
        ],
    }), [creditCardAccounts])

    const { filters, applyFilter } = useSmartSearch(searchDef)

    const cardAccountId = filters.card ? Number(filters.card) : (creditCardAccounts[0]?.id ?? null)

    const params: Record<string, string> = {}
    if (bankId) params.bank = String(bankId)
    if (cardAccountId) params.card_account = String(cardAccountId)
    const [granularity, setGranularity] = useState<'day' | 'month' | 'year'>('month')
    const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)

    const months = useMemo(() => dateRange === null
        ? 24
        : Math.max(1, Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (30 * 24 * 60 * 60 * 1000))),
    [dateRange])

    const hubData = useStatementsAnalyticsData(cardAccountId, months, granularity)

    const { data: statements = [], isLoading, isError } = useCardStatements(
        Object.keys(params).length > 0 ? params : undefined,
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
                    {new Date(row.original.due_date).toLocaleDateString('es-CL')}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => <StatusBadge status={row.original.status} />,
        },
        createActionsColumn<CreditCardStatement>({
            renderActions: (stmt) => renderStatementActions(stmt),
        }),
    ]

    function renderStatementActions(stmt: CreditCardStatement) {
        const canPay = stmt.status !== 'PAID' && stmt.status !== 'CANCELED'
        return (
            <>
                {canPay && (
                    <DataCell.Action
                        icon={Wallet}
                        title="Pagar"
                        onClick={() => setPayingStatement(stmt)}
                    />
                )}
                <DataCell.Action
                    icon={Eye}
                    title="Ver detalle"
                    onClick={() => setSelectedId(stmt.id)}
                />
            </>
        )
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.creditcardstatement"
                    columns={columns}
                    data={statements}
                    variant="embedded"
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
                            onCardAccountChange: (id) => applyFilter('card', String(id)),
                            granularity,
                            onGranularityChange: setGranularity,
                            dateRange,
                            onDateRangeChange: setDateRange,
                        },
                    }}
                    customFilters={
                        creditCardAccounts.length > 1 ? (
                            <UnderlineTabs
                                items={creditCardAccounts.map(a => ({ value: String(a.id), label: a.name }))}
                                value={String(filters.card ?? creditCardAccounts[0]?.id ?? '')}
                                onValueChange={(v) => applyFilter('card', v)}
                                orientation="horizontal"
                                variant="underline"
                                className="w-auto"
                                headerClassName="h-7 px-0 bg-transparent"
                                contentClassName="hidden"
                            >
                                <div />
                            </UnderlineTabs>
                        ) : null
                    }
                    smartSearch={<SmartSearchBar searchDef={searchDef} placeholder="Buscar estados de cuenta..." className="flex-1" />}
                    emptyState={{
                        context: 'treasury',
                        icon: CreditCard,
                        title: 'No hay estados de cuenta',
                        description: 'Los estados de cuenta de la tarjeta de crédito aparecerán aquí.',
                    }}
                    renderCard={(stmt: CreditCardStatement) => (
                        <EntityCard>
                            <EntityCard.Header
                                title={stmt.display_id}
                                subtitle={stmt.card_account_name}
                                trailing={<StatusBadge status={stmt.status} />}
                            />
                            <EntityCard.Body>
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
                                    value={new Date(stmt.due_date).toLocaleDateString('es-CL')}
                                />
                            </EntityCard.Body>
                            <EntityCard.Footer>
                                {renderStatementActions(stmt)}
                            </EntityCard.Footer>
                        </EntityCard>
                    )}
                />
            </div>

            <StatementDetailModal
                statementId={selectedId}
                open={selectedId != null}
                onOpenChange={(open) => { if (!open) setSelectedId(null) }}
            />
            <PayStatementModal
                statement={payingStatement}
                open={payingStatement != null}
                onOpenChange={(open) => { if (!open) setPayingStatement(null) }}
            />
        </div>
    )
}
