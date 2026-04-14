import React from "react"
import { cn } from "@/lib/utils"

interface MoneyDisplayProps {
    amount: number | string | null | undefined
    currency?: string
    showColor?: boolean
    showZeroAsDash?: boolean
    className?: string
    digits?: number
    inline?: boolean
    colored?: boolean
}

export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
    amount,
    currency = "CLP",
    showColor = true,
    showZeroAsDash = false,
    className,
    digits = 0,
    inline = false,
    colored = false,
}) => {
    if (amount === null || amount === undefined || amount === "") {
        return <span className={cn("font-mono text-muted-foreground", className)}>-</span>
    }

    const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount
    if (isNaN(numericAmount)) {
        return <span className={cn("font-mono text-muted-foreground", className)}>-</span>
    }

    if (showZeroAsDash && numericAmount === 0) {
        return <span className={cn("font-mono text-muted-foreground", className)}>-</span>
    }

    const isNegative = numericAmount < 0
    const isPositive = numericAmount > 0

    const formatted = new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: currency,
        maximumFractionDigits: digits,
    }).format(numericAmount)

    return (
        <span
            className={cn(
                "font-bold font-mono tabular-nums tracking-tight",
                inline ? "inline" : "inline-block",
                (showColor || colored) && isNegative && "text-destructive",
                (showColor || colored) && isPositive && "text-success",
                className
            )}
        >
            {formatted}
        </span>
    )
}
