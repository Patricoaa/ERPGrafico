"use client"

import { CreditCard } from "lucide-react"
import { PaymentMethodCardSelector, PaymentData } from "@/features/treasury/components/PaymentMethodCardSelector"
import { useEffect } from "react"

interface Step3_PurchasePaymentProps {
    paymentData: any
    setPaymentData: (data: any) => void
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
            <div className="flex flex-col gap-1">
                <h3 className=" font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Registro de Pago
                </h3>
                <p className="text-sm text-muted-foreground">
                    Ingrese la información relacionada al Pago de la Orden de Compra.
                </p>
            </div>

            <PaymentMethodCardSelector
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
