"use client"

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Receipt, CreditCard, BarChart3, Wallet, ReceiptText, DollarSign } from 'lucide-react'
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
} from '@/components/shared'
import type { SearchDefinition } from '@/types/search'
import { treasuryApi } from '../api/treasuryApi'
import type { PendingChargeRow, UpcomingInstallment, UnbilledItemRow } from '../types'
import { mapToUnbilledItemRows } from './utils'
import { AddChargeModal } from './AddChargeModal'
import { BillChargesModal } from './BillChargesModal'
import { useHubPanel } from '@/components/providers'

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

    const mergedRows = useMemo(
        () => mapToUnbilledItemRows(charges, upcomingInstallments),
        [charges, upcomingInstallments],
    )

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

    return (
        <div className="flex flex-col flex-1 min-h-0 space-y-4">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.unbilled-charge"
                    columns={columns}
                    data={mergedRows}
                    isLoading={isLoading}
                    variant="embedded"
                    statsAction={{
                        icon: BarChart3,
                        sheet: {
                            title: "Estadísticas de Cargos",
                            description: "Resumen de cargos no facturados y cuotas próximas",
                            panels: [
                                {
                                    id: 'resumen',
                                    title: 'Resumen',
                                    colSpan: 3 as const,
                                    content: {
                                        type: 'custom',
                                        render: (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <StatCard label="Total" value={<MoneyDisplay amount={summary?.total ?? 0} inline />} icon={DollarSign} accent="warning" />
                                                <StatCard label="Cargos" value={String(summary?.charges ?? 0)} icon={ReceiptText} accent="primary" />
                                                <StatCard label="Cuotas" value={String(summary?.installments ?? 0)} icon={Wallet} accent="info" />
                                                <StatCard label="Total Items" value={String(summary?.count ?? 0)} icon={CreditCard} accent="success" />
                                            </div>
                                        ),
                                    },
                                },
                                ...(upcomingInstallments.length > 0 ? [
                                    {
                                        id: 'proximas-cuotas',
                                        title: 'Próximas Cuotas',
                                        colSpan: 3 as const,
                                        content: {
                                            type: 'custom' as const,
                                            render: (
                                                <div className="space-y-2">
                                                    {upcomingInstallments.slice(0, 10).map((inst, i) => (
                                                        <div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-xs font-medium truncate">{inst.group_display_id || `Cuota ${inst.number}/${inst.total_installments}`}</span>
                                                                <span className="text-[10px] text-muted-foreground">{new Date(inst.due_date).toLocaleDateString('es-CL')}</span>
                                                            </div>
                                                            <MoneyDisplay amount={parseFloat(inst.principal_amount)} inline className="text-xs font-bold shrink-0 ml-2" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ),
                                        },
                                    },
                                ] : []),
                            ],
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
