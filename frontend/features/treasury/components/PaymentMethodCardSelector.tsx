"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Banknote, CreditCard, Building2, ClipboardList, AlertCircle, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { useAllowedPaymentMethods, PaymentMethod } from "@/hooks/useAllowedPaymentMethods"
import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Numpad } from "@/components/ui/numpad"
import { BaseModal } from "@/components/shared/BaseModal"
import { MoneyDisplay } from "@/components/shared"
import { formatMoney } from "@/lib/money"

export interface PaymentData {
    method: 'CASH' | 'CARD' | 'CARD_TERMINAL' | 'TRANSFER' | 'CHECK' | 'CREDIT_BALANCE' | null
    amount: number
    treasuryAccountId: string | null
    paymentMethodId: number | null
    transactionNumber?: string
    isPending?: boolean
    /** true cuando el método es CARD_TERMINAL — activa flujo TUU automatizado */
    isTerminalIntegration?: boolean
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
    compactMode?: boolean
    customerCreditBalance?: number
    allowCreditBalanceAccumulation?: boolean
}

export function PaymentMethodCardSelector({
    operation,
    terminalId,
    total,
    paymentData,
    onPaymentDataChange,
    labels = {},
    compactMode = false,
    customerCreditBalance = 0,
    allowCreditBalanceAccumulation = false
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
                // Solo métodos CARD genéricos (no CARD_TERMINAL, no DEBIT_CARD/CREDIT_CARD ya filtrados por allow_for_sales)
                return allowedMethods.some(m => m.method_type === 'CARD')
            case 'CARD_TERMINAL':
                return allowedMethods.some(m => m.method_type === 'CARD_TERMINAL' && m.is_terminal_integration)
            case 'TRANSFER':
                return allowedMethods.some(m => m.method_type === 'TRANSFER')
            case 'CHECK':
                return allowedMethods.some(m => m.method_type === 'CHECK')
            case 'CREDIT_BALANCE':
                if (operation === 'sales') return customerCreditBalance > 0
                return allowCreditBalanceAccumulation
            default:
                return false
        }
    }

    const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
    const [tempAmount, setTempAmount] = useState("")

    const handleMethodChange = (val: string) => {
        const isReClick = paymentData.method === val
        const isTerminalIntegration = val === 'CARD_TERMINAL'
        onPaymentDataChange({
            ...paymentData,
            method: val as PaymentData['method'],
            isTerminalIntegration,
        })
        if (isReClick) {
            openAmountModal()
        } else {
            setTempAmount((paymentData.amount || 0).toString())
            setIsAmountModalOpen(true)
        }
    }

    const handleAmountConfirm = () => {
        const parsed = parseFloat(tempAmount)
        let finalAmount = parsed || 0

        // For purchases, limit to total (no overpayments)
        if (operation === 'purchases' && finalAmount > total) {
            finalAmount = total
        }

        // Limit sales CREDIT_BALANCE to available customer balance
        if (operation === 'sales' && paymentData.method === 'CREDIT_BALANCE' && finalAmount > customerCreditBalance) {
            finalAmount = customerCreditBalance
            // Optionally, we could show a toast here to notify the user
        }

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
            if (paymentData.method === 'CARD') return m.method_type === 'CARD'
            if (paymentData.method === 'CARD_TERMINAL') return m.method_type === 'CARD_TERMINAL'
            if (paymentData.method === 'TRANSFER') return m.method_type === 'TRANSFER'
            if (paymentData.method === 'CHECK') return m.method_type === 'CHECK'
            if (paymentData.method === 'CREDIT_BALANCE') return false // Doesn't need a treasury account
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
                requestAnimationFrame(() => {
                    onPaymentDataChange({
                        ...paymentData,
                        treasuryAccountId: methodsForType[0].treasury_account.toString(),
                        paymentMethodId: methodsForType[0].id
                    });
                })
            }
        } else if (methodsForType.length === 0 && paymentData.treasuryAccountId) {
            requestAnimationFrame(() => {
                onPaymentDataChange({ ...paymentData, treasuryAccountId: null, paymentMethodId: null });
            })
        }
    }, [methodsForType, paymentData.method])

    const methods = useMemo(() => {
        const availableMethods = [
            {
                id: 'CASH',
                label: 'Efectivo',
                icon: Banknote,
                color: 'text-success',
                isAllowed: isMethodAllowed('CASH')
            },
            {
                id: 'CARD',
                label: 'Tarjeta',
                icon: CreditCard,
                color: 'text-primary',
                isAllowed: isMethodAllowed('CARD')
            },
            {
                id: 'CARD_TERMINAL',
                label: 'Tarjeta TUU',
                icon: CreditCard,
                color: 'text-primary',
                isAllowed: isMethodAllowed('CARD_TERMINAL')
            },
            {
                id: 'TRANSFER',
                label: 'Transferencia',
                icon: Building2,
                color: 'text-primary',
                isAllowed: isMethodAllowed('TRANSFER')
            },
            {
                id: 'CHECK',
                label: 'Cheque',
                icon: ClipboardList,
                color: 'text-warning',
                isAllowed: isMethodAllowed('CHECK')
            },
            {
                id: 'CREDIT_BALANCE',
                label: 'Saldo a Favor',
                icon: Wallet,
                color: 'text-primary',
                isAllowed: isMethodAllowed('CREDIT_BALANCE')
            }
        ]

        return availableMethods.filter(m => m.isAllowed)
    }, [allowedMethods, isMethodAllowed, operation])

    const difference = paymentData.amount - total
    const showChangeCard = !(operation === 'purchases' && difference >= 0);

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={cn("bg-primary/5 rounded-lg border border-primary/10 flex justify-between items-center", compactMode ? "p-3 h-20" : "p-4 h-24")}>
                    <div>
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">{totalLabel}</Label>
                        <MoneyDisplay amount={total} className={cn("text-primary", compactMode ? "text-lg" : "text-xl")} />
                    </div>
                </div>

                <div className={cn("bg-primary/5 rounded-lg border border-primary/10 flex justify-between items-center", compactMode ? "p-3 h-20" : "p-4 h-24")}>
                    <div>
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">{amountLabel}</Label>
                        <MoneyDisplay amount={paymentData.amount || 0} className={cn("text-primary", compactMode ? "text-lg" : "text-xl")} />
                    </div>
                </div>

                {(paymentData.amount > 0 || difference < 0) && showChangeCard && (
                    <div className={cn(
                        "rounded-lg border flex justify-between items-center shadow-sm transition-all animate-in zoom-in-95 duration-200",
                        compactMode ? "p-3 h-20" : "p-4 h-24",
                        difference >= 0
                            ? "bg-success/5 border-success/10"
                            : "border-border hover:border-primary/30"
                    )}>
                        <div>
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                                {difference >= 0 ? differencePositiveLabel : differenceNegativeLabel}
                            </Label>
                            <MoneyDisplay amount={Math.abs(difference)} className={cn(
                                difference >= 0 ? "text-success" : "text-warning",
                                compactMode ? "text-lg" : "text-xl"
                            )} />
                        </div>
                    </div>
                )}
            </div>



            {/* Account Details Form */}
            <div className="space-y-4">
                <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Método de Pago</Label>
                <RadioGroup
                    value={paymentData.method || ''}
                    onValueChange={handleMethodChange}
                    className="grid gap-4"
                    style={{
                        gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))`
                    }}
                >
                    {methods.map((m) => (
                        <div key={m.id} className="relative group h-full">
                            <Label
                                htmlFor={`method-${m.id}`}
                                className={cn(
                                    "flex flex-col rounded-lg border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary transition-all h-full cursor-pointer",
                                    paymentData.method === m.id ? 'border-primary bg-primary/5 shadow-md scale-[1.01]' : '',
                                    !m.isAllowed ? 'opacity-50 grayscale cursor-not-allowed' : '',
                                    compactMode ? "gap-2 p-3" : "gap-4 p-6"
                                )}
                                onClick={(e) => {
                                    if (!m.isAllowed) {
                                        e.preventDefault()
                                        return
                                    }
                                    if (paymentData.method === m.id && m.id !== 'TRANSFER' && m.id !== 'CREDIT_BALANCE') {
                                        openAmountModal()
                                    }
                                }}
                            >
                                <RadioGroupItem value={m.id} id={`method-${m.id}`} className="sr-only" disabled={!m.isAllowed} />
                                <div className="flex flex-col items-center justify-center gap-4 h-full">
                                    <div className={cn(
                                        "rounded-lg bg-background border-2 shadow-sm flex items-center justify-center relative",
                                        m.color,
                                        compactMode ? "p-3" : "p-6"
                                    )}>
                                        {m.id === 'CREDIT_BALANCE' && operation === 'sales' && (
                                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-3 py-1 rounded-full text-xs font-black shadow-md border-2 border-white animate-in zoom-in duration-300 z-10 whitespace-nowrap">
                                                <MoneyDisplay amount={customerCreditBalance} inline className="text-white" />
                                            </div>
                                        )}
                                        <m.icon className={cn(
                                            compactMode ? "h-6 w-6" : "h-10 w-10"
                                        )} />
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className={cn(
                                            "font-black uppercase tracking-tight text-center",
                                            compactMode ? "text-xs" : "text-sm"
                                        )}>{m.label}</span>
                                        {!m.isAllowed && (
                                            <span className="text-[10px] font-black text-destructive uppercase tracking-widest">No Disponible</span>
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
            <BaseModal
                open={isAmountModalOpen}
                onOpenChange={setIsAmountModalOpen}
                title={amountModalTitle || "Monto"}
                description={amountModalDescription}
                className="sm:max-w-md"
                hideScrollArea
            >
                <div className="space-y-4 py-4 px-4">
                    <div className="space-y-4">
                        <Label htmlFor="modal-amount">Monto</Label>
                        <div className="flex flex-col items-center gap-4">
                            <div className="text-4xl font-black tracking-tight text-primary bg-primary/5 px-6 py-2 rounded-lg border-2 border-primary/10 shadow-sm w-full text-center">
                                <MoneyDisplay amount={tempAmount || 0} inline />
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
                                            let newAmount = current + val;

                                            // For purchases, limit to total
                                            if (operation === 'purchases' && newAmount > total) {
                                                newAmount = total;
                                            }

                                            setTempAmount(newAmount.toString());
                                        }}
                                    >
                                        +{formatMoney(val)}
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
            </BaseModal>
        </div>
    )
}
