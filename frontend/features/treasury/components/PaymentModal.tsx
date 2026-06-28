"use client"

import { useState } from "react"
import { BaseModal, CancelButton, DocumentAttachmentDropzone, FormFooter, LabeledInput, LabeledSelect, LoadingFallback, PeriodValidationDateInput } from '@/components/shared'

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import {Banknote, Receipt, Hash, Calendar, FileUp} from "lucide-react"
import { cn } from "@/lib/utils"
import { PaymentMethodSelector, type PaymentData } from "@/features/treasury"
import { useServerDate } from "@/hooks/useServerDate"
import { usePOSSession } from "@/features/treasury/hooks/usePOSSession"

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
        is_pending_registration?: boolean,
        treasury_account_id?: string | null,
        payment_method_new?: string | null,
        documentReference?: string,
        documentDate?: string,
        documentAttachment?: File | null,
        installments?: number
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
    const [prevDateString, setPrevDateString] = useState(dateString)

    const [isPeriodValid, setIsPeriodValid] = useState(true)

    // Sync document date with server date — adjust during render
    if (dateString !== prevDateString) {
        setPrevDateString(dateString)
        if (!documentDate) {
            setDocumentDate(dateString)
        }
    }

    const [documentAttachment, setDocumentAttachment] = useState<File | null>(null)
    const [isDocumentPending, setIsDocumentPending] = useState(false)

    // Payment data managed by PaymentMethodSelector
    const [paymentData, setPaymentData] = useState<PaymentData>({
        method: null,
        amount: pendingAmount,
        treasuryAccountId: null,
        paymentMethodId: null,
        isPending: false
    })

    const { session: posSession } = usePOSSession(posSessionId)
    const terminalId = posSession?.terminal ?? null

    // Reset payment data when modal opens — adjust during render
    const [prevOpen, setPrevOpen] = useState(open)
    if (open !== prevOpen) {
        setPrevOpen(open)
        if (open) {
            setPaymentData({
                method: null,
                amount: pendingAmount,
                treasuryAccountId: null,
                paymentMethodId: null,
                isPending: false
            })
            setDocumentReference(existingInvoice?.number || "")
            if (dateString) setDocumentDate(dateString)
            setDocumentAttachment(null)
            setIsDocumentPending(false)
            setIsPeriodValid(true)
            setDteType(existingInvoice ? existingInvoice.dte_type : (isPurchase ? "NONE" : "BOLETA"))
        }
    }

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
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <Button
                                className="bg-success hover:bg-success/90 h-10 text-sm font-bold"
                                onClick={() => onConfirm({
                                    paymentMethod: paymentData.amount === 0 ? 'CREDIT' : paymentData.method || 'CASH',
                                    amount: paymentData.amount,
                                    dteType: (showDteSelector && dteType !== 'NONE') ? dteType : undefined,
                                    documentReference: (dteType !== 'NONE') ? documentReference : undefined,
                                    documentDate: (dteType !== 'NONE') ? documentDate : undefined,
                                    documentAttachment: (dteType !== 'NONE') ? documentAttachment : undefined,
                                    is_pending_registration: paymentData.isPending,
                                    treasury_account_id: paymentData.amount === 0 ? null : paymentData.treasuryAccountId,
                                    payment_method_new: paymentData.amount === 0 ? null : paymentData.paymentMethodId?.toString(),
                                    installments: paymentData.method === 'CREDIT_CARD' ? (paymentData.installments || 1) : undefined
                                })}
                                disabled={
                                    (paymentData.amount < 0) ||
                                    (paymentData.amount > 0 && !paymentData.treasuryAccountId && paymentData.method !== 'CHECK') ||
                                    ((!hideDteFields && isPurchase && (dteType === 'BOLETA' || dteType === 'FACTURA') && !existingInvoice && !documentReference && !isDocumentPending)) ||
                                    ((hideDteFields && isPurchase && (dteType === 'BOLETA' || dteType === 'FACTURA') && !!existingInvoice && !documentReference)) ||
                                    (paymentData.method === 'CHECK' && paymentData.amount > 0 && !paymentData.checkNumber) ||
                                    (!hideDteFields && dteType === 'FACTURA' && !existingInvoice && !isDocumentPending && !documentAttachment) ||
                                    ((dteType === 'BOLETA' || dteType === 'FACTURA') && !isPeriodValid)
                                }
                            >
                                {isRefund ? 'Confirmar Reembolso' : 'Confirmar Pago'}
                            </Button>
                        </>
                    }
                />
            }
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
                        <PaymentMethodSelector
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
