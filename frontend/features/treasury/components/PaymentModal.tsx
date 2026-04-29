"use client"

import { useState, useEffect } from "react"
import { BaseModal, LabeledInput, LabeledSelect, DocumentAttachmentDropzone, PeriodValidationDateInput, LoadingFallback } from "@/components/shared"
import { CancelButton } from "@/components/shared/ActionButtons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { CreditCard, Banknote, Landmark, Receipt, Hash, ClipboardCheck, Calendar, FileUp, FileText, User, Wallet, AlertCircle, Building2, ShieldAlert } from "lucide-react"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import { PaymentMethodCardSelector, PaymentData } from "@/features/treasury/components/PaymentMethodCardSelector"
import { useServerDate } from "@/hooks/useServerDate"

interface PaymentModalProps {
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
    posSessionId?: number | null
    customerCreditBalance?: number
    allowCreditBalanceAccumulation?: boolean
}

export function PaymentModal({
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
    title,
    posSessionId = null,
    customerCreditBalance = 0,
    allowCreditBalanceAccumulation = false
}: PaymentModalProps) {
    const { dateString } = useServerDate()
    const [dteType, setDteType] = useState("NONE")
    const [documentReference, setDocumentReference] = useState("")
    const [documentDate, setDocumentDate] = useState("")

    const [isPeriodValid, setIsPeriodValid] = useState(true)

    // Sync document date with server date
    useEffect(() => {
        if (dateString && !documentDate) {
            requestAnimationFrame(() => setDocumentDate(dateString))
        }
    }, [dateString])

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

    const [terminalId, setTerminalId] = useState<number | null>(null)

    // Reset payment data when modal opens
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                setPaymentData({
                    method: null,
                    amount: pendingAmount,
                    treasuryAccountId: null,
                    paymentMethodId: null,
                    transactionNumber: '',
                    isPending: false
                })
                setDocumentReference(existingInvoice?.number || "")
                if (dateString) setDocumentDate(dateString)
                setDocumentAttachment(null)
                setIsDocumentPending(false)
                setIsPeriodValid(true)

                if (existingInvoice) {
                    setDteType(existingInvoice.dte_type)
                } else {
                    setDteType(isPurchase ? "NONE" : "BOLETA")
                }
            })
        }
    }, [open, pendingAmount, isPurchase, existingInvoice, dateString])

    // Fetch terminal from POS session
    useEffect(() => {
        if (posSessionId) {
            api.get(`/treasury/pos-sessions/${posSessionId}/`)
                .then(response => {
                    requestAnimationFrame(() => setTerminalId(response.data.terminal || null))
                })
                .catch(error => {
                    console.error('Error fetching POS session:', error)
                })
        } else {
            requestAnimationFrame(() => setTerminalId(null))
        }
    }, [posSessionId])

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <span className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    {title || (isRefund ? "Registrar Reembolso / Devolución" : "Registrar Pago")}
                </span>
            }
            size="lg"
            footer={(
                <div className="flex w-full gap-2">
                    <CancelButton onClick={() => onOpenChange(false)} className="flex-1" />
                    <Button
                        className="flex-[2] bg-success hover:bg-success/90 h-12 text-lg font-bold"
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
                            ((!hideDteFields && isPurchase && (dteType === 'BOLETA' || dteType === 'FACTURA') && !existingInvoice && !documentReference && !isDocumentPending)) ||
                            ((hideDteFields && isPurchase && (dteType === 'BOLETA' || dteType === 'FACTURA') && !!existingInvoice && !documentReference)) ||
                            ((paymentData.method === 'TRANSFER') && !paymentData.isPending && !paymentData.transactionNumber && paymentData.amount > 0) ||
                            (!hideDteFields && dteType === 'FACTURA' && !existingInvoice && !isDocumentPending && !documentAttachment) ||
                            ((dteType === 'BOLETA' || dteType === 'FACTURA') && !isPeriodValid)
                        }
                    >
                        {isRefund ? 'Confirmar Reembolso' : 'Confirmar Pago'}
                    </Button>
                </div>
            )}
        >
            <div className="py-2 space-y-6">
                <div className="grid gap-4">
                    {showDteSelector && !hideDteFields && (
                        <div className="grid gap-2">
                            <LabeledSelect
                                label={
                                    <span className="flex items-center gap-2">
                                        <Receipt className="h-3 w-3" />
                                        {isPurchase ? "Documento Recibido" : "Documento a Emitir"}
                                    </span>
                                }
                                value={dteType}
                                onChange={setDteType}
                                disabled={!!existingInvoice}
                                options={isPurchase ? [
                                    { value: "NONE", label: "Aún no he recibido el documento" },
                                    { value: "BOLETA", label: "Boleta Electrónica" },
                                    { value: "FACTURA", label: "Factura Electrónica" }
                                ] : [
                                    { value: "BOLETA", label: "Emitiré una boleta" },
                                    { value: "FACTURA", label: "Emitiré una factura" }
                                ]}
                            />
                            {existingInvoice && (
                                <p className="text-[10px] text-warning font-medium px-1">
                                    * Documento ya registrado anteriormente
                                </p>
                            )}
                        </div>
                    )}

                    {!hideDteFields && ((isPurchase && (dteType === "BOLETA" || dteType === "FACTURA")) || (!isPurchase && dteType === "FACTURA")) && (
                        <Card variant="dashed" className="space-y-4 p-4">
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
                                <div>
                                    <PeriodValidationDateInput
                                        date={documentDate ? new Date(documentDate + 'T12:00:00') : undefined}
                                        onDateChange={(d) => {
                                            if (d) {
                                                const year = d.getFullYear()
                                                const month = String(d.getMonth() + 1).padStart(2, '0')
                                                const day = String(d.getDate()).padStart(2, '0')
                                                setDocumentDate(`${year}-${month}-${day}`)
                                            } else {
                                                setDocumentDate("")
                                            }
                                        }}
                                        disabled={isDocumentPending}
                                        validationType="both"
                                        onValidityChange={setIsPeriodValid}
                                    />
                                </div>
                            </div>

                            <div className={`grid gap-2 ${isDocumentPending ? 'opacity-50' : ''}`}>
                                <LabeledInput
                                    label={
                                        <span className="flex items-center gap-1">
                                            <Hash className="h-3 w-3" /> N° de Folio / Referencia {isPurchase && <span className="text-destructive">*</span>}
                                        </span>
                                    }
                                    placeholder="Ej: 12345"
                                    value={documentReference}
                                    onChange={(e) => setDocumentReference(e.target.value)}
                                    disabled={!!existingInvoice || isDocumentPending}
                                />
                            </div>

                            <div className={cn("grid gap-2", isDocumentPending && "opacity-50")}>
                                {!existingInvoice ? (
                                    <DocumentAttachmentDropzone
                                        file={documentAttachment}
                                        onFileChange={setDocumentAttachment}
                                        dteType={dteType}
                                        isPending={isDocumentPending}
                                        disabled={isDocumentPending}
                                    />
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-[10px] font-bold uppercase flex items-center gap-1">
                                            <FileUp className="h-3 w-3" /> Documento Adjunto
                                        </Label>
                                        <div className="flex items-center gap-2 text-xs text-primary font-medium p-2 bg-primary/5 rounded border border-primary/20">
                                            <Receipt className="h-4 w-4" />
                                            <span>Documento cargado</span>
                                            {existingInvoice.document_attachment && (
                                                <a href={existingInvoice.document_attachment} target="_blank" rel="noreferrer" className="ml-auto underline">
                                                    Ver
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Payment Method Card Selector */}
                    {/* Only show when terminalId is loaded if posSessionId is provided */}
                    {(!posSessionId || terminalId !== null) && (
                        <PaymentMethodCardSelector
                            operation={isPurchase ? 'purchases' : 'sales'}
                            terminalId={terminalId || undefined}
                            total={pendingAmount}
                            paymentData={paymentData}
                            onPaymentDataChange={setPaymentData}
                            compactMode={true}
                            customerCreditBalance={customerCreditBalance}
                            allowCreditBalanceAccumulation={allowCreditBalanceAccumulation}
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
                    )}
                    {posSessionId && terminalId === null && (
                        <div className="p-8">
                            <LoadingFallback message="Cargando métodos de pago..." />
                        </div>
                    )}
                </div>
            </div>
        </BaseModal>
    )
} export default PaymentModal
