"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Banknote, CreditCard, Building2, ClipboardList, Wallet } from "lucide-react"
import { useState, useEffect } from "react"
import api from "@/lib/api"

interface Step2_PaymentProps {
    paymentData: any
    setPaymentData: (data: any) => void
    total: number
}

export function Step2_Payment({ paymentData, setPaymentData, total }: Step2_PaymentProps) {
    const [accounts, setAccounts] = useState<any[]>([])

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await api.get('/treasury/accounts/')
                setAccounts(response.data.results || response.data)
            } catch (error) {
                console.error("Failed to fetch treasury accounts", error)
            }
        }
        fetchAccounts()
    }, [])

    const methods = [
        { id: 'CASH', label: 'Efectivo', icon: Banknote, color: 'text-emerald-600' },
        { id: 'CARD', label: 'Tarjeta', icon: CreditCard, color: 'text-blue-600' },
        { id: 'TRANSFER', label: 'Transferencia', icon: Building2, color: 'text-purple-600' },
        { id: 'CREDIT', label: 'Crédito', icon: ClipboardList, color: 'text-orange-600' },
    ]

    return (
        <div className="space-y-6">
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex justify-between items-center">
                <div>
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Total a Cobrar</Label>
                    <p className="text-2xl font-bold text-primary">
                        {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </p>
                </div>
                <Wallet className="h-8 w-8 text-primary/20" />
            </div>

            <div className="space-y-4">
                <Label className="text-sm font-semibold">Método de Pago</Label>
                <RadioGroup
                    value={paymentData.method}
                    onValueChange={(val) => setPaymentData({ ...paymentData, method: val })}
                    className="grid grid-cols-2 gap-4"
                >
                    {methods.map((m) => (
                        <Label
                            key={m.id}
                            htmlFor={`method-${m.id}`}
                            className={`flex items-center gap-3 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer transition-all ${paymentData.method === m.id ? 'border-primary bg-primary/5' : ''}`}
                        >
                            <RadioGroupItem value={m.id} id={`method-${m.id}`} className="sr-only" />
                            <div className={`p-2 rounded-lg bg-background border ${m.color}`}>
                                <m.icon className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium">{m.label}</span>
                        </Label>
                    ))}
                </RadioGroup>
            </div>

            <div className="space-y-4 animate-in fade-in duration-300">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="pay-amount" className="text-xs font-bold uppercase">Monto Recibido</Label>
                        <Input
                            id="pay-amount"
                            type="number"
                            value={paymentData.amount}
                            onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                    {paymentData.amount > total && paymentData.method === 'CASH' && (
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-emerald-600">Vuelto</Label>
                            <div className="h-10 flex items-center px-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold">
                                {(paymentData.amount - total).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                            </div>
                        </div>
                    )}
                </div>

                {(paymentData.method === 'CARD' || paymentData.method === 'TRANSFER') && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="tx-number" className="text-xs font-bold uppercase">N° Transacción / Operación</Label>
                            <Input
                                id="tx-number"
                                placeholder="Ej: 123456"
                                value={paymentData.transactionNumber}
                                onChange={(e) => setPaymentData({ ...paymentData, transactionNumber: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="account" className="text-xs font-bold uppercase">Cuenta Destino</Label>
                            <select
                                id="account"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={paymentData.treasuryAccountId || ""}
                                onChange={(e) => setPaymentData({ ...paymentData, treasuryAccountId: e.target.value })}
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
