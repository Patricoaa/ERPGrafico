"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared"
import { showApiError } from "@/lib/errors"
import { usePartners } from "@/features/contacts"
import { usePartnerMutations } from "../hooks"
import { AddPartnerModal } from "./AddPartnerModal"
import { DividendPaymentModal, EquityTransferModal, SubscriptionMovementModal } from "./EquityMovementModals"
import { MobilizeEarningsWizard } from "./MobilizeEarningsWizard"
import { PartnerContributionWizard } from "./PartnerContributionWizard"
import { PartnerWithdrawalWizard } from "./PartnerWithdrawalWizard"
import type { PartnerActionRequest, PartnerActionRunner } from "./partnerActionRequest"

interface PartnerActionModalProps {
    /** Acción activa (null = ninguna). */
    request: PartnerActionRequest | null
    onClose: () => void
    /** Se llama tras confirmar la baja de un socio (la ficha se cierra, p. ej.). */
    onDemoted?: (partnerId: number) => void
}

/** Monta la superficie (modal / wizard / confirmación) de la acción activa. Un solo estado, cero flags. */
export function PartnerActionModal({ request, onClose, onDemoted }: PartnerActionModalProps) {
    const { partners } = usePartners()
    const { demotePartner } = usePartnerMutations()
    const close = (open: boolean) => { if (!open) onClose() }
    const partnerId = request && "partnerId" in request ? request.partnerId : undefined
    const idStr = partnerId?.toString()

    const demoting = request?.type === "demote" ? partners.find(p => p.id === request.partnerId) : undefined
    const onConfirmDemote = async () => {
        if (request?.type !== "demote") return
        try {
            await demotePartner.mutateAsync(request.partnerId)
            toast.success("Socio dado de baja")
            onDemoted?.(request.partnerId)
        } catch (error: unknown) {
            showApiError(error, "No se pudo dar de baja al socio")
            throw error
        }
    }

    return (
        <>
            <AddPartnerModal
                open={request?.type === "add-partner"}
                onOpenChange={close}
                initialContactId={request?.type === "add-partner" ? request.contactId : undefined}
            />
            <SubscriptionMovementModal
                open={request?.type === "subscription"}
                onOpenChange={close}
                initialPartnerId={request?.type === "subscription" ? idStr : undefined}
                initialAmount={request?.type === "subscription" ? request.amount : undefined}
            />
            <EquityTransferModal
                open={request?.type === "transfer"}
                onOpenChange={close}
                initialFromPartnerId={request?.type === "transfer" ? request.fromPartnerId?.toString() : undefined}
            />
            <PartnerContributionWizard
                open={request?.type === "contribution"}
                onOpenChange={close}
                initialPartnerId={request?.type === "contribution" ? idStr : undefined}
                initialAmount={request?.type === "contribution" ? request.amount : undefined}
                lockAmount={request?.type === "contribution" && !!request.amount}
            />
            <PartnerWithdrawalWizard
                open={request?.type === "withdrawal"}
                onOpenChange={close}
                initialPartnerId={request?.type === "withdrawal" ? idStr : undefined}
            />
            <DividendPaymentModal
                open={request?.type === "dividend"}
                onOpenChange={close}
                initialPartnerId={request?.type === "dividend" ? idStr : undefined}
            />
            <MobilizeEarningsWizard
                open={request?.type === "mobilize"}
                onOpenChange={close}
                initialPartnerId={request?.type === "mobilize" ? request.partnerId : undefined}
            />
            <ActionConfirmModal
                open={request?.type === "demote"}
                onOpenChange={close}
                onConfirm={onConfirmDemote}
                title="Dar de baja al socio"
                description={`${demoting?.name ?? "El socio"} volverá a ser un contacto normal. Solo es posible si no tiene capital suscrito, retiros provisorios, utilidades ni dividendos pendientes; si no, el sistema lo rechazará.`}
                variant="warning"
                confirmText="Dar de baja"
            />
        </>
    )
}

/** Estado + host de acciones de socio: `const { run, host } = usePartnerActions()` y render `{host}`. */
export function usePartnerActions(options: { onDemoted?: (partnerId: number) => void; onClose?: () => void } = {}): { run: PartnerActionRunner; host: ReactNode } {
    const [request, setRequest] = useState<PartnerActionRequest | null>(null)
    return {
        run: setRequest,
        host: <PartnerActionModal request={request} onClose={() => { setRequest(null); options.onClose?.() }} onDemoted={options.onDemoted} />,
    }
}
