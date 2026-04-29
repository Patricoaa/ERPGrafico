"use client"

import { useEffect, useRef } from "react"
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
    error?: string
    icon?: React.ReactNode
}

export function PeriodValidationDateInput({
    date,
    onDateChange,
    onValidityChange,
    label = "Fecha Emisión",
    className,
    disabled = false,
    required = true,
    validationType = 'tax',
    error,
    icon
}: PeriodValidationDateInputProps) {
    const { validatePeriod, isValidating, isClosed, message, clearPeriodValidation } = usePeriodValidation()

    // Stable ref for parent callback — avoids retriggering effects when parent
    // passes a new inline arrow on every render (root cause of update-depth loop).
    const onValidityChangeRef = useRef(onValidityChange)
    useEffect(() => {
        onValidityChangeRef.current = onValidityChange
    })

    // Notify parent about validity changes — callback NOT in deps.
    useEffect(() => {
        onValidityChangeRef.current?.(!isClosed && !!date)
    }, [isClosed, date])

    // Trigger validation when date changes
    useEffect(() => {
        if (date && !disabled) {
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
            icon={icon}
            error={error || (isClosed ? (message || "El periodo contable/tributario está cerrado.") : undefined)}
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
