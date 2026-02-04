"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Banknote, CreditCard, Building2, ClipboardList, Wallet, AlertCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useTreasuryAccounts } from "@/hooks/useTreasuryAccounts"

import { useState, useMemo, useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Settings } from "lucide-react"
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


interface Step2_PaymentProps {
    paymentData: any
    setPaymentData: (data: any) => void
    total: number
    terminalId?: number
}

export function Step2_Payment({ paymentData, setPaymentData, total, terminalId }: Step2_PaymentProps) {
    const { accounts } = useTreasuryAccounts({
        context: terminalId ? 'POS' : 'GENERAL',
        terminalId
    })

    const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
    const [tempAmount, setTempAmount] = useState("")
    const [tempTx, setTempTx] = useState("")
    const [tempAccount, setTempAccount] = useState("")
    const [tempIsPending, setTempIsPending] = useState(false)

    const handleMethodChange = (val: string) => {
        setPaymentData({ ...paymentData, method: val })
        setTempAmount(paymentData.amount ? paymentData.amount.toString() : "")
        setTempTx(paymentData.transactionNumber || "")
        setTempAccount(paymentData.treasuryAccountId || "")
        setTempIsPending(paymentData.isPending || false)
        setIsAmountModalOpen(true)
    }

    const handleAmountConfirm = () => {
        // Validation Logic
        if (paymentData.method === 'TRANSFER' && !tempIsPending && !tempTx) {
            // We can use a simple alert or toast here, but for now let's just return
            // Ideally we should show an error state in the modal
            alert("Para transferencias, debe ingresar el N° de Transacción o marcar como pendiente.")
            return
        }

        const parsed = parseFloat(tempAmount)
        const cappedAmount = Math.min(parsed || 0, total)

        setPaymentData({
            ...paymentData,
            amount: cappedAmount,
            transactionNumber: tempTx,
            treasuryAccountId: tempAccount,
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

    const filteredAccounts = useMemo(() => {
        return accounts.filter(acc => {
            if (paymentData.method === 'CASH') return acc.allows_cash
            if (paymentData.method === 'CARD') return acc.allows_card
            if (paymentData.method === 'TRANSFER') return acc.allows_transfer
            return false
        })
    }, [accounts, paymentData.method])

    useEffect(() => {
        if (filteredAccounts.length === 1 && paymentData.treasuryAccountId !== filteredAccounts[0].id.toString()) {
            setPaymentData({ ...paymentData, treasuryAccountId: filteredAccounts[0].id.toString() })
        } else if (filteredAccounts.length === 0 && paymentData.treasuryAccountId) {
            setPaymentData({ ...paymentData, treasuryAccountId: null })
        }
    }, [filteredAccounts, paymentData, setPaymentData])

    const methods = [
        {
            id: 'CASH',
            label: 'Efectivo',
            icon: Banknote,
            color: 'text-emerald-600',
            hasAccounts: accounts.some(a => a.allows_cash)
        },
        {
            id: 'CARD',
            label: 'Tarjeta',
            icon: CreditCard,
            color: 'text-blue-600',
            hasAccounts: accounts.some(a => a.allows_card)
        },
        {
            id: 'TRANSFER',
            label: 'Transferencia',
            icon: Building2,
            color: 'text-purple-600',
            hasAccounts: accounts.some(a => a.allows_transfer)
        },
    ]

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
            <Label className="text-sm font-semibold"></Label>
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex justify-between items-center">
                <div>
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Total a Cobrar</Label>
                    <p className="text-2xl font-bold text-primary">
                        {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </p>
                </div>
                <Wallet className="h-8 w-8 text-primary/20" />
            </div>

            {accounts.length === 0 && (
                <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm font-bold">Sin Métodos de Pago</AlertTitle>
                    <AlertDescription className="text-xs mt-1">
                        No hay cuentas de tesorería configuradas.
                        <Link href="/treasury/accounts" className="font-bold underline ml-1 hover:text-destructive/80 transition-colors">
                            Configurar ahora
                        </Link>
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-4">
                <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Método de Pago</Label>
                <RadioGroup
                    value={paymentData.method}
                    onValueChange={handleMethodChange}
                    className="grid grid-cols-3 gap-4"
                >
                    {methods.map((m) => (
                        <div key={m.id} className="relative group">
                            <Label
                                htmlFor={`method-${m.id}`}
                                className={`flex items-center gap-3 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary transition-all ${paymentData.method === m.id ? 'border-primary bg-primary/5' : ''} ${!m.hasAccounts ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                                onClick={(e) => {
                                    if (!m.hasAccounts) {
                                        e.preventDefault()
                                        return
                                    }
                                }}
                            >
                                <RadioGroupItem value={m.id} id={`method-${m.id}`} className="sr-only" disabled={!m.hasAccounts} />
                                <div className={`p-2 rounded-lg bg-background border ${m.color}`}>
                                    <m.icon className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">{m.label}</span>
                                    {!m.hasAccounts && (
                                        <span className="text-[8px] font-bold text-destructive uppercase">Sin Configurar</span>
                                    )}
                                </div>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            <div className="space-y-4 animate-in fade-in duration-300">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="pay-amount" className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Monto Recibido</Label>
                        <Input
                            id="pay-amount"
                            type="number"
                            value={paymentData.amount}
                            readOnly
                            onClick={openAmountModal}
                            className="cursor-pointer hover:bg-muted/50"
                        />
                    </div>
                    {paymentData.amount > total && paymentData.method === 'CASH' ? (
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-emerald-600">Vuelto</Label>
                            <div className="h-10 flex items-center px-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold">
                                {(paymentData.amount - total).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                            </div>
                        </div>
                    ) : paymentData.amount < total ? (
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-orange-600">Crédito Asignado</Label>
                            <div className="h-10 flex items-center px-3 rounded-md border border-orange-200 bg-orange-50 text-orange-700 font-bold">
                                {(total - paymentData.amount).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                            </div>
                        </div>
                    ) : null}
                </div>

                {(paymentData.amount > 0 && (paymentData.method === 'CARD' || paymentData.method === 'TRANSFER')) && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs text-muted-foreground border border-dashed">
                        <span className="font-semibold uppercase">{paymentData.method === 'CARD' ? 'Tarjeta' : 'Transferencia'}:</span>
                        {paymentData.isPending ? (
                            <span className="text-amber-600 font-bold">Pendiente de registro</span>
                        ) : (
                            <>
                                <span>Tx: {paymentData.transactionNumber || "---"}</span>
                                {paymentData.treasuryAccountId && (
                                    <span>• Cuenta: {filteredAccounts.find(a => a.id.toString() === paymentData.treasuryAccountId)?.name}</span>
                                )}
                            </>
                        )}
                        <Button variant="ghost" size="sm" className="h-auto p-1 ml-auto text-primary" onClick={openAmountModal}>
                            Editar
                        </Button>
                    </div>
                )}
            </div>

            <Dialog open={isAmountModalOpen} onOpenChange={setIsAmountModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Monto Recibido</DialogTitle>
                        <DialogDescription>
                            Ingrese el monto recibido para este pago.
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

                        {(paymentData.method === 'CARD' || paymentData.method === 'TRANSFER') && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="modal-tx" className="flex items-center justify-between">
                                        <span>N° Transacción</span>
                                        {paymentData.method === 'CARD' && <span className="text-[10px] text-muted-foreground font-normal">(Opcional)</span>}
                                        {paymentData.method === 'TRANSFER' && !tempIsPending && <span className="text-[10px] text-destructive font-bold">* Requerido</span>}
                                    </Label>
                                    <Input
                                        id="modal-tx"
                                        value={tempTx}
                                        onChange={(e) => setTempTx(e.target.value)}
                                        placeholder="Ingrese N° de operación..."
                                        disabled={tempIsPending}
                                    />
                                </div>

                                {filteredAccounts.length > 1 && (
                                    <div className="space-y-2">
                                        <Label htmlFor="modal-account">Cuenta Destino</Label>
                                        <select
                                            id="modal-account"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={tempAccount}
                                            onChange={(e) => setTempAccount(e.target.value)}
                                        >
                                            <option value="">Seleccionar cuenta...</option>
                                            {filteredAccounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

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
                            </>
                        )}
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
