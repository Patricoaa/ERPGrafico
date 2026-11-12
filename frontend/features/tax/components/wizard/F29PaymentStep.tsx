"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AlertCircle, Calendar, CheckCircle2, CreditCard, History, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ActionConfirmModal, Chip } from "@/components/shared"
import { PaymentModal } from "@/features/treasury"
import { useServerDate } from "@/hooks/useServerDate"
import { formatCurrency } from "@/lib/money"
import { cn, parseDateOnly } from "@/lib/utils"
import { useAnnulTaxPayment, useCreateTaxPayment } from "../../hooks/useTaxMutations"
import type { TaxDeclaration, TaxPayment, TaxPaymentData } from "../../types"

interface F29PaymentStepProps {
    declaration: TaxDeclaration
    onChanged: () => void
}

/**
 * Paso "Pago" del wizard F29: saldo de la declaración, historial de pagos,
 * anulación y registro de abonos (vía `PaymentModal` de tesorería).
 * Los errores de las mutaciones los muestran sus hooks (`showApiError`).
 */
export function F29PaymentStep({ declaration, onChanged }: F29PaymentStepProps) {
    const [isRegisteringPayment, setIsRegisteringPayment] = useState(false)
    const [paymentToAnnul, setPaymentToAnnul] = useState<number | null>(null)
    const { annulTaxPayment } = useAnnulTaxPayment()
    const { createTaxPayment } = useCreateTaxPayment()
    const { dateString } = useServerDate()

    const pendingAmount = Number(declaration.vat_to_pay) - Number(declaration.total_paid)
    const isFullyPaid = declaration.is_fully_paid || pendingAmount <= 0

    const handleConfirmPayment = async (data: TaxPaymentData) => {
        try {
            await createTaxPayment({
                declaration: declaration.id,
                payment_date: data.documentDate || dateString || "",
                amount: data.amount,
                payment_method: data.paymentMethod,
                reference: data.reference || "",
                treasury_account: data.treasury_account_id,
                notes: `Pago F29 - ${declaration.tax_period_display}`,
            })
        } catch {
            // El hook ya mostró el error; el diálogo de pago queda abierto.
            return
        }
        toast.success("Pago de impuestos registrado correctamente")
        setIsRegisteringPayment(false)
        onChanged()
    }

    return (
        <div className="max-w-4xl mx-auto pb-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-md bg-muted/30 border border-border/50">
                    <div className="text-3xs uppercase font-bold text-muted-foreground tracking-wider mb-1">Impuesto Determinado</div>
                    <div className="text-xl font-bold font-mono">{formatCurrency(declaration.vat_to_pay)}</div>
                </div>
                <div className="p-4 rounded-md bg-success/5 border border-success/10">
                    <div className="text-3xs uppercase font-bold text-success tracking-wider mb-1">Total Pagado</div>
                    <div className="text-xl font-bold text-success font-mono">{formatCurrency(declaration.total_paid)}</div>
                </div>
                <div className={cn(
                    "p-4 rounded-md border",
                    isFullyPaid ? "bg-success/10 border-success/20" : "bg-primary/5 border-primary/10",
                )}>
                    <div className="text-3xs uppercase font-bold text-muted-foreground tracking-wider mb-1">Saldo Pendiente</div>
                    <div className={cn("text-xl font-bold font-mono", isFullyPaid ? "text-success" : "text-primary")}>
                        {formatCurrency(Math.max(0, pendingAmount))}
                    </div>
                </div>
            </div>

            {isFullyPaid ? (
                <div className="flex items-center gap-3 p-4 rounded-md bg-success/5 text-success border border-success/20">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="text-sm font-medium">Esta declaración ha sido pagada en su totalidad.</p>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3 p-4 rounded-md bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-primary" />
                        <p className="text-sm font-medium">Hay un saldo pendiente por pagar.</p>
                    </div>
                    <Button onClick={() => setIsRegisteringPayment(true)} className="bg-success hover:bg-success/90 text-success-foreground">
                        <Plus className="h-4 w-4 mr-2" />
                        Registrar Abono
                    </Button>
                </div>
            )}

            <F29PaymentHistory payments={declaration.payments} onAnnul={setPaymentToAnnul} />

            <ActionConfirmModal
                open={paymentToAnnul !== null}
                onOpenChange={(o) => { if (!o) setPaymentToAnnul(null) }}
                title="Anular pago F29"
                description="Se anulará el egreso en tesorería con su asiento de reversa y el monto volverá a quedar pendiente."
                variant="destructive"
                confirmText="Anular"
                requireReason
                onConfirm={async (reason) => {
                    if (paymentToAnnul === null || !reason) return
                    await annulTaxPayment({ id: paymentToAnnul, reason })
                    setPaymentToAnnul(null)
                    onChanged()
                }}
            />

            <PaymentModal
                open={isRegisteringPayment}
                onOpenChange={setIsRegisteringPayment}
                total={Number(declaration.vat_to_pay)}
                pendingAmount={pendingAmount}
                onConfirm={(data) => { void handleConfirmPayment(data) }}
                title={`Registrar Pago - ${declaration.tax_period_display}`}
                isPurchase={true}
                hideDteFields={true}
            />
        </div>
    )
}

interface F29PaymentHistoryProps {
    payments: TaxPayment[]
    /** Sin `onAnnul` la lista es de solo lectura (período cerrado). */
    onAnnul?: (paymentId: number) => void
}

/** Historial de pagos de una declaración F29; con `onAnnul` ofrece anular cada pago. */
export function F29PaymentHistory({ payments, onAnnul }: F29PaymentHistoryProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground tracking-wider">
                <History className="h-4 w-4" />
                <span>Historial de Pagos</span>
            </div>
            <div className="surface-panel overflow-hidden">
                {payments.length > 0 ? (
                    <div className="divide-y">
                        {payments.map((payment) => (
                            <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center">
                                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <div className="font-bold">{formatCurrency(payment.amount)}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                            <Calendar className="h-3 w-3" />
                                            {format(parseDateOnly(payment.payment_date), "dd MMM yyyy", { locale: es })}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Chip size="xs" intent="neutral">{payment.payment_method_display}</Chip>
                                    {onAnnul && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                            onClick={() => onAnnul(payment.id)}
                                        >
                                            Anular
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-muted-foreground">
                        <p className="text-sm">No se han registrado pagos aún.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
