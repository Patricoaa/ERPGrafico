"use client"

import { CreditCard } from "lucide-react"
import { PaymentMethodSelector, type PaymentData } from "@/features/treasury"
import { StepHeader } from "@/components/shared"
import { useEffect } from "react"

interface Step3_PurchasePaymentProps {
    paymentData: PaymentData
    setPaymentData: (data: PaymentData) => void
    total: number
}

export function Step3_PurchasePayment({ paymentData, setPaymentData, total }: Step3_PurchasePaymentProps) {
    // Initialize amount to total on mount if not set
    useEffect(() => {
        if (paymentData.amount === undefined || paymentData.amount === null) {
            setPaymentData({ ...paymentData, amount: total })
        }
    }, [])

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1 mb-2">
                <StepHeader title="Método de Pago" description="Seleccione cómo se pagará esta compra." icon={CreditCard} />
            </div>

            <PaymentMethodSelector
                operation="purchases"
                total={total}
                paymentData={paymentData as PaymentData}
                onPaymentDataChange={setPaymentData}
                labels={{
                    totalLabel: 'Total a Pagar',
                    amountLabel: 'Monto a Pagar',
                    differencePositiveLabel: 'Excedente',
                    differenceNegativeLabel: 'Deuda Pendiente',
                    amountModalTitle: 'Monto a Pagar',
                    amountModalDescription: 'Ingrese el monto a pagar para esta compra.'
                }}
            />
        </div>
    )
}
