"use client"

import React, { useMemo, useState } from 'react'
import { CheckCircle, XCircle, ShoppingCart } from 'lucide-react'
import {
    BaseModal, StatusBadge, SkeletonShell,
    DataTableView,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useCardStatement, useStatementCharges, useCardStatementMutations } from '../hooks/useCardStatements'
import { PayStatementModal } from './PayStatementModal'
import { mapToStatementChargeRows } from './utils'
import { parseDateOnly } from '@/lib/utils'
import { statementChargeFields } from './statementChargeFields'

interface StatementDetailModalProps {
    statementId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function StatementDetailModal({ statementId, open, onOpenChange }: StatementDetailModalProps) {
    const { data: stmt, isLoading } = useCardStatement(statementId)
    const { data: chargesResponse, isLoading: chargesLoading } = useStatementCharges(statementId)
    const { cancel, isCanceling } = useCardStatementMutations()
    const [payOpen, setPayOpen] = useState(false)

    const movements = chargesResponse?.movements ?? []
    const installments = chargesResponse?.installments ?? []
    const pendingCharges = chargesResponse?.pending_charges ?? []

    const mergedRows = useMemo(
        () => mapToStatementChargeRows(movements, installments, pendingCharges),
        [movements, installments, pendingCharges],
    )

    if (!open || !statementId) return null

    const handleCancel = async () => {
        if (!stmt) return
        if (window.confirm('¿Anular este estado de cuenta? Los cargos volverán a aparecer como no facturados.')) {
            await cancel({ id: stmt.id, notes: 'Anulado desde la UI' })
        }
    }

    const chargesColumns = statementChargeFields.toColumns()

    const canAct = stmt && (stmt.status === 'OPEN' || stmt.status === 'OVERDUE')

    const footerBtns = canAct ? (
        <div className="flex items-center justify-end gap-2 w-full">
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
        </div>
    ) : undefined

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                title={stmt ? `Estado de Cuenta ${stmt.display_id}` : 'Estado de Cuenta'}
                size="full"
                icon={ShoppingCart}
                hideScrollArea
                contentClassName="flex flex-col p-5"
                footer={footerBtns}
            >
                <SkeletonShell isLoading={isLoading || !stmt} ariaLabel="Cargando estado de cuenta">
                    {stmt ? (
                        <div className="flex flex-col flex-1 space-y-4 min-h-0">
                            <div className="grid grid-cols-2 gap-4 text-sm shrink-0">
                                <div>
                                    <span className="text-muted-foreground">Período:</span>{' '}
                                    <span className="font-medium">
                                        {String(stmt.period_month).padStart(2, '0')}/{stmt.period_year}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Cierre:</span>{' '}
                                    <span className="font-medium">
                                        {parseDateOnly(stmt.cut_off_date).toLocaleDateString('es-CL')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Vencimiento:</span>{' '}
                                    <span className="font-medium">
                                        {parseDateOnly(stmt.due_date).toLocaleDateString('es-CL')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Estado:</span>{' '}
                                    <StatusBadge status={stmt.status} variant="badge" />
                                </div>
                                {stmt.paid_at && (
                                    <div>
                                        <span className="text-muted-foreground">Pagado el:</span>{' '}
                                        <span className="font-medium">
                                            {parseDateOnly(stmt.paid_at).toLocaleDateString('es-CL')}
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
                                <div className="rounded-md border p-3 text-sm text-muted-foreground shrink-0">
                                    {stmt.notes}
                                </div>
                            )}

                            <div className="flex-1 min-h-0 flex flex-col">
                                <div className="flex-1 min-h-0 [&_thead]:!bg-transparent [&_thead_tr]:!bg-transparent">
                                    <DataTableView
                                        entityLabel="treasury.treasurymovement"
                                        columns={chargesColumns}
                                        data={mergedRows}
                                        isLoading={chargesLoading}
                                        variant="embedded"
                                        emptyState={{
                                            context: 'treasury',
                                            icon: ShoppingCart,
                                            title: 'Sin cargos',
                                            description: 'No hay movimientos vinculados a este statement.',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}
                </SkeletonShell>
            </BaseModal>

            <PayStatementModal
                statement={stmt ?? null}
                open={payOpen}
                onOpenChange={setPayOpen}
            />
        </>
    )
}
