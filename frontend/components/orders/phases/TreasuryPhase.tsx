
import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { Banknote, Hash, Trash2, AlertCircle, Gavel } from "lucide-react"
import { formatDocumentId } from "@/lib/order-status-utils"
import { cn, formatCurrency } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { TransactionNumberForm } from "@/components/forms/TransactionNumberForm"

interface TreasuryPhaseProps {
    isNoteMode: boolean
    noteStatuses: any
    activeDoc: any
    payments: any[]
    registry: any
    userPermissions: string[]
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    actionEngineRef: any
    posSessionId?: number | null
}

export function TreasuryPhase({
    isNoteMode,
    noteStatuses,
    activeDoc,
    payments,
    registry,
    userPermissions,
    onActionSuccess,
    openDetails,
    actionEngineRef,
    posSessionId
}: TreasuryPhaseProps) {
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean,
        title: string,
        description: React.ReactNode,
        onConfirm: () => Promise<void> | void,
        variant?: 'destructive' | 'warning',
        confirmText?: string
    }>({
        open: false,
        title: "",
        description: null,
        onConfirm: () => { }
    })

    const [trForm, setTrForm] = useState<{ open: boolean, id: number | null, initialValue: string }>({
        open: false,
        id: null,
        initialValue: ""
    })

    const hasPendingTransactions = payments.some((pay: any) => {
        const requiresTR = (
            (pay.payment_type === 'OUTBOUND' && (pay.payment_method === 'CARD' || pay.payment_method === 'TRANSFER')) ||
            (pay.payment_type === 'INBOUND' && pay.payment_method === 'TRANSFER')
        )
        return requiresTR && !pay.transaction_number
    })

    const handleDeletePayment = async (id: number, isConfirmed = false) => {
        if (!isConfirmed) {
            setConfirmModal({
                open: true,
                title: "Eliminar/Anular Pago",
                variant: "destructive",
                confirmText: "Eliminar",
                onConfirm: () => handleDeletePayment(id, true),
                description: "¿Está seguro de que desea eliminar este pago?"
            })
            return
        }

        try {
            await api.delete(`/treasury/payments/${id}/`)
            toast.success("Pago eliminado correctamente")
            setConfirmModal(prev => ({ ...prev, open: false }))
            onActionSuccess?.()
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || ""
            // Identify if error is due to POSTED status (standardize backend to return this specific code/msg)
            if (errorMessage.includes("publicado") || error.response?.status === 400) {
                // Close previous modal
                setConfirmModal(prev => ({ ...prev, open: false }))

                // Open new modal for Annulment
                setTimeout(() => {
                    setConfirmModal({
                        open: true,
                        title: "Anular Pago Confirmado",
                        variant: "warning",
                        confirmText: "Anular Pago",
                        onConfirm: async () => {
                            try {
                                await api.post(`/treasury/payments/${id}/annul/`)
                                toast.success("Pago anulado correctamente")
                                setConfirmModal(prev => ({ ...prev, open: false }))
                                onActionSuccess?.()
                            } catch (err: any) {
                                toast.error(err.response?.data?.error || "Error al anular pago")
                            }
                        },
                        description: "No se puede eliminar un pago ya contabilizado. ¿Desea ANULARLO en su lugar? Esto creará un contra-asiento contable."
                    })
                }, 100)
            } else {
                toast.error(errorMessage || "Error al eliminar el pago")
            }
        }
    }

    return (
        <>
            <PhaseCard
                title="Tesorería"
                icon={Banknote}
                variant={
                    isNoteMode ? noteStatuses.treasury :
                        ((parseFloat(activeDoc.pending_amount || '0') <= 0 && !hasPendingTransactions) ? 'success' :
                            (payments.length > 0 || hasPendingTransactions ? 'active' : 'neutral'))
                }
                documents={payments.map((p: any) => {
                    const isWriteOff = p.payment_method === 'WRITE_OFF'
                    return {
                        type: isWriteOff ? 'Castigo' : (p.payment_method_display || 'Pago'),
                        number: formatDocumentId(isWriteOff ? 'CAS' : (p.payment_type === 'INBOUND' ? 'ING' : 'EGR'), p.id, p.display_id),
                        icon: isWriteOff ? Gavel : Banknote,
                        isWarning: isWriteOff,
                        id: p.id,
                        docType: 'payment',
                        status: p.status || 'Pagado',
                        amount: p.amount,
                        documentReference: p.reference,
                        actions: [
                            ...((((p.payment_type === 'OUTBOUND' && (p.payment_method === 'CARD' || p.payment_method === 'TRANSFER')) || (p.payment_type === 'INBOUND' && p.payment_method === 'TRANSFER'))) && !p.transaction_number ? [{
                                icon: Hash,
                                title: 'Ingresar N° Transacción',
                                color: 'text-orange-500 hover:bg-orange-500/10',
                                onClick: () => p.id && setTrForm({ open: true, id: p.id, initialValue: "" })
                            }] : []),
                            ...((p.status !== 'CANCELLED') ? [{
                                icon: Trash2,
                                title: 'Eliminar/Anular Pago',
                                color: 'text-red-500 hover:bg-red-500/10',
                                onClick: () => p.id && handleDeletePayment(p.id)
                            }] : [])
                        ]
                    }
                })}
                onViewDetail={openDetails}
                actions={(registry.payments?.actions || []).filter((a: any) => !a.id.includes('view-'))}
                emptyMessage="Sin pagos registrados"
                order={activeDoc}
                userPermissions={userPermissions}
                onActionSuccess={onActionSuccess}
                actionEngineRef={actionEngineRef}
                stageId="treasury"
                isComplete={parseFloat(activeDoc.pending_amount || '0') <= 0 && !hasPendingTransactions}
                posSessionId={posSessionId}
            >
                <div className="space-y-0.5 py-0.5">
                    <div className="flex items-center justify-between text-[10.5px] font-bold">
                        <span className="text-muted-foreground/60 uppercase tracking-tighter">Pagado</span>
                        <span className="text-green-500/90">
                            {formatCurrency((activeDoc.total || 0) - (activeDoc.pending_amount || 0))}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-[10.5px] font-bold">
                        <span className="text-muted-foreground/60 uppercase tracking-tighter">Pendiente</span>
                        <span className={cn(parseFloat(activeDoc.pending_amount || '0') > 0 ? "text-orange-500" : "text-muted-foreground/30")}>
                            {formatCurrency(activeDoc.pending_amount || 0)}
                        </span>
                    </div>
                    {hasPendingTransactions && (
                        <div className="flex items-center gap-1 mt-0.5 text-[8.5px] text-orange-400/80 animate-pulse font-black uppercase tracking-widest">
                            <AlertCircle className="size-2.5" />
                            Falta N° TRX
                        </div>
                    )}
                </div>
            </PhaseCard>

            <TransactionNumberForm
                open={trForm.open}
                onOpenChange={(open) => setTrForm({ ...trForm, open })}
                paymentId={trForm.id}
                initialValue={trForm.initialValue}
                onSuccess={() => {
                    onActionSuccess?.()
                }}
            />

            <ActionConfirmModal
                open={confirmModal.open}
                onOpenChange={(open) => setConfirmModal(prev => ({ ...prev, open }))}
                title={confirmModal.title}
                description={confirmModal.description}
                onConfirm={confirmModal.onConfirm}
                variant={confirmModal.variant}
                confirmText={confirmModal.confirmText}
            />
        </>
    )
}
