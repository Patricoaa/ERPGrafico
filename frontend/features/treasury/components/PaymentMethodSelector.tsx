"use client"

import { useAllowedPaymentMethods, PaymentMethod } from "@/hooks/useAllowedPaymentMethods"
import { useMemo, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Banknote, CreditCard, Building2, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/EmptyState"

export interface PaymentMethodValue {
    methodType: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | null
    treasuryAccountId: string | null
    paymentMethodId: string | null
}

interface PaymentMethodSelectorProps {
    value: PaymentMethodValue
    onChange: (value: PaymentMethodValue) => void
    operation?: 'sales' | 'purchases'
    terminalId?: number
    className?: string
}

export function PaymentMethodSelector({
    value,
    onChange,
    operation = 'sales',
    terminalId,
    className
}: PaymentMethodSelectorProps) {
    const { methods: allowedMethods, loading } = useAllowedPaymentMethods({
        terminalId,
        operation,
        enabled: true
    })

    // Group methods by High-Level Type
    const methodsByType = useMemo(() => {
        const groups = {
            CASH: [] as PaymentMethod[],
            CARD: [] as PaymentMethod[],
            TRANSFER: [] as PaymentMethod[],
            CHECK: [] as PaymentMethod[]
        }

        allowedMethods.forEach(m => {
            if (m.method_type === 'CASH') groups.CASH.push(m)
            else if (['CREDIT_CARD', 'DEBIT_CARD', 'CARD_TERMINAL'].includes(m.method_type)) groups.CARD.push(m)
            else if (m.method_type === 'TRANSFER') groups.TRANSFER.push(m)
            else if (['CHECK', 'CHECKBOOK'].includes(m.method_type)) groups.CHECK.push(m)
        })

        return groups
    }, [allowedMethods])

    // Available High-Level Types
    const availableTypes = useMemo(() => {
        return [
            {
                id: 'CASH',
                label: 'Efectivo',
                icon: Banknote,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                border: 'border-emerald-200',
                methods: methodsByType.CASH
            },
            {
                id: 'CARD',
                label: 'Tarjeta',
                icon: CreditCard,
                color: 'text-primary',
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                methods: methodsByType.CARD
            },
            {
                id: 'TRANSFER',
                label: 'Transferencia',
                icon: Building2,
                color: 'text-primary',
                bg: 'bg-primary/10',
                border: 'border-primary/20',
                methods: methodsByType.TRANSFER
            },
            {
                id: 'CHECK',
                label: 'Cheque',
                icon: ClipboardList,
                color: 'text-amber-600',
                bg: 'bg-amber-50',
                border: 'border-amber-200',
                methods: methodsByType.CHECK
            }
        ].filter(t => t.methods.length > 0)
    }, [methodsByType])

    // Specific methods for the CURRENTLY selected type
    const currentTypeMethods = useMemo(() => {
        if (!value.methodType) return []
        // @ts-ignore
        return methodsByType[value.methodType] || []
    }, [value.methodType, methodsByType])

    // Auto-select logic: If a type is selected and has only 1 method, select it automatically.
    // Also, if no specific account/method is selected but we have candidates, select the first one.
    useEffect(() => {
        if (!value.methodType) return

        if (currentTypeMethods.length > 0) {
            // Check if current selection is valid for this type
            const isCurrentValid = currentTypeMethods.some(m =>
                m.id.toString() === value.paymentMethodId &&
                m.treasury_account.toString() === value.treasuryAccountId
            )

            if (!isCurrentValid) {
                // Default to first available method for this type
                const defaultMethod = currentTypeMethods[0]
                onChange({
                    ...value,
                    treasuryAccountId: defaultMethod.treasury_account.toString(),
                    paymentMethodId: defaultMethod.id.toString()
                })
            }
        } else {
            // Type selected but no methods available (shouldn't happen due to filtering, but safe fallback)
            if (value.treasuryAccountId || value.paymentMethodId) {
                onChange({ ...value, treasuryAccountId: null, paymentMethodId: null })
            }
        }
    }, [value.methodType, currentTypeMethods, onChange, value.paymentMethodId, value.treasuryAccountId])


    // Handle Type Change
    const handleTypeChange = (type: string) => {
        // Find methods for this new type
        // @ts-ignore
        const newMethods = methodsByType[type] || []

        const nextValue: PaymentMethodValue = {
            // @ts-ignore
            methodType: type,
            treasuryAccountId: null,
            paymentMethodId: null
        }

        // If there's only one method (or at least one), we'll let the useEffect above handle the specific selection
        // OR we can do it right here to be snappier
        if (newMethods.length > 0) {
            nextValue.treasuryAccountId = newMethods[0].treasury_account.toString()
            nextValue.paymentMethodId = newMethods[0].id.toString()
        }

        onChange(nextValue)
    }

    if (loading && availableTypes.length === 0) {
        return <div className="h-24 w-full animate-pulse bg-muted rounded-xl" />
    }

    if (availableTypes.length === 0) {
        return (
            <EmptyState context="finance" variant="compact" description="No hay métodos de pago disponibles para esta operación" />
        )
    }

    return (
        <div className={cn("space-y-4", className)}>
            <RadioGroup
                value={value.methodType || ""}
                onValueChange={handleTypeChange}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
                {availableTypes.map((type) => {
                    const isSelected = value.methodType === type.id
                    return (
                        <div key={type.id} className="relative">
                            <RadioGroupItem
                                value={type.id}
                                id={`pm-type-${type.id}`}
                                className="sr-only"
                            />
                            <Label
                                htmlFor={`pm-type-${type.id}`}
                                className={cn(
                                    "flex flex-col items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-accent",
                                    isSelected
                                        ? `border-primary/50 bg-accent ring-1 ring-primary/20`
                                        : "border-muted bg-popover"
                                )}
                            >
                                <div className={cn(
                                    "p-3 rounded-full text-white",
                                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                    <type.icon className="h-6 w-6" />
                                </div>
                                <span className={cn(
                                    "font-bold uppercase text-xs tracking-wider",
                                    isSelected ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {type.label}
                                </span>
                            </Label>
                        </div>
                    )
                })}
            </RadioGroup>

            {/* Sub-selector for specific Method/Account if multiple exist */}
            {value.methodType && currentTypeMethods.length > 1 && (
                <div className="animate-in fade-in slide-in-from-top-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">
                        Seleccionar {value.methodType === 'TRANSFER' ? 'Cuenta Bancaria' : 'Cuenta / Opción'}
                    </Label>
                    <Select
                        value={value.paymentMethodId || ""}
                        onValueChange={(val) => {
                            const selected = currentTypeMethods.find(m => m.id.toString() === val)
                            if (selected) {
                                onChange({
                                    ...value,
                                    paymentMethodId: selected.id.toString(),
                                    treasuryAccountId: selected.treasury_account.toString()
                                })
                            }
                        }}
                    >
                        <SelectTrigger className="h-10 bg-background">
                            <SelectValue placeholder="Seleccione opción..." />
                        </SelectTrigger>
                        <SelectContent>
                            {currentTypeMethods.map(m => (
                                <SelectItem key={m.id} value={m.id.toString()}>
                                    {m.name === 'Transferencia Scotiabank' ? 'Scotiabank' : m.name}
                                    <span className="text-muted-foreground text-xs ml-2">({m.treasury_account_name})</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Show selected account info if only 1 exists, for confirmation */}
            {value.methodType && currentTypeMethods.length === 1 && (
                <div className="text-xs text-muted-foreground text-center bg-muted/30 p-2 rounded border border-dashed">
                    Cuenta: <span className="font-medium text-foreground">{currentTypeMethods[0].treasury_account_name}</span>
                </div>
            )}
        </div>
    )
}
