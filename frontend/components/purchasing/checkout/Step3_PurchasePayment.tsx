"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Banknote, CreditCard, Building2, Wallet, AlertCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect, useMemo } from "react"
import api from "@/lib/api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"

interface Step3_PurchasePaymentProps {
    paymentData: any
    setPaymentData: (data: any) => void
    total: number
}

export function Step3_PurchasePayment({ paymentData, setPaymentData, total }: Step3_PurchasePaymentProps) {
    const [accounts, setAccounts] = useState<any[]>([])

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await api.get('/treasury/accounts/')
                const results = response.data.results || response.data
                setAccounts(results)
            } catch (error) {
                console.error("Failed to fetch treasury accounts", error)
            }
        }
        fetchAccounts()
    }, [])

    // Initialize amount to total if not set
    useEffect(() => {
        if (paymentData.amount === 0 || !paymentData.amount) {
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
        }
    ]

    return (
        <div className="space-y-6">
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

            {paymentData.amount > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <Label className="text-sm font-semibold">Método de Pago</Label>
                    <RadioGroup
                        value={paymentData.method}
                        onValueChange={(val) => setPaymentData({ ...paymentData, method: val })}
                        className="grid grid-cols-3 gap-4"
                    >
                        {methods.map((m) => (
                            <div key={m.id} className="relative group">
                                <Label
                                    htmlFor={`method-${m.id}`}
                                    className={`flex items-center gap-3 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [\u0026:has([data-state=checked])]:border-primary transition-all ${paymentData.method === m.id ? 'border-primary bg-primary/5' : ''} ${!m.hasAccounts ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
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

                    {(paymentData.method === 'CARD' || paymentData.method === 'TRANSFER') && (
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tx-number" className="text-xs font-bold uppercase flex items-center justify-between">
                                        N° Transacción
                                        {paymentData.isPending && <span className="text-[8px] text-amber-600 font-bold uppercase">Ingresar luego</span>}
                                    </Label>
                                    <Input
                                        id="tx-number"
                                        placeholder="Ej: 123456"
                                        value={paymentData.transactionNumber}
                                        onChange={(e) => setPaymentData({ ...paymentData, transactionNumber: e.target.value })}
                                        disabled={paymentData.isPending}
                                        required={!paymentData.isPending && paymentData.method === 'TRANSFER'}
                                    />
                                </div>

                                {filteredAccounts.length > 1 && (
                                    <div className="space-y-2">
                                        <Label htmlFor="account" className="text-xs font-bold uppercase">Cuenta Origen</Label>
                                        <select
                                            id="account"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            value={paymentData.treasuryAccountId || ""}
                                            onChange={(e) => setPaymentData({ ...paymentData, treasuryAccountId: e.target.value })}
                                        >
                                            <option value="">Seleccionar cuenta...</option>
                                            {filteredAccounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {paymentData.method === 'TRANSFER' && (
                                <div className="flex items-center space-x-2 pt-2">
                                    <Checkbox
                                        id="pending-tx"
                                        checked={paymentData.isPending}
                                        onCheckedChange={(checked) => setPaymentData({ ...paymentData, isPending: !!checked, transactionNumber: !!checked ? "" : paymentData.transactionNumber })}
                                    />
                                    <Label htmlFor="pending-tx" className="text-xs font-medium cursor-pointer">
                                        Informar N° de transferencia luego (Pendiente de Validación)
                                    </Label>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className={`grid gap-4 ${pendingDebt > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div className="space-y-2">
                    <Label htmlFor="pay-amount" className="text-sm font-semibold">Monto a Pagar Ahora</Label>
                    <Input
                        id="pay-amount"
                        type="number"
                        value={paymentData.amount}
                        max={total}
                        onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                        className="text-lg font-semibold"
                    />
                    <p className="text-xs text-muted-foreground">
                        Puede pagar el total o un monto parcial. La diferencia quedará como deuda pendiente.
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
        </div>
    )
}
