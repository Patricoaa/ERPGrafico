"use client"

import * as React from "react"
import { CreditCard } from "lucide-react"
import { BaseModal } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { unifiedPaymentEntity, unifiedPaymentViews, type UnifiedPayment } from "../entity-view/unifiedPayment.entity"
import type { Payroll } from "@/types/hr"

interface PayrollPaymentsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    payroll: Payroll | null
    allPayments: UnifiedPayment[]
}

export function PayrollPaymentsModal({ open, onOpenChange, payroll, allPayments }: PayrollPaymentsModalProps) {
    const payments = React.useMemo(
        () => (payroll ? allPayments.filter((payment) => payment.payroll_display_id === payroll.display_id) : []),
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
            <div className="flex min-h-0 flex-1 flex-col [&>div>div]:rounded-none [&>div>div]:border-0">
                <Collection.Root collection={collection} label="Pagos de liquidación">
                    <Collection.View
                        table={unifiedPaymentViews.table}
                        emptyTitle="Sin pagos registrados"
                        emptyDescription="Esta liquidación no tiene pagos ni anticipos vinculados."
                    />
                </Collection.Root>
            </div>
        </BaseModal>
    )
}
