"use client"

import { Banknote, CreditCard, Building2, ClipboardList, Wallet, Trash2, Pencil, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAllowedPaymentMethods, type PaymentMethod } from "@/hooks/useAllowedPaymentMethods"
import { useBanks } from '../hooks/useMasterData'
import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { BaseModal, Numpad } from '@/components/shared'

import { FormSection, LabeledInput, LabeledSelect, MoneyDisplay } from "@/components/shared"
import { formatMoney } from "@/lib/money"

export interface PaymentAllocation {
    method: string
    amount: number
    paymentMethodId: number | null
    treasuryAccountId: string | null
    isTerminalIntegration?: boolean
    isPending?: boolean
    checkNumber?: string
    checkBankId?: number | null
    checkDueDate?: string
    installments?: number
}

export interface PaymentData {
    method: 'CASH' | 'CARD' | 'CARD_TERMINAL' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'CHECK' | 'CREDIT_BALANCE' | null
    amount: number
    treasuryAccountId: string | null
    paymentMethodId: number | null
    isPending?: boolean
    checkNumber?: string
    isTerminalIntegration?: boolean
    checkBankId?: number | null
    checkDueDate?: string
    installments?: number
    payments?: PaymentAllocation[]
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
    methodTitle?: React.ReactNode
}

const METHOD_META: Record<string, { label: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
    CASH: { label: 'Efectivo', description: 'Pago en efectivo', icon: Banknote, color: 'text-success' },
    CARD: { label: 'Tarjeta', description: 'Débito / Crédito', icon: CreditCard, color: 'text-primary' },
    CREDIT_CARD: { label: 'T. Crédito', description: 'Tarjeta de crédito', icon: CreditCard, color: 'text-primary' },
    DEBIT_CARD: { label: 'T. Débito', description: 'Tarjeta de débito', icon: CreditCard, color: 'text-primary' },
    CARD_TERMINAL: { label: 'Tarjeta TUU', description: 'Con datáfono TUU', icon: CreditCard, color: 'text-primary' },
    TRANSFER: { label: 'Transferencia', description: 'Transferencia bancaria', icon: Building2, color: 'text-primary' },
    CHECK: { label: 'Cheque', description: 'Cheque bancario', icon: ClipboardList, color: 'text-warning' },
    CREDIT_BALANCE: { label: 'Saldo a Favor', description: 'Crédito disponible', icon: Wallet, color: 'text-primary' },
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

    const isMultiPayment = Array.isArray(paymentData.payments)
    const paymentsList = paymentData.payments ?? []
    const totalPaid = paymentsList.reduce((sum, p) => sum + (p.amount || 0), 0)
    const remaining = Math.max(0, total - totalPaid)
    const isFullyPaid = remaining <= 0

    const isMethodAllowed = (methodId: string) => {
        if (loadingMethods) return true
        if (!allowedMethods.length) return false
        switch (methodId) {
            case 'CASH': return allowedMethods.some(m => m.method_type === 'CASH')
            case 'CARD': return allowedMethods.some(m => m.method_type === 'CARD')
            case 'CREDIT_CARD': return allowedMethods.some(m => m.method_type === 'CREDIT_CARD')
            case 'DEBIT_CARD': return allowedMethods.some(m => m.method_type === 'DEBIT_CARD')
            case 'CARD_TERMINAL': return allowedMethods.some(m => m.method_type === 'CARD_TERMINAL' && m.is_terminal_integration)
            case 'TRANSFER': return allowedMethods.some(m => m.method_type === 'TRANSFER')
            case 'CHECK': return allowedMethods.some(m => m.method_type === 'CHECK')
            case 'CREDIT_BALANCE': return operation === 'sales' ? customerCreditBalance > 0 : allowCreditBalanceAccumulation
            default: return false
        }
    }

    const [pendingMethod, setPendingMethod] = useState<string | null>(null)
    const [pendingPaymentMethodId, setPendingPaymentMethodId] = useState<number | null>(null)
    const [pendingTreasuryAccountId, setPendingTreasuryAccountId] = useState<string | null>(null)
    const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
    const [tempAmount, setTempAmount] = useState("")
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [showFieldsForIndex, setShowFieldsForIndex] = useState<number | null>(null)

    const handlePaymentMethodSelect = (methodId: string) => {
        const isTerminalIntegration = methodId === 'CARD_TERMINAL'
        setPendingMethod(methodId)

        const matching = filterMethodsByType(allowedMethods, methodId)
        const firstWithAccount = matching.find(m => m.treasury_account != null)
        setPendingTreasuryAccountId(firstWithAccount?.treasury_account?.toString() ?? null)
        setPendingPaymentMethodId(firstWithAccount?.id ?? null)

        if (methodId === 'CREDIT_BALANCE') {
            const amount = Math.min(total, customerCreditBalance)
            commitPayment({ method: methodId, amount, paymentMethodId: null, treasuryAccountId: null, isTerminalIntegration })
            return
        }

        setTempAmount("0")
        setIsAmountModalOpen(true)
    }

    const commitPayment = (alloc: PaymentAllocation) => {
        const updated = [...paymentsList, alloc]
        const totalAmount = updated.reduce((s, p) => s + (p.amount || 0), 0)

        onPaymentDataChange({
            ...paymentData,
            payments: updated,
            method: alloc.method as PaymentData['method'],
            amount: totalAmount,
            paymentMethodId: alloc.paymentMethodId,
            treasuryAccountId: alloc.treasuryAccountId,
            isTerminalIntegration: alloc.isTerminalIntegration ?? false,
            checkNumber: alloc.checkNumber,
            checkBankId: alloc.checkBankId,
            checkDueDate: alloc.checkDueDate,
            installments: alloc.installments,
        })

        setPendingMethod(null)
        setPendingPaymentMethodId(null)
        setPendingTreasuryAccountId(null)
    }

    const updatePaymentAtIndex = (index: number, updates: Partial<PaymentAllocation>) => {
        const updated = paymentsList.map((p, i) => i === index ? { ...p, ...updates } : p)
        const totalAmount = updated.reduce((s, p) => s + (p.amount || 0), 0)
        onPaymentDataChange({
            ...paymentData,
            payments: updated,
            amount: totalAmount,
        })
    }

    const handleAmountConfirm = () => {
        const parsed = parseFloat(tempAmount)
        let finalAmount = parsed || 0

        if (operation === 'purchases' && finalAmount > total) {
            finalAmount = total
        }
        if (operation === 'sales' && pendingMethod === 'CREDIT_BALANCE' && finalAmount > customerCreditBalance) {
            finalAmount = customerCreditBalance
        }
        if (finalAmount > remaining) {
            finalAmount = remaining
        }

        setIsAmountModalOpen(false)

        if (editingIndex !== null) {
            updatePaymentAtIndex(editingIndex, { amount: finalAmount })
            setEditingIndex(null)
        } else if (isMultiPayment) {
            commitPayment({
                method: pendingMethod || 'CASH',
                amount: finalAmount,
                paymentMethodId: pendingPaymentMethodId,
                treasuryAccountId: pendingTreasuryAccountId,
                isTerminalIntegration: pendingMethod === 'CARD_TERMINAL',
            })
        } else {
            onPaymentDataChange({ ...paymentData, amount: finalAmount })
        }
    }

    const removePayment = (index: number) => {
        const updated = paymentsList.filter((_, i) => i !== index)
        const totalAmount = updated.reduce((s, p) => s + (p.amount || 0), 0)
        onPaymentDataChange({
            ...paymentData,
            payments: updated,
            amount: totalAmount,
            method: updated.length > 0 ? updated[updated.length - 1].method as PaymentData['method'] : null,
            paymentMethodId: updated.length > 0 ? updated[updated.length - 1].paymentMethodId : null,
            treasuryAccountId: updated.length > 0 ? updated[updated.length - 1].treasuryAccountId : null,
        })
    }

    const handleEditAmount = (index: number) => {
        setEditingIndex(index)
        setPendingMethod(paymentsList[index].method)
        setTempAmount(paymentsList[index].amount.toString())
        setIsAmountModalOpen(true)
    }

    const exitMultiMode = () => {
        onPaymentDataChange({
            ...paymentData,
            payments: undefined,
            method: null,
            amount: 0,
        })
    }

    const enterMultiMode = () => {
        onPaymentDataChange({
            ...paymentData,
            payments: [],
            method: null,
            amount: 0,
        })
    }

    function filterMethodsByType(methods: PaymentMethod[], methodId: string | null): PaymentMethod[] {
        if (!methodId) return []
        return methods.filter(m => {
            if (methodId === 'CASH') return m.method_type === 'CASH'
            if (methodId === 'CARD') return m.method_type === 'CARD'
            if (methodId === 'CREDIT_CARD') return m.method_type === 'CREDIT_CARD'
            if (methodId === 'DEBIT_CARD') return m.method_type === 'DEBIT_CARD'
            if (methodId === 'CARD_TERMINAL') return m.method_type === 'CARD_TERMINAL'
            if (methodId === 'TRANSFER') return m.method_type === 'TRANSFER'
            if (methodId === 'CHECK') return m.method_type === 'CHECK'
            if (methodId === 'CREDIT_BALANCE') return false
            return false
        })
    }

    const methodsForType = useMemo(() => {
        const method = isMultiPayment ? pendingMethod : paymentData.method
        return filterMethodsByType(allowedMethods, method)
    }, [allowedMethods, paymentData.method, pendingMethod, isMultiPayment])

    useEffect(() => {
        if (!isMultiPayment && methodsForType.length >= 1) {
            const currentAccountId = paymentData.treasuryAccountId?.toString();
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
        } else if (!isMultiPayment && methodsForType.length === 0 && (paymentData.treasuryAccountId || paymentData.paymentMethodId)) {
            requestAnimationFrame(() => {
                onPaymentDataChange({ ...paymentData, treasuryAccountId: null, paymentMethodId: null });
            })
        }
    }, [methodsForType, paymentData.method, isMultiPayment])

    const availableMethods = useMemo(() => {
        return Object.entries(METHOD_META).map(([id, meta]) => ({
            id,
            ...meta,
            isAllowed: isMethodAllowed(id)
        })).filter(m => m.isAllowed)
    }, [isMethodAllowed])

    const hasAdditionalFieldsForMethod = (method: string | null): boolean => {
        if (!method) return false
        if (method === 'CHECK') return true
        if (method === 'CREDIT_CARD') return true
        if (['CASH', 'CARD', 'CARD_TERMINAL', 'TRANSFER'].includes(method)) {
            return methodsForType.filter(m => m.treasury_account != null).length > 1
        }
        return false
    }

    const renderAdditionalFields = (method: string, alloc?: PaymentAllocation, onChange?: (updates: Partial<PaymentAllocation>) => void) => {
        const currentAlloc: Partial<PaymentAllocation> = alloc || {}
        const update = onChange || ((updates: Partial<PaymentAllocation>) => {
            if (isMultiPayment && pendingMethod === method) {
                if (updates.paymentMethodId !== undefined) setPendingPaymentMethodId(updates.paymentMethodId)
                if (updates.treasuryAccountId !== undefined) setPendingTreasuryAccountId(updates.treasuryAccountId)
            } else if (!isMultiPayment) {
                onPaymentDataChange({ ...paymentData, ...updates } as PaymentData)
            }
        })

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <FormSection title="Datos Adicionales" />

                {method === 'CHECK' && (
                    <>
                        <LabeledInput
                            label="N° de Cheque"
                            placeholder="Ej: 000123"
                            value={currentAlloc.checkNumber || ""}
                            onChange={(e) => update({ checkNumber: e.target.value })}
                            required
                        />
                        <LabeledSelect
                            label="Banco Emisor"
                            placeholder="Seleccione banco..."
                            value={currentAlloc.checkBankId?.toString() || ""}
                            onChange={(val) => update({ checkBankId: val ? parseInt(val) : null })}
                            options={banks.filter(b => b.is_active).map(b => ({ value: b.id.toString(), label: b.name }))}
                            required
                        />
                        <LabeledInput
                            label="Fecha Vencimiento"
                            type="date"
                            value={currentAlloc.checkDueDate || ""}
                            onChange={(e) => update({ checkDueDate: e.target.value })}
                        />
                    </>
                )}

                {method === 'CREDIT_CARD' && (
                    <LabeledInput
                        label="N° de Cuotas"
                        type="number"
                        min={1}
                        max={36}
                        value={(currentAlloc.installments || 1).toString()}
                        onChange={(e) => {
                            const val = parseInt(e.target.value) || 1
                            update({ installments: Math.max(1, Math.min(36, val)) })
                        }}
                        placeholder="1"
                    />
                )}

                {method === 'DEBIT_CARD' && (
                    <p className="text-xs text-muted-foreground">Débito directo desde la cuenta vinculada.</p>
                )}

                {(method === 'CREDIT_CARD' || method === 'DEBIT_CARD' || methodsForType.filter(m => m.treasury_account != null).length > 1) && (
                    <LabeledSelect
                        label={method === 'TRANSFER' ? 'Banco / Cuenta' : method === 'CREDIT_CARD' ? 'Tarjeta de Crédito' : method === 'DEBIT_CARD' ? 'Tarjeta Débito' : 'Cuenta'}
                        value={currentAlloc.treasuryAccountId || ""}
                        onChange={(val) => {
                            const selectedMethod = methodsForType.find(m => String(m.treasury_account) === val)
                            update({
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
        )
    }

    const methodCardClass = "card-accent-cmyk relative overflow-hidden rounded-sm border bg-card p-8 shadow-card transition-all h-full text-left flex flex-col items-start hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

    const renderMethodGrid = () => {
        if (!isMultiPayment) {
            // ── Single mode: original grid + "Múltiple" card ──
            const allMethods = availableMethods.map(m => ({ ...m, isMultiple: false }))
            allMethods.push({
                id: '__MULTIPLE__',
                label: 'Múltiple',
                description: 'Varios métodos',
                icon: Layers,
                color: 'text-primary',
                isAllowed: true,
                isMultiple: true,
            })

            const gridCols = Math.min(allMethods.length, 4)

            return (
                <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                >
                    {allMethods.map((m) => {
                        const Icon = m.icon
                        const isSingleSelected = !m.isMultiple && paymentData.method === m.id
                        const isMultiCard = m.isMultiple

                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                    if (isMultiCard) {
                                        enterMultiMode()
                                    } else {
                                        const isReClick = paymentData.method === m.id
                                        const isTerminalIntegration = m.id === 'CARD_TERMINAL'
                                        onPaymentDataChange({
                                            ...paymentData,
                                            method: m.id as PaymentData['method'],
                                            isTerminalIntegration,
                                        })
                                        if (!isReClick) {
                                            setTempAmount((paymentData.amount || 0).toString())
                                            setIsAmountModalOpen(true)
                                        } else if (m.id !== 'TRANSFER' && m.id !== 'CREDIT_BALANCE') {
                                            setTempAmount((paymentData.amount || 0).toString())
                                            setIsAmountModalOpen(true)
                                        }
                                    }
                                }}
                                disabled={!m.isAllowed}
                                className={cn(
                                    methodCardClass,
                                    isSingleSelected ? "border-2 border-primary accent-visible" : "border-border/50",
                                    isMultiCard && "hover:border-primary",
                                    !m.isAllowed && "opacity-40 grayscale cursor-not-allowed"
                                )}
                            >
                                <div className="flex items-center justify-between w-full gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Icon className={cn("h-10 w-10 shrink-0", m.color)} />
                                        {isMultiCard ? (
                                            <div className="min-w-0">
                                                <div className="text-base font-semibold leading-tight">{m.label}</div>
                                                <div className="text-xs text-muted-foreground leading-tight">{m.description}</div>
                                            </div>
                                        ) : (
                                            <span className="text-base font-semibold">{m.label}</span>
                                        )}
                                    </div>

                                    {isSingleSelected && paymentData.amount > 0 && m.id !== 'CREDIT_BALANCE' && (
                                        <div className="text-right shrink-0">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">MONTO</div>
                                            <div className="text-base font-semibold tabular-nums">
                                                <MoneyDisplay amount={paymentData.amount} showColor={false} />
                                            </div>
                                        </div>
                                    )}

                                    {m.id === 'CREDIT_BALANCE' && isSingleSelected && (
                                        <div className="flex items-center gap-4 shrink-0">
                                            {paymentData.amount > 0 && (
                                                <div className="text-right">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">MONTO</div>
                                                    <div className="text-base font-semibold tabular-nums">
                                                        <MoneyDisplay amount={paymentData.amount} showColor={false} />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-right">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">DISP.</div>
                                                <div className="text-base font-semibold tabular-nums">
                                                    <MoneyDisplay amount={customerCreditBalance} showColor={false} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </button>
                        )
                    })}
                </div>
            )
        }

        // ── Multi mode: unified grid + header ──
        const gridCols = Math.min(availableMethods.length, 4)

        return (
            <div className="space-y-4">
                {/* Multi header: badge + exit */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-sm bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        <span className="text-sm font-semibold uppercase tracking-wider text-primary">Modo múltiple</span>
                    </div>
                    <button
                        type="button"
                        onClick={exitMultiMode}
                        className="text-sm font-semibold text-destructive hover:text-destructive/80 px-4 py-2"
                    >
                        Salir
                    </button>
                </div>

                {/* Unified grid: all methods in strict columns */}
                <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                >
                    {availableMethods.map((m) => {
                        const allocIndex = paymentsList.findIndex(p => p.method === m.id)
                        const isAllocated = allocIndex >= 0
                        const Icon = m.icon

                        if (isAllocated) {
                            const alloc = paymentsList[allocIndex]
                            return (
                                <div
                                    key={m.id}
                                    className={cn(methodCardClass, "relative border-border/50")}
                                >
                                    <div className="flex items-center justify-between w-full gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Icon className={cn("h-9 w-9 shrink-0", m.color)} />
                                            <div className="min-w-0">
                                                <div className="text-base font-semibold leading-tight">{m.label}</div>
                                                <div className="text-sm text-muted-foreground leading-tight tabular-nums">
                                                    <MoneyDisplay amount={alloc.amount} showColor={false} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                                            <button
                                                type="button"
                                                onClick={() => handleEditAmount(allocIndex)}
                                                className="p-1.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                aria-label="Editar monto"
                                            >
                                                <Pencil className="h-5 w-5" />
                                            </button>
                                            {hasAdditionalFieldsForMethod(m.id) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowFieldsForIndex(showFieldsForIndex === allocIndex ? null : allocIndex)}
                                                    className="p-1.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    aria-label="Campos adicionales"
                                                >
                                                    <Layers className="h-5 w-5" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removePayment(allocIndex)}
                                                className="p-1.5 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                aria-label="Eliminar pago"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    {showFieldsForIndex === allocIndex && hasAdditionalFieldsForMethod(m.id) && (
                                        <div className="pt-2 border-t mt-2 w-full">
                                            {renderAdditionalFields(m.id, alloc, (updates) => updatePaymentAtIndex(allocIndex, updates))}
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => handlePaymentMethodSelect(m.id)}
                                disabled={!m.isAllowed}
                                className={cn(
                                    methodCardClass,
                                    "border-border/50",
                                    !m.isAllowed && "opacity-40 grayscale cursor-not-allowed"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={cn("h-10 w-10 shrink-0", m.color)} />
                                    <span className="text-base font-semibold">{m.label}</span>
                                </div>
                                {!m.isAllowed && (
                                    <div className="text-[10px] font-black text-destructive uppercase tracking-widest mt-2">
                                        NO DISPONIBLE
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>

                {isFullyPaid && (
                    <div className="text-center py-2">
                        <span className="text-xs font-semibold text-success uppercase tracking-wider">Total cubierto</span>
                    </div>
                )}
            </div>
        )
    }

    // ── Unified render ──
    return (
        <div className="space-y-4">
            {methodTitle}

            {renderMethodGrid()}

            {/* Single mode: additional fields shown below grid */}
            {!isMultiPayment && paymentData.method && hasAdditionalFieldsForMethod(paymentData.method) && (
                renderAdditionalFields(paymentData.method)
            )}

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
                    {pendingMethod && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Método:</span>
                            <span className="font-semibold text-foreground">
                                {METHOD_META[pendingMethod]?.label || pendingMethod}
                            </span>
                        </div>
                    )}
                    {isMultiPayment && (
                        <div className="text-xs text-muted-foreground">
                            {editingIndex !== null
                                ? `Editando monto para ${METHOD_META[pendingMethod || '']?.label || ''}`
                                : `Restante por cobrar: ${formatMoney(remaining)}`
                            }
                        </div>
                    )}
                    <Numpad
                        value={tempAmount}
                        onChange={setTempAmount}
                        onConfirm={handleAmountConfirm}
                        onClose={() => { setIsAmountModalOpen(false); setEditingIndex(null) }}
                        allowDecimal={false}
                        hideConfirm
                        className="border-none shadow-none p-0 w-full max-w-none"
                        displayValue={formatMoney(parseFloat(tempAmount) || 0)}
                        quickAmounts={
                            isMultiPayment
                                ? [
                                    ...[50, 100, 500, 1000, 2000, 5000, 10000, 20000].map(val => ({
                                        label: `+${formatMoney(val)}`,
                                        value: val,
                                        action: 'add' as const,
                                    })),
                                    { label: 'Restante', value: remaining, action: 'set' as const },
                                ]
                                : [
                                    ...[50, 100, 500, 1000, 2000, 5000, 10000, 20000].map(val => ({
                                        label: `+${formatMoney(val)}`,
                                        value: val,
                                        action: 'add' as const,
                                    })),
                                    { label: 'Exacto', value: total, action: 'set' as const },
                                ]
                        }
                        onQuickAmountAction={(qa) => {
                            let newAmount: number
                            if (qa.action === 'add') {
                                const current = parseFloat(tempAmount) || 0
                                newAmount = current + qa.value
                                const maxVal = isMultiPayment ? remaining : total
                                if (operation === 'purchases' && newAmount > maxVal) newAmount = maxVal
                                if (isMultiPayment && newAmount > remaining) newAmount = remaining
                            } else {
                                newAmount = qa.value
                            }
                            if (operation === 'sales' && pendingMethod === 'CREDIT_BALANCE' && newAmount > customerCreditBalance) {
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
