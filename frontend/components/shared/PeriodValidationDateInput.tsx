"use client"

import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { usePeriodValidation } from "@/hooks/usePeriodValidation"
import { cn } from "@/lib/utils"
import { DatePicker } from "@/components/shared/DatePicker"
import { LabeledContainer } from "@/components/shared/LabeledContainer"
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
        <LabeledContainer
            label={label}
            required={required}
            disabled={disabled}
            className={className}
            error={isClosed ? (message || "El periodo contable/tributario está cerrado.") : undefined}
            suffix={
                isValidating && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )
            }
        >
            <DatePicker
                date={date}
                onDateChange={onDateChange}
                disabled={disabled}
                className={cn(
                    "w-full border-0 bg-transparent shadow-none hover:bg-transparent focus-visible:ring-0 h-[1.5rem] p-0",
                    isClosed && "text-destructive"
                )}
            />
        </LabeledContainer>
    )
}
