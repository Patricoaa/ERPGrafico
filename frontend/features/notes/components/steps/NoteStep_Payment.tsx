"use client"

/**
 * NoteStep_Payment
 *
 * Unified payment step for both sales and purchase note wizards.
 *
 * Logic:
 *   Sales:
 *     Credit Note → We refund client   → operation = 'purchases' (money out)
 *     Debit Note  → We charge client   → operation = 'sales'     (money in)
 *   Purchase:
 *     Credit Note → Supplier refunds us → operation = 'purchases' (money in, but treated as purchases for account types)
 *     Debit Note  → We pay supplier     → operation = 'sales'     (money out)
 *
 * Both modes: Debit → 'sales', Credit → 'purchases' — same rule, different semantics.
 *
 * Replaces:
 *  - features/billing/components/checkout/Step4_Payment.tsx
 *  - features/purchasing/components/notes/PurchaseNoteWizardSteps.tsx Step4_Payment
 */

import { CheckCircle2 } from 'lucide-react'
import { PaymentMethodSelector, type PaymentData } from '@/features/treasury'
import { useEffect } from 'react'
import type { NoteType, NoteWizardMode } from '@/features/notes'

interface NoteStep_PaymentProps {
    mode: NoteWizardMode
    noteType: NoteType
    total: number
    paymentData: PaymentData
    setPaymentData: (data: PaymentData) => void
}

export function NoteStep_Payment({
    mode,
    noteType,
    total,
    paymentData,
    setPaymentData,
}: NoteStep_PaymentProps) {
    const isCreditNote = noteType === 'NOTA_CREDITO'

    // Debit Note → sales operation (receiving/charging money)
    // Credit Note → purchases operation (paying out / receiving refund through purchase accounts)
    const operation: 'sales' | 'purchases' = isCreditNote ? 'purchases' : 'sales'

    // Sync amount when totals change on mount
    useEffect(() => {
        if (paymentData.amount === 0 && total > 0) {
            setPaymentData({ ...paymentData, amount: total })
        }
    }, [total]) // eslint-disable-line react-hooks/exhaustive-deps

    const labels = isCreditNote
        ? {
              title: mode === 'sales' ? 'Método de Devolución' : 'Método de Reembolso',
              description:
                  mode === 'sales'
                      ? 'Indique cómo se realizará la devolución del dinero (o deje pendiente para saldo a favor).'
                      : 'Seleccione cómo recibió la devolución de dinero (o deje pendiente para crédito a favor).',
              totalLabel: 'Total Documento',
              amountLabel: mode === 'sales' ? 'Monto a Devolver' : 'Monto Reembolsado',
              differencePositiveLabel: 'Excedente / Vuelto',
              differenceNegativeLabel: 'Saldo Pendiente',
              amountModalTitle: mode === 'sales' ? 'Monto a Devolver' : 'Monto a Reembolsar',
              amountModalDescription: 'Ingrese el monto asociado al movimiento de tesorería.',
          }
        : {
              title: mode === 'sales' ? 'Método de Cobro' : 'Método de Pago',
              description:
                  mode === 'sales'
                      ? 'Seleccione cómo realizará el cobro de esta nota de débito.'
                      : 'Seleccione cómo realizará el pago de esta nota de débito.',
              totalLabel: 'Monto Total Nota',
              amountLabel: mode === 'sales' ? 'Monto a Cobrar' : 'Monto a Pagar',
              differencePositiveLabel: 'Excedente / Vuelto',
              differenceNegativeLabel: mode === 'sales' ? 'Por Cobrar' : 'Deuda Pendiente',
              amountModalTitle: mode === 'sales' ? 'Monto a Cobrar' : 'Monto a Pagar',
              amountModalDescription: 'Ingrese el monto asociado al movimiento de tesorería.',
          }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1">
                <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3 text-xl">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    {labels.title}
                </h3>
                <p className="text-sm text-muted-foreground">{labels.description}</p>
            </div>

            <PaymentMethodSelector
                operation={operation}
                total={total}
                paymentData={paymentData}
                onPaymentDataChange={setPaymentData}
                allowCreditBalanceAccumulation={isCreditNote}
                labels={{
                    totalLabel: labels.totalLabel,
                    amountLabel: labels.amountLabel,
                    differencePositiveLabel: labels.differencePositiveLabel,
                    differenceNegativeLabel: labels.differenceNegativeLabel,
                    amountModalTitle: labels.amountModalTitle,
                    amountModalDescription: labels.amountModalDescription,
                }}
            />
        </div>
    )
}
