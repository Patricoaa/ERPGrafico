"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Banknote, CreditCard, Building2, ClipboardList, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { useAllowedPaymentMethods, PaymentMethod } from "@/hooks/useAllowedPaymentMethods"
import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Numpad } from "@/components/ui/numpad"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

export interface PaymentData {
    method: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | null
    amount: number
    treasuryAccountId: string | null
    paymentMethodId: number | null
    transactionNumber?: string
    isPending?: boolean
}

interface PaymentMethodCardSelectorProps {
    operation: 'sales' | 'purchases'
    terminalId?: number
    total: number
    paymentData: PaymentData
    onPaymentDataChange: (data: PaymentData) => void
    labels?: {
        totalLabel?: string
        amountLabel?: string
        differencePositiveLabel?: string
        differenceNegativeLabel?: string
        amountModalTitle?: string
        amountModalDescription?: string
    }
}

export function PaymentMethodCardSelector({
    operation,
    terminalId,
    total,
    paymentData,
    onPaymentDataChange,
    labels = {}
}: PaymentMethodCardSelectorProps) {
    const {
        totalLabel = 'Total',
        amountLabel = 'Monto',
        differencePositiveLabel = 'Vuelto',
        differenceNegativeLabel = 'Deuda Pendiente',
        amountModalTitle = 'Monto',
        amountModalDescription = 'Ingrese el monto para este pago.'
    } = labels

    const { methods: allowedMethods, loading: loadingMethods } = useAllowedPaymentMethods({
        terminalId,
        operation,
        enabled: true
    })

    const isMethodAllowed = (methodId: string) => {
        if (loadingMethods) return true
        if (!allowedMethods.length) return false

        switch (methodId) {
            case 'CASH':
                return allowedMethods.some(m => m.method_type === 'CASH')
            case 'CARD':
                return allowedMethods.some(m => ['CREDIT_CARD', 'DEBIT_CARD', 'CARD_TERMINAL'].includes(m.method_type))
            case 'TRANSFER':
                return allowedMethods.some(m => m.method_type === 'TRANSFER')
            case 'CHECK':
                return allowedMethods.some(m => m.method_type === 'CHECK')
            default:
                return false
        }
    }

    const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
    const [tempAmount, setTempAmount] = useState("")

    const handleMethodChange = (val: string) => {
        const isReClick = paymentData.method === val
        onPaymentDataChange({ ...paymentData, method: val as any })
        if (isReClick) {
            openAmountModal()
        } else {
            setTempAmount((paymentData.amount || 0).toString())
            setIsAmountModalOpen(true)
        }
    }

    const handleAmountConfirm = () => {
        const parsed = parseFloat(tempAmount)
        const finalAmount = parsed || 0
        onPaymentDataChange({
            ...paymentData,
            amount: finalAmount
        })
        setIsAmountModalOpen(false)
    }

    const openAmountModal = () => {
        setTempAmount((paymentData.amount || 0).toString())
        setIsAmountModalOpen(true)
    }

    const methodsForType = useMemo<PaymentMethod[]>(() => {
        return allowedMethods.filter(m => {
            if (paymentData.method === 'CASH') return m.method_type === 'CASH'
            if (paymentData.method === 'CARD') return ['CREDIT_CARD', 'DEBIT_CARD', 'CARD_TERMINAL'].includes(m.method_type)
            if (paymentData.method === 'TRANSFER') return m.method_type === 'TRANSFER'
            if (paymentData.method === 'CHECK') return m.method_type === 'CHECK'
            return false
        })
    }, [allowedMethods, paymentData.method])

    useEffect(() => {
        // Auto-select: If there is at least one candidate account/method
        if (methodsForType.length >= 1) {
            const currentAccountId = paymentData.treasuryAccountId?.toString();
            // If the current account ID is not associated with any of the allowed methods for this type, select the first one
            const isValid = methodsForType.some(m => m.treasury_account.toString() === currentAccountId);

            if (!isValid) {
                onPaymentDataChange({
                    ...paymentData,
                    treasuryAccountId: methodsForType[0].treasury_account.toString(),
                    paymentMethodId: methodsForType[0].id
                });
            }
        } else if (methodsForType.length === 0 && paymentData.treasuryAccountId) {
            onPaymentDataChange({ ...paymentData, treasuryAccountId: null, paymentMethodId: null });
        }
    }, [methodsForType, paymentData.method])

    const terminalHasCardTerminal = useMemo(() => {
        return allowedMethods.some(m => m.method_type === 'CARD_TERMINAL')
    }, [allowedMethods])

    const methods = useMemo(() => {
        const availableMethods = [
            {
                id: 'CASH',
                label: 'Efectivo',
                icon: Banknote,
                color: 'text-emerald-600',
                isAllowed: isMethodAllowed('CASH')
            },
            {
                id: 'CARD',
                label: `Tarjeta${terminalHasCardTerminal && operation === 'sales' ? ' (terminal de cobro)' : ''}`,
                icon: CreditCard,
                color: 'text-blue-600',
                isAllowed: isMethodAllowed('CARD')
            },
            {
                id: 'TRANSFER',
                label: 'Transferencia',
                icon: Building2,
                color: 'text-purple-600',
                isAllowed: isMethodAllowed('TRANSFER')
            },
            {
                id: 'CHECK',
                label: 'Cheque',
                icon: ClipboardList,
                color: 'text-amber-600',
                isAllowed: isMethodAllowed('CHECK')
            }
        ]

        return availableMethods.filter(m => m.isAllowed)
    }, [allowedMethods, terminalHasCardTerminal, isMethodAllowed, operation])

    const difference = paymentData.amount - total

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex justify-between items-center h-24">
                    <div>
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">{totalLabel}</Label>
                        <p className="text-xl font-bold text-primary">
                            {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10 flex justify-between items-center h-24">
                    <div>
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">{amountLabel}</Label>
                        <p className="text-xl font-bold text-blue-600">
                            {Number(paymentData.amount || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                        </p>
                    </div>
                </div>

                {paymentData.amount > 0 && (
                    <div className={cn(
                        "p-4 rounded-xl border flex justify-between items-center h-24 shadow-sm transition-all animate-in zoom-in-95 duration-200",
                        difference >= 0
                            ? "bg-emerald-500/5 border-emerald-500/10"
                            : "bg-orange-500/5 border-orange-500/10"
                    )}>
                        <div>
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                                {difference >= 0 ? differencePositiveLabel : differenceNegativeLabel}
                            </Label>
                            <p className={cn(
                                "text-xl font-bold",
                                difference >= 0 ? "text-emerald-600" : "text-orange-600"
                            )}>
                                {Math.abs(difference).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Payment Method Cards */}
            <div className="space-y-4">
                <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Método de Pago</Label>
                <RadioGroup
                    value={paymentData.method || ''}
                    onValueChange={handleMethodChange}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    {methods.map((m) => (
                        <div key={m.id} className="relative group h-full">
                            <Label
                                htmlFor={`method-${m.id}`}
                                className={`flex flex-col gap-4 rounded-2xl border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary transition-all h-full ${paymentData.method === m.id ? 'border-primary bg-primary/5 shadow-md scale-[1.01]' : ''} ${!m.isAllowed ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                                onClick={(e) => {
                                    if (!m.isAllowed) {
                                        e.preventDefault()
                                        return
                                    }
                                    if (paymentData.method === m.id && m.id !== 'TRANSFER') {
                                        openAmountModal()
                                    }
                                }}
                            >
                                <RadioGroupItem value={m.id} id={`method-${m.id}`} className="sr-only" disabled={!m.isAllowed} />
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-xl bg-background border shadow-sm ${m.color}`}>
                                        <m.icon className="h-8 w-8" />
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <span className="text-xl font-black uppercase tracking-tighter">{m.label}</span>
                                        {!m.isAllowed && (
                                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">No Disponible</span>
                                        )}
                                    </div>
                                </div>

                                {paymentData.method === m.id && (
                                    <div className="mt-2 space-y-3 pt-3 border-t w-full animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                                        {(m.id === 'TRANSFER' || m.id === 'CHECK') && (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                                                    {m.id === 'CHECK' ? 'N° de Cheque' : 'N° Operación / Folio'}
                                                </Label>
                                                <Input
                                                    className="bg-background h-9"
                                                    placeholder={m.id === 'CHECK' ? "Ej: 000123" : "Ej: 123456"}
                                                    value={paymentData.transactionNumber || ""}
                                                    onChange={(e) => onPaymentDataChange({ ...paymentData, transactionNumber: e.target.value })}
                                                    disabled={paymentData.isPending}
                                                />
                                            </div>
                                        )}

                                        {methodsForType.length > 1 && (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                                                    {paymentData.method === 'TRANSFER' ? 'Seleccionar Banco / Cuenta' : 'Seleccionar Cuenta'}
                                                </Label>
                                                <select
                                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:ring-1 focus:ring-primary outline-none"
                                                    value={paymentData.treasuryAccountId || ""}
                                                    onChange={(e) => {
                                                        const selectedMethod = methodsForType.find(m => m.treasury_account.toString() === e.target.value)
                                                        onPaymentDataChange({
                                                            ...paymentData,
                                                            treasuryAccountId: e.target.value,
                                                            paymentMethodId: selectedMethod?.id || null
                                                        })
                                                    }}
                                                >
                                                    {methodsForType.map((m) => (
                                                        <option key={m.id} value={m.treasury_account}>
                                                            {m.name} ({m.treasury_account_name})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {m.id === 'TRANSFER' && (
                                            <div className="flex items-center space-x-2 pt-1">
                                                <Checkbox
                                                    id="card-pending"
                                                    checked={paymentData.isPending || false}
                                                    onCheckedChange={(checked) => {
                                                        onPaymentDataChange({
                                                            ...paymentData,
                                                            isPending: !!checked,
                                                            transactionNumber: checked ? "" : paymentData.transactionNumber
                                                        })
                                                    }}
                                                />
                                                <Label htmlFor="card-pending" className="text-xs cursor-pointer font-medium leading-none">
                                                    Pendiente (Ingresar luego)
                                                </Label>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            {/* Numpad Modal */}
            <Dialog open={isAmountModalOpen} onOpenChange={setIsAmountModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{amountModalTitle}</DialogTitle>
                        <DialogDescription>
                            {amountModalDescription}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-4">
                            <Label htmlFor="modal-amount">Monto</Label>
                            <div className="flex flex-col items-center gap-4">
                                <div className="text-4xl font-black tracking-tight text-blue-600 bg-blue-50 px-6 py-2 rounded-2xl border-2 border-blue-100 shadow-sm w-full text-center">
                                    ${Number(tempAmount || 0).toLocaleString('es-CL')}
                                </div>

                                <div className="grid grid-cols-3 gap-2 w-full">
                                    {[50, 100, 500, 1000, 2000, 5000, 10000, 20000].map(val => (
                                        <Button
                                            key={val}
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-10 font-bold"
                                            onClick={() => {
                                                const current = parseFloat(tempAmount) || 0;
                                                setTempAmount((current + val).toString());
                                            }}
                                        >
                                            +${val.toLocaleString('es-CL')}
                                        </Button>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-10 font-bold border-primary text-primary col-span-1"
                                        onClick={() => setTempAmount(total.toString())}
                                    >
                                        Exacto
                                    </Button>
                                </div>

                                <Numpad
                                    value={tempAmount}
                                    onChange={setTempAmount}
                                    onConfirm={handleAmountConfirm}
                                    onClose={() => setIsAmountModalOpen(false)}
                                    allowDecimal={false}
                                    hideDisplay={true}
                                    className="border-none shadow-none p-0 w-full max-w-none"
                                    confirmLabel="CONFIRMAR"
                                />
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
