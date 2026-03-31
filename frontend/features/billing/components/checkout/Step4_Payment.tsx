"use client"

import { CheckCircle2 } from "lucide-react"
import { PaymentMethodCardSelector, PaymentData } from "@/components/shared/PaymentMethodCardSelector"
import { useEffect } from "react"

interface Step4_PaymentProps {
    isCreditNote: boolean
    total: number
    data: any
    setData: (data: any) => void
}

export function Step4_Payment({
    isCreditNote,
    total,
    data,
    setData
}: Step4_PaymentProps) {
    // Determine operation type
    // Credit Note = Refund = We pay OUT = 'purchases' logic?
    // Wait, in Purchase Note Modal logic:
    // Credit Note (Refund to us from Supplier) = 'purchases' (Outgoing? No, Incoming refund).
    // BUT the previous logic in PurchaseNoteModal was:
    // const operation = noteType === 'NOTA_DEBITO' ? 'sales' : 'purchases'
    //
    // Let's re-read the User Request from PurchaseNoteModal refactor:
    // "Debit Notes (Issued) -> Sales Methods (Receiving money?)"
    // "Credit Notes -> Purchase Methods (Paying money / Outbound?)"
    //
    // In `NoteCheckoutWizard` (Billing context - Sales/Purchases?):
    // This wizard seems to be used for SALES notes too (based on `initialType` and `invoiceId`).
    // If this is for SALES:
    // Credit Note (We refund Client) -> Outgoing money -> 'purchases' methods (Transfer out, etc)?
    // Debit Note (We charge Client) -> Incoming money -> 'sales' methods (Card, Cash in).
    //
    // Let's assume the previous logic holds:
    // Debit Note -> Sales
    // Credit Note -> Purchases

    const operation = !isCreditNote ? 'sales' : 'purchases'

    // Map internal snake_case data to PaymentData (camelCase)
    const paymentData: PaymentData = {
        method: data.method as any,
        amount: data.amount,
        treasuryAccountId: data.treasury_account_id || null,
        paymentMethodId: null, // Not strictly used by logic but part of type
        transactionNumber: data.transaction_number,
        isPending: data.is_pending
    }

    const handlePaymentDataChange = (newData: PaymentData) => {
        setData({
            ...data,
            method: newData.method,
            amount: newData.amount,
            treasury_account_id: newData.treasuryAccountId,
            transaction_number: newData.transactionNumber,
            is_pending: newData.isPending
        })
    }

    // Ensure amount is synced with total if not set (or on mount/total change)
    useEffect(() => {
        if (data.amount !== total) {
            // Only auto-update if it hasn't been manually set?
            // Or always sync? Ususally sync for these wizards.
            // But let's respect if user typed something different?
            // Actually, usually we start with total.
            if (data.amount === 0) {
                handlePaymentDataChange({ ...paymentData, amount: total })
            }
        }
    }, [total])


    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1">
                <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3 text-xl">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    {isCreditNote ? 'Método de Devolución' : 'Método de Cobro'}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {isCreditNote
                        ? 'Indique cómo se realizará la devolución del dinero (o deje pendiente para saldo a favor).'
                        : 'Seleccione cómo realizará el cobro de esta nota de débito.'}
                </p>
            </div>

            <PaymentMethodCardSelector
                operation={operation}
                total={total}
                paymentData={paymentData}
                onPaymentDataChange={handlePaymentDataChange}
                compactMode={false}
                allowCreditBalanceAccumulation={isCreditNote}
                labels={{
                    totalLabel: "Total Documento",
                    amountLabel: isCreditNote ? "Monto a Devolver" : "Monto a Cobrar",
                    differencePositiveLabel: "Excedente / Vuelto",
                    differenceNegativeLabel: isCreditNote ? "Saldo Pendiente" : "Por Cobrar",
                    amountModalTitle: isCreditNote ? "Monto a Devolver" : "Monto a Cobrar",
                    amountModalDescription: "Ingrese el monto asociado al movimiento."
                }}
            />
        </div>
    )
}



