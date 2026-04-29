import { getErrorMessage } from "@/lib/errors"

import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { Banknote, Hash, Trash2, AlertCircle, Gavel } from "lucide-react"
import { formatDocumentId } from '@/features/orders/utils/status'
import { cn, formatCurrency } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { TransactionNumberForm } from "@/features/finance/components/TransactionNumberForm"
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
    collapsible,
    isOpen,
    onOpenChange,
}: TreasuryPhaseProps) {
    const registry = (activeDoc?.document_type === 'PURCHASE_ORDER' || activeDoc?.document_type === 'SERVICE_OBLIGATION') 
        ? purchaseOrderActions 
        : saleOrderActions

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

    const hasPendingTransactions = payments.some((pay: Payment) => {
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
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error) || ""
            // Identify if error is due to POSTED status (standardize backend to return this specific code/msg)
            if (errorMessage.includes("publicado") || (error as { response?: { status?: number } })?.response?.status === 400) {
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
                            } catch (err: unknown) {
                                toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Error al anular pago")
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
                    (isNoteMode ? noteStatuses.treasury :
                        ((parseFloat(String(activeDoc.pending_amount || '0')) <= 0 && !hasPendingTransactions) ? 'success' :
                            (payments.length > 0 || hasPendingTransactions ? 'active' : 'neutral'))) as any
                }
                documents={payments.map((p: Payment) => {
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
                                color: 'text-warning hover:bg-warning/10',
                                onClick: () => p.id && setTrForm({ open: true, id: Number(p.id), initialValue: "" })
                            }] : []),
                            ...((p.status !== 'CANCELLED') ? [{
                                icon: Trash2,
                                title: 'Eliminar/Anular Pago',
                                color: 'text-destructive hover:bg-destructive/10',
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
                isComplete={parseFloat(String(activeDoc.pending_amount || '0')) <= 0 && !hasPendingTransactions}
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
                {hasPendingTransactions && (
                    <div className="flex items-center justify-center gap-1.5 py-1 text-[9px] text-warning/80 animate-pulse font-black uppercase tracking-widest">
                        <AlertCircle className="size-3" />
                        Falta N° TRX
                    </div>
                )}
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
