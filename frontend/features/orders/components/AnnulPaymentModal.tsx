"use client"

import { useState } from "react"
import { Ban } from "lucide-react"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/errors"
import { BaseModal, CancelButton } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PaymentMethodSelector, type PaymentData } from "@/features/treasury"
import { useAnnulPayment } from "../hooks/useOrdersMutations"

interface AnnulPaymentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    paymentId: number
    paymentAmount: number
    isSale: boolean
    onSuccess?: () => void
}

const EMPTY_PAYMENT: PaymentData = { method: null, amount: 0, treasuryAccountId: null, paymentMethodId: null }

/**
 * Anular un pago contabilizado con devolución (INT-15: siempre por el monto completo).
 * Extraído de TreasuryPhase del Order Hub (ADR-0083); lo usan el Hub y la ficha documental.
 */
export function AnnulPaymentModal({ open, onOpenChange, paymentId, paymentAmount, isSale, onSuccess }: AnnulPaymentModalProps) {
    const { annulPayment } = useAnnulPayment()
    // Montar con `key={paymentId}` para reiniciar el formulario al cambiar de pago.
    const [paymentData, setPaymentData] = useState<PaymentData>({ ...EMPTY_PAYMENT, amount: paymentAmount })
    const [reason, setReason] = useState("")
    const [isAnnuling, setIsAnnuling] = useState(false)

    const isPartialRefund = paymentData.amount > 0 && paymentData.amount !== paymentAmount

    const handleAnnul = async () => {
        setIsAnnuling(true)
        try {
            await annulPayment({
                id: paymentId,
                reason,
                treasuryAccountId: paymentData.treasuryAccountId ? Number(paymentData.treasuryAccountId) : undefined,
                amount: paymentData.amount || undefined,
            })
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            toast.error(getErrorMessage(error) || "Error al anular el pago")
        } finally {
            setIsAnnuling(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <span className="flex items-center gap-2">
                    <Ban className="h-5 w-5 text-warning" />
                    Anular Pago
                </span>
            }
            size="lg"
            footer={
                <div className="flex w-full gap-2">
                    <CancelButton onClick={() => onOpenChange(false)} className="flex-1" />
                    <Button
                        className="flex-[2] bg-warning hover:bg-warning/90 h-12 text-lg font-medium"
                        onClick={handleAnnul}
                        disabled={
                            isAnnuling ||
                            !reason.trim() ||
                            (paymentData.amount > 0 && !paymentData.treasuryAccountId) ||
                            isPartialRefund
                        }
                    >
                        {isAnnuling ? 'Anulando...' : 'Anular con Devolución'}
                    </Button>
                </div>
            }
        >
            <div className="py-2 space-y-6">
                <PaymentMethodSelector
                    operation={isSale ? 'sales' : 'purchases'}
                    total={paymentAmount}
                    paymentData={paymentData}
                    onPaymentDataChange={setPaymentData}
                    labels={{
                        totalLabel: 'Total del Pago',
                        amountLabel: 'Monto a Devolver',
                        differencePositiveLabel: 'Diferencia',
                        differenceNegativeLabel: 'Deuda Pendiente',
                        amountModalTitle: 'Monto a devolver',
                    }}
                    methodTitle={
                        <p className="text-xs text-muted-foreground font-medium mb-1">
                            Seleccione el método y la cuenta donde se registrará la devolución.
                        </p>
                    }
                />
                {isPartialRefund && (
                    <p className="text-xs text-warning">
                        La anulación devuelve el pago completo. Para una devolución parcial use
                        &quot;Registrar devolución&quot; o una Nota de Crédito.
                    </p>
                )}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">
                        Motivo de la anulación <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Indique el motivo de la anulación y devolución..."
                        rows={3}
                        disabled={isAnnuling}
                    />
                </div>
            </div>
        </BaseModal>
    )
}
