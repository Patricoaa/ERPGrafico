"use client"

import { ApprovalRequestBanner } from "@/components/shared"

interface POSApprovalCardProps {
    state: 'required' | 'waiting' | 'approved'
    reason: string | null
    canDirectApprove?: boolean
    approvalTaskId: number | null
    onAdjust: () => void
    onDirectApprove: () => void
    onRequest: () => void
    onCancel: () => void
    onVerify: (taskId: number) => void
}

export function POSApprovalCard({
    state,
    reason,
    canDirectApprove = false,
    approvalTaskId,
    onAdjust,
    onDirectApprove,
    onRequest,
    onCancel,
    onVerify,
}: POSApprovalCardProps) {
    const description =
        state === 'waiting'
            ? "Solicitud enviada al supervisor — verificando estado…"
            : state === 'approved'
              ? "La venta ha sido autorizada. Puedes continuar con el cobro."
              : (reason ?? undefined)

    return (
        <ApprovalRequestBanner
            state={state}
            title={state === 'approved' ? "Crédito Aprobado" : undefined}
            description={description}
            canDirectApprove={canDirectApprove}
            approvalTaskId={approvalTaskId}
            onAdjust={onAdjust}
            onDirectApprove={onDirectApprove}
            onRequest={onRequest}
            onCancel={onCancel}
            onVerify={approvalTaskId ? () => onVerify(approvalTaskId) : undefined}
            className="mb-4"
        />
    )
}
