"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
    CreditCard,
    Banknote,
    Wallet,
    ShieldCheck
} from "lucide-react"
import api from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

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

    // Default form data handled by parent, but safe access here
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

    const filteredAccounts = accounts.filter(a => {
        if (formData.method === 'CASH') return a.allows_cash
        if (formData.method === 'CARD') return a.allows_card
        if (formData.method === 'TRANSFER') return a.allows_transfer
        return false
    })

    const balance = total - formData.amount
    const hasBalance = balance > 0
    const assignmentText = isCreditNote ? 'Abonar a Crédito de Cliente' : 'Cargar a Crédito de Cliente'

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <Wallet className="h-7 w-7 text-primary" />
                    {isCreditNote ? 'Devolución de Pago' : 'Registro de Cobro'}
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                    {isCreditNote
                        ? 'Indique cómo se realizará la devolución del dinero al cliente.'
                        : 'Registre el pago adicional recibido por este ajuste.'}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { id: 'CASH', label: 'Efectivo', icon: Banknote, desc: 'Dinero en caja' },
                    { id: 'TRANSFER', label: 'Transferencia', icon: CreditCard, desc: 'Depósito bancario' },
                    { id: 'CARD', label: 'Tarjeta', icon: CreditCard, desc: 'Transbank / Webpay' }
                ].map((m) => (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => setField('method', formData.method === m.id ? '' : m.id)} // Toggle off
                        className={cn(
                            "flex flex-col items-center justify-center p-6 border-2 rounded-2xl transition-all gap-2",
                            formData.method === m.id
                                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                : "border-muted/20 hover:border-primary/40 bg-card"
                        )}
                    >
                        <m.icon className={cn("h-6 w-6", formData.method === m.id ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-black uppercase text-[10px] tracking-widest">{m.label}</span>
                    </button>
                ))}
            </div>

            <Card className="border-2 rounded-2xl shadow-sm border-muted/20 overflow-hidden bg-card">
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Amount */}
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Monto a {isCreditNote ? 'Devolver' : 'Cobrar'}</Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl text-muted-foreground">$</span>
                                <Input
                                    type="number"
                                    className="h-14 pl-10 font-black text-2xl tabular-nums rounded-xl border-2"
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
                                <div className="p-3 bg-muted/10 rounded-xl border-l-4 border-muted flex items-center gap-3">
                                    <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Saldo Restante</span>
                                        <span className="font-bold text-sm text-foreground">{assignmentText}: ${balance.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Treasury Account */}
                        {formData.method && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Cuenta de Tesorería</Label>
                                <Select
                                    value={formData.treasury_account_id}
                                    onValueChange={(val) => setField('treasury_account_id', val)}
                                >
                                    <SelectTrigger className="h-14 font-bold rounded-xl border-2">
                                        <SelectValue placeholder="Seleccione cuenta..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredAccounts.map(a => (
                                            <SelectItem key={a.id} value={a.id.toString()} className="font-bold uppercase text-xs">
                                                {a.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {(formData.method === 'TRANSFER' || formData.method === 'CARD') && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter">N° Comprobante / Transacción</Label>
                            <Input
                                placeholder="Ej: 12345678"
                                className="h-14 font-bold rounded-xl border-2"
                                value={formData.transaction_number}
                                onChange={(e) => setField('transaction_number', e.target.value)}
                            />
                        </div>
                    )}

                    <div className="p-6 bg-primary/5 border-2 border-primary/10 rounded-2xl flex items-start gap-4">
                        <Checkbox
                            id="audit"
                            checked={formData.is_pending}
                            onCheckedChange={(val) => setField('is_pending', !!val)}
                            className="h-6 w-6 rounded-lg border-2 border-primary/30 mt-0.5"
                        />
                        <div className="space-y-1">
                            <Label htmlFor="audit" className="text-sm font-black text-primary cursor-pointer uppercase tracking-tight">
                                Requiere Conciliación / Auditoría
                            </Label>
                            <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                                Marque si el movimiento de dinero debe ser validado posteriormente por el equipo de finanzas.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
