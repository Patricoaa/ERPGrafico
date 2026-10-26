"use client"

import { Button } from "@/components/ui/button"
import { useTouchMode } from '@/hooks/useTouchMode'
import { cn } from "@/lib/utils"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { InfoBlock } from "@/components/shared"

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
    const { isTouchMode } = useTouchMode()

    if (state === 'approved') {
        return (
            <InfoBlock tone="success" icon={CheckCircle2} title="Crédito Aprobado" className="mb-4">
                La venta ha sido autorizada. Puedes continuar con el cobro.
            </InfoBlock>
        )
    }

    const isWaiting = state === 'waiting'

    return (
        <InfoBlock
            tone="warning"
            icon={isWaiting ? Loader2 : AlertCircle}
            iconClassName={isWaiting ? "animate-spin motion-reduce:animate-none" : undefined}
            title={isWaiting ? "Esperando Autorización..." : "Autorización Requerida"}
            className="mb-4"
            actions={
                <div className={cn("flex items-start", isTouchMode ? "gap-3" : "gap-2")}>
                    {isWaiting ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={onCancel}
                                    className={cn(
                                        "rounded-sm font-medium uppercase tracking-tight",
                                    isTouchMode ? "h-11 text-sm" : "h-11 text-sm"
                                )}
                            >
                                Cancelar
                            </Button>
                            {approvalTaskId && (
                                <Button
                                    variant="outline"
                                    onClick={() => onVerify(approvalTaskId)}
                                    className={cn(
                                        "rounded-sm font-medium uppercase tracking-tight shadow-card border-border/60",
                                        isTouchMode ? "h-11 text-sm" : "h-11 text-sm"
                                    )}
                                >
                                    Verificar
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={onAdjust}
                                className={cn(
                                    "rounded-sm font-medium uppercase tracking-tight shadow-card border-border/60",
                                    isTouchMode ? "h-11 text-sm" : "h-11 text-sm"
                                )}
                            >
                                Ajustar
                            </Button>
                            {canDirectApprove && (
                                <Button
                                    onClick={onDirectApprove}
                                    className={cn(
                                        "rounded-sm font-medium uppercase tracking-tight shadow-card border-none bg-primary hover:bg-primary/90 text-primary-foreground",
                                        isTouchMode ? "h-11 text-sm" : "h-11 text-sm"
                                    )}
                                >
                                    Aprobar
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={onRequest}
                                className={cn(
                                    "rounded-sm font-medium uppercase tracking-tight shadow-card border-border/60",
                                    isTouchMode ? "h-11 text-sm" : "h-11 text-sm"
                                )}
                            >
                                Solicitar
                            </Button>
                        </>
                    )}
                </div>
            }
        >
            {isWaiting ? "Solicitud enviada al supervisor — verificando estado..." : reason}
        </InfoBlock>
    )
}
