"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CreditCard, Banknote, Landmark, Receipt, Hash, ClipboardCheck } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { AccountSelector } from "@/components/selectors/AccountSelector"

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
        account_id?: string | null
    }) => void
    showDteSelector?: boolean
}

export function PaymentDialog({
    open,
    onOpenChange,
    total,
    pendingAmount,
    onConfirm,
    showDteSelector = false
}: PaymentDialogProps) {
    const [dteType, setDteType] = useState("BOLETA")
    const [paymentMethod, setPaymentMethod] = useState("CASH")
    const [amount, setAmount] = useState(pendingAmount.toString())
    const [transactionNumber, setTransactionNumber] = useState("")
    const [isPending, setIsPending] = useState(false)
    const [account, setAccount] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            setAmount(pendingAmount.toString())
            setTransactionNumber("")
            setIsPending(false)
            setAccount(null)
        }
    }, [open, pendingAmount])

    const change = Math.max(0, parseFloat(amount || "0") - pendingAmount)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Banknote className="h-5 w-5" />
                        Registrar Pago
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm font-medium text-muted-foreground">Monto Total: ${total.toLocaleString()}</div>
                        <div className="text-2xl font-black text-primary">
                            Pendiente: ${pendingAmount.toLocaleString()}
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {showDteSelector && (
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2 text-[11px] font-bold uppercase text-muted-foreground">
                                    <Receipt className="h-3 w-3" />
                                    Documento a Emitir
                                </Label>
                                <Select value={dteType} onValueChange={setDteType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BOLETA">Boleta Electrónica</SelectItem>
                                        <SelectItem value="FACTURA">Factura Electrónica</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                ].map((m) => (
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
                        </div>

                        {paymentMethod !== 'CREDIT' && (
                            <div className="grid gap-2">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Cuenta Destino (Opcional)</Label>
                                <AccountSelector
                                    value={account}
                                    onChange={setAccount}
                                    placeholder="Cuenta Automática (según config.)"
                                    accountType="ASSET"
                                />
                            </div>
                        )}

                        {paymentMethod === 'TRANSFER' && (
                            <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                <div className="grid gap-2">
                                    <Label className="text-[10px] font-bold uppercase flex items-center gap-1">
                                        <Hash className="h-3 w-3" /> N° de Transacción
                                    </Label>
                                    <Input
                                        placeholder="Ingrese N° de Folio/Op"
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
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Monto a Pagar</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="pl-7 text-2xl font-black h-14"
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                />
                            </div>

                            {paymentMethod === 'CASH' && change > 0 && (
                                <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-md">
                                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Vuelto a entregar:</span>
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
                            dteType: showDteSelector ? dteType : undefined,
                            transaction_number: transactionNumber,
                            is_pending_registration: isPending,
                            account_id: account
                        })}
                        disabled={(paymentMethod !== 'CREDIT' && parseFloat(amount) <= 0)}
                    >
                        {paymentMethod === 'CREDIT' ? 'Confirmar Crédito' : 'Confirmar Pago'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
