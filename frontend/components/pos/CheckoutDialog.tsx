"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface CheckoutDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    total: number
    onConfirm: (data: { dteType: string, paymentMethod: string, amountReceived: number }) => void
}

export function CheckoutDialog({ open, onOpenChange, total, onConfirm }: CheckoutDialogProps) {
    const [dteType, setDteType] = useState("BOLETA")
    const [paymentMethod, setPaymentMethod] = useState("CASH")
    const [amountReceived, setAmountReceived] = useState(total.toString())

    useEffect(() => {
        if (open) {
            setAmountReceived(total.toString())
        }
    }, [open, total])

    const change = Math.max(0, parseFloat(amountReceived || "0") - total)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Finalizar Pago</DialogTitle>
                    <div className="text-3xl font-bold text-center py-4">
                        ${total.toLocaleString()}
                    </div>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label>Tipo de Documento</Label>
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
                    <div className="grid gap-2">
                        <Label>Metodología de Pago</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CASH">Efectivo</SelectItem>
                                <SelectItem value="CARD">Tarjeta (Débito/Crédito)</SelectItem>
                                <SelectItem value="TRANSFER">Transferencia</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {paymentMethod === "CASH" && (
                        <div className="grid gap-2">
                            <Label>Efectivo Recibido</Label>
                            <Input
                                type="number"
                                value={amountReceived}
                                onChange={(e) => setAmountReceived(e.target.value)}
                                className="text-lg font-bold"
                                autoFocus
                                onFocus={(e) => e.target.select()}
                            />
                            <div className="flex justify-between items-center text-sm p-3 bg-muted rounded-md mt-1">
                                <span>Vuelto a entregar:</span>
                                <span className="font-bold text-xl text-emerald-600">${change.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter className="mt-4">
                    <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onConfirm({ dteType, paymentMethod, amountReceived: parseFloat(amountReceived) })}>
                        Confirmar y Emitir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
