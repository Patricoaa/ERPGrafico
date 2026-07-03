import { Label } from "@/components/ui/label"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

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
                // Base layout
                "flex flex-row items-start gap-3 rounded-md border border-input p-3 transition-all h-full",
                // Interacciones
                !disabled && "cursor-pointer hover:border-primary/50 hover:bg-accent/50",
                disabled && "opacity-50 cursor-not-allowed",
                // Estado Checked (el padre responde al hijo clickeado)
                "[&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 [&:has([data-state=checked])]:ring-1 [&:has([data-state=checked])]:ring-primary/20",
                className
            )}
        >
            {/* El Radio real visible (mt-0.5 para alinear con el texto/ícono) */}
            <RadioGroupItem 
                value={value} 
                id={id} 
                disabled={disabled}
                className="mt-0.5 shrink-0" 
            />

            {/* Opcional: Ícono con fondo */}
            {icon && (
                <div className={cn("p-1.5 rounded-md bg-background border shrink-0", iconColor)}>
                    {icon}
                </div>
            )}
            
            {/* Textos */}
            <div className="flex flex-col gap-1 min-w-0 flex-1 justify-center">
                <span className="text-sm font-bold truncate leading-none">{label}</span>
                {description && (
                    <span className="text-[10px] uppercase font-black text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                        {description}
                    </span>
                )}
                {/* Por si queremos inyectar un badge o código interno */}
                {children}
            </div>
        </Label>
    )
}
