"use client"

import { useAllowedPaymentMethods, PaymentMethod } from "@/hooks/useAllowedPaymentMethods"
import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Banknote, CreditCard, Building2, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"

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
                color: 'text-blue-600',
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                methods: methodsByType.CARD
            },
            {
                id: 'TRANSFER',
                label: 'Transferencia',
                icon: Building2,
                color: 'text-purple-600',
                bg: 'bg-purple-50',
                border: 'border-purple-200',
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
        const typeGroup = availableTypes.find(t => t.id === value.methodType)
        return typeGroup ? typeGroup.methods : []
    }, [value.methodType, availableTypes])


    // Handler for Type Selection
    const handleTypeSelect = (typeId: string) => {
        // Find default method for this type (if any)
        const typeGroup = availableTypes.find(t => t.id === typeId)
        const defaultMethod = typeGroup?.methods[0]

        onChange({
            methodType: typeId as any,
            treasuryAccountId: defaultMethod?.treasury_account?.toString() || null,
            paymentMethodId: defaultMethod?.id.toString() || null
        })
    }

    const handleMethodSelect = (methodId: string) => {
        const method = allowedMethods.find(m => m.id.toString() === methodId)
        if (!method) return

        onChange({
            ...value,
            paymentMethodId: methodId,
            treasuryAccountId: method.treasury_account?.toString() || null
        })
    }

    if (loading) {
        return <div className="p-4 text-center text-muted-foreground text-sm">Cargando métodos...</div>
    }

    if (allowedMethods.length === 0) {
        return (
            <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground text-sm bg-muted/30">
                No hay métodos de pago habilitados para esta operación.
            </div>
        )
    }

    return (
        <div className={cn("space-y-4", className)}>
            {/* 1. High-Level Types (Tabs/Cards) */}
            <div className="flex flex-wrap gap-3">
                {availableTypes.map((type) => {
                    const isSelected = value.methodType === type.id
                    const Icon = type.icon

                    return (
                        <button
                            key={type.id}
                            type="button"
                            onClick={() => handleTypeSelect(type.id)}
                            className={cn(
                                "relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left flex-1 min-w-[140px]",
                                isSelected
                                    ? cn("border-2 shadow-sm ring-1 ring-offset-1 ring-primary/20", type.bg, type.border, type.color)
                                    : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-lg transition-colors",
                                isSelected ? "bg-white/60 shadow-sm" : "bg-slate-100"
                            )}>
                                <Icon className={cn("h-5 w-5", isSelected ? type.color : "text-slate-500")} />
                            </div>
                            <div className="flex flex-col">
                                <span className={cn("font-bold text-sm", isSelected ? "text-slate-900" : "text-slate-700")}>
                                    {type.label}
                                </span>
                            </div>

                            {isSelected && (
                                <div className={cn("absolute inset-0 rounded-xl ring-2 ring-inset ring-primary/10 pointer-events-none")} />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* 2. Specific Method Selection (If more than 1 for the selected type) */}
            {value.methodType && currentTypeMethods.length > 1 && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label className="text-xs text-muted-foreground ml-1 mb-1.5 block">
                        Seleccione opción específica:
                    </Label>
                    <Select
                        value={value.paymentMethodId || ""}
                        onValueChange={handleMethodSelect}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                        <SelectContent>
                            {currentTypeMethods.map(method => (
                                <SelectItem key={method.id} value={method.id.toString()}>
                                    {method.name}
                                    {method.treasury_account_name && <span className="text-muted-foreground text-xs ml-2">({method.treasury_account_name})</span>}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    )
}
