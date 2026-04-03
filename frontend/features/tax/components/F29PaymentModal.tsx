"use client"

import { useState } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DollarSign,
    Calendar,
    History,
    ArrowRight,
    CheckCircle2,
    CreditCard,
    AlertCircle
} from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { PaymentDialog } from "@/features/treasury/components/PaymentDialog"
import { TaxDeclaration } from "../types"

interface F29PaymentModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    declaration: TaxDeclaration
    onConfirmPayment: (data: any) => Promise<void>
}

export function F29PaymentModal({
    isOpen,
    onOpenChange,
    declaration,
    onConfirmPayment
}: F29PaymentModalProps) {
    const [isRegisteringPayment, setIsRegisteringPayment] = useState(false)

    const pendingAmount = Number(declaration.vat_to_pay) - Number(declaration.total_paid)
    const isFullyPaid = declaration.is_fully_paid || pendingAmount <= 0

    return (
        <>
            <BaseModal
                open={isOpen}
                onOpenChange={onOpenChange}
                title={
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-success" />
                        <span>Pagos F29 - {declaration.tax_period_display}</span>
                    </div>
                }
                size="lg"
            >
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Impuesto Determinado</div>
                            <div className="text-xl font-bold font-mono">{formatCurrency(declaration.vat_to_pay)}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-success/5 border border-success/10">
                            <div className="text-[10px] uppercase font-bold text-success tracking-wider mb-1">Total Pagado</div>
                            <div className="text-xl font-bold text-success font-mono">{formatCurrency(declaration.total_paid)}</div>
                        </div>
                        <div className={cn(
                            "p-4 rounded-2xl border",
                            isFullyPaid
                                ? "bg-success/10 border-success/20"
                                : "bg-primary/5 border-primary/10"
                        )}>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Salgo Pendiente</div>
                            <div className={cn(
                                "text-xl font-bold font-mono",
                                isFullyPaid ? "text-success" : "text-primary"
                            )}>
                                {formatCurrency(Math.max(0, pendingAmount))}
                            </div>
                        </div>
                    </div>

                    {/* Status Alert */}
                    {isFullyPaid ? (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-success/5 text-success border border-success/20">
                            <CheckCircle2 className="h-5 w-5" />
                            <p className="text-sm font-medium">Esta declaración ha sido pagada en su totalidad.</p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-primary" />
                                <p className="text-sm font-medium">Hay un saldo pendiente por pagar.</p>
                            </div>
                            <Button
                                onClick={() => setIsRegisteringPayment(true)}
                                className="bg-success hover:bg-success/90"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Registrar Abono
                            </Button>
                        </div>
                    )}

                    {/* Payment History */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground tracking-wider">
                            <History className="h-4 w-4" />
                            <span>Historial de Pagos</span>
                        </div>

                        <div className="border rounded-2xl overflow-hidden bg-card">
                            {declaration.payments.length > 0 ? (
                                <div className="divide-y">
                                    {declaration.payments.map((payment) => (
                                        <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <div className="font-bold">{formatCurrency(payment.amount)}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        <Calendar className="h-3 w-3" />
                                                        {format(new Date(payment.payment_date), "dd MMM yyyy", { locale: es })}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                                {payment.payment_method_display}
                                            </Badge>
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
                </div>
            </BaseModal>

            {/* New Payment Dialog */}
            <PaymentDialog
                open={isRegisteringPayment}
                onOpenChange={setIsRegisteringPayment}
                total={Number(declaration.vat_to_pay)}
                pendingAmount={pendingAmount}
                onConfirm={async (data) => {
                    await onConfirmPayment(data)
                    setIsRegisteringPayment(false)
                }}
                title={`Registrar Pago - ${declaration.tax_period_display}`}
                isPurchase={true}
                hideDteFields={true}
            />
        </>
    )
}

function Plus({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    )
}
