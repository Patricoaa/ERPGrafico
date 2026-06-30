"use client"

import { Banknote, CreditCard, Building2, ClipboardList, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAllowedPaymentMethods, type PaymentMethod } from "@/hooks/useAllowedPaymentMethods"
import { useBanks } from '../hooks/useMasterData'
import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { BaseModal, Numpad } from '@/components/shared'

import { FormSection, LabeledInput, LabeledSelect, MoneyDisplay } from "@/components/shared"
import { formatMoney } from "@/lib/money"

export interface PaymentData {
    method: 'CASH' | 'CARD' | 'CARD_TERMINAL' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'CHECK' | 'CREDIT_BALANCE' | null
    amount: number
    treasuryAccountId: string | null
    paymentMethodId: number | null
    isPending?: boolean
    checkNumber?: string
    /** true cuando el método es CARD_TERMINAL — activa flujo TUU automatizado */
    isTerminalIntegration?: boolean
    /** CHECK: banco emisor del cheque */
    checkBankId?: number | null
    /** CHECK: fecha de vencimiento (ISO date string) */
    checkDueDate?: string
    /** CREDIT_CARD: cantidad de cuotas (default 1 = pago único) */
    installments?: number
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
    customerCreditBalance?: number
    allowCreditBalanceAccumulation?: boolean
    /** Componente renderizado entre los labels de resumen y los métodos de pago */
    methodTitle?: React.ReactNode
}

export function PaymentMethodSelector({
    operation,
    terminalId,
    total,
    paymentData,
    onPaymentDataChange,
    labels = {},
    customerCreditBalance = 0,
    allowCreditBalanceAccumulation = false,
    methodTitle
}: PaymentMethodCardSelectorProps) {
    const {
        amountModalTitle = 'Monto',
        amountModalDescription = 'Ingrese el monto para este pago.'
    } = labels

    const { methods: allowedMethods, loading: loadingMethods } = useAllowedPaymentMethods({
        terminalId,
        operation,
        enabled: true
    })

    const { banks } = useBanks()

    const isMethodAllowed = (methodId: string) => {
        if (loadingMethods) return true
        if (!allowedMethods.length) return false

        switch (methodId) {
            case 'CASH':
                return allowedMethods.some(m => m.method_type === 'CASH')
            case 'CARD':
                // Solo métodos CARD genéricos (no CARD_TERMINAL, no DEBIT_CARD/CREDIT_CARD ya filtrados por allow_for_sales)
                return allowedMethods.some(m => m.method_type === 'CARD')
            case 'CREDIT_CARD':
                return allowedMethods.some(m => m.method_type === 'CREDIT_CARD')
            case 'DEBIT_CARD':
                return allowedMethods.some(m => m.method_type === 'DEBIT_CARD')
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

    const handleCardClick = (methodId: string) => {
        const isReClick = paymentData.method === methodId
        const isTerminalIntegration = methodId === 'CARD_TERMINAL'

        onPaymentDataChange({
            ...paymentData,
            method: methodId as PaymentData['method'],
            isTerminalIntegration,
        })

        if (!isReClick) {
            setTempAmount((paymentData.amount || 0).toString())
            setIsAmountModalOpen(true)
        } else if (methodId !== 'TRANSFER' && methodId !== 'CREDIT_BALANCE') {
            openAmountModal()
        }
    }

    const methodsForType = useMemo<PaymentMethod[]>(() => {
        return allowedMethods.filter(m => {
            if (paymentData.method === 'CASH') return m.method_type === 'CASH'
            if (paymentData.method === 'CARD') return m.method_type === 'CARD'
            if (paymentData.method === 'CREDIT_CARD') return m.method_type === 'CREDIT_CARD'
            if (paymentData.method === 'DEBIT_CARD') return m.method_type === 'DEBIT_CARD'
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
            const isValid = methodsForType.some(m => m.treasury_account?.toString() === currentAccountId);

            if (!isValid) {
                const first = methodsForType[0]
                requestAnimationFrame(() => {
                    onPaymentDataChange({
                        ...paymentData,
                        treasuryAccountId: first.treasury_account?.toString() ?? null,
                        paymentMethodId: first.id
                    });
                })
            }
        } else if (methodsForType.length === 0 && (paymentData.treasuryAccountId || paymentData.paymentMethodId)) {
            requestAnimationFrame(() => {
                onPaymentDataChange({ ...paymentData, treasuryAccountId: null, paymentMethodId: null });
            })
        }
    }, [methodsForType, paymentData.method])

    const methods = useMemo(() => {
        const availableMethods = [
            {
                id: 'CASH' as const,
                label: 'Efectivo',
                icon: Banknote,
                color: 'text-success',
                isAllowed: isMethodAllowed('CASH')
            },
            {
                id: 'CARD' as const,
                label: 'Tarjeta',
                icon: CreditCard,
                color: 'text-primary',
                isAllowed: isMethodAllowed('CARD')
            },
            {
                id: 'CREDIT_CARD' as const,
                label: 'T. Crédito',
                icon: CreditCard,
                color: 'text-primary',
                isAllowed: isMethodAllowed('CREDIT_CARD')
            },
            {
                id: 'DEBIT_CARD' as const,
                label: 'T. Débito',
                icon: CreditCard,
                color: 'text-primary',
                isAllowed: isMethodAllowed('DEBIT_CARD')
            },
            {
                id: 'CARD_TERMINAL' as const,
                label: 'Tarjeta TUU',
                icon: CreditCard,
                color: 'text-primary',
                isAllowed: isMethodAllowed('CARD_TERMINAL')
            },
            {
                id: 'TRANSFER' as const,
                label: 'Transferencia',
                icon: Building2,
                color: 'text-primary',
                isAllowed: isMethodAllowed('TRANSFER')
            },
            {
                id: 'CHECK' as const,
                label: 'Cheque',
                icon: ClipboardList,
                color: 'text-warning',
                isAllowed: isMethodAllowed('CHECK')
            },
            {
                id: 'CREDIT_BALANCE' as const,
                label: 'Saldo a Favor',
                icon: Wallet,
                color: 'text-primary',
                isAllowed: isMethodAllowed('CREDIT_BALANCE')
            }
        ]

        return availableMethods.filter(m => m.isAllowed)
    }, [allowedMethods, isMethodAllowed, operation])

    const hasAdditionalFields = useMemo(() => {
        if (!paymentData.method) return false
        if (paymentData.method === 'CHECK') return true
        if (paymentData.method === 'CREDIT_CARD') return true
        if (paymentData.method === 'DEBIT_CARD') return true
        if (paymentData.method === 'CASH' || paymentData.method === 'CARD' || paymentData.method === 'CARD_TERMINAL' || paymentData.method === 'TRANSFER') {
            return methodsForType.filter(m => m.treasury_account != null).length > 1
        }
        return false
    }, [paymentData.method, methodsForType])

    return (
        <div className="space-y-4">
            {/* Account Details Form */}
            <div className="space-y-4">
                {methodTitle}
                <div
                    className="grid gap-4"
                    style={{
                        gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))`
                    }}
                >
                    {methods.map((m) => {
                        const isSelected = paymentData.method === m.id

                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => handleCardClick(m.id)}
                                disabled={!m.isAllowed}
                                className={cn(
                                    "card-accent-cmyk relative overflow-hidden rounded-xl border bg-card p-5 shadow-card transition-all h-full text-left flex flex-col items-start",
                                    "hover:shadow-elevated",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                    isSelected
                                        ? "border-2 border-primary accent-visible"
                                        : "border-border/50",
                                    !m.isAllowed && "opacity-40 grayscale cursor-not-allowed"
                                )}
                                aria-pressed={isSelected}
                            >
                                {/* Main row: Icon + Name + Amount */}
                                <div className="flex items-start justify-between gap-4 w-full">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <m.icon className={cn("h-10 w-10 shrink-0", m.color)} />
                                        <span className="text-lg font-semibold">{m.label}</span>
                                    </div>

                                    <div className="shrink-0">
                                        {isSelected && (
                                            m.id === 'CREDIT_BALANCE' ? (
                                                <div className="flex items-start gap-4 text-right">
                                                    {paymentData.amount > 0 && (
                                                        <div>
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">MONTO</div>
                                                            <div className="text-base font-semibold tabular-nums whitespace-nowrap">
                                                                <MoneyDisplay amount={paymentData.amount} showColor={false} />
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">DISP.</div>
                                                        <div className="text-base font-semibold tabular-nums whitespace-nowrap">
                                                            <MoneyDisplay amount={customerCreditBalance} showColor={false} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : paymentData.amount > 0 ? (
                                                <div className="text-right">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">MONTO</div>
                                                    <div className="text-base font-semibold tabular-nums whitespace-nowrap">
                                                        <MoneyDisplay amount={paymentData.amount} showColor={false} />
                                                    </div>
                                                </div>
                                            ) : null
                                        )}
                                    </div>
                                </div>

                                {/* No disponible */}
                                {!m.isAllowed && (
                                    <div className="text-[10px] font-black text-destructive uppercase tracking-widest mt-3">
                                        NO DISPONIBLE
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>

                {hasAdditionalFields && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <FormSection title="Datos Adicionales" />

                        {paymentData.method === 'CHECK' && (
                            <>
                                <LabeledInput
                                    label="N° de Cheque"
                                    placeholder="Ej: 000123"
                                    value={paymentData.checkNumber || ""}
                                    onChange={(e) => onPaymentDataChange({ ...paymentData, checkNumber: e.target.value })}
                                />
                                <LabeledSelect
                                    label="Banco Emisor"
                                    placeholder="Seleccione banco..."
                                    value={paymentData.checkBankId?.toString() || ""}
                                    onChange={(val) => onPaymentDataChange({
                                        ...paymentData,
                                        checkBankId: val ? parseInt(val) : null
                                    })}
                                    options={banks.filter(b => b.is_active).map(b => ({ value: b.id.toString(), label: b.name }))}
                                />
                                <LabeledInput
                                    label="Fecha Vencimiento"
                                    type="date"
                                    value={paymentData.checkDueDate || ""}
                                    onChange={(e) => onPaymentDataChange({ ...paymentData, checkDueDate: e.target.value })}
                                />
                            </>
                        )}

                        {paymentData.method === 'CREDIT_CARD' && (
                            <LabeledInput
                                label="N° de Cuotas"
                                type="number"
                                min={1}
                                max={36}
                                value={(paymentData.installments || 1).toString()}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1
                                    onPaymentDataChange({ ...paymentData, installments: Math.max(1, Math.min(36, val)) })
                                }}
                                placeholder="1"
                            />
                        )}

                        {paymentData.method === 'DEBIT_CARD' && (
                            <p className="text-xs text-muted-foreground">
                                Débito directo desde la cuenta vinculada.
                            </p>
                        )}

                        {(paymentData.method === 'CREDIT_CARD' || paymentData.method === 'DEBIT_CARD' || methodsForType.filter(m => m.treasury_account != null).length > 1) && (
                            <LabeledSelect
                                label={paymentData.method === 'TRANSFER' ? 'Banco / Cuenta' : paymentData.method === 'CREDIT_CARD' ? 'Tarjeta de Crédito' : paymentData.method === 'DEBIT_CARD' ? 'Tarjeta Débito' : 'Cuenta'}
                                value={paymentData.treasuryAccountId || ""}
                                onChange={(val) => {
                                    const selectedMethod = methodsForType.find(m => String(m.treasury_account) === val)
                                    onPaymentDataChange({
                                        ...paymentData,
                                        treasuryAccountId: val,
                                        paymentMethodId: selectedMethod?.id ?? null
                                    })
                                }}
                                options={methodsForType.filter(m => m.treasury_account != null).map((m) => ({
                                    value: String(m.treasury_account),
                                    label: `${m.name} (${m.treasury_account_name})`
                                }))}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Numpad Modal */}
            <BaseModal
                open={isAmountModalOpen}
                onOpenChange={setIsAmountModalOpen}
                title={amountModalTitle || "Monto"}
                description={amountModalDescription}
                className="sm:max-w-md"
                footer={
                    <Button
                        className="w-full bg-primary hover:bg-primary font-black uppercase tracking-widest text-xs lg:text-base"
                        onClick={handleAmountConfirm}
                    >
                        CONFIRMAR
                    </Button>
                }
            >
                <div className="flex flex-col items-center gap-4 overflow-y-auto">
                    <Numpad
                        value={tempAmount}
                        onChange={setTempAmount}
                        onConfirm={handleAmountConfirm}
                        onClose={() => setIsAmountModalOpen(false)}
                        allowDecimal={false}
                        hideConfirm
                        className="border-none shadow-none p-0 w-full max-w-none"
                        displayValue={formatMoney(parseFloat(tempAmount) || 0)}
                        quickAmounts={[
                            ...[50, 100, 500, 1000, 2000, 5000, 10000, 20000].map(val => ({
                                label: `+${formatMoney(val)}`,
                                value: val,
                                action: 'add' as const,
                            })),
                            { label: 'Exacto', value: total, action: 'set' as const },
                        ]}
                        onQuickAmountAction={(qa) => {
                            let newAmount: number
                            if (qa.action === 'add') {
                                const current = parseFloat(tempAmount) || 0
                                newAmount = current + qa.value
                                if (operation === 'purchases' && newAmount > total) {
                                    newAmount = total
                                }
                            } else {
                                newAmount = qa.value
                            }
                            if (operation === 'sales' && paymentData.method === 'CREDIT_BALANCE' && newAmount > customerCreditBalance) {
                                newAmount = customerCreditBalance
                            }
                            setTempAmount(newAmount.toString())
                        }}
                    />
                </div>
            </BaseModal>
        </div>
    )
}
