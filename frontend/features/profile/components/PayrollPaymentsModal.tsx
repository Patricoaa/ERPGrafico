"use client"

import * as React from "react"
import { CreditCard } from "lucide-react"
import { BaseModal } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { unifiedPaymentEntity, unifiedPaymentViews, type UnifiedPayment } from "../entity-view/unifiedPayment.entity"
import type { Payroll } from "@/types/hr"

const PAYROLL_PAYMENT_TYPES: readonly UnifiedPayment["type"][] = ["SALARIO", "ANTICIPO"]

interface PayrollPaymentsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    payroll: Payroll | null
    allPayments: UnifiedPayment[]
}

export function PayrollPaymentsModal({ open, onOpenChange, payroll, allPayments }: PayrollPaymentsModalProps) {
    const payments = React.useMemo(
        // Solo remuneraciones y anticipos: los pagos de Previred u otros no se listan aquí.
        () => (payroll ? allPayments.filter((payment) => payment.payroll_display_id === payroll.display_id && PAYROLL_PAYMENT_TYPES.includes(payment.type)) : []),
        [payroll, allPayments],
    )
    const collection = useEntityCollection(unifiedPaymentEntity, { rows: payments }, { pagination: { mode: "none" } })

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={`Pagos de ${payroll?.display_id ?? "liquidación"}`}
            description={payroll?.period_label}
            icon={CreditCard}
            size="lg"
            variant="raw"
            hideScrollArea
            className="min-h-[min(60dvh,600px)] max-h-[85dvh] rounded-md p-0"
            contentClassName="overflow-hidden p-4 sm:p-6"
        >
            <div className="flex min-h-0 flex-1 flex-col">
                <Collection.Root collection={collection} label="Pagos de liquidación">
                    <Collection.View
                        table={unifiedPaymentViews.table}
                        emptyTitle="Sin pagos registrados"
                        emptyDescription="Esta liquidación no tiene pagos de remuneración ni anticipos vinculados."
                    />
                </Collection.Root>
            </div>
        </BaseModal>
    )
}
