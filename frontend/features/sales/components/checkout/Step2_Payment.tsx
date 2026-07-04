"use client"

import { PaymentMethodSelector, type PaymentData } from "@/features/treasury"
import { type CheckoutPaymentData } from "../../types"
import { StepHeader } from '@/components/shared'
import { Wallet } from "lucide-react"
import { useCallback } from "react"

interface Step2_PaymentProps {
    paymentData: CheckoutPaymentData
    setPaymentData: (data: CheckoutPaymentData) => void
    total: number
    terminalId?: number
    customerCreditBalance?: number
}

export function Step2_Payment({ paymentData, setPaymentData, total, terminalId, customerCreditBalance }: Step2_PaymentProps) {
    const handlePaymentChange = useCallback((data: PaymentData) => {
        setPaymentData({
            ...paymentData,
            method: data.method,
            amount: data.amount,
            treasuryAccountId: data.treasuryAccountId ? Number(data.treasuryAccountId) : null,
            paymentMethodId: data.paymentMethodId ?? undefined,
            isTerminalIntegration: data.isTerminalIntegration,
            checkNumber: data.checkNumber,
            checkBankId: data.checkBankId,
            checkDueDate: data.checkDueDate,
            installments: data.installments,
            isPending: data.isPending ?? false,
            payments: data.payments,
        } as CheckoutPaymentData)
    }, [paymentData, setPaymentData])

    const adaptedPaymentData: PaymentData = {
        ...paymentData as unknown as PaymentData,
        payments: paymentData.payments,
    }

    return (
        <div className="space-y-6">
            <PaymentMethodSelector
                operation="sales"
                terminalId={terminalId}
                total={total}
                paymentData={adaptedPaymentData}
                onPaymentDataChange={handlePaymentChange}
                customerCreditBalance={customerCreditBalance}
                methodTitle={<StepHeader title="Método de Pago" description="Seleccione cómo el cliente pagará esta venta." icon={Wallet} />}
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
