"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface LabeledContainerProps {
    /** Label text rendered inside the fieldset legend (notched border). */
    label?: ReactNode
    /** Shows a red asterisk * after the label. */
    required?: boolean
    /** Error message — turns border red and shows text below the field. */
    error?: string
    /** Helper hint shown below when there is no error. */
    hint?: ReactNode
    /** Additional classes for the outer wrapper `<div>`. */
    containerClassName?: string
    /** Additional classes for the `<fieldset>`. */
    className?: string
    /** Icon or symbol shown as a prefix (inside the fieldset). */
    icon?: ReactNode
    /** Text or element shown as a suffix (inside the fieldset). */
    suffix?: ReactNode
    /** Additional classes for the label `<legend>`. */
    labelClassName?: string
    /** Whether the container is disabled. */
    disabled?: boolean
    /** The actual interactive content (e.g. DatePicker, Dropzone, etc). */
    children: ReactNode
}

/**
 * LabeledContainer — Notched/Fieldset wrapper for custom interactive elements.
 * 
 * Use this to wrap components that are not standard inputs or selects (like DatePickers,
 * custom selectors, or dropzones) to maintain the "Notched Fieldset" aesthetic.
 */
export function LabeledContainer({
    label,
    required,
    error,
    hint,
    containerClassName,
    className,
    icon,
    suffix,
    labelClassName,
    disabled,
    children
}: LabeledContainerProps) {
    const hasError = !!error

    return (
        <div className={cn("relative w-full group", containerClassName)}>
            <fieldset
                data-error={hasError ? "true" : undefined}
                data-disabled={disabled ? "true" : undefined}
                className={cn(
                    "notched-field",
                    "group-focus-within:border-primary group-focus-within:ring-1 group-focus-within:ring-primary/20",
                    hasError && "border-destructive group-focus-within:border-destructive group-focus-within:ring-destructive/20",
                    disabled && "opacity-50 cursor-not-allowed bg-muted/10",
                    className
                )}
            >
                {label && (
                    <legend className={cn(
                        "px-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-colors duration-200",
                        hasError ? "text-destructive" : "text-muted-foreground group-focus-within:text-primary",
                        disabled && "text-muted-foreground/50",
                        labelClassName
                    )}>
                        {label}
                        {required && <span className="text-destructive ml-0.5">*</span>}
                    </legend>
                )}

                <div className="flex items-center w-full min-h-[1.5rem]">
                    {icon && (
                        <div className="pl-2.5 flex items-center justify-center text-muted-foreground/60 group-focus-within:text-primary transition-colors shrink-0 leading-none">
                            {icon}
                        </div>
                    )}

                    <div className="flex-1 w-full flex items-center">
                        {children}
                    </div>

                    {suffix && (
                        <div className="pr-3 flex items-center justify-center text-muted-foreground/60 transition-colors shrink-0">
                            {suffix}
                        </div>
                    )}
                </div>
            </fieldset>

            {/* Hint & Error */}
            {(error || hint) && (
                <div className="px-1 pt-1 min-h-[1.25rem]">
                    {error ? (
                        <div className="text-[10px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                            {error}
                        </div>
                    ) : hint ? (
                        <div className="text-[10px] text-muted-foreground">
                            {hint}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}
