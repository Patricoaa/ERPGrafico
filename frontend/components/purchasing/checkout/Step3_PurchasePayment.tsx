"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Banknote, CreditCard, Building2, Wallet, AlertCircle, ClipboardList } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useTreasuryAccounts } from "@/hooks/useTreasuryAccounts"
import { useAllowedPaymentMethods } from "@/hooks/useAllowedPaymentMethods"
import { PaymentMethodSelector } from "@/components/shared/PaymentMethodSelector"
import { useState, useEffect, useMemo } from "react"
import api from "@/lib/api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

interface Step3_PurchasePaymentProps {
    paymentData: any
    setPaymentData: (data: any) => void
    total: number
}

export function Step3_PurchasePayment({ paymentData, setPaymentData, total }: Step3_PurchasePaymentProps) {


    const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
    const [tempAmount, setTempAmount] = useState("")
    const [tempTx, setTempTx] = useState("")
    const [tempAccount, setTempAccount] = useState("")
    const [tempIsPending, setTempIsPending] = useState(false)

    const handleAmountConfirm = () => {
        // Validation Logic
        if ((paymentData.method === 'TRANSFER' || paymentData.method === 'CARD') && !tempIsPending && !tempTx) {
            alert("Debe ingresar el N° de Transacción o marcar como pendiente.")
            return
        }

        const parsed = parseFloat(tempAmount)
        const cappedAmount = Math.min(parsed || 0, total)

        setPaymentData({
            ...paymentData,
            amount: cappedAmount,
            transactionNumber: tempTx,
            // treasuryAccountId: tempAccount, // Preserved from selector
            isPending: tempIsPending
        })
        setIsAmountModalOpen(false)
    }

    const openAmountModal = () => {
        setTempAmount(paymentData.amount ? paymentData.amount.toString() : "")
        setTempTx(paymentData.transactionNumber || "")
        setTempAccount(paymentData.treasuryAccountId || "")
        setTempIsPending(paymentData.isPending || false)
        setIsAmountModalOpen(true)
    }

    // Initialize amount to total if not set (but allow 0)
    useEffect(() => {
        if (paymentData.amount === undefined || paymentData.amount === null) {
            setPaymentData({ ...paymentData, amount: total })
        }
    }, [total])

    const pendingDebt = total - (paymentData.amount || 0)

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1">
                <h3 className=" font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Registro de Pago
                </h3>
                <p className="text-sm text-muted-foreground">
                    Ingrese la información relacionada al Pago.
                </p>
            </div>
            <div className="p-4 bg-destructive/5 rounded-xl border border-destructive/10 flex justify-between items-center">
                <div>
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Total de la Compra</Label>
                    <p className="text-2xl font-bold text-destructive">
                        {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </p>
                </div>
                <Wallet className="h-8 w-8 text-destructive/20" />
            </div>


            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <PaymentMethodSelector
                    value={{
                        methodType: (paymentData.method as any) || null,
                        treasuryAccountId: paymentData.treasuryAccountId || null,
                        paymentMethodId: paymentData.paymentMethodId || null
                    }}
                    onChange={(val) => {
                        setPaymentData({
                            ...paymentData,
                            method: val.methodType,
                            treasuryAccountId: val.treasuryAccountId,
                            paymentMethodId: val.paymentMethodId,
                            // Reset transaction info if method changes
                            transactionNumber: val.methodType !== paymentData.method ? "" : paymentData.transactionNumber,
                            isPending: val.methodType !== paymentData.method ? false : paymentData.isPending
                        })
                        // Open amount modal if needed, or just set defaults
                        if (val.methodType && val.methodType !== paymentData.method) {
                            setTempAmount(paymentData.amount ? paymentData.amount.toString() : "")
                            setTempTx("")
                            setTempIsPending(false)
                            setIsAmountModalOpen(true)
                        }
                    }}
                    operation="purchases"
                />

                {(paymentData.amount > 0 && paymentData.method) && (
                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl text-xs text-muted-foreground border border-dashed mt-4">
                        <span className="font-semibold uppercase flex items-center gap-2">
                            {paymentData.method === 'CASH' && <Banknote className="h-4 w-4 text-emerald-600" />}
                            {paymentData.method === 'CARD' && <CreditCard className="h-4 w-4 text-blue-600" />}
                            {paymentData.method === 'TRANSFER' && <Building2 className="h-4 w-4 text-purple-600" />}
                            {paymentData.method === 'CHECK' && <ClipboardList className="h-4 w-4 text-amber-600" />}

                            {paymentData.method === 'CASH' ? 'Efectivo' :
                                paymentData.method === 'CARD' ? 'Tarjeta' :
                                    paymentData.method === 'TRANSFER' ? 'Transferencia' : 'Cheque'}
                        </span>

                        <div className="h-4 w-px bg-border mx-1" />

                        {paymentData.isPending ? (
                            <span className="text-amber-600 font-bold">Pendiente de registro</span>
                        ) : (
                            <div className="flex items-center gap-2 overflow-hidden">
                                {(paymentData.method === 'CARD' || paymentData.method === 'TRANSFER' || paymentData.method === 'CHECK') && (
                                    <span className="whitespace-nowrap font-mono bg-background px-1.5 py-0.5 rounded border text-[10px]">
                                        {paymentData.method === 'CHECK' ? 'Chq' : 'Tx'}: {paymentData.transactionNumber || "---"}
                                    </span>
                                )}
                            </div>
                        )}
                        <Button variant="ghost" size="sm" className="h-auto p-1 ml-auto text-primary hover:bg-primary/10" onClick={openAmountModal}>
                            Editar Monto
                        </Button>
                    </div>
                )}
            </div>

            <div className={`grid gap-4 ${pendingDebt > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div className="space-y-2">
                    <Label htmlFor="pay-amount" className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Monto a Pagar Ahora</Label>
                    <Input
                        id="pay-amount"
                        type="number"
                        value={paymentData.amount}
                        max={total}
                        readOnly
                        onClick={openAmountModal}
                        className="text-lg font-semibold cursor-pointer hover:bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">
                        Puede registrar el pago del total o un monto parcial. La diferencia quedará como deuda pendiente.
                    </p>
                </div>

                {pendingDebt > 0 && (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-orange-600">Deuda Pendiente</Label>
                        <div className="h-10 flex items-center px-3 rounded-md border border-orange-200 bg-orange-50 text-orange-700 font-bold">
                            {pendingDebt.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={isAmountModalOpen} onOpenChange={setIsAmountModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Monto a Pagar</DialogTitle>
                        <DialogDescription>
                            Ingrese el monto que desea pagar ahora.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="modal-amount">Monto</Label>
                            <Input
                                id="modal-amount"
                                type="number"
                                value={tempAmount}
                                onChange={(e) => setTempAmount(e.target.value)}
                                max={total}
                                placeholder="0"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAmountConfirm()
                                }}
                            />
                        </div>

                        {(paymentData.method === 'CARD' || paymentData.method === 'TRANSFER' || paymentData.method === 'CHECK') && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="modal-tx" className="flex items-center justify-between">
                                        <span>{paymentData.method === 'CHECK' ? 'N° de Cheque' : 'N° Transacción'}</span>
                                        {!tempIsPending && <span className="text-[10px] text-destructive font-bold">* Requerido</span>}
                                    </Label>
                                    <Input
                                        id="modal-tx"
                                        value={tempTx}
                                        onChange={(e) => setTempTx(e.target.value)}
                                        placeholder={paymentData.method === 'CHECK' ? "Ej: 000123" : "Ingrese N° de operación..."}
                                        disabled={tempIsPending}
                                    />
                                </div>

                                <div className="flex items-center space-x-2 pt-2">
                                    <Checkbox
                                        id="modal-pending"
                                        checked={tempIsPending}
                                        onCheckedChange={(checked) => {
                                            const isChecked = !!checked;
                                            setTempIsPending(isChecked);
                                            if (isChecked) setTempTx("");
                                        }}
                                    />
                                    <Label htmlFor="modal-pending" className="text-sm cursor-pointer">
                                        Informar N° de transacción luego
                                    </Label>
                                </div>
                            </div>
                        )}

                        {/* Account selection removed - handled in main component */}
                    </div>
                    <DialogFooter className="sm:justify-end">
                        <Button type="button" variant="secondary" onClick={() => setIsAmountModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleAmountConfirm}>
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
