"use client"

import { useEffect, useCallback } from "react"
import { AlertCircle, Loader2, CheckCircle } from "lucide-react"
import { LabeledInput } from "./LabeledInput"
import { useFolioValidation, FolioValidationResult } from "@/hooks/useFolioValidation"
import { cn } from "@/lib/utils"

interface FolioValidationInputProps {
    value: string
    onChange: (value: string) => void
    dteType: string
    contactId?: number
    isPurchase?: boolean
    excludeId?: number
    onValidityChange?: (isValid: boolean, result: FolioValidationResult | null) => void
    label?: string
    placeholder?: string
    className?: string
    autoFocus?: boolean
    disabled?: boolean
}

export function FolioValidationInput({
    value,
    onChange,
    dteType,
    contactId,
    isPurchase = false,
    excludeId,
    onValidityChange,
    label = "N° de Folio",
    placeholder = "Ej: 45223",
    className,
    autoFocus = false,
    disabled = false
}: FolioValidationInputProps) {
    const { validateFolio, isValidating, validationResult, clearValidation } = useFolioValidation()

    // Notify parent about validity changes
    useEffect(() => {
        if (onValidityChange) {
            const isValid = !validationResult || validationResult.is_unique
            onValidityChange(isValid, validationResult)
        }
    }, [validationResult, onValidityChange])

    // Trigger validation when inputs change
    useEffect(() => {
        if (value && dteType && !disabled) {
            validateFolio(value, dteType, {
                excludeId,
                contactId,
                isPurchase
            })
        } else {
            clearValidation()
        }
    }, [value, dteType, contactId, isPurchase, excludeId, validateFolio, clearValidation, disabled])

    return (
        <div className={cn("relative", className)}>
            <LabeledInput
                label={label}
                required
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                autoFocus={autoFocus}
                error={validationResult && !validationResult.is_unique ? validationResult.message : undefined}
                className={cn(
                    "pr-10",
                    validationResult && !validationResult.is_unique && "border-warning text-warning"
                )}
                suffix={
                    <div className="flex items-center">
                        {isValidating && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {validationResult && !isValidating && (
                            validationResult.is_unique ? (
                                <CheckCircle className="h-4 w-4 text-success" />
                            ) : (
                                <AlertCircle className="h-4 w-4 text-warning" />
                            )
                        )}
                    </div>
                }
            />
        </div>
    )
}
