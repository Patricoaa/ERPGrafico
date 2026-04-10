"use client"

import { useEffect } from "react"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2 } from "lucide-react"
import { usePeriodValidation } from "@/hooks/usePeriodValidation"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DatePicker } from "@/components/shared/DatePicker"
import { format } from "date-fns"

interface PeriodValidationDateInputProps {
    date: Date | undefined
    onDateChange: (date: Date | undefined) => void
    onValidityChange?: (isValid: boolean) => void
    label?: string
    placeholder?: string
    className?: string
    disabled?: boolean
    required?: boolean
    validationType?: 'tax' | 'accounting' | 'both'
}

export function PeriodValidationDateInput({
    date,
    onDateChange,
    onValidityChange,
    label = "Fecha Emisión",
    className,
    disabled = false,
    required = true,
    validationType = 'tax'
}: PeriodValidationDateInputProps) {
    const { validatePeriod, isValidating, isClosed, message, clearPeriodValidation } = usePeriodValidation()

    // Notify parent about validity changes
    useEffect(() => {
        if (onValidityChange) {
            onValidityChange(!isClosed && !!date)
        }
    }, [isClosed, date, onValidityChange])

    // Trigger validation when date changes
    useEffect(() => {
        if (date && !disabled) {
            // Need to stringify date to YYYY-MM-DD for backend
            const dateStr = format(date, "yyyy-MM-dd")
            validatePeriod(dateStr, validationType)
        } else {
            clearPeriodValidation()
        }
    }, [date, validatePeriod, clearPeriodValidation, disabled, validationType])

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <Label className="text-xs font-bold uppercase">
                    {label} {required && <span className="text-destructive">*</span>}
                </Label>
            )}
            
            <div className="relative">
                <DatePicker
                    date={date}
                    onDateChange={onDateChange}
                    className={cn(
                        "w-full",
                        isClosed && "border-warning ring-1 ring-warning"
                    )}
                    // Can't pass disabled easily to DatePicker without modifying it if it doesn't support it,
                    // but we assume it either supports it or we can ignore for now.
                />
                
                {isValidating && (
                    <div className="absolute right-10 top-2.5 bg-background px-1">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>
            
            {isClosed && message && (
                <Alert className="mt-2 py-2 border-warning text-warning bg-transparent animate-in fade-in slide-in-from-top-1 duration-200 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2">
                    <AlertCircle className="h-4 w-4 stroke-warning" />
                    <AlertDescription className="text-xs font-medium">
                        {message}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    )
}
