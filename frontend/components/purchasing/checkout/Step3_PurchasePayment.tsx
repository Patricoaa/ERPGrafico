"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Banknote, CreditCard, Building2, Wallet, AlertCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useTreasuryAccounts } from "@/hooks/useTreasuryAccounts"
import { useAllowedPaymentMethods } from "@/hooks/useAllowedPaymentMethods"
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
    const { accounts } = useTreasuryAccounts({
        context: 'GENERAL'
    })

    const { methods: allowedMethods, loading: loadingMethods } = useAllowedPaymentMethods({
        operation: 'purchases',
        enabled: true
    })

    const isMethodAllowed = (methodId: string) => {
        if (loadingMethods) return true
        if (!allowedMethods.length) return false

        switch (methodId) {
            case 'CASH':
                return allowedMethods.some(m => m.method_type === 'CASH')
            case 'CARD':
                return allowedMethods.some(m => ['CREDIT_CARD', 'DEBIT_CARD'].includes(m.method_type))
            case 'TRANSFER':
                return allowedMethods.some(m => m.method_type === 'TRANSFER')
            default:
                return false
        }
    }

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

    // Initialize amount to total if not set (but allow 0)
    useEffect(() => {
        if (paymentData.amount === undefined || paymentData.amount === null) {
            setPaymentData({ ...paymentData, amount: total })
        }
    }, [total])

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

    const pendingDebt = total - (paymentData.amount || 0)

    const methods = [
        {
            id: 'CASH',
            label: 'Efectivo',
            icon: Banknote,
            color: 'text-emerald-600',
            hasAccounts: accounts.some(a => a.allows_cash),
            isAllowed: isMethodAllowed('CASH')
        },
        {
            id: 'CARD',
            label: 'Tarjeta',
            icon: CreditCard,
            color: 'text-blue-600',
            hasAccounts: accounts.some(a => a.allows_card),
            isAllowed: isMethodAllowed('CARD')
        },
        {
            id: 'TRANSFER',
            label: 'Transferencia',
            icon: Building2,
            color: 'text-purple-600',
            hasAccounts: accounts.some(a => a.allows_transfer),
            isAllowed: isMethodAllowed('TRANSFER')
        }
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
            <div className="p-4 bg-destructive/5 rounded-xl border border-destructive/10 flex justify-between items-center">
                <div>
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Total de la Compra</Label>
                    <p className="text-2xl font-bold text-destructive">
                        {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </p>
                </div>
                <Wallet className="h-8 w-8 text-destructive/20" />
            </div>

            {accounts.length === 0 && (
                <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm font-bold">Sin Métodos de Pago</AlertTitle>
                    <AlertDescription className="text-xs mt-1">
                        No hay cuentas de tesorería de donde extraer fondos.
                        <Link href="/treasury/accounts" className="font-bold underline ml-1 hover:text-destructive/80 transition-colors">
                            Configurar ahora
                        </Link>
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
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
                                className={`flex items-center gap-3 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [\u0026:has([data-state=checked])]:border-primary transition-all ${paymentData.method === m.id ? 'border-primary bg-primary/5' : ''} ${(!m.hasAccounts || !m.isAllowed) ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                                onClick={(e) => {
                                    if (!m.hasAccounts || !m.isAllowed) {
                                        e.preventDefault()
                                        return
                                    }
                                }}
                            >
                                <RadioGroupItem value={m.id} id={`method-${m.id}`} className="sr-only" disabled={!m.hasAccounts || !m.isAllowed} />
                                <div className={`p-2 rounded-lg bg-background border ${m.color}`}>
                                    <m.icon className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">{m.label}</span>
                                    {!m.isAllowed ? (
                                        <span className="text-[8px] font-bold text-rose-500 uppercase">No Disponible</span>
                                    ) : !m.hasAccounts && (
                                        <span className="text-[8px] font-bold text-destructive uppercase">Sin Configurar</span>
                                    )}
                                </div>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>

                {(paymentData.amount > 0 && paymentData.method) && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs text-muted-foreground border border-dashed">
                        <span className="font-semibold uppercase">
                            {paymentData.method === 'CASH' ? 'Efectivo' :
                                paymentData.method === 'CARD' ? 'Tarjeta' : 'Transferencia'}:
                        </span>
                        {paymentData.isPending ? (
                            <span className="text-amber-600 font-bold">Pendiente de registro</span>
                        ) : (
                            <>
                                {(paymentData.method === 'CARD' || paymentData.method === 'TRANSFER') && (
                                    <span>Tx: {paymentData.transactionNumber || "---"} • </span>
                                )}
                                {paymentData.treasuryAccountId && (
                                    <span>Cuenta: {filteredAccounts.find(a => a.id.toString() === paymentData.treasuryAccountId)?.name}</span>
                                )}
                            </>
                        )}
                        <Button variant="ghost" size="sm" className="h-auto p-1 ml-auto text-primary" onClick={openAmountModal}>
                            Editar
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

                        {(paymentData.method === 'CARD' || paymentData.method === 'TRANSFER') && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="modal-tx" className="flex items-center justify-between">
                                        <span>N° Transacción</span>
                                        {!tempIsPending && <span className="text-[10px] text-destructive font-bold">* Requerido</span>}
                                    </Label>
                                    <Input
                                        id="modal-tx"
                                        value={tempTx}
                                        onChange={(e) => setTempTx(e.target.value)}
                                        placeholder="Ingrese N° de operación..."
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

                        {filteredAccounts.length > 0 && (
                            <div className="space-y-2">
                                <Label htmlFor="modal-account">Cuenta Origen / Caja</Label>
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
