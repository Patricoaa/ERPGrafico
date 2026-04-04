"use client"

import { Wallet } from "lucide-react"
import { PaymentMethodCardSelector, PaymentData } from "@/features/treasury/components/PaymentMethodCardSelector"
import { useEffect } from "react"

import { CheckoutPaymentData } from "../../types"

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
            <div className="flex flex-col gap-1">
                <h3 className=" font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-primary" />
                    Registro de Pago
                </h3>
                <p className="text-sm text-muted-foreground">
                    Ingrese la información relacionada al Pago.
                </p>
            </div>

            <PaymentMethodCardSelector
                operation="sales"
                terminalId={terminalId}
                total={total}
                paymentData={paymentData as PaymentData}
                onPaymentDataChange={setPaymentData}
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
    )
}
