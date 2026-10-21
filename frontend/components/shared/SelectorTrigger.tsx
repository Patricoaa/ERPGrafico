"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

export interface SelectorTriggerProps {
    /** Whether a value is currently selected */
    hasValue: boolean
    /** Selected value display content */
    children?: React.ReactNode
    /** Placeholder text when no value selected. Default: "Seleccionar..." */
    placeholder?: string
    /** Prefix icon */
    icon?: React.ReactNode
    /** Disabled state */
    disabled?: boolean
    /** Open state for popover */
    open?: boolean
    /** Additional classes for the button */
    className?: string
    /** onClick handler */
    onClick?: () => void
}

/**
 * SelectorTrigger — Shared trigger component for entity selectors.
 * 
 * Provides consistent empty-state typography: text-sm text-muted-foreground/60
 * and standard height h-6 for standalone variant.
 * 
 * Usage:
 * ```tsx
 * <SelectorTrigger
 *   hasValue={!!selectedEntity}
 *   placeholder="Seleccionar..."
 *   icon={<UserIcon />}
 * >
 *   {selectedEntity && <span className="text-sm truncate">{selectedEntity.name}</span>}
 * </SelectorTrigger>
 * ```
 */
export const SelectorTrigger = forwardRef<HTMLButtonElement, SelectorTriggerProps>(
    ({ hasValue, children, placeholder = "Seleccionar...", icon, disabled, open, className, onClick }, forwardedRef) => {
        return (
            <Button
                ref={forwardedRef}
                type="button"
                variant="ghost"
                role="combobox"
                aria-expanded={open}
                disabled={disabled}
                onClick={onClick}
                className={cn(
                    "w-full justify-between overflow-hidden shadow-none focus-visible:ring-0 transition-all font-normal",
                    "h-6! py-0 px-3 border-none bg-transparent hover:bg-primary/[0.03]",
                    icon && "pl-1",
                    className
                )}
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
                        <span className="text-sm text-muted-foreground/60">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
        )
    }
)

SelectorTrigger.displayName = "SelectorTrigger"
