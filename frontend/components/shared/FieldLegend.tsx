"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"

interface FieldLegendProps {
    /** Label text rendered inside the fieldset legend (notched border). */
    label?: ReactNode
    /** Shows a red asterisk * after the label. */
    required?: boolean
    /** Error state — turns legend red. */
    hasError?: boolean
    /** Focus-within state — turns legend primary. */
    isFocused?: boolean
    /** Disabled state. */
    disabled?: boolean
    /** Additional classes for the legend. */
    className?: string
    /** Tooltip text shown on hover of a small ℹ icon inline in the legend. */
    tooltip?: string
}

/**
 * FieldLegend — Single source of truth for notched-field legends.
 *
 * Enforces the N2 contract (typography-scale.md):
 *   `text-2xs font-bold uppercase tracking-widest`
 *
 * Both LabeledInput and LabeledContainer delegate here so labels
 * can never drift.
 */
export function FieldLegend({
    label,
    required,
    hasError,
    isFocused,
    disabled,
    className,
    tooltip
}: FieldLegendProps) {
    if (!label) return null

    const legendBase = cn(
        "px-1.5 text-2xs font-bold uppercase tracking-widest transition-colors duration-200 flex items-center gap-1",
        hasError
            ? "text-destructive"
            : disabled
                ? "text-muted-foreground/40"
                : isFocused
                    ? "text-primary"
                    : "text-muted-foreground group-focus-within:text-primary",
        className
    )

    if (!tooltip) {
        return (
            <legend className={legendBase}>
                {label}
                {required && (
                    <span className="text-destructive ml-0.5" aria-hidden="true">
                        *
                    </span>
                )}
            </legend>
        )
    }

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <legend className={legendBase}>
                        {label}
                        {required && (
                            <span className="text-destructive ml-0.5" aria-hidden="true">
                                *
                            </span>
                        )}
                        <Info className="h-2.5 w-2.5 opacity-50 hover:opacity-100 cursor-help transition-opacity ml-0.5" />
                    </legend>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

/**
 * Class string for the legend — use when you render your own <legend>
 * and can't compose FieldLegend (e.g. LabeledContainer which needs
 * to wrap children differently).
 *
 * Contract: N2 label = `text-2xs font-bold uppercase tracking-widest`
 */
export const fieldLegendClasses = (
    hasError?: boolean,
    disabled?: boolean,
    isFocused?: boolean
) =>
    `px-1.5 text-2xs font-bold uppercase tracking-widest transition-colors duration-200 ${
        hasError
            ? "text-destructive"
            : disabled
                ? "text-muted-foreground/40"
                : isFocused
                    ? "text-primary"
                    : "text-muted-foreground group-focus-within:text-primary"
    }`