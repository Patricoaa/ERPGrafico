"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CreditCard, Banknote, Landmark, Receipt } from "lucide-react"

interface PaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    total: number
    pendingAmount: number
    onConfirm: (data: {
        paymentMethod: string,
        amount: number,
        dteType?: string,
        reference?: string
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

    useEffect(() => {
        if (open) {
            setAmount(pendingAmount.toString())
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
                                <Label className="flex items-center gap-2">
                                    <Receipt className="h-4 w-4" />
                                    Tipo de Documento a Emitir
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
                            <Label>Método de Pago</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'CASH', label: 'Efectivo', icon: Banknote },
                                    { id: 'CARD', label: 'Tarjeta', icon: CreditCard },
                                    { id: 'TRANSFER', label: 'Transf.', icon: Landmark },
                                ].map((m) => (
                                    <Button
                                        key={m.id}
                                        type="button"
                                        variant={paymentMethod === m.id ? "default" : "outline"}
                                        className="flex flex-col h-16 gap-1"
                                        onClick={() => setPaymentMethod(m.id)}
                                    >
                                        <m.icon className="h-5 w-5" />
                                        <span className="text-[10px] uppercase font-bold">{m.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Monto a Pagar</Label>
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
                            dteType: showDteSelector ? dteType : undefined
                        })}
                        disabled={parseFloat(amount) <= 0}
                    >
                        Confirmar Pago
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
