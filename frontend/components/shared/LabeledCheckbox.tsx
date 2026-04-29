"use client"

import React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { LabeledContainer } from "./LabeledContainer"
import { cn } from "@/lib/utils"

interface LabeledCheckboxProps {
    label: string
    description: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
    error?: string
    hint?: string
    className?: string
}

/**
 * LabeledCheckbox
 * 
 * Standardized checkbox for ERPGrafico.
 * Follows the "Notched Boolean" pattern: Legend on notch, description on left, checkbox on right.
 */
export function LabeledCheckbox({
    label,
    description,
    checked,
    onCheckedChange,
    disabled,
    error,
    hint,
    className
}: LabeledCheckboxProps) {
    return (
        <LabeledContainer
            label={label}
            error={error}
            hint={hint}
            disabled={disabled}
            className={className}
        >
            <div
                className="flex items-center justify-between w-full px-3 py-1.5 min-h-[1.5rem] cursor-pointer"
                onClick={() => !disabled && onCheckedChange(!checked)}
            >
                <span className={cn(
                    "text-xs font-bold transition-colors",
                    checked ? "text-foreground" : "text-muted-foreground/70"
                )}>
                    {description}
                </span>
                <Checkbox
                    checked={checked}
                    onCheckedChange={onCheckedChange}
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </LabeledContainer>
    )
}
