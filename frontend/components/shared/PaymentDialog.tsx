"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CreditCard, Banknote, Landmark, Receipt, Hash, ClipboardCheck, Calendar, FileUp, FileText, User } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Wallet, AlertCircle, Building2 } from "lucide-react"
import { useTreasuryAccounts } from "@/hooks/useTreasuryAccounts"
import { FORM_STYLES } from "@/lib/styles"
import { cn, formatCurrency } from "@/lib/utils"
import api from "@/lib/api"
import { PaymentMethodCardSelector, PaymentData } from "@/components/shared/PaymentMethodCardSelector"

interface PaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    total: number
    pendingAmount: number
    onConfirm: (data: {
        paymentMethod: string,
        amount: number,
        dteType?: string,
        reference?: string,
        transaction_number?: string,
        is_pending_registration?: boolean,
        treasury_account_id?: string | null,
        payment_method_new?: string | null,
        documentReference?: string,
        documentDate?: string,
        documentAttachment?: File | null
    }) => void
    showDteSelector?: boolean
    hideDteFields?: boolean
    isPurchase?: boolean
    isRefund?: boolean
    existingInvoice?: {
        dte_type: string
        number: string
        document_attachment: string | null
    } | null
    title?: string
}

export function PaymentDialog({
    open,
    onOpenChange,
    total,
    pendingAmount,
    onConfirm,
    showDteSelector = false,
    hideDteFields = false,
    isPurchase = false,
    isRefund = false,
    existingInvoice = null,
    title
}: PaymentDialogProps) {
    const [dteType, setDteType] = useState("NONE")
    const [documentReference, setDocumentReference] = useState("")
    const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0])
    const [documentAttachment, setDocumentAttachment] = useState<File | null>(null)
    const [isDocumentPending, setIsDocumentPending] = useState(false)

    // Payment data managed by PaymentMethodCardSelector
    const [paymentData, setPaymentData] = useState<PaymentData>({
        method: null,
        amount: pendingAmount,
        treasuryAccountId: null,
        paymentMethodId: null,
        transactionNumber: '',
        isPending: false
    })

    // Reset payment data when modal opens
    useEffect(() => {
        if (open) {
            setPaymentData({
                method: null,
                amount: pendingAmount,
                treasuryAccountId: null,
                paymentMethodId: null,
                transactionNumber: '',
                isPending: false
            })
            setDocumentReference(existingInvoice?.number || "")
            setDocumentDate(new Date().toISOString().split('T')[0])
            setDocumentAttachment(null)
            setIsDocumentPending(false)

            if (existingInvoice) {
                setDteType(existingInvoice.dte_type)
            } else {
                setDteType(isPurchase ? "NONE" : "BOLETA")
            }
        }
    }, [open, pendingAmount, isPurchase, existingInvoice])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="xs">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Banknote className="h-5 w-5" />
                        {title || (isRefund ? "Registrar Reembolso / Devolución" : "Registrar Pago")}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div className="relative overflow-hidden p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl border border-primary/10 shadow-inner">
                        <div className="flex justify-between items-center relative z-10">
                            <div>
                                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-primary/70 mb-1">Monto de la Orden</p>
                                <p className="text-sm font-bold text-muted-foreground opacity-80">{formatCurrency(total)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-primary/70 mb-1">
                                    {isRefund ? "Total a Reembolsar" : "Saldo Pendiente"}
                                </p>
                                <p className="text-4xl font-black text-primary tracking-tighter drop-shadow-sm">
                                    {formatCurrency(pendingAmount)}
                                </p>
                            </div>
                        </div>
                        {/* Abstract background elements */}
                        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
                    </div>

                    <div className="grid gap-4">
                        {showDteSelector && !hideDteFields && (
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2 text-[11px] font-bold uppercase text-muted-foreground">
                                    <Receipt className="h-3 w-3" />
                                    {isPurchase ? "Documento Recibido" : "Documento a Emitir"}
                                </Label>
                                <Select value={dteType} onValueChange={setDteType} disabled={!!existingInvoice}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isPurchase ? (
                                            <>
                                                <SelectItem value="NONE">Aún no he recibido el documento</SelectItem>
                                                <SelectItem value="BOLETA">Boleta Electrónica</SelectItem>
                                                <SelectItem value="FACTURA">Factura Electrónica</SelectItem>
                                            </>
                                        ) : (
                                            <>
                                                <SelectItem value="BOLETA">Emitiré una boleta</SelectItem>
                                                <SelectItem value="FACTURA">Emitiré una factura</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                                {existingInvoice && (
                                    <p className="text-[10px] text-amber-600 font-medium">
                                        * Documento ya registrado anteriormente
                                    </p>
                                )}
                            </div>
                        )}

                        {!hideDteFields && ((isPurchase && (dteType === "BOLETA" || dteType === "FACTURA")) || (!isPurchase && dteType === "FACTURA")) && (
                            <div className={cn("space-y-4 p-4", FORM_STYLES.card)}>
                                {dteType === 'FACTURA' && (
                                    <div className="flex items-center space-x-2 py-1">
                                        <Checkbox
                                            id="pending-doc-check"
                                            checked={isDocumentPending}
                                            onCheckedChange={(checked: boolean) => setIsDocumentPending(!!checked)}
                                        />
                                        <Label htmlFor="pending-doc-check" className="text-xs font-bold cursor-pointer">
                                            {isPurchase
                                                ? "Aún no recibo el documento físico / digital"
                                                : "Emitiré la factura luego"
                                            }
                                        </Label>
                                    </div>
                                )}

                                <div className={`grid gap-2 ${isDocumentPending ? 'opacity-50' : ''}`}>
                                    <Label className="text-[10px] font-bold uppercase flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Fecha de Emisión
                                    </Label>
                                    <Input
                                        type="date"
                                        className="h-9"
                                        value={documentDate}
                                        onChange={(e) => setDocumentDate(e.target.value)}
                                        disabled={isDocumentPending}
                                    />
                                </div>

                                <div className={`grid gap-2 ${isDocumentPending ? 'opacity-50' : ''}`}>
                                    <Label className="text-[10px] font-bold uppercase flex items-center gap-1">
                                        <Hash className="h-3 w-3" /> N° de Folio / Referencia {isPurchase && <span className="text-destructive">*</span>}
                                    </Label>
                                    <Input
                                        placeholder="Ej: 12345"
                                        value={documentReference}
                                        onChange={(e) => setDocumentReference(e.target.value)}
                                        disabled={!!existingInvoice || isDocumentPending}
                                    />
                                </div>

                                <div className={`grid gap-2 ${isDocumentPending ? 'opacity-50' : ''}`}>
                                    <Label className="text-[10px] font-bold uppercase flex items-center gap-1">
                                        <FileUp className="h-3 w-3" />
                                        {existingInvoice ? "Documento Adjunto" : "Adjuntar Documento (Opcional)"}
                                    </Label>
                                    {!existingInvoice ? (
                                        <div className="flex gap-2">
                                            <Input
                                                type="file"
                                                onChange={(e) => setDocumentAttachment(e.target.files?.[0] || null)}
                                                className="text-xs h-9 py-1 cursor-pointer"
                                                disabled={isDocumentPending}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs text-blue-600 font-medium p-2 bg-blue-50 rounded border border-blue-100">
                                            <Receipt className="h-4 w-4" />
                                            <span>Documento cargado</span>
                                            {existingInvoice.document_attachment && (
                                                <a href={existingInvoice.document_attachment} target="_blank" rel="noreferrer" className="ml-auto underline">
                                                    Ver
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Payment Method Card Selector */}
                        <PaymentMethodCardSelector
                            operation={isPurchase ? 'purchases' : 'sales'}
                            total={pendingAmount}
                            paymentData={paymentData}
                            onPaymentDataChange={setPaymentData}
                            labels={{
                                totalLabel: isRefund ? 'Total a Reembolsar' : (isPurchase ? 'Total a Pagar' : 'Total a Cobrar'),
                                amountLabel: isRefund ? 'Monto a Reembolsar' : (isPurchase ? 'Monto a Pagar' : 'Monto Recibido'),
                                differencePositiveLabel: isRefund ? 'Diferencia a favor' : 'Vuelto',
                                differenceNegativeLabel: 'Deuda Pendiente',
                                amountModalTitle: isRefund ? 'Monto a Reembolsar' : (isPurchase ? 'Monto a Pagar' : 'Monto Recibido'),
                                amountModalDescription: isRefund
                                    ? 'Ingrese el monto a reembolsar.'
                                    : (isPurchase ? 'Ingrese el monto a pagar.' : 'Ingrese el monto recibido.')
                            }}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
                    <Button
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold"
                        onClick={() => onConfirm({
                            paymentMethod: paymentData.amount === 0 ? 'CREDIT' : paymentData.method || 'CASH',
                            amount: paymentData.amount,
                            dteType: (showDteSelector && dteType !== 'NONE') ? dteType : undefined,
                            documentReference: (dteType !== 'NONE') ? documentReference : undefined,
                            documentDate: (dteType !== 'NONE') ? documentDate : undefined,
                            documentAttachment: (dteType !== 'NONE') ? documentAttachment : undefined,
                            transaction_number: paymentData.amount === 0 ? undefined : paymentData.transactionNumber,
                            is_pending_registration: paymentData.isPending,
                            treasury_account_id: paymentData.amount === 0 ? null : paymentData.treasuryAccountId,
                            payment_method_new: paymentData.amount === 0 ? null : paymentData.paymentMethodId?.toString()
                        })}
                        disabled={
                            (paymentData.amount < 0) ||
                            (paymentData.amount > 0 && !paymentData.treasuryAccountId) ||
                            ((!hideDteFields && isPurchase && (dteType === 'BOLETA' || dteType === 'FACTURA') && !existingInvoice && !documentReference)) ||
                            ((hideDteFields && isPurchase && (dteType === 'BOLETA' || dteType === 'FACTURA') && !!existingInvoice && !documentReference)) ||
                            ((paymentData.method === 'TRANSFER') && !paymentData.isPending && !paymentData.transactionNumber && paymentData.amount > 0)
                        }
                    >
                        {isRefund ? 'Confirmar Reembolso' : 'Confirmar Pago'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
