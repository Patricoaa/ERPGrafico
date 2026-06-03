"use client"

import React, { useState } from 'react'
import { CreditCard, Banknote, CheckCircle, XCircle } from 'lucide-react'
import {
    BaseModal, MoneyDisplay, StatCard, StatusBadge, Skeleton,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useCardStatement, useCardStatementMutations } from './hooks'
import { PayStatementModal } from './PayStatementModal'
interface StatementDetailModalProps {
    statementId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function StatementDetailModal({ statementId, open, onOpenChange }: StatementDetailModalProps) {
    const { data: stmt, isLoading } = useCardStatement(statementId)
    const { cancel, isCanceling } = useCardStatementMutations()
    const [payOpen, setPayOpen] = useState(false)

    if (!open || !statementId) return null

    const handleCancel = async () => {
        if (!stmt) return
        if (window.confirm('¿Anular este estado de cuenta?')) {
            await cancel({ id: stmt.id, notes: 'Anulado desde la UI' })
        }
    }

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
