"use client"

import { useState, useEffect } from "react"
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
import api from "@/lib/api"

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
    const [dteType, setDteType] = useState("NONE")
    const [paymentMethod, setPaymentMethod] = useState("CASH")
    const [amount, setAmount] = useState(pendingAmount.toString())
    const [transactionNumber, setTransactionNumber] = useState("")
    const [documentReference, setDocumentReference] = useState("")
    const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0])
    const [documentAttachment, setDocumentAttachment] = useState<File | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [treasuryAccount, setTreasuryAccount] = useState<string | null>(null)
    const [availableAccounts, setAvailableAccounts] = useState<any[]>([])
    const [loadingAccounts, setLoadingAccounts] = useState(false)

    useEffect(() => {
        if (open) {
            setAmount(pendingAmount.toString())
            setTransactionNumber("")
            setDocumentReference(existingInvoice?.number || "")
            setDocumentDate(new Date().toISOString().split('T')[0])
            setDocumentAttachment(null)
            setIsPending(false)
            setTreasuryAccount(null)

            if (existingInvoice) {
                setDteType(existingInvoice.dte_type)
            } else {
                setDteType(isPurchase ? "NONE" : "BOLETA")
            }
        }
    }, [open, pendingAmount, isPurchase, existingInvoice])

    useEffect(() => {
        const fetchAndFilterAccounts = async () => {
            if (!open) {
                setAvailableAccounts([])
                return
            }

            setLoadingAccounts(true)
            try {
                const res = await api.get('/treasury/accounts/')
                const allAccounts = res.data.results || res.data

                const filtered = allAccounts.filter((acc: any) => {
                    if (paymentMethod === 'CASH') return acc.allows_cash
                    if (paymentMethod === 'CARD') return acc.allows_card
                    if (paymentMethod === 'TRANSFER') return acc.allows_transfer
                    return false
                })

                setAvailableAccounts(filtered)

                // Auto-select if only one
                if (filtered.length === 1) {
                    setTreasuryAccount(filtered[0].id.toString())
                } else {
                    setTreasuryAccount(null)
                }
            } catch (error) {
                console.error("Error fetching accounts:", error)
            } finally {
                setLoadingAccounts(false)
            }
        }

        fetchAndFilterAccounts()
    }, [open, paymentMethod])

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
                    <div className="relative overflow-hidden p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl border border-primary/10 shadow-inner">
                        <div className="flex justify-between items-center relative z-10">
                            <div>
                                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-primary/70 mb-1">Monto de la Orden</p>
                                <p className="text-sm font-bold text-muted-foreground opacity-80">${total.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-primary/70 mb-1">
                                    {isRefund ? "Total a Reembolsar" : "Saldo Pendiente"}
                                </p>
                                <p className="text-4xl font-black text-primary tracking-tighter drop-shadow-sm">
                                    ${pendingAmount.toLocaleString()}
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
                            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                                {dteType === 'FACTURA' && (
                                    <div className="flex items-center space-x-2 py-1">
                                        <Checkbox
                                            id="pending-doc-check"
                                            checked={isPending}
                                            onCheckedChange={(checked: boolean) => setIsPending(!!checked)}
                                        />
                                        <Label htmlFor="pending-doc-check" className="text-xs font-bold cursor-pointer">
                                            {isPurchase
                                                ? "Aún no recibo el documento físico / digital"
                                                : "Emitiré la factura luego"
                                            }
                                        </Label>
                                    </div>
                                )}

                                <div className={`grid gap-2 ${isPending ? 'opacity-50' : ''}`}>
                                    <Label className="text-[10px] font-bold uppercase flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Fecha de Emisión
                                    </Label>
                                    <Input
                                        type="date"
                                        className="h-9"
                                        value={documentDate}
                                        onChange={(e) => setDocumentDate(e.target.value)}
                                        disabled={isPending}
                                    />
                                </div>

                                <div className={`grid gap-2 ${isPending ? 'opacity-50' : ''}`}>
                                    <Label className="text-[10px] font-bold uppercase flex items-center gap-1">
                                        <Hash className="h-3 w-3" /> N° de Folio / Referencia {isPurchase && <span className="text-destructive">*</span>}
                                    </Label>
                                    <Input
                                        placeholder="Ej: 12345"
                                        value={documentReference}
                                        onChange={(e) => setDocumentReference(e.target.value)}
                                        disabled={!!existingInvoice || isPending}
                                    />
                                </div>

                                <div className={`grid gap-2 ${isPending ? 'opacity-50' : ''}`}>
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
                                                disabled={isPending}
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

                        <div className="space-y-4">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Método de Pago</Label>
                            <RadioGroup
                                value={paymentMethod}
                                onValueChange={setPaymentMethod}
                                className="grid grid-cols-3 gap-3"
                            >
                                {[
                                    { id: 'CASH', label: 'Efectivo', icon: Banknote, color: 'text-emerald-600' },
                                    { id: 'CARD', label: 'Tarjeta', icon: CreditCard, color: 'text-blue-600' },
                                    { id: 'TRANSFER', label: 'Transf.', icon: Building2, color: 'text-purple-600' },
                                ].map((m) => (
                                    <div key={m.id} className="relative group">
                                        <Label
                                            htmlFor={`method-${m.id}`}
                                            className={`flex flex-col items-center gap-2 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary transition-all cursor-pointer ${paymentMethod === m.id ? 'border-primary bg-primary/5' : ''}`}
                                        >
                                            <RadioGroupItem value={m.id} id={`method-${m.id}`} className="sr-only" />
                                            <div className={`p-2 rounded-lg bg-background border ${m.color}`}>
                                                <m.icon className="h-5 w-5" />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase">{m.label}</span>
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>

                        {availableAccounts.length > 1 && (
                            <div className="grid gap-2">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Cuenta Destino</Label>
                                <TreasuryAccountSelector
                                    value={treasuryAccount}
                                    onChange={setTreasuryAccount}
                                    placeholder="Seleccionar cuenta..."
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

                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">
                                    {isRefund ? "Monto a Reembolsar" : "Monto Recibido"}
                                </Label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-2xl text-muted-foreground group-focus-within:text-primary transition-colors">$</span>
                                    <Input
                                        type="number"
                                        step="1"
                                        value={amount}
                                        onChange={(e) => setAmount(Math.ceil(parseFloat(e.target.value) || 0).toString())}
                                        className="pl-10 text-4xl font-black h-20 rounded-2xl border-2 focus-visible:ring-offset-0 transition-all bg-background/50 backdrop-blur-sm shadow-sm"
                                        autoFocus
                                        onFocus={(e) => e.target.select()}
                                    />
                                </div>
                            </div>

                            {paymentMethod === 'CASH' && change > 0 ? (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex justify-between items-center animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-sm">
                                            <Banknote className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                            {isRefund ? "Diferencia a favor:" : "Vuelto a entregar:"}
                                        </span>
                                    </div>
                                    <span className="font-black text-2xl text-emerald-600 dark:text-emerald-400 tracking-tighter">
                                        ${change.toLocaleString()}
                                    </span>
                                </div>
                            ) : parseFloat(amount) < pendingAmount ? (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-orange-600">Deuda Pendiente</Label>
                                    <div className="h-10 flex items-center px-3 rounded-md border border-orange-200 bg-orange-50 text-orange-700 font-bold">
                                        {(pendingAmount - parseFloat(amount)).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
                    <Button
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold"
                        onClick={() => onConfirm({
                            paymentMethod: parseFloat(amount) === 0 ? 'CREDIT' : paymentMethod,
                            amount: parseFloat(amount),
                            dteType: (showDteSelector && dteType !== 'NONE') ? dteType : undefined,
                            documentReference: (dteType !== 'NONE') ? documentReference : undefined,
                            documentDate: (dteType !== 'NONE') ? documentDate : undefined,
                            documentAttachment: (dteType !== 'NONE') ? documentAttachment : undefined,
                            transaction_number: parseFloat(amount) === 0 ? undefined : transactionNumber,
                            is_pending_registration: !!isPending,
                            treasury_account_id: parseFloat(amount) === 0 ? null : treasuryAccount
                        })}
                        disabled={
                            (parseFloat(amount) < 0) ||
                            (parseFloat(amount) > 0 && !treasuryAccount) ||
                            ((!hideDteFields && isPurchase && (dteType === 'BOLETA' || dteType === 'FACTURA') && !existingInvoice && !documentReference)) ||
                            ((!hideDteFields && isPurchase && (dteType === 'BOLETA' || dteType === 'FACTURA') && !!existingInvoice && !documentReference)) ||
                            ((paymentMethod === 'CARD' || paymentMethod === 'TRANSFER') && !isPending && !transactionNumber && parseFloat(amount) > 0)
                        }
                    >
                        {isRefund ? 'Confirmar Reembolso' : 'Confirmar Pago'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
