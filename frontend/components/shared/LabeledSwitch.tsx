"use client"

import React from "react"
import { Switch } from "@/components/ui/switch"
import { LabeledContainer } from "./LabeledContainer"
import { cn } from "@/lib/utils"

interface LabeledSwitchProps {
    label: string
    description?: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
    error?: string
    hint?: string
    /** Optional icon rendered left of description. Use reactive color tied to checked state. */
    icon?: React.ReactNode
    className?: string
}

/**
 * LabeledSwitch — "Notched Boolean" standard component
 *
 * DESIGN CONTRACT (Industrial Premium):
 * - Default (off) state: `border-dashed` border — communicates an inactive/available feature
 * - Active (on) state:   caller passes `bg-X/5 border-X/20 shadow-sm` via `className` — communicates engagement
 * - The `checked` state drives the visual boundary: dashed = off, solid = on
 * - `icon` prop should carry reactive color: `checked ? "text-primary" : "text-muted-foreground/30"`
 * - Full row is clickable (label + switch area) for Fitts' Law compliance
 *
 * STANDARD USAGE:
 * ```tsx
 * <LabeledSwitch
 *   label="Lista de Materiales"
 *   description="Habilitar receta de fabricación."
 *   checked={field.value}
 *   onCheckedChange={field.onChange}
 *   icon={<Layers className={cn("h-4 w-4 transition-colors", field.value ? "text-primary" : "text-muted-foreground/30")} />}
 *   className={cn(field.value ? "bg-primary/5 border-primary/20 shadow-sm" : "border-dashed")}
 * />
 * ```
 */
export function LabeledSwitch({
    label,
    description,
    checked,
    onCheckedChange,
    disabled,
    error,
    hint,
    icon,
    className,
}: LabeledSwitchProps) {
    return (
        <LabeledContainer
            label={label}
            error={error}
            hint={hint}
            disabled={disabled}
            className={cn(!className && !checked && "border-dashed", className)}
        >
            <div
                className="flex items-center justify-between w-full px-3 h-full min-h-[1.5rem] cursor-pointer gap-3"
                onClick={() => !disabled && onCheckedChange(!checked)}
            >
                {icon && (
                    <span className="shrink-0 flex items-center">
                        {icon}
                    </span>
                )}
                {description && (
                    <span className={cn(
                        "text-xs font-bold transition-colors flex-1 min-w-0",
                        checked ? "text-foreground" : "text-muted-foreground/70"
                    )}>
                        {description}
                    </span>
                )}
                <Switch
                    checked={checked}
                    onCheckedChange={onCheckedChange}
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </LabeledContainer>
    )
}
