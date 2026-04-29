"use client"

import { useState } from "react"
import { Package, Zap, Factory, Wrench, Repeat, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
        <div className="relative w-full flex flex-col group">
            <fieldset 
                className={cn(
                    "notched-field w-full group transition-all",
                    open && "focused",
                    error && "error",
                    isDisabled && "opacity-50 cursor-not-allowed bg-muted/10"
                )}
            >
                {label && (
                    <legend className={cn("notched-legend", error && "text-destructive", isDisabled && "text-muted-foreground/50")}>
                        {label}
                        {required && <span className="ml-1 text-destructive">*</span>}
                    </legend>
                )}
                <Select
                    disabled={isDisabled}
                    onValueChange={onChange}
                    value={value || undefined}
                    onOpenChange={setOpen}
                >
                    <SelectTrigger 
                        className="w-full h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent"
                    >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            {selectedType ? (
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <selectedType.icon className={cn("h-3.5 w-3.5 shrink-0", selectedType.color)} />
                                    <span className="font-bold text-sm truncate">{selectedType.label}</span>
                                </div>
                            ) : (
                                <SelectValue placeholder="Seleccionar tipo..." />
                            )}
                        </div>
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="w-[var(--radix-select-trigger-width)]">
                        {PRODUCT_TYPES.map((t) => (
                            <SelectItem key={t.id} value={t.id} className="cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <t.icon className={cn("h-3.5 w-3.5", t.color)} />
                                    <span>{t.label}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </fieldset>
            {error && (
                <p className="mt-1.5 text-[11px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 w-full text-left px-1">
                    {error}
                </p>
            )}
        </div>
    )
}
