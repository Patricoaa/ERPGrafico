import React from "react"
import { cn, EMPTY_VALUE, isMissing } from "@/lib/utils"

export type DataCellWeight = 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'black'

export const WEIGHT_MAP: Record<DataCellWeight, string> = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    black: 'font-black',
}

interface MoneyDisplayProps {
    amount: number | string | null | undefined
    currency?: string
    showColor?: boolean
    showZeroAsDash?: boolean
    className?: string
    digits?: number
    inline?: boolean
    weight?: DataCellWeight
}

export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
    amount,
    currency = "CLP",
    showColor = true,
    showZeroAsDash = false,
    className,
    digits = 0,
    inline = false,
    weight = "medium",
}) => {
    if (isMissing(amount)) {
        return <span className={cn("text-muted-foreground", className)}>{EMPTY_VALUE}</span>
    }

    const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount
    if (isNaN(numericAmount)) {
        return <span className={cn("text-muted-foreground", className)}>{EMPTY_VALUE}</span>
    }

    if (showZeroAsDash && numericAmount === 0) {
        return <span className={cn("text-muted-foreground", className)}>{EMPTY_VALUE}</span>
    }

    const isNegative = numericAmount < 0
    const isPositive = numericAmount > 0

    const formatted = new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(numericAmount)

    return (
        <span
            className={cn(
                weight && WEIGHT_MAP[weight],
                inline ? "inline" : "inline-block",
                showColor && isNegative && "text-expense",
                showColor && isPositive && "text-income",
                className
            )}
        >
            {formatted}
        </span>
    )
}
