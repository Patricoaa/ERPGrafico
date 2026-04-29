"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, Loader2, CheckCircle } from "lucide-react"
import { LabeledInput } from "./LabeledInput"
import { useFolioValidation, FolioValidationResult } from "@/hooks/useFolioValidation"
import { cn } from "@/lib/utils"
import { useTouchMode } from "@/hooks/useTouchMode"
import { NumpadModal } from "@/features/pos/components/NumpadModal"

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
    const { isTouchMode } = useTouchMode()
    const [numpadOpen, setNumpadOpen] = useState(false)
    const [tempValue, setTempValue] = useState("")

    // Stable ref for parent callback — avoids retriggering effects when parent
    // passes a new inline arrow on every render (root cause of update-depth loop).
    const onValidityChangeRef = useRef(onValidityChange)
    useEffect(() => {
        onValidityChangeRef.current = onValidityChange
    })

    // Notify parent about validity changes — callback NOT in deps.
    useEffect(() => {
        const isValid = !validationResult || validationResult.is_unique
        onValidityChangeRef.current?.(isValid, validationResult)
    }, [validationResult])

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
                onClick={(e) => {
                    if (isTouchMode && !disabled) {
                        e.preventDefault()
                        setTempValue(value)
                        setNumpadOpen(true)
                    }
                }}
                readOnly={isTouchMode}
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
            {isTouchMode && (
                <NumpadModal
                    open={numpadOpen}
                    onOpenChange={setNumpadOpen}
                    title={label}
                    value={tempValue}
                    onChange={setTempValue}
                    onConfirm={() => {
                        onChange(tempValue)
                        setNumpadOpen(false)
                    }}
                    allowDecimal={false}
                />
            )}
        </div>
    )
}
