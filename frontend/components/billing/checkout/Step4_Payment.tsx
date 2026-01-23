"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Banknote, CreditCard, Building2, Wallet, AlertCircle, ShieldCheck } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
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

    const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
    const [tempAmount, setTempAmount] = useState("")
    const [tempTx, setTempTx] = useState("")
    const [tempAccount, setTempAccount] = useState("")
    const [tempIsPending, setTempIsPending] = useState(false)

    const formData = data || {
        method: '',
        amount: total,
        treasury_account_id: '',
        transaction_number: '',
        is_pending: false
    }

    const handleMethodChange = (val: string) => {
        // Find filtered accounts for the NEW method immediately to help auto-selection
        const nextFiltered = accounts.filter(acc => {
            if (val === 'CASH') return acc.allows_cash
            if (val === 'CARD') return acc.allows_card
            if (val === 'TRANSFER') return acc.allows_transfer
            return false
        })

        const defaultAccount = nextFiltered.length === 1 ? nextFiltered[0].id.toString() : (formData.treasury_account_id || "")

        setData({ ...formData, method: val, treasury_account_id: defaultAccount })
        setTempAmount(formData.amount ? formData.amount.toString() : "")
        setTempTx(formData.transaction_number || "")
        setTempAccount(defaultAccount)
        setTempIsPending(formData.is_pending || false)
        setIsAmountModalOpen(true)
    }

    const handleAmountConfirm = () => {
        if (formData.method === 'TRANSFER' && !tempIsPending && !tempTx) {
            alert("Para transferencias, debe ingresar el N° de Transacción o marcar como pendiente.")
            return
        }

        const parsed = parseFloat(tempAmount)
        const cappedAmount = Math.min(parsed || 0, total)

        setData({
            ...formData,
            amount: cappedAmount,
            transaction_number: tempTx,
            treasury_account_id: tempAccount,
            is_pending: tempIsPending
        })
        setIsAmountModalOpen(false)
    }

    const openAmountModal = () => {
        setTempAmount(formData.amount ? formData.amount.toString() : "")
        setTempTx(formData.transaction_number || "")
        setTempAccount(formData.treasury_account_id || "")
        setTempIsPending(formData.is_pending || false)
        setIsAmountModalOpen(true)
    }

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
            setData({ ...formData, treasury_account_id: filteredAccounts[0].id.toString() })
        } else if (filteredAccounts.length === 0 && formData.treasury_account_id) {
            setData({ ...formData, treasury_account_id: "" })
        }
    }, [filteredAccounts, formData.method])

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

    const balance = total - formData.amount
    const hasBalance = balance > 0
    const assignmentText = isCreditNote ? 'Abonar a Crédito' : 'Cargar a Crédito'

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1 text-left">
                <h3 className=" font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-primary" />
                    {isCreditNote ? 'Devolución de Pago' : 'Registro de Cobro'}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {isCreditNote
                        ? 'Indique cómo se realizará la devolución del dinero al cliente.'
                        : 'Registre el pago adicional recibido por este ajuste.'}
                </p>
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex justify-between items-center">
                <div>
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                        {isCreditNote ? 'Total Devolución' : 'Total a Cobrar'}
                    </Label>
                    <p className="text-2xl font-black text-primary tabular-nums">
                        {formatCurrency(total)}
                    </p>
                </div>
                <Wallet className="h-8 w-8 text-primary/20" />
            </div>

            {accounts.length === 0 && (
                <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm font-bold">Sin Métodos de Pago</AlertTitle>
                    <AlertDescription className="text-xs mt-1">
                        No hay cuentas de tesorería configuradas en el sistema.
                        <Link href="/treasury/accounts" className="font-bold underline ml-1 hover:text-destructive/80">
                            Configurar ahora
                        </Link>
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Método de {isCreditNote ? 'Devolución' : 'Pago'}
                </Label>
                <RadioGroup
                    value={formData.method}
                    onValueChange={handleMethodChange}
                    className="grid grid-cols-3 gap-4"
                >
                    {methods.map((m) => (
                        <div key={m.id} className="relative group">
                            <Label
                                htmlFor={`method-${m.id}`}
                                className={`flex items-center gap-3 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary transition-all h-20 ${formData.method === m.id ? 'border-primary bg-primary/5' : ''} ${!m.hasAccounts ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <RadioGroupItem value={m.id} id={`method-${m.id}`} className="sr-only" disabled={!m.hasAccounts} />
                                <div className={`p-2 rounded-lg bg-background border ${m.color}`}>
                                    <m.icon className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase tracking-tight">{m.label}</span>
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
                        <Label htmlFor="pay-amount" className="text-xs font-black uppercase text-muted-foreground tracking-tighter">
                            {isCreditNote ? 'Monto Devuelto' : 'Monto Recibido'}
                        </Label>
                        <Input
                            id="pay-amount"
                            type="text"
                            value={formatCurrency(formData.amount)}
                            readOnly
                            onClick={openAmountModal}
                            className="h-10 cursor-pointer hover:bg-muted/50 font-bold tabular-nums rounded-xl border-2"
                        />
                    </div>
                    {hasBalance && (
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-amber-600 flex items-center gap-2">
                                <ShieldCheck className="h-3 w-3" />
                                {assignmentText}
                            </Label>
                            <div className="h-10 flex items-center px-3 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-700 font-bold text-sm tabular-nums">
                                {formatCurrency(balance)}
                            </div>
                        </div>
                    )}
                </div>

                {(formData.amount > 0 && (formData.method === 'CARD' || formData.method === 'TRANSFER')) && (
                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl text-[10px] text-muted-foreground border border-dashed border-muted-foreground/30">
                        <span className="font-black uppercase tracking-wider">{formData.method === 'CARD' ? 'Tarjeta' : 'Transferencia'}:</span>
                        {formData.is_pending ? (
                            <span className="text-amber-600 font-black uppercase tracking-wider">Pendiente de registro</span>
                        ) : (
                            <>
                                <span className="font-bold">TX: {formData.transaction_number || "---"}</span>
                                {formData.treasury_account_id && (
                                    <span className="font-bold tracking-tight">• CUENTA: {filteredAccounts.find(a => a.id.toString() === formData.treasury_account_id)?.name}</span>
                                )}
                            </>
                        )}
                        <Button variant="ghost" size="sm" className="h-auto p-0 ml-auto text-primary font-black uppercase text-[10px] hover:bg-transparent" onClick={openAmountModal}>
                            Editar
                        </Button>
                    </div>
                )}
            </div>

            <Dialog open={isAmountModalOpen} onOpenChange={setIsAmountModalOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl p-8">
                    <DialogHeader>
                        <DialogTitle className="font-black tracking-tighter uppercase text-xl text-left">Monto Recibido</DialogTitle>
                        <DialogDescription className="text-left font-medium text-xs">
                            Ingrese el monto {isCreditNote ? 'devuelto' : 'recibido'} para este ajuste.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-3">
                            <Label htmlFor="modal-amount" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Monto</Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl text-muted-foreground">$</span>
                                <Input
                                    id="modal-amount"
                                    type="number"
                                    className="h-16 pl-10 font-black text-3xl tabular-nums rounded-2xl border-2 focus:ring-primary/20"
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
                        </div>

                        {(formData.method === 'CARD' || formData.method === 'TRANSFER') && (
                            <div className="space-y-3">
                                <Label htmlFor="modal-tx" className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-muted-foreground">
                                    <span>N° Transacción</span>
                                    {formData.method === 'TRANSFER' && !tempIsPending && <span className="text-[10px] text-rose-500 font-black ml-1 uppercase tracking-tighter border-b border-rose-500/20">* Requerido</span>}
                                </Label>
                                <Input
                                    id="modal-tx"
                                    className="h-12 font-bold rounded-xl border-2 uppercase"
                                    value={tempTx}
                                    onChange={(e) => setTempTx(e.target.value)}
                                    placeholder="Ingrese N Operación..."
                                    disabled={tempIsPending}
                                />
                            </div>
                        )}

                        {filteredAccounts.length > 1 && (
                            <div className="space-y-3">
                                <Label htmlFor="modal-account" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cuenta Destino</Label>
                                <select
                                    id="modal-account"
                                    className="flex h-12 w-full rounded-xl border-2 bg-background px-4 py-2 font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-primary/50 uppercase"
                                    value={tempAccount}
                                    onChange={(e) => setTempAccount(e.target.value)}
                                >
                                    <option value="" className="font-bold">Seleccionar cuenta...</option>
                                    {filteredAccounts.map((acc) => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {(formData.method === 'CARD' || formData.method === 'TRANSFER') && (
                            <div className="flex items-center space-x-3 pt-2 p-4 bg-amber-500/5 rounded-xl border border-amber-500/10">
                                <Checkbox
                                    id="modal-pending"
                                    checked={tempIsPending}
                                    onCheckedChange={(checked) => {
                                        const isChecked = !!checked;
                                        setTempIsPending(isChecked);
                                        if (isChecked) setTempTx("");
                                    }}
                                    className="h-6 w-6 rounded-lg"
                                />
                                <div className="flex flex-col">
                                    <Label htmlFor="modal-pending" className="text-sm font-black text-amber-950 cursor-pointer uppercase tracking-tight">
                                        Informar Transacción Luego
                                    </Label>
                                    <p className="text-[10px] text-amber-700 font-medium">Se registrará como movimiento pendiente para conciliación.</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="gap-3 sm:justify-end border-t pt-6">
                        <Button type="button" variant="ghost" onClick={() => setIsAmountModalOpen(false)} className="font-bold uppercase tracking-widest text-xs">
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleAmountConfirm} className="bg-primary font-black uppercase tracking-widest text-xs px-8 h-12 rounded-xl">
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}

