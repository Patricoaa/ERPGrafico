"use client"

import { useState, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CreditCard, AlertTriangle, Eye, BarChart3, DollarSign, Calendar, TrendingUp, Receipt, Activity } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    createActionsColumn, StatusBadge, MoneyDisplay, Skeleton, EmptyState, EntityCard,
    SmartSearchBar, StatCard, SummaryTable,
    useSmartSearch,
    UnderlineTabs,
} from '@/components/shared'
import type { SearchDefinition } from '@/types/search'
import { useCardStatements } from './hooks'
import { StatementDetailModal } from './StatementDetailModal'
import type { CreditCardStatement } from './types'
import { useStatementsAnalyticsData } from './useStatementsAnalyticsData'

interface StatementsViewProps {
    bankId?: number
    creditCardAccounts: Array<{ id: number; name: string; currency: string }>
}

export function StatementsView({ bankId, creditCardAccounts }: StatementsViewProps = { creditCardAccounts: [] }) {
    const [selectedId, setSelectedId] = useState<number | null>(null)

    const searchDef: SearchDefinition = useMemo(() => ({
        fields: [
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

    const hubData = useStatementsAnalyticsData(cardAccountId, months)

    const { data: statements = [], isLoading, isError } = useCardStatements(
        Object.keys(params).length > 0 ? params : undefined,
    )

    const totalDebt = useMemo(() => statements
        .filter((s) => s.status === 'OPEN' || s.status === 'OVERDUE')
        .reduce((sum, s) => sum + parseFloat(s.total_to_pay), 0),
    [statements])

    const openCount = useMemo(() => statements.filter((s) => s.status === 'OPEN').length, [statements])
    const overdueCount = useMemo(() => statements.filter((s) => s.status === 'OVERDUE').length, [statements])
    const nextDue = useMemo(() => statements
        .filter((s) => s.status === 'OPEN' || s.status === 'OVERDUE')
        .sort((a, b) => a.due_date.localeCompare(b.due_date))[0],
    [statements])

    const debtTrend = useMemo(() => {
        const sorted = [...statements]
            .sort((a, b) => a.period_year !== b.period_year
                ? a.period_year - b.period_year
                : a.period_month - b.period_month)
        return [{
            id: 'Deuda',
            data: sorted.map(s => ({
                x: `${String(s.period_month).padStart(2, '0')}/${String(s.period_year).slice(-2)}`,
                y: parseFloat(s.total_to_pay),
            })),
        }]
    }, [statements])

    const averageDaysLate = useMemo(() => {
        if (!hubData.analytics?.payment_performance?.length) return null
        const lateDays = hubData.analytics.payment_performance
            .map(p => p.days_late)
            .filter((d): d is number => d != null && d > 0)
        return lateDays.length > 0
            ? Math.round(lateDays.reduce((s, d) => s + d, 0) / lateDays.length)
            : null
    }, [hubData.analytics?.payment_performance])

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
            accessorKey: 'total_to_pay',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total a Pagar" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay
                        amount={parseFloat(row.original.total_to_pay)}
                        className="font-bold"
                    />
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
        return (
            <DataCell.Action
                icon={Eye}
                title="Ver detalle"
                onClick={() => setSelectedId(stmt.id)}
            />
        )
    }

    const fmt = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n)

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
                                // ── Tab 1: Resumen Ejecutivo ──
                                {
                                    value: 'resumen',
                                    label: 'Resumen',
                                    icon: BarChart3,
                                    columns: [
                                        {
                                            id: 'col-main',
                                            weight: 2,
                                            sections: [
                                                {
                                                    id: 'kpi-row',
                                                    colSpan: 3,
                                                    content: {
                                                        type: 'custom',
                                                        render: (
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                <StatCard
                                                                    label="Deuda Total (Facturada)"
                                                                    value={<MoneyDisplay amount={totalDebt} inline />}
                                                                    icon={DollarSign}
                                                                    accent="warning"
                                                                    variant="fill"
                                                                    valueSize="lg"
                                                                />
                                                                <StatCard
                                                                    label="Abiertos"
                                                                    value={String(openCount)}
                                                                    icon={BarChart3}
                                                                    accent="primary"
                                                                    variant="fill"
                                                                />
                                                                <StatCard
                                                                    label="Vencidos"
                                                                    value={String(overdueCount)}
                                                                    icon={AlertTriangle}
                                                                    accent={overdueCount > 0 ? 'destructive' : 'success'}
                                                                    variant="fill"
                                                                />
                                                            </div>
                                                        ),
                                                    },
                                                },
                                                {
                                                    id: 'deuda-trend',
                                                    colSpan: 3,
                                                    content: {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Evolución de Deuda Facturada',
                                                            variant: 'chart',
                                        chart: {
                                                                        type: 'line-chart',
                                                                        data: debtTrend,
                                                                        enableArea: true,
                                                                        showLegend: false,
                                                                        valueFormat: ' >-$s',
                                                                    },
                                                        },
                                                    },
                                                },
                                            ],
                                        },
                                        {
                                            id: 'col-side',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'prox-vencimiento',
                                                    content: {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Próx. Vencimiento',
                                                            value: nextDue ? new Date(nextDue.due_date).toLocaleDateString('es-CL') : '—',
                                                            icon: Calendar,
                                                            accent: 'info',
                                                            variant: 'compact',
                                                            subtext: nextDue
                                                                ? `$${fmt(parseFloat(nextDue.total_to_pay))}`
                                                                : undefined,
                                                        },
                                                    },
                                                },
                                                {
                                                    id: 'resumen-financiero',
                                                    content: {
                                                        type: 'custom',
                                                        render: (
                                                            <SummaryTable
                                                                rows={[
                                                                    { label: 'Deuda Total', value: <span className="font-bold">${fmt(totalDebt)}</span> },
                                                                    { label: 'Abiertos', value: <span className="font-bold">{openCount}</span> },
                                                                    { label: 'Vencidos', value: <span className="font-bold">{overdueCount}</span> },
                                                                    { label: 'Deuda Vencida', value: <span className="font-bold">${fmt(statements.filter(s => s.status === 'OVERDUE').reduce((s, st) => s + parseFloat(st.total_to_pay), 0))}</span> },
                                                                    { label: 'Último Período', value: <span className="font-bold">{statements.length > 0 ? `${String(statements[0].period_month).padStart(2, '0')}/${statements[0].period_year}` : '—'}</span> },
                                                                ]}
                                                            />
                                                        ),
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                                // ── Tab 2: Pagos ──
                                {
                                    value: 'pagos',
                                    label: 'Pagos',
                                    icon: TrendingUp,
                                    columns: [
                                        {
                                            id: 'pagos-col-main',
                                            weight: 2,
                                            sections: [
                                                {
                                                    id: 'payment-trend',
                                                    colSpan: 3,
                                                    content: hubData.paymentPerformanceChart[0]?.data.length ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Saldo Pendiente por Estado de Cuenta',
                                                            variant: 'chart',
                                            chart: {
                                                                        type: 'line-chart',
                                                                        data: hubData.paymentPerformanceChart,
                                                                        enableArea: true,
                                                                        showLegend: false,
                                                                        valueFormat: ' >-$s',
                                                                    },
                                                        },
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de pagos</p>
                                                        ),
                                                    },
                                                },
                                                {
                                                    id: 'payment-summary',
                                                    colSpan: 3,
                                                    content: hubData.analytics?.payment_performance?.length ? {
                                                        type: 'custom',
                                                        render: (
                                                            <SummaryTable
                                                                rows={hubData.analytics.payment_performance.slice(0, 8).map(p => ({
                                                                    label: `${p.display_id} · ${new Date(p.due_date).toLocaleDateString('es-CL')}`,
                                                                    value: (
                                                                        <div className="flex items-center gap-2">
                                                                            <StatusBadge
                                                                                status={p.status === 'PAID' ? 'success' : p.status === 'OVERDUE' ? 'destructive' : 'warning'}
                                                                                label={p.status === 'PAID' ? `Pagado $${fmt(parseFloat(p.amount_paid))}` : p.status === 'OVERDUE' ? `Vencido $${fmt(parseFloat(p.outstanding))}` : `Pendiente $${fmt(parseFloat(p.outstanding))}`}
                                                                            />
                                                                        </div>
                                                                    ),
                                                                }))}
                                                            />
                                                        ),
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin historial de pagos</p>
                                                        ),
                                                    },
                                                },
                                            ],
                                        },
                                        {
                                            id: 'pagos-col-side',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'pago-stats',
                                                    content: hubData.analytics ? {
                                                        type: 'custom',
                                                        render: (
                                                            <SummaryTable
                                                                rows={[
                                                                    { label: 'Statements Vencidos', value: <span className="font-bold">{overdueCount}</span> },
                                                                    { label: 'Morosos con Interés', value: <span className="font-bold">
                                                                        {hubData.analytics.payment_performance.filter(p => parseFloat(p.punitory_interest) > 0).length}
                                                                    </span> },
                                                                    { label: 'Total Interés Punitorio', value: <span className="font-bold">${fmt(
                                                                        hubData.analytics.payment_performance.reduce((s, p) => s + parseFloat(p.punitory_interest), 0)
                                                                    )}</span> },
                                                                    { label: 'Atraso Promedio', value: <span className="font-bold">{averageDaysLate != null ? `${averageDaysLate} días` : '—'}</span> },
                                                                ]}
                                                            />
                                                        ),
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Cargando...</p>
                                                        ),
                                                    },
                                                },
                                            ],
                                        },
                                    ],
                                },
                                // ── Tab 3: Costos Financieros ──
                                {
                                    value: 'costos',
                                    label: 'Costos',
                                    icon: Receipt,
                                    columns: [
                                        {
                                            id: 'costos-col-main',
                                            weight: 2,
                                            sections: [
                                                {
                                                    id: 'financial-costs-bar',
                                                    colSpan: 3,
                                                    content: hubData.financialCostsChart.length > 0 ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Intereses y Comisiones por Período',
                                                            variant: 'chart',
                                            chart: {
                                                                        type: 'bar-chart',
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
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de costos financieros</p>
                                                        ),
                                                    },
                                                },
                                                {
                                                    id: 'costs-trend-line',
                                                    colSpan: 3,
                                                    content: hubData.financialCostsChart.length >= 2 ? {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Evolución de Costos',
                                                            variant: 'chart',
                                            chart: {
                                                                        type: 'line-chart',
                                                                        data: [{
                                                                            id: 'Costo Total',
                                                                            data: hubData.financialCostsChart.map(c => ({ x: c.period, y: c.total })),
                                                                        }],
                                                                        enableArea: true,
                                                                        showLegend: false,
                                                                        valueFormat: ' >-$s',
                                                                    },
                                                        },
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Datos insuficientes para tendencia</p>
                                                        ),
                                                    },
                                                },
                                            ],
                                        },
                                        {
                                            id: 'costos-col-side',
                                            weight: 1,
                                            sections: [
                                                {
                                                    id: 'cost-summary',
                                                    content: hubData.analytics ? {
                                                        type: 'custom',
                                                        render: (
                                                            <SummaryTable
                                                                rows={hubData.financialCostsChart.slice(-6).reverse().map(c => ({
                                                                    label: c.period,
                                                                    value: (
                                                                        <div className="flex flex-col items-end gap-0.5">
                                                                            <span className="text-xs font-bold">${fmt(c.total)}</span>
                                                                            <span className="text-[10px] text-muted-foreground">
                                                                                I: ${fmt(c.interest)} · C: ${fmt(c.fees)}
                                                                            </span>
                                                                        </div>
                                                                    ),
                                                                }))}
                                                            />
                                                        ),
                                                    } : {
                                                        type: 'custom',
                                                        render: (
                                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Cargando...</p>
                                                        ),
                                                    },
                                                },
                                                {
                                                    id: 'cost-trend-badge',
                                                    content: {
                                                        type: 'stat-card',
                                                        config: {
                                                            label: 'Tendencia de Costos',
                                                            value: hubData.financialCostsTrend.value,
                                                            icon: Activity,
                                                            accent: hubData.financialCostsTrend.direction === 'up' ? 'destructive' : 'success',
                                                            variant: 'compact',
                                                            trend: hubData.financialCostsTrend,
                                                        },
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
                            <SmartSearchBar searchDef={searchDef} placeholder="Buscar estados de cuenta..." className="flex-1" />
                        </div>
                    }
                    filterColumn="display_id"
                    searchPlaceholder="Buscar por estado de cuenta..."
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
                                    label="Total a Pagar"
                                    value={<MoneyDisplay amount={parseFloat(stmt.total_to_pay)} className="font-bold" />}
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
        </div>
    )
}
