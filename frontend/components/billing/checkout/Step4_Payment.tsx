"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    CreditCard,
    Banknote,
    Wallet,
    ShieldCheck,
    Building2,
    AlertCircle
} from "lucide-react"
import api from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"

interface Step4_PaymentProps {
    isCreditNote: boolean
    total: number
    data: any
    setData: (data: any) => void
}

export function Step4_Payment({
    isCreditNote,
    total,
    data,
    setData
}: Step4_PaymentProps) {
    const [accounts, setAccounts] = useState<any[]>([])

    const formData = data || {
        method: '',
        amount: total,
        treasury_account_id: '',
        transaction_number: '',
        is_pending: false
    }

    const setField = (field: string, value: any) => {
        setData({ ...formData, [field]: value })
    }

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const res = await api.get('/treasury/accounts/')
                const results = res.data.results || res.data
                setAccounts(results)
            } catch (error) {
                console.error("Error fetching accounts:", error)
            }
        }
        fetchAccounts()
    }, [])

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

    const filteredAccounts = useMemo(() => {
        return accounts.filter(acc => {
            if (formData.method === 'CASH') return acc.allows_cash
            if (formData.method === 'CARD') return acc.allows_card
            if (formData.method === 'TRANSFER') return acc.allows_transfer
            return false
        })
    }, [accounts, formData.method])

    useEffect(() => {
        if (filteredAccounts.length === 1 && formData.treasury_account_id !== filteredAccounts[0].id.toString()) {
            setField('treasury_account_id', filteredAccounts[0].id.toString())
        }
    }, [filteredAccounts, formData.method])

    const balance = total - formData.amount
    const hasBalance = balance > 0
    const assignmentText = isCreditNote ? 'Abonar a Crédito de Cliente' : 'Cargar a Crédito de Cliente'

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h3 className=" font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <Wallet className="h-7 w-7 text-primary" />
                    {isCreditNote ? 'Devolución de Pago' : 'Registro de Cobro'}
                </h3>
                <p className="text-sm text-muted-foreground ">
                    {isCreditNote
                        ? 'Indique cómo se realizará la devolución del dinero al cliente.'
                        : 'Registre el pago adicional recibido por este ajuste.'}
                </p>
            </div>

            <div className="p-6 bg-primary/5 rounded-2xl border-2 border-primary/10 flex justify-between items-center shadow-sm">
                <div>
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Monto Total Ajuste</Label>
                    <p className="text-3xl font-black text-primary tabular-nums">
                        {formatCurrency(total)}
                    </p>
                </div>
                <div className="p-4 bg-primary/10 rounded-2xl">
                    <Wallet className="h-10 w-10 text-primary" />
                </div>
            </div>

            <div className="space-y-4">
                <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Método de {isCreditNote ? 'Devolución' : 'Cobro'}</Label>
                <div className="grid grid-cols-3 gap-4">
                    {methods.map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                                if (!m.hasAccounts) return
                                setField('method', formData.method === m.id ? '' : m.id)
                            }}
                            className={cn(
                                "flex items-center gap-4 p-5 border-2 rounded-2xl transition-all h-20 text-left",
                                formData.method === m.id
                                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                    : "border-muted/20 hover:border-primary/40 bg-card",
                                !m.hasAccounts && "opacity-50 grayscale cursor-not-allowed"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-xl bg-background border flex items-center justify-center shadow-sm",
                                formData.method === m.id ? m.color : "text-muted-foreground"
                            )}>
                                <m.icon className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-black uppercase text-[10px] tracking-widest truncate">{m.label}</span>
                                {!m.hasAccounts && <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">Sin Configurar</span>}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <Card className="border-2 rounded-2xl shadow-sm border-muted/20 overflow-hidden bg-card">
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Amount */}
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Monto en {formData.method ? (methods.find(m => m.id === formData.method)?.label || 'Efectivo') : 'Efectivo'}</Label>
                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-xl text-muted-foreground tracking-tighter">$</span>
                                <Input
                                    type="number"
                                    className="h-16 pl-12 font-black text-3xl tabular-nums rounded-2xl border-2 transition-all focus:ring-primary hover:border-primary/50"
                                    value={formData.amount}
                                    onChange={(e) => {
                                        let val = parseFloat(e.target.value) || 0
                                        if (val > total) val = total
                                        if (val < 0) val = 0
                                        setField('amount', val)
                                    }}
                                    max={total}
                                />
                            </div>
                            {hasBalance && (
                                <div className="p-4 bg-amber-500/5 rounded-2xl border-l-[6px] border-amber-500/20 flex items-center gap-4">
                                    <ShieldCheck className="h-6 w-6 text-amber-600" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase text-amber-700 tracking-widest">Saldo Restante</span>
                                        <span className="font-black text-sm text-amber-900">{assignmentText}: {formatCurrency(balance)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Treasury Account */}
                        {formData.method && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Cuenta de Tesorería</Label>
                                <select
                                    className="flex h-16 w-full rounded-2xl border-2 bg-background px-4 py-2 font-black text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
                                    value={formData.treasury_account_id}
                                    onChange={(e) => setField('treasury_account_id', e.target.value)}
                                >
                                    <option value="" className="font-bold">Seleccionar cuenta...</option>
                                    {filteredAccounts.map(a => (
                                        <option key={a.id} value={a.id.toString()} className="font-bold uppercase text-xs">
                                            {a.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {(formData.method === 'TRANSFER' || formData.method === 'CARD') && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                                <Building2 className="h-3 w-3" />
                                N° Comprobante / Transacción
                                {formData.method === 'TRANSFER' && !formData.is_pending && <span className="text-rose-500 ml-1 font-black">* REQUERIDO</span>}
                            </Label>
                            <Input
                                placeholder="Ej: 12345678"
                                className="h-16 font-black text-lg rounded-2xl border-2 transition-all focus:ring-primary hover:border-primary/50 uppercase placeholder:italic placeholder:font-medium"
                                value={formData.transaction_number}
                                onChange={(e) => setField('transaction_number', e.target.value)}
                                disabled={formData.is_pending}
                            />
                        </div>
                    )}

                    <div className="p-6 bg-slate-500/5 border-2 border-slate-500/10 rounded-2xl flex items-start gap-5">
                        <Checkbox
                            id="audit"
                            checked={formData.is_pending}
                            onCheckedChange={(val) => {
                                setField('is_pending', !!val)
                                if (val) setField('transaction_number', '')
                            }}
                            className="h-7 w-7 rounded-lg border-2 border-slate-500/30 data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700 mt-0.5"
                        />
                        <div className="space-y-1 leading-tight">
                            <Label htmlFor="audit" className="text-sm font-black text-slate-900 cursor-pointer uppercase tracking-tight">
                                Informar Transacción Posteriormente
                            </Label>
                            <p className="text-[11px] font-medium text-slate-700/70 leading-relaxed">
                                Marque si no cuenta con el número de operación en este momento. El movimiento quedará <strong>PENDIENTE</strong> de conciliación.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

