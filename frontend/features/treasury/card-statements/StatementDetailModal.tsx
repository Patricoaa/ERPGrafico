"use client"

import React, { useState } from 'react'
import { CreditCard, Banknote, CheckCircle, XCircle, ShoppingCart } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import {
    BaseModal, MoneyDisplay, StatCard, StatusBadge, Skeleton,
    DataTableView, DataTableColumnHeader, DataCell,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useCardStatement, useStatementCharges, useCardStatementMutations } from './hooks'
import { PayStatementModal } from './PayStatementModal'
import type { TreasuryMovement } from '../types'
interface StatementDetailModalProps {
    statementId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function StatementDetailModal({ statementId, open, onOpenChange }: StatementDetailModalProps) {
    const { data: stmt, isLoading } = useCardStatement(statementId)
    const { data: charges = [], isLoading: chargesLoading } = useStatementCharges(statementId)
    const { cancel, isCanceling } = useCardStatementMutations()
    const [payOpen, setPayOpen] = useState(false)

    if (!open || !statementId) return null

    const handleCancel = async () => {
        if (!stmt) return
        if (window.confirm('¿Anular este estado de cuenta?')) {
            await cancel({ id: stmt.id, notes: 'Anulado desde la UI' })
        }
    }

    const chargesColumns: ColumnDef<TreasuryMovement>[] = [
        {
            accessorKey: 'date',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.Date value={row.original.date} />
                </div>
            ),
        },
        {
            accessorKey: 'reference',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Referencia" />
            ),
            cell: ({ row }) => (
                <span className="text-xs font-medium">
                    {row.original.reference || `Movimiento #${row.original.id}`}
                </span>
            ),
        },
        {
            id: 'cuota',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cuota" className="justify-center" />
            ),
            cell: ({ row }) => {
                const mv = row.original
                const group = mv.card_purchase_group_detail
                if (!group || !mv.installment_number) return null
                return (
                    <div className="flex justify-center text-xs font-medium tabular-nums">
                        {mv.installment_number}/{group.installments}
                    </div>
                )
            },
        },
        {
            id: 'compra',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Compra" className="justify-center" />
            ),
            cell: ({ row }) => {
                const group = row.original.card_purchase_group_detail
                if (!group) return null
                return (
                    <div className="flex flex-col items-start">
                        <span className="text-xs font-medium truncate max-w-[160px]">
                            {group.client_reference || `Compra #${group.id}`}
                        </span>
                        {group.partner_name && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                                {group.partner_name}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: 'amount',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Monto" className="justify-end" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={row.original.amount} />
                </div>
            ),
        },
        {
            accessorKey: 'movement_type_display',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <StatusBadge
                        status={row.original.movement_type}
                        label={row.original.movement_type_display}
                    />
                </div>
            ),
        },
    ]

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                title={stmt ? `Estado de Cuenta ${stmt.display_id}` : 'Estado de Cuenta'}
                size="full"
            >
                {isLoading || !stmt ? (
                    <div className="space-y-4">
                        <Skeleton className="h-24" />
                        <Skeleton className="h-48" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard
                                label="Facturado"
                                value={<MoneyDisplay amount={parseFloat(stmt.billed_amount)} />}
                                icon={CreditCard}
                                accent="primary"
                            />
                            <StatCard
                                label="Interés"
                                value={<MoneyDisplay amount={parseFloat(stmt.interest_charged)} />}
                                icon={Banknote}
                                accent="info"
                            />
                            <StatCard
                                label="Comisiones"
                                value={<MoneyDisplay amount={parseFloat(stmt.fees_charged)} />}
                                icon={Banknote}
                                accent="info"
                            />
                            <StatCard
                                label="Total a Pagar"
                                value={<MoneyDisplay amount={parseFloat(stmt.total_to_pay)} />}
                                icon={CreditCard}
                                accent="warning"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Período:</span>{' '}
                                <span className="font-medium">
                                    {String(stmt.period_month).padStart(2, '0')}/{stmt.period_year}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Cierre:</span>{' '}
                                <span className="font-medium">
                                    {new Date(stmt.cut_off_date).toLocaleDateString('es-CL')}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Vencimiento:</span>{' '}
                                <span className="font-medium">
                                    {new Date(stmt.due_date).toLocaleDateString('es-CL')}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Estado:</span>{' '}
                                <StatusBadge status={stmt.status} />
                            </div>
                            {stmt.paid_at && (
                                <div>
                                    <span className="text-muted-foreground">Pagado el:</span>{' '}
                                    <span className="font-medium">
                                        {new Date(stmt.paid_at).toLocaleDateString('es-CL')}
                                    </span>
                                </div>
                            )}
                            {stmt.payment_account_name && (
                                <div>
                                    <span className="text-muted-foreground">Cuenta de pago:</span>{' '}
                                    <span className="font-medium">{stmt.payment_account_name}</span>
                                </div>
                            )}
                        </div>

                        {stmt.notes && (
                            <div className="rounded-md border p-3 text-sm text-muted-foreground">
                                {stmt.notes}
                            </div>
                        )}

                        {/* Cargos Facturados del Statement */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold">Cargos Facturados</h3>
                                <span className="text-xs text-muted-foreground">
                                    ({charges.length} movimientos)
                                </span>
                            </div>
                            <DataTableView
                                entityLabel="treasury.treasurymovement"
                                columns={chargesColumns}
                                data={charges}
                                isLoading={chargesLoading}
                                variant="embedded"
                                filterColumn="reference"
                                searchPlaceholder="Buscar cargo..."
                                emptyState={{
                                    context: 'treasury',
                                    icon: ShoppingCart,
                                    title: 'Sin cargos',
                                    description: 'No hay movimientos vinculados a este statement.',
                                }}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            {(stmt.status === 'OPEN' || stmt.status === 'OVERDUE') && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={handleCancel}
                                        disabled={isCanceling}
                                    >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Anular
                                    </Button>
                                    <Button onClick={() => setPayOpen(true)}>
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Pagar
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </BaseModal>

            <PayStatementModal
                statement={stmt ?? null}
                open={payOpen}
                onOpenChange={setPayOpen}
            />
        </>
    )
}
