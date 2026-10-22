"use client"

import { forwardRef, type ComponentPropsWithoutRef } from "react"
import type { VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

export const SELECTOR_TRIGGER_BASE = "w-full justify-between overflow-hidden shadow-none focus-visible:ring-0 transition-all font-normal"
export const SELECTOR_PLACEHOLDER_CLASS = "text-sm text-muted-foreground/60 font-normal"
export const SELECTOR_VALUE_CLASS = "text-sm text-foreground font-normal"

export type SelectorTriggerVariant = "standalone" | "inline"

export type SelectorButtonVariant = VariantProps<typeof buttonVariants>["variant"]

export interface SelectorTriggerProps extends Omit<ComponentPropsWithoutRef<typeof Button>, "variant" | "size" | "children"> {
    /** Whether a value is currently selected */
    hasValue: boolean
    /** Selected value display content */
    children?: React.ReactNode
    /** Placeholder text when no value selected. Default: "Seleccionar..." */
    placeholder?: string
    /** Prefix icon */
    icon?: React.ReactNode
    /** Visual variant */
    variant?: SelectorTriggerVariant
    /** Button variant (ghost/outline). Default: ghost */
    buttonVariant?: SelectorButtonVariant
    /** Trailing content (e.g., clear button) */
    trailing?: React.ReactNode
    /** Show chevron. Default: true */
    showChevron?: boolean
    /** Additional classes for the chevron */
    chevronClassName?: string
    /** Open state — reflected as aria-expanded when provided */
    open?: boolean
}

export const SelectorTrigger = forwardRef<HTMLButtonElement, SelectorTriggerProps>(
    ({
        hasValue,
        children,
        placeholder = "Seleccionar...",
        icon,
        variant = "standalone",
        buttonVariant = "ghost",
        disabled,
        open,
        className,
        trailing,
        showChevron = true,
        chevronClassName,
        onClick,
        ...rest
    }, forwardedRef) => {
        const ariaProps = open === undefined ? {} : { "aria-expanded": open }

        return (
            <Button
                ref={forwardedRef}
                type="button"
                variant={buttonVariant}
                role="combobox"
                disabled={disabled}
                onClick={onClick}
                className={cn(
                    SELECTOR_TRIGGER_BASE,
                    variant === "standalone"
                        ? "h-6! min-h-0! py-0 px-3 border-none bg-transparent hover:bg-primary/[0.03]"
                        : "h-9 py-0 px-2 bg-background hover:bg-primary/[0.02]",
                    className
                )}
                {...ariaProps}
                {...rest}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {icon && (
                        <div className="flex items-center justify-center text-muted-foreground/60 group-focus-within:text-primary transition-colors shrink-0">
                            {icon}
                        </div>
                    )}
                    {hasValue ? (
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {children}
                        </div>
                    ) : (
                        <span className={SELECTOR_PLACEHOLDER_CLASS}>{placeholder}</span>
                    )}
                </div>
                {trailing}
                {showChevron && <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50", chevronClassName)} />}
            </Button>
        )
    }
)

SelectorTrigger.displayName = "SelectorTrigger"