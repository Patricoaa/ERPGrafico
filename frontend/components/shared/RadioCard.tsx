import { Label } from "@/components/ui/label"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

const CMYK_CONIC =
    "conic-gradient(from 0deg, var(--color-cyan) 0deg 90deg, var(--color-magenta) 90deg 180deg, var(--color-yellow) 180deg 270deg, var(--color-black) 270deg 360deg)"

interface RadioCardProps {
    value: string
    id: string
    label: string
    description?: string
    icon?: ReactNode
    iconColor?: string
    disabled?: boolean
    className?: string
    orientation?: "horizontal" | "vertical"
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
    orientation = "horizontal",
    children
}: RadioCardProps) {
    const isVertical = orientation === "vertical"
    return (
        <Label
            htmlFor={id}
            className={cn(
                "relative group flex rounded-sm border border-input p-3 transition-all h-full",
                isVertical
                    ? "flex-col items-center justify-center text-center gap-2 p-4 min-h-[110px]"
                    : "flex-row items-center gap-3",
                !disabled && "cursor-pointer hover:border-primary/50 hover:bg-accent/50",
                disabled && "opacity-50 cursor-not-allowed",
                "[&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 [&:has([data-state=checked])]:ring-1 [&:has([data-state=checked])]:ring-primary/20",
                className
            )}
        >
            {/* Radio input accesible — oculto visualmente */}
            <RadioGroupItem
                value={value}
                id={id}
                disabled={disabled}
                className="peer sr-only"
            />

            {/* Radio indicator: círculo azul + ring CMYK envolvente */}
            <div className={cn(
                "relative shrink-0 h-5 w-5",
                isVertical && "absolute top-2.5 right-2.5"
            )}>
                {/* Ring CMYK — envuelve el círculo cuando está checked */}
                <div
                    className={cn(
                        "absolute -inset-1 rounded-full pointer-events-none opacity-0 transition-opacity duration-200",
                        "peer-data-[state=checked]:opacity-100"
                    )}
                    style={{
                        background: CMYK_CONIC,
                        mask: "radial-gradient(circle, transparent 71%, black 72%)",
                        WebkitMask: "radial-gradient(circle, transparent 71%, black 72%)",
                    }}
                />
                {/* Círculo azul decorativo */}
                <div className={cn(
                    "absolute inset-0 rounded-full border-2 border-muted bg-transparent transition-colors",
                    "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
                )} />
            </div>

            {/* Opcional: Ícono sin fondo */}
            {icon && (
                <div className={cn("shrink-0", iconColor)}>
                    {icon}
                </div>
            )}

            {/* Textos */}
            <div className={cn(
                "flex flex-col gap-1 min-w-0 flex-1 justify-center",
                isVertical && "items-center"
            )}>
                <span className="text-sm font-bold truncate leading-none">{label}</span>
                {description && (
                    <span className="text-xs text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                        {description}
                    </span>
                )}
                {children}
            </div>
        </Label>
    )
}
