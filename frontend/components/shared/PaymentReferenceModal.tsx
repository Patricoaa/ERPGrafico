"use client"

import { useState } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Hash, Landmark, CreditCard, Save, Loader2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { FORM_STYLES } from "@/lib/styles"
import { cn, formatPlainDate } from "@/lib/utils"

interface PaymentReferenceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    payments: any[]
    onSuccess: () => void
}

export function PaymentReferenceModal({
    open,
    onOpenChange,
    payments,
    onSuccess
}: PaymentReferenceModalProps) {
    // Filter payments that need a reference (TRANSFER or CARD with missing info)
    const pendingPayments = payments?.filter((p: any) => {
        const method = p.payment_method?.toUpperCase()
        const isTransferOrCard = method === 'TRANSFER' || method === 'CARD' || method === 'BANK'
        const hasNoRef = !p.transaction_number || p.transaction_number === "" || p.transaction_number === "null"
        return isTransferOrCard && (p.is_pending_registration || hasNoRef)
    }) || []

    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(
        pendingPayments.length > 0 ? pendingPayments[0].id : null
    )
    const [transactionNumber, setTransactionNumber] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSave = async () => {
        if (!selectedPaymentId || !transactionNumber) return

        setLoading(true)
        try {
            await api.patch(`/treasury/payments/${selectedPaymentId}/`, {
                transaction_number: transactionNumber,
                is_pending_registration: false
            })
            toast.success("N° de operación registrado correctamente")
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            console.error("Error updating payment reference:", error)
            toast.error("Error al registrar el número de operación")
        } finally {
            setLoading(false)
        }
    }

    const selectedPayment = pendingPayments.find(p => p.id === selectedPaymentId)

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <span className="flex items-center gap-2">
                    <Hash className="h-5 w-5" />
                    Registrar N° Operación
                </span>
            }
            size="xs"
            footer={(
                <div className="flex w-full gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
                    <Button
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold"
                        onClick={handleSave}
                        disabled={loading || !selectedPaymentId || !transactionNumber}
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Guardar Registro"}
                    </Button>
                </div>
            )}
        >
            <div className="py-2 space-y-6">
                {pendingPayments.length > 1 && (
                    <div className="grid gap-2">
                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">Seleccionar Pago</Label>
                        <div className="flex flex-col gap-2">
                            {pendingPayments.map((p) => (
                                <Button
                                    key={p.id}
                                    variant={selectedPaymentId === p.id ? "default" : "outline"}
                                    className="justify-start h-auto py-3 px-4 flex flex-col items-start gap-1"
                                    onClick={() => setSelectedPaymentId(p.id)}
                                >
                                    <div className="flex w-full justify-between items-center">
                                        <span className="font-bold">${Number(p.amount).toLocaleString()}</span>
                                        <Badge variant="outline" className="text-[10px]">
                                            {p.payment_method === 'BANK' || p.payment_method === 'TRANSFER' ? 'Transferencia' : 'Tarjeta'}
                                        </Badge>
                                    </div>
                                    <span className="text-[10px] opacity-70">{formatPlainDate(p.date || p.created_at)}</span>
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {selectedPayment && (
                    <div className="space-y-4">
                        <div className={cn("flex items-center gap-4 p-4", FORM_STYLES.card)}>
                            <div className="p-3 bg-white dark:bg-zinc-900 rounded-full shadow-sm">
                                {selectedPayment.payment_method === 'TRANSFER' ? (
                                    <Landmark className="h-6 w-6 text-blue-600" />
                                ) : (
                                    <CreditCard className="h-6 w-6 text-emerald-600" />
                                )}
                            </div>
                            <div>
                                <div className="text-lg font-black">${Number(selectedPayment.amount).toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground uppercase font-bold">
                                    Pago de {formatPlainDate(selectedPayment.date || selectedPayment.created_at)}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                <Hash className="h-3 w-3" /> Número de Folio / Operación / Voucher
                            </Label>
                            <Input
                                placeholder="Ej: 99884455"
                                value={transactionNumber}
                                onChange={(e) => setTransactionNumber(e.target.value)}
                                className={cn(FORM_STYLES.input, "text-lg font-bold h-12")}
                                autoFocus
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                * Esto completará el registro del pago y lo marcará como validado.
                            </p>
                        </div>
                    </div>
                )}

                {pendingPayments.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground italic text-sm">
                        No hay pagos pendientes de registro para esta orden.
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
