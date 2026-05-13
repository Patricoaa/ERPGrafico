"use client"

import { useState } from "react"
import { Package, Zap, Factory, Wrench, Repeat, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LabeledContainer } from "@/components/shared"

interface ProductTypeSelectorProps {
    value?: string | null
    onChange: (value: string) => void
    disabled?: boolean
    label?: string
    required?: boolean
    error?: string
    lockedType?: string
}

const PRODUCT_TYPES = [
    { id: 'STORABLE', label: 'Almacenable', icon: Package, color: 'text-blue-500' },
    { id: 'CONSUMABLE', label: 'Consumible', icon: Zap, color: 'text-amber-500' },
    { id: 'MANUFACTURABLE', label: 'Fabricable', icon: Factory, color: 'text-emerald-500' },
    { id: 'SERVICE', label: 'Servicio (Único)', icon: Wrench, color: 'text-purple-500' },
    { id: 'SUBSCRIPTION', label: 'Suscripción (Recurrente)', icon: Repeat, color: 'text-rose-500' }
]

export function ProductTypeSelector({
    value,
    onChange,
    disabled,
    label = "Tipo de Producto",
    required,
    error,
    lockedType
}: ProductTypeSelectorProps) {
    const [open, setOpen] = useState(false)
    
    const selectedType = PRODUCT_TYPES.find(t => t.id === value)
    const isDisabled = disabled || !!lockedType

    return (
        <LabeledContainer
            label={label}
            required={required}
            error={error}
            disabled={isDisabled}
            containerClassName={cn("w-full", lockedType && "opacity-80")}
        >
            <Select
                disabled={isDisabled}
                onValueChange={onChange}
                value={value || undefined}
                onOpenChange={setOpen}
            >
                <SelectTrigger 
                    role="combobox"
                    size="sm"
                    className="w-full h-[1.5rem]! min-h-0! py-0 px-2 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent"
                >
                    <div className="flex items-center gap-2 flex-1 min-w-0 h-full">
                        {selectedType ? (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 h-full">
                                <selectedType.icon className={cn("h-3 w-3 shrink-0", selectedType.color)} />
                                <span className="font-bold text-[11px] truncate uppercase tracking-tight leading-none">{selectedType.label}</span>
                            </div>
                        ) : (
                            <span className="text-[11px] text-muted-foreground opacity-50 leading-none">Seleccionar tipo...</span>
                        )}
                    </div>
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="w-[var(--radix-select-trigger-width)]">
                    {PRODUCT_TYPES.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="cursor-pointer">
                            <div className="flex items-center gap-2">
                                <t.icon className={cn("h-3.5 w-3.5", t.color)} />
                                <span className="text-xs font-medium">{t.label}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </LabeledContainer>
    )
}
