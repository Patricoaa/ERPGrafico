"use client"

import React, { useState, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, BarChart3, CreditCard, AlertTriangle, FileText, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    createActionsColumn, StatusBadge, MoneyDisplay, SmartSearchBar,
    EntityStatsBottomSheet,
} from '@/components/shared'
import type { Section, StatCardConfig } from '@/components/shared'
import { useCardStatements } from './hooks'
import { StatementDetailModal } from './StatementDetailModal'
import type { CreditCardStatement } from './types'

interface StatementsClientViewProps {
    bankId?: number
    createAction?: React.ReactNode
}

export function StatementsClientView({ bankId, createAction }: StatementsClientViewProps) {
    const { data: statements = [], isLoading } = useCardStatements(
        bankId ? { bank: String(bankId) } : undefined,
    )
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [statsOpen, setStatsOpen] = useState(false)

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

    const debtByBank = useMemo(() => {
        const map = new Map<string, number>()
        statements.forEach((s) => {
            if (s.status === 'OPEN' || s.status === 'OVERDUE') {
                const name = s.card_account_name || 'Sin cuenta'
                map.set(name, (map.get(name) || 0) + parseFloat(s.total_to_pay))
            }
        })
        return Array.from(map.entries()).map(([name, amount]) => ({ name, amount }))
    }, [statements])

    const upcomingEvents = useMemo(() => {
        const active = statements.filter((s) => s.status === 'OPEN' || s.status === 'OVERDUE')
        active.sort((a, b) => a.due_date.localeCompare(b.due_date))
        return active.map((s) => ({
            date: new Date(s.due_date).toLocaleDateString('es-CL'),
            label: `${s.display_id} — ${s.card_account_name}`,
            description: `Total a pagar: $${parseFloat(s.total_to_pay).toLocaleString('es-CL')}`,
            status: (s.status === 'OVERDUE' ? 'destructive' : 'warning') as 'destructive' | 'warning',
        }))
    }, [statements])

    const columns: ColumnDef<CreditCardStatement, unknown>[] = [
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
            renderActions: (stmt) => (
                <DataCell.Action
                    icon={Eye}
                    title="Ver detalle"
                    onClick={() => setSelectedId(stmt.id)}
                />
            ),
        }),
    ]

    const summaryCards: StatCardConfig[] = [
        { label: 'Deuda Total', value: <MoneyDisplay amount={totalDebt} inline />, icon: CreditCard, accent: 'warning' },
        { label: 'Abiertos', value: openCount.toString(), icon: FileText, accent: 'primary' },
        { label: 'Vencidos', value: overdueCount.toString(), icon: AlertTriangle, accent: overdueCount > 0 ? 'destructive' : 'success' },
        { label: 'Próx. Vencimiento', value: nextDue ? new Date(nextDue.due_date).toLocaleDateString('es-CL') : '—', icon: Calendar, accent: 'info' },
    ]

    const statsSections: Section[] = [
        {
            type: 'cards',
            title: 'Resumen',
            props: { cards: summaryCards },
        },
        {
            type: 'chart',
            title: 'Deuda por Banco',
            props: {
                children: debtByBank.length > 0 ? (
                    <div className="space-y-2">
                        {debtByBank.map((b, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground truncate mr-2">
                                    {b.name}
                                </span>
                                <span className="text-xs font-bold text-foreground shrink-0">
                                    <MoneyDisplay amount={b.amount} inline />
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground text-center py-2 italic">
                        Sin deuda activa
                    </p>
                ),
            },
        },
        {
            type: 'timeline',
            title: 'Próximos Vencimientos',
            props: { events: upcomingEvents },
        },
    ]

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.creditcardstatement"
                    columns={columns as ColumnDef<unknown, unknown>[]}
                    data={statements as unknown[]}
                    isLoading={isLoading}
                    variant="embedded"
                    leftAction={
                        <div className="flex items-center gap-1 w-full">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setStatsOpen(true)}
                                className="shrink-0"
                                title="Estadísticas"
                            >
                                <BarChart3 className="h-4 w-4" />
                            </Button>
                            <SmartSearchBar
                                searchDef={{ fields: [] }}
                                placeholder="Buscar estados de cuenta..."
                                className="w-full"
                            />
                        </div>
                    }
                    createAction={createAction}
                    emptyState={{
                        context: 'treasury',
                        title: 'No hay estados de cuenta',
                        description: 'Los estados de cuenta de la tarjeta de crédito aparecerán aquí.',
                    }}
                />
            </div>

            <StatementDetailModal
                statementId={selectedId}
                open={selectedId != null}
                onOpenChange={(open) => { if (!open) setSelectedId(null) }}
            />

            <EntityStatsBottomSheet
                open={statsOpen}
                onOpenChange={setStatsOpen}
                title="Estadísticas de Estados de Cuenta"
                description="Resumen de deuda, distribución y próximos vencimientos"
                sections={statsSections}
            />
        </div>
    )
}
