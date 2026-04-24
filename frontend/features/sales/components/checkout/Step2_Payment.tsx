"use client"

import { Wallet } from "lucide-react"
import { PaymentMethodCardSelector, PaymentData } from "@/features/treasury/components/PaymentMethodCardSelector"
import { CheckoutPaymentData } from "../../types"
import { LabeledContainer } from "@/components/shared/LabeledContainer"

interface Step2_PaymentProps {
    paymentData: CheckoutPaymentData
    setPaymentData: (data: CheckoutPaymentData) => void
    total: number
    terminalId?: number
    customerCreditBalance?: number
}

export function Step2_Payment({ paymentData, setPaymentData, total, terminalId, customerCreditBalance }: Step2_PaymentProps) {
    return (
        <div className="space-y-4">
            <LabeledContainer
                label="Registro de Pago"
                icon={<Wallet className="h-4 w-4" />}
                className="bg-background"
            >
                <div className="p-4 space-y-4">
                    <p className="text-sm text-muted-foreground mb-2">
                        Ingrese la información relacionada al Pago.
                    </p>

                    <PaymentMethodCardSelector
                        operation="sales"
                        terminalId={terminalId}
                        total={total}
                        paymentData={paymentData as PaymentData}
                        onPaymentDataChange={setPaymentData as any}
                        customerCreditBalance={customerCreditBalance}
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
            </LabeledContainer>
        </div>
    )
}
