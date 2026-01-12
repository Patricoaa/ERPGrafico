"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, CreditCard } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

interface TuuPaymentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    amount: number
    treasuryAccountId: number
    onSuccess: (transactionData: any) => void
}

export function TuuPaymentModal({ open, onOpenChange, amount, treasuryAccountId, onSuccess }: TuuPaymentModalProps) {
    const [step, setStep] = useState<'IDLE' | 'INITIATING' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE')
    const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
    const [errorMsg, setErrorMsg] = useState("")

    // Reset state on open
    useEffect(() => {
        if (open && step === 'IDLE') {
            initiatePayment()
        }
    }, [open])

    const initiatePayment = async () => {
        setStep('INITIATING')
        setErrorMsg("")
        try {
            const res = await api.post('/treasury/tuu/initiate/', {
                treasury_account_id: treasuryAccountId,
                amount: amount
            })

            if (res.data.success || res.data.idempotencyKey) {
                setIdempotencyKey(res.data.idempotencyKey)
                setStep('PROCESSING')
            } else {
                throw new Error("Respuesta inválida del servidor")
            }
        } catch (error: any) {
            console.error(error)
            setStep('ERROR')
            setErrorMsg(error.response?.data?.error || "Error al iniciar pago")
        }
    }

    // Polling effect
    useEffect(() => {
        let interval: NodeJS.Timeout

        if (step === 'PROCESSING' && idempotencyKey) {
            interval = setInterval(async () => {
                try {
                    const res = await api.get(`/treasury/tuu/status/${idempotencyKey}/`, {
                        params: { treasury_account_id: treasuryAccountId }
                    })

                    const status = res.data.status

                    if (status === 'COMPLETED' || status === 'APPROVED') { // Tuu docs say 'COMPLETED'
                        setStep('SUCCESS')
                        clearInterval(interval)
                        // Wait a moment before closing/callback
                        setTimeout(() => {
                            onSuccess(res.data)
                        }, 1500)
                    } else if (status === 'FAILED' || status === 'CANCELED' || status === 'REJECTED') {
                        setStep('ERROR')
                        setErrorMsg(res.data.responseDescription || "Pago rechazado o cancelado")
                        clearInterval(interval)
                    }
                    // If PENDING, SENT, PROCESSING -> continue polling
                } catch (error) {
                    console.error("Polling error", error)
                    // Don't stop polling on network temporary error?
                    // Maybe check retry count? For now keep retrying.
                }
            }, 2000) // Poll every 2 seconds
        }

        return () => clearInterval(interval)
    }, [step, idempotencyKey, treasuryAccountId])

    const handleClose = () => {
        if (step === 'PROCESSING') {
            if (!confirm("El pago está en proceso. ¿Seguro que desea cancelar la espera? (Esto no cancela el cobro en la máquina)")) {
                return
            }
        }
        setStep('IDLE')
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pago con Tuu</DialogTitle>
                    <DialogDescription>
                        Siga las instrucciones en el terminal de pago.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    {step === 'INITIATING' && (
                        <>
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Iniciando conexión con el terminal...</p>
                        </>
                    )}

                    {step === 'PROCESSING' && (
                        <>
                            <CreditCard className="h-12 w-12 text-blue-500 animate-pulse" />
                            <p className="text-lg font-bold">¡Acerque tarjeta!</p>
                            <p className="text-sm text-muted-foreground">Esperando respuesta del terminal (Monto: ${amount.toLocaleString('es-CL')})</p>
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-2" />
                        </>
                    )}

                    {step === 'SUCCESS' && (
                        <>
                            <CheckCircle2 className="h-16 w-16 text-green-500" />
                            <p className="text-lg font-bold text-green-600">¡Pago Aprobado!</p>
                        </>
                    )}

                    {step === 'ERROR' && (
                        <>
                            <XCircle className="h-16 w-16 text-destructive" />
                            <p className="text-lg font-bold text-destructive">Error en Pago</p>
                            <p className="text-sm text-center text-muted-foreground px-4">{errorMsg}</p>
                            <Button variant="outline" onClick={initiatePayment} className="mt-4">
                                Reintentar
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
