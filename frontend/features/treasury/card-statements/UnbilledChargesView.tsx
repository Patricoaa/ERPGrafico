"use client"

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Receipt, CreditCard, ChevronDown, Calendar } from 'lucide-react'
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
    StatCard,
    StatusBadge,
    Skeleton,
} from '@/components/shared'
import { treasuryApi } from '../api/treasuryApi'
import type { TreasuryMovement, UpcomingInstallment, UnbilledItemRow } from '../types'
import { mapToUnbilledItemRows } from './utils'
import { AddChargeModal } from './AddChargeModal'
import { BillChargesModal } from './BillChargesModal'

interface UnbilledChargesViewProps {
    bankId: number
    cardAccountId: number
    cardAccountName: string
    currency?: string
}

interface UnbilledSummary {
    total: number
    count: number
    purchases: number
    charges: number
    installments: number
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
    const queryClient = useQueryClient()

    const today = new Date().toISOString().split('T')[0]
    const cutOffDate = filterMode === 'month' ? today : undefined

    const { data: result, isLoading } = useQuery({
        queryKey: ['unbilled-charges', cardAccountId, cutOffDate ?? 'all'],
        queryFn: () => treasuryApi.getUnbilledCharges(cardAccountId, cutOffDate),
        enabled: !!cardAccountId,
    })

    const charges: TreasuryMovement[] = result?.charges ?? []
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
            id: 'referencia',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Referencia" className="justify-center" />
            ),
            cell: ({ row }) => {
                const item = row.original
                return (
                    <div className="flex flex-col items-start gap-0.5">
                        <span className="text-xs font-medium text-foreground">
                            {item.reference || (item.source === 'charge' ? `Movimiento #${item.id}` : item.notes) || '-'}
                        </span>
                        {item.source === 'charge' && item.notes && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {item.notes}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            id: 'cuota',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cuota" className="justify-center" />
            ),
            cell: ({ row }) => {
                const item = row.original
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
                <DataTableColumnHeader column={column} title="Compra" className="justify-center" />
            ),
            cell: ({ row }) => {
                const item = row.original
                const group = item.purchaseGroupDetail
                if (!group) return null
                return (
                    <div className="flex justify-center w-full">
                        <div className="flex flex-col items-start gap-0.5">
                            <span className="text-[11px] font-medium text-foreground truncate max-w-[180px]">
                                {group.client_reference || `Compra #${group.id}`}
                            </span>
                            {group.partner_name && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                    {group.partner_name}
                                </span>
                            )}
                        </div>
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
                return (
                    <div className="flex justify-center w-full">
                        <StatusBadge
                            status={item.movementType || ''}
                            label={item.movementTypeDisplay || ''}
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
                size="sm"
                disabled={!summary || summary.count === 0}
                onClick={() => setShowBillCharges(true)}
            >
                <Receipt className="mr-2 h-4 w-4" />
                Facturar Cargos
            </Button>
            <Button size="sm" onClick={() => setShowAddCharge(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Cargo
            </Button>
        </div>
    )

    if (isLoading) {
        return (
            <div className="flex flex-col flex-1 min-h-0 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-64" />
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 space-y-4">
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <StatCard
                        label="Total"
                        value={<MoneyDisplay amount={summary.total} currency={currency} inline />}
                        icon={CreditCard}
                        accent="primary"
                    />
                    <StatCard
                        label="Compras"
                        value={<MoneyDisplay amount={summary.purchases} currency={currency} inline />}
                        icon={CreditCard}
                        accent="info"
                    />
                    <StatCard
                        label="Cuotas"
                        value={<MoneyDisplay amount={summary.installments} currency={currency} inline />}
                        icon={CreditCard}
                        accent="info"
                    />
                    <StatCard
                        label="Cargos Financieros"
                        value={<MoneyDisplay amount={summary.charges} currency={currency} inline />}
                        icon={CreditCard}
                        accent="warning"
                    />
                    <StatCard
                        label="Cantidad"
                        value={summary.count.toString()}
                        icon={CreditCard}
                        accent="muted"
                    />
                </div>
            )}

            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.unbilled-charge"
                    columns={columns}
                    data={mergedRows}
                    isLoading={isLoading}
                    variant="embedded"
                    rightButtonGroupAction={filterDropdown}
                    createAction={actionButtons}
                    filterColumn="reference"
                    searchPlaceholder="Buscar por referencia..."
                    emptyState={{
                        context: 'treasury',
                        icon: CreditCard,
                        title: 'No hay cargos no facturados',
                        description: 'Los cargos de esta tarjeta de crédito aparecerán aquí antes de ser facturados.',
                    }}
                    renderCard={(item: UnbilledItemRow) => (
                        <EntityCard>
                            <EntityCard.Header
                                title={item.reference || (item.source === 'charge' ? `Movimiento #${item.id}` : `Cuota ${item.installmentNumber}/${item.totalInstallments}`)}
                                subtitle={item.date}
                                trailing={
                                    <StatusBadge
                                        status={item.movementType || ''}
                                        label={item.movementTypeDisplay || ''}
                                    />
                                }
                            />
                            <EntityCard.Body>
                                {item.source === 'charge' && item.notes && (
                                    <EntityCard.Field label="Descripción" value={item.notes} full />
                                )}
                                {item.purchaseGroupDetail && (
                                    <EntityCard.Field
                                        label="Detalle de Compra"
                                        value={(() => {
                                            const group = item.purchaseGroupDetail!
                                            return (
                                                <div className="flex flex-col gap-2 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground">Cuota:</span>
                                                        <span className="font-medium tabular-nums">
                                                            {item.installmentNumber || '—'}/{group.installments}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground">Compra:</span>
                                                        <span className="font-medium">
                                                            {group.client_reference || `Compra #${group.id}`}
                                                        </span>
                                                    </div>
                                                    {group.partner_name && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-muted-foreground">Proveedor:</span>
                                                            <span className="font-medium">{group.partner_name}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground">Total:</span>
                                                        <MoneyDisplay amount={Number(group.total_amount)} currency={currency} inline />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground">1ra cuota:</span>
                                                        <span className="font-medium">{group.first_installment_date}</span>
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                        full
                                    />
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
        </div>
    )
}
