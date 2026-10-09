"use client"

import { Button } from "@/components/ui/button"
import { useTouchMode } from '@/hooks/useTouchMode'
import { cn } from "@/lib/utils"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

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
            <div className="bg-card border border-border/60 rounded-sm p-4 mb-4">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-sm bg-success/10 shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold uppercase tracking-tight text-xs text-primary">
                            Crédito Aprobado
                        </p>
                        <p className="text-sm text-success-foreground/80 leading-relaxed mt-0.5">
                            La venta ha sido autorizada. Puedes continuar con el cobro.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const isWaiting = state === 'waiting'

    return (
        <div className="bg-card border border-border/60 rounded-sm p-4 mb-4">
            <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-sm bg-warning/10 shrink-0">
                    {isWaiting ? (
                        <Loader2 className="h-5 w-5 text-warning animate-spin motion-reduce:animate-none" />
                    ) : (
                        <AlertCircle className="h-5 w-5 text-warning" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-bold uppercase tracking-tight text-xs text-primary">
                        {isWaiting ? "Esperando Autorización..." : "Autorización Requerida"}
                    </p>
                    <p className="text-sm text-warning-foreground/80 leading-relaxed mt-0.5">
                        {isWaiting
                            ? "Solicitud enviada al supervisor — verificando estado..."
                            : reason}
                    </p>
                </div>

                <div className={cn(
                    "flex items-start gap-2 shrink-0",
                    isTouchMode ? "gap-3" : "gap-2"
                )}>
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
            </div>
        </div>
    )
}
