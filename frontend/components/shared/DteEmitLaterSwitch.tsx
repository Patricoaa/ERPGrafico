"use client"

import { FileText } from "lucide-react"
import { LabeledSwitch } from "@/components/shared"
import { cn } from "@/lib/utils"
import type { DteDirection } from "@/lib/dte"

export interface DteEmitLaterSwitchProps {
    isPending: boolean
    onChange: (isPending: boolean) => void
    direction?: DteDirection
    disabled?: boolean
    className?: string
}

export function DteEmitLaterSwitch({
    isPending,
    onChange,
    direction = "sale",
    disabled = false,
    className,
}: DteEmitLaterSwitchProps) {
    const isSale = direction === "sale"
    const label = isSale ? "Emisión" : "Recepción"
    const description = isPending
        ? isSale
            ? "Aún no emitiré el documento / no está en el RCV"
            : "Aún no he recibido el documento / no está disponible en el RCV"
        : isSale
            ? "Emisión inmediata"
            : "Recepción inmediata"

    return (
        <LabeledSwitch
            label={label}
            description={description}
            checked={isPending}
            onCheckedChange={(checked) => onChange(!!checked)}
            disabled={disabled}
            icon={
                <FileText
                    className={cn(
                        "h-4 w-4 transition-colors",
                        isPending ? "text-warning-text" : "text-muted-foreground/30"
                    )}
                />
            }
            className={cn("h-full", className)}
            color="info"
        />
    )
}
