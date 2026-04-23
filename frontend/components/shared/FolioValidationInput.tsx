"use client"

import { useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { AlertCircle, Loader2, CheckCircle } from "lucide-react"
import { useFolioValidation, FolioValidationResult } from "@/hooks/useFolioValidation"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
        <div className={cn("space-y-2", className)}>
            <Label htmlFor="folio-input" className="text-xs font-bold uppercase">
                {label} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
                <Input
                    id="folio-input"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    className={cn(
                        validationResult && !validationResult.is_unique && "border-warning pr-10"
                    )}
                />
                {isValidating && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {validationResult && !isValidating && (
                    validationResult.is_unique ? (
                        <CheckCircle className="absolute right-3 top-2.5 h-4 w-4 text-success" />
                    ) : (
                        <AlertCircle className="absolute right-3 top-2.5 h-4 w-4 text-warning" />
                    )
                )}
            </div>
            
            {validationResult && !validationResult.is_unique && (
                <Alert className="mt-2 py-2 border-warning text-warning bg-transparent animate-in fade-in slide-in-from-top-1 duration-200 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2">
                    <AlertCircle className="h-4 w-4 stroke-warning" />
                    <AlertDescription className="text-xs">
                        {validationResult.message}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    )
}
