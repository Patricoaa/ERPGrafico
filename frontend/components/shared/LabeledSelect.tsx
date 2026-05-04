"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { SelectProps } from "@radix-ui/react-select"

export interface LabeledSelectOption {
    value: string
    label: React.ReactNode
}

export interface LabeledSelectProps extends Omit<SelectProps, "value" | "onValueChange"> {
    /** Label text rendered inside the fieldset legend (notched border). Optional for table usage. */
    label?: React.ReactNode
    /** Options to render inside the select dropdown. */
    options: LabeledSelectOption[]
    /** Controlled value */
    value?: string
    /** Icon or symbol shown as a prefix (inside the fieldset). */
    icon?: React.ReactNode
    /** Callback when value changes */
    onChange?: (value: string) => void
    /** Placeholder when no value is selected */
    placeholder?: string
    /** Shows a red asterisk * after the label. */
    required?: boolean
    /** Error message — turns border red and shows text below the field. */
    error?: string
    /** Helper hint shown below when there is no error. */
    /** Helper hint shown below when there is no error. */
    hint?: React.ReactNode
    /** Additional classes for the outer wrapper `<div>`. */
    containerClassName?: string
    /** Additional classes for the `SelectTrigger` button. */
    className?: string
    /** Display variant: 'standalone' (notched fieldset) or 'inline' (clean trigger) */
    variant?: 'standalone' | 'inline'
}

/**
 * LabeledSelect — Notched/Fieldset select primitive.
 *
 * Wraps Shadcn UI `<Select>` inside a `<fieldset>` with a `<legend>` 
 * to provide the "Notched/Fieldset" aesthetic identical to `LabeledInput`.
 */
export const LabeledSelect = forwardRef<
    React.ElementRef<typeof SelectTrigger>,
    LabeledSelectProps
>((props, ref) => {
    const {
        label,
        options,
        value,
        onChange,
        placeholder,
        required,
        error,
        hint,
        containerClassName,
        className,
        disabled,
        open,
        onOpenChange,
        icon,
        variant = 'standalone',
        ...rest
    } = props

    const hasError = !!error

    const selectTrigger = (
        <Select
            value={value}
            onValueChange={onChange}
            disabled={disabled}
            open={open}
            onOpenChange={onOpenChange}
            {...rest}
        >
            <SelectTrigger
                ref={ref}
                className={cn(
                    "w-full shadow-none focus:ring-0 focus:ring-offset-0 transition-all !py-0",
                    variant === 'standalone'
                        ? "!h-[1.5rem] border-0 bg-transparent hover:bg-primary/[0.03]"
                        : cn("h-9 text-xs border border-border/80 rounded-md bg-background hover:bg-primary/[0.02]", className),
                    !value && "text-muted-foreground font-normal"
                )}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent position="popper" align="start" className="w-[var(--radix-select-trigger-width)]">
                {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )

    return (
        <div className={cn("relative w-full group", variant === 'standalone' && containerClassName)}>
            {variant === 'standalone' ? (
                <fieldset
                    className={cn(
                        "notched-field transition-all duration-200",
                        "group-focus-within:border-primary group-focus-within:ring-1 group-focus-within:ring-primary/20",
                        hasError && "border-destructive group-focus-within:border-destructive group-focus-within:ring-destructive/20",
                        disabled && "opacity-50 cursor-not-allowed bg-muted/10"
                    )}
                >
                    {label && (
                        <legend
                            className={cn(
                                "px-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-colors duration-200",
                                hasError ? "text-destructive" : "text-muted-foreground group-focus-within:text-primary",
                                disabled && "text-muted-foreground/50"
                            )}
                        >
                            {label}
                            {required && <span className="text-destructive ml-0.5">*</span>}
                        </legend>
                    )}

                    <div className="flex items-center w-full">
                        {icon && (
                            <div className="pl-3 flex items-center justify-center text-muted-foreground/60 group-focus-within:text-primary transition-colors shrink-0">
                                {icon}
                            </div>
                        )}
                        {selectTrigger}
                    </div>
                </fieldset>
            ) : (
                selectTrigger
            )}

            {/* Error or Hint Text */}
            {hasError ? (
                <div className="mt-1.5 text-[11px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 px-1">
                    {error}
                </div>
            ) : hint ? (
                <div className="mt-1.5 text-[11px] font-medium text-muted-foreground/70 px-1">
                    {hint}
                </div>
            ) : null}
        </div>
    )
})

LabeledSelect.displayName = "LabeledSelect"
