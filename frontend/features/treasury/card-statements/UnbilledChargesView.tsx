"use client"

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Receipt, CreditCard, ChevronDown, Calendar, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { ColumnDef } from '@tanstack/react-table'
import {
    DataTableView,
    DataTableColumnHeader,
    DataCell,
    MoneyDisplay,
    EntityCard,
    StatusBadge,
    EntityStatsBottomSheet,
} from '@/components/shared'
import { treasuryApi } from '../api/treasuryApi'
import type { PendingChargeRow, UpcomingInstallment, UnbilledItemRow } from '../types'
import { mapToUnbilledItemRows } from './utils'
import { AddChargeModal } from './AddChargeModal'
import { BillChargesModal } from './BillChargesModal'
import { useHubPanel } from '@/components/providers'

interface UnbilledChargesViewProps {
    bankId: number
    cardAccountId: number
    cardAccountName: string
    currency?: string
}

interface UnbilledSummary {
    total: number
    count: number
    charges: number
    installments: number
}

const chargeTypeColorMap: Record<string, string> = {
    COMMISSION: 'bg-warning text-warning-foreground',
    TAX: 'bg-destructive text-destructive-foreground',
    FEE: 'bg-info text-info-foreground',
    INSURANCE: 'bg-accent text-accent-foreground',
    OTHER: 'bg-muted text-muted-foreground',
}

export function UnbilledChargesView({
    bankId,
    cardAccountId,
    cardAccountName,
    currency = 'CLP',
}: UnbilledChargesViewProps) {
    const [showAddCharge, setShowAddCharge] = useState(false)
    const [showBillCharges, setShowBillCharges] = useState(false)
    const [filterMode, setFilterMode] = useState<'month' | 'all'>('month')
    const [statsOpen, setStatsOpen] = useState(false)
    const queryClient = useQueryClient()
    const { openHub } = useHubPanel()

    const today = new Date().toISOString().split('T')[0]
    const cutOffDate = filterMode === 'month' ? today : undefined

    const { data: result, isLoading } = useQuery({
        queryKey: ['unbilled-charges', cardAccountId, cutOffDate ?? 'all'],
        queryFn: () => treasuryApi.getUnbilledCharges(cardAccountId, cutOffDate),
        enabled: !!cardAccountId,
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
        queryClient.invalidateQueries({ queryKey: ['unbilled-charges', cardAccountId] })
        toast.success('Cargo agregado exitosamente')
    }

    const handleBillChargesSuccess = () => {
        setShowBillCharges(false)
        queryClient.invalidateQueries({ queryKey: ['unbilled-charges', cardAccountId] })
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

    const filterDropdown = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-full px-3 rounded-none text-[10px] font-black uppercase tracking-widest hover:bg-muted/50 transition-all border-0 ring-0 focus-visible:ring-0">
                    <Calendar className="h-3.5 w-3.5 mr-2 opacity-50" />
                    {filterMode === 'month' ? 'Cargos del mes' : 'Todos los cargos'}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={filterMode} onValueChange={(v) => setFilterMode(v as 'month' | 'all')}>
                    <DropdownMenuRadioItem value="month">Cargos del mes</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="all">Todos los cargos</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )

    const actionButtons = (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                className="border-0 h-10 text-[10px] font-black uppercase tracking-widest"
                disabled={!summary || summary.count === 0}
                onClick={() => setShowBillCharges(true)}
            >
                <Receipt className="h-3.5 w-3.5 mr-2" />
                Facturar Cargos
            </Button>
            <Button className="h-10 text-[10px] font-black uppercase tracking-widest" onClick={() => setShowAddCharge(true)}>
                <Plus className="h-3.5 w-3.5 mr-2" />
                Agregar Cargo
            </Button>
        </div>
    )

    const distributionByType = useMemo(() => {
        const map = new Map<string, number>()
        charges.forEach((c) => {
            const key = c.charge_type_display || c.charge_type || 'Otros'
            map.set(key, (map.get(key) || 0) + parseFloat(String(c.amount)))
        })
        return Array.from(map.entries()).map(([label, amount]) => ({ label, amount }))
    }, [charges])

    const timelineEvents = useMemo(() => upcomingInstallments.map((inst) => ({
        date: new Date(inst.due_date).toLocaleDateString('es-CL'),
        label: `Cuota ${inst.number}/${inst.total_installments} — ${inst.purchase_order_display_id || inst.group_display_id || ''}`,
        description: <MoneyDisplay amount={inst.principal_amount} currency={currency} inline />,
    })), [upcomingInstallments, currency])

    const statsCards = useMemo(() => summary ? [
        { label: 'Total', value: <MoneyDisplay amount={summary.total} currency={currency} inline />, icon: CreditCard, accent: 'primary' as const },
        { label: 'Cuotas', value: <MoneyDisplay amount={summary.installments} currency={currency} inline />, icon: CreditCard, accent: 'info' as const },
        { label: 'Cargos Financieros', value: <MoneyDisplay amount={summary.charges} currency={currency} inline />, icon: CreditCard, accent: 'warning' as const },
        { label: 'Cantidad', value: summary.count.toString(), icon: CreditCard, accent: 'muted' as const },
    ] : [], [summary, currency])

    const statsSections = summary ? [
        {
            type: 'cards' as const,
            title: 'Resumen',
            props: { cards: statsCards },
        },
        {
            type: 'chart' as const,
            title: 'Distribución por Tipo',
            props: {
                children: distributionByType.length > 0 ? (
                    <div className="space-y-2">
                        {distributionByType.map((d, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground truncate mr-2">{d.label}</span>
                                <span className="text-xs font-bold text-foreground shrink-0">
                                    <MoneyDisplay amount={d.amount} currency={currency} inline />
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground text-center py-2 italic">Sin cargos</p>
                ),
            },
        },
        {
            type: 'timeline' as const,
            title: 'Próximas Cuotas',
            props: { events: timelineEvents },
        },
    ] : []

    return (
        <div className="flex flex-col flex-1 min-h-0 space-y-4">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.unbilled-charge"
                    columns={columns}
                    data={mergedRows}
                    isLoading={isLoading}
                    variant="embedded"
                    leftAction={
                        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setStatsOpen(true)}>
                            <BarChart3 className="h-4 w-4" />
                        </Button>
                    }
                    rightButtonGroupAction={filterDropdown}
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
                    cardAccountId={cardAccountId}
                    cardAccountName={cardAccountName}
                    currency={currency}
                    onSuccess={handleAddChargeSuccess}
                    onCancel={() => setShowAddCharge(false)}
                />
            )}

            {showBillCharges && (
                <BillChargesModal
                    cardAccountId={cardAccountId}
                    cardAccountName={cardAccountName}
                    total={summary?.total || 0}
                    charges={charges}
                    installments={upcomingInstallments}
                    currency={currency}
                    onSuccess={handleBillChargesSuccess}
                    onCancel={() => setShowBillCharges(false)}
                />
            )}

            {summary && (
                <EntityStatsBottomSheet
                    open={statsOpen}
                    onOpenChange={setStatsOpen}
                    title={cardAccountName}
                    description="Cargos no facturados"
                    sections={statsSections}
                />
            )}
        </div>
    )
}
