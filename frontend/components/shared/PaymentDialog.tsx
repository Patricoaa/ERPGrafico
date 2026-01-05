"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CreditCard, Banknote, Landmark, Receipt, Hash, ClipboardCheck } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"

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
        documentReference?: string,
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
    existingInvoice = null
}: PaymentDialogProps) {
    const [dteType, setDteType] = useState(isPurchase ? "NONE" : "BOLETA")
    const [paymentMethod, setPaymentMethod] = useState("CASH")
    const [amount, setAmount] = useState(pendingAmount.toString())
    const [transactionNumber, setTransactionNumber] = useState("")
    const [documentReference, setDocumentReference] = useState("")
    const [documentAttachment, setDocumentAttachment] = useState<File | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [treasuryAccount, setTreasuryAccount] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            setAmount(pendingAmount.toString())
            setTransactionNumber("")
            setDocumentReference(existingInvoice?.number || "")
            setDocumentAttachment(null)
            setIsPending(false)
            setTreasuryAccount(null)

            if (isPurchase) {
                if (existingInvoice) {
                    setDteType(existingInvoice.dte_type)
                } else {
                    setDteType("NONE")
                }
            }
        }
    }, [open, pendingAmount, isPurchase, existingInvoice])

    const change = Math.max(0, parseFloat(amount || "0") - pendingAmount)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Banknote className="h-5 w-5" />
                        {isRefund ? "Registrar Reembolso / Devolución" : "Registrar Pago"}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm font-medium text-muted-foreground">Monto Total: ${total.toLocaleString()}</div>
                        <div className="text-2xl font-black text-primary">
                            {isRefund ? "Por Recibir" : "Pendiente"}: ${pendingAmount.toLocaleString()}
                        </div>
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
                                                <SelectItem value="BOLETA">Boleta Electrónica</SelectItem>
                                                <SelectItem value="FACTURA">Factura Electrónica</SelectItem>
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

                        {!hideDteFields && isPurchase && (dteType === "BOLETA" || dteType === "FACTURA") && (
                            <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-dashed">
                                <div className="grid gap-2">
                                    <Label className="text-[10px] font-bold uppercase">N° de Folio / Referencia (Obligatorio)</Label>
                                    <Input
                                        placeholder="Ej: 12345"
                                        value={documentReference}
                                        onChange={(e) => setDocumentReference(e.target.value)}
                                        disabled={!!existingInvoice}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-[10px] font-bold uppercase">
                                        {existingInvoice ? "Documento Adjunto" : "Adjuntar Documento (Opcional)"}
                                    </Label>
                                    {!existingInvoice ? (
                                        <div className="flex gap-2">
                                            <Input
                                                type="file"
                                                onChange={(e) => setDocumentAttachment(e.target.files?.[0] || null)}
                                                className="text-xs h-9 py-1"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs text-blue-600 font-medium p-2 bg-blue-50 rounded border border-blue-100">
                                            <Receipt className="h-4 w-4" />
                                            <span>Documento cargado correctamente</span>
                                            {existingInvoice.document_attachment && (
                                                <a
                                                    href={existingInvoice.document_attachment}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="ml-auto underline"
                                                >
                                                    Ver
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    {documentAttachment && (
                                        <div className="text-[10px] text-emerald-600 font-medium">
                                            ✓ {documentAttachment.name}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Método de Pago</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { id: 'CASH', label: 'Efectivo', icon: Banknote },
                                    { id: 'CARD', label: 'Tarjeta', icon: CreditCard },
                                    { id: 'TRANSFER', label: 'Transf.', icon: Landmark },
                                    { id: 'CREDIT', label: 'Crédito', icon: Receipt },
                                ].filter(m => !isPurchase || m.id !== 'CREDIT').map((m) => (
                                    <Button
                                        key={m.id}
                                        type="button"
                                        variant={paymentMethod === m.id ? "default" : "outline"}
                                        className="flex flex-col h-16 gap-1 px-1"
                                        onClick={() => setPaymentMethod(m.id)}
                                    >
                                        <m.icon className="h-5 w-5" />
                                        <span className="text-[9px] uppercase font-bold">{m.label}</span>
                                    </Button>
                                ))}
                            </div>
                            {paymentMethod === 'CREDIT' && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-md text-[10px] text-amber-700 dark:text-amber-400">
                                    <p className="font-bold mb-1">Nota sobre Venta/Compra a Crédito:</p>
                                    <p>Esta opción no genera un movimiento de caja. Solo servirá para registrar el documento (Factura/Boleta) y generar la deuda en la cuenta corriente del {isPurchase ? 'proveedor' : 'cliente'}.</p>
                                </div>
                            )}
                        </div>

                        {paymentMethod !== 'CREDIT' && (
                            <div className="grid gap-2">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Cuenta Destino (Opcional)</Label>
                                <TreasuryAccountSelector
                                    value={treasuryAccount}
                                    onChange={setTreasuryAccount}
                                    placeholder="Cuenta Automática (según config.)"
                                    type={paymentMethod === 'CASH' ? 'CASH' : 'BANK'}
                                />
                            </div>
                        )}

                        {(paymentMethod === 'TRANSFER' || paymentMethod === 'CARD') && (
                            <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                <div className="grid gap-2">
                                    <Label className="text-[10px] font-bold uppercase flex items-center gap-1">
                                        <Hash className="h-3 w-3" /> N° de Transacción ({paymentMethod === 'CARD' ? 'Tarjeta' : 'Transferencia'})
                                    </Label>
                                    <Input
                                        placeholder="Ingrese N° de Folio/Op/Voucher"
                                        value={transactionNumber}
                                        onChange={(e) => setTransactionNumber(e.target.value)}
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pending"
                                        checked={isPending}
                                        onCheckedChange={(checked: boolean) => setIsPending(!!checked)}
                                    />
                                    <Label htmlFor="pending" className="text-xs flex items-center gap-1 cursor-pointer">
                                        <ClipboardCheck className="h-3 w-3" /> N° de transacción pendiente de registro
                                    </Label>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">
                                {isRefund ? "Monto a Recibir" : "Monto a Pagar"}
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                                <Input
                                    type="number"
                                    step="1"
                                    value={amount}
                                    onChange={(e) => setAmount(Math.ceil(parseFloat(e.target.value) || 0).toString())}
                                    className="pl-7 text-2xl font-black h-14"
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                />
                            </div>

                            {paymentMethod === 'CASH' && change > 0 && (
                                <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-md">
                                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                        {isRefund ? "Diferencia a favor:" : "Vuelto a entregar:"}
                                    </span>
                                    <span className="font-bold text-xl text-emerald-600 dark:text-emerald-400">${change.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
                    <Button
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold"
                        onClick={() => onConfirm({
                            paymentMethod,
                            amount: parseFloat(amount),
                            dteType: (showDteSelector && dteType !== 'NONE') ? dteType : undefined,
                            documentReference: (isPurchase && dteType !== 'NONE') ? documentReference : undefined,
                            documentAttachment: (isPurchase && dteType !== 'NONE') ? documentAttachment : undefined,
                            transaction_number: transactionNumber,
                            is_pending_registration: !!isPending,
                            treasury_account_id: treasuryAccount
                        })}
                        disabled={
                            (paymentMethod !== 'CREDIT' && parseFloat(amount) <= 0) ||
                            (!hideDteFields && isPurchase && (dteType === 'BOLETA' || dteType === 'FACTURA') && !existingInvoice && !documentReference) ||
                            (!hideDteFields && isPurchase && (dteType === 'BOLETA' || dteType === 'FACTURA') && !!existingInvoice && !documentReference) ||
                            ((paymentMethod === 'CARD' || paymentMethod === 'TRANSFER') && !isPending && !transactionNumber)
                        }
                    >
                        {paymentMethod === 'CREDIT' ? (
                            existingInvoice ? 'Mantener en Cuenta Corriente' : 'Confirmar Venta/Compra a Crédito'
                        ) : (isRefund ? 'Confirmar Reembolso' : 'Confirmar Pago')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
