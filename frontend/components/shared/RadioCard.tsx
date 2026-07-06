import { Label } from "@/components/ui/label"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { CmykRing } from "@/components/shared"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface RadioCardProps {
    value: string
    id: string
    label: string
    description?: string
    icon?: ReactNode
    iconColor?: string
    disabled?: boolean
    className?: string
    children?: ReactNode
}

export function RadioCard({
    value,
    id,
    label,
    description,
    icon,
    iconColor = "text-foreground",
    disabled,
    className,
    children
}: RadioCardProps) {
    return (
        <Label
            htmlFor={id}
            className={cn(
                "group flex flex-row items-center gap-3 rounded-md border border-input p-3 transition-all h-full",
                !disabled && "cursor-pointer hover:border-primary/50 hover:bg-accent/50",
                disabled && "opacity-50 cursor-not-allowed",
                "[&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 [&:has([data-state=checked])]:ring-1 [&:has([data-state=checked])]:ring-primary/20",
                className
            )}
        >
            {/* Círculo decorativo que envuelve al Radio */}
            <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-muted bg-background transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10">
                <RadioGroupItem 
                    value={value} 
                    id={id} 
                    disabled={disabled}
                    className="peer border-none shadow-none ring-0 focus-visible:ring-0 w-3 h-3 m-0" 
                />
                <CmykRing 
                    size="sm" 
                    className="absolute inset-0 m-auto pointer-events-none opacity-0 peer-data-[state=checked]:opacity-100 transition-opacity duration-200" 
                />
            </div>

            {/* Opcional: Ícono sin fondo */}
            {icon && (
                <div className={cn("shrink-0", iconColor)}>
                    {icon}
                </div>
            )}
            
            {/* Textos */}
            <div className="flex flex-col gap-1 min-w-0 flex-1 justify-center">
                <span className="text-sm font-bold truncate leading-none">{label}</span>
                {description && (
                    <span className="text-xs text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                        {description}
                    </span>
                )}
                {/* Por si queremos inyectar un badge o código interno */}
                {children}
            </div>
        </Label>
    )
}
