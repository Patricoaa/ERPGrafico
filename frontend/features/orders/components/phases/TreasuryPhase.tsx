import { formatCurrency } from "@/lib/money"
import { getErrorMessage } from "@/lib/errors"

import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { Banknote, Trash2, Ban, Gavel } from "lucide-react"
import { formatEntity } from '@/features/orders/utils/status'
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useCancelPayment, useAnnulPayment } from "../../hooks/useOrdersMutations"
import { ActionConfirmModal, BaseModal, CancelButton, LabeledInput } from '@/components/shared'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PaymentMethodCardSelector, PaymentData } from "@/features/treasury/components/PaymentMethodCardSelector"
import { saleOrderActions } from '@/features/sales/actions'
import { purchaseOrderActions } from '@/features/purchasing/actions'
import { Order, PhaseDocument, Payment } from "../../types"

interface TreasuryPhaseProps {
    isNoteMode: boolean
    noteStatuses: Record<string, string>
    activeDoc: Order
    payments: Payment[]
    userPermissions: string[]
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    posSessionId?: number | null
    isSale?: boolean
    // Accordion props
    collapsible?: boolean
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

export function TreasuryPhase({
    isNoteMode,
    noteStatuses,
    activeDoc,
    payments,
    userPermissions,
    onActionSuccess,
    openDetails,
    posSessionId,
    isSale = false,
    collapsible,
    isOpen,
    onOpenChange,
}: TreasuryPhaseProps) {
    const registry = isSale ? saleOrderActions : purchaseOrderActions

    const cancelPayment = useCancelPayment()
    const annulPayment = useAnnulPayment()

    const [confirmModal, setConfirmModal] = useState<{
        open: boolean,
        title: string,
        description: React.ReactNode,
        onConfirm: (reason?: string) => Promise<void> | void,
        variant?: 'destructive' | 'warning',
        confirmText?: string,
        requireReason?: boolean
    }>({
        open: false,
        title: "",
        description: null,
        onConfirm: () => { }
    })

    const [annulPaymentState, setAnnulPaymentState] = useState<{
        open: boolean
        paymentId: number
        paymentAmount: number
    }>({ open: false, paymentId: 0, paymentAmount: 0 })

    const [annulPaymentData, setAnnulPaymentData] = useState<PaymentData>({
        method: null,
        amount: 0,
        treasuryAccountId: null,
        paymentMethodId: null,
    })

    const [annulReason, setAnnulReason] = useState("")
    const [isAnnuling, setIsAnnuling] = useState(false)

    const canCancelPayment = userPermissions.includes('treasury.delete_treasurymovement')

    const handleDeletePayment = (id: number) => {
        const isPosted = payments.find(p => Number(p.id) === id)?.status === 'POSTED'
        if (isPosted) {
            const payment = payments.find(p => Number(p.id) === id)
            setAnnulPaymentState({
                open: true,
                paymentId: id,
                paymentAmount: Number(payment?.amount || 0),
            })
            setAnnulPaymentData({
                method: null,
                amount: Number(payment?.amount || 0),
                treasuryAccountId: null,
                paymentMethodId: null,
            })
            setAnnulReason("")
            setIsAnnuling(false)
        } else {
            setConfirmModal({
                open: true,
                title: "Cancelar Pago",
                variant: "destructive",
                confirmText: "Cancelar",
                requireReason: false,
                onConfirm: async (reason?: string) => {
                    try {
                        await cancelPayment.mutateAsync({ id, reason })
                        setConfirmModal(prev => ({ ...prev, open: false }))
                        onActionSuccess?.()
                    } catch (error: unknown) {
                        toast.error(getErrorMessage(error) || "Error al cancelar el pago")
                        throw error
                    }
                },
                description: "¿Está seguro de que desea cancelar este pago?"
            })
        }
    }

    return (
        <>
            <PhaseCard
                title="Tesorería"
                icon={Banknote}
                variant={
                    (isNoteMode ? noteStatuses.treasury :
                        (parseFloat(String(activeDoc.pending_amount || '0')) <= 0 ? 'success' :
                            (payments.length > 0 ? 'active' : 'neutral'))) as any
                }
                documents={payments.map((p: Payment) => {
                    const isWriteOff = p.payment_method === 'WRITE_OFF'
                    return {
                        type: isWriteOff ? 'Castigo' : (p.payment_method_display || 'Pago'),
                        number: formatEntity(isWriteOff ? 'CAS' : (p.payment_type === 'INBOUND' ? 'ING' : 'EGR'), p.id, p.display_id),
                        icon: isWriteOff ? Gavel : Banknote,
                        isWarning: isWriteOff,
                        id: p.id,
                        docType: 'payment',
                        status: p.status || 'Pagado',
                        amount: p.amount,
                        documentReference: p.reference,
                        actions: [
                            ...(canCancelPayment && p.status !== 'CANCELLED' && p.status !== 'POSTED' ? [{
                                icon: Trash2,
                                title: 'Cancelar Pago',
                                color: 'text-destructive hover:bg-destructive/10',
                                onClick: () => p.id && handleDeletePayment(Number(p.id))
                            }] : []),
                            ...(canCancelPayment && p.status === 'POSTED' ? [{
                                icon: Ban,
                                title: 'Anular Pago',
                                color: 'text-warning hover:bg-warning/10',
                                onClick: () => p.id && handleDeletePayment(Number(p.id))
                            }] : [])
                        ]
                    }
                }) as PhaseDocument[]}
                onViewDetail={openDetails}
                actions={(registry.payments?.actions || []).filter((a: { id: string }) => !a.id.includes('view-'))}
                emptyMessage="Sin pagos registrados"
                order={activeDoc}
                userPermissions={userPermissions}
                onActionSuccess={onActionSuccess}
                stageId="treasury"
                isComplete={parseFloat(String(activeDoc.pending_amount || '0')) <= 0}
                posSessionId={posSessionId}
                collapsible={collapsible}
                isOpen={isOpen}
                onOpenChange={onOpenChange}
            >
                <div className="flex items-center justify-between py-2 px-2 border-y border-border/10 my-2">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 leading-none">Pagado</span>
                        <span className="text-[14px] font-heading font-black text-success tracking-tight">
                            {formatCurrency(Number(activeDoc.total || 0) - Number(activeDoc.pending_amount || 0))}
                        </span>
                    </div>

                    <div className="h-6 w-[1px] bg-border/20 mx-2" />

                    <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 leading-none">Pendiente</span>
                        <span className={cn(
                            "text-[14px] font-heading font-black tracking-tight",
                            parseFloat(String(activeDoc.pending_amount || '0')) > 0 ? "text-warning" : "text-muted-foreground/30"
                        )}>
                            {formatCurrency(Number(activeDoc.pending_amount || 0))}
                        </span>
                    </div>
                </div>
                
            </PhaseCard>

            <ActionConfirmModal
                open={confirmModal.open}
                onOpenChange={(open) => setConfirmModal(prev => ({ ...prev, open }))}
                title={confirmModal.title}
                description={confirmModal.description}
                onConfirm={confirmModal.onConfirm}
                variant={confirmModal.variant}
                confirmText={confirmModal.confirmText}
                requireReason={confirmModal.requireReason}
                reasonLabel="Motivo de la anulación"
            />

            {/* Anular pago POSTED — modal con selector de cuenta + motivo */}
            <BaseModal
                open={annulPaymentState.open}
                onOpenChange={(open) => setAnnulPaymentState(prev => ({ ...prev, open }))}
                title={
                    <span className="flex items-center gap-2">
                        <Ban className="h-5 w-5 text-warning" />
                        Anular Pago
                    </span>
                }
                size="lg"
                footer={
                    <div className="flex w-full gap-2">
                        <CancelButton onClick={() => setAnnulPaymentState(prev => ({ ...prev, open: false }))} className="flex-1" />
                        <Button
                            className="flex-[2] bg-warning hover:bg-warning/90 h-12 text-lg font-bold"
                            onClick={async () => {
                                setIsAnnuling(true)
                                try {
                                    await annulPayment.mutateAsync({
                                        id: annulPaymentState.paymentId,
                                        reason: annulReason,
                                        treasuryAccountId: annulPaymentData.treasuryAccountId
                                            ? Number(annulPaymentData.treasuryAccountId) : undefined,
                                        amount: annulPaymentData.amount || undefined,
                                    })
                                    setAnnulPaymentState(prev => ({ ...prev, open: false }))
                                    onActionSuccess?.()
                                } catch (error: unknown) {
                                    toast.error(getErrorMessage(error) || "Error al anular el pago")
                                } finally {
                                    setIsAnnuling(false)
                                }
                            }}
                            disabled={
                                isAnnuling ||
                                !annulReason.trim() ||
                                (annulPaymentData.amount > 0 && !annulPaymentData.treasuryAccountId)
                            }
                        >
                            {isAnnuling ? 'Anulando...' : 'Anular con Devolución'}
                        </Button>
                    </div>
                }
            >
                <div className="py-2 space-y-6">
                    <PaymentMethodCardSelector
                        operation={isSale ? 'sales' : 'purchases'}
                        total={annulPaymentState.paymentAmount}
                        paymentData={annulPaymentData}
                        onPaymentDataChange={setAnnulPaymentData}
                        compactMode={true}
                        labels={{
                            totalLabel: 'Total del Pago',
                            amountLabel: 'Monto a Devolver',
                            differencePositiveLabel: 'Diferencia',
                            differenceNegativeLabel: 'Deuda Pendiente',
                            amountModalTitle: 'Monto a devolver',
                            amountModalDescription: 'Ingrese el monto a devolver en esta anulación.',
                        }}
                        methodTitle={
                            <p className="text-xs text-muted-foreground font-medium mb-1">
                                Seleccione el método y la cuenta donde se registrará la devolución.
                            </p>
                        }
                    />
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Motivo de la anulación <span className="text-destructive">*</span>
                        </label>
                        <Textarea
                            value={annulReason}
                            onChange={(e) => setAnnulReason(e.target.value)}
                            placeholder="Indique el motivo de la anulación y devolución..."
                            rows={3}
                            disabled={isAnnuling}
                        />
                    </div>
                </div>
            </BaseModal>
        </>
    )
}
