"use client"

import { useEffect, useState } from "react"
import { Loader2, XCircle, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton"
import { useInitiatePayment } from "../hooks/useInitiatePayment"
import { usePaymentStatus } from "../hooks/usePaymentStatus"
import { treasuryApi } from "../api/treasuryApi"
import type { PaymentRequest } from "../types"

interface TerminalPaymentWizardProps {
    deviceId: number
    amount: number
    saleOrderId?: number
    posSessionId?: number
    onCompleted: (pr: PaymentRequest) => void
    onFailed: (pr?: PaymentRequest) => void
    onCancel: () => void
    onBypass?: () => void
}

type Phase = "initiating" | "waiting" | "completed" | "failed"

const STATUS_LABEL: Record<string, string> = {
    PENDING: "Preparando terminal…",
    SENT: "Esperando confirmación en terminal…",
    PROCESSING: "Procesando pago…",
    COMPLETED: "Pago completado",
    FAILED: "Pago fallido",
    CANCELED: "Pago cancelado",
}

export function TerminalPaymentWizard({
    deviceId,
    amount,
    saleOrderId,
    posSessionId,
    onCompleted,
    onFailed,
    onCancel,
    onBypass,
}: TerminalPaymentWizardProps) {
    const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
    const [phase, setPhase] = useState<Phase>("initiating")
    const [canceling, setCanceling] = useState(false)

    const { initiate } = useInitiatePayment()
    const { paymentRequest, isTerminal } = usePaymentStatus(idempotencyKey)

    // Kick off payment on mount
    useEffect(() => {
        let active = true
        initiate({
            device: deviceId,
            amount,
            sale_order: saleOrderId,
            pos_session: posSessionId,
        })
            .then((pr) => {
                if (!active) return
                if (pr.status === "FAILED") {
                    setPhase("failed")
                    onFailed(pr)
                } else {
                    setIdempotencyKey(pr.idempotency_key)
                    setPhase("waiting")
                }
            })
            .catch(() => {
                if (active) {
                    setPhase("failed")
                    onFailed()
                }
            })
        return () => { active = false }
    }, []) // run once on mount

    // React to terminal status changes
    useEffect(() => {
        if (!paymentRequest || !isTerminal) return
        if (paymentRequest.status === "COMPLETED") {
            setPhase("completed")
            onCompleted(paymentRequest)
        } else {
            setPhase("failed")
            onFailed(paymentRequest)
        }
    }, [isTerminal, paymentRequest])

    const handleCancel = async () => {
        if (!idempotencyKey) {
            onCancel()
            return
        }
        setCanceling(true)
        try {
            await treasuryApi.cancelPaymentRequest(idempotencyKey)
        } catch {
            // CANCEL-INVALID-STATE means already sent to terminal — user must cancel on device
        } finally {
            setCanceling(false)
            onCancel()
        }
    }

    const statusLabel = paymentRequest
        ? STATUS_LABEL[paymentRequest.status] ?? "Procesando…"
        : phase === "initiating"
        ? "Iniciando cobro en terminal…"
        : "Procesando…"

    return (
        <div className="flex flex-col items-center justify-center gap-8 py-4 px-4 text-center">
            {phase === "initiating" || phase === "waiting" ? (
                <>
                    <div className="relative">
                        <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
                        <Loader2 className="h-16 w-16 animate-spin text-primary absolute inset-0 [animation-duration:3s]" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-xl font-heading font-black uppercase tracking-tighter text-foreground">
                            {statusLabel}
                        </h4>
                        <div className="flex justify-center">
                            <span className="font-mono text-lg font-bold bg-primary/5 border border-primary/20 px-4 py-1 rounded-none text-primary">
                                {amount.toLocaleString("es-CL", {
                                    style: "currency",
                                    currency: "CLP",
                                })}
                            </span>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="lg"
                        disabled={canceling}
                        onClick={handleCancel}
                        className="rounded-none font-bold uppercase tracking-widest text-[10px] border-muted-foreground/20 hover:bg-destructive/5 hover:text-destructive transition-colors"
                    >
                        {canceling ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Cancelar cobro
                    </Button>
                </>
            ) : phase === "completed" ? (
                <>
                    <div className="h-16 w-16 rounded-none bg-success/10 border-2 border-success/30 flex items-center justify-center shadow-lg shadow-success/10">
                        <CheckCircle2 className="h-10 w-10 text-success" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-xl font-heading font-black uppercase tracking-tighter text-success">
                            Pago aprobado
                        </h4>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                            Transacción autorizada correctamente
                        </p>
                    </div>
                    <div className="p-4 bg-muted/30 border border-dashed text-xs text-muted-foreground max-w-[280px] leading-relaxed italic">
                        "TUU emitió el comprobante electrónico automáticamente en el dispositivo."
                    </div>
                </>
            ) : (
                <>
                    <div className="h-16 w-16 rounded-none bg-destructive/10 border-2 border-destructive/30 flex items-center justify-center shadow-lg shadow-destructive/10">
                        <XCircle className="h-10 w-10 text-destructive" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-xl font-heading font-black uppercase tracking-tighter text-destructive">
                            Cobro rechazado
                        </h4>
                        {paymentRequest?.failure_reason && (
                            <p className="text-[10px] text-muted-foreground font-mono bg-destructive/5 border border-destructive/10 px-2 py-1 rounded-none">
                                REF: {paymentRequest.failure_reason}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-3 w-full max-w-[320px]">
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                className="flex-1 rounded-none h-12 uppercase font-bold tracking-widest text-xs" 
                                onClick={onCancel}
                            >
                                Detener
                            </Button>
                            <ActionSlideButton
                                className="flex-1 h-12 shadow-lg shadow-primary/20"
                                onClick={() => {
                                    setPhase("initiating")
                                    setIdempotencyKey(null)
                                }}
                            >
                                Reintentar
                            </ActionSlideButton>
                        </div>
                        {onBypass && (
                            <Button 
                                variant="ghost" 
                                className="text-muted-foreground text-[10px] uppercase font-bold tracking-[0.2em] h-auto py-2 hover:bg-muted/50" 
                                onClick={onBypass}
                            >
                                Forzar registro manual
                            </Button>
                        )}
                    </div>
                </>
            )}

            {phase === "waiting" && (
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground bg-muted/50 border-l-4 border-warning px-4 py-3 max-w-[320px] text-left">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                    <span>Para cancelar desde el terminal físico, presiona <strong className="text-foreground">Anular</strong> en el dispositivo.</span>
                </div>
            )}
        </div>
    )
}
