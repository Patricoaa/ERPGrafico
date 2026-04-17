"use client"

import { useCallback, useEffect, useState } from "react"
import axios from "axios"
import { Loader2, XCircle, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton"
import { useInitiatePayment } from "../hooks/useInitiatePayment"
import { usePaymentStatus } from "../hooks/usePaymentStatus"
import { treasuryApi } from "../api/treasuryApi"
import { getErrorMessage } from "@/lib/errors"
import type { PaymentRequest } from "../types"

interface TerminalPaymentWizardProps {
    deviceId: number
    amount: number
    saleOrderId?: number
    posSessionId?: number
    onCompleted: (pr: PaymentRequest) => void
    onFailed: (pr?: PaymentRequest, failureReason?: string) => void
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

function translateFailureReason(code?: string | null): string {
    if (!code) return "Error desconocido"
    if (code === "TIMEOUT") return "Tiempo de espera agotado (sin respuesta del terminal)"
    if (code === "USER-CANCELED") return "Cancelado por el usuario"
    if (code === "CANCEL-INVALID-STATE") return "El pago ya fue enviado al terminal"
    if (code === "RATE-LIMIT" || code === "429") return "Demasiadas solicitudes al terminal. Espera un momento."
    if (code === "401" || code === "UNAUTHORIZED") return "Credenciales del terminal inválidas"
    if (code === "NETWORK") return "No se pudo contactar al terminal"
    if (code.startsWith("MR-")) return `Rechazado por el emisor (${code})`
    if (code.startsWith("RP-")) return `Error del terminal (${code})`
    return `Error de gateway (${code})`
}

function extractErrorCode(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { code?: string } | undefined
        if (data?.code) return data.code
        if (error.response?.status === 429) return "RATE-LIMIT"
        if (error.response?.status === 401) return "401"
        if (!error.response) return "NETWORK"
        return String(error.response.status)
    }
    return "GATEWAY"
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
    // Local failure reason for errors that never create a PaymentRequest
    // (network, auth, rate-limit) OR for surfacing cancel-invalid-state.
    const [localFailureReason, setLocalFailureReason] = useState<string | null>(null)
    const [cancelBlockedMessage, setCancelBlockedMessage] = useState<string | null>(null)

    const { initiate } = useInitiatePayment()
    const { paymentRequest, isTerminal } = usePaymentStatus(idempotencyKey)

    const startInitiation = useCallback(async () => {
        setPhase("initiating")
        setIdempotencyKey(null)
        setLocalFailureReason(null)
        setCancelBlockedMessage(null)
        try {
            const pr = await initiate({
                device: deviceId,
                amount,
                sale_order: saleOrderId,
                pos_session: posSessionId,
            })
            if (pr.status === "FAILED") {
                setPhase("failed")
                onFailed(pr, pr.failure_reason ?? undefined)
            } else {
                setIdempotencyKey(pr.idempotency_key)
                setPhase("waiting")
            }
        } catch (err: unknown) {
            const code = extractErrorCode(err)
            setLocalFailureReason(code)
            setPhase("failed")
            onFailed(undefined, code)
        }
    }, [initiate, deviceId, amount, saleOrderId, posSessionId, onFailed])

    useEffect(() => {
        startInitiation()
    }, [startInitiation])

    useEffect(() => {
        if (!paymentRequest || !isTerminal) return
        if (paymentRequest.status === "COMPLETED") {
            setPhase("completed")
            onCompleted(paymentRequest)
        } else {
            setPhase("failed")
            onFailed(paymentRequest, paymentRequest.failure_reason ?? undefined)
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
            onCancel()
        } catch (err: unknown) {
            const code = extractErrorCode(err)
            if (code === "CANCEL-INVALID-STATE") {
                // Pago ya fue enviado al terminal físico. No cerrar el wizard:
                // el cajero debe anularlo en el dispositivo (botón Anular).
                setCancelBlockedMessage(
                    "No se puede cancelar desde el POS: el pago ya fue enviado al terminal. Presiona Anular en el dispositivo físico para cancelar.",
                )
            } else {
                // Otros errores: mostrar mensaje, cerrar igual para no trabar al cajero.
                setLocalFailureReason(code)
                onCancel()
            }
        } finally {
            setCanceling(false)
        }
    }

    const displayFailureCode = paymentRequest?.failure_reason ?? localFailureReason ?? undefined
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
                    {cancelBlockedMessage && (
                        <div className="flex items-start gap-3 text-[11px] text-destructive bg-destructive/5 border-l-4 border-destructive px-4 py-3 max-w-[320px] text-left">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                            <span>{cancelBlockedMessage}</span>
                        </div>
                    )}
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
                    <div className="space-y-2">
                        <h4 className="text-xl font-heading font-black uppercase tracking-tighter text-destructive">
                            Cobro rechazado
                        </h4>
                        <p className="text-xs text-muted-foreground max-w-[300px] leading-relaxed">
                            {translateFailureReason(displayFailureCode)}
                        </p>
                        {displayFailureCode && (
                            <p className="text-[10px] text-muted-foreground/70 font-mono bg-destructive/5 border border-destructive/10 px-2 py-1 rounded-none inline-block">
                                REF: {displayFailureCode}
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
                                onClick={startInitiation}
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

            {phase === "waiting" && !cancelBlockedMessage && (
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground bg-muted/50 border-l-4 border-warning px-4 py-3 max-w-[320px] text-left">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                    <span>Para cancelar desde el terminal físico, presiona <strong className="text-foreground">Anular</strong> en el dispositivo.</span>
                </div>
            )}
        </div>
    )
}
