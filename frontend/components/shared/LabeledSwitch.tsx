"use client"

import React from "react"
import { Switch } from "@/components/ui/switch"
import { LabeledContainer } from "./LabeledContainer"
import { cn } from "@/lib/utils"

interface LabeledSwitchProps {
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
 * LabeledSwitch
 * 
 * Standardized boolean toggle for ERPGrafico.
 * Follows the "Notched Boolean" pattern: Legend on notch, description on left, switch on right.
 */
export function LabeledSwitch({
    label,
    description,
    checked,
    onCheckedChange,
    disabled,
    error,
    hint,
    className
}: LabeledSwitchProps) {
    return (
        <LabeledContainer
            label={label}
            error={error}
            hint={hint}
            disabled={disabled}
            className={className}
        >
            <div className="flex items-center justify-between w-full pr-4 py-1.5 min-h-[1.5rem]">
                <span className={cn(
                    "text-xs font-bold transition-colors",
                    checked ? "text-foreground" : "text-muted-foreground/70"
                )}>
                    {description}
                </span>
                <Switch
                    checked={checked}
                    onCheckedChange={onCheckedChange}
                    disabled={disabled}
                />
            </div>
        </LabeledContainer>
    )
}
