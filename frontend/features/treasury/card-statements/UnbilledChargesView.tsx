"use client"

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Receipt, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import type { TreasuryMovement } from '../types'
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
}

export function UnbilledChargesView({
    bankId,
    cardAccountId,
    cardAccountName,
    currency = 'CLP',
}: UnbilledChargesViewProps) {
    const [showAddCharge, setShowAddCharge] = useState(false)
    const [showBillCharges, setShowBillCharges] = useState(false)
    const queryClient = useQueryClient()

    const { data: result, isLoading } = useQuery({
        queryKey: ['unbilled-charges', cardAccountId],
        queryFn: () => treasuryApi.getUnbilledCharges(cardAccountId),
        enabled: !!cardAccountId,
    })

    const charges: TreasuryMovement[] = result?.charges ?? []
    const summary: UnbilledSummary | undefined = result?.summary

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

    function renderCuota(charge: TreasuryMovement) {
        const group = charge.card_purchase_group_detail
        if (!group || !charge.installment_number) return null
        return (
            <span className="text-xs font-medium tabular-nums">
                {charge.installment_number}/{group.installments}
            </span>
        )
    }

    function renderCompra(charge: TreasuryMovement) {
        const group = charge.card_purchase_group_detail
        if (!group) return null
        return (
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
        )
    }

    function renderCuotaCompraInfo(charge: TreasuryMovement) {
        const group = charge.card_purchase_group_detail
        if (!group) return null
        return (
            <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Cuota:</span>
                    <span className="font-medium tabular-nums">
                        {charge.installment_number || '—'}/{group.installments}
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
    }

    const columns: ColumnDef<TreasuryMovement, any>[] = [
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
            accessorKey: 'reference',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Referencia" className="justify-center" />
            ),
            cell: ({ row }) => {
                const ref = row.original.reference
                const notes = row.original.notes
                return (
                    <div className="flex flex-col items-start gap-0.5">
                        <span className="text-xs font-medium text-foreground">
                            {ref || `Movimiento #${row.original.id}`}
                        </span>
                        {notes && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {notes}
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
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    {renderCuota(row.original)}
                </div>
            ),
            enableSorting: false,
        },
        {
            id: 'compra',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Compra" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    {renderCompra(row.original)}
                </div>
            ),
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
            accessorKey: 'movement_type_display',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge
                        status={row.original.movement_type}
                        label={row.original.movement_type_display}
                    />
                </div>
            ),
        },
    ]

    const rightButtonGroupAction = (
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    entityLabel="treasury.treasurymovement"
                    columns={columns}
                    data={charges}
                    isLoading={isLoading}
                    variant="embedded"
                    createAction={rightButtonGroupAction}
                    filterColumn="reference"
                    searchPlaceholder="Buscar por referencia..."
                    emptyState={{
                        context: 'treasury',
                        icon: CreditCard,
                        title: 'No hay cargos no facturados',
                        description: 'Los cargos de esta tarjeta de crédito aparecerán aquí antes de ser facturados.',
                    }}
                    renderCard={(charge: TreasuryMovement) => (
                    <EntityCard>
                        <EntityCard.Header
                            title={charge.reference || `Movimiento #${charge.id}`}
                            subtitle={charge.date}
                            trailing={
                                <StatusBadge
                                    status={charge.movement_type}
                                    label={charge.movement_type_display}
                                />
                            }
                        />
                        <EntityCard.Body>
                            {charge.notes && (
                                <EntityCard.Field
                                    label="Descripción"
                                    value={charge.notes}
                                    full
                                />
                            )}
                            {renderCuotaCompraInfo(charge) && (
                                <EntityCard.Field
                                    label="Detalle de Compra"
                                    value={renderCuotaCompraInfo(charge)}
                                    full
                                />
                            )}
                        </EntityCard.Body>
                        <EntityCard.Footer className="justify-between items-center border-t bg-muted/10 py-2 px-4">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                Monto
                            </span>
                            <DataCell.Currency
                                value={charge.amount}
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
                    currency={currency}
                    onSuccess={handleBillChargesSuccess}
                    onCancel={() => setShowBillCharges(false)}
                />
            )}
        </div>
    )
}
