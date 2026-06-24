"use client"

import { type ButtonHTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/utils"

interface NotchedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** Optional label rendered as a notched legend */
    label?: string
    /** Whether the button is disabled */
    disabled?: boolean
}

/**
 * NotchedButton — A button styled with the notched-fieldset aesthetic.
 *
 * Renders a `<fieldset>` with `notched-field` class so it visually matches
 * LabeledInput, LabeledSelect, and other notched primitives.
 * Use `label` for an optional legend, or leave it off for icon-only buttons.
 */
export const NotchedButton = forwardRef<HTMLButtonElement, NotchedButtonProps>(
    ({ label, disabled, className, children, ...props }, ref) => {
        return (
            <fieldset
                className={cn(
                    "notched-field flex flex-col justify-center cursor-pointer transition-colors",
                    "hover:border-primary/40",
                    className
                )}
                data-disabled={disabled || undefined}
            >
                {label && (
                    <legend className="px-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                        {label}
                    </legend>
                )}
                <button
                    ref={ref}
                    type="button"
                    disabled={disabled}
                    className="flex items-center justify-center w-full h-full cursor-inherit"
                    {...props}
                >
                    {children}
                </button>
            </fieldset>
        )
    }
)

NotchedButton.displayName = "NotchedButton"
