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
    /** Optional className for the internal Switch component. Overrides default premium style. */
    switchClassName?: string
    /** Optional className for the internal Switch thumb. Overrides default premium style. */
    thumbClassName?: string
    /** Color variant for active state. Defaults to 'primary'. */
    color?: "primary" | "warning" | "success" | "destructive" | "info"
}

/**
 * LabeledSwitch — "Notched Boolean" standard component
 *
 * DESIGN CONTRACT:
 * - Default (off) state: `border-dashed` border, neutral track.
 * - Active (on) state:   Themed glow, high-contrast track, and glowing thumb.
 * - Interaction: Full row is clickable, protected against event bubbling loops.
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
    switchClassName,
    thumbClassName,
    color = "primary",
}: LabeledSwitchProps) {
    // Premium color mapping
    const colorStyles = {
        primary: {
            container: "bg-primary/10 border-primary/30 ring-1 ring-primary/10",
            switch: "data-[state=checked]:bg-primary/60 data-[state=unchecked]:bg-primary/15 border-primary/20",
            thumb: "bg-primary shadow-[0_0_8px_oklch(var(--primary-raw)/0.5)]",
            icon: "text-primary"
        },
        warning: {
            container: "bg-warning/10 border-warning/30 ring-1 ring-warning/10",
            switch: "data-[state=checked]:bg-warning/60 data-[state=unchecked]:bg-warning/15 border-warning/20",
            thumb: "bg-warning shadow-[0_0_8px_oklch(var(--warning-raw)/0.5)]",
            icon: "text-warning"
        },
        success: {
            container: "bg-success/10 border-success/30 ring-1 ring-success/10",
            switch: "data-[state=checked]:bg-success/60 data-[state=unchecked]:bg-success/15 border-success/20",
            thumb: "bg-success shadow-[0_0_8px_oklch(var(--success-raw)/0.5)]",
            icon: "text-success"
        },
        destructive: {
            container: "bg-destructive/10 border-destructive/30 ring-1 ring-destructive/10",
            switch: "data-[state=checked]:bg-destructive/60 data-[state=unchecked]:bg-destructive/15 border-destructive/20",
            thumb: "bg-destructive shadow-[0_0_8px_oklch(var(--destructive-raw)/0.5)]",
            icon: "text-destructive"
        },
        info: {
            container: "bg-info/10 border-info/30 ring-1 ring-info/10",
            switch: "data-[state=checked]:bg-info/60 data-[state=unchecked]:bg-info/15 border-info/20",
            thumb: "bg-info shadow-[0_0_8px_oklch(var(--info-raw)/0.5)]",
            icon: "text-info"
        }
    }[color]

    return (
        <LabeledContainer
            label={label}
            error={error}
            hint={hint}
            disabled={disabled}
            className={cn(
                "transition-all duration-300",
                !checked && "border-dashed bg-background border-border hover:border-muted-foreground/30 hover:bg-muted/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]",
                checked && colorStyles.container,
                className
            )}
        >
            <div
                className="flex items-center justify-between w-full px-3 h-full min-h-[1.5rem] cursor-pointer gap-3"
                onClick={(e) => {
                    if (disabled) return
                    const target = e.target as HTMLElement
                    if (target.closest('button, input, [role="switch"]')) return
                    onCheckedChange(!checked)
                }}
            >
                {icon && (
                    <span className={cn("shrink-0 flex items-center transition-colors", checked ? colorStyles.icon : "text-muted-foreground/30")}>
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
                    className={cn(colorStyles.switch, switchClassName)}
                    thumbClassName={cn(
                        "transition-colors duration-300",
                        checked ? colorStyles.thumb : "bg-muted-foreground/40",
                        thumbClassName
                    )}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </LabeledContainer>
    )
}
