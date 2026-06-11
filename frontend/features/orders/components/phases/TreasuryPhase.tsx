import { formatCurrency } from "@/lib/money"
import { getErrorMessage } from "@/lib/errors"

import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { Banknote, Trash2, Gavel } from "lucide-react"
import { formatEntity } from '@/features/orders/utils/status'
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useCancelPayment, useAnnulPayment } from "../../hooks/useOrdersMutations"
import { ActionConfirmModal } from '@/components/shared'
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
        onConfirm: () => Promise<void> | void,
        variant?: 'destructive' | 'warning',
        confirmText?: string
    }>({
        open: false,
        title: "",
        description: null,
        onConfirm: () => { }
    })

    const handleDeletePayment = async (id: number, isConfirmed = false) => {
        if (!isConfirmed) {
            setConfirmModal({
                open: true,
                title: "Cancelar/Anular Pago",
                variant: "destructive",
                confirmText: "Cancelar",
                onConfirm: () => handleDeletePayment(id, true),
                description: "¿Está seguro de que desea cancelar este pago?"
            })
            return
        }

        try {
            const p = payments.find(p => Number(p.id) === id)
            if (p?.status === 'POSTED') {
                await annulPayment.mutateAsync(id)
            } else {
                await cancelPayment.mutateAsync(id)
            }
            setConfirmModal(prev => ({ ...prev, open: false }))
            onActionSuccess?.()
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error) || "Error al cancelar/anular el pago"
            toast.error(errorMessage)
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
                            ...((p.status !== 'CANCELLED') ? [{
                                icon: Trash2,
                                title: 'Cancelar/Anular Pago',
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
            />
        </>
    )
}
