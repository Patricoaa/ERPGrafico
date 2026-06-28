"use client"

import { PaymentMethodSelector, type PaymentData } from "@/features/treasury"
import { type CheckoutPaymentData } from "../../types"
import { FormSection } from '@/components/shared'
import { Wallet } from "lucide-react"

interface Step2_PaymentProps {
    paymentData: CheckoutPaymentData
    setPaymentData: (data: CheckoutPaymentData) => void
    total: number
    terminalId?: number
    customerCreditBalance?: number
}

export function Step2_Payment({ paymentData, setPaymentData, total, terminalId, customerCreditBalance }: Step2_PaymentProps) {
    return (
        <div className="space-y-6">
            <PaymentMethodSelector
                operation="sales"
                terminalId={terminalId}
                total={total}
                paymentData={paymentData as PaymentData}
                onPaymentDataChange={setPaymentData as unknown as (data: PaymentData) => void}
                customerCreditBalance={customerCreditBalance}
                methodTitle={<FormSection title="Método de Pago" icon={Wallet} />}
                labels={{
                    totalLabel: 'Total a Cobrar',
                    amountLabel: 'Monto Recibido',
                    differencePositiveLabel: 'Vuelto',
                    differenceNegativeLabel: 'Crédito Asignado',
                    amountModalTitle: 'Monto Recibido',
                    amountModalDescription: 'Ingrese el monto recibido para este pago.'
                }}
            />
        </div>
    )
}
